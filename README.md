# שביל | Israel Hikes

A Hebrew, RTL, mobile-first trail directory. Search 233 records, browse verified start points on a Leaflet map, save trails locally, and plan sections of four long-distance trails.

**Trail leads, not a live safety service.** Source checks date to October 9, 2026. Closures, water, access and weather must be checked again before every outing. Missing data stays `לא ידוע`.

## Run

Requires Node.js 22+.

```sh
npm ci
npm run dev
npm run validate
npm test
npm run build
```

## Architecture

- `src/data/`: 5 recommendations, 169 extended leads, 59 segments, 4 long trails, 187 source-grounded start points, 8 city-origin road-distance matrices. Content is separate from React components.
- `src/lib/catalog.ts`: normalizes the datasets into one search catalog. Detail routes are generated from data.
- `src/lib/filter.ts`: combined filters. Unknowns are explicit; a known-water mention is not permission to swim.
- `src/lib/drive.ts`: legacy estimates, city matrices, deliberately labelled straight-line fallback, on-demand backend routing.
- `src/components/`: filters, cards, map, origin search and shared UI.
- `src/pages/`: home, trail detail, long-trail index/detail, provenance/privacy.
- `worker/index.ts`: Cloudflare Worker serves the built SPA and proxies explicit geocoding/routing requests through one Durable Object per upstream. Persistent global pacing, seven-day caching, TTL cleanup, input validation, an emergency disable switch and configurable upstream URLs.
- LocalStorage holds only saved trail IDs. No analytics and no user accounts. Fonts are self-hosted.

## Add or correct a trail

Edit the relevant JSON file and include a source URL. Do not guess missing fields. For an extended lead, follow an existing object in `src/data/extended.json` and assign a unique `n`. For a segment, use a unique `id` and an existing `trail` ID in `long-trails.json`. A new long trail is data only: add its metadata and segments. Coordinate/navigation entries are optional and require verified source coordinates. Recompute city estimates only for approved start points; see `scripts/precompute.mjs`.

Run validation, tests and build before proposing a PR. See [CONTRIBUTING](CONTRIBUTING.md).

## Cloudflare Workers deployment

```sh
npm ci
npm run validate && npm test && npm run build
npx wrangler login
npm run deploy
```

`wrangler.jsonc` deploys static assets plus a Durable Object backend. It uses SQLite-backed Durable Objects. Check your Cloudflare plan, quotas and any billing implications before deploying. Do not create a paid subscription merely to deploy this project. No domain purchase is needed for the default `workers.dev` address.

`NOMINATIM_URL`, `OSRM_URL`, `SERVICE_ENABLED` and optional `CONTACT_URL` can be changed in Cloudflare without changing client code. Set `SERVICE_ENABLED=false` to disable upstream search/routing while retaining the catalog, map and precomputed estimates. OSM tile URL is separately configurable in `public/services.json`.

A plain static host can serve the catalog but cannot supply `/api/geocode` or `/api/route`. Dynamic address functionality requires the Worker backend. Migration to GitHub Pages is therefore not simply a DNS change.

### Public-service policies

Nominatim **forbids autocomplete** and permits at most one request/second for the entire application, not one request/second per visitor. Addresses are searched only on explicit submission. The Durable Object persists the previous request timestamp and returns `429` instead of exceeding the cap. Server and session caches reduce repeated requests. Requests identify the app through User-Agent. Do not submit personal or confidential information. If usage grows, switch providers or self-host. This is a trail-planning app, not a generic geocoding product.

- https://operations.osmfoundation.org/policies/nominatim/
- https://operations.osmfoundation.org/policies/tiles/
- https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server

OSRM is a best-effort public demo service restricted to reasonable, noncommercial use; no more than one request/second. The site has no traffic data. City estimates are road distance divided by 60 km/h, rounded to five minutes, measured on October 9, 2026. Dynamic fallback is straight-line distance × 1.35, explicitly **not road distance**.

Leaflet displays only verified start points, not route tracks or parking guarantees. OSM attribution stays visible; tiles are fetched only for the viewed map, with browser caching and no offline prefetch.

## Ownership and PR-only workflow

Create the public repo under its owner's personal account, with no collaborators granted write access. Bootstrap the initial commit, then enable a main-branch ruleset requiring a PR, disable force pushes/deletions, and require the `validate` CI check. The owner remains the sole administrator. External contributors use forks and PRs. Do not add a mandatory one-person approval rule that would deadlock the sole owner's own PRs; require approval for external PRs through normal owner review. Enable admin bypass only if the owner explicitly wants it.

The project includes CI that validates data, runs tests and builds on PRs. Do not store tokens, passwords or personal addresses in repository files or Git history.

## Privacy and licensing

No personal addresses, account names, private-document links or first-person travel anecdotes are included. Shared-document data is labelled generically as `מסמך משותף`. Source photography is not redistributed without a verified reuse licence; the site uses labelled original landscape illustrations. Public source names and geographic place names are not personal attribution.

The **code** is MIT-licensed. Third-party trail facts, OSM map/geocoding data, linked pages and third-party dependencies retain their own licences. MIT does not relicense third-party content. See `DATA_SOURCES.md` and dependency notices.

## Languages, accessibility and quality checks

Hebrew is the first-visit default. English translates the interface and trail facts, including source cautions. Language choice is stored locally. Canonical route IDs and filter values remain unchanged. Search accepts English and Hebrew names.

```sh
npx playwright install chromium
npm run check
```

`check` validates data/privacy patterns, runs unit tests, builds production assets, and runs browser and axe checks. Browser tests use the local production preview and do not depend on the public geocoder or routing service. `scripts/ui-test.mjs` separately checks the real local Worker flow and needs network access. Required `validate` CI runs unit, build, browser and automated accessibility checks. These checks are not a full accessibility audit.

Accessibility controls include larger text, higher contrast, reduced motion and underlined links. A statement explains tested paths, limits and the public GitHub issue contact. Never put medical or personal details in public issues. New issues are reviewed; fixes require the owner's explicit approval before execution or merge. Monitoring is operational, separate from this website, and must be configured rather than assumed from repository notifications.

Regional photographs are stored locally with individual attribution and licence records in `src/data/photos.json`. They are context, not pictures of a specific trail or current conditions. Missing photo coverage is explicit. Map and GPX sections retain original source links: Israel Hiking Map is currently unsupported, so source availability is not guaranteed. No track is fabricated or relicensed. External maps load only on request.

## GitHub Actions deployment (owner setup)

Store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository Actions secrets, never in code. The token must be restricted to the intended account. Confirm Workers Free in that account and approve the deployment route before enabling it. The workflow stays disabled until the repository Actions variable `CLOUDFLARE_DEPLOY_ENABLED` is exactly `true`. Only main pushes after passing `validate` may deploy; pull requests never receive deployment secrets. A read-only token-active check runs first; it cannot certify token scope or the billing plan. The pinned official Cloudflare action deploys only the Worker named `israel-hikes`, not other Workers. No step upgrades billing. Changes to an already-paid account can still incur usage charges, so plan verification is required before enabling deployment.
