# Verify: Walking skeleton + public deploy · spec 0005 · updated 2026-11-12
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

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
- [ ] `apiFetch` base URL comes only from `VITE_API_URL` (`grep -rn "import.meta.env" client/src` only hits `src/lib/env.ts`) → AC-9
- [x] Timeout 90 s, retry once, no mutation retry: covered by `src/api/client.test.ts` and `src/lib/queryClient.test.ts` → AC-8 · passed, evidence: GitHub CI run 43173320123 on `a12f635`, 2026-11-12 (not run locally for this record), `client` job Vitest step
- [x] CORS origins come from `FRONTEND_URL` and `CORS_PREVIEW_ORIGIN_PATTERN` (see production steps) → AC-6 · passed on production 2026-11-12, see C1 to C4
- [ ] Rate limit keyed by IP after proxy trust (see production steps) → AC-5, AC-12

## Commands
- [x] `cd server && composer format:check && composer analyse && php artisan test` → all pass → AC-1 to AC-6, AC-13 · passed, evidence: GitHub CI run 43173320123 on `a12f635`, 2026-11-12 (not run locally for this record), `server` job (Pint, PHPStan, Pest on Postgres 17)
- [x] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → all pass → AC-8, AC-9, AC-13 · passed, evidence: GitHub CI run 43173320123 on `a12f635`, 2026-11-12 (not run locally for this record), `client` job (Prettier, oxlint, TypeScript, Vitest, build)
- [x] CI run for the push to `main` is green (`gh run list --branch main --limit 1`) → AC-13 · passed 2026-11-12: run 43173320123 on `a12f635` (includes `349b0d7` and `362eb44`), `server` job (Pint, PHPStan, Pest) and `client` job (Prettier, oxlint, TypeScript, Vitest, build) both green. Earlier runs 43096577646 and 43098464245 stayed stuck in GitHub's queue and were not retried. Rechecked 2026-11-12: run 43200375403 on `99123a1` (the proxy trust fix) is green too.
- [x] `cd server && docker build -t eneba-server:local .` then run it with the spec 0001 env vars against an empty DB → logs show migrations, no seed; `curl localhost:8080/up` → 200; container health `healthy` → AC-10 · passed locally 2026-11-12 against a fresh isolated Postgres 17, see D1 to D4, D11
- [x] `for i in $(seq 121); do curl -s -o /dev/null -w "%{http_code}\n" <api>/api/v1/products; done | tail -1` → 429, and the response has `Retry-After` → AC-5 · passed against the local container 2026-11-12 (same image, not Render), see D10; the production run is still not done

## Production (after Neon, Render, Vercel setup)
- [x] Render first deploy log shows the migrations and a passing `/up` health check → AC-10 · passed, evidence: Render dashboard checked by you 2026-11-12, see R2 to R6
- [x] Vercel production URL shows seeded games; DevTools shows the request to the Render origin → AC-11 · passed 2026-11-12, see V11
- [ ] First visit after 15+ min idle shows the waking notice, then the grid → AC-8
- [x] `curl -sI -H "Origin: <vercel prod origin>" <render>/api/v1/products` → `Access-Control-Allow-Origin: <vercel prod origin>` → AC-6 · passed, evidence: production run 2026-11-12, see Verification log V6
- [ ] A Vercel preview URL loads the grid (its origin matches `CORS_PREVIEW_ORIGIN_PATTERN`) → AC-6 · still open 2026-11-12: no Preview deployment exists, and Render refuses preview shaped origins, see P1 to P5; update: the Render CORS side now passes (C1 to C4), only the browser load of a real Preview remains
- [x] `curl -sI -H "Origin: https://evil-eneba.vercel.app" <render>/api/v1/products` → no `Access-Control-Allow-Origin` header (true with the preview pattern set or blank) → AC-6 · passed, evidence: production run 2026-11-12, see Verification log V7
- [ ] Temporary `Log::info($request->ip())` shows your real public IP in Render logs; then remove the line and redeploy → AC-12
- [ ] `git grep -n -i -E "onrender\.com|neon\.tech|vercel\.app" -- ':!docs'` finds nothing → AC-11

## Acceptance criteria coverage
- AC-1: Pest list tests; value sourcing steps 1 to 3 · AC-2: Pest shape test; item steps · AC-3: Pest price rule; price step · AC-4: Pest unit `DiscountTest`; discount step · AC-5: Pest `CatalogRateLimitTest`; 121 request curl · AC-6: Pest `CorsTest`; production CORS steps · AC-7: UI steps; Vitest mapping · AC-8: UI throttling and stopped API steps; Vitest timeout and retry · AC-9: Vitest `apiFetch`; Network tab step · AC-10: Docker run; Render deploy log · AC-11: production URL; git grep · AC-12: Render IP log · AC-13: command steps and CI

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
