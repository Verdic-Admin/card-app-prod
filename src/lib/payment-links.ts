/**
 * Best-effort amount prefill for PayPal.me and Cash App profile URLs.
 * Venmo does not reliably support note/amount in URLs — use the copied payment memo instead.
 */
export function paymentUrlWithAmount(profileUrl: string, total: number, note?: string): string {
  const raw = profileUrl.trim();
  if (!raw) return raw;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const amt = total.toFixed(2);
    
    // Venmo Deep Link
    if (host === "venmo.com") {
      const username = parsed.pathname.replace(/^\/u\//i, '').replace(/^\//, '');
      const encodedNote = note ? encodeURIComponent(note) : '';
      return `https://venmo.com/?txn=pay&audience=private&recipients=${username}&amount=${amt}&note=${encodedNote}`;
    }
    
    if (host === "cash.app") {
      const path = parsed.pathname.replace(/\/+$/, "") || "";
      // Cash App doesn't officially support ?note= on web, but we can add it just in case
      const query = note ? `?note=${encodeURIComponent(note)}` : '';
      return `${parsed.origin}${path}/${amt}${query}`;
    }
    if (host === "paypal.me") {
      const path = parsed.pathname.replace(/\/+$/, "") || "";
      // PayPal.me no longer formally supports passing a note via URL, but amount works
      return `${parsed.origin}${path}/${amt}`;
    }
  } catch {
    // If the URL parsing fails, check if they provided a raw email address for PayPal
    if (raw.includes('@') && !raw.toLowerCase().startsWith('http')) {
      const amt = total.toFixed(2);
      const encodedNote = note ? encodeURIComponent(note) : '';
      // This is the classic PayPal Standard 'Buy Now' link which forces a Goods & Services payment
      return `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(raw)}&amount=${amt}&item_name=${encodedNote}&currency_code=USD`;
    }
    return profileUrl;
  }
  return profileUrl;
}
