# Verify: Checkout & simulated payment · spec 0009 · updated 2026-11-13
_Steps derived from spec 0009 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Setup for the UI steps: `docker compose up -d`, `php artisan serve` in `server/`, `npm run dev` in `client/`, a signed in buyer with two offers in the cart.

## UI / manual
- [ ] Open `/checkout` signed out → redirected to `/login`; sign in → back on `/checkout` → AC-10
- [ ] Open `/checkout` with a cart → `<h1>` "Checkout", tab title `Checkout | Eneba Marketplace (demo)`, the cart is refetched on mount (network tab shows `GET /cart`) → AC-10
- [ ] Change a price in the DB, open `/cart` (cached), then `/checkout` → the summary and Pay label show the new total, not the cached one → AC-10
- [ ] Slow the network (throttle) and open `/checkout` with an empty cache → skeleton, then "Waking up the server" after 3 seconds → AC-10
- [ ] Empty cart → "Your cart is empty" with "Browse games" to `/`; an inactive offer in the cart → "Some items are no longer available." with "Back to cart", no form → AC-10
- [ ] Stop the API and open `/checkout` → `ErrorState`; start it, click "Try again" → the page loads → AC-10
- [ ] A line reduced by stock shows "Only N available, so we lowered the quantity." with N the line quantity; "1 item" / "N items" from `item_count` → AC-11
- [ ] Type `4242424242424242` → "4242 4242 4242 4242"; type `1229` in Expiry → "12/29" → AC-11
- [ ] Click Pay with empty fields → four messages under the fields, focus on Card number, no request sent → AC-12
- [ ] Pay with `4000 0000 0000 0002` → "Your card was declined." in the alert above Pay, card values kept, cart unchanged → AC-4, AC-5, AC-13
- [ ] Pay with `4000 0000 0000 9995` → "Your card has insufficient funds." → AC-5, AC-13
- [ ] Pay with `4242 4242 4242 4241` (bad Luhn) → "Enter a valid card number." under the field, focus moves there → AC-3, AC-12, AC-13
- [ ] Pay with an expiry of last month → "This card has expired." under Expiry → AC-3, AC-13
- [ ] Raise an offer price by 1 cent in the DB, then Pay → "Your cart changed…" alert, the summary and Pay label update, Pay again succeeds → AC-4, AC-13
- [ ] While paying, the button reads "Processing payment…" with a spinner and the fields are disabled; double clicking sends one request → AC-12
- [ ] Successful pay → `/orders/{ulid}`, header badge 0 at once, Back goes to the page before checkout (not the form) → AC-14
- [ ] Confirmation page: `<h1>` "Payment successful", "Order {ULID}" uppercase, paid time in the browser locale, one row per item with a link to `/products/{slug}`, total, "Continue shopping" → AC-15
- [ ] Reload the confirmation page → same content from `GET /orders/{ulid}`; an unknown ULID → "Order not found" with a link to `/` → AC-9, AC-15
- [ ] After a purchase, the product page offer stock dropped by the quantity bought; an offer at 0 sorts below every in stock row → AC-16
- [ ] At 360px: one column (summary, form, Pay), no sideways scroll; from `md`: form left, sticky summary right → AC-11, AC-17
- [ ] Keyboard only: Tab through every field and Pay with the focus ring, Enter submits; field errors are linked with `aria-describedby` and `aria-invalid` → AC-17
- [ ] Run a success purchase on the public deploy → AC-17

## Commands
- [ ] `cd server && php artisan test --compact tests/Feature/Checkout tests/Unit/Payments` → all pass → AC-1 to AC-5, AC-7 to AC-9, AC-18
- [ ] `cd server && php artisan test` → every spec 0008 cart test still passes with the lock → AC-18
- [ ] `scripts/checkout-concurrency.sh` → "All scenarios passed 20 rounds." → AC-6, AC-18
- [ ] `cd client && npx vitest run src/lib/cardInput.test.ts src/lib/checkout.test.ts` → all pass → AC-12, AC-13
- [ ] `curl -X POST $API/checkout` without a token → 401; 11 requests in a minute → 429 with `Retry-After`; with a preview `Origin` → 403 → AC-8
- [ ] Grep the server log after a paid, replayed, and declined checkout → exactly one `checkout.paid` and one `checkout.declined`, no card values → AC-7
- [ ] Client and server checks pass locally and in CI → AC-17

## Value sourcing
- [ ] Replay order: repeat a paid request with the same `Idempotency-Key` and an expired card body → 200 with the same `ulid` (source: `orders` by user and key, under the lock)
- [ ] Lines bought: add a line in a second tab while paying → the checkout buys only what it read under the lock; the new line survives (concurrency scenario 5)
- [ ] Cart rows deleted: after paying, only the bought `offer_id`s are gone from `cart_items`
- [ ] Effective quantity: a stored quantity of 5 with stock 3 → `order_items.quantity` is 3
- [ ] `unit_price_cents`: change the price after the cart loads but send the new `expected_total` → the order uses the live price, not the cart page's
- [ ] `total_cents`: equals the sum of the items' `quantity × unit_price_cents` (concurrency invariants)
- [ ] Conflict check: `expected_total` off by one cent → 409
- [ ] Name snapshots: rename the product after paying → the order still shows the old name
- [ ] `product_id`: `order_items.product_id` equals `offers.product_id`
- [ ] `idempotency_key`: the stored key equals the header value
- [ ] `paid_at` / `sold_at`: every sold key's `sold_at` equals the order's `paid_at`
- [ ] `checkout.declined` fields: `user_id` and `decline_code` (`card_declined` or `insufficient_funds`) only
- [ ] `checkout.paid` fields: `ulid`, `user_id`, `total_cents`, logged only after commit, never on a replay
- [ ] `ulid`: lowercase 26 characters; an uppercase ULID in the URL → 404
- [ ] Approve or decline: spaces or dashes in a decline number still decline (normalized number)
- [ ] Expired month: set the clock to the 1st of a month in UTC (or a time zone ahead of UTC) and pay with that month → accepted; the month before → expired
- [ ] 201 vs 200: first request 201, its replay 200
- [ ] Live `slug` and cover: change the product cover → the order page shows the new cover, old name
- [ ] Item order: items follow cart order (`order_items.id` ascending)
- [ ] `paid_at` text: ends in `Z`, second precision
- [ ] `/checkout` `expected_total` sent: the request body total equals the total on screen
- [ ] Idempotency key: one per page visit (same key on a retry after a decline; a new one after reopening the page)
- [ ] Retry after seconds: a 429 shows "Try again in N seconds." with N from `Retry-After`
- [ ] Paid date: change the browser locale or time zone → the date format and hour follow it

## Acceptance-criteria coverage
- AC-1 … Pest happy path, concurrency invariants, Value sourcing rows · AC-2 … Pest happy path and snapshot test · AC-3 … Pest validation dataset, UI bad Luhn and expired · AC-4 … Pest order, decline, conflict, empty, replay · AC-5 … Pest and Unit gateway, UI declines · AC-6 … concurrency script · AC-7 … Pest logging, log grep · AC-8 … Pest access, curl · AC-9 … Pest access, UI reload and unknown ULID · AC-10 … UI steps 1 to 6 · AC-11 … UI reduced line, formatting, 360px · AC-12 … UI empty submit, processing, Vitest · AC-13 … UI declines, conflict, Vitest · AC-14 … UI success navigation · AC-15 … UI confirmation page · AC-16 … UI stock drop · AC-17 … 360px, keyboard, checks, public deploy · AC-18 … Pest lock order, full Pest, concurrency scenario 5
