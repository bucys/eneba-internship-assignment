# Verify: Walking skeleton + public deploy · spec 0005 · updated 2026-11-11
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
- [ ] Order: priced products first by name then id; a product whose offers are all sold out sits after them → AC-1
- [ ] Page size 24 and page param: `?page=2` gives the next 24; `?per_page=100` still gives 24; `?page=abc` gives page 1 → AC-1
- [ ] Item `slug`, `name`, `type`, `cover_image_url`, `platform`, `region` match the DB rows for that product → AC-2
- [ ] `price.amount`: deactivate the cheapest offer of one product (or mark all its keys sold) → the card price rises to the next cheapest offer with stock; with none left → "Out of stock" → AC-3
- [ ] `currency` is `"EUR"` on every `price` and `list_price` → AC-2
- [ ] `list_price.amount` equals `products.list_price_cents`; null column → no strikethrough → AC-4
- [ ] `discount_percent`: list 3999, price 1299 → 67; list 1000, price 999 → no badge (rounds to 0) → AC-4
- [ ] Waking notice: shows only while fetching with no data, after 3 s → AC-8
- [ ] Loading count 12 and empty copy match the spec → AC-7
- [ ] `apiFetch` base URL comes only from `VITE_API_URL` (`grep -rn "import.meta.env" client/src` only hits `src/lib/env.ts`) → AC-9
- [ ] Timeout 90 s, retry once, no mutation retry: covered by `src/api/client.test.ts` and `src/lib/queryClient.test.ts` → AC-8
- [ ] CORS origins come from `FRONTEND_URL` and `CORS_PREVIEW_ORIGIN_PATTERN` (see production steps) → AC-6
- [ ] Rate limit keyed by IP after proxy trust (see production steps) → AC-5, AC-12

## Commands
- [ ] `cd server && composer format:check && composer analyse && php artisan test` → all pass → AC-1 to AC-6, AC-13
- [ ] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → all pass → AC-8, AC-9, AC-13
- [ ] CI run for the push to `main` is green (`gh run list --branch main --limit 1`) → AC-13
- [ ] `cd server && docker build -t eneba-server:local .` then run it with the spec 0001 env vars against an empty DB → logs show migrations, no seed; `curl localhost:8080/up` → 200; container health `healthy` → AC-10
- [ ] `for i in $(seq 121); do curl -s -o /dev/null -w "%{http_code}\n" <api>/api/v1/products; done | tail -1` → 429, and the response has `Retry-After` → AC-5

## Production (after Neon, Render, Vercel setup)
- [ ] Render first deploy log shows the migrations and a passing `/up` health check → AC-10
- [ ] Vercel production URL shows seeded games; DevTools shows the request to the Render origin → AC-11
- [ ] First visit after 15+ min idle shows the waking notice, then the grid → AC-8
- [ ] `curl -sI -H "Origin: <vercel prod origin>" <render>/api/v1/products` → `Access-Control-Allow-Origin: <vercel prod origin>` → AC-6
- [ ] A Vercel preview URL loads the grid (its origin matches `CORS_PREVIEW_ORIGIN_PATTERN`) → AC-6
- [ ] `curl -sI -H "Origin: https://evil-eneba.vercel.app" <render>/api/v1/products` → no `Access-Control-Allow-Origin` header (true with the preview pattern set or blank) → AC-6
- [ ] Temporary `Log::info($request->ip())` shows your real public IP in Render logs; then remove the line and redeploy → AC-12
- [ ] `git grep -n -i -E "onrender\.com|neon\.tech|vercel\.app" -- ':!docs'` finds nothing → AC-11

## Acceptance criteria coverage
- AC-1: Pest list tests; value sourcing steps 1 to 3 · AC-2: Pest shape test; item steps · AC-3: Pest price rule; price step · AC-4: Pest unit `DiscountTest`; discount step · AC-5: Pest `CatalogRateLimitTest`; 121 request curl · AC-6: Pest `CorsTest`; production CORS steps · AC-7: UI steps; Vitest mapping · AC-8: UI throttling and stopped API steps; Vitest timeout and retry · AC-9: Vitest `apiFetch`; Network tab step · AC-10: Docker run; Render deploy log · AC-11: production URL; git grep · AC-12: Render IP log · AC-13: command steps and CI
