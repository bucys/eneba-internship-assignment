# Verify: order history · spec 0011 · updated 2026-11-13
_Steps derived from spec 0011 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Sign in with no orders, open `/orders` → tab "My orders | Eneba Marketplace (demo)", `<h1>` "My orders", "No orders yet", "Keys you buy will appear here.", "Browse games" goes to `/`, no pagination → AC-3, AC-5
- [ ] Buy one game, then click the header account menu's orders link (no reload) → the new order is the first row → AC-6
- [ ] Right after checkout the order page says "Payment successful" with no back link; reload it → "Order details", tab "Order details | Eneba Marketplace (demo)", "Back to my orders" goes to `/orders` → AC-7
- [ ] Buy a cart with two different games (quantities 2 and 1) → its row shows the first cart item's name, "and 1 more product", "3 items", the paid date, `#` plus the last 8 ULID characters in uppercase, a "Paid" badge, and the total that the order page shows → AC-1, AC-3
- [ ] With 11 or more orders, `/orders` shows 10 rows and "Page 1 of 2"; Previous is not a link; Next goes to `/orders?page=2`; the old rows stay until page 2 arrives, then the window is at the top → AC-4
- [ ] On page 2, open a row → "Order details" with "Back to my orders" going to `/orders?page=2`; reveal and copy a key still work → AC-7
- [ ] Type `/orders?page=1`, `/orders?page=abc`, `/orders?page=0` → URL becomes `/orders` → AC-4
- [ ] Type `/orders?page=99` with 2 pages → URL becomes `/orders?page=2`, the empty state never flashes → AC-4
- [ ] Throttle the network to Slow 3G and open `/orders` → 3 row skeleton, then the waking up notice after 3 s → AC-5
- [ ] Stop the API and open `/orders` → "Something went wrong" with Try again; start the API and press Try again → rows load → AC-5
- [ ] DevTools network on `/orders` → only `GET /orders?page=N`, no `/keys` request → AC-3
- [ ] Sign out, then sign in as another user → none of the first user's orders appear on any page → AC-2, AC-6
- [ ] At 360px wide, `/orders` and the order page have no sideways scroll; Tab reaches every row and pagination link with the yellow focus ring → AC-8
- [ ] `/ui` (dev) shows a one product row, a several product row, and the pagination nav on its first, middle, and last page → AC-8
- [ ] Change the browser time zone (DevTools Sensors) to one where the order's UTC time falls on another day → the row date follows the browser's time zone, `<time datetime>` keeps the UTC value → AC-3 (date source)
- [ ] On the public deploy: buy a game, open `/orders`, the new order is first, open it → "Order details", reveal its key → AC-8

## Commands
- [ ] `curl -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" "$API/api/v1/orders"` → 200, `{ data, links, meta }`, `meta.per_page` 10, rows newest first, no `items` field and no key code → AC-1
- [ ] Same with `?page=abc` and `?page=0` → `meta.current_page` 1; `?page=99` → `data: []` with the real `meta.last_page` → AC-2
- [ ] Same without the token → 401 → AC-2
- [ ] 61 requests in a minute across `/orders` and `/orders/{ulid}` → the last is 429 with `Retry-After` → AC-2
- [ ] Compare a row's `item_count` with the sum of the order's item quantities and the number of keys `/orders/{ulid}/keys` returns → equal → AC-1 (item_count source)
- [ ] Compare a row's `line_count` and `first_item.product_name` with `/orders/{ulid}` `items` (count, and the first item) → equal → AC-1 (line_count and first_item source)
- [ ] Compare a row's `total` and `paid_at` with `/orders/{ulid}` → equal → AC-1
- [ ] `cd server && php artisan test tests/Feature/Orders` → passes (happy path, leak check, fixed query count, pages, ownership, 401, 429, writes nothing) → AC-1, AC-2
- [ ] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` and `cd server && composer format:check && composer analyse && php artisan test` → all pass, and CI is green on the pushed commit → AC-8

## Acceptance-criteria coverage
- AC-1: rows 4, curl list, item_count, line_count, total, Pest
- AC-2: sign in as another user, curl pages, 401, 429, Pest
- AC-3: rows 1, 4, 11, time zone
- AC-4: rows 5, 7, 8
- AC-5: rows 1, 9, 10
- AC-6: rows 2, 12
- AC-7: rows 3, 6
- AC-8: rows 13, 14, 16, checks and CI
