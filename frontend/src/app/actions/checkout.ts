"use server";
import pool from '@/utils/db';


export async function validateCartItems(itemIds: string[]) {
  if (!itemIds || itemIds.length === 0) return [];
  const { rows } = await pool.query(`SELECT id, status, checkout_expires_at FROM inventory WHERE id = ANY($1::uuid[])`, [itemIds as any]);
  return rows;
}

export async function submitManualCheckout(itemIds: string[], buyerName: string, buyerEmail: string, shippingAddress: string) {

  if (!itemIds || itemIds.length === 0) {
    throw new Error('No items provided for checkout.')
  }

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
     throw new Error('One or more items in your cart are no longer available.');
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
    throw new Error('One or more items in your cart are no longer available.');
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
  const SHIPPING_THRESHOLD = settings?.free_shipping_threshold ?? 25.00;
  const SHIPPING_FEE = settings?.shipping_fee ?? 4.00;
  const shipping = subtotal < SHIPPING_THRESHOLD ? SHIPPING_FEE : 0.00;
  const total = subtotal + shipping;

  // Insert "Order" into trade_offers for CRM Management
  // We use trade_offers since it acts as the centralized Inbox for the admin.
  // offer_text = 'Checkout Order - Address: ...'
  
  const orderText = `CHECKOUT ORDER - Total: $${total.toFixed(2)} (Subtotal: $${subtotal.toFixed(2)}, Shipping: $${shipping.toFixed(2)})\nShipping Address:\n${shippingAddress}`;
  
  const { rows: orderRows } = await pool.query(`
      INSERT INTO trade_offers (buyer_name, buyer_email, offer_text, attached_image_url, target_items, status)
      VALUES ($1, $2, $3, $4, $5, 'pending_payment')
      RETURNING id
  `, [buyerName, buyerEmail, orderText, null, JSON.stringify(purchaseItems)]);

  return { success: true, orderId: orderRows[0].id, total };
}

