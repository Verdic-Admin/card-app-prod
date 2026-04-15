import { sql } from '@vercel/postgres';

async function main() {
    try {
        console.log("Fixing missing columns on store_settings table...");
        
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS cart_minimum DECIMAL(10,2) DEFAULT 20.00;`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS paypal_email TEXT DEFAULT '';`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS allow_offers BOOLEAN DEFAULT true;`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS site_announcement TEXT DEFAULT '';`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_description TEXT DEFAULT '';`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS social_instagram TEXT DEFAULT '';`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS social_twitter TEXT DEFAULT '';`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS social_facebook TEXT DEFAULT '';`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS social_discord TEXT DEFAULT '';`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS social_threads TEXT DEFAULT '';`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS oracle_discount_percentage DECIMAL(5,2) DEFAULT 0.0;`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS site_name TEXT DEFAULT 'My Card Store';`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS site_author TEXT;`;
        await sql`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS site_theme TEXT DEFAULT 'dark';`;

        console.log("Migration finished successfully.");
    } catch (e) {
        console.error("Migration error:", e);
    }
}
main();
