# 0009. Checkout and simulated payment: decision record

## Context

The assignment's core journey ends with "pay" and "receive the digital key". Payment may be simulated, but the reviewers will judge whether the backend behaves correctly: one payment makes one order, a decline changes nothing, and two buyers never get the same key. Spec 0002 already shaped the tables for this: an order is written only as `paid`, `orders` has a unique (`user_id`, `idempotency_key`), each order item gets exactly `quantity` keys, and declines leave no row. Spec 0008 built the cart, with the rule that checkout must check stock again and that the server, not the browser, owns every price and total.

The forces are correctness under retries and concurrency (double clicks, a lost response on a slow Render cold start, two tabs, two buyers racing for the last key), price honesty (prices are live, so the total the buyer saw can drift before they pay), and keeping card data out of storage and logs even though it is fake. The feature is tagged Beta, so it gets `/test` on top of `/check verify`.

Constraints: Laravel 13 API with Postgres 17, a React SPA on a free tier host with cold starts, a 3 to 4 day budget, and a developer who must explain every line. There is no queue worker and no webhook receiver, and none is wanted. A real payment provider's test mode is deferred, but the design should not block it.

Not deciding this leaves feature 10 unbuildable and feature 11 without the orders it allocates into, which stalls the whole purchase journey.

## Options considered

### Option 1: One synchronous, per user locked transaction with a gateway interface

`POST /checkout` locks the user row, rebuilds the server cart, compares it with the total the buyer saw, writes the order and items, locks unsold keys with `FOR UPDATE SKIP LOCKED`, calls an in memory `SimulatedPaymentGateway` behind a `PaymentGateway` interface, and deletes the cart, all in one transaction. The idempotency key comes in a header.

**Pros**:
- Every failure rolls back everything; there is no partial state to clean up.
- Reuses `BuildCart`, so cart rules exist in one place.
- No new tables, states, workers, or env variables.
- The interface leaves room for a real test mode provider.

**Cons**:
- Holding a transaction open around a charge only works because the charge is in memory; a real provider needs a different flow.
- The user row lock serializes one user's checkouts.

### Option 2: Pending order state machine (pending, then paid or failed)

Checkout first writes a `pending` order and reserves keys, then charges, then flips the order to `paid` or `failed` and releases keys. This mirrors how a real provider with webhooks works.

**Pros**:
- Realistic; the charge happens outside the database lock.
- Records failed attempts.

**Cons**:
- Needs a migration widening `orders_status_check`, a reservation expiry, and cleanup for abandoned pending orders.
- More states to test and explain, for no benefit while payment is simulated.
- Conflicts with spec 0002's "orders are written only as paid".

### Option 3: Payment decided in the browser

The client decides success or decline from the card number and the server only creates the order when told "paid".

**Pros**:
- Smallest server change.

**Cons**:
- The server trusts a flag the client controls; anyone can "pay" with any card.
- Weak story for a backend correctness review.

## Rationale

Option 1 fits the forces best. The reviewers care about correct backend behavior under retries and races, and a single transaction plus a row lock plus `SKIP LOCKED` gives exactly the guarantees spec 0002 promised ("a paid order always has its keys", "one key per user gives at most one order") with tools the developer can explain line by line. Because the gateway is in memory, keeping the charge inside the transaction costs nothing and makes a decline a plain rollback.

Option 2 is how you would build this against a real provider, and the `PaymentGateway` interface keeps that path open, but adding pending orders, reservations, and cleanup now spends the time budget on states that never happen with a simulated gateway. Option 3 fails the core requirement that the server owns payment.

Smaller calls made while writing the spec (several were tightened after an independent cross check):
- **Serialize per user with `FOR NO KEY UPDATE` on the `users` row, shared by checkout and every cart write** (runner up: `pg_advisory_xact_lock(user_id)`). Plain `FOR UPDATE` was the first draft, but in Postgres it conflicts with the `FOR KEY SHARE` lock that every insert into a table with a `user_id` foreign key takes, so it would block unrelated inserts; `FOR NO KEY UPDATE` gives the same mutual exclusion between our own lockers without that. The advisory lock would also work but is an invisible, Postgres only function call that a reader has to know about.
- **Cart writes take the same lock** (runner up: a conditional delete that removes a cart line only if its `id` and `quantity` still match what checkout read). The conditional delete leaves an ambiguous outcome when the buyer adds to a line during payment (they paid for the old quantity, and a line with a summed quantity remains). Making every writer take one lock gives each write a clear before or after relation to the checkout and costs one short transaction per cart click.
- **Replay before body validation, under the same lock** (runner up: validate everything first, then look up the replay). Strong idempotency means a retry gets the original result even if its body would now fail (for example the card expired in between). Taking the lock for the lookup also makes a replay that races a still running first request wait for it instead of starting a second checkout.
- **One lock hold for the whole checkout, not two** (changed during the build; the first draft took the lock in a short replay transaction and again in `PlaceOrder`). Concurrency scenario 2 failed against the first draft. Request A took the lock for its lookup, found nothing, and released it. Request B, already queued on the lock, ran its lookup before A's `PlaceOrder` could lock again, found no order yet, and returned 422 for its expired card instead of A's order. Postgres hands a released row lock to the waiter already in line, so this was the normal outcome, not a rare race. The fix keeps the lock from the lookup to the commit: the controller opens one transaction, takes `CartLock`, and runs the lookup, the body validation, and `PlaceOrder` inside it. `FindReplayedOrder` and `PlaceOrder` keep their own transaction and lock calls, which become free savepoints, so each is still correct when called alone. Runner up: merge the lookup and validation into `PlaceOrder` behind a validation callback; rejected because it moves HTTP validation timing into a domain action and is harder to explain. Cost: the lock is also held during validation, which does no I/O.
- **`checkout.paid` through `DB::afterCommit`** (runner up: log right after `PlaceOrder`'s transaction returns). Once `PlaceOrder` runs inside the controller's transaction, its own transaction is only a savepoint, so a log line after it would claim a commit that has not happened yet. `afterCommit` fires on the outermost commit and never on a rollback, which is exactly AC-7. It also works in Pest, because Laravel's test transaction manager treats the `RefreshDatabase` wrapper as the outer level.
- **`CartChangedException` implements `ShouldntReport`** (runner up: a `report()` method). A `report()` that returns `false` makes Laravel fall back to its default logging, so it would not keep the 409 out of the log; the marker interface does.
- **No unique violation (`23505`) catch** (runner up: keep it as a safety net). With both lookups under the lock the duplicate insert cannot happen, a catch would be untestable dead code, and the database unique constraint still guarantees no second order if a bug ever bypassed the lock.
- **Concurrency is proven by a script with parallel HTTP requests and SQL assertions** (runner up: Pest). Pest's `RefreshDatabase` wraps each test in one transaction on one connection, so two requests can never overlap there; only a real server with several workers and a separate database session can show the locks working.
- **Charge after allocating keys, inside the transaction** (runner up: charge before the transaction). Allocating first means a buyer is never "charged" for keys that turn out to be gone; with a fake gateway the rollback is free. This is only right for an in memory gateway; see below.
- **Replay returns the stored order regardless of the body** (runner up: 422 on a mismatched replay, as Stripe does). The client always resends the same body, so strict matching adds code with no user benefit here.
- **TanStack Query `useMutation` for Pay** (runner up: a React Router route action). The cart already writes through TanStack mutations and cache updates, and the idempotency key lives naturally in component state.
- **Log `checkout.paid` and `checkout.declined` with ids only** (runner up: an attempts table). Money mutations deserve a trail; a log line is enough for simulated payments and keeps the schema unchanged.
- **`#[\SensitiveParameter]` on the card argument plus `dontFlash`**. Cheap defence that keeps card values out of stack traces and any flashed input.
- **ULID route pattern `[0-9a-z]{26}`**. Laravel's `HasUlids` stores lowercase ULIDs (confirmed in Laravel 13.42), so an uppercase ULID in the URL is a 404.
- **`lock('for update skip locked')` instead of `lockForUpdate()->skipLocked()`**. The draft assumed a `skipLocked()` builder method; Laravel 13.42 has none. `lock()` passes a string straight into the Postgres SQL, so the raw string sends the same `FOR UPDATE SKIP LOCKED` clause. Runner up: a raw `DB::select`; rejected because the builder keeps the query readable and typed.
- **The concurrency script starts its own `php -S` server** (runner up: `php artisan serve`, as the draft said). In Laravel 13.42 `artisan serve` passes only a short allow list of env vars to its workers, so the `eneba_test` overrides never arrive, and it ignores `PHP_CLI_SERVER_WORKERS` without `--no-reload`. Starting `php -S` from `server/public` with Laravel's router script gives real parallel workers that read the script's env. `DB_URL` must be blanked because `server/.env` sets it and a URL beats `DB_DATABASE`. `CACHE_STORE=array` makes every request start with an empty cache, so the rate limits never block the hundreds of scripted requests; the limits themselves are covered in Pest.
- **Concurrency scenarios that hold the lock from psql poll the database instead of sleeping** (found by the cross check; runner up: longer sleeps). A fixed sleep cannot prove the order of events: if `docker compose exec psql` takes the lock late, the first request finishes alone and the replay passes without any race. Polling `pg_locks` and `pg_stat_activity` (`wait_event_type = 'Lock'`) until each request is really waiting turns a timing hope into a checked fact, at the cost of a few more SQL calls per round. Scenario 2 did catch the two lock bug once with sleeps, which shows the race is real, but a pass with sleeps alone is not proof.
- **Keep `PlaceOrder`'s own replay check and lock, and test them alone** (runner up from the cross check: drop them and have `PlaceOrder` only assert it runs inside a transaction). Behind the controller they can no longer find anything new, so they look like the `23505` catch that was dropped as dead code. The difference is that these are cheap to test directly (call the action with a key that already has an order), and they keep the action safe for any future caller, such as a console command or a queued retry. The unique violation catch could only be reached by bypassing the lock, which no test can arrange.
- **On a 200 replay the client still empties the cart cache, then invalidates it** (runner up: leave the cache alone on 200). Setting it empty keeps the header badge honest the moment payment succeeds; invalidating it right after makes the next read fetch the real cart, which matters when another tab added items after the original order.
- **A 404 on `/orders/:ulid` changes the `<h1>` to "Order not found"** (runner up: always "Payment successful", as AC-15 first read). A page reached by a mistyped or foreign link must not announce a payment it cannot find. Loading and other errors keep "Payment successful", because the normal way in is right after a real payment, with the order already in the cache. The tab title follows the same rule: `Order not found | …` on a 404.
- **A false sellout under parallel buyers is accepted.** `LIMIT … FOR UPDATE SKIP LOCKED` under READ COMMITTED may return fewer rows than exist when the first candidates were just taken; the 409 plus cart refresh is a correct, recoverable outcome, and avoiding it would mean retry loops inside the transaction.

### What a real gateway would need

The single transaction is right only because `SimulatedPaymentGateway` is an in memory function. A real provider changes the lifecycle, and the `PaymentGateway` interface is where that change would start:

1. **Never call the network inside a database transaction.** A provider call can take seconds, holds every row lock for that long, and its effect (money moved) cannot be undone by a database rollback.
2. **Reserve, then charge, then settle.** A short first transaction writes a `pending` order and reserves its keys, then commits. The provider is called outside any transaction. A second short transaction marks the order `paid` and the keys sold, or marks it `failed` and releases the keys. This needs `pending` and `failed` added to `orders_status_check` and a reservation expiry so abandoned reservations free their keys.
3. **Pass our idempotency key to the provider**, so a retry after a lost response is deduplicated on their side too.
4. **Treat a timeout as unknown, not as a decline.** The order stays `pending` and is resolved by asking the provider or by its webhook, never by guessing.
5. **Webhooks and a reconciliation sweep** for orders stuck in `pending`, and an automatic refund when a charge succeeded but the order cannot be completed (for example the reservation expired).
6. **Prefer authorize then capture** where the provider supports it: authorize the amount, settle the order, then capture, so a failure after authorization releases the hold instead of needing a refund.

None of this is built now because no real money or provider is involved; it is recorded so the README and a future test mode integration (a deferred scope item) start from the right shape.
