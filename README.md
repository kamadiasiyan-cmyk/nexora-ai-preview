# WatchTower AI — shopping and website search preview

This **public repository is the WatchTower preview**, not the private NEXORA SaaS. It contains a static shopping interface, an optional Node.js search proxy, and browser-local watchlist utilities. Historical NEXORA demo files may remain in the repository but are not part of the published WatchTower site.

## Open the frontend

[WatchTower AI on GitHub Pages](https://kamadiasiyan-cmyk.github.io/nexora-ai-preview/)

If that URL returns 404, the repository owner must go to **Settings → Pages → Build and deployment → Source → GitHub Actions**. The `.github/workflows/publish-watchtower.yml` workflow packages only `index.html` and `watchlist-utils.js`, runs offline regression tests, and deploys after a push to `main`. It can also be rerun manually under **Actions → Publish WatchTower frontend to GitHub Pages → Run workflow**. A successful deployment is required before claiming the link works.

GitHub Pages **does not run the Node backend**. Without a separately deployed API and server-side SearchApi.io credentials, the frontend can open retailer search links and manage local saved searches/watchlists, but it cannot return aggregated live offers, website results, scheduled alerts, or closed-browser notifications.

## Manual-check activity (browser only)

When a saved product is manually checked against a configured search backend, WatchTower now keeps a **local activity inbox** for detected price drops, target-price crossings, and confirmed restocks. Events are not generated in the background and are **not** push/email notifications. They are capped at the most recent 100 events, can be cleared independently of watchlists and price history, and are included in the existing JSON backup format. Older backups without an activity field still import normally.

The app ignores duplicate simultaneous checks for the same product and discards a pending check if its saved item was removed or replaced while the request was in flight. Events and watchlists are stored in the current browser only; clearing browser storage removes them unless backed up.

## Develop and test

Run `cd shopping-api && npm test` with Node 20+. The tests use mocked provider responses; they do not verify live SearchApi.io behavior. See [WATCHTOWER-README.md](WATCHTOWER-README.md) for API setup, safety notes, and watchlist limitations.

Never commit SearchApi.io keys, tokens, or customer data. Use `SEARCHAPI_KEY` only in the private environment of a separately hosted backend.
