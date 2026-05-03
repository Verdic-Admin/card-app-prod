/**
 * Best-effort amount prefill for PayPal.me and Cash App profile URLs.
 * Venmo does not reliably support note/amount in URLs — use the copied payment memo instead.
 */
export function paymentUrlWithAmount(profileUrl: string, total: number, note?: string): string {
  let raw = profileUrl.trim();
  if (!raw) return raw;

  // Auto-prefix https:// if it looks like a domain without a protocol
  if (!raw.toLowerCase().startsWith('http') && !raw.includes('@') && (raw.includes('paypal.me') || raw.includes('venmo.com') || raw.includes('cash.app') || raw.includes('.com') || raw.includes('.me') || raw.includes('.app'))) {
    raw = 'https://' + raw;
  }

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
      // _xclick (Buy Now) buttons often fail for personal PayPal accounts.
      // Redirecting to the send money homepage is the most reliable fallback.
      return `https://www.paypal.com/myaccount/transfer/homepage`;
    }
    return raw;
  }
  return raw;
}
