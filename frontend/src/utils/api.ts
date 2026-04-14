/**
 * Global API Utility with Interceptor
 */

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  
  // Attach API Key
  const apiKey = process.env.NEXT_PUBLIC_PLAYERINDEX_API_KEY || process.env.PLAYERINDEX_API_KEY;
  if (apiKey) {
    headers.set("X-API-KEY", apiKey);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Global Interceptor Logic
  if (response.status === 402) {
    // 402 Payment Required
    if (typeof window !== "undefined") {
      // Dispatch a custom event so the UI can lock "Scan" and "Sync" buttons
      window.dispatchEvent(new CustomEvent("api-credits-exhausted"));
      // Redirect to Admin Billing page
      window.location.href = "/admin/billing";
    }
  }

  return response;
}
