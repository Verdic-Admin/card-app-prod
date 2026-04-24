# Card App — Player Index White-Label Storefront

Because you host this storefront on **Vercel**, you maintain **100% ownership** over your data, your inventory, and your transactions. No platform fees. No revenue sharing.

## Quick Start (Vercel)

1. Click the **Deploy** button from [playerindexdata.com/claim](https://playerindexdata.com/claim) — this opens the Vercel "Clone Template" wizard.
2. In the wizard, click **Add Vercel Postgres** and **Add Vercel Blob** when prompted by the Storage section.
3. Set **`PLAYERINDEX_API_KEY`** to the key you copied from Player Index (`/claim` or `/developers`). The deploy URL pre-fills this for you.
4. Click **Deploy**. Vercel builds your app, provisions Postgres, and sets up Blob storage automatically.

Your storefront will be live on a free `[store-name].vercel.app` domain in ~2 minutes.

## Custom Domain

To use your own domain (`mikescards.com`), add it in your Vercel project **Settings → Domains**. Vercel provisions the SSL certificate automatically.

## Updates

Your store auto-syncs with the latest template code every night via GitHub Actions. New features and security patches are applied while you sleep — no developer action required.

## Environment Variables

See `.env.example` for all supported environment variables. The Vercel wizard automatically injects `POSTGRES_URL` and `BLOB_READ_WRITE_TOKEN` when you add Storage. You only need to set `PLAYERINDEX_API_KEY` manually.

## Admin Panel

Log in at `/login` with your Player Index account to administer the storefront.
