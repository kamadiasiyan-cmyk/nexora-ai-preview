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

## Local watchlist targets and manual observations (development PR)

The homepage watchlist now supports optional **target prices**, a short per-product **price history**, and a **Check price** action. The check uses the separately configured SearchApi.io proxy, searches the product title, and **updates only when a returned offer has the exact normalized HTTPS product URL** (common tracking parameters are ignored). A missing match does not change the stored price or availability. These are observations of provider results, **not guarantees** of live inventory or comparable products.

- Confirmed restocks are reported only after an observed transition from explicitly out of stock to explicitly in stock. Unknown availability is never treated as proof of a restock.
- Target crossings and price decreases are reported in the on-page status area after manual checks. **No push, email, scheduled, or closed-browser notifications exist.**
- Product history is saved in the same browser under `watchtower-price-history-v1` (up to 60 changes per product). The original `watchtower-watchlist-v1` key is retained, and existing watchlist metadata is preserved. Older saved entries with unsafe URLs retain their titles but cannot use unsafe links for price checks.
- **Export backup** downloads a JSON file containing saved items and local history. **Import backup** merges new items without replacing existing entries, and merges valid observations. Import files are limited to 2 MB. Treat backup files as private because they may contain saved shopping interests.
- History is collected only from initial saved offer prices and explicit manual checks; the site does not backfill past prices. Browser storage can be cleared by the user or browser and is not a durable monitoring database.

Tests: `cd shopping-api && npm test` runs offline Node tests for targets, URL safety, backup merging, history limits, and restock transitions alongside existing API tests. These tests mock upstream results and do not verify production hosting.

## Watchlist browsing (October 25 update)

The browser-local watchlist now supports instant text search across saved titles, retailer names, and saved queries; filters for saved products, searches, target prices, target hits, confirmed out-of-stock items, and never-checked entries; and sorting by name or observed price within currency groups. Products without an observed price sort last. The **Clear filters** button restores the full list. Filtering and sorting never modify saved data, and edit/check/remove actions still target the correct original saved item.

Target-price and stock filters use the **last locally recorded observation**, not live retailer data. No new background monitoring, provider credentials, or push notifications are implied.
