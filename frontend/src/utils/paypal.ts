export interface PayPalCartItem {
  itemName: string;
  amount: number;
}

export function generatePayPalCartUrl(items: PayPalCartItem[], currency = 'USD'): string {
  const baseUrl = 'https://www.paypal.com/cgi-bin/webscr';
  const businessEmail = process.env.NEXT_PUBLIC_PAYPAL_EMAIL;
  
  if (!businessEmail) {
    throw new Error("PayPal business email is not configured in environment variables.");
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

  // Dynamically map an infinite array of bundled items into PayPal's precise API standard
  items.forEach((item, index) => {
    params.append(`item_name_${index + 1}`, item.itemName);
    params.append(`amount_${index + 1}`, item.amount.toFixed(2));
  });

  return `${baseUrl}?${params.toString()}`;
}
