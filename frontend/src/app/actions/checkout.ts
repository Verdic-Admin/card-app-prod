'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'

export async function createPayPalOrder(itemIds: string[]) {
  const supabase = await createClient()
  const admin = createAdminClient()

  if (!itemIds || itemIds.length === 0) {
    throw new Error('No items provided for checkout.')
  }

  // ── Lot Ghost-Cart Failsafe ─────────────────────────────────────────────
  // Fetch full records so we know is_lot and lot_id for every item being bought
  const { data: purchaseItems, error: fetchErr } = await supabase
    .from('inventory')
    .select('id, listed_price, avg_price, is_lot, lot_id')
    .in('id', itemIds)

  if (fetchErr || !purchaseItems || purchaseItems.length === 0) {
    throw new Error('Failed to query inventory prices.')
  }

  // Case A: Buying a Lot → mark all its child cards sold
  const lotIds = purchaseItems.filter(i => i.is_lot).map(i => i.id)
  if (lotIds.length > 0) {
    await (admin.from('inventory') as any)
      .update({ status: 'sold', sold_at: new Date().toISOString() })
      .in('lot_id', lotIds)
  }

  // Case B: Buying an individual card that belongs to a lot → mark the parent lot sold
  const parentLotIds = purchaseItems
    .filter(i => !i.is_lot && i.lot_id)
    .map(i => i.lot_id as string)
  const uniqueParentLotIds = [...new Set(parentLotIds)]
  if (uniqueParentLotIds.length > 0) {
    await (admin.from('inventory') as any)
      .update({ status: 'sold', sold_at: new Date().toISOString() })
      .in('id', uniqueParentLotIds)
  }
  // ── End Failsafe ────────────────────────────────────────────────────────

  let subtotal = 0;
  for (const item of purchaseItems) {
    subtotal += Number(item.listed_price ?? item.avg_price ?? 0);
  }

  const SHIPPING_THRESHOLD = 25.00;
  const SHIPPING_FEE = 4.00;
  const shipping = subtotal < SHIPPING_THRESHOLD ? SHIPPING_FEE : 0.00;
  const total = subtotal + shipping;

  // Setup credentials assuming they are in environment variables
  const clientId = process.env.PAYPAL_CLIENT_ID || 'dummy_client_id';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'dummy_secret';
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
}

export async function capturePayPalOrder(orderId: string) {
  const clientId = process.env.PAYPAL_CLIENT_ID || 'dummy_client_id';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'dummy_secret';
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
  
  return { success: true, captureData };
}
