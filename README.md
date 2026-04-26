# Card Shop — Player Index White-Label Storefront

A zero-fee sports card storefront powered by the [Player Index](https://playerindexdata.com) AI pricing engine. You maintain **100% ownership** over your data, inventory, and transactions.

## Deploy (1-Click)

1. Go to [playerindexdata.com/claim](https://playerindexdata.com/claim) and create your API key.
2. Click the **Deploy to Railway** button — this opens the 1-click template wizard.
3. Railway automatically provisions your **Postgres database** and **Tigris object storage**.
4. Your storefront will be live in ~2 minutes.

## Docker

```bash
docker pull ghcr.io/verdic-admin/card-app-prod:latest

docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://user:pass@host:5432/db \
  -e PLAYERINDEX_API_KEY=pi_live_your_key_here \
  -e S3_ENDPOINT=https://fly.storage.tigris.dev \
  -e S3_BUCKET_NAME=your-bucket \
  -e S3_ACCESS_KEY_ID=your-key \
  -e S3_SECRET_ACCESS_KEY=your-secret \
  ghcr.io/verdic-admin/card-app-prod:latest
```

## Custom Domain

Railway → Settings → Networking → Custom Domain. SSL is provisioned automatically.

## Updates

Your store receives automatic updates. The Docker container is rebuilt on every push to `main` and silently redeployed to your instance — no action required.

## Environment Variables

See `.env.example` for all supported variables. Key ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (auto-injected) |
| `PLAYERINDEX_API_KEY` | Yes | API key from playerindexdata.com |
| `S3_ENDPOINT` | Yes | Tigris/S3 storage endpoint (auto-injected) |
| `S3_BUCKET_NAME` | Yes | Storage bucket name (auto-injected) |
| `S3_ACCESS_KEY_ID` | Yes | Storage access key (auto-injected) |
| `S3_SECRET_ACCESS_KEY` | Yes | Storage secret key (auto-injected) |

## Admin Panel

Log in at `/login` with your admin password to manage inventory, pricing, auctions, and store settings.
