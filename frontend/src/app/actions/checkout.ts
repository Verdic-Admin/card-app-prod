'use server'

import { createClient } from '@/utils/supabase/server'

export async function createPayPalOrder(itemIds: string[]) {
  const supabase = await createClient()

  if (!itemIds || itemIds.length === 0) {
    throw new Error('No items provided for checkout.')
  }

  // Query absolute source-of-truth prices
  const { data: items, error } = await supabase
    .from('inventory')
    .select('id, listed_price, avg_price')
    .in('id', itemIds)

  if (error || !items || items.length === 0) {
    throw new Error('Failed to query inventory prices.')
  }

  let subtotal = 0;
  for (const item of items) {
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
