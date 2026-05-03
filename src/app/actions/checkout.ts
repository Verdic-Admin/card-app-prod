"use server";
import pool from '@/utils/db';

export type CheckoutResult = {
  success: true;
  orderId: string;
  subtotal: number;
  shipping: number;
  total: number;
  paymentMemo: string;
} | {
  success: false;
  error: string;
};

function buildPaymentMemo(opts: {
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  lines: { player_name: string; card_set: string | null; price: number }[];
  subtotal: number;
  shipping: number;
  total: number;
  tradeProposalCount: number;
}): string {
  const idShort = opts.orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const lineSummaries = opts.lines.map((l) => {
    const name = (l.player_name || "Card").slice(0, 24);
    const set = (l.card_set || "").slice(0, 16);
    const bit = set ? `${name} / ${set}` : name;
    return `${bit} $${l.price.toFixed(2)}`;
  });
  let memo = `PI ${idShort} | ${opts.buyerName} | $${opts.total.toFixed(2)} total`;
  if (opts.shipping > 0) {
    memo += ` (incl $${opts.shipping.toFixed(2)} ship)`;
  }
  memo += ` | ${opts.buyerEmail}`;
  if (opts.tradeProposalCount > 0) {
    memo += ` | +${opts.tradeProposalCount} trade proposal(s) in cart (submit via Trade button if not sent yet)`;
  }
  memo += " | ";
  memo += lineSummaries.join(" · ");
  const maxLen = 300;
  if (memo.length > maxLen) {
    memo =
      memo.slice(0, maxLen - 3).trimEnd() +
      `… (${opts.lines.length} items, $${opts.total.toFixed(2)})`;
  }
  return memo;
}

export async function validateCartItems(itemIds: string[]) {
  if (!itemIds || itemIds.length === 0) return [];
  const { rows } = await pool.query(`SELECT id, status, checkout_expires_at FROM inventory WHERE id = ANY($1::uuid[])`, [itemIds as any]);
  return rows;
}

export async function submitManualCheckout(
  itemIds: string[],
  buyerName: string,
  buyerEmail: string,
  shippingAddress: string,
  opts?: { tradeProposalCount?: number }
): Promise<CheckoutResult> {
  const tradeProposalCount = Math.max(0, Math.floor(opts?.tradeProposalCount ?? 0));

  if (!itemIds || itemIds.length === 0) {
    return { success: false, error: 'No items provided for checkout.' };
  }

  try {

  // ── Atomic Inventory Locking ──────────────────────────────────────────────
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60000).toISOString();
  
  const { rows: testRows } = await pool.query(`
      SELECT id 
      FROM inventory 
      WHERE id = ANY($1::uuid[]) 
      AND (
         status = 'available' 
         OR (status = 'pending_checkout' AND checkout_expires_at < NOW())
      )
  `, [itemIds as any]);
  
  if (testRows.length !== itemIds.length) {
     return { success: false, error: 'One or more items in your cart are no longer available.' };
  }

  // Atomically lock them and fetch fields
  const { rows: lockedItems } = await pool.query(`
      UPDATE inventory 
      SET status = 'pending_payment', checkout_expires_at = $1
      WHERE id = ANY($2::uuid[])
      RETURNING id, listed_price, avg_price, is_lot, lot_id, player_name, card_set
  `, [sevenDaysFromNow, itemIds as any]);

  if (lockedItems.length !== itemIds.length) {
    if (lockedItems.length > 0) {
       await pool.query(`UPDATE inventory SET status = 'available', checkout_expires_at = null WHERE id = ANY($1::uuid[])`, [lockedItems.map((i: any) => i.id) as any]);
    }
    return { success: false, error: 'One or more items in your cart are no longer available.' };
  }
  
  const purchaseItems = lockedItems;

  const lotIds = purchaseItems.filter((i: any) => i.is_lot).map((i: any) => i.id)
  if (lotIds.length > 0) {
    await pool.query(`UPDATE inventory SET status = 'pending_payment', checkout_expires_at = $1 WHERE lot_id = ANY($2::uuid[])`, [sevenDaysFromNow, lotIds as any]);
  }

  const parentLotIds = purchaseItems
    .filter((i: any) => !i.is_lot && i.lot_id)
    .map((i: any) => i.lot_id as string)
  const uniqueParentLotIds = [...new Set(parentLotIds)]
  if (uniqueParentLotIds.length > 0) {
    await pool.query(`UPDATE inventory SET status = 'pending_payment', checkout_expires_at = $1 WHERE id = ANY($2::uuid[])`, [sevenDaysFromNow, uniqueParentLotIds as any]);
  }
  // ── End Failsafe ────────────────────────────────────────────────────────

  let subtotal = 0;
  for (const item of purchaseItems) {
    subtotal += Number(item.listed_price ?? item.avg_price ?? 0);
  }

  const { rows: settingsRows } = await pool.query(`SELECT shipping_fee, free_shipping_threshold FROM store_settings WHERE id = 1`);
  const settings = settingsRows[0] || {};
  const SHIPPING_THRESHOLD = Number(settings?.free_shipping_threshold ?? 25.00);
  const SHIPPING_FEE = Number(settings?.shipping_fee ?? 4.00);
  const shipping = subtotal < SHIPPING_THRESHOLD ? SHIPPING_FEE : 0.00;
  const total = subtotal + shipping;

  const { rows: orderRows } = await pool.query(`
      INSERT INTO trade_offers (buyer_name, buyer_email, offer_text, attached_image_url, target_items, status)
      VALUES ($1, $2, $3, $4, $5, 'pending_payment')
      RETURNING id
  `, [
    buyerName,
    buyerEmail,
    `CHECKOUT ORDER - Total: $${total.toFixed(2)} (Subtotal: $${subtotal.toFixed(2)}, Shipping: $${shipping.toFixed(2)})\nShipping Address:\n${shippingAddress}`,
    null,
    JSON.stringify(purchaseItems),
  ]);

  const orderId = orderRows[0].id as string;

  const lines = purchaseItems.map((row: { player_name?: string; card_set?: string | null; listed_price?: unknown; avg_price?: unknown }) => ({
    player_name: row.player_name || "Card",
    card_set: row.card_set ?? null,
    price: Number(row.listed_price ?? row.avg_price ?? 0),
  }));

  const paymentMemo = buildPaymentMemo({
    orderId,
    buyerName,
    buyerEmail,
    lines,
    subtotal,
    shipping,
    total,
    tradeProposalCount,
  });

  await pool.query(
    `UPDATE trade_offers SET offer_text = offer_text || $2 WHERE id = $1`,
    [orderId, `\n\n--- Payment memo (copy to Venmo / PayPal / Cash App note) ---\n${paymentMemo}`]
  );

  return { success: true, orderId, subtotal, shipping, total, paymentMemo };
  } catch (err: any) {
    console.error("Checkout Server Action Error:", err);
    return { success: false, error: "An unexpected error occurred during checkout. Please try again." };
  }
}

