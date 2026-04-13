'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'

export async function createPayPalOrder(itemIds: string[]) {
  const supabase = await createClient()
  const admin = createAdminClient()

  if (!itemIds || itemIds.length === 0) {
    throw new Error('No items provided for checkout.')
  }

  // ── Atomic Inventory Locking ──────────────────────────────────────────────
  const tenMinsFromNow = new Date(Date.now() + 10 * 60000).toISOString();
  
  // Attempt to lock ONLY items that are fully available OR have expired locks
  const { data: lockedItems, error: lockErr } = await (admin.from('inventory') as any)
    .update({ status: 'pending_checkout', checkout_expires_at: tenMinsFromNow })
    .in('id', itemIds)
    // Supabase standard syntax for nested filters
    .or(`status.eq.available,and(status.eq.pending_checkout,checkout_expires_at.lt.${new Date().toISOString()})`)
    .select('id, listed_price, avg_price, is_lot, lot_id');

  if (lockErr || !lockedItems) {
    throw new Error('Failed to query inventory prices.');
  }

  // If the number of successfully locked rows doesn't match the requested items,
  // it means another user bought/locked one of them first.
  if (lockedItems.length !== itemIds.length) {
    // Release any items we *did* manage to lock in this partial batch to avoid grieving
    if (lockedItems.length > 0) {
       await (admin.from('inventory') as any)
          .update({ status: 'available', checkout_expires_at: null })
          .in('id', lockedItems.map((i: any) => i.id));
    }
    throw new Error('One or more items in your cart are no longer available.');
  }
  
  const purchaseItems = lockedItems;
  // ── End Atomic Lock ───────────────────────────────────────────────────────

  // We keep the Lot Ghost-Cart Failsafe here, but update them to pending_checkout rather than sold.
  // Sold status belongs ONLY inside capturePayPalOrder now!
  const lotIds = purchaseItems.filter((i: any) => i.is_lot).map((i: any) => i.id)
  if (lotIds.length > 0) {
    await (admin.from('inventory') as any)
      .update({ status: 'pending_checkout', checkout_expires_at: tenMinsFromNow })
      .in('lot_id', lotIds)
  }

  // Case B: Buying an individual card that belongs to a lot → lock the parent lot
  const parentLotIds = purchaseItems
    .filter((i: any) => !i.is_lot && i.lot_id)
    .map((i: any) => i.lot_id as string)
  const uniqueParentLotIds = [...new Set(parentLotIds)]
  if (uniqueParentLotIds.length > 0) {
    await (admin.from('inventory') as any)
      .update({ status: 'pending_checkout', checkout_expires_at: tenMinsFromNow })
      .in('id', uniqueParentLotIds)
  }
  // ── End Failsafe ────────────────────────────────────────────────────────

  let subtotal = 0;
  for (const item of purchaseItems) {
    subtotal += Number(item.listed_price ?? item.avg_price ?? 0);
  }

  const { data: settings } = await (admin.from('store_settings') as any).select('shipping_fee, free_shipping_threshold').eq('id', 1).single();
  const SHIPPING_THRESHOLD = settings?.free_shipping_threshold ?? 25.00;
  const SHIPPING_FEE = settings?.shipping_fee ?? 4.00;
  const shipping = subtotal < SHIPPING_THRESHOLD ? SHIPPING_FEE : 0.00;
  const total = subtotal + shipping;

  // Setup credentials assuming they are in environment variables
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials missing or not configured.');
  }

  const environment = process.env.NODE_ENV === 'production' ? 'api-m.paypal.com' : 'api-m.sandbox.paypal.com';

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenRes = await fetch(`https://${environment}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!tokenRes.ok) {
    throw new Error('Failed to generate PayPal access token.');
  }

  const tokenData = await tokenRes.json();

  const orderRes = await fetch(`https://${environment}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: total.toFixed(2),
          breakdown: {
            item_total: { currency_code: 'USD', value: subtotal.toFixed(2) },
            shipping: { currency_code: 'USD', value: shipping.toFixed(2) }
          }
        }
      }]
    })
  });

  if (!orderRes.ok) {
    const errText = await orderRes.text();
    throw new Error(`Failed to create PayPal order: ${errText}`);
  }

  const orderData = await orderRes.json();
  
  return { orderId: orderData.id };
export async function capturePayPalOrder(orderId: string, itemIds: string[]) {
  const admin = createAdminClient()
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials missing or not configured.');
  }
  const environment = process.env.NODE_ENV === 'production' ? 'api-m.paypal.com' : 'api-m.sandbox.paypal.com';

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenRes = await fetch(`https://${environment}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!tokenRes.ok) {
    throw new Error('Failed to generate PayPal access token.');
  }

  const tokenData = await tokenRes.json();

  const captureRes = await fetch(`https://${environment}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!captureRes.ok) {
    const errText = await captureRes.text();
    throw new Error(`Failed to capture PayPal order: ${errText}`);
  }

  const captureData = await captureRes.json();
  
  // ── Finalize Inventory (Mark Sold) ──────────────────────────────────────
  if (itemIds && itemIds.length > 0) {
    // 1. Mark the actual items sold
    await (admin.from('inventory') as any)
      .update({ status: 'sold', sold_at: new Date().toISOString() })
      .in('id', itemIds);
      
    // 2. Fetch those items to find linked lots
    const { data: purchaseItems } = await admin.from('inventory')
      .select('id, is_lot, lot_id')
      .in('id', itemIds);
      
    if (purchaseItems) {
      // Find children of lots we bought
      const lotIds = purchaseItems.filter(i => i.is_lot).map(i => i.id)
      if (lotIds.length > 0) {
        await (admin.from('inventory') as any)
          .update({ status: 'sold', sold_at: new Date().toISOString() })
          .in('lot_id', lotIds)
      }

      // Find parent lots of individual children we bought
      const parentLotIds = purchaseItems
        .filter(i => !i.is_lot && i.lot_id)
        .map(i => i.lot_id as string)
      const uniqueParentLotIds = [...new Set(parentLotIds)]
      if (uniqueParentLotIds.length > 0) {
        await (admin.from('inventory') as any)
          .update({ status: 'sold', sold_at: new Date().toISOString() })
          .in('id', uniqueParentLotIds)
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────
  
  return { success: true, captureData };
}
