'use server'

import { createClient } from '@/utils/supabase/server'
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
}

export async function getStoreSettings(): Promise<StoreSettings> {
    const supabase = await createClient()
    const fallbackSupabase = supabase as any
    
    const { data, error } = await fallbackSupabase
        .from('store_settings')
        .select('*')
        .eq('id', 1)
        .single()

    if (error || !data) {
        // Fallbacks if the DB call fails or row doesn't exist yet
        return {
            cart_minimum: 20.00,
            site_announcement: '',
            paypal_email: process.env.NEXT_PUBLIC_PAYPAL_EMAIL || '',
            allow_offers: true,
            store_description: 'Zero-Fee Sports Card Storefront. Prices reflect direct-to-buyer savings. No hidden buyer premiums, just high-quality cards shipped directly to you.',
            social_instagram: '',
            social_twitter: '',
            social_facebook: ''
        }
    }
    
    return data as StoreSettings;
}

export async function updateStoreSettings(newSettings: Partial<StoreSettings>) {
    const supabase = await createClient()
    
    // Security check: ensure the user is an admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        throw new Error("Unauthorized to change settings")
    }

    const fallbackSupabase = supabase as any
    const { error } = await fallbackSupabase
        .from('store_settings')
        .update({
            ...newSettings,
            updated_at: new Date().toISOString(),
        })
        .eq('id', 1)

    if (error) {
        console.error("Error updating settings:", error)
        throw new Error("Failed to save settings.")
    }

    // Force layout and all client pages to refresh the new settings
    revalidatePath('/', 'layout')
    
    return { success: true }
}
