'use server';

import { getShopOracleApiKey } from '@/lib/shop-oracle-credentials';

export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = await getShopOracleApiKey();
  if (!apiKey) {
    return { success: false, error: 'Store not linked to Player Index.' };
  }

  try {
    const res = await fetch('https://playerindexdata.com/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, api_key: apiKey }),
    });

    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.error || 'Failed to send reset email.' };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Could not reach Player Index servers.' };
  }
}
