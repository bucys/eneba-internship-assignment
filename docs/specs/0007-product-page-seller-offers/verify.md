# Verify: Product page with seller offers · spec 0007 · updated 2026-11-12
_Steps derived from spec 0007 acceptance criteria and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

Seeded examples (dev DB): `the-witcher-3-wild-hunt-steam-global` (discount, two in stock offers), `elden-ring-playstation-europe` (an "Only 1 left" row and an out of stock row), `hades-nintendo-north-america` (every offer out of stock). Its buyable sibling is `hades-steam-global`.

## Result (2026-11-12): accepted
`/check verify` ran locally (Postgres, API, client) and on the public deploy. All of AC-1 to AC-10 are met. Final smoke test on production: `/products/the-witcher-3-wild-hunt-steam-global`, `/products/hades-steam-global` and `/products/hades-nintendo-north-america` all render correctly. The refetch fix (a failed background refetch keeps the loaded page; only a 404 swaps to "Game not found") was checked in the browser with a mocked 500.

How each step was checked:
- **Manual** (`[x]`): run against the real app. Gift card and Subscription labels, "New seller", the empty offers state and a fully hidden About used a mocked API response, because the seed has none of those.
- **Pest only** (`[ ]`, marked *Pest*): the seed has no data to show it in the browser. `ShowProductTest` covers it.
- **Deferred to checkout** (`[ ]`, marked *Deferred*): needs a real sold key, which only checkout can create. Tracked under feature 10 in the scope.

Known gap, outside this feature: the home grid shows only page 1 and the header search goes to `/store`, which doesn't exist yet. So products past page 1 (both Hades variants included) can only be opened by URL until features 13 and 14.

## API
- [x] `GET /api/v1/products/the-witcher-3-wild-hunt-steam-global` → 200, `data` keys in this order: `slug, name, type, cover_image_url, description, developer, publisher, release_date, platform, region, price, list_price, discount_percent, best_offer_id, offers` → AC-1
- [x] Same response: each offer has exactly `id, price, stock, seller { name, rating_basis_points, rating_count }`, and the body contains no `"code"` → AC-2
- [x] Same response: offers in stock come first, sorted by price ascending; `best_offer_id` is the first offer's `id`; `price` equals that offer's price → AC-2, AC-3
- [x] `price` and `discount_percent` here match that product's item in `GET /api/v1/products` → AC-3
- [x] `GET /api/v1/products/hades-nintendo-north-america` → `best_offer_id`, `price`, `discount_percent` are `null`; `list_price` is still set → AC-3
- [x] `GET /api/v1/products/no-such-game` and `GET /api/v1/products/Bad_Slug` → 404 `{ "message": ... }` → AC-4
- [x] 121 requests in one minute from one IP → the 121st gets 429 with `Retry-After` → AC-4

## UI / manual
- [x] At 1280px, open `/products/the-witcher-3-wild-hunt-steam-global` → cover on the left; "Game" label, `<h1>` name, "Steam · Global"; buy box with "Best price", large price, struck list price, `-NN%` badge, "Sold by {seller}" → AC-5
- [x] Same page: "All offers" `<h2>` with a `<ul>` of rows; the best row has a "Best price" badge; ratings read like "99.5% · 48,210 ratings"; no buy or add to cart controls → AC-6
- [x] Same page: "About" shows the description and Developer, Publisher, Release date "18 May 2015" → AC-7
- [x] Open `/products/elden-ring-playstation-europe` → one row says "Only 1 left"; the out of stock row shows "Out of stock" with muted seller text → AC-6
- [x] Open `/products/hades-nintendo-north-america` → buy box says "Out of stock"; every row muted; no "Best price" badge anywhere → AC-5, AC-6
- [x] Find a product with no description, developer, publisher, or release date (or null them in the dev DB) → the About section is gone → AC-7
- [x] Throttle the network to Slow 3G (or delay the API) → a skeleton with the same layout, then the "Waking up the server" notice after 3 s → AC-8
- [x] Open `/products/no-such-game` → "Game not found" `<h1>`, the text "This game does not exist or is no longer sold.", a link to the homepage; tab title "Game not found | Eneba Marketplace (demo)" → AC-8
- [x] Stop the API, open a product → "Something went wrong" with "Try again"; start the API and click it → the product loads → AC-8
- [x] Loaded product tab title is "{name} | Eneba Marketplace (demo)" → AC-8
- [x] At 360px → one column, no sideways scroll; at 768px and wider, cover and details sit side by side → AC-9
- [x] Press Tab from the top of the page → every link and button gets the yellow focus ring, in reading order → AC-9
- [x] The homepage grid cards look the same as before (cover ratio, placeholder on a broken image) → AC-10

## Value sourcing
- [ ] *Deferred to checkout (feature 10)*: Offer `stock` equals unsold keys: sell (or mark sold) one key of an offer in the dev DB, reload → that row's stock drops by one; at 0 it moves below every in stock row → Value sourcing: stock. Partly seen: Elden Ring's stock 0 row sorts below the in stock rows.
- [ ] *Pest*: Discount uses the best in stock price, not the cheapest overall: an out of stock offer cheaper than the best does not change `price` or `discount_percent` → Value sourcing: discount_percent. Price part seen manually: Elden Ring's cheaper out of stock offer (€26.39) leaves the price at €37.79; no seeded product pairs this with a list price.
- [ ] *Pest*: Tie on price: the higher rated seller ranks first; a seller with `rating_count = 0` ranks below rated ones and shows "New seller" → Value sourcing: offer order, rating text. No seeded ties; "New seller" text seen with a mocked response.
- [x] Release date in a far west time zone (run the browser with `TZ=Pacific/Honolulu`) → still "18 May 2015" → Value sourcing: release date text
- [x] Type labels: a DLC, gift card, and subscription product show "DLC", "Gift card", "Subscription" → Value sourcing: type label
- [x] Navigate from one product page to another → the old product never shows under the new URL → Value sourcing: which slug to load

## Commands
- [x] `cd server && php artisan test --filter=ShowProduct` → all pass → AC-1 to AC-4
- [x] `cd server && composer format:check && composer analyse` → clean → AC-10
- [x] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → all pass → AC-5 to AC-7, AC-10
- [x] CI green on the pushed commit; the page works on the public Vercel URL → AC-10

## Acceptance criteria coverage
- AC-1: API step 1 · AC-2: API steps 2 and 3, Value sourcing tie step · AC-3: API steps 3 to 5, discount step · AC-4: API steps 6 and 7 · AC-5: UI steps 1 and 5 · AC-6: UI steps 2, 4, 5 · AC-7: UI steps 3 and 6 · AC-8: UI steps 7 to 10 · AC-9: UI steps 11 and 12 · AC-10: UI step 13, Commands
