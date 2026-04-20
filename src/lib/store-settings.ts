/** Shared store settings shape + defaults (must NOT live in a `"use server"` file). */

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

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  cart_minimum: 20.0,
  site_announcement: '',
  paypal_email: '',
  allow_offers: true,
  store_description:
    'Zero-Fee Sports Card Storefront. Prices reflect direct-to-buyer savings. No hidden buyer premiums, just high-quality cards shipped directly to you.',
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
  payment_instructions:
    'Please select a payment method below and send the exact total. Your order will be shipped once payment is verified.',
  payment_venmo: '',
  payment_paypal: '',
  payment_cashapp: '',
  payment_zelle: '',
};
