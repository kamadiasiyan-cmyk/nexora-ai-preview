# WatchTower AI — Multi-store product search

The GitHub Pages homepage is now WatchTower AI. It is a **static storefront** and cannot itself scrape or aggregate prices across stores. It includes working retailer search links, locally saved watchlists, and an optional backend integration.

## Live product and general website search

The included Node.js API server uses SearchApi.io's Google Shopping results to return normalized retailer offers. It also supports general website search using the Google engine. It is an optional paid/usage-limited external provider, not an unlimited free product feed. Search results may be incomplete or stale and are not guaranteed to cover all retailers.

1. Deploy `shopping-api/server.js` on a Node 20+ host with HTTPS and persistent runtime.
2. Set `SEARCHAPI_KEY` to your SearchApi.io key in the host's server-side environment.
3. Set `ALLOWED_ORIGIN=https://kamadiasiyan-cmyk.github.io` (or your own public origin).
4. Set `PORT` if your host requires it; start with `node shopping-api/server.js`.
5. In the WatchTower website's **Live product search connection** section, enter your backend's HTTPS origin, then select Products or Websites and run a search.

For products: `GET /api/search?q=running%20shoes&mode=products` returns `{query,mode,offers:[{title,merchant,price,currency,url,shipping,inStock}],results:[],comparison,cached}`. `comparison` summarizes valid offers with counts of distinct retailers and known/unknown stock, lowest/highest/median prices, and the lowest **confirmed** in-stock price. These are descriptive statistics, **not** a like-for-like comparison. The `inStock` field is `true`, `false`, or `null` (unknown); unknown is **not** proof of availability.

For websites: `GET /api/search?q=shoe%20reviews&mode=web` returns `{query,mode,offers:[],results:[{title,url,snippet,domain}],comparison:null,cached}`.

Previous example: `GET /api/search?q=running%20shoes` returns `{query,offers:[{title,merchant,price,currency,url,shipping}]}`.

### Important

- GitHub Pages does not run Node.js. The API **must be deployed separately**.
- Never put the SearchApi.io key into the GitHub Pages JavaScript.
- The watchlist uses browser localStorage, not user accounts or cross-device sync.
- Automated price drops, restocks, job monitoring and notifications are **not live in this static shopping interface**. They require a scheduled monitoring backend, storage, and messaging delivery.
- Product cards represent results supplied by the connected provider. Verify price and stock on the seller's site.
- API is an MVP: add persistent rate limits, authentication, usage quotas, monitoring, error reporting, and abuse prevention before commercial deployment.
- Previous NEXORA demo files are still in this repository; the homepage was replaced but other pages were not deleted. The private NEXORA repository was not modified.

## Search quality, privacy, and local watchlists

- The shopping API now rejects malformed prices, non-HTTPS retailer links, credential-bearing URLs, and unsupported search modes. It removes common tracking parameters before deduplicating results. Price comparisons are only as current as SearchApi.io's response.
- The API bounds simultaneous provider requests to eight and reuses in-flight identical searches; results are cached in server memory for five minutes. Provider error details are not returned to browsers.
- The homepage shows the **visible filtered price range** with a caveat about differing product models, conditions, and shipping; the summary changes with price and stock filters.
- The homepage includes an **In stock only** filter (requires explicit stock confirmation), a maximum-price filter, and **Save search**. Saved website searches reopen in website mode. Existing browser-local watchlist data remains in `watchtower-watchlist-v1`.
- Run local tests with `cd shopping-api && npm test` (Node 20+). Tests use mocked provider responses, not live API credentials.
- The static GitHub Pages site does **not** perform automatic price checks, price history collection, closed-browser notifications, or background restock monitoring. A separately deployed backend and durable storage are required for those capabilities.
- Configure `SEARCHAPI_KEY` only in your backend hosting environment; never commit credentials or expose them in client-side JavaScript.
