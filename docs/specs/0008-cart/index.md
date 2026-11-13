# 0008. Cart: localStorage guest cart, server cart for signed in buyers, one shared cart shape

**Date**: 2026-11-12
**Status**: Accepted

## Summary

This spec builds the cart. A guest keeps a small list of offer ids and quantities in the browser (`localStorage`). A signed in buyer keeps the same list in the existing `cart_items` table. Both kinds of cart are shown through one server built cart shape, which always has live prices, stock, totals, and a status per line, so the browser never does money math. On sign in, the guest list merges into the account (quantities add up, then get capped), and the cart page's Checkout button leads into the sign in flow and a guarded checkout placeholder that feature 10 replaces.

## Requirements

**User stories**:
- As a guest, I want to add a seller's offer to a cart that survives a reload so that I can shop before making an account.
- As a buyer, I want to change quantities and remove items, with the total updating live, so that I know what I will pay.
- As a buyer who signs in, I want my guest cart to carry over into my account so that nothing I picked is lost.
- As a buyer, I want lines that went out of stock or were reduced to be clearly flagged so that checkout never surprises me.
- As a buyer on a phone, I want the cart usable at 360px and by keyboard so that I can buy from any device.

**Acceptance criteria** (the contract):
- **AC-1**: `GET /api/v1/cart` (signed in) returns 200 with `{ data: Cart }`. `Cart` is `{ lines, item_count, total, can_checkout }`. Each line is `{ offer_id, quantity, max_quantity, available, quantity_reduced, unit_price: Money, line_total: Money | null, seller: { name }, product: { slug, name, cover_image_url, platform { slug, name }, region { slug, name } } }`. Product fields keep the same nullability as `ProductResource` (a missing cover falls back to the `CoverImage` placeholder). Lines are ordered oldest first (`cart_items.id` ascending). An empty cart returns `lines: []`, `item_count: 0`, `total: { amount: 0, currency: "EUR" }`, `can_checkout: false`.
- **AC-2**: Line rules, the same for every endpoint that returns a `Cart`: a line is `available` only when its offer is active, its product is active, and its stock (unsold keys) is above 0. `max_quantity` is `min(stock, 10)` when available, else 0. `quantity` is `min(stored, max_quantity)` when available, else the stored quantity. `quantity_reduced` is true only when available and stored is above `max_quantity`. `unit_price` is the live `offers.price_cents`. `line_total` is `unit_price × quantity` for available lines, else null. `total` is the sum of available `line_total`s. `item_count` is the sum of `quantity` over all lines. `can_checkout` is true only when there is at least one line and every line is available. A line with `quantity_reduced: true` does not block checkout: `can_checkout` stays true as long as every line is available, and checkout proceeds with the effective `quantity` shown in the cart. Checkout must still check stock again when it creates the order (feature 10). Reading a cart never writes to the database.
- **AC-3**: `POST /api/v1/cart/items` with `{ offer_id, quantity? }` (quantity 1 to 10, default 1) creates the line or adds to its quantity, capped at `max_quantity` (a new line also stores at most `max_quantity`), and returns 200 with the full `Cart`. `offer_id` must be an integer from 1 to `PHP_INT_MAX`. Errors are 422 in Laravel's default shape, checked in this order, first match wins: Form Request validation; `offer_id` "This offer is no longer available." (unknown offer, inactive offer, or inactive product); `offer_id` "This offer is out of stock." (stock 0); `quantity` "You already have the maximum for this offer." (stored quantity already at or above `max_quantity`, for example a reduced line; the stored value is left unchanged); `offer_id` "Your cart is full." (a new, 51st distinct line; a soft limit, concurrent adds may briefly pass it). Two concurrent adds of the same offer never create two rows and never push quantity above the cap.
- **AC-4**: `PATCH /api/v1/cart/items/{offerId}` with `{ quantity }` (1 to 10) sets the line's quantity and returns the `Cart`. `offerId` matches `[0-9]{1,18}` (else 404). Checks run in this order, first match wins: Form Request validation (422); 404 when the user has no line for that offer; 422 on `offer_id` "This offer is no longer available." when the line is unavailable; 422 on `quantity` "Only N available." when quantity is above `max_quantity`. `DELETE /api/v1/cart/items/{offerId}` removes the line and returns 200 with the `Cart`; deleting a line that is not there also returns 200 with the `Cart` (a double click is safe).
- **AC-5**: `POST /api/v1/cart/preview` (public) with `{ items: [{ offer_id, quantity }] }` returns the same `Cart` shape by the AC-2 rules, with lines in request order and unknown offer ids left out. Validation (422): `items` present as an array (empty allowed) of at most 50 entries, each `offer_id` an integer and distinct, each `quantity` an integer from 1 to 10. It never writes, so `BlockPreviewWrites` exempts this one route (by route name `cart.preview`) and a request from a Vercel preview origin succeeds. It uses the `catalog` limiter, so request 121 inside a minute from one IP gets 429 with `Retry-After`.
- **AC-6**: `POST /api/v1/cart/merge` (signed in) takes the same body as preview and, in one transaction, for every guest line whose offer is available, upserts on (`user_id`, `offer_id`) with quantity `min(server quantity + guest quantity, max_quantity)`. Guest lines for unknown, inactive, or out of stock offers are dropped. Existing server lines are kept untouched otherwise. New lines are added in request order only while the cart has fewer than 50 lines; the rest are dropped. Drops and caps are silent (the cart page shows the result). It returns 200 with the `Cart`.
- **AC-7**: Every cart route except preview requires a Bearer token (401 without one) and uses a new `cart` limiter (120 per minute per user id), so stepper clicks never compete with `/auth/me` for the `account` limit. Every read and write is scoped to the signed in user's own `cart_items`; a user can never read, change, or delete another user's lines (a PATCH for an offer only another user has in their cart returns 404 and changes nothing).
- **AC-8**: The guest cart lives in `localStorage` under `eneba.guestCart` as `{ "version": 1, "lines": [{ "offer_id": 12, "quantity": 2 }] }`. It survives a reload and syncs across open tabs. Bad JSON, an unknown version, or invalid lines read as an empty cart (invalid lines are dropped). When storage is unavailable, the cart lives in memory for the tab. Guest adds and quantity changes cap locally at `min(offer stock, 10)` and at 50 lines, with the same messages as AC-3. After a preview response, the client removes lines whose offer is missing from the response and writes reduced quantities back to storage, but only when something differs and only when the stored lines still equal the lines that request sent (a newer edit always wins).
- **AC-9**: On the product page, every in stock offer row and the buy box (when there is a best offer) has an "Add to cart" button; out of stock rows have none. A click adds quantity 1 (locally for a guest, through `POST /cart/items` when signed in), shows the success toast "Added to cart." with a "View cart" link to `/cart`, and updates the header badge. The clicked button (only that one) shows a pending state and ignores clicks while a signed in request runs. The toast keeps the existing `Toast` live region behavior; its link is a normal focusable link. A 422 shows an error toast with the server's message; any other failure shows "Could not add to cart. Please try again."
- **AC-10**: The header cart badge shows `item_count` (signed in: from the cart query; guest: the sum of stored quantities) and the link's accessible name stays "Cart, N items" ("Cart, 1 item" for one). `item_count` counts every line, unavailable ones included, so the badge matches the rows the cart page shows. While a signed in cart is loading or after it fails, the badge shows no number (count 0).
- **AC-11**: One client function, `mergeGuestCart()`, is the only place that merges. Only one call runs at a time in a tab (a shared in flight promise) and across tabs (`navigator.locks.request("eneba.guestCart.merge")`; browsers without Web Locks run it unlocked). Inside, it reads the guest lines again and does nothing when there are none. It calls `POST /cart/merge`, stores the returned `Cart` as the signed in cart, and on success removes a sent guest line only when both its `offer_id` and `quantity` still match the values sent in that merge request; lines added or changed while the request was in flight stay in the guest cart. It runs from the `onAfterSignIn` hook (sign in and register, before navigating) and once on app start when a token and guest lines both exist. The signed in cart query is a plain `GET /cart`. A failed merge never blocks sign in; the guest lines stay for the next app start. On sign out, the client first cancels running `["me"]` queries and then clears them, and a cart mutation that finishes after the token changed does not write to the cache, so the next person on the device never sees the old cart. The badge then shows the (empty) guest cart; the server cart stays in the account for the next sign in.
- **AC-12**: The `/cart` page has the `<h1>` "Cart" and one row per line: small cover, product name linking to `/products/{slug}`, platform and region, "Sold by {seller}", unit price, a quantity stepper, the line total, and a Remove button (accessible name "Remove {product name}", success toast "Removed from cart."). The stepper's minus is disabled at 1 and plus at `max_quantity`; both have accessible names and the value is readable by screen readers. A reduced line shows "Only N available, so we lowered the quantity." An unavailable line is muted (still AA), shows "No longer available", has Remove only, and is left out of the total. While a signed in change runs, that line's controls are disabled. A summary shows the item count, the total, and a Checkout button; when `can_checkout` is false, Checkout is disabled with the note "Remove unavailable items to continue." (or hidden in the empty state).
- **AC-13**: An empty cart shows `EmptyState` "Your cart is empty" with a "Browse games" link to `/`. A guest with no stored lines makes no API call. While loading, the page shows a skeleton and the "Waking up the server" notice after 3 seconds; any error shows `ErrorState` with a working "Try again". The tab title is `Cart | Eneba Marketplace (demo)`.
- **AC-14**: Checkout links to `/checkout`, guarded by `requireAuth`. A guest is sent to sign in with `redirectTo=/checkout`, the merge (AC-11) runs, and they land on a placeholder with the `<h1>` "Checkout is coming soon" and a link back to `/cart`. A signed in buyer lands there directly. Feature 10 replaces the placeholder.
- **AC-15**: At 360px the cart is one column with no sideways scroll; from `md` the lines and the summary sit side by side. Every control is keyboard reachable with the global focus ring, and every text and background pair used is in the `client/design.md` contrast table (AA). Client checks (`format:check`, `lint`, `typecheck`, `test`, `build`) and server checks (Pint, PHPStan, Pest) pass locally and in CI, and the full guest add, sign in, merge, checkout placeholder path works on the public deploy.

## Decision

**Chosen option**: Option 1: Guest cart in `localStorage`, server cart in `cart_items`, both rendered through one server built `Cart` resource (a public preview endpoint for guests)

You add five signed in cart endpoints and one public preview endpoint under `/api/v1/cart`, all returning the same `CartResource`, built by one `BuildCart` read action. The client keeps the guest cart in a small `localStorage` store (shaped like `authToken`), reads both carts through TanStack Query, merges on sign in through the existing `onAfterSignIn` hook, and adds the Add to cart buttons, the header badge, the `/cart` page, and a guarded `/checkout` placeholder.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `react-router-data-mode` (`remix-run/agent-skills`, `.claude/skills/react-router-data-mode/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Page composition** (design source: `client/design.md` tokens and the existing components, laid out after Eneba's cart; no Figma or screenshots):

1. **`/cart`**: `<h1>` "Cart". From `md`, two columns: the lines list (`<ul>`, one row card per line) and a summary panel (sticky from `md`). Below `md`, the summary comes after the lines.
2. **Line row**: cover (2:3 thumbnail, `CoverImage`), name link, platform and region line, "Sold by {seller}", unit price, `QuantityStepper`, line total, Remove (lucide `Trash2` icon button). Reduced note or "No longer available" under the name.
3. **Summary**: "{N} items" (or "1 item"), "Total" with `Price`, Checkout `LinkButton` (or a disabled button plus note).
4. **Product page**: "Add to cart" `Button` inside `BuyBox` and inside each in stock `OfferRow`.
5. **`/checkout`**: placeholder page, like `/orders` today.

**Component inventory**:

| Component | New or existing | Notes |
|---|---|---|
| `Button`, `LinkButton`, `Price`, `CoverImage`, `EmptyState`, `ErrorState`, `Skeleton`, `Container` | existing | used as is |
| `Toast` / `ToastOptions` | existing, extended | add optional `action?: { label: string; to: string }`, rendered as a router `Link` inside the toast |
| `BuyBox`, `OfferRow` | existing, extended | each gets an `AddToCartButton` for its offer |
| `AddToCartButton` | new, `components/cart/` | props `offerId`, `stock`, `label?`; uses `useCartActions().add`; pending state |
| `CartPage` | new, `pages/CartPage.tsx` | owns `useCart()` and the page states |
| `CartLineRow`, `CartSummary`, `QuantityStepper`, `CartPageSkeleton` | new, `components/cart/` | small, no fetching inside |
| `CheckoutPlaceholderPage` | new, `pages/CheckoutPlaceholderPage.tsx` | `<h1>` "Checkout is coming soon", link to `/cart` |
| `Header` | existing | `AppLayout` passes `cartCount={useCartCount()}` |

**Asset strategy**: covers from `products.cover_image_url`, with the existing placeholder on error. No new assets.

**Data model sketch**: no migration. The server cart is the existing `cart_items` table (spec 0002 AC-4: unique `user_id, offer_id`; `quantity > 0`; FK `user_id` and `offer_id` cascade). The guest cart is client storage:

| Store | Shape | Rules |
|---|---|---|
| `cart_items` (exists) | `id`, `user_id` FK, `offer_id` FK, `quantity`, timestamps | one row per (user, offer); order by `id` |
| `localStorage["eneba.guestCart"]` (new) | `{ version: 1, lines: [{ offer_id: number, quantity: number }] }` | distinct `offer_id`, quantity 1 to 10, at most 50 lines, insertion order |
| derived on read | `available`, `max_quantity`, effective `quantity`, prices, totals | AC-2; never stored |

Limits live in one server class, `App\Support\CartLimits` (`MAX_LINE_QUANTITY = 10`, `MAX_LINES = 50`), mirrored by one client constant module `lib/cartLimits.ts` (the guest add needs them before any request).

Read query (one cart, at most 50 lines): resolve offers by id with `Offer::query()->whereIn('id', $ids)->with(['seller:id,name', 'product' => fn ($q) => $q->select(...)->with(['platform:id,slug,name', 'region:id,slug,name'])])->withCount('availableKeys')`. Do not apply `active()` in the query: inactive rows must still load so the line can show as unavailable.

**State transitions**: none on the server (a line exists or not). Client cart mode: guest (`localStorage`) → signed in (server) through the merge on sign in; signed in → guest (empty) on sign out.

**API surface** (all under `/api/v1`, all return `{ data: Cart }` with 200 on success):

| Endpoint | Method | Key inputs | Auth | Key errors |
|---|---|---|---|---|
| `/cart` | GET | none | Bearer, `throttle:cart` | 401 |
| `/cart/items` | POST | `offer_id`: int 1..`PHP_INT_MAX` (req), `quantity`: int 1..10 (opt, default 1) | Bearer, `throttle:cart` | 401, 422 (AC-3) |
| `/cart/items/{offerId}` | PATCH | `offerId` path (`where('offerId', '[0-9]{1,18}')`), `quantity`: int 1..10 (req) | Bearer, `throttle:cart` | 401, 404, 422 (AC-4) |
| `/cart/items/{offerId}` | DELETE | `offerId` path (same pattern) | Bearer, `throttle:cart` | 401 |
| `/cart/merge` | POST | `items`: `[{ offer_id: int 1..PHP_INT_MAX, quantity: int 1..10 }]`, max 50, distinct ids | Bearer, `throttle:cart` | 401, 422 |
| `/cart/preview` | POST | same as merge | public, `throttle:catalog`, exempt from `BlockPreviewWrites` | 422, 429 |

The `cart` limiter is added in `AppServiceProvider` next to `account`: `Limit::perMinute(120)->by(user id)`.

Server shape: thin `CartController` → Form Requests (`AddCartItemRequest`, `UpdateCartItemRequest`, `CartLinesRequest` for merge and preview) → actions in `App\Actions\Cart\` (`BuildCart` for reads, `AddCartItem`, `UpdateCartItem`, `RemoveCartItem`, `MergeGuestCart`) → `CartResource` with `CartLineResource`. `BuildCart` takes a list of `(offer_id, stored quantity)` pairs, so the user cart and the preview share one code path. The add and merge upsert with `INSERT … VALUES (…, min(quantity, :cap)) ON CONFLICT (user_id, offer_id) DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, :cap)`, with `:cap` computed in PHP from the loaded offer, so both the insert and the update are capped (check whether Laravel 13's `upsert` accepts a raw update expression; otherwise use one bound `DB::statement`). The line count check for "cart full" runs before the insert.

Response example:

```json
{
  "data": {
    "lines": [
      {
        "offer_id": 41, "quantity": 2, "max_quantity": 3, "available": true, "quantity_reduced": false,
        "unit_price": { "amount": 998, "currency": "EUR" },
        "line_total": { "amount": 1996, "currency": "EUR" },
        "seller": { "name": "KeyHub" },
        "product": { "slug": "the-witcher-3-wild-hunt-pc-europe", "name": "The Witcher 3: Wild Hunt",
          "cover_image_url": "https://…", "platform": { "slug": "pc", "name": "PC" },
          "region": { "slug": "europe", "name": "Europe" } }
      }
    ],
    "item_count": 2,
    "total": { "amount": 1996, "currency": "EUR" },
    "can_checkout": true
  }
}
```

Client data layer:
- `api/cart.ts`: `Cart` and `CartLine` types (mirroring `CartResource`), `fetchCart`, `previewCart(lines)`, `addCartItem`, `updateCartItem`, `removeCartItem`, `mergeCart(lines)`.
- `lib/guestCart.ts`: the store (`getSnapshot`, `subscribe`, `add(offerId, cap)`, `setQuantity`, `remove`, `replace(lines)`, `clear`), a `storage` event listener for other tabs, defensive parsing, memory fallback.
- `lib/cart.ts`: `cartQueryOptions` (`["me", "cart"]`, so `clearAuth` already removes it; the query function is only `GET /cart`); `mergeGuestCart()` per AC-11 (in flight promise plus Web Lock), called by the `onAfterSignIn` hook and once from `main.tsx` on start; `guestPreviewQuery(lines)` (`["cart", "preview", lines]`, `placeholderData: keepPreviousData` so a stepper click does not flash the skeleton); `useCart()` picks one by `useAuthToken()`; `useCartActions()` for add, set quantity, and remove (guest: store writes; signed in: mutations that `setQueryData(["me", "cart"], cart)`); `useCartCount()`. Signed in mutations remember the token they started with and skip `setQueryData` when `authToken.get()` differs on success. `signOut` / `clearAuth` call `queryClient.cancelQueries({ queryKey: ["me"] })` before `removeQueries`.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Any `Cart` response | line list and stored quantity | signed in: `cart_items` of `$request->user()` ordered by `id`; preview: request `items` in order |
| Any `Cart` response | `available` | derived: `offers.is_active` and `products.is_active` and `available_keys_count > 0` |
| Any `Cart` response | stock | `withCount('availableKeys')` (spec 0002) |
| Any `Cart` response | `max_quantity` | derived: `min(stock, CartLimits::MAX_LINE_QUANTITY)` or 0 |
| Any `Cart` response | effective `quantity`, `quantity_reduced` | derived: AC-2 from stored quantity and `max_quantity` |
| Any `Cart` response | `unit_price` | `Money::eur(offers.price_cents)` (live, never stored in the cart) |
| Any `Cart` response | `line_total`, `total` | derived: integer cents multiplication and sum in PHP, wrapped with `Money::eur` |
| Any `Cart` response | `item_count`, `can_checkout` | derived: AC-2 |
| Any `Cart` response | seller and product fields | `sellers.name`; `products.slug`, `name`, `cover_image_url`; `platforms`, `regions` `slug` and `name` |
| Add | target user | `$request->user()` (never a body field) |
| Add | quantity to add | body `quantity`, default 1 |
| Add, merge | cap | derived: `max_quantity` of the loaded offer at write time |
| Patch, delete | which line | path `offerId` scoped to `$request->user()->cartItems()` |
| Merge, preview | guest lines | request body, built by the client from `localStorage["eneba.guestCart"]` |
| Merge (client) | when to merge | `onAfterSignIn` hook, plus app start when `authToken.get() !== null` and guest lines exist |
| Merge (client) | which lines to clear after success | stored lines whose `offer_id` and `quantity` both equal a line in the sent request |
| Preview write back | whether to apply | stored lines deep equal the request lines, and the response differs from them |
| Guest add (client) | cap | `min(offer.stock, MAX_LINE_QUANTITY)` from the product query's `Offer.stock` and `lib/cartLimits.ts` |
| Guest add (client) | "cart full" | `lines.length >= MAX_LINES` from `lib/cartLimits.ts` |
| Header badge | count | signed in: `cart.item_count` from `["me", "cart"]`; guest: sum of stored `quantity` |
| Badge label | "Cart, N items" | existing `cartLabel` in `Header.tsx` |
| Cart page | which cart to show | `useAuthToken()`: token present means the server cart, else the guest preview |
| Cart page | reduced note N | `line.max_quantity` |
| Toasts | messages | 422: first error message from `ApiError`; fixed copy otherwise (AC-9, AC-12) |
| Tab title | text | React 19 `<title>`: `Cart | Eneba Marketplace (demo)` |
| Slow notice | when | `useSlowPending(isFetching && !data)` (3 s), same copy as the home grid |

**Key invariants**:
- For money and availability shown on screen, the client never computes a price, total, `max_quantity`, or availability. It shows the server's `Cart`. The only client side math is the guest add and stepper guards and the guest badge sum, and the next preview corrects them.
- Only `mergeGuestCart()` ever calls `POST /cart/merge`; queries never write.
- A cart line never holds a price; prices are always live.
- Stored quantity is always 1 to 10 (database check `> 0`, Form Request max 10, cap in the upsert). A signed in user has at most one row per offer (unique constraint).
- Reads (`GET /cart`, preview) never write.
- Every signed in query and write goes through `$request->user()->cartItems()`; no endpoint accepts a `user_id` or a `cart_items.id`.
- The cart never reserves stock. Feature 10 and 11 recheck stock and prices when the order is created.
- EUR only (`Money::eur`).

**Security model**: The signed in cart is private to its user (spec 0002): routes need a Sanctum Bearer token, and every query is scoped by the authenticated user, so there is no way to name another user's row. The preview is public but reveals only public catalog data (prices, stock counts, names), never key codes, and it is bounded (50 lines, quantity up to 10) and rate limited by IP. All input is validated by Form Requests and bound as parameters (no raw string SQL; the cap in the upsert is a bound value). The guest cart in `localStorage` holds only public offer ids and quantities, so a shared computer leaks nothing private, and sign out never copies the account cart into it. No regulated data.

**Configuration required**: none. No new env variables or dependencies (the `cart` limiter is code in `AppServiceProvider`).

**Edge cases and failure handling**:
- Offer deactivated, product deactivated, or out of stock after adding: line shows unavailable, excluded from the total, Checkout disabled until removed.
- Stock drops below the stored quantity: line shows the lowered quantity with the reduced note; the stored row is corrected the next time the buyer changes that line (and checkout uses the same AC-2 rule).
- Offer deleted: the FK cascade deletes the server row; the preview omits it and the client drops it from storage.
- Merge response lost after the server committed (timeout): the guest lines stay, so the retry adds them again. Quantities can double, but stay capped at `min(stock, 10)` and are visible in the cart. Accepted, see Consequences.
- Two tabs: guest changes sync through the `storage` event; signed in tabs refetch on focus (TanStack default). A sign in seen by another tab through token sync never merges there (spec 0006 runs hooks only in the tab that signed in), and the Web Lock plus the reread inside it stops a double merge when two tabs start at once.
- Sign out while a cart request runs: queries are cancelled first, and a late mutation result is ignored because the token changed.
- Rapid clicks: signed in controls disable while a mutation runs; guest writes are synchronous.
- Storage blocked (private mode): memory only, like `authToken`.
- Cold start on Render: skeleton and slow notice; single retry and timeout from the existing `apiFetch`.
- 401 mid session on `/cart`: the existing unauthorized handler clears auth; `/cart` is not protected, so the page simply shows the guest cart.
- 429: error toast for actions, `ErrorState` for the page.

**Critical test scenarios**:
- Happy path (Pest): a user with two lines gets the documented shape, oldest first, correct `line_total`, `total`, `item_count`, `can_checkout`, verifies **AC-1**, **AC-2**
- Line rules (Pest dataset): inactive offer, inactive product, zero stock, stock 3 with stored 5 (reduced), stock 40 with stored 10 (cap 10) each give the right `available`, `max_quantity`, `quantity`, `quantity_reduced`, totals, and `can_checkout`; and a GET leaves stored quantities unchanged, verifies **AC-2**
- Add (Pest): new line; same offer again increments; a new line with quantity 10 on stock 3 stores 3; at cap returns 422 on `quantity`; a reduced line (stored 5, stock 3) returns 422 and stays 5; unknown, inactive, and out of stock offers return 422 on `offer_id`; a 51st line returns 422; an `offer_id` above `PHP_INT_MAX` returns 422, not 500, verifies **AC-3**
- Capping (Pest): repeated adds on an existing row never pass the cap. This test is sequential and proves the `LEAST` expression; the real race guarantee is the unique constraint plus `ON CONFLICT`, verifies **AC-3**
- Patch and delete (Pest): set within cap; above cap 422 "Only N available."; no line 404; an unavailable line 422 before the cap check; a 19 digit path id 404; delete existing and missing both 200, verifies **AC-4**
- Preview (Pest): request order kept, unknown id omitted, validation failures (51 items, duplicate ids, quantity 0 and 11), no rows written, 429 after the limit, and a request with a preview `Origin` succeeds while `POST /cart/items` from that origin still gets 403, verifies **AC-5**
- Merge (Pest): overlapping line sums and caps; unknown, inactive, out of stock guest lines dropped; 50 line limit respected; untouched server lines kept, verifies **AC-6**
- Auth/permission (Pest): every signed in route returns 401 without a token; user B's PATCH and DELETE on user A's offer line leave A's row unchanged (PATCH 404), and B's GET never shows A's lines, verifies **AC-7**
- Unit (Vitest): `guestCart` parsing (bad JSON, version 2, invalid lines, duplicates), add with cap and 50 line limit, `replace` after preview, memory fallback, verifies **AC-8**
- Unit (Vitest): the guest preview write back is skipped when stored lines changed after the request, verifies **AC-8**
- Unit (Vitest): `mergeGuestCart()` called twice at once sends one request; on success it removes only lines whose `offer_id` and `quantity` both match the sent request, while a line added during the request and a sent line whose quantity changed during the request both stay; it keeps all lines on failure, and does nothing with no lines; a mutation that resolves after the token changed leaves the cache untouched, verifies **AC-11**
- Manual in browser (`/check verify`): as a guest add two offers from the product page (toast with View cart, badge), reload, change quantity, remove, open a second tab; sign in from Checkout and land on the placeholder with the merged cart; sign out and see an empty badge; check 360px, keyboard, an unavailable line (deactivate an offer in the DB), and the empty, loading, and error states, verifies **AC-8** to **AC-15**

## Build plan

Approach: Journey. The cart is the third step of the purchase path (product page → cart → sign in → checkout), so you finish every cart state, including the hand off into sign in and checkout, before feature 10 starts. The server comes first because both carts render through its `Cart` shape.

1. Add `CartLimits`, the `cart` rate limiter, `BuildCart`, `CartResource` and `CartLineResource`, `CartController::show` and `GET /cart`, satisfies **AC-1**, **AC-2**, **AC-7**
2. Add the write actions and Form Requests with routes: `AddCartItem` (with the capped insert and upsert and the fixed error order), `UpdateCartItem`, `RemoveCartItem`, satisfies **AC-3**, **AC-4**, **AC-7**
3. Add `POST /cart/preview` (public, `catalog` limiter, exempted in `BlockPreviewWrites`) and `POST /cart/merge` with `MergeGuestCart`, sharing `CartLinesRequest`, satisfies **AC-5**, **AC-6**, **AC-7**
4. Write the Pest tests from *Critical test scenarios* in `tests/Feature/Cart/`, satisfies **AC-1** to **AC-7**
5. Client data layer: `api/cart.ts`, `lib/cartLimits.ts`, `lib/guestCart.ts`, `lib/cart.ts` (queries, actions with the token guard, count, `mergeGuestCart()` wired to `onAfterSignIn` and app start in `main.tsx`), plus `cancelQueries` in the sign out path, with Vitest tests, satisfies **AC-8**, **AC-10**, **AC-11**
6. Product page: extend `ToastOptions` with `action`, add `AddToCartButton` to `BuyBox` and in stock `OfferRow`s, wire `cartCount` into `Header` from `AppLayout`, satisfies **AC-9**, **AC-10**
7. Cart page: `/cart` route, `CartPage`, `CartLineRow`, `QuantityStepper`, `CartSummary`, skeleton, empty, error, and title, satisfies **AC-12**, **AC-13**
8. Add the guarded `/checkout` route with `CheckoutPlaceholderPage`, then walk guest add → Checkout → sign in → merge → placeholder end to end, satisfies **AC-11**, **AC-14**
9. Run every client and server check, push, confirm CI is green and the deploy works, then check 360px and keyboard use by hand, satisfies **AC-15**

## Consequences

**Positive**:
- One `Cart` shape and one `BuildCart` code path for guests and signed in buyers, so totals and line status can never disagree between them.
- All money math stays on the server in integer cents; the client only formats.
- No migration, no new dependency, no new env variable; the spec 0002 table and the spec 0006 sign in hook are used as designed.
- The hand off into sign in and checkout is testable now, so feature 10 only swaps the placeholder page.

**Negative / tradeoffs**:
- A guest cart costs one preview request per change (cheap, but it is a round trip, and it counts against the `catalog` limit).
- A lost merge response followed by a retry can double quantities (capped and visible). An idempotency key would fix it, but costs a column or a cache entry for a rare case.
- A reduced line's stored quantity stays above stock until the buyer touches it, so the stored and shown quantities can differ for a while; feature 10 must apply the same AC-2 rule.
- The limits 10 and 50 exist on both server and client (`CartLimits` and `lib/cartLimits.ts`); changing one means changing the other.
- The cart does not reserve stock, so a line can go unavailable between cart and payment.
- No optimistic updates: each signed in quantity click waits for one round trip (about 100 ms warm, much longer on a cold Render start).
- No React Testing Library yet, so the page and buttons are checked by hand in `/check verify`.

**Neutral**:
- The toast gains an optional action link, a small change to a shared component that `client/design.md` must record.
- `/checkout` exists as a placeholder until feature 10.

## Follow-up

- [ ] Checkout (feature 10): price and stock the order with the AC-2 rule (effective quantity, available lines only, `can_checkout`), replace `CheckoutPlaceholderPage`, delete the cart lines inside the order transaction, and invalidate `["me", "cart"]` and `["products"]` after payment.
- [ ] `/sync`: add `CartLimits`, `BuildCart`, the cart routes, and the `eneba.guestCart` key to `server/AGENTS.md` and `client/AGENTS.md`; add the toast action, `QuantityStepper`, and cart components to `client/design.md`.
- [ ] Submission README (feature 18): explain the guest cart in `localStorage`, live prices, no stock reservation, and the accepted merge retry tradeoff.
