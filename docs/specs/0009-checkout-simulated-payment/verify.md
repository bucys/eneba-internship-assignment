# Verify: Checkout & simulated payment · spec 0009 · updated 2026-11-13
_Steps derived from spec 0009 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Setup for the UI steps: `docker compose up -d`, `php artisan serve` in `server/`, `npm run dev` in `client/`, a signed in buyer with two offers in the cart.

## UI / manual
- [x] Open `/checkout` signed out → redirected to `/login`; sign in → back on `/checkout` → AC-10
- [x] Open `/checkout` with a cart → `<h1>` "Checkout", tab title `Checkout | Eneba Marketplace (demo)`, the cart is refetched on mount (network tab shows `GET /cart`) → AC-10
- [x] Change a price in the DB, open `/cart` (cached), then `/checkout` → the summary and Pay label show the new total, not the cached one → AC-10
- [x] Slow the network (throttle) and open `/checkout` with an empty cache → skeleton, then "Waking up the server" after 3 seconds → AC-10
- [x] Empty cart → "Your cart is empty" with "Browse games" to `/`; an inactive offer in the cart → "Some items are no longer available." with "Back to cart", no form → AC-10
- [x] Stop the API and open `/checkout` → `ErrorState`; start it, click "Try again" → the page loads → AC-10
- [x] A line reduced by stock shows "Only N available, so we lowered the quantity." with N the line quantity; "1 item" / "N items" from `item_count` → AC-11
- [x] Type `4242424242424242` → "4242 4242 4242 4242"; type `1229` in Expiry → "12/29" → AC-11
- [x] Click Pay with empty fields → four messages under the fields, focus on Card number, no request sent → AC-12
- [x] Pay with `4000 0000 0000 0002` → "Your card was declined." in the alert above Pay, card values kept, cart unchanged → AC-4, AC-5, AC-13
- [x] Pay with `4000 0000 0000 9995` → "Your card has insufficient funds." → AC-5, AC-13
- [x] Pay with `4242 4242 4242 4241` (bad Luhn) → "Enter a valid card number." under the field, focus moves there → AC-3, AC-12, AC-13
- [x] Pay with an expiry of last month → "This card has expired." under Expiry → AC-3, AC-13
- [x] Raise an offer price by 1 cent in the DB, then Pay → "Your cart changed…" alert, the summary and Pay label update, Pay again succeeds → AC-4, AC-13
- [x] While paying, the button reads "Processing payment…" with a spinner and the fields are disabled; double clicking sends one request → AC-12
- [x] Successful pay → `/orders/{ulid}`, header badge 0 at once, Back goes to the page before checkout (not the form) → AC-14
- [x] Confirmation page: `<h1>` "Payment successful", "Order {ULID}" uppercase, paid time in the browser locale, one row per item with a link to `/products/{slug}`, total, "Continue shopping" → AC-15
- [x] Reload the confirmation page → same content from `GET /orders/{ulid}`; an unknown ULID → "Order not found" with a link to `/` → AC-9, AC-15
- [x] After a purchase, the product page offer stock dropped by the quantity bought; an offer at 0 sorts below every in stock row → AC-16
- [x] At 360px: one column (summary, form, Pay), no sideways scroll; from `md`: form left, sticky summary right → AC-11, AC-17
- [x] Keyboard only: Tab through every field and Pay with the focus ring, Enter submits; field errors are linked with `aria-describedby` and `aria-invalid` → AC-17
- [x] Run a success purchase on the public deploy → AC-17

## Commands
- [x] `cd server && php artisan test --compact tests/Feature/Checkout tests/Unit/Payments` → all pass → AC-1 to AC-5, AC-7 to AC-9, AC-18
- [x] `cd server && php artisan test` → every spec 0008 cart test still passes with the lock → AC-18
- [x] `scripts/checkout-concurrency.sh` → "All scenarios passed 20 rounds." → AC-6, AC-18
- [x] `cd client && npx vitest run src/lib/cardInput.test.ts src/lib/checkout.test.ts` → all pass → AC-12, AC-13
- [x] `curl -X POST $API/checkout` without a token → 401; 11 requests in a minute → 429 with `Retry-After`; with a preview `Origin` → 403 → AC-8
- [x] Grep the server log after a paid, replayed, and declined checkout → exactly one `checkout.paid` and one `checkout.declined`, no card values → AC-7
- [x] Client and server checks pass locally and in CI → AC-17

## Value sourcing
- [x] Replay order: repeat a paid request with the same `Idempotency-Key` and an expired card body → 200 with the same `ulid` (source: `orders` by user and key, under the lock)
- [x] Lines bought: add a line in a second tab while paying → the checkout buys only what it read under the lock; the new line survives (concurrency scenario 5)
- [x] Cart rows deleted: after paying, only the bought `offer_id`s are gone from `cart_items`
- [x] Effective quantity: a stored quantity of 5 with stock 3 → `order_items.quantity` is 3
- [x] `unit_price_cents`: change the price after the cart loads but send the new `expected_total` → the order uses the live price, not the cart page's
- [x] `total_cents`: equals the sum of the items' `quantity × unit_price_cents` (concurrency invariants)
- [x] Conflict check: `expected_total` off by one cent → 409
- [x] Name snapshots: rename the product after paying → the order still shows the old name (Pest `CheckoutTest`: "keeps every name snapshot but shows the live slug and cover after the catalog changes" renames the product, platform, region and seller)
- [x] `product_id`: `order_items.product_id` equals `offers.product_id`
- [x] `idempotency_key`: the stored key equals the header value
- [x] `paid_at` / `sold_at`: every sold key's `sold_at` equals the order's `paid_at`
- [x] `checkout.declined` fields: `user_id` and `decline_code` (`card_declined` or `insufficient_funds`) only
- [x] `checkout.paid` fields: `ulid`, `user_id`, `total_cents`, logged only after commit, never on a replay
- [x] `ulid`: lowercase 26 characters; an uppercase ULID in the URL → 404
- [x] Approve or decline: spaces or dashes in a decline number still decline (normalized number)
- [x] Expired month: set the clock to the 1st of a month in UTC (or a time zone ahead of UTC) and pay with that month → accepted; the month before → expired (Pest `CheckoutValidationTest`: "compares the expiry month in UTC at the month boundary", frozen clock at 00:00 on the 1st, 23:59:59 on the last day, and 23:30 UTC before a new month)
- [x] 201 vs 200: first request 201, its replay 200
- [x] Live `slug` and cover: change the product cover → the order page shows the new cover, old name (Pest `CheckoutTest`, same test as Name snapshots)
- [x] Item order: items follow cart order (`order_items.id` ascending)
- [x] `paid_at` text: ends in `Z`, second precision
- [x] `/checkout` `expected_total` sent: the request body total equals the total on screen
- [x] Idempotency key: one per page visit (same key on a retry after a decline; a new one after reopening the page) (Vitest `CheckoutPage.test.tsx`: "retries with the same key" and "uses a new idempotency key after the page is opened again")
- [x] Retry after seconds: a 429 shows "Try again in N seconds." with N from `Retry-After`
- [ ] Paid date: change the browser locale or time zone → the date format and hour follow it (manual only, still open: jsdom cannot switch the browser locale or time zone. `OrderConfirmationPage.test.tsx` only checks the `<time datetime>` UTC value; check the visible text by hand in a real browser)

## Acceptance-criteria coverage
- AC-1 … Pest happy path, concurrency invariants, Value sourcing rows · AC-2 … Pest happy path and snapshot test · AC-3 … Pest validation dataset, UI bad Luhn and expired · AC-4 … Pest order, decline, conflict, empty, replay · AC-5 … Pest and Unit gateway, UI declines · AC-6 … concurrency script · AC-7 … Pest logging, log grep · AC-8 … Pest access, curl · AC-9 … Pest access, UI reload and unknown ULID · AC-10 … UI steps 1 to 6 · AC-11 … UI reduced line, formatting, 360px · AC-12 … UI empty submit, processing, Vitest · AC-13 … UI declines, conflict, Vitest · AC-14 … UI success navigation · AC-15 … UI confirmation page · AC-16 … UI stock drop · AC-17 … 360px, keyboard, checks, public deploy · AC-18 … Pest lock order, full Pest, concurrency scenario 5
