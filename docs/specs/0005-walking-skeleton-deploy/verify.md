# Verify: Walking skeleton + public deploy · spec 0005 · updated 2026-11-12
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Current status (2026-11-12): Feature 6 PASS.** All 13 acceptance criteria are met, see the final verdict at the end of this file. The older logs below each record the status at their own time.

## UI / manual (local: `php artisan serve` + `npm run dev`, seeded dev DB)
- [x] Open `/` → one `<h1>`, then an `<h2>` "Browse games" with 24 product cards (cover, name, platform · region, price, strikethrough list price, discount badge) → AC-7 · passed on production 2026-11-12, see V11
- [x] Click a card → goes to `/products/<slug>` (shows the 404 page until feature 8) → AC-7 · passed on production 2026-11-12, see V12
- [x] Hard reload with DevTools throttling ("Slow 3G") → 12 skeleton cards; after about 3 s the info notice "Waking up the server. The first visit after a quiet spell can take up to a minute." appears; it disappears once the grid loads → AC-7, AC-8 · passed on production 2026-11-12 with a 6 s browser side delay instead of Slow 3G, see V13
- [x] Stop `php artisan serve`, reload → skeletons, one retry about 3 s later (Network tab shows 2 requests), then `ErrorState`; start the server, click "Try again" → skeletons (and the notice if still pending after 3 s), then the grid → AC-7, AC-8 · passed on production 2026-11-12 with the API blocked in the browser instead of a stopped server, see V14
- [x] With no active products (for example `UPDATE products SET is_active = false` on a scratch DB) → `EmptyState` "No games yet" / "Check back soon." → AC-7 · UI side passed on production 2026-11-12 with a mocked empty response (no DB write), see V15; the server side empty list is Pest only
- [x] Network tab: the request goes to `${VITE_API_URL}/api/v1/products?page=1` with `Accept: application/json` → AC-9 · passed on production 2026-11-12, see V11

## Value sourcing (one step per row)
- [x] Which products: set one product `is_active = false` → it disappears from the list → AC-1 · passed on an isolated local DB 2026-11-12, see D7
- [x] Order: priced products first by name then id; a product whose offers are all sold out sits after them → AC-1 · passed, evidence: production run 2026-11-12, see Verification log V5 (id tiebreak not observed: no duplicate names)
- [x] Page size 24 and page param: `?page=2` gives the next 24; `?per_page=100` still gives 24; `?page=abc` gives page 1 → AC-1 · passed, evidence: production run 2026-11-12, see Verification log V4
- [x] Item `slug`, `name`, `type`, `cover_image_url`, `platform`, `region` match the DB rows for that product → AC-2 · passed on an isolated local DB 2026-11-12, all 81 items, see D6
- [x] `price.amount`: deactivate the cheapest offer of one product (or mark all its keys sold) → the card price rises to the next cheapest offer with stock; with none left → "Out of stock" → AC-3 · API half passed on an isolated local DB 2026-11-12, see D8; UI half passed on production 2026-11-12 with a browser side `price: null` response, see U1
- [x] `currency` is `"EUR"` on every `price` and `list_price` → AC-2 · passed, evidence: production run 2026-11-12, see Verification log V3
- [x] `list_price.amount` equals `products.list_price_cents`; null column → no strikethrough → AC-4 · passed on an isolated local DB 2026-11-12, see D6, D9
- [x] `discount_percent`: list 3999, price 1299 → 67; list 1000, price 999 → no badge (rounds to 0) → AC-4 · passed at the API on an isolated local DB 2026-11-12 (67, then `null`), see D9
- [x] Waking notice: shows only while fetching with no data, after 3 s → AC-8 · passed 2026-11-12, see V13, V14
- [x] Loading count 12 and empty copy match the spec → AC-7 · passed 2026-11-12, see V13, V15
- [x] `apiFetch` base URL comes only from `VITE_API_URL`: `git grep -n -F 'import.meta.env' -- client/src ':!client/src/**/*.test.ts' ':!client/src/**/*.test.tsx' | grep -v -F 'import.meta.env.DEV'` → exactly one line, `client/src/lib/env.ts:1` (`import.meta.env.DEV`, the dev route switch, is allowed) → AC-9 · reworded 2026-11-12 (the old `grep -rn "import.meta.env"` also hit the allowed `DEV` reads); passed, see W1
- [x] Timeout 90 s, retry once, no mutation retry: covered by `src/api/client.test.ts` and `src/lib/queryClient.test.ts` → AC-8 · passed, evidence: GitHub CI run 43173320123 on `a12f635`, 2026-11-12 (not run locally for this record), `client` job Vitest step
- [x] CORS origins come from `FRONTEND_URL` and `CORS_PREVIEW_ORIGIN_PATTERN` (see production steps) → AC-6 · passed on production 2026-11-12, see C1 to C4
- [x] Rate limit keyed by IP after proxy trust (see production steps) → AC-5, AC-12 · passed on production 2026-11-12, see A1

## Commands
- [x] `cd server && composer format:check && composer analyse && php artisan test` → all pass → AC-1 to AC-6, AC-13 · passed, evidence: GitHub CI run 43173320123 on `a12f635`, 2026-11-12 (not run locally for this record), `server` job (Pint, PHPStan, Pest on Postgres 17)
- [x] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → all pass → AC-8, AC-9, AC-13 · passed, evidence: GitHub CI run 43173320123 on `a12f635`, 2026-11-12 (not run locally for this record), `client` job (Prettier, oxlint, TypeScript, Vitest, build)
- [x] CI run for the push to `main` is green (`gh run list --branch main --limit 1`) → AC-13 · passed 2026-11-12: run 43173320123 on `a12f635` (includes `349b0d7` and `362eb44`), `server` job (Pint, PHPStan, Pest) and `client` job (Prettier, oxlint, TypeScript, Vitest, build) both green. Earlier runs 43096577646 and 43098464245 stayed stuck in GitHub's queue and were not retried. Rechecked 2026-11-12: run 43200375403 on `99123a1` (the proxy trust fix) is green too.
- [x] `cd server && docker build -t eneba-server:local .` then run it with the spec 0001 env vars against an empty DB → logs show migrations, no seed; `curl localhost:8080/up` → 200; container health `healthy` → AC-10 · passed locally 2026-11-12 against a fresh isolated Postgres 17, see D1 to D4, D11
- [x] `for i in $(seq 121); do curl -s -o /dev/null -w "%{http_code}\n" <api>/api/v1/products; done | tail -1` → 429, and the response has `Retry-After` → AC-5 · passed against the local container 2026-11-12 (same image, not Render), see D10; the production run is still not done; a production run is not required by the spec, see W3; the "per client IP on Render" part is proven by A1

## Production (after Neon, Render, Vercel setup)
- [x] Render first deploy log shows the migrations and a passing `/up` health check → AC-10 · passed, evidence: Render dashboard checked by you 2026-11-12, see R2 to R6
- [x] Vercel production URL shows seeded games; DevTools shows the request to the Render origin → AC-11 · passed 2026-11-12, see V11
- [x] First visit after 15+ min idle shows the waking notice, then the grid → AC-8 · passed on production 2026-11-12, real cold start (API 35.5 s), see K1
- [x] `curl -sI -H "Origin: <vercel prod origin>" <render>/api/v1/products` → `Access-Control-Allow-Origin: <vercel prod origin>` → AC-6 · passed, evidence: production run 2026-11-12, see Verification log V6
- [x] A Vercel preview URL loads the grid (its origin matches `CORS_PREVIEW_ORIGIN_PATTERN`) → AC-6 · still open 2026-11-12: no Preview deployment exists, and Render refuses preview shaped origins, see P1 to P5; update: the Render CORS side now passes (C1 to C4), only the browser load of a real Preview remains; **passed 2026-11-12** in your Chrome on the real Preview, see PV5 and the AC-6 verdict
- [x] `curl -sI -H "Origin: https://evil-eneba.vercel.app" <render>/api/v1/products` → no `Access-Control-Allow-Origin` header (true with the preview pattern set or blank) → AC-6 · passed, evidence: production run 2026-11-12, see Verification log V7
- [x] Real client IP on Render, by one of the two AC-12 methods: the cache lookup (one IPv4 request with a forged `X-Forwarded-For`, then a read only query on the Neon `cache` table), or the fallback temporary `Log::info($request->ip())` (deploy, compare, remove, redeploy) → AC-12 · reworded 2026-11-12 to match the updated AC-12 (the old step named only the log line); passed on production 2026-11-12 with the cache lookup, no code deployed, see A1
- [x] No real host committed (two commands, both must print nothing): `git grep -n -i -E 'onrender\.com|neon\.tech|vercel\.app' -- ':!docs' ':!server/tests'` and `git grep -n -i -E 'onrender\.com|neon\.tech|eneba-internship-assignment' -- ':!docs'` → AC-11 · reworded 2026-11-12 (the old single grep also hit the made up fixture origins in `server/tests/Feature/CorsTest.php`); passed, see W2

## Acceptance criteria coverage
- AC-1: Pest list tests; value sourcing steps 1 to 3 · AC-2: Pest shape test; item steps · AC-3: Pest price rule; price step · AC-4: Pest unit `DiscountTest`; discount step · AC-5: Pest `CatalogRateLimitTest`; 121 request curl · AC-6: Pest `CorsTest`; production CORS steps · AC-7: UI steps; Vitest mapping · AC-8: UI throttling and stopped API steps; Vitest timeout and retry · AC-9: Vitest `apiFetch`; Network tab step · AC-10: Docker run; Render deploy log · AC-11: production URL; git grep · AC-12: Pest proxy trust tests in `CatalogRateLimitTest`; Neon cache lookup (or the log line fallback) · AC-13: command steps and CI

## Verification log · `/check verify` · 2026-11-12

Overall: **BLOCKED**, not PASS. Every API check run against production passed. The browser checks, the real client IP check, the Render deploy log, and the local Docker run were not exercised in this run, so their criteria stay open. Nothing below is marked passed without a cited observation.

Targets: frontend `https://eneba-internship-assignment.vercel.app` (from the GitHub repo homepage), API `https://eneba-api.onrender.com` (read from the deployed JS bundle). Total requests to Render in this run: 11, sent one at a time. No load test was run, following your instruction not to repeat high concurrency tests on Render Free.

### Observed in this run
- V1 · `curl https://eneba-internship-assignment.vercel.app/` → 200, serves `index.html` with `/assets/index-BNAk5Thx.js`. The bundle contains the API origin `https://eneba-api.onrender.com`, the text "Browse games", and the waking notice copy. (Page was not rendered in a browser, see Pending.)
- V2 · `GET <api>/up` → 200 in 0.9 s (service warm).
- V3 · `GET <api>/api/v1/products?page=1` with `Accept: application/json` → 200, `meta.total = 81`, `meta.per_page = 24`, `meta.last_page = 4`, 24 items. Item keys are exactly `cover_image_url, discount_percent, list_price, name, platform, price, region, slug, type`. Every `price` and `list_price` currency is `EUR`. Every item with both prices and list above price has `discount_percent` equal to `floor((list − price) × 100 / list)`. Headers `x-ratelimit-limit: 120`, `x-ratelimit-remaining: 119`.
- V4 · `?page=2` → page 2, 24 items, first `elden-ring-steam-global`; `?page=1&per_page=100` → 24 items; `?page=abc` → page 1; `?page=999` → page 999, empty `data`.
- V5 · Pages 1 to 4 collected → 81 items, ordered priced first then by name; the 3 items with `price: null` are last.
- V6 · `Origin: https://eneba-internship-assignment.vercel.app` → `access-control-allow-origin` echoes that origin, plus `vary: Origin`.
- V7 · `Origin: https://evil-eneba.vercel.app` → no `access-control-allow-origin` header.
- V8 · `gh run list --branch main` → run 43200375403 on `99123a1` succeeded (also 43183794535 and 43173320123).
- V9 · `grep -rn "import.meta.env" client/src` → the API origin is read only in `src/lib/env.ts`. Two more hits in `src/router.tsx` read `import.meta.env.DEV` (a dev route switch, not the API origin). AC-9 intent holds; the step's literal wording ("only hits `src/lib/env.ts`") does not, so it stays unticked until the wording is narrowed to `VITE_API_URL`.
- V10 · `git grep -n -i -E "onrender\.com|neon\.tech|vercel\.app" -- ':!docs'` → 5 hits, all in `server/tests/Feature/CorsTest.php` (made up fixture origins such as `eneba-abc123xyz-team-slug.vercel.app` and `evil-eneba.vercel.app`). No real host is committed. The step as written expects zero hits, so it stays unticked: either exclude `server/tests` from the grep or accept fixture hosts in the step.

### Reported by you, not reobserved here (AC-12)
- After deploying `99123a1`, five requests with five different forged `X-Forwarded-For` values shared one rate limit bucket (`x-ratelimit-remaining` 119, 118, 117, 116, 115). This shows a forged header no longer creates a fresh bucket. V3 above (remaining 119 on a fresh request) is consistent with it.
- This does **not** yet prove that `$request->ip()` is your real public IP. That half of AC-12 stays pending.

### Pending (not exercised, not passed)
- AC-12 real client IP: temporary `Log::info($request->ip())` on Render, compare with your public IP, remove the line, redeploy.
- AC-5 in production: the 121st request returning 429 with `Retry-After` was not run, by your instruction. Covered only by Pest `CatalogRateLimitTest` in CI (V8).
- AC-7, AC-8 browser checks: grid render, card link, skeletons, waking notice, error state and retry, empty state. No browser tool was available in this run.
- AC-9 Network tab check: needs a browser.
- AC-11 Vercel page showing the grid with the request to the Render origin: needs a browser. API side is proven (V1, V3).
- AC-6 preview URL loading the grid: no preview URL known; Vercel access through the connector needs reauthorization.
- AC-8 cold start: first visit after 15+ minutes idle.
- AC-10: Render first deploy log (needs Render dashboard) and the local `docker build` plus run against an empty DB. `/up` answering 200 in production (V2) is supporting evidence only.
- AC-2 item values matching DB rows, AC-3 price fallback, AC-4 the two named discount cases, AC-1 inactive product hiding: need DB writes on a scratch DB; covered by Pest in CI only.

### Failures
- None in runtime behavior. Two steps fail only on their literal wording (V9, V10); the criteria they check are met in intent.

## Verification log · `/check verify` (browser run) · 2026-11-12

Overall: **BLOCKED**, not PASS. Every browser check that could run against production passed. The open items below need dashboards, a code change on Render, a cold service, or a Docker run, which this run was told not to do.

How it ran: Playwright MCP (Chromium) against `https://eneba-internship-assignment.vercel.app`. Slow, failing, and empty API answers were made **inside the browser** with `page.route` (a delay, a refused connection, a mocked empty JSON body). No app code, production data, or infrastructure was changed, and nothing was deployed. Real requests to Render in this run: about 7, one at a time. Earlier evidence (V1 to V10) is reused, not repeated. Screenshots and the console log were saved outside the repo, in the session scratch folder (`evidence/v11-grid.png`, `v13-skeletons.png`, `v14-error.png`, `v15-empty.png`).

### Observed in this run
- V11 · Load `/` → one `<h1>` "Buy game keys at the best prices", one `<h2>` "Browse games", 24 cards linking to `/products/<slug>`, all 24 with an `img[alt]`, 17 strikethrough list prices. First card: "Assassin's Creed Mirage · Steam · Global · From €18.99 · was €49.99 · -62%". Network: `GET https://eneba-api.onrender.com/api/v1/products?page=1` → 200, request header `accept: application/json`. No waking notice on a warm API. (AC-7, AC-9, AC-11)
- V12 · Click the first card → URL `/products/assassins-creed-mirage-steam-global`, page shows the 404 "Page not found" with "Go to homepage". (AC-7)
- V13 · API delayed 6 s → at 1.7 s: skeletons, no cards, no notice; at 4.2 s: `role="status"` reads "Waking up the server. The first visit after a quiet spell can take up to a minute."; at 8.2 s: 24 cards, notice gone. A separate 2.5 s delay run counted exactly 12 `ProductCardSkeleton`s. (AC-7, AC-8)
- V14 · API refused in the browser → 2 attempts, at 0.24 s and 3.25 s (one retry about 3 s later); at 2 s the skeletons still show; at 3.6 s `ErrorState` "Something went wrong · Please try again in a moment · Try again". API restored with a 5 s delay, click "Try again" → skeletons, no notice at 0.5 s, notice at 3.7 s, then 24 cards and the notice gone. Console: only the 2 `ERR_CONNECTION_REFUSED` lines caused by the block. (AC-7, AC-8)
- V15 · Mocked `{ data: [] }` response → the section shows "No games yet · Check back soon." (AC-7, UI side only)

### Still pending (not exercised, not passed)
- AC-8 real cold start: first visit after 15+ min of Render idle. The API was warm in this run; V13 proves the notice logic with a simulated delay only.
- AC-6 preview URL loading the grid: no preview URL known; the Vercel connector needs reauthorization.
- AC-12 real client IP: temporary `Log::info($request->ip())` on Render, then remove and redeploy. Needs a code change and a deploy, out of bounds for this run.
- AC-10: Render first deploy log (dashboard) and the local `docker build` plus run against an empty DB.
- AC-5 in production: 121 request curl, not run (avoid load on Render Free). Pest `CatalogRateLimitTest` in CI only.
- AC-1 inactive product hiding, AC-2 item values against DB rows, AC-3 price fallback, AC-4 the two named discount cases: need DB writes on a scratch DB. Pest in CI only.
- V9 and V10 wording fixes still owed (the steps fail on literal wording only).

## Verification log · `/check verify` (local Docker, AC-10) · 2026-11-12

Overall: **BLOCKED**, not PASS. The local half of AC-10 passed in full. The Render half (first deploy log, Render's own health check) still needs the Render dashboard, so AC-10 stays open.

How it ran: `docker build -t eneba-server:local .` in `server/`, then the image ran against a **throwaway** `postgres:17` container on its own Docker network (`eneba-ac10-net`), with no host port and no volume. It was not the compose DB and never Neon. The env came from a scratch file that was never printed: the spec 0001 container vars (`PORT=8080`, `AUTORUN_ENABLED=true`, `AUTORUN_LARAVEL_MIGRATION_TIMEOUT=60`, `AUTORUN_LARAVEL_MIGRATION_SEED=false`, `HEALTHCHECK_PATH=/up`), plus `APP_ENV=production`, `APP_DEBUG=false`, a one off random `APP_KEY`, `FRONTEND_URL=http://localhost:5173`, a blank preview pattern, `CACHE_STORE=database`, and `LOG_CHANNEL=stderr`. Afterwards both containers, the network, and the env file were removed. No app code changed. Raw outputs (API pages, DB dump, logs, with no secrets) are in the session scratch folder under `ac10/`.

### Observed in this run
- D1 · Build: every step succeeded on `serversideup/php:8.4-fpm-nginx` (image v5.1.1, PHP 8.4.27), including `composer install --no-dev --optimize-autoloader` and `composer dump-autoload --optimize --no-dev`. In the image: no `.env` file, no `vendor/fakerphp` (dev packages left out), user `www-data`.
- D2 · Startup on an empty DB (0 public tables): "Database connection successful", then all 12 migrations `DONE` (`0001_01_01_000000_create_users_table` through `2026_11_11_100009_create_cart_items_table`), then `php artisan optimize`, then "NGINX + PHP-FPM is running correctly". The log has no seed line. Afterwards: `migrations = 12`, `products = platforms = offers = product_keys = 0`, so nothing was seeded on start. `AUTORUN_LARAVEL_MIGRATION_MODE` is unset (default mode). There are no secrets in the log (the password and key pattern scan found 0 hits).
- D3 · Health: container `healthy` about 6 s after start, with 0 restarts. The image health check runs `curl .../localhost:${NGINX_HTTP_PORT}${HEALTHCHECK_PATH}`, with `NGINX_HTTP_PORT=8080` and `HEALTHCHECK_PATH=/up`. `curl localhost:8080/up` → 200 in 0.04 s.
- D4 · Catalog on the empty DB: `GET /api/v1/products?page=1` → 200, `application/json`, `data: []`, `meta.total = 0`, `meta.per_page = 24`, `X-RateLimit-Limit: 120`. `Origin: http://localhost:5173` is echoed in `Access-Control-Allow-Origin`; `Origin: https://evil-eneba.vercel.app` gets no allow header. An unknown API route → 404 JSON `message`.
- D5 · Seeding (run on purpose, not by autorun): `php artisan db:seed --force` inside the container → `CatalogSeeder DONE`, exit 0 → 81 products (81 active), 287 offers, 3811 keys, 0 users (the test user is skipped in production). A second run gives the same counts (idempotent).
- D6 · Catalog with data: pages 1 to 4 → 81 items, `meta.total = 81`, `per_page = 24`, `last_page = 4`. Item keys are exactly the 9 in AC-2. Every item's `name`, `type`, `cover_image_url`, `platform`, `region`, `list_price.amount`, and `price.amount` equals the DB (price = the cheapest active offer with a free key): 0 mismatches out of 81. All currencies are `EUR`, 0 discount mismatches, 78 priced items sorted by name and then the 3 `price: null` items last. The first item matches production (Assassin's Creed Mirage, 1899 / 4999, 62).
- D7 · AC-1: `is_active = false` on `assassins-creed-mirage-steam-global` → it is gone from page 1 (still 24 items); restored → it is back.
- D8 · AC-3 (same product, offers 1899 with 14 free keys and 2399 with 5): cheapest offer inactive → price 2399, discount 52; cheapest offer active with 0 free keys (keys removed, then restored) → 2399; no offer in stock → `price: null`, `discount_percent: null`, and the product moves to page 4 with the null price group. Restored → 1899.
- D9 · AC-4: list 3999 / price 1299 → 67; 1000 / 999 → `null`; 1000 / 1000 → `null`; null list column → `list_price: null`, `discount_percent: null`. Restored → 4999 / 1899 / 62.
- D10 · AC-5 (local container, after `cache:clear`): requests 1 to 120 → 200, request 121 → 429; the next one → 429 with `Retry-After: 54`, `X-RateLimit-Remaining: 0`, "Too Many Attempts.". `/up` still 200 while limited.
- D11 · Safety: `php artisan migrate:fresh --force` → "This command is prohibited from running in this environment.", 81 products still there. `docker restart` → "Nothing to migrate", `healthy`, `/up` 200, 81 products and 12 migrations kept.

### Still pending after this run
- AC-10 Render half: the first deploy log with the migrations and Render's own `/up` health check (needs the Render dashboard).
- ~~AC-3 UI~~: done, see U1 below.
- AC-5 in production (121 requests to Render), AC-6 preview URL, AC-8 real cold start, AC-12 real client IP: unchanged, see the browser run log above.


## Verification log · `/check verify` (AC-3 UI) · 2026-11-12

AC-3 is now met in full: the API half (D8) and the UI half (U1). Overall stays **BLOCKED** because of the other open items (AC-5 on Render, AC-6 preview, AC-8 cold start, AC-10 Render half, AC-12).

How it ran: Playwright MCP against `https://eneba-internship-assignment.vercel.app`. The browser let the real `GET /api/v1/products?page=1` go to Render (one request, 200), then changed only the item `assassins-creed-mirage-steam-global` before the page saw it: `price: null`, `discount_percent: null`. Everything else stayed as the API sent it: the `{ data, links, meta }` envelope, `meta.total = 81`, 24 items, and on that item the real `slug`, `name`, `type`, `cover_image_url`, `platform`, `region`, and `list_price` (4999 EUR). This is the same shape the API returns for a sold out product (D8). Original values: price 1899, list 4999, discount 62. No code, data, or infrastructure changed. Screenshots `v16-out-of-stock-card.png` and `v16-out-of-stock-page.png` are in the session scratch folder under `evidence/`.

- U1 · The card reads exactly "Assassin's Creed Mirage · Steam · Global · Out of stock". "Out of stock" is a `span.text-sm.text-fg-muted` with computed color `rgb(179, 170, 201)` (the `--color-fg-muted` token, `#b3aac9`). There is no "From", no `€` amount, no `<s>` list price (even though `list_price` was set), and no `-N%` badge. The card is still one link to `/products/assassins-creed-mirage-steam-global`, with no `title`, and has no button, form, input, or nested link inside it. `main` has no buttons at all, so no buy or add to cart action appears. The cover `img` has `alt="Assassin's Creed Mirage"`, `loading="lazy"`, and loaded (`naturalWidth` 300; it was still loading in the card screenshot). The next card ("Assassin's Creed Mirage · PlayStation · Europe · From €21.48") was untouched.

## Verification log · `/check verify` (AC-10 Render half) · 2026-11-12

Result: **BLOCKED**. Nothing on the Render side could be read in this run, so the step "Render first deploy log shows the migrations and a passing `/up` health check" stays unticked.

Why: there is no Render access from this session. The Render MCP was declined for this project, the `render` CLI is not installed, and no Render credentials are set. Render posts nothing to GitHub for this repo either: commit `99123a1` has only the GitHub Actions `server` and `client` checks and the Vercel statuses, and the repo has no GitHub deployments.

Observed (public, read only), but **not** proof of the four Render items:
- R1 · `GET https://eneba-api.onrender.com/up` → 200 in 0.78 s. Response headers include `rndr-id` and `x-render-origin-server: nginx`, so the service answering on Render is the NGINX image. This shows a deploy is live today. It does not show the first deploy's log, the migration lines, Render's health check setting, or the absence of seeding on start.
- The local run of the same image (D2, D3, D11) shows what the Render log should contain. It is not evidence about Render itself.

What to check yourself in the Render dashboard (read only, no redeploy):
1. Service → **Events**: the first deploy shows "Deploy live" for its commit, and no later deploy failed. Note the commit and the time.
2. Service → **Logs** around that first deploy time: "Database connection successful", "Running migrations for default database", 12 `... DONE` lines from `0001_01_01_000000_create_users_table` to `2026_11_11_100009_create_cart_items_table`, then "NGINX + PHP-FPM is running correctly". Later deploys should say "Nothing to migrate". Search the logs for `Seeding` and `db:seed`: you expect 0 hits. (Render may only keep logs for a limited time on the free plan. If the first deploy's logs are gone, record that instead of guessing.)
3. Service → **Settings → Health Check Path**: `/up`. An event that reached "Deploy live" means Render's health check passed for that deploy.
4. Service → **Environment** (names and non secret values only): `PORT=8080`, `AUTORUN_ENABLED=true`, `AUTORUN_LARAVEL_MIGRATION_TIMEOUT=60`, `AUTORUN_LARAVEL_MIGRATION_SEED=false`, `HEALTHCHECK_PATH=/up`, and no `AUTORUN_LARAVEL_MIGRATION_MODE` (or `default`). Do not copy `APP_KEY` or `DB_URL` anywhere.

Send back what you see (screenshots or the exact lines, without secrets) and it can be recorded here as Render evidence.


## Verification log · AC-10 Render evidence (reported by you) · 2026-11-12

Source: you checked the Render dashboard on 2026-11-12 and reported what you saw. These were not reobserved from this session (there is still no Render access here). They are recorded as dashboard evidence, not as tool output.

- R2 · Events: the first deploy, of commit `7327622` (it includes the CORS fix `362eb44`), started at 11:05 and reached "Deploy live" at 11:06 (Render dashboard time).
- R3 · First deploy logs: all 12 Laravel migrations completed with `DONE`.
- R4 · Settings → Health Check Path: `/up`. The deploy reached "Deploy live", so Render's health check on `/up` passed.
- R5 · Environment: `AUTORUN_ENABLED=true`, `AUTORUN_LARAVEL_MIGRATION_SEED=false`, `HEALTHCHECK_PATH=/up`.
- R6 · Searching the first deploy logs for `Seeding` and `db:seed`: no matches.

### AC-10 verdict: **PASS** ✅

| AC-10 part | Evidence |
|---|---|
| Built on `serversideup/php:8.4-fpm-nginx` | D1 (local build of the committed Dockerfile) |
| `composer install --no-dev --optimize-autoloader` | D1 (build steps; no `vendor/fakerphp` in the image) |
| Serves on port 8080 | D3 (`NGINX_HTTP_PORT=8080`, `/up` 200 on `:8080`); on Render, R4 shows the health check reached the app, and R1 shows Render's NGINX answering `/up` |
| Migrations run on start with `AUTORUN_ENABLED=true` | R3, R5; locally D2 |
| Default mode | Follows from R3 together with D11: `migrate:fresh` (and `refresh`) is blocked in production, so a `fresh` or `refresh` mode could not have completed the 12 migrations. The mode variable was not read directly on Render. |
| No seed on start | R5 (`AUTORUN_LARAVEL_MIGRATION_SEED=false`), R6 (no seed lines); locally D2 |
| `GET /up` 200 through Render's health check | R2, R4; R1 (public `/up` 200) |

Not part of AC-10 and not reported: `PORT=8080` and `AUTORUN_LARAVEL_MIGRATION_TIMEOUT=60` as Render env values. Neither changes the verdict (the deploy went live and passed its health check).

### Feature 6 status after this update: **BLOCKED** (not complete)

Met: AC-1, AC-2, AC-3, AC-4, AC-7, AC-9, AC-10, AC-11 (API and UI evidence above; AC-11 also owes the V10 grep wording fix), AC-13.
Still open:
- AC-5: the 121 request check on Render (it passed only on the local container, D10).
- AC-6: a Vercel preview URL loading the grid.
- AC-8: a real cold start after 15+ minutes idle (it passed only with a simulated delay, V13).
- AC-12: the real client IP log check on Render.
- Wording fixes owed for the V9 (AC-9) and V10 (AC-11) steps.


## Verification log · `/check verify` (AC-6 preview) · 2026-11-12

Result: **BLOCKED**, with one finding to act on. AC-6 stays open. `<scope>` below stands for the Vercel scope slug, which is left out on purpose.

- P1 · Vercel connector: `list_projects` → 403, "Trying to access resource under scope `<scope>`… re-authenticate to this scope". `list_teams` → empty. This needs a team access grant, which was not given in this run.
- P2 · Preview deployments: the repo has only the `main` branch and no pull requests (`gh api …/branches`, `gh pr list --state all`), so Git never made a preview. The Vercel CLI (`vercel ls eneba-internship-assignment --scope <scope> --environment preview`) → "No deployments found". The same command with `--environment production` lists 2 Ready production deployments, so the query itself works. **No Preview URL exists.** None was created (not allowed in this run).
- P3 · CORS on Render, one request each, with `Accept: application/json` to `/api/v1/products?page=1`:

  | `Origin` | Matches the spec 0001 pattern shape? | `Access-Control-Allow-Origin` |
  |---|---|---|
  | `https://eneba-internship-assignment.vercel.app` (control, `FRONTEND_URL`) | n/a | echoed, plus `Vary: Origin` |
  | `https://eneba-internship-assignment-it6qus0dz-<scope>.vercel.app` (a real deployment's own URL) | yes (9 character hash form) | **none** |
  | `https://eneba-internship-assignment-git-feature-x-<scope>.vercel.app` (made up branch URL) | yes (`git-` form) | **none** |
  | `https://eneba-internship-assignment-it6qus0dz-other-team.vercel.app` | no (other scope) | none (correct) |
  | `https://eneba-internship-assignment-it6qus0d-<scope>.vercel.app` | no (8 characters) | none (correct) |

  The match column was checked with Python `re.match` against `^https://eneba-internship-assignment-(git-[a-z0-9-]+|[a-z0-9]{9})-<scope>\.vercel\.app$` (the spec 0001 shape filled in with this project and scope).
- P4 · `server/config/cors.php` (read only): it adds the preview pattern wrapped in `#…#` whenever `CORS_PREVIEW_ORIGIN_PATTERN` is not blank, so a pattern in the spec's shape would allow the two matching origins in P3. Pest `CorsTest` covers this in CI. **Finding:** the refusals in P3 fit `CORS_PREVIEW_ORIGIN_PATTERN` being blank, or set to a different value, on Render. AC-6 calls a blank pattern "previews off", which is valid behavior, but then the preview step cannot pass. The Render value was not read (no Render access), so this is the likely cause, not a confirmed one.
- P5 · Playwright on `https://eneba-internship-assignment-it6qus0dz-<scope>.vercel.app/` → redirected to `vercel.com/login` ("Login – Vercel"). Vercel Deployment Protection covers deployment URLs, so the app never loaded and no API request was sent. A share link (`get_access_to_vercel_url`) would bypass this, but it changes the deployment's access, so it was not used. A real Preview URL is behind the same protection, so the browser step needs you logged in to Vercel, or a share link you choose to create.

Note: running `vercel whoami` started the Vercel CLI device login flow, and it finished as "Logged in". The CLI now has stored credentials on this machine. It was used only for the read only `vercel ls` calls above. Run `vercel logout` if you do not want to keep it.

### To finish AC-6 (your call; each step changes config or creates a deployment)
1. In Render → Environment, check `CORS_PREVIEW_ORIGIN_PATTERN`. For previews it should be `^https://eneba-internship-assignment-(git-[a-z0-9-]+|[a-z0-9]{9})-<scope>\.vercel\.app$` (bare regex, no `#`). If it is blank or different, set it and let Render redeploy. If you prefer to keep previews off, say so and the step can be reworded to "a blank pattern allows no previews" (already proven by P3 and V7).
2. Create a Preview: push any branch (for example `verify/preview-cors`) or run `vercel` without `--prod` in `client/`. Copy the Preview URL from Vercel → Deployments (Environment: Preview).
3. Open it while logged in to Vercel. Expect the grid with 24 cards, and in DevTools → Network, `GET https://eneba-api.onrender.com/api/v1/products?page=1` → 200 with `access-control-allow-origin` set to the Preview origin.
4. Recheck with `curl -sI -H "Origin: <preview origin>" https://eneba-api.onrender.com/api/v1/products` → `access-control-allow-origin: <preview origin>`.


## Verification log · `/check verify` (AC-6 CORS after the Render update) · 2026-11-12

Context: you set `CORS_PREVIEW_ORIGIN_PATTERN` on Render (the spec 0001 shape for this project and scope) and the deploy is Live. Read only checks, one request per row, `GET https://eneba-api.onrender.com/api/v1/products?page=1` with `Accept: application/json`. `/up` → 200 first. No code, configuration, or deployment changed. `<scope>` stands for the Vercel scope slug.

- C1 · Allowed: each gets 200, `Access-Control-Allow-Origin` equal to the request origin exactly, and `Vary: Origin`.

  | `Origin` | Why |
  |---|---|
  | `https://eneba-internship-assignment.vercel.app` | `FRONTEND_URL` (production, unchanged) |
  | `https://eneba-internship-assignment-it6qus0dz-<scope>.vercel.app` | deployment URL, 9 character hash (a real deployment) |
  | `https://eneba-internship-assignment-81bfqbekz-<scope>.vercel.app` | deployment URL, 9 character hash (a real deployment) |
  | `https://eneba-internship-assignment-git-feature-x-<scope>.vercel.app` | branch URL form |
  | `https://eneba-internship-assignment-git-verify-preview-cors-<scope>.vercel.app` | branch URL form, hyphenated branch |

- C2 · Refused: each gets 200 with **no** `Access-Control-Allow-Origin` header (and `Vary: Origin`).

  | `Origin` | Why refused |
  |---|---|
  | `https://evil-eneba.vercel.app` | unrelated lookalike (AC-6 example) |
  | `https://eneba-internship-assignment-it6qus0dz-other-team.vercel.app` | other scope |
  | `https://other-project-it6qus0dz-<scope>.vercel.app` | other project, same scope |
  | `…-it6qus0d-<scope>.vercel.app` / `…-it6qus0dza-<scope>.vercel.app` | hash of 8 / 10 characters |
  | `…-IT6QUS0DZ-<scope>.vercel.app` | uppercase hash |
  | `http://eneba-internship-assignment-it6qus0dz-<scope>.vercel.app` | `http`, not `https` |
  | `https://eneba-internship-assignment-it6qus0dz-<scope>.vercel.app.evil.com` | suffix after the anchor |
  | `https://evil.eneba-internship-assignment-it6qus0dz-<scope>.vercel.app` | prefix before the anchor |
  | `https://eneba-internship-assignment-it6qus0dz-<scope>.vercel.app:8443` | port added |
  | `http://localhost:5173` | local dev origin, not allowed in production |

- C3 · Preflight `OPTIONS /api/v1/products` with `Access-Control-Request-Method: GET`, `Access-Control-Request-Headers: accept`: the preview origin `…-it6qus0dz-<scope>.vercel.app` → 204, `access-control-allow-origin` set to that origin, `access-control-allow-methods: GET`, `access-control-allow-headers: accept`. `https://evil-eneba.vercel.app` → 204 with no `access-control-*` headers.
- C4 · `supports_credentials` false: an allowed preview origin gets no `Access-Control-Allow-Credentials` header.

AC-6 server side: **met** (`FRONTEND_URL` allowed, pattern origins allowed, others refused, no credentials). The finding in P4 is resolved. Still open for AC-6: the step "A Vercel preview URL loads the grid", which needs a real Preview deployment opened while logged in to Vercel (steps 2 and 3 of "To finish AC-6" above). Feature 6 stays **BLOCKED**.


## Verification log · `/check verify` (AC-6 real Preview) · 2026-11-12

Result: **BLOCKED** at the browser step. The Preview exists and Render allows its origins, but the page could not be opened behind Vercel Deployment Protection.

- PV1 · Evidence committed on `main` as `858db01` (local only, `main` not pushed). Branch `verify/preview-cors` created at `858db01` and pushed alone. `git ls-remote`: `origin/main` stays at `99123a1`, `origin/verify/preview-cors` is at `858db01`.
- PV2 · Vercel built a Preview automatically from the push: the GitHub status on `858db01` is "Vercel success Deployment has completed" about 20 s later. `vercel ls … --environment preview` → 1 Ready Preview. `vercel inspect` → target `preview`, status Ready, created 2026-11-12 17:52:24 (UTC+2).
  - Deployment URL: `https://eneba-internship-assignment-4f3v45uwi-<scope>.vercel.app`
  - Branch alias: `https://eneba-internship-assignment-git-3bef42-<scope>.vercel.app` (Vercel shortened the branch name to `3bef42`; it still matches the `git-[a-z0-9-]+` form of the pattern)
  - No manual deploy was made.
- PV3 · Render CORS for both real Preview origins (`GET /api/v1/products?page=1`, `Accept: application/json`): 200, and `Access-Control-Allow-Origin` equals the origin exactly, for both.
- PV4 · Both Preview URLs answer `302` to `https://vercel.com/sso-api` (Vercel Deployment Protection). A Vercel share link (`get_access_to_vercel_url`) was tried as authorized access and was **denied by the session permission check**. Protection was not disabled and no other bypass was tried.

Not verified (needs authorized access to the Preview): the React app loading, 24 products, the browser request to Render succeeding, the `Access-Control-Allow-Origin` seen by the browser, and a clean console. The preview step stays unticked; AC-6 stays open.

How to finish (your call):
- Open `https://eneba-internship-assignment-4f3v45uwi-<scope>.vercel.app` in your own browser while logged in to Vercel. Check: 24 cards; DevTools → Network → `products?page=1` → 200 with `access-control-allow-origin` equal to the Preview origin; Console → no errors. Send the result (or screenshots) to record here.
- Or allow the share link permission for this session (`mcp__claude_ai_Vercel__get_access_to_vercel_url`, a 23 hour link on this Preview only) and rerun this check with Playwright.
- Afterwards, delete the temporary branch (`git push origin --delete verify/preview-cors`, `git branch -D verify/preview-cors`) if you no longer need it.


## Verification log · AC-6 Preview browser check (reported by you) · 2026-11-12

Source: you opened the Preview in Chrome, logged in to Vercel, on 2026-11-12 and reported the results. This was not reobserved from this session (the share link was denied, PV4).

- PV5 · `https://eneba-internship-assignment-4f3v45uwi-<scope>.vercel.app` (the Preview from PV2): the React app loads; 24 product cards render; `GET https://eneba-api.onrender.com/api/v1/products?page=1` → 200; `Access-Control-Allow-Origin` equals the Preview origin exactly; the browser console has no errors.

### AC-6 verdict: **PASS** ✅

| AC-6 part | Evidence |
|---|---|
| `Origin` equal to `FRONTEND_URL` gets `Access-Control-Allow-Origin` set to that origin | V6, C1 |
| An origin matching `CORS_PREVIEW_ORIGIN_PATTERN` is allowed | C1 (deployment and branch forms), C3 (preflight), PV3 (both real Preview origins), PV5 (real Preview in a browser) |
| Any other origin, for example `https://evil-eneba.vercel.app`, gets no header | V7, C2 (10 lookalike and unrelated origins), C3 |
| An empty pattern allows no previews | P3 (preview shaped origins refused before the pattern was set on Render; the Render value was not read at that time), Pest `CorsTest` in CI |
| `supports_credentials` is false | C4 |
| Applies to `api/*` | every check above hit `/api/v1/products` |

### Feature 6 status after this update: **BLOCKED** (not complete)

Met: AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-9, AC-10, AC-11, AC-13.
Still open:
- AC-5: the 121 request check on Render (passed only on the local container, D10).
- AC-8: a real cold start after 15+ minutes idle (passed only with a simulated delay, V13).
- AC-12: the real client IP log check on Render.
- The wording fixes owed for the V9 (AC-9) and V10 (AC-11) steps.
- Cleanup: the temporary branch `verify/preview-cors` is still on origin.


## Verification log · documentation review (V9, V10, AC-5, AC-12) · 2026-11-12

No requests were sent to Render or the production frontend. No code, configuration, or infrastructure changed. Only this file changed.

- W1 · V9 fix (AC-9). The old step's `grep -rn "import.meta.env" client/src` also matches the allowed `import.meta.env.DEV` reads in `src/router.tsx` (line 8 and a comment on line 6) and a comment in `src/pages/UiShowcasePage.tsx`, so it could never pass. The new command excludes `import.meta.env.DEV` and test files. On the current tree it prints exactly `client/src/lib/env.ts:1:const apiUrl = import.meta.env.VITE_API_URL;`. Negative control (a throwaway repo outside the project): it catches both `import.meta.env.VITE_API_URL` and `const { VITE_API_URL } = import.meta.env` in another file, and ignores a `.test.ts` file. Note: `git grep -E` on macOS does not support `\b`; a first draft using it matched nothing at all (a false pass), so the fixed string form `-F` is used.
- W2 · V10 fix (AC-11). The old single grep matched 5 made up fixture origins in `server/tests/Feature/CorsTest.php` (`eneba-abc123xyz-team-slug.vercel.app`, `evil-eneba.vercel.app`, and similar). The new step runs two greps: the first excludes `server/tests` (catches any host in app code or config), the second scans tests too but only for real hosts (`onrender.com`, `neon.tech`, and this project's Vercel name `eneba-internship-assignment`). Both print nothing on the current tree. Negative control: a hard coded `https://eneba-api.onrender.com` in `client/src` and a `*.onrender.com` in `server/` are caught by both; the real production Vercel origin inside a test file is caught by the second.
- W3 · AC-5 finding: **a production 121 request test is not explicitly required.**
  - AC-5's text sets the rule (120 per minute per client IP, `catalog` limiter, `database` store, 429 with `Retry-After` on the 121st) but names no environment. The spec's test plan assigns it to Pest ("Rate limit (Pest): 120 requests pass, the 121st returns 429 with `Retry-After`"). The spec's manual production list ("Deployed", and build step 11) covers AC-8, AC-10, AC-11, and AC-12, not AC-5. The curl step sits under Commands with a generic `<api>`, not under Production.
  - Evidence in hand: Pest `CatalogRateLimitTest` green in CI (run 43200375403 on `99123a1`, which also added the forged header regression test); D10, the production image in production mode on the `database` store, gave 120 × 200, then 429 with `Retry-After: 54`; V3 shows production sends `x-ratelimit-limit: 120`, so the limiter is live on Render; you reported that 5 forged `X-Forwarded-For` values shared one bucket on Render.
  - What this does not prove: that the production bucket is keyed on the **real** client IP (it could in theory be one shared proxy address), and that Render uses the `database` store (`config/cache.php` defaults to `database`, but the Render `CACHE_STORE` value was not read). Both close with the W4 check below, so AC-5 needs no separate production load test.
  - Recommendation: treat AC-5 as met for the limit, 429, and `Retry-After`, and close its "per client IP on Render" part together with AC-12.
- W4 · AC-12 review and proposal.
  - **Resolved later on 2026-11-12:** spec 0001 (`index.md`, `rationale.md`) and spec 0005 (`index.md`, `rationale.md`) now record the NGINX `CF-Connecting-IP` design, Laravel trusting only `X-Forwarded-Proto`, and the cache lookup as the preferred AC-12 method. The original note follows for the record.
  - Spec drift (needs `/architect`, not fixed here): AC-12 says "`bootstrap/app.php` trusts proxies as spec 0001 states". Spec 0001 (Proxy trust) says `trustProxies(at: '*', headers: X_FORWARDED_FOR | X_FORWARDED_HOST | X_FORWARDED_PORT | X_FORWARDED_PROTO)`. Since `99123a1` the code trusts only `HEADER_X_FORWARDED_PROTO`, on purpose (forged `X-Forwarded-For` bypassed the limit), with `TRUSTED_PROXY=cloudflare` pinned in the Dockerfile. The code is the safer choice, but the first half of AC-12 cannot pass as written until spec 0001 records the new design.
  - How the IP is set (read from the local image, no network): access logging is off in every NGINX site config, so Render logs never show client IPs. `TRUSTED_PROXY=cloudflare` includes `/etc/nginx/trusted-proxy/cloudflare.conf`: `real_ip_header CF-Connecting-IP`, `real_ip_recursive on`, and 28 `set_real_ip_from` ranges (Cloudflare plus the private ranges `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `::1`, `fd00::/8`). Laravel trusts only the scheme, so `$request->ip()` is `REMOTE_ADDR` as NGINX sets it.
  - **Least invasive check (proposed, no code change, no deploy):** the `catalog` limiter stores its counter in the `cache` table under `<prefix>` + `md5('catalog' . $request->ip())` (`ThrottleRequests` hashes named limiter keys with `md5($limiterName.$limit->key)`; the prefix is `CACHE_PREFIX`, else `slug(APP_NAME)-cache-`). So:
    1. Find your public IPv4 (for example your router, or `curl -4 https://api.ipify.org`).
    2. Send one request over the same IPv4: `curl -4 -s -o /dev/null https://eneba-api.onrender.com/api/v1/products`.
    3. In the Neon SQL editor, run this read only query: `SELECT key, expiration FROM cache WHERE key LIKE '%' || md5('catalog' || '<your IPv4>') || '%';`
    4. Expect 2 rows (the counter and its `:timer`). A match proves `$request->ip()` equals your real IP on Render. It also proves the `database` store (W3). No rows means a different IP was used. Then `SELECT count(*) FROM cache WHERE key LIKE '%-cache-%';` shows whether any limiter rows exist at all.
  - This reads one production table and changes nothing. It differs from the method named in AC-12 ("a temporary log line"), so either accept it as equivalent or ask `/architect` to reword AC-12. The spec's own method (add `Log::info($request->ip())`, deploy, read the Render log, remove, deploy again) remains the fallback; it needs a code change and two deploys.
  - Derived from code, not yet observed: the key formula comes from the installed `ThrottleRequests` source and `config/cache.php`. Step 4 is the observation.

### Feature 6 status after this review: **BLOCKED** (not complete)

Met: AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-9, AC-10, AC-11, AC-13. AC-5 met except its "per client IP on Render" part (W3).
Still open:
- AC-8: a real cold start after 15+ minutes idle (you are running it now).
- AC-12: the real client IP on Render (W4 step 4, or the spec's log line method), plus the spec 0001 drift, which needs `/architect`.
- AC-5: the "per client IP on Render" part, which closes with AC-12.
- Cleanup: the temporary branch `verify/preview-cors` is still on origin.


## Verification log · `/check verify` (AC-8 real cold start) · 2026-11-12

Result: AC-8 **met**. Overall Feature 6 stays **BLOCKED** (AC-12 and the AC-5 per IP part are open).

How it ran: Playwright MCP (Chromium), one page load of `https://eneba-internship-assignment.vercel.app/` at 2026-11-12 16:20:51 UTC (18:20:51 EET). No route, mock, or interception was active (`unrouteAll` first). No warm up request was sent: the last request from this session to Render was the PV3 check, about 27 minutes earlier (requests from other people, such as your PV5 Chrome check, are not visible here). The page state was sampled every 250 ms, so the times below are accurate to about ±0.25 s. Screenshots `v18-cold-skeletons.png`, `v18-cold-notice.png`, and `v18-cold-loaded.png` are in the session scratch folder under `evidence/`.

- K1 · Timeline (ms after navigation start):

  | t | Observed |
  |---|---|
  | 266 | `GET https://eneba-api.onrender.com/api/v1/products?page=1` sent |
  | 454 | section rendered: 12 skeleton cards, 0 product cards, no notice |
  | 3329 | `role="status"` notice: "Waking up the server. The first visit after a quiet spell can take up to a minute." (about 3.06 s after the request started); still 12 skeletons |
  | 35759 | API response 200 (request took 35.5 s), `rndr-id` header present, `access-control-allow-origin: https://eneba-internship-assignment.vercel.app` |
  | 35831 | 24 product cards, 0 skeletons, notice gone |
  | +1.5 s | still 24 cards, 0 `role="status"` elements, one `<h1>` |

- The 35.5 s response shows the service really was asleep (warm responses earlier in this file took about 0.8 s or less, for example V2 and R1).
- One API request only: no retry (correct, the request did not fail) and no "Try again" click; the grid loaded on its own. It finished well inside the 90 s `apiFetch` timeout.
- Console: 0 errors, 0 warnings, 0 uncaught page errors during the whole run.

### Feature 6 status after this run: **BLOCKED** (not complete)

Met: AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-13. AC-5 met except its "per client IP on Render" part.
Still open:
- AC-12: the real client IP on Render (W4 query, or the spec's log line method), plus the spec 0001 drift, which needs `/architect`.
- AC-5: the "per client IP on Render" part, which closes with AC-12.
- Cleanup: the temporary branch `verify/preview-cors` is still on origin.


## Verification log · AC-12 production check (reported by you) · 2026-11-12

Source: you ran the cache lookup procedure (the preferred method in AC-12) on 2026-11-12 and reported the results. It was not reobserved from this session: this session sent no request to Render and ran no query on Neon. Your public IPv4 and its hash are left out on purpose. The forged `X-Forwarded-For` values were TEST-NET addresses (`198.51.100.0/24`).

- A0 · Code half, checked locally (read only): `server/Dockerfile` line 6 `ENV TRUSTED_PROXY=cloudflare`; `server/bootstrap/app.php` `trustProxies(at: '*', headers: Request::HEADER_X_FORWARDED_PROTO)`, so `X-Forwarded-For` is never trusted. Pest `CatalogRateLimitTest` has "ignores a forged X-Forwarded-For when keying the limit" and "still builds https links from X-Forwarded-Proto" (added in `99123a1`, green in CI run 43200375403, V8). How the key is built was read from the installed Laravel 13.42.0 source and checked on a throwaway local container: `<cache prefix>` + `md5('catalog' . $request->ip())`, plus a second row with `:timer`, in the `cache` table (`key`, `value`, `expiration`).
- A1 · Production, one IPv4 request to `GET https://eneba-api.onrender.com/api/v1/products` with a forged `X-Forwarded-For`, then a read only transaction in the Neon SQL editor:

  | Item | Reported value | Reading |
  |---|---|---|
  | Request start `T0` | `1794501469` | |
  | Request end `T1` | `1794501494` | 25 s, so the service was likely waking up |
  | Q1 · rows whose key contains `md5('catalog' \|\| '<your public IPv4>')` | 2 (the counter and its `:timer`) | `$request->ip()` on Render is your real public IPv4 |
  | Expiration of those rows | `1794501554` | `T0 < 1794501554 ≤ T1 + 60`: equal to `T1 + 60`, so the window opened with this request (fresh, not stale) |
  | Q2 · rows for the forged `X-Forwarded-For` addresses | `forged_rows = 0` | a forged `X-Forwarded-For` opens no bucket |
  | Q3 · limiter shaped rows (`[0-9a-f]{32}(:timer)?$`) | `limiter_rows = 8`, `fresh_rows = 2` | the limiter writes to the `cache` table in Neon, so production uses the `database` store; the 2 fresh rows are exactly this request's pair |

  Not reported, and not needed for the verdict: the counter value `i:N;`, and the optional forged `CF-Connecting-IP` request.

### AC-12 verdict: **PASS** ✅

| AC-12 part | Evidence |
|---|---|
| NGINX resolves the IP from `CF-Connecting-IP`, `TRUSTED_PROXY=cloudflare` pinned in the Dockerfile | A0; W4 (the image's `cloudflare.conf`) |
| `bootstrap/app.php` trusts only `X-Forwarded-Proto` | A0; Pest proxy trust tests in CI (V8) |
| On Render, `$request->ip()` equals your real public IP | A1 Q1 with a fresh expiration |
| A forged `X-Forwarded-For` does not change it | A1 Q2; your earlier report of 5 forged values sharing one bucket |
| Observed once in production, no diagnostic code deployed | A1 used the cache lookup; no code change and no deploy were made for it |

### AC-5: now met in full

The limit, the 429, and `Retry-After` were already proven (D10, Pest in CI, V3 shows `x-ratelimit-limit: 120` on Render). A1 adds the last two parts: on Render the bucket is keyed per real client IP, and it lives in the `database` store (Q3). No production load test was run (W3).

## Final verdict · Feature 6 (spec 0005) · 2026-11-12

**PASS** ✅. Every acceptance criterion has cited evidence. Some evidence was reported by you from dashboards or your own browser (R2 to R6, PV5, A1) and is marked that way where it is recorded.

| AC | Status | Evidence |
|---|---|---|
| AC-1 | ✅ met | V4, V5, D6, D7; Pest |
| AC-2 | ✅ met | V3, D6; Pest |
| AC-3 | ✅ met | D8 (API), U1 (UI); Pest |
| AC-4 | ✅ met | V3, D9; Pest `DiscountTest` |
| AC-5 | ✅ met | D10, V3, A1, W3; Pest `CatalogRateLimitTest` |
| AC-6 | ✅ met | V6, V7, C1 to C4, PV3, PV5; Pest `CorsTest` |
| AC-7 | ✅ met | V11 to V15, K1 |
| AC-8 | ✅ met | V13, V14, K1 (real cold start); Vitest in CI |
| AC-9 | ✅ met | V11, W1; Vitest in CI |
| AC-10 | ✅ met | D1 to D4, D11, R2 to R6 |
| AC-11 | ✅ met | V1, V11, W2; both `.env.example` files list the keys this feature reads (server: `FRONTEND_URL`, `CORS_PREVIEW_ORIGIN_PATTERN`, `CACHE_STORE`, `DB_URL`, `APP_KEY` and the rest; client: `VITE_API_URL`) |
| AC-12 | ✅ met | A0, A1 |
| AC-13 | ✅ met | CI runs 43173320123 and 43200375403 green on `main` (V8) |

Every step in this file is ticked.

Housekeeping, not part of any criterion (your call):
- The spec 0001 and spec 0005 edits and this file are not committed yet. Local `main` is ahead of `origin/main` (`99123a1`) by docs only commits; CI on `main` runs once you push.
- The temporary branch `verify/preview-cors` and its Preview deployment still exist (`git push origin --delete verify/preview-cors`, `git branch -D verify/preview-cors`).
- The Vercel CLI is still logged in on this machine (`vercel logout` if you do not want that).
- `server/AGENTS.md` still says there is no `routes/api.php` and no `config/cors.php`; both exist now. `/sync` can fix that and update the scope.
