/**
 * Best-effort amount prefill for PayPal.me and Cash App profile URLs.
 * Venmo does not reliably support note/amount in URLs — use the copied payment memo instead.
 */
export function paymentUrlWithAmount(profileUrl: string, total: number): string {
  const raw = profileUrl.trim();
  if (!raw) return raw;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const amt = total.toFixed(2);
    if (host === "cash.app") {
      const path = parsed.pathname.replace(/\/+$/, "") || "";
      return `${parsed.origin}${path}/${amt}`;
    }
    if (host === "paypal.me") {
      const path = parsed.pathname.replace(/\/+$/, "") || "";
      return `${parsed.origin}${path}/${amt}`;
    }
  } catch {
    return profileUrl;
  }
  return profileUrl;
}
