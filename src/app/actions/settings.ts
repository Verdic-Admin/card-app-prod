"use server";
import pool from '@/utils/db';

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
    projection_timeframe?: string;
    live_stream_url?: string | null;
    site_name: string;
    site_author: string | null;
    site_theme: string;
    payment_link: string;
    payment_instructions: string;
    payment_venmo: string;
    payment_paypal: string;
    payment_cashapp: string;
    payment_zelle: string;
}

export async function getStoreSettings(): Promise<StoreSettings> {
    let data;
    try {
        const { rows } = await pool.query(`SELECT * FROM store_settings WHERE id = 1`);
        data = rows[0];
    } catch { }

    if (!data) {
        // Fallbacks if the DB call fails or row doesn't exist yet
        return {
            cart_minimum: 20.00,
            site_announcement: '',
            paypal_email: '',
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
            site_theme: 'dark',
            payment_link: '',
            payment_instructions: 'Please select a payment method below and send the exact total. Your order will be shipped once payment is verified.',
            payment_venmo: '',
            payment_paypal: '',
            payment_cashapp: '',
            payment_zelle: ''
        }
    }
    
    return data as StoreSettings;
}

export async function updateStoreSettings(settings: StoreSettings) {
    try {
        await pool.query(`
            UPDATE store_settings 
            SET 
                cart_minimum = $1,
                site_announcement = $2,
                paypal_email = $3,
                allow_offers = $4,
                store_description = $5,
                social_instagram = $6,
                social_twitter = $7,
                social_facebook = $8,
                social_discord = $9,
                social_threads = $10,
                oracle_discount_percentage = $11,
                site_name = $12,
                site_author = $13,
                site_theme = $14,
                payment_link = $15,
                payment_instructions = $16,
                payment_venmo = $17,
                payment_paypal = $18,
                payment_cashapp = $19,
                payment_zelle = $20
            WHERE id = 1
        `, [settings.cart_minimum, settings.site_announcement, settings.paypal_email, settings.allow_offers, settings.store_description, settings.social_instagram, settings.social_twitter, settings.social_facebook, settings.social_discord, settings.social_threads, settings.oracle_discount_percentage, settings.site_name, settings.site_author, settings.site_theme, settings.payment_link, settings.payment_instructions, settings.payment_venmo, settings.payment_paypal, settings.payment_cashapp, settings.payment_zelle]);
        revalidatePath('/', 'layout')
        return { success: true }
    } catch (error: any) {
        throw new Error("Missing Postgres Table connection. Ensure store_settings exists: " + error.message)
    }
}
