# WatchTower AI — Multi-store product search

The GitHub Pages homepage is now WatchTower AI. It is a **static storefront** and cannot itself scrape or aggregate prices across stores. It includes working retailer search links, locally saved watchlists, and an optional backend integration.

## Live aggregated search

The included Node.js API server uses SerpApi's Google Shopping results to return normalized retailer offers. It is an optional paid/usage-limited external provider, not an unlimited free product feed. Search results may be incomplete or stale and are not guaranteed to cover all retailers.

1. Deploy `shopping-api/server.js` on a Node 20+ host with HTTPS and persistent runtime.
2. Set `SERPAPI_KEY` to your SerpApi key in the host's server-side environment.
3. Set `ALLOWED_ORIGIN=https://kamadiasiyan-cmyk.github.io` (or your own public origin).
4. Set `PORT` if your host requires it; start with `node shopping-api/server.js`.
5. In the WatchTower website's **Live product search connection** section, enter your backend's HTTPS origin, then search for shoes.

Example response: `GET /api/search?q=running%20shoes` returns `{query,offers:[{title,merchant,price,currency,url,shipping}]}`.

### Important

- GitHub Pages does not run Node.js. The API **must be deployed separately**.
- Never put the SerpApi key into the GitHub Pages JavaScript.
- The watchlist uses browser localStorage, not user accounts or cross-device sync.
- Automated price drops, restocks, job monitoring and notifications are **not live in this static shopping interface**. They require a scheduled monitoring backend, storage, and messaging delivery.
- Product cards represent results supplied by the connected provider. Verify price and stock on the seller's site.
- API is an MVP: add persistent rate limits, authentication, usage quotas, monitoring, error reporting, and abuse prevention before commercial deployment.
- Previous NEXORA demo files are still in this repository; the homepage was replaced but other pages were not deleted. The private NEXORA repository was not modified.
