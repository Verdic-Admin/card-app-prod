# ⚾ Welcome to Your Player Index Storefront!

Congratulations! You are just 60 seconds away from launching your very own zero-fee, fully-automated sports card storefront. 

Because you've chosen to securely host your store on Railway, you maintain **100% ownership** over your data, your inventory, and your transactions. No platform fees. No revenue sharing. 

### Instructions for Deployment:

1. Open **[Claim Your Store](https://playerindexdata.com/claim)** or **[Developers](https://playerindexdata.com/developers)** on Player Index and mint an API key (copy it once).
2. In Railway **Variables**, set **`PLAYERINDEX_API_KEY`** to that key.
3. Add a **Bucket** service to the same project and name it **`Bucket`** (exact name) so `railway.toml` can wire S3 credentials via `${{Bucket.*}}`. If you use a different name, update those references in `railway.toml` to match. Deploying this repo **without** any Bucket in the project will fail variable resolution until you add one or remove the `AWS_*` entries from `railway.toml`.
4. Deploy (or redeploy). Optional: set **`FINTECH_API_URL`** / **`API_BASE_URL`** to `https://api.playerindexdata.com` if your template asks for them.

### What Happens Next?

Railway builds your app, Postgres, and object storage. Use `/login` with your Player Index account to administer the storefront.
