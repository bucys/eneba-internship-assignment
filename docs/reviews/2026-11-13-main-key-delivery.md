# Review, main (uncommitted), 2026-11-13

**Reviewed by**: Claude Sonnet 5.5 (fresh reviewer; author model not stated)
**Scope**: 27 files (15 modified, 12 new), uncommitted vs main
**Verdict**: Approve with nits

## Summary
Adds an owner-only `GET /orders/{ulid}/keys` endpoint (thin controller, `ShowOrderKeys` action, `OrderItemKeysResource`, `NoStore` middleware), an `id` on order items, and a client reveal/copy/hide flow (`useOrderKeys`, `KeySlot`, `OrderKeys`) with a `gcTime: 0` query. It matches spec 0010 closely and follows project conventions. No correctness or security defects found; only small accessibility and robustness nits.

## Minor
### 🟡 Live-region announcement is not repeated, `client/src/lib/orderKeys.ts:71`
**Problem**: `reveal` sets the announcement to the constant "Key revealed". A second Reveal (after a Hide, or on another slot once codes are loaded) leaves the status text unchanged, so assistive tech will not announce it again. Hide announces nothing.
**Why it matters**: Screen reader users get no feedback for most reveal actions after the first (spec AC-6 expects "Key revealed" announced).
**Suggested fix**: Make the status text change per action (for example include the slot label or a counter), or clear then set it; consider announcing "Key hidden".

### 🟡 Missing entry or short `codes` leaves an inconsistent slot, `client/src/components/orders/OrderKeys.tsx:37` and `client/src/components/orders/KeySlot.tsx:~115`
**Problem**: If the keys response has no entry for an item (or fewer codes than slots), `codes?.[index]` is `undefined` while the hook state is `revealed`. `KeySlot` renders the mask, but the button reads "Reveal key" and a click calls `hide`, so the slot is stuck with no error.
**Why it matters**: The server invariant makes this unlikely, but the failure is silent and unrecoverable without reload.
**Suggested fix**: Treat a revealed slot with no code as an error state ("Could not load your key." with Try again), or fall back to masked state in `slotState`.

## Nits
- ⚪ `server/tests/Feature/Checkout/OrderKeysTest.php:116`, `RateLimiter::clear('account')` does not clear the per-user bucket key and is unnecessary (cache is per test); drop it.
- ⚪ `client/src/lib/orderKeys.ts:54`, after a failure the `pending` set still holds the failed slots until the next reveal replaces it; harmless (masked via `failed`) but easy to misread.

## Strengths
- Server is minimal and correct: owner-scoped `firstOrFail` gives identical 404s, eager-loaded ordered keys (no N+1), codes serialized only in the keys resource, `NoStore` placed first and registered in the priority list so 401/404/429 carry the header.
- Pest tests cover every AC (parity of 404 bodies, no-store per status, limiter sharing with Retry-After, read-only, code-absence leak check), and the concurrency script verifies winner/loser key access against SQL.
- Client keeps codes out of long-lived state (`gcTime: 0`, sibling query key under `me`, keyed `OrderDetails`), uses `aria-disabled` so focus is kept, and has thorough RTL tests for single-fetch, error/retry, copy fallback, hide-reset, and cache lifetime.

## Test coverage
Server: all new branches covered (happy path, leak check, 401/404/429, read-only, bad ULID pattern). Client: unit tests for `keysErrorMessage`, `copyHint`, `keySlotId`, API/query options; page tests for masked state, single fetch, pending clicks, failure/retry, error relocation, ULID change, copy success/timer restart, hide reset, clipboard rejected/missing, unmount drop, sign-out and invalidation. Untested: the missing-entry/short-codes case above and the status-region text after repeated reveals. Tests were read, not executed, in this review.

## Resolution (feature 17, 2026-11-16)

States from [spec 0016](../specs/0016-performance-reliability/rationale.md#closeout-decision-2026-11-16): DONE (resolved or fixed), DEFER (not done, carried as a follow up), SKIP (won't fix).

- Live region not repeated: DONE, a new node per announcement.
- Missing entry leaves a slot stuck: DONE, falls back to masked with an error.
- Nit, unneeded `RateLimiter::clear`: SKIP. Test only, harmless.
- Nit, pending set keeps failed slots: SKIP. Masked through `failed`, harmless.
