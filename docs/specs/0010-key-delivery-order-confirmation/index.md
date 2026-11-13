# 0010. Key delivery: a separate owner only keys endpoint, fetched on the first Reveal, with masked keys and copy on the order page

**Date**: 2026-11-13
**Status**: Accepted

## Summary

This spec lets a buyer see and copy the game keys they paid for. Spec 0009 already gives each paid unit its own key inside the checkout transaction, so nothing here writes to the database. A new `GET /orders/{ulid}/keys` endpoint returns the codes, only to the order's owner, and only when the buyer clicks Reveal on the order page. Until then each key shows as a masked placeholder. A revealed key can be copied or hidden again, and the codes leave browser memory as soon as the buyer leaves the page.

## Requirements

**User stories**:
- As a buyer who just paid, I want to reveal each key I bought and copy it, so that I can redeem the game right away.
- As a buyer, I want keys hidden until I ask for them, so that someone looking at my screen cannot read them.
- As the store, I want codes sent only to the buyer who owns them, and only when asked, so that a leaked page cache or another account never exposes them.

**Acceptance criteria**:
- **AC-1**: `GET /api/v1/orders/{ulid}/keys` (Bearer) for an order the caller owns returns 200 with `{ data: OrderItemKeys[] }`, where each entry is `{ order_item_id: int, codes: string[] }`. There is one entry per order item, ordered by `order_items.id` ascending (the same order as `Order.items`, spec 0009 AC-2). Each `codes` array holds the `product_keys.code` of every key whose `order_item_id` is that item, ordered by `product_keys.id` ascending, so its length equals the item's `quantity` (spec 0009 invariant). The endpoint writes nothing.
- **AC-2**: The keys endpoint answers exactly like `GET /orders/{ulid}` for anyone who is not the owner. A ULID that does not exist and a ULID of another user's order both return the same 404 (Laravel default body), so the response never reveals that an order exists. No token returns 401, and a path that is not 26 lowercase base32 characters (`[0-9a-z]{26}`) returns 404. It uses the `account` limiter (60 per minute per user, shared with `GET /orders/{ulid}`), so exceeding it returns 429 with `Retry-After`.
- **AC-3**: Every keys endpoint response that reaches the route (200, 401, 404 from the order lookup, and 429) carries `Cache-Control` with `no-store`, so no browser or proxy cache keeps codes. A path that fails the ULID pattern never matches the route, so it is a plain 404 without that guarantee (it can never carry a code). `GET /orders/{ulid}` and `POST /checkout` still return no key code anywhere (spec 0009 AC-2 holds), and their `OrderItem` gains one field, `id` (the `order_items.id`), which is the `order_item_id` the keys endpoint uses.
- **AC-4**: Under concurrent purchases a key reaches only its buyer. After spec 0009 concurrency script scenario 4 (two buyers, one last key), the winner's `GET /orders/{ulid}/keys` returns one entry for that offer's item with exactly one code, equal to `SELECT code FROM product_keys WHERE order_item_id = ?`, and the losing buyer's token on the winner's ULID gets 404. Allocation and the stock drop themselves stay as spec 0009 AC-1 and AC-6 already prove them.
- **AC-5**: On `/orders/:ulid`, the page shows "Your keys are ready. Reveal a key to copy it." under the order line. Under each item row it shows `quantity` masked key slots, each with a fixed placeholder `•••••-•••••-•••••` (exposed to assistive tech as "Key hidden") and a "Reveal key" button, followed by "Redeem this key on {platform_name}." (or "Redeem these keys on {platform_name}." when `quantity` is above 1). Loading the page sends no keys request.
- **AC-6**: Each slot has one toggle button whose label switches between "Reveal key" and "Hide key"; it keeps focus across every state change. The first Reveal click on the page fetches the keys endpoint once. While it runs, every slot clicked so far is pending: its button shows a spinner, reads "Revealing…", and has `aria-disabled="true"` (never the `disabled` attribute, so focus stays on it; clicks are ignored). More Reveal clicks during the fetch add their slot to the pending set and send no second request. On success every pending slot shows its code in a `<code>` element (monospace, `select-text`, wrapping on narrow screens) with a "Copy" button after it. Every later Reveal or Hide toggles only its own slot and sends no request. "Hide key" removes the `<code>` element from the DOM (the mask is the fixed placeholder, never derived from the code), removes the Copy button, resets that slot's copy state, and cancels its timer; focus stays on the toggle. Accessible names say which key a button acts on: "Reveal key 2 of 3 for {product_name}" (just "for {product_name}" when `quantity` is 1), and the same pattern for "Hide key" and "Copy key". One page level `role="status"` region, always mounted, announces "Revealing keys…" while a fetch runs, then names the slot each action touched: "Key revealed: {slot}", "Key hidden: {slot}", and "Key copied: {slot}", where {slot} is the accessible name pattern above (for example "Key revealed: key 2 of 3 for {product_name}"). Every Reveal, Hide, and successful Copy is announced, a repeat of the same action on the same slot included: each announcement renders as a new node inside the region. A Reveal that ends in an error announces nothing in the region, because its `role="alert"` message speaks instead.
- **AC-7**: If the keys request fails, every pending slot returns to masked, and the slot clicked last shows an inline danger message under it with `role="alert"`: "Too many requests. Try again in N seconds." for 429 (N is `ApiError.retryAfter`, a fixed number, no countdown), or "Could not load your key." for anything else (a 404 here, the order gone or the account changed, uses this message too), with a "Try again" button. "Try again" fetches again and, on success, reveals that slot. Clicking Reveal on another slot while the error shows does the same and moves the message to that slot. The project default retry policy applies (`shouldRetryQuery`: one retry after 3 s for network errors and 5xx, none for 4xx or timeouts), so "Revealing…" can last about 3 s before a network or 5xx error shows; this is intended. The rest of the page (items, total, other slots) is unaffected. If the keys response succeeds but has no entry for an order item, or fewer codes than its `quantity`, every slot without a code stays masked and shows "This key could not be loaded. Try again or contact support." with a "Try again" button that fetches again. A slot only ever shows its own item's code at its own position, never another item's.
- **AC-8**: "Copy" writes the code with `navigator.clipboard.writeText`. On success the button shows a check icon and reads "Copied" for 2 seconds, then returns to "Copy", and the page status region announces "Key copied: {slot}" (AC-6), on every successful copy. Clicking again within the 2 seconds copies again and restarts the timer.
- **AC-9**: If the clipboard is missing (`navigator.clipboard` undefined) or `writeText` rejects, the code text of that slot is selected in the page and the slot shows a hint: "Key selected. Use your device's copy option." on touch devices (`matchMedia("(pointer: coarse)")`), else "Key selected. Press Ctrl+C to copy." ("Cmd+C" on Apple devices, matched by `/Mac|iPhone|iPad/` on `navigator.userAgent`; an iPad reporting "Macintosh" with a keyboard getting Cmd is accepted). The hint goes away when the slot is hidden or a copy later succeeds.
- **AC-10**: Codes live in browser memory only while the order page is mounted: the keys query (key `["me", "order-keys", ulid]`, a sibling of the order key so no order invalidation ever touches it) has `gcTime: 0`, and unmounting the page is the only thing that drops it; after an error `requested` stays true, so the query stays enabled and observed. Coming back shows every slot masked again and fetches on the first Reveal. Sign out removes it (its key starts with `"me"`), and the guarded route then leaves the page, so no code stays rendered. Reveal state (which slots are open or pending) is local to the page body, which is keyed by the order ULID, so navigating to another order starts fresh; it also resets on reload.
- **AC-11**: Everything works at 360px with no sideways scroll, every new control is keyboard reachable with the global focus ring, every new text and background pair is in the `client/design.md` contrast table (AA), and the new key slot appears on `/ui` in its masked, revealing, revealed, copied, copy fallback, and error states. Client checks (`format:check`, `lint`, `typecheck`, `test`, `build`) and server checks (Pint, PHPStan, Pest) pass locally and in CI, the extended concurrency script passes in CI, and on the public deploy a fresh purchase can reveal, copy, and hide its keys.

## Decision

**Chosen option**: Option 3: A separate owner only keys endpoint, fetched once per page visit on the first Reveal click

Keys never ride on the Order resource; `GET /orders/{ulid}/keys` returns every code of one order, owner scoped like `ShowOrder`, with `Cache-Control: no-store`, and the order page fetches it only on demand, keeps it only while mounted, and reveals one masked key slot at a time.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no schema change, no migration. This feature only reads.

| Table | Read | Notes |
|---|---|---|
| `orders` | `id`, `ulid`, `user_id` | found through `$user->orders()->where('ulid', …)`, so ownership is part of the query |
| `order_items` | `id`, `order_id`, `quantity` | ordered by `id` |
| `product_keys` | `id`, `order_item_id`, `code` | sold keys only (`order_item_id` set); unique `code` and the `(order_item_id IS NULL) = (sold_at IS NULL)` check from spec 0002 |

`ProductKey` keeps `#[Hidden(['code'])]`, so a key model serialized by accident still never leaks a code; the keys resource reads `$key->code` explicitly.

**State transitions**: none on the server. On the client each key slot is `masked → pending → revealed ⇄ masked`, with `pending → masked` on failure (plus the error on the last clicked slot); "pending" exists only while the single page fetch runs, and several slots can be pending at once.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/orders/{ulid}/keys` | GET | path `ulid`: `[0-9a-z]{26}` | 200 `{ data: [{ order_item_id, codes }] }`, header `Cache-Control: no-store` | Bearer, `throttle:account` | 401, 404 (unknown, not owned, bad pattern), 429 |
| `/orders/{ulid}` | GET | unchanged | `Order`, each item now also has `id` | unchanged | unchanged |
| `/checkout` | POST | unchanged | `Order`, each item now also has `id` | unchanged | unchanged |

Server shape (thin controller → action → resource, per `AGENTS.md`):

- Route next to `orders.show`: `Route::get('/orders/{ulid}/keys', [OrderController::class, 'keys'])->where('ulid', '[0-9a-z]{26}')->middleware(['auth:sanctum', 'throttle:account'])->name('orders.keys')`.
- `App\Actions\Orders\ShowOrderKeys::handle(User $user, string $ulid): Collection<int, OrderItem>` runs `$user->orders()->where('ulid', $ulid)->firstOrFail()`, then returns its items ordered by `id` with `keys` eager loaded (`fn ($q) => $q->orderBy('id')->select(['id', 'order_item_id', 'code'])`). Two queries plus the order lookup, no N+1.
- `App\Http\Resources\OrderItemKeysResource` returns `['order_item_id' => $item->id, 'codes' => $item->keys->map(fn (ProductKey $k) => $k->code)->values()->all()]`.
- `OrderController::keys()` returns `OrderItemKeysResource::collection($items)->response()->header('Cache-Control', 'no-store')`. For error responses on this route (404, 429, 401) to carry it too, add a small route middleware `NoStore` (`$response->headers->set('Cache-Control', 'no-store')` after `$next`) attached to this route only and listed first (`->middleware([NoStore::class, 'auth:sanctum', 'throttle:account'])`), and drop the controller header call. Listed first, it wraps auth and throttling; Laravel's routing pipeline turns their exceptions (401, 429) and `firstOrFail` (404) into responses before they return through `NoStore`, so every status gets the header (the Pest test proves it per status). Symfony may append `private`; the test asserts the header contains `no-store`.
- `OrderItemResource` gains `'id' => $item->id` as its first field. Update its doc comment ("No key code appears here until feature 11") to say codes come only from the keys endpoint (spec 0010).

Client shape:

- `api/orders.ts`: `OrderItem` gains `id: number`. New `OrderItemKeys = { order_item_id: number; codes: string[] }`, `getOrderKeys(ulid, signal)` (`apiFetch` GET `/orders/${encodeURIComponent(ulid)}/keys`), `orderKeysQueryKey(ulid)` = `["me", "order-keys", ulid]` (a sibling of `["me", "orders", ulid]`, never a child, so invalidating or removing an order never refetches codes), and `orderKeysQuery(ulid)` with `staleTime: Infinity` and `gcTime: 0` (project default retry policy, AC-7).
- `lib/orderKeys.ts`: `useOrderKeys(ulid)` owns the page's reveal state: `requested` (once true, stays true), a `revealed` set and a `pending` set of slot ids (`${orderItemId}:${index}`), and `lastClicked`, plus `useQuery({ ...orderKeysQuery(ulid), enabled: requested })`. `reveal(slotId)`: if codes are loaded, add to `revealed`; else add to `pending`, set `lastClicked`, and fetch (set `requested`, or `refetch()` when already requested and in error; a no op while a fetch runs). When the query succeeds, move every `pending` slot into `revealed`; when it fails, clear `pending` and attach the error to `lastClicked`. `hide(slotId)` removes from `revealed`. It also exposes `codesFor(orderItemId)` and the status text for the page live region. `keysErrorMessage(error)` maps 429 and everything else per AC-7. `copyHint()` returns the AC-9 text (touch first, then Apple, then Ctrl).
- `components/orders/KeySlot.tsx`: one slot. Props: `label` (for accessible names, for example "key 2 of 3 for Hades"), `code?: string`, `state` (`masked` | `pending` | `revealed`), `error?: string`, `onToggle`, `onRetry`, `onCopied` (tells the page region to announce). One toggle button (Reveal key, Revealing…, Hide key) that keeps focus. Owns the copy state (idle, copied with a 2 second timer, fallback hint); hiding resets it and clears the timer, and so does unmount. A `ref` on the `<code>` element drives the selection fallback (`Range` plus `getSelection().removeAllRanges()` and `addRange`). The `<code>` element exists only when revealed.
- `components/orders/OrderKeys.tsx`: the slot list under one item row, plus the redeem line. Reads slot state and codes from the page hook. Slot count is `item.quantity` before the fetch and `codes.length` after (equal by invariant; the server is the source of truth).
- `OrderItemRow` renders `<OrderKeys>` under its details. `OrderConfirmationPage` renders `<OrderDetails key={order.ulid} …>` so all reveal state resets when the ULID changes, keys the item list by `item.id` instead of the index, adds the intro sentence and the one always mounted `role="status"` region, and calls `useOrderKeys` inside `OrderDetails`.
- Fixtures: add `id` to every order item in `client/src/test/fixtures.ts` and every mocked `Order` in existing checkout and order page tests.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| `GET /orders/{ulid}/keys` | owner check | `$request->user()` plus `$user->orders()` scope; failure is `firstOrFail` 404 |
| `GET /orders/{ulid}/keys` | `order_item_id` | `order_items.id` |
| `GET /orders/{ulid}/keys` | `codes` and their order | `product_keys.code` where `order_item_id` matches, ordered by `product_keys.id` |
| `GET /orders/{ulid}/keys` | entry order | `order_items.id` ascending (spec 0009 AC-2 rule) |
| `GET /orders/{ulid}/keys` | `Cache-Control: no-store` | `NoStore` route middleware |
| `GET /orders/{ulid}`, `POST /checkout` | item `id` | `order_items.id` via `OrderItemResource` |
| Order page | masked slot count before fetch | `OrderItem.quantity` |
| Order page | slot count and code after fetch | the keys entry whose `order_item_id` equals `OrderItem.id`, `codes[index]` |
| Order page | "key N of M for {product}" | slot index + 1, `quantity`, `product_name` snapshot |
| Order page | redeem line platform | `OrderItem.platform_name` snapshot |
| Order page | 429 seconds | `ApiError.retryAfter` from the `Retry-After` header (exposed since spec 0006) |
| Order page | revealed or masked per slot | local React state in `OrderKeys` |
| Copy | text written | the revealed `codes[index]` |
| Copy | which hint text | `matchMedia("(pointer: coarse)")`, then `navigator.userAgent` match, in `copyHint()` |
| Order page | which slots are pending, and where an error shows | `pending` set and `lastClicked` in `useOrderKeys` |
| Order page | live region text | `useOrderKeys` status ("Revealing keys…", "Key revealed: {slot}", "Key hidden: {slot}") and `KeySlot` `onCopied` ("Key copied: {slot}"), one new node per announcement |
| Order page | whether codes are cached | query key `["me", "order-keys", ulid]`, `gcTime: 0` |
| Script scenario 4 | winner `ulid` and item `id` | the winner's checkout response body saved by the helper, read with `jq` (`.data.ulid`, `.data.items[0].id`) |

**Key invariants**:
- A code leaves the server only in a keys endpoint response to the user who owns the order (owner scoped query; no other endpoint serializes a code).
- `codes.length` equals the item's `quantity` for every paid order (spec 0009: an order exists only with every item holding exactly `quantity` sold keys).
- Two orders never share a code (spec 0002 unique `code`, single `order_item_id` column, spec 0009 `SKIP LOCKED` allocation).
- The keys endpoint never writes, so calling it any number of times is safe.
- No code is stored by any HTTP cache (`no-store`), and the page holds it in memory only while mounted.

**Security model**:
- Only the authenticated owner reads codes; a non owner cannot tell a foreign order from a missing one (same 404).
- The ULID in the URL is not a secret and grants nothing on its own; the Bearer token plus ownership does.
- Codes are plain text in the database (spec 0002 consequence, fake seed data). They are never logged: no log call in this feature receives a code, and the Laravel default request logging does not log response bodies.
- The `account` limiter caps scripted reading of one account's keys at 60 per minute; harvesting needs a stolen token, which already exposes the account.
- The masked default and Hide guard against shoulder surfing and screen sharing; they are UX, not access control.
- No compliance scope: keys are digital goods, not payment or personal data.

**Configuration required**: none. No new env vars or credentials.

**Critical test scenarios**:
- Happy path (Pest): a buyer with an order of two items (quantities 1 and 3) calls the keys endpoint; 200, two entries in item id order, `order_item_id` values match `GET /orders/{ulid}` item `id`s, codes match the DB in key id order, lengths 1 and 3, header contains `no-store`, verifies **AC-1**, **AC-3**
- Leak check (Pest): the `POST /checkout` 201 body and the `GET /orders/{ulid}` body contain item `id` and contain none of the order's codes (assert each code string is absent from the raw JSON), verifies **AC-3**
- Auth/permission (Pest): another user's ULID and an unknown ULID both give 404 with identical bodies; no token gives 401; the 401 and both 404s contain `no-store`; an uppercase ULID gives 404 (status only, no header assertion, it never reaches the route); the 61st request in a minute gives 429 with `Retry-After`, verifies **AC-2**, **AC-3**
- Read only (Pest): calling the endpoint twice changes no row (`product_keys` and `orders` counts and `updated_at` unchanged), verifies **AC-1**
- Concurrency (script scenario 4 extension): the winner's keys response has one entry whose `order_item_id` equals the item `id` from its checkout body and equals `SELECT id FROM order_items WHERE order_id = (SELECT id FROM orders WHERE ulid = ?)`, with one code equal to `SELECT code FROM product_keys WHERE order_item_id = ?`; the loser's token on the winner's ULID gets 404, verifies **AC-4**
- Client data (Vitest): `keysErrorMessage` for 429 with seconds, 404, 500, network, timeout; `copyHint` for Apple and other agents; `orderKeysQuery` key starts with `"me"` and has `gcTime: 0`, verifies **AC-7**, **AC-9**, **AC-10**
- Client page (Vitest + Testing Library, mocked fetch): page load sends no keys request; masked slots equal `quantity`; first Reveal sends exactly one request, shows "Revealing…" with `aria-disabled` and keeps focus, then the code; clicking a second slot during the fetch sends no second request and both reveal on success; a later slot's Reveal sends none; Hide removes the `<code>` element and keeps focus on the toggle; a failed fetch masks the pending slots and shows the `role="alert"` message under the last clicked slot, Try again refetches and reveals it; 429 shows the seconds; changing the route ULID resets every slot to masked, verifies **AC-5**, **AC-6**, **AC-7**, **AC-10**
- Copy (Vitest): `writeText` resolving shows "Copied" and announces "Key copied: {slot}" (a second copy of the same key is announced again as a new node), returning to "Copy" after 2 seconds (fake timers); Hide during the 2 seconds resets the state and the timer never fires; `writeText` rejecting and `navigator.clipboard` undefined each select the code and show the hint; `copyHint` returns the touch text when `(pointer: coarse)` matches, verifies **AC-6**, **AC-8**, **AC-9**
- Cache lifetime (Vitest): unmounting the page removes the keys query from the cache; signing out while the keys query is active removes it and no code stays rendered; invalidating `["me", "orders", ulid]` does not refetch the keys query, verifies **AC-10**

## Build plan

Approach: Journey. This finishes the purchase journey's confirmation step end to end (server, then client data, then the page states) so a buyer can pay and redeem before feature 12 reuses the same pieces for order history. No migration.

1. Server: `OrderItemResource` `id` field and doc comment; `ShowOrderKeys` action; `OrderItemKeysResource`; `NoStore` middleware; `orders.keys` route; `OrderController::keys`, satisfies **AC-1**, **AC-2**, **AC-3**
2. Pest tests for the happy path, leak check, auth and 404 parity, `no-store` on every status, limiter, and read only; Pint and PHPStan clean, satisfies **AC-1**, **AC-2**, **AC-3**
3. Extend `scripts/checkout-concurrency.sh` scenario 4: the checkout helper also saves each response body, the winner's `ulid` and item `id` are read with `jq`, then the winner keys check (against SQL) and the loser 404; run 5 rounds locally, satisfies **AC-4**
4. Client data layer: `OrderItem.id` (plus `id` in `src/test/fixtures.ts` and every mocked `Order`), `OrderItemKeys`, `getOrderKeys`, `orderKeysQuery`, `useOrderKeys` with the pending and revealed sets, `keysErrorMessage`, `copyHint`, with Vitest, satisfies **AC-7**, **AC-9**, **AC-10**
5. `KeySlot` and `OrderKeys` components, wired into `OrderItemRow` and `OrderConfirmationPage` (intro line, `item.id` keys, redeem line), with Vitest page, copy, and cache tests, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**
6. Show the slot states on `/ui`; check 360px, keyboard, focus, contrast (add any new pair to `client/design.md`); run all client checks, satisfies **AC-11**
7. Push, confirm CI green (including the concurrency job), deploy, then buy, reveal, copy, and hide on the public URL, satisfies **AC-4**, **AC-11**

## Consequences

**Positive**:
- Codes are sent only when the buyer asks, only to the owner, and are never kept by an HTTP cache or left in browser memory after the page closes.
- The purchase journey is complete: pay, land on the confirmation, reveal, copy, redeem.
- Feature 12 reuses the endpoint, `useOrderKeys`, `OrderKeys`, and `KeySlot` as they are; the order detail there is the same order page.
- No schema change, no new env var, nothing new to operate.

**Negative / tradeoffs**:
- One extra round trip and a "Revealing…" state on the first click, which the inline option would not have.
- Two response shapes share item identity (`Order.items[].id` and `order_item_id`); the client must join them, and a missing entry would show no code.
- Reveals are not recorded, so the store cannot tell whether a buyer ever viewed a key (a real store needs `revealed_at` to deny refunds after reveal).
- `gcTime: 0` means every return to the page fetches again on the first reveal; more requests against the `account` budget, which is ample.
- Codes stay plain text at rest (spec 0002); the README must say a real store encrypts them.

**Neutral**:
- `OrderItemResource` gains `id`, a small public change to `POST /checkout` and `GET /orders/{ulid}`; the client `OrderItem` type, the shared test fixtures, and every mocked order in existing tests must add it.
- `NoStore` is a new route middleware; reuse it on any later endpoint that returns secrets.

## Follow-up

- [ ] `/develop`: confirm in the installed Laravel 13 and Symfony source whether `Cache-Control: no-store` is sent as set or with `private` appended, and keep the test assertion as "contains `no-store`" either way.
- [ ] Feature 12 (order history): reuse `GET /orders/{ulid}/keys`, `useOrderKeys`, and `OrderKeys` on the order detail; the list view should not fetch keys.
- [ ] Submission README (feature 18): state that reveals are not tracked and codes are plain text at rest, and what a real store would do (`revealed_at` to block refunds after reveal, encryption at rest).
