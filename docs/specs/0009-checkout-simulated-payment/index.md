# 0009. Checkout: one locked transaction buys the server cart, allocates keys, and charges a simulated gateway

**Date**: 2026-11-13
**Status**: In Progress

## Summary

This spec builds checkout. A signed in buyer opens `/checkout`, sees what they are about to pay, fills a fake card form, and clicks Pay. The server buys the whole server cart in one database transaction: it checks prices and stock again, writes one paid order with price and name snapshots, gives each unit its own key, asks a simulated payment gateway (a stand in for a real card processor) to charge, and empties the cart. A decline or a changed cart writes nothing, and a retry with the same idempotency key (a one time id per checkout attempt) can never create a second order. Checkout and every cart change of one user take the same per user lock (a database row lock that makes them wait for each other), so a cart edit can never slip in halfway through a payment. Checkout holds that lock once, from the replay lookup through validation to the end of the purchase, so a retry can never slip in between those steps either. On success the buyer lands on a basic order confirmation page; feature 11 adds the key reveal to that page.

## Requirements

**User stories**:
- As a signed in buyer, I want to pay for my cart with a card form so that I get the games I picked.
- As a buyer, I want a declined card to show a clear error and keep my cart so that I can try another card.
- As a buyer, I want to pay exactly the total I was shown so that a price change never surprises me.
- As a buyer who double clicks or retries after a lost connection, I want only one order so that I am never charged twice.
- As a reviewer, I want visible test card numbers so that I can try both a success and a decline without reading docs.

**Acceptance criteria** (the contract):
- **AC-1**: `POST /api/v1/checkout` (Bearer) with a valid card, a valid `Idempotency-Key` header, and `expected_total` equal to the current cart total returns 201 with `{ data: Order }`. In one transaction it writes one `orders` row (`status` `paid`, `total_cents` equal to the sum of its items' `quantity × unit_price_cents`, `currency` `EUR`, the header value as `idempotency_key`, `paid_at` now), one `order_items` row per cart line in cart order (`quantity` is the line's effective quantity from spec 0008 AC-2, `unit_price_cents` is the live `offers.price_cents`, `product_id` copied from the offer, and `product_name`, `platform_name`, `region_name`, `seller_name` copied from the live rows), sets `order_item_id` and `sold_at` (equal to `paid_at`) on exactly `quantity` previously unsold keys of that line's offer, and deletes exactly the `cart_items` rows it bought (the lines read under the per user lock of AC-18; no other cart write can run in between).
- **AC-2**: `Order` is `{ ulid, status, total: Money, paid_at, items }`; each item is `{ product: { slug, cover_image_url }, product_name, platform_name, region_name, seller_name, quantity, unit_price: Money, line_total: Money }`. `paid_at` is ISO 8601 UTC to the second with a `Z` suffix (for example `2026-11-13T10:24:51Z`, from `toIso8601ZuluString()`). `items` are ordered by `order_items.id` ascending, which is cart order, on every endpoint that returns an `Order`. Names and prices come from the order item snapshots, never the live catalog; only `slug` and `cover_image_url` are live. No key `code` appears in any response of this feature.
- **AC-3**: Validation (422, Laravel default shape) runs in two steps. Step one checks only the `Idempotency-Key` header: it must be a UUID, reported on `idempotency_key` ("Missing or invalid idempotency key."). Step two (only when no replay matched, AC-4) is the `CheckoutRequest` body validation. Each field has one message, used for every rule failure on that field (missing, wrong type, wrong format): `card_number` must be a string; with spaces and dashes removed it must be 12 to 19 ASCII digits (`0` to `9` only) and pass the Luhn check ("Enter a valid card number."); `card_expiry` must be a string matching `MM/YY` with month 01 to 12, at most 20 years after the current UTC year ("Enter the expiry date as MM/YY."), and its month must not be before the current UTC month ("This card has expired."); `card_cvc` must be a string of 3 or 4 ASCII digits, whatever the card number ("Enter the 3 or 4 digit security code."); `card_name` must be a string of 1 to 100 characters after trimming ("Enter the name on the card."); `expected_total` must be an integer from 0 to 2147483647 ("Invalid total."). Normalization (removing spaces and dashes, trimming) only touches string values; any other type fails its rule with the field's message.
- **AC-4**: The order of checks, first match wins: (0) the AC-3 header check (422 on `idempotency_key`); (1) the user already has an order with this idempotency key: 200 with that order, nothing written, **before the body is validated**, so a replay succeeds even when its card body is now invalid (for example the card expired since the first attempt), and it waits for a first request with the same key that is still running instead of missing it (AC-6); (2) the AC-3 body validation (422); (3) the cart has no lines: 422 on `cart` "Your cart is empty."; (4) any line is unavailable, or the cart total differs from `expected_total`: 409 `{ message: "Your cart changed. Check the updated total and try again." }`; (5) fewer unsold keys can be locked for a line than its quantity: the same 409; (6) the gateway declines: 422 on `payment` with the gateway's message. Cases 2 to 6 write nothing: no order, no order items, no sold keys, and the cart is left exactly as it was.
- **AC-5**: The simulated gateway declines `4000 0000 0000 0002` with "Your card was declined." and `4000 0000 0000 9995` with "Your card has insufficient funds."; every other number that passes AC-3 is approved. It sits behind a `PaymentGateway` interface, so a real test mode provider can replace it without touching the checkout action.
- **AC-6**: Idempotency and concurrency, proven with parallel HTTP requests against a running server plus database assertions (the concurrency script, *Critical test scenarios*): (a) two or more parallel requests from one user with the same key create exactly one order; exactly one response is 201, every other is 200, and all carry the same `ulid`; (b) a replay sent while the first request is still running waits and returns that order with 200; (c) two parallel checkouts of one user with different keys never both buy the cart: one 201, the other 422 on `cart` (empty), one order in the database; (d) two buyers whose carts both hold the last unsold key of an offer, paying in parallel: exactly one 201 and one 409, the key is sold exactly once, exactly one order item exists for that offer, and the losing buyer's cart is unchanged; (e) after every scenario the AC-1 invariants hold in the database (each item has exactly `quantity` sold keys, `total_cents` equals the sum of its items, no key belongs to two items).
- **AC-7**: Card data is never stored in the database, never written to logs, and never echoed in any response (including 422 bodies). The server logs `checkout.paid` (order `ulid`, user id, total cents) only after the outermost transaction that created a new order commits (`DB::afterCommit`, never on a replay) and `checkout.declined` (user id, decline reason code) on every decline. Nothing else about checkout is logged.
- **AC-8**: `POST /checkout` requires a Bearer token (401 without one), uses a new `checkout` limiter (10 per minute per user id; request 11 gets 429 with `Retry-After`), and is blocked from Vercel preview origins by the existing `BlockPreviewWrites` (403). Prices, quantities, and totals come only from the server; the body carries no lines or prices other than `expected_total`, which is only compared, never charged.
- **AC-9**: `GET /api/v1/orders/{ulid}` (Bearer, `account` limiter) returns 200 with `{ data: Order }` for the owner. An order of another user, an unknown ULID, or a path that does not match the ULID pattern returns 404 (never 403). Without a token it returns 401.
- **AC-10**: The `/checkout` page (still guarded by `requireAuth`) has the `<h1>` "Checkout" and renders from the signed in cart query, which refetches every time the page mounts (`refetchOnMount: "always"`), so a total cached from `/cart` is never what the buyer pays against. While that first load runs it shows a skeleton and the "Waking up the server" notice after 3 seconds (`useSlowPending`, as on the cart page); while any later cart refetch runs (on mount with cached data, or after a 409), the summary stays visible and Pay is disabled; a load error shows `ErrorState` with a working "Try again"; an empty cart shows `EmptyState` "Your cart is empty" with a "Browse games" link to `/`; a cart with `can_checkout: false` shows an Alert "Some items are no longer available." with a "Back to cart" link and no form. The tab title is `Checkout | Eneba Marketplace (demo)`.
- **AC-11**: With a checkoutable cart the page shows an order summary (per line: small cover, product name, platform and region, "Sold by {seller}", quantity × unit price, line total; a reduced line also shows "Only N available, so we lowered the quantity." where N is the line's `quantity`; then "1 item" or "{N} items" from `item_count`, and the total) and a payment form: an info Alert "Demo payment, no real money. Use 4242 4242 4242 4242 to pay, 4000 0000 0000 0002 for a decline, or 4000 0000 0000 9995 for insufficient funds.", then the fields Card number (`inputMode="numeric"`, `autoComplete="cc-number"`, groups of four digits as you type), Expiry (`MM/YY`, `autoComplete="cc-exp"`, the slash added after the month), CVC (`inputMode="numeric"`, `autoComplete="cc-csc"`), and Name on card (`autoComplete="cc-name"`), and a submit button "Pay {total}". At 360px it is one column: summary, then form, then Pay. From `md` the form is on the left and the summary is a sticky panel on the right with the Pay button under the form.
- **AC-12**: On submit the client checks required fields and basic format (card number 12 to 19 digits, expiry `MM/YY` with month 01 to 12, CVC 3 or 4 digits, name not blank) with the AC-3 messages, and focuses the first invalid field without sending. Luhn, expiry in the past, and declines are decided only by the server; server 422 field errors show under their fields and focus the first one. While the request runs, the Pay button shows "Processing payment…" with a spinner, every field is disabled, and further clicks send nothing.
- **AC-13**: Error handling on the page, with card values kept. Form level messages go in one danger Alert above the Pay button; field messages go under their fields: 409 shows the server message in the Alert and refetches the cart so the summary and the Pay label show the new total; 422 `payment` shows its message in the Alert (never under a field); 422 on any of the four card fields shows those messages under the fields; 422 `cart` refetches the cart (the empty state then renders); a 422 with any other key (`idempotency_key`, `expected_total`, or unknown) shows "Payment failed. Please try again." in the Alert; 429 shows "Too many payment attempts. Try again in N seconds." where N is `ApiError.retryAfter` as a fixed number (no countdown); a network error or timeout shows "We could not reach the payment service. Please try again."; any other failure shows "Payment failed. Please try again.". The page creates one idempotency key with `crypto.randomUUID()` when it mounts and sends it on every attempt from that visit; a new key exists only after a remount, and after a 201 or 200 the page is left with `replace`, so a key is never reused for a different cart. `crypto.randomUUID()` needs a secure context (HTTPS or `localhost`), which production and local dev both are; opening dev over a LAN IP on plain HTTP is not supported.
- **AC-14**: On 201 or 200 the client sets the cart cache to the empty cart (so the header badge drops at once) and then invalidates it (marks it stale so the next read refetches; on a 200 replay another tab may have added items since the original order), stores the returned order in the order query cache, invalidates every `["products"]` query, and navigates with `replace` to `/orders/{ulid}`, so Back never returns to a filled payment form. The header badge shows 0 right away.
- **AC-15**: `/orders/:ulid` (guarded by `requireAuth`) has the `<h1>` "Payment successful" and shows "Order {ULID}" (uppercase), the paid date and time in the browser's locale, one row per item (cover, product name linking to `/products/{slug}`, platform and region, "Sold by {seller}", quantity × unit price, line total), the total, and a "Continue shopping" link to `/`. Loading shows a skeleton and the slow notice; a 404 changes the `<h1>` to "Order not found" (a page must not claim a payment it cannot find) and shows an empty state with a link to `/`; any other error keeps the `<h1>` "Payment successful" and shows `ErrorState` with retry. The tab title is `Order confirmed | Eneba Marketplace (demo)`, except on a 404, where it is `Order not found | Eneba Marketplace (demo)`. If the route's `requireAuth` loader fails for a reason other than 401, `OrderErrorBoundary` shows the `<h1>` "Your order" with `ErrorState`.
- **AC-16**: After a real purchase, the product page offer `stock` for each bought offer is lower by the quantity bought, and an offer at 0 moves below every in stock row (carried from spec 0007 verify, Value sourcing: stock).
- **AC-17**: Everything works at 360px with no sideways scroll, every control is keyboard reachable with the global focus ring, every text and background pair is in the `client/design.md` contrast table (AA), and field errors are tied to their inputs (`aria-describedby`, `aria-invalid`). Client checks (`format:check`, `lint`, `typecheck`, `test`, `build`) and server checks (Pint, PHPStan, Pest) pass locally and in CI, and a full purchase (success, then a decline, then a price or stock conflict forced in the dev DB) works locally; a success purchase also works on the public deploy.
- **AC-18**: Checkout and every cart write of one user take the same per user lock (`SELECT … FROM users WHERE id = ? FOR NO KEY UPDATE`, inside a transaction): `AddCartItem`, `UpdateCartItem`, `RemoveCartItem`, `MergeGuestCart`, and checkout. Checkout takes it once in the controller's transaction and keeps it across the AC-4 replay lookup, the body validation, and `PlaceOrder`; with two separate holds, a same key retry could run between them, find no order yet, and fail validation instead of waiting (AC-6 b). A cart write sent while a checkout runs waits until it commits or rolls back, then runs against the result (for example a PATCH after a successful checkout gets 404, an add starts a fresh cart). Every spec 0008 cart behavior and its existing Pest tests stay unchanged. Reads (`GET /cart`, preview) take no lock.

## Decision

**Chosen option**: Option 1: One synchronous, per user locked transaction that buys the server cart, allocates keys, and charges a simulated gateway behind an interface

`POST /checkout` checks the header, then opens one `DB::transaction` that takes the per user lock and keeps it to the end: it answers a replay, validates the body, and runs a `PlaceOrder` action that rebuilds the cart with the existing `BuildCart`, compares it with `expected_total`, writes the order and items, locks unsold keys with `FOR UPDATE SKIP LOCKED`, calls `PaymentGateway::charge`, and deletes the cart. Any failure rolls back everything. The client replaces the checkout placeholder with a real page that uses a TanStack Query mutation, and adds a basic `/orders/:ulid` confirmation page backed by `GET /orders/{ulid}`.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `react-router-data-mode` (`remix-run/agent-skills`, `.claude/skills/react-router-data-mode/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Scope boundary with feature 11**: key allocation happens here, inside the checkout transaction, so a paid order never exists without its keys and stock drops at payment. Feature 11 keeps the key reveal (adding `keys` to the order resource for the owner) and the copy action on `/orders/:ulid`. The allocation race is proven here by the concurrency script.

**Page composition** (design source: `client/design.md` tokens and the existing components, laid out after Eneba's checkout; no Figma or screenshots):

1. **`/checkout`**: `<h1>` "Checkout". From `md`, two columns: left the payment section (demo Alert, form, form level error Alert, Pay button), right a sticky `CheckoutSummary`. Below `md`: summary, then the payment section.
2. **`CheckoutSummary`**: compact line rows (cover thumbnail, name, platform and region, seller, quantity × unit price, line total, reduced note), then "{N} items" and "Total" with `Price`.
3. **`/orders/:ulid`**: `<h1>` "Payment successful", order number and paid time, the item rows, total, "Continue shopping" `LinkButton`.

**Component inventory**:

| Component | New or existing | Notes |
|---|---|---|
| `Button`, `LinkButton`, `TextField`, `Alert`, `Price`, `CoverImage`, `EmptyState`, `ErrorState`, `Skeleton`, `Spinner`, `Container` | existing | used as is |
| `CheckoutPage` | new, `pages/CheckoutPage.tsx` | replaces `CheckoutPlaceholderPage.tsx` (deleted); keeps the `CheckoutErrorBoundary` export for the route |
| `CheckoutSummary`, `CheckoutLineRow`, `CardPaymentForm`, `CheckoutPageSkeleton` | new, `components/checkout/` | no fetching inside; `CardPaymentForm` gets `onSubmit`, `pending`, `fieldErrors`, `formError`, `totalLabel` |
| `OrderConfirmationPage` | new, `pages/OrderConfirmationPage.tsx` | owns the order query and its states, exports `OrderErrorBoundary` |
| `OrderItemRow`, `OrderPageSkeleton` | new, `components/orders/` | feature 11 adds the key list under each row |

**Asset strategy**: covers from `products.cover_image_url` with the existing `CoverImage` placeholder. No new assets.

**Data model sketch**: no migration. Every table and constraint is spec 0002's. What one successful checkout writes:

| Table | Write | Values |
|---|---|---|
| `orders` | insert 1 | `user_id`, `status` `paid`, `total_cents`, `currency` `EUR`, `idempotency_key` (header), `paid_at` ($now); `ulid` generated by `HasUlids` |
| `order_items` | insert 1 per cart line | `order_id`, `offer_id`, `product_id` (from offer), effective `quantity`, `unit_price_cents` (live), four name snapshots |
| `product_keys` | update `quantity` rows per item | `order_item_id`, `sold_at` ($now), only rows with `order_item_id IS NULL` |
| `cart_items` | delete the bought lines | `user_id` and `offer_id IN (bought offer ids)`, read under the per user lock |
| `users` | row lock only, no write | `FOR NO KEY UPDATE` for the transaction (AC-18) |

**State transitions**: Order: none → `paid` (written once, on success only). Key: `available` → `sold` (spec 0002). A decline, a conflict, or an error leaves no trace in the database.

**API surface** (under `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/checkout` | POST | header `Idempotency-Key`: uuid (req); body `card_number`: string (req), `card_expiry`: `MM/YY` (req), `card_cvc`: string (req), `card_name`: string (req), `expected_total`: int cents 0..2147483647 (req) | 201 new or 200 replay, `{ data: Order }` | Bearer, `throttle:checkout`, not preview exempt | in order: 403 preview (`BlockPreviewWrites` is prepended to the `api` group, so it runs before auth and throttling), 401, 429, 422 `idempotency_key`, 200 replay, 422 body, 422 `cart`, 409 cart changed, 409 keys short, 422 `payment` |
| `/orders/{ulid}` | GET | `ulid` path, `where('ulid', '[0-9a-z]{26}')` | 200 `{ data: Order }` | Bearer, `throttle:account` | 401, 404 |

Routes: `checkout.store` and `orders.show`. Limiter in `AppServiceProvider` next to `cart`: `RateLimiter::for('checkout', fn (Request $r) => Limit::perMinute(10)->by($r->user()->id))`.

Server shape:
- `CheckoutController@store(Request $request, FindReplayedOrder $findReplay, PlaceOrder $placeOrder)` takes a plain `Request`, not the Form Request, so the replay can answer before the body is validated:
  1. Validate the header alone: `Validator::make(['idempotency_key' => $request->header('Idempotency-Key')], ['idempotency_key' => ['required', 'string', 'uuid']], [...message])->validate()`.
  2. Open one `DB::transaction` and call `CartLock::forUser($user)` first. Steps 3 to 5 run inside it, so the lock is held from the replay lookup until the purchase commits or rolls back.
  3. `$findReplay->handle($user, $key)` looks up `$user->orders()->where('idempotency_key', $key)->first()`. Its own `DB::transaction` and `CartLock` call become a savepoint (a nested transaction marker) and a lock this transaction already holds, so they cost nothing here and keep the action safe when called alone. A first request with this key that is still running holds the lock until it commits, so this lookup waits and then finds its order. Found → `OrderResource` with 200.
  4. Resolve and validate the body: `$checkout = app(CheckoutRequest::class)`, then read `$checkout->expectedTotal()` (int) and `$checkout->card()` (a `CardDetails` with the normalized number and the parsed expiry month and four digit year) (resolving a Form Request from the container runs its validation; confirmed in Laravel 13.42, `FormRequestServiceProvider` calls `validateResolved()` after resolving). A 422 here rolls back the transaction, which wrote nothing.
  5. `$placeOrder->handle(...)` (its transaction is a savepoint inside this one) → `OrderResource` with 201, or 200 when it returns a replay found by its own check.
- `OrderController@show` → `ShowOrder` → `OrderResource`.
- `CheckoutRequest::prepareForValidation()` strips spaces and dashes from `card_number` and trims `card_name` only when each `is_string`; other types are left as they are and fail the `string` rule. Every rule on a field shares that field's single message (set them all in `messages()`, including `required` and `string`, because `ConvertEmptyStringsToNull` turns a blank field into a `required` failure). `card_number` uses `regex:/^[0-9]{12,19}$/` plus a small `Luhn` rule class in `app/Rules/Luhn.php`. The expiry rule parses `(20YY, MM)` and compares with `now('UTC')`: not before the current month, not after the current year plus 20. `expected_total` is `required|integer|min:0|max:2147483647`.
- `App\Support\CartLock::forUser(User $user): void` runs `User::query()->whereKey($user->id)->lock('for no key update')->first()` and must be called inside a transaction (it throws a `LogicException` when `DB::transactionLevel() === 0`, so a caller can never take it without one). `FOR NO KEY UPDATE` (not plain `FOR UPDATE`) because it does not block the `FOR KEY SHARE` lock Postgres takes on `users` for every insert into a table with a `user_id` foreign key. No lock timeout: a waiter waits as long as the holder's transaction, which is short. Wrap `AddCartItem`, `UpdateCartItem`, and `RemoveCartItem` in `DB::transaction` and call it first; `MergeGuestCart` already has a transaction and calls it first inside. `lock()` accepts a raw lock string (confirmed in Laravel 13.42: the Postgres grammar's `compileLock` passes a string through as written).
- `app/Payments/`: `PaymentGateway` interface `charge(int $amountCents, string $currency, #[\SensitiveParameter] CardDetails $card): PaymentResult`; `CardDetails` readonly value object (number, expiry month and year, cvc, name); `PaymentResult` readonly (`approved: bool`, `declineCode: ?string`, `message: ?string`); `SimulatedPaymentGateway` with the two decline numbers as constants (`card_declined`, `insufficient_funds`). Bound in `AppServiceProvider::register()` with `$this->app->bind(PaymentGateway::class, SimulatedPaymentGateway::class)`.
- One custom exception, `app/Exceptions/CartChangedException.php`, with a `render()` that returns 409 and the AC-4 message. The empty cart and the decline are plain `ValidationException::withMessages([...])` (on `cart` and `payment`), so no other exception class is needed.
- `bootstrap/app.php`: add `$exceptions->dontFlash(['card_number', 'card_cvc', 'card_expiry', 'card_name'])` as defence in depth (confirmed in Laravel 13.42 `Foundation\Configuration\Exceptions`).
- `CartChangedException` implements `ShouldntReport`, so a 409 is never written to the log (AC-7). The empty cart and the decline are `ValidationException`s, which Laravel never reports.

`PlaceOrder::handle(User $user, string $idempotencyKey, int $expectedTotal, CardDetails $card): array{order: Order, created: bool}` runs one `DB::transaction` (a savepoint when the controller calls it), in this order:
1. `CartLock::forUser($user)`: checkout and every cart write of this user now wait for each other (AC-18).
2. Check the key again under the lock → return it with `created: false`. Behind the controller this can no longer find anything new (the lock has been held since the replay lookup); it stays so `PlaceOrder` is correct on its own.
3. `$cart = $buildCart->forUser($user)`. No lines → `ValidationException` on `cart`. `! $cart->canCheckout()` or `$cart->totalCents() !== $expectedTotal` → `CartChangedException`.
4. `$now = now()`, captured once and used for `paid_at` and every `sold_at`. It is the time inside the transaction, a few milliseconds before commit; that small difference from spec 0002's "at commit" is a deliberate simplification. Both columns are Laravel `timestamp` with precision 0 (whole seconds; confirmed, `Schema\Builder::$defaultTimePrecision` is 0 in Laravel 13.42). Both writes take the same `$now`, which Laravel serializes as `Y-m-d H:i:s` (dropping the fraction), so the stored values are identical and `sold_at = paid_at` compares equal after a reload. The 201 body formats the in memory `$now` to the second, so it matches a later GET (tested). Create the `Order` with `total_cents = $cart->totalCents()`.
5. For each line in cart order: create the `OrderItem` from `$line->offer` and `$line->quantity`; then `$ids = ProductKey::query()->where('offer_id', $offerId)->whereNull('order_item_id')->orderBy('id')->limit($quantity)->lock('for update skip locked')->pluck('id')`. Fewer ids than `$quantity` → `CartChangedException`. Else `ProductKey::whereIn('id', $ids)->whereNull('order_item_id')->update([...order_item_id, sold_at => $now])` and throw `CartChangedException` if the updated count is not `$quantity`. Laravel 13.42's query builder has no `skipLocked()` method, so the raw lock string sends the Postgres clause `FOR UPDATE SKIP LOCKED` directly. Note: under Postgres READ COMMITTED, `LIMIT … FOR UPDATE SKIP LOCKED` can return fewer rows than exist when a parallel buyer has just locked or sold the first candidates; that 409 is accepted, because the cart refetch then shows the true stock and Pay can be pressed again.
6. `$result = $gateway->charge($order->total_cents, 'EUR', $card)`. Declined → `Log::info('checkout.declined', ['user_id' => …, 'decline_code' => $result->declineCode])`, then throw `ValidationException` on `payment` with `$result->message` (the throw rolls back steps 4 and 5; the log line stays, logs are not transactional).
7. Delete `$user->cartItems()->whereIn('offer_id', $boughtOfferIds)` and throw `LogicException` if the deleted count differs from the number of lines. Under the lock no cart writer can have changed these rows since step 3, so this deletes exactly what was bought.
8. Return `created: true` from the transaction closure. After the closure returns (still inside the controller's transaction), when `created`, register `DB::afterCommit(fn () => Log::info('checkout.paid', ['ulid' => …, 'user_id' => …, 'total_cents' => …]))`. `afterCommit` runs the callback when the outermost transaction commits (the controller's), and never if it rolls back; a plain log call after `PlaceOrder`'s own transaction would run at the savepoint, before the real commit.

There is no `23505` (unique violation) catch: both replay lookups run inside the one lock hold, so a duplicate `(user_id, idempotency_key)` insert cannot happen. If it ever did, the database unique constraint still rejects it with a 500, and no second order exists.

The controller returns `OrderResource` with 201 when `created`, else 200. `OrderResource` is always built from an order loaded through `Order::loadForResource()`, which runs `->load(['items' => fn ($q) => $q->orderBy('id'), 'items.product:id,slug,cover_image_url'])` (`ShowOrder` uses the same eager load), and formats `paid_at` with `$this->paid_at->utc()->toIso8601ZuluString()`.

Response example:

```json
{
  "data": {
    "ulid": "01jcz8m4q7x2v9k3n5r6t8w0yb",
    "status": "paid",
    "total": { "amount": 2994, "currency": "EUR" },
    "paid_at": "2026-11-13T10:24:51Z",
    "items": [
      {
        "product": { "slug": "the-witcher-3-wild-hunt-steam-global", "cover_image_url": "https://…" },
        "product_name": "The Witcher 3: Wild Hunt", "platform_name": "Steam", "region_name": "Global",
        "seller_name": "KeyHub", "quantity": 3,
        "unit_price": { "amount": 998, "currency": "EUR" },
        "line_total": { "amount": 2994, "currency": "EUR" }
      }
    ]
  }
}
```

Client data layer:
- `api/orders.ts`: `Order`, `OrderItem` types mirroring `OrderResource`; `CheckoutInput` (`card_number`, `card_expiry`, `card_cvc`, `card_name`, `expected_total`); `placeOrder(input, idempotencyKey)` (`apiFetch` POST with header `Idempotency-Key`); `getOrder(ulid, signal)`; `orderQuery(ulid)` with key `["me", "orders", ulid]` (so sign out clears it).
- `lib/cardInput.ts`: `formatCardNumber` (digits only, groups of four, max 19 digits), `formatExpiry` (adds the slash after two month digits), `validateCardForm(values)` returning field errors with the AC-3 messages. Vitest beside it.
- `CheckoutPage` reads the cart with `useQuery({ ...cartQueryOptions, refetchOnMount: "always" })` (not `useCart()`, which serves guests too; the route is signed in only). The first load uses `isPending`; `isFetching` after that disables Pay.
- `lib/checkout.ts`: `usePlaceOrder()`, a `useMutation` that holds the idempotency key from `useState(() => crypto.randomUUID())`, and on success runs AC-14 (`setQueryData(CART_KEY, EMPTY_CART)`, `invalidateQueries({ queryKey: CART_KEY })`, `setQueryData(["me", "orders", ulid], order)`, `invalidateQueries({ queryKey: ["products"] })`, `navigate(..., { replace: true })`); on 409 or 422 `cart` it invalidates `CART_KEY`. Only write caches when `authToken.get()` still equals the token the request started with (same rule as `runCartWrite`). `checkoutErrorMessage(error)` returns `{ formError?: string, fieldErrors?: Record<CardField, string> }` per AC-13 (card field keys go to `fieldErrors`; `payment`, 409, 429, network, timeout, and every other key go to `formError`).
- Router: `checkout` uses `CheckoutPage`; new child `{ path: "orders/:ulid", Component: OrderConfirmationPage, ErrorBoundary: OrderErrorBoundary, loader: requireAuth, handle: { requiresAuth: true } }` next to `orders`.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| `POST /checkout` | replay order | `orders` where `user_id` and `idempotency_key` match, looked up before body validation inside the controller's one `CartLock` hold, and again inside `PlaceOrder` |
| `POST /checkout` | lines bought, order | `cart_items` of `$request->user()` ordered by `id`, through `BuildCart::forUser` under `CartLock` |
| `POST /checkout` | cart rows deleted | `offer_id`s of the lines bought (read under the same lock) |
| `POST /checkout` | effective `quantity` per item | `CartLine::$quantity` (spec 0008 AC-2: `min(stored, min(stock, 10))`) |
| `POST /checkout` | `unit_price_cents` | live `offers.price_cents` read inside the transaction |
| `POST /checkout` | `total_cents` | `Cart::totalCents()` (sum of `quantity × unit_price_cents`) |
| `POST /checkout` | conflict check | `expected_total` body field vs `Cart::totalCents()`, plus `Cart::canCheckout()` |
| `POST /checkout` | name snapshots | `products.name`, `platforms.name`, `regions.name`, `sellers.name` via the offer's loaded relations (`BuildCart` loads all four) |
| `POST /checkout` | `product_id` | `offers.product_id` |
| `POST /checkout` | `idempotency_key` | `Idempotency-Key` request header |
| `POST /checkout` | `paid_at`, `sold_at` | one `$now = now()` captured in the transaction (UTC, second precision columns) |
| `POST /checkout` | `checkout.declined` log fields | `$user->id` and `PaymentResult::$declineCode`, logged in `PlaceOrder` |
| `POST /checkout` | `checkout.paid` log fields | the new order's `ulid`, `user_id`, `total_cents`, logged by `DB::afterCommit` (outermost commit) only when `created` |
| `POST /checkout` | `ulid` | generated by `HasUlids` on create (lowercase: confirmed, `newUniqueId()` returns `strtolower(Str::ulid())` in Laravel 13.42; the route pattern `[0-9a-z]{26}` matches it) |
| `POST /checkout` | approve or decline, message | `SimulatedPaymentGateway` from the normalized `card_number` |
| `POST /checkout` | "expired" check month | server `now('UTC')` year and month |
| `POST /checkout` | 201 vs 200 | `created` flag from `PlaceOrder` |
| Order resource | `product.slug`, `product.cover_image_url` | live `products` row via `order_items.product_id` |
| Order resource | names, `unit_price`, `quantity` | `order_items` snapshot columns |
| Order resource | `line_total` | derived: `quantity × unit_price_cents` |
| Order resource | item order | `order_items.id` ascending (eager load constraint) |
| Order resource | `paid_at` text | `orders.paid_at->utc()->toIso8601ZuluString()` |
| Order resource | `total` | `orders.total_cents` |
| `/checkout` page | summary lines, total, Pay label, `can_checkout` | the `["me", "cart"]` query (`GET /cart`, refetched on mount), formatted by `formatPrice` |
| `/checkout` page | "Only N available" N | the line's `quantity` |
| `/checkout` page | "1 item" / "{N} items" | `cart.item_count` |
| `/checkout` page | Pay disabled while refreshing | the cart query's `isFetching` |
| `/checkout` page | `expected_total` sent | `cart.total.amount` currently rendered |
| `/checkout` page | idempotency key | `crypto.randomUUID()` once per page mount |
| `/checkout` page | Retry after seconds | `ApiError.retryAfter` (from `Retry-After`) |
| `/orders/:ulid` | ULID shown | `order.ulid.toUpperCase()` |
| `/orders/:ulid` | `<h1>` text | "Payment successful" for the order, loading, and non 404 errors; "Order not found" for a 404 (`ApiError.status`) |
| `/orders/:ulid` | paid date and time | `order.paid_at` with `Intl.DateTimeFormat` (browser locale and time zone, `dateStyle: "medium"`, `timeStyle: "short"`) |
| Product page after purchase | offer stock | unchanged derivation (spec 0002), now lowered by sold keys |

**Key invariants**:
- An order exists only as `paid`, and only with every item holding exactly `quantity` sold keys (same transaction).
- `orders.total_cents` equals the sum of its items' `quantity × unit_price_cents`, and equals the `expected_total` the buyer saw.
- One idempotency key per user gives at most one order (DB unique plus both lookups under the lock).
- Checkout and every cart write of one user serialize on one `FOR NO KEY UPDATE` lock on their `users` row (`CartLock::forUser`); checkout holds it once from the replay lookup to the end, so neither a cart write nor a same key retry can run between checkout's steps.
- A key is taken only while unsold (`whereNull('order_item_id')` plus `FOR UPDATE SKIP LOCKED`), so two orders never get the same key.
- A failed checkout changes nothing: no order, no sold key, cart unchanged.
- Card details exist only in request memory; nothing persists or logs them.

**Security model**:
- Both endpoints require a Sanctum Bearer token. Checkout acts only on `$request->user()`'s cart; the body cannot name another user, lines, or prices.
- `GET /orders/{ulid}` queries through `$request->user()->orders()`, so another user's order is a 404 and its existence never leaks.
- Card fields are simulated and never stored or logged; `#[\SensitiveParameter]` keeps them out of stack traces; 422 bodies never echo values. No real card data is expected, so there is no PCI scope, but the form treats input as if it were real.
- The `checkout` limiter (10 per minute per user) limits card guessing and runaway retries. Preview origins are blocked (writes).
- Logs carry the order ULID, user id, total, and decline code only.

**Configuration required**: none. No new env variables; the gateway binding is code.

**Critical test scenarios** (Pest against `eneba_test` for everything sequential; the concurrency script for everything parallel; Vitest for client helpers):
- Happy path: a user with two cart lines (one reduced by stock) pays with `4242…`; 201, one order with the right total and snapshots, items in cart order, `paid_at` in `…Z` second format, each item has exactly `quantity` sold keys with `sold_at = paid_at`, the bought cart lines are gone, the product detail stock dropped by the quantities, verifies **AC-1**, **AC-2**, **AC-16**
- `paid_at` round trip: the 201 body's `paid_at` equals the `paid_at` of a later `GET /orders/{ulid}` (the 201 is built from the in memory Carbon, the GET from the stored whole second value), verifies **AC-2**
- `PlaceOrder` alone: called directly (no controller) with a key that already has an order for this user, it returns that order with `created: false` and writes nothing; `FindReplayedOrder` alone finds it too, verifies **AC-4**, **AC-18**
- Replay (sequential): the same key again returns 200 with the same `ulid` and writes nothing new; then the same key with an empty cart and an invalid card body (expired, bad Luhn, missing fields) still returns 200 with that order; a new key with an invalid body gets 422, verifies **AC-3**, **AC-4**
- Cart lock (sequential, Pest): `CartLock::forUser` outside a transaction throws; each cart action and `PlaceOrder` call it (assert with a query log or `DB::listen` that a `for no key update` statement on `users` runs first); all existing spec 0008 Pest tests still pass, verifies **AC-18**
- Declines: `4000 0000 0000 0002` and `4000 0000 0000 9995` each give 422 on `payment` with the right message; no order, keys unsold, cart unchanged, verifies **AC-4**, **AC-5**
- Conflicts: `expected_total` off by one cent gives 409; a line made inactive gives 409; keys short at lock time (bind a test double of `BuildCart` whose line reports `available_keys_count` above the real unsold keys, which stands in for a concurrent buyer taking them) gives 409; each writes nothing, verifies **AC-4**
- Empty cart gives 422 on `cart`, verifies **AC-4**
- Validation dataset: bad Luhn, 11 digits, non ASCII digits, `card_number` as an array or an integer, `13/27`, last month, 21 years ahead, `12`, a 5 digit CVC, blank name, missing or non UUID header, missing `expected_total`, `expected_total` of 2147483648; each gives 422 on the right field with that field's single message, and the response body contains none of the submitted card values, verifies **AC-3**, **AC-7**
- Logging: with `Log::spy()` (or a fake channel), a paid checkout logs `checkout.paid` once, its replay logs nothing, a declined checkout logs `checkout.declined` with the code; no log contains card values, verifies **AC-7**
- Auth/permission: no token gives 401 on both endpoints; user B fetching user A's ULID gets 404; a malformed ULID gets 404; request 11 in a minute gets 429 with `Retry-After`; a request with a preview `Origin` gets 403, verifies **AC-8**, **AC-9**
- Client (Vitest): `formatCardNumber`, `formatExpiry`, `validateCardForm` messages; `checkoutErrorMessage` for 409, 422 card fields, 422 `payment`, 422 `idempotency_key` / `expected_total` / unknown keys, 429 with its seconds, network, timeout, other, verifies **AC-12**, **AC-13**

**Concurrency script** (`scripts/checkout-concurrency.sh`; parallel HTTP plus database assertions, verifies **AC-6**, **AC-18**). Pest cannot prove these: `RefreshDatabase` runs each test inside one wrapping transaction on one connection, so two requests never truly overlap.
- Setup (the script does all of it; you only need Postgres from `docker compose up -d`, PHP, `curl`, `jq`, `uuidgen`):
  - It exports the test environment, which wins over `server/.env`: `DB_URL=` (blank, because `.env` points `DB_URL` at the dev database and a URL beats `DB_DATABASE`), `DB_DATABASE=eneba_test` with the local Postgres credentials, `CACHE_STORE=array` (an in memory cache that lives for one request, so the `register` and `checkout` rate limits never trip across hundreds of scripted requests), and `LOG_CHANNEL=null`.
  - It runs `php artisan migrate:fresh --seed --force` against `eneba_test` (allowed locally; the destructive command guard blocks only production), so dev data is never touched.
  - It starts the server itself with `PHP_CLI_SERVER_WORKERS=8 php -S 127.0.0.1:8001 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php` from `server/public` (Laravel's router script reads the public folder from the working directory), waits for `/up`, and stops it on exit. Not `php artisan serve`: in Laravel 13.42 it passes only a short allow list of env vars (so the `DB_*` overrides never reach the workers) and ignores `PHP_CLI_SERVER_WORKERS` without `--no-reload`. Without workers the built in server answers one request at a time and nothing overlaps.
  - Background requests are tracked per scenario and waited on by id; a bare `wait` would also wait for the server and hang.
  - `ROUNDS` (default 20) and `PORT` (default 8001) can be set from the environment.
- Seed requirement: scenario 4 sells every key of one offer per round and the other scenarios take one or two offers each, so 20 rounds need about 60 buyable offers with at least two unsold keys. The catalog seed has 287 offers. When `pick_offer` finds none, the script must fail with "no offer available" instead of passing an empty id on.
- Failure output: on any failed assertion the script prints the scenario, the round, and the server log (`server.log`), so a 500 is visible.
- Fixtures come only through the public API plus `psql` (`docker compose exec -T postgres psql -U eneba -d eneba_test`, the local credentials from `docker-compose.yml`). Every scenario registers fresh buyers, so no state carries between rounds: register buyers via `/auth/register` to get tokens, fill carts via `/cart/items`, and pick or prepare offers with psql (for "last key": choose an offer and mark all but one of its keys sold by attaching them to an order item of a throwaway order inserted with psql, with `quantity` equal to the keys attached and `total_cents` equal to its item sum, so the database checks and the scenario 6 invariants still hold).
- Requests fire in parallel with `curl … &` and `wait`; each response's status and `data.ulid` go to temp files; assertions run with `jq` and psql `SELECT`s. Any failed assertion exits non zero with the scenario name.
- Scenarios (each repeated 20 rounds with fresh fixtures, because a race may not hit on one try; the invariants must hold every round):
  1. Same user, same key, 5 parallel requests: exactly one 201, four 200, one `ulid` across all; `SELECT count(*) FROM orders WHERE user_id = ? AND idempotency_key = ?` is 1, verifies **AC-6** (a)
  2. Replay while the first is running (deterministic): in one psql session `BEGIN; SELECT id FROM users WHERE id = ? FOR NO KEY UPDATE;` and keep it open. Poll until that lock is held (the psql session shows in `pg_locks` with the `users` row lock granted), then fire request A in the background and poll `pg_stat_activity` until one backend waits with `wait_event_type = 'Lock'`. Then fire request B (same key, with an expired card body), poll until two backends wait, and `COMMIT;`. A gets 201, B gets 200 with A's `ulid`, verifies **AC-6** (b), **AC-4**. Fixed sleeps are not enough: if psql grabs the lock late, A finishes first, B replays normally, and the scenario passes without testing the race. Each poll gives up after 10 s with a failed assertion..
  3. Same user, two different keys in parallel: one 201, one 422 `cart`; one order; cart rows for the user are 0, verifies **AC-6** (c)
  4. Two buyers, one last key, parallel: one 201 and one 409; `SELECT count(*) FROM product_keys WHERE offer_id = ? AND order_item_id IS NOT NULL` rose by exactly 1; one new order item for that offer; the loser's `cart_items` rows are unchanged, verifies **AC-6** (d)
  5. Cart edit during checkout: with the psql user lock held and confirmed as in 2, fire a checkout and poll until it waits on the lock, fire a `PATCH /cart/items/{offerId}` for a bought line and poll until two backends wait, then commit: checkout 201, PATCH 404 (it ran after the line was bought and deleted); with a `POST /cart/items` for a different offer instead, that new line survives the checkout, verifies **AC-18**
  6. After every round, global invariants by SQL: no `product_keys.order_item_id` group exceeds its item's `quantity` and none falls short (`GROUP BY order_item_id` joined to `order_items`); every `orders.total_cents` equals `SUM(quantity * unit_price_cents)` of its items, verifies **AC-6** (e), **AC-1**

## Build plan

Approach: Journey. This is the middle of the purchase journey, so the slice is the whole pay path (server, then client, then the confirmation page it lands on) before feature 11 adds keys to that page. No migration.

1. Add `App\Support\CartLock` and call it first inside a transaction in `AddCartItem`, `UpdateCartItem`, `RemoveCartItem`, and `MergeGuestCart`; keep every spec 0008 Pest test green and add the cart lock tests, satisfies **AC-18**
2. Add `app/Payments/` (`PaymentGateway`, `CardDetails`, `PaymentResult`, `SimulatedPaymentGateway`) and the container binding, with unit tests for approve and both declines, satisfies **AC-5**, **AC-7**
3. Add `app/Rules/Luhn.php` and `CheckoutRequest` (string guarded normalization, rules, one message per field), satisfies **AC-3**
4. Add `CartChangedException` (`ShouldntReport`), `FindReplayedOrder`, and the `PlaceOrder` action exactly as ordered above, plus the `checkout.declined` log, the `checkout.paid` log through `DB::afterCommit`, and `dontFlash`, satisfies **AC-1**, **AC-4**, **AC-6**, **AC-7**
5. Add `OrderResource` and `OrderItemResource` (ordered items, Zulu `paid_at`), `CheckoutController` with the header check, then one transaction holding `CartLock` across replay, body validation, and `PlaceOrder`, the `checkout` limiter, and the `checkout.store` route, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-8**
6. Add `ShowOrder`, `OrderController@show`, and the `orders.show` route with the ULID pattern, satisfies **AC-9**
7. Write the Pest tests from *Critical test scenarios*; run Pint, PHPStan, Pest, satisfies **AC-1** to **AC-9**, **AC-18**
8. Write `scripts/checkout-concurrency.sh` and run it locally until every scenario passes 20 rounds; add its command to root `AGENTS.md` Commands via `/sync`, satisfies **AC-6**, **AC-18**
9. Client data layer: `api/orders.ts`, `lib/cardInput.ts`, `lib/checkout.ts` (`usePlaceOrder`, `checkoutErrorMessage`), with Vitest, satisfies **AC-12**, **AC-13**, **AC-14**
10. `CheckoutPage` with its states and components (`CheckoutSummary`, `CheckoutLineRow`, `CardPaymentForm`, `CheckoutPageSkeleton`), cart refetch on mount and Pay disabled while fetching; delete `CheckoutPlaceholderPage.tsx`; wire the route, satisfies **AC-10**, **AC-11**, **AC-12**, **AC-13**
11. `OrderConfirmationPage` with `OrderItemRow`, `OrderPageSkeleton`, states (the 404 `<h1>` "Order not found"), and the `orders/:ulid` route; success navigation, satisfies **AC-14**, **AC-15**
12. Show the new components on `/ui`; check 360px, keyboard, focus, contrast; run all client checks, satisfies **AC-17**
13. Push, confirm CI is green, deploy, and run a purchase on the public URL; locally run success, decline, and a forced conflict; confirm product page stock dropped, satisfies **AC-16**, **AC-17**

## Consequences

**Positive**:
- A paid order always has its keys and the right total; the database and one transaction guarantee it, not the client.
- Retries, double clicks, and two tabs cannot create a second order or sell a key twice.
- The checkout action does not know the gateway is fake, so a real provider's test mode (a deferred item) is a new class, not a rewrite.
- No schema change; spec 0002's tables already fit.

**Negative / tradeoffs**:
- **This transaction lifecycle only works for a simulated gateway.** The fake charge runs inside the database transaction, while row locks are held. A real payment gateway needs a different lifecycle: a network call must never run inside a database transaction (it can take seconds, time out with an unknown outcome, and cannot be rolled back by `ROLLBACK`). A real integration would (1) in a short transaction, write a `pending` order and reserve its keys, then commit; (2) call the provider outside any transaction, passing our idempotency key so the provider deduplicates retries; (3) in a second short transaction, mark the order `paid` and the keys sold, or `failed` and release the keys; (4) reconcile through the provider's webhooks and a sweep for orders stuck in `pending` (a timeout whose result is unknown must be asked of the provider, never guessed); and (5) refund automatically when a charge succeeds but the order cannot be completed. That needs a widened `orders_status_check`, a reservation expiry, and a webhook endpoint. See rationale.md, *What a real gateway would need*.
- Checkout and every cart write of a user serialize on one row lock, so a cart click during a checkout waits for it (milliseconds here). Every cart action now opens a short transaction.
- Under parallel buyers, `SKIP LOCKED` with `LIMIT` can report a false sellout (409) while unsold keys still exist; the buyer retries after the cart refresh.
- `paid_at` is taken inside the transaction, a few milliseconds before commit, not at the exact commit instant spec 0002 describes.
- Declines and conflicts leave no database record (only a log line), so there is no attempt history.
- A replay returns the stored order even if the new body differs, and even if that body would now fail validation; a strict API would reject a mismatched replay with 422.
- A replay waits for the user lock, so it is as slow as any checkout running for that user at the time.
- Checkout holds the user lock during body validation too. Validation does no I/O (input and output work such as database or network calls), so this adds microseconds, but every checkout of a user, valid or not, now waits for the one before it.
- The concurrency script runs locally, not in CI, and its races are probabilistic except for the scenarios that hold a lock from psql.
- `expected_total` catches price changes but not a same total swap (for example one line up 1 € and another down 1 €); acceptable for this catalog.
- The confirmation page shows no keys until feature 11, so the journey is briefly incomplete.

**Neutral**:
- New folders: `server/app/Payments/`, `server/app/Rules/`, `server/app/Exceptions/`, `client/src/components/checkout/`, `client/src/components/orders/`; new script `scripts/checkout-concurrency.sh`.
- Feature 9's cart actions change (each takes `CartLock`), without any change to their behavior or responses.
- Feature 11 shrinks to the key reveal on `/orders/:ulid` and key fields on the order resource for the owner; the allocation race is already proven here.
- Preview deploys cannot check out (403), so checkout is verified locally and on production.

## Follow-up

- [ ] Feature 11 (key delivery): its scope row still says "Allocate a unique key per purchased unit". Allocation now lives in this spec; when you run `/architect key delivery & order confirmation`, narrow it to the reveal and copy on `/orders/:ulid` and `keys` on `OrderItemResource` (owner only); the "no key sold twice under concurrent purchases" check is scenario 4 of this spec's concurrency script.
- [ ] Feature 12 (order history): reuse `OrderResource`, `OrderItemRow`, and `GET /orders/{ulid}` for the order detail; the list adds `GET /orders` (paginated, `paid_at` desc then `id` desc per spec 0002).
- [ ] Submission README (feature 16): list the test cards, say payment is simulated behind `PaymentGateway`, and note the charge inside the transaction as a conscious simplification.
- [ ] Submission README (feature 16): also explain the real gateway lifecycle (Consequences) as what would change with a payment provider's test mode.
- [ ] Consider running the concurrency script in CI later (a background `php artisan serve` with workers in the server job); local only for now.
- [x] Confirmed against the installed Laravel 13.42 source: `HasUlids` lowercases ULIDs, `Exceptions::dontFlash` exists, `lock()` takes a raw string (used for `for no key update` and `for update skip locked`; there is no `skipLocked()`), resolving a Form Request validates it, `timestamp` columns are precision 0, and the `Illuminate\Contracts\Debug\ShouldntReport` interface exists.
- [ ] Add `scripts/checkout-concurrency.sh` to root `AGENTS.md` Commands via `/sync`.
- [ ] `/develop`: replace the fixed sleeps in scenarios 2 and 5 of `scripts/checkout-concurrency.sh` with the `pg_locks` / `pg_stat_activity` polling described above, make `pick_offer` fail with "no offer available", and print `server.log` on any failure (cross check gaps 1 and 2).
- [ ] `/develop`: on 201 or 200, also `invalidateQueries({ queryKey: CART_KEY })` after setting the empty cart (AC-14), and give the 404 state of `OrderConfirmationPage` the title `Order not found | Eneba Marketplace (demo)` (AC-15). Fix the `OrderErrorBoundary` doc comment, which still says it is shown when `/me` fails; it is shown when the route loader fails.
- [ ] `/test`: add the `paid_at` round trip test and the standalone `PlaceOrder` / `FindReplayedOrder` replay test from *Critical test scenarios*.
