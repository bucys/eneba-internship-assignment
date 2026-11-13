# Review, main (checkout commits 0904617 and b812025), 2026-11-13

**Reviewed by**: reviewer subagent (author on a different model)
**Scope**: 50 files, branch vs c67054f
**Verdict**: Approve with nits

## Summary
This change adds checkout with a simulated card payment, an idempotent order create, a per user cart lock that every cart write now takes, order lookup by ULID, and the client checkout and confirmation pages. The server logic is careful and I found no way to create two orders for one key, oversell a key, leak another user's order, or store card data. The issues I found are small: a stuck screen in one rare client path, concurrency proof that lives outside CI, and some structure choices in the controller.

## Minor
### 🟡 Concurrency guarantees are only proven by a manual script, `scripts/checkout-concurrency.sh:1`
**Problem**: The exactly once and no oversell guarantees (AC-6, AC-18) depend on real parallel connections. Pest cannot do this under RefreshDatabase, so the proof is a shell script that is not run in `.github/workflows/ci.yml`.
**Why it matters**: A later refactor of `CartLock`, `PlaceOrder` or the controller transaction could break the guarantee and CI would stay green. CartLockTest only checks that the lock query comes before the cart query.
**Suggested fix**: Either run the script in CI against the Postgres service with a small ROUNDS value, or add a note in verify.md that it must be run before each release.

### 🟡 Success path can leave the form locked forever, `client/src/lib/checkout.ts:89`
**Problem**: `onSuccess` returns early when the token changed (sign out or account switch mid request). The mutation is then in the success state, and `CheckoutPage.tsx:88` keeps the form pending while `isSuccess` is true, with no navigation.
**Why it matters**: The user sees "Processing payment" with no way out until they reload. The order exists on the server. Rare, but it is a dead end.
**Suggested fix**: In that branch, skip the cache writes but still let the page leave the pending state (or navigate to the sign in page), and cover it with a test.

### 🟡 Payment charge runs inside the order transaction while holding key row locks, `server/app/Actions/Checkout/PlaceOrder.php:73`
**Problem**: The gateway call happens after keys are locked and the user lock is held.
**Why it matters**: With the simulated gateway this is instant, and the spec records it as a known consequence. It becomes a real problem the moment a network gateway is bound. The docblock warns about it, which is good, but the interface itself does not enforce it.
**Suggested fix**: Keep as is for the demo. If a real gateway is ever added, move the charge out of the transaction with a pending order state.

### 🟡 Controller carries business orchestration, `server/app/Http/Controllers/CheckoutController.php:34`
**Problem**: The controller opens the transaction, takes the lock, calls the replay lookup, and resolves `CheckoutRequest` with `app(...)` to trigger validation late. This departs from the thin controller, Form Request, action rule. The lock is also taken three times in one request (controller, FindReplayedOrder, PlaceOrder) and the replay lookup is done twice.
**Why it matters**: It works and the reasons are documented, but it is easy to misread and the duplicate lookups hide which layer owns the guarantee.
**Suggested fix**: Consider one `CheckoutOrder` action that owns the transaction, lock, replay check and the call to validate, so the controller only maps input to the action and the result to a status code.

### 🟡 No component level tests for the checkout and confirmation pages, `client/src/pages/CheckoutPage.tsx:20`
**Problem**: Only the pure helpers in `lib/cardInput` and `lib/checkout` are tested. The page state logic (paidCart, pending while success, disabled while the cart refetches, 404 versus error on the order page) has no tests. React Testing Library is not installed yet.
**Why it matters**: The client states are a stated focus of this feature, and the bug above sits in exactly this untested layer.
**Suggested fix**: Add RTL, then cover submit once, error then retry with the same key, and the order page 404 and error states.

## Nits
- ⚪ `client/src/pages/OrderConfirmationPage.tsx:95`, a failed load of an order still shows the heading "Payment successful", and the title says "Order confirmed" in the 404 state too.
- ⚪ `client/src/pages/OrderConfirmationPage.tsx:54`, list key is the array index; the order items have no id, so this is fine today but fragile if items are ever reordered.
- ⚪ `server/tests/Pest.php:53`, leftover scaffold `something()` helper and `toBeOne` expectation.
- ⚪ `server/app/Actions/Checkout/PlaceOrder.php:96`, the afterCommit log closure is registered after the inner transaction returns; correct, but a short comment on why would save the next reader a trace.

## Strengths
- Idempotency is solid: unique index on user and key, replay checked under the same lock before body validation, same key from another user does not replay, and the decline, 409 and empty cart paths all roll back and are asserted with an expectNothingWritten helper.
- Key allocation uses FOR UPDATE SKIP LOCKED with an exact count check and a second count check on the update, so a short read becomes a clean 409 and never a partial order.
- The lock is FOR NO KEY UPDATE and is applied to every cart write too, with a runtime guard that it only runs inside a transaction.
- Money stays integer cents end to end, order items are price and name snapshots, and the client only sends the expected total for comparison.
- Orders are read through the user's own relation, so another user's order is a 404; card fields are marked sensitive, excluded from flash, and never logged, with a test for the log lines.
- Client error mapping covers network, timeout, 409, 429 with Retry-After, and per field 422, with one idempotency key per page visit.

## Test coverage
Server coverage is strong for the focus areas: happy path with snapshots and sold keys, replay with a bad body or empty cart, cross user replay, declines, each 409 cause including the short key read, validation per field with no value echo, access and ownership, throttle, preview block, lock ordering for every cart action, Luhn and gateway units. Gaps: real parallel behavior is only covered by the manual script, no test where the gateway throws an unexpected exception, and no client component tests (RTL not installed). Client helper logic (card formatting, validation, error mapping) is tested.
