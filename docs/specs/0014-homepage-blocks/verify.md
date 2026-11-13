# Verify: Homepage blocks · spec 0014 · updated 2026-11-13
_Steps derived from spec 0014 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands
- [ ] `cd server && php artisan test tests/Feature/Home tests/Feature/Seed` → all pass → AC-1 to AC-7
- [ ] `cd client && npx vitest run src/pages/HomePage.test.tsx src/api/home.test.ts` → all pass → AC-8, AC-9, AC-11
- [ ] On a fresh local DB (`php artisan migrate:fresh --seed`), `curl -s localhost:8000/api/v1/home` → `banners`, `best_sellers`, `deals`, `products` with titles Featured, Best sellers, Deals, Browse games → AC-1, AC-6
- [ ] `curl -s localhost:8000/api/v1/home/best-sellers | jq '[.data[].slug]'` → exactly the 12 slugs in the comment of `server/database/data/demo_orders.php`, in that order, with no unit counts in the payload → AC-3, AC-7
- [ ] `curl -s localhost:8000/api/v1/home/deals | jq '[.data[].discount_percent]'` → 12 values, never increasing → AC-4
- [ ] `curl -s localhost:8000/api/v1/home/banners | jq '.data | length'` → 8; each `image_url` equals its `product.cover_image_url` → AC-2, AC-6
- [ ] Run `php artisan db:seed` a second time → no new rows in `orders`, `banners`, `home_blocks`, `users` → AC-6, AC-7
- [ ] 121 quick requests to `/api/v1/home/deals` from one IP → the last one answers 429 with `Retry-After` → AC-5

## Value sources (vary the source, check the output)
- [ ] `UPDATE home_blocks SET position = 0 WHERE type = 'deals'` → Deals moves to the top of `/home` and of the page → AC-1
- [ ] `UPDATE home_blocks SET is_active = false WHERE type = 'best_sellers'` → it leaves `/home`, the band disappears, and the bands still alternate light, dark, light → AC-1, AC-12
- [ ] `UPDATE home_blocks SET title = 'Top picks' WHERE type = 'deals'` → the page heading and the arrow labels ("Scroll Top picks left") change → AC-8, AC-11
- [ ] `UPDATE banners SET tagline = 'Changed copy' WHERE position = 1` → the first tile shows the new copy after a reload → AC-2
- [ ] Hide one banner (`is_active = false`) or its product → the tile disappears; set one banner product sold out → the tile stays with "Out of stock" → AC-2
- [ ] Change the cheapest offer price of a banner product → the tile and best seller card prices follow on the next fetch → AC-2, AC-3
- [ ] Buy 20 units of a product outside the top 12 through checkout → it appears first in Best sellers on the next fetch → AC-3
- [ ] Set a product's `list_price_cents` to its cheapest price + 1 cent → it drops out of Deals (rounds to 0%) → AC-4
- [ ] Demo user: `SELECT password FROM users WHERE email = 'demo-buyer@example.com'` → a hash that does not match `password`, unchanged after a reseed → AC-7

## UI / manual
- [ ] Visit `/` at 1440px → hidden `<h1>` "Buy game keys at the best prices", then the tile strip flush with the page edges, Best sellers, Deals, Browse games → AC-8, AC-10, AC-12
- [ ] Block one endpoint in devtools (for example `/home/deals`) → only Deals shows its error with Try again; Try again refetches only that block → AC-9
- [ ] Block `/home` → only the page error with Try again shows; no blocks → AC-8
- [ ] Throttle the network to slow 3G → skeleton strip and band, then the "Waking up the server" notice after 3 s → AC-8
- [ ] Tile strip at 360, 640, 768, 1024px → about 2.5, 3.5, 5, 6 tiles; arrows only from 768px; at each end the arrow dims and keeps focus → AC-10
- [ ] Break a tile image URL in devtools → `Gamepad2` placeholder in a 1:2 frame → AC-10
- [ ] At 360px: Best sellers shows 4 horizontal cards and Show all; activate it with the keyboard → 12 cards, the button is gone, focus is on the 5th card → AC-11
- [ ] Expand Show all, then widen past 768px and narrow again → the list stays expanded → AC-11
- [ ] At 360px the page never scrolls sideways (`document.documentElement.scrollWidth === 360`) → AC-13
- [ ] Tab through tiles, arrows, cards, and Show all → the yellow ring is fully visible on each (inset on tiles and cards) → AC-13
- [ ] Hover a card on `/` and on `/store` → a 1px mint ring, the background does not change → AC-12
- [ ] Open a tile and a card → each lands on its `/products/<slug>` page → AC-13
- [ ] `/ui` → Homepage blocks section shows the strip, a rail, the mobile list, the horizontal card, and loading, error, empty block states → AC-13
- [ ] After deploy and production seed: the public homepage shows Featured, Best sellers, Deals, Browse games → AC-13

## Acceptance-criteria coverage
- AC-1 commands 1, 3; value sources 1, 2 · AC-2 command 6; value sources 4 to 6 · AC-3 command 4; value sources 6, 7 · AC-4 command 5; value source 8 · AC-5 command 8 · AC-6 commands 3, 6, 7 · AC-7 commands 4, 7; value source 9 · AC-8 UI 1 to 4 · AC-9 UI 2 · AC-10 UI 5, 6 · AC-11 UI 7, 8; value source 3 · AC-12 UI 11; value source 2 · AC-13 UI 9, 10, 12 to 14
