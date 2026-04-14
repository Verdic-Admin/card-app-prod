"use server";
import { sql } from '@vercel/postgres';

import { revalidatePath } from 'next/cache'

export interface StoreSettings {
    cart_minimum: number;
    site_announcement: string;
    paypal_email: string;
    allow_offers: boolean;
    store_description: string;
    social_instagram: string;
    social_twitter: string;
    social_facebook: string;
    social_discord: string;
    social_threads: string;
    oracle_discount_percentage: number;
    site_name: string;
    site_author: string | null;
    site_theme: string;
}

export async function getStoreSettings(): Promise<StoreSettings> {
    let data;
    try {
        const { rows } = await sql`SELECT * FROM store_settings WHERE id = 1`;
        data = rows[0];
    } catch { }

    if (!data) {
        // Fallbacks if the DB call fails or row doesn't exist yet
        return {
            cart_minimum: 20.00,
            site_announcement: '',
            paypal_email: process.env.NEXT_PUBLIC_PAYPAL_EMAIL || '',
            allow_offers: true,
            store_description: 'Zero-Fee Sports Card Storefront. Prices reflect direct-to-buyer savings. No hidden buyer premiums, just high-quality cards shipped directly to you.',
            social_instagram: '',
            social_twitter: '',
            social_facebook: '',
            social_discord: '',
            social_threads: '',
            oracle_discount_percentage: 0.0,
            site_name: 'My Card Store',
            site_author: null,
            site_theme: 'dark'
        }
    }
    
    return data as StoreSettings;
}

export async function updateStoreSettings(newSettings: Partial<StoreSettings>) {
    // Security check: ensure the user is an admin
    if (!process.env.PLAYERINDEX_API_KEY) {
        throw new Error("Unauthorized to change settings: Missing API Key");
    }

    try {
        const keys = Object.keys(newSettings);
        if (keys.length > 0) {
           for (const [key, value] of Object.entries(newSettings)) {
               await sql.query(`UPDATE store_settings SET \${key} = $1, updated_at = NOW() WHERE id = 1`, [value]);
           }
        }
    } catch(err) {
        console.error("Error updating settings:", err)
        throw new Error("Failed to save settings.")
    }

    // Force layout and all client pages to refresh the new settings
    revalidatePath('/', 'layout')
    
    return { success: true }
}
