# Verify: Walking skeleton + public deploy · spec 0005 · updated 2026-11-12
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual (local: `php artisan serve` + `npm run dev`, seeded dev DB)
- [ ] Open `/` → one `<h1>`, then an `<h2>` "Browse games" with 24 product cards (cover, name, platform · region, price, strikethrough list price, discount badge) → AC-7
- [ ] Click a card → goes to `/products/<slug>` (shows the 404 page until feature 8) → AC-7
- [ ] Hard reload with DevTools throttling ("Slow 3G") → 12 skeleton cards; after about 3 s the info notice "Waking up the server. The first visit after a quiet spell can take up to a minute." appears; it disappears once the grid loads → AC-7, AC-8
- [ ] Stop `php artisan serve`, reload → skeletons, one retry about 3 s later (Network tab shows 2 requests), then `ErrorState`; start the server, click "Try again" → skeletons (and the notice if still pending after 3 s), then the grid → AC-7, AC-8
- [ ] With no active products (for example `UPDATE products SET is_active = false` on a scratch DB) → `EmptyState` "No games yet" / "Check back soon." → AC-7
- [ ] Network tab: the request goes to `${VITE_API_URL}/api/v1/products?page=1` with `Accept: application/json` → AC-9

## Value sourcing (one step per row)
- [ ] Which products: set one product `is_active = false` → it disappears from the list → AC-1
- [x] Order: priced products first by name then id; a product whose offers are all sold out sits after them → AC-1 · passed, evidence: production run 2026-11-12, see Verification log V5 (id tiebreak not observed: no duplicate names)
- [x] Page size 24 and page param: `?page=2` gives the next 24; `?per_page=100` still gives 24; `?page=abc` gives page 1 → AC-1 · passed, evidence: production run 2026-11-12, see Verification log V4
- [ ] Item `slug`, `name`, `type`, `cover_image_url`, `platform`, `region` match the DB rows for that product → AC-2
- [ ] `price.amount`: deactivate the cheapest offer of one product (or mark all its keys sold) → the card price rises to the next cheapest offer with stock; with none left → "Out of stock" → AC-3
- [x] `currency` is `"EUR"` on every `price` and `list_price` → AC-2 · passed, evidence: production run 2026-11-12, see Verification log V3
- [ ] `list_price.amount` equals `products.list_price_cents`; null column → no strikethrough → AC-4
- [ ] `discount_percent`: list 3999, price 1299 → 67; list 1000, price 999 → no badge (rounds to 0) → AC-4
- [ ] Waking notice: shows only while fetching with no data, after 3 s → AC-8
- [ ] Loading count 12 and empty copy match the spec → AC-7
- [ ] `apiFetch` base URL comes only from `VITE_API_URL` (`grep -rn "import.meta.env" client/src` only hits `src/lib/env.ts`) → AC-9
- [x] Timeout 90 s, retry once, no mutation retry: covered by `src/api/client.test.ts` and `src/lib/queryClient.test.ts` → AC-8 · passed, evidence: GitHub CI run 43173320123 on `a12f635`, 2026-11-12 (not run locally for this record), `client` job Vitest step
- [ ] CORS origins come from `FRONTEND_URL` and `CORS_PREVIEW_ORIGIN_PATTERN` (see production steps) → AC-6
- [ ] Rate limit keyed by IP after proxy trust (see production steps) → AC-5, AC-12

## Commands
- [x] `cd server && composer format:check && composer analyse && php artisan test` → all pass → AC-1 to AC-6, AC-13 · passed, evidence: GitHub CI run 43173320123 on `a12f635`, 2026-11-12 (not run locally for this record), `server` job (Pint, PHPStan, Pest on Postgres 17)
- [x] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → all pass → AC-8, AC-9, AC-13 · passed, evidence: GitHub CI run 43173320123 on `a12f635`, 2026-11-12 (not run locally for this record), `client` job (Prettier, oxlint, TypeScript, Vitest, build)
- [x] CI run for the push to `main` is green (`gh run list --branch main --limit 1`) → AC-13 · passed 2026-11-12: run 43173320123 on `a12f635` (includes `349b0d7` and `362eb44`), `server` job (Pint, PHPStan, Pest) and `client` job (Prettier, oxlint, TypeScript, Vitest, build) both green. Earlier runs 43096577646 and 43098464245 stayed stuck in GitHub's queue and were not retried. Rechecked 2026-11-12: run 43200375403 on `99123a1` (the proxy trust fix) is green too.
- [ ] `cd server && docker build -t eneba-server:local .` then run it with the spec 0001 env vars against an empty DB → logs show migrations, no seed; `curl localhost:8080/up` → 200; container health `healthy` → AC-10
- [ ] `for i in $(seq 121); do curl -s -o /dev/null -w "%{http_code}\n" <api>/api/v1/products; done | tail -1` → 429, and the response has `Retry-After` → AC-5

## Production (after Neon, Render, Vercel setup)
- [ ] Render first deploy log shows the migrations and a passing `/up` health check → AC-10
- [ ] Vercel production URL shows seeded games; DevTools shows the request to the Render origin → AC-11
- [ ] First visit after 15+ min idle shows the waking notice, then the grid → AC-8
- [x] `curl -sI -H "Origin: <vercel prod origin>" <render>/api/v1/products` → `Access-Control-Allow-Origin: <vercel prod origin>` → AC-6 · passed, evidence: production run 2026-11-12, see Verification log V6
- [ ] A Vercel preview URL loads the grid (its origin matches `CORS_PREVIEW_ORIGIN_PATTERN`) → AC-6
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
