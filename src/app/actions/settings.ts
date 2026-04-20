"use server";
import pool from '@/utils/db';

import { revalidatePath } from 'next/cache';
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from '@/lib/store-settings';

function num(v: unknown, fallback: number): number {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ''): string {
  if (v == null) return fallback;
  return String(v);
}

function bool(v: unknown, fallback: boolean): boolean {
  if (v == null) return fallback;
  if (typeof v === 'boolean') return v;
  return Boolean(v);
}

function normalizeStoreRow(row: Record<string, unknown>): StoreSettings {
  return {
    cart_minimum: num(row.cart_minimum, DEFAULT_STORE_SETTINGS.cart_minimum),
    site_announcement: str(row.site_announcement),
    paypal_email: str(row.paypal_email),
    allow_offers: bool(row.allow_offers, DEFAULT_STORE_SETTINGS.allow_offers),
    store_description: str(row.store_description, DEFAULT_STORE_SETTINGS.store_description),
    social_instagram: str(row.social_instagram),
    social_twitter: str(row.social_twitter),
    social_facebook: str(row.social_facebook),
    social_discord: str(row.social_discord),
    social_threads: str(row.social_threads),
    oracle_discount_percentage: num(row.oracle_discount_percentage, 0),
    projection_timeframe: row.projection_timeframe != null ? str(row.projection_timeframe) : undefined,
    live_stream_url: row.live_stream_url != null ? str(row.live_stream_url) : undefined,
    site_name: str(row.site_name, DEFAULT_STORE_SETTINGS.site_name),
    site_author: row.site_author != null && String(row.site_author).length ? str(row.site_author) : null,
    site_theme: str(row.site_theme, 'dark'),
    payment_link: str(row.payment_link),
    payment_instructions: str(row.payment_instructions, DEFAULT_STORE_SETTINGS.payment_instructions),
    payment_venmo: str(row.payment_venmo),
    payment_paypal: str(row.payment_paypal),
    payment_cashapp: str(row.payment_cashapp),
    payment_zelle: str(row.payment_zelle),
  };
}

export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const { rows } = await pool.query(`SELECT * FROM store_settings WHERE id = 1`);
    const row = rows[0];
    if (!row) {
      return { ...DEFAULT_STORE_SETTINGS };
    }
    return normalizeStoreRow(row as Record<string, unknown>);
  } catch (e) {
    console.error('[getStoreSettings]', e);
    return { ...DEFAULT_STORE_SETTINGS };
  }
}

export async function updateStoreSettings(settings: StoreSettings) {
  const v = [
    settings.cart_minimum,
    settings.site_announcement,
    settings.paypal_email,
    settings.allow_offers,
    settings.store_description,
    settings.social_instagram,
    settings.social_twitter,
    settings.social_facebook,
    settings.social_discord,
    settings.social_threads,
    settings.oracle_discount_percentage,
    settings.site_name,
    settings.site_author,
    settings.site_theme,
    settings.payment_link,
    settings.payment_instructions,
    settings.payment_venmo,
    settings.payment_paypal,
    settings.payment_cashapp,
    settings.payment_zelle,
  ];
  try {
    await pool.query(
      `
            INSERT INTO store_settings (
              id, cart_minimum, site_announcement, paypal_email, allow_offers, store_description,
              social_instagram, social_twitter, social_facebook, social_discord, social_threads,
              oracle_discount_percentage, site_name, site_author, site_theme,
              payment_link, payment_instructions, payment_venmo, payment_paypal, payment_cashapp, payment_zelle
            ) VALUES (
              1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            )
            ON CONFLICT (id) DO UPDATE SET
              cart_minimum = EXCLUDED.cart_minimum,
              site_announcement = EXCLUDED.site_announcement,
              paypal_email = EXCLUDED.paypal_email,
              allow_offers = EXCLUDED.allow_offers,
              store_description = EXCLUDED.store_description,
              social_instagram = EXCLUDED.social_instagram,
              social_twitter = EXCLUDED.social_twitter,
              social_facebook = EXCLUDED.social_facebook,
              social_discord = EXCLUDED.social_discord,
              social_threads = EXCLUDED.social_threads,
              oracle_discount_percentage = EXCLUDED.oracle_discount_percentage,
              site_name = EXCLUDED.site_name,
              site_author = EXCLUDED.site_author,
              site_theme = EXCLUDED.site_theme,
              payment_link = EXCLUDED.payment_link,
              payment_instructions = EXCLUDED.payment_instructions,
              payment_venmo = EXCLUDED.payment_venmo,
              payment_paypal = EXCLUDED.payment_paypal,
              payment_cashapp = EXCLUDED.payment_cashapp,
              payment_zelle = EXCLUDED.payment_zelle
            `,
      v
    );
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      'Could not save store_settings. Confirm Postgres is reachable and init_db.js has run (Railway redeploy). ' +
        msg
    );
  }
}
