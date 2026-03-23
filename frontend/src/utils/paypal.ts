export interface PayPalCartItem {
  itemName: string;
  amount: number;
}

export function generatePayPalCartUrl(items: PayPalCartItem[], businessEmail: string, currency = 'USD'): string {
  const baseUrl = 'https://www.paypal.com/cgi-bin/webscr';
  
  if (!businessEmail) {
    throw new Error("PayPal business email is not configured in settings.");
  }

  const params = new URLSearchParams({
    cmd: '_cart',
    upload: '1',
    business: businessEmail,
    currency_code: currency,
    no_note: '1',
    no_shipping: '2', // prompt for physical shipping address dynamically
    rm: '1', 
    return: `${typeof window !== 'undefined' ? window.location.origin : ''}/`,
    cancel_return: `${typeof window !== 'undefined' ? window.location.origin : ''}/`,
  });

  // --- Flat-rate shipping tier ---
  // Calculate the raw item subtotal to decide whether to charge for shipping.
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const SHIPPING_THRESHOLD = 25.00;
  const SHIPPING_FEE = 4.00;

  const lineItems: PayPalCartItem[] = [...items];
  if (subtotal < SHIPPING_THRESHOLD) {
    lineItems.push({ itemName: 'Standard Shipping (BMWT)', amount: SHIPPING_FEE });
  }

  // Dynamically map an infinite array of bundled items into PayPal's precise API standard
  lineItems.forEach((item, index) => {
    params.append(`item_name_${index + 1}`, item.itemName);
    params.append(`amount_${index + 1}`, item.amount.toFixed(2));
  });

  return `${baseUrl}?${params.toString()}`;
}
