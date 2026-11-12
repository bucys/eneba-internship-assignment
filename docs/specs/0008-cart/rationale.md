# 0008. Cart: rationale

## Context

Feature 9 sits between the product page (spec 0007) and checkout (feature 10) on the purchase journey. The scope fixes the shape of the problem: a guest can shop without an account, the cart must persist across reloads, carry over into the account on sign in, update totals live, cap quantity by available stock, and render an empty state. Sign in is required only at checkout.

Earlier specs already settled parts of it. Spec 0002 built a `cart_items` table keyed on (`user_id`, `offer_id`) for signed in users, and decided the guest cart lives in `localStorage` and names offers by `offers.id`. Spec 0006 added an `onAfterSignIn` hook that runs before navigation and a `["me", …]` query key convention that sign out clears in one call. Prices and stock are never stored (stock is a count of unsold keys), and money is integer cents in EUR.

The forces are: one source of truth for money (the server), no stale prices, no data leaking between accounts on a shared computer, a small and explainable codebase (the developer must explain every line for an internship review), a 3 to 4 day total budget, and the free Render tier's cold starts. Leaving this undecided means `/develop` would have to invent how a guest's cart gets its prices, what a merge does, and how stale lines behave, which are exactly the parts a reviewer will poke at.

## Options considered

### Option 1: localStorage ids, server cart, one server built Cart for both (chosen)

The guest cart stores only `{ offer_id, quantity }`. A public `POST /cart/preview` turns those lines into the same `Cart` resource that `GET /cart` returns for signed in users. Merge on sign in is a single server call.

**Pros**:
- One read path and one resource for both carts; totals, availability, and caps are computed once, on the server.
- Prices and stock are always live; nothing in the browser can go stale beyond the next request.
- Fits spec 0002 and 0006 exactly, with no migration.

**Cons**:
- A guest change costs a preview round trip.
- One more public endpoint to validate and rate limit.

### Option 2: localStorage snapshots, client totals

The guest cart stores name, cover, price, and stock at add time; the client computes guest totals and only talks to the server once signed in.

**Pros**:
- No preview endpoint; a guest cart works offline and renders instantly.

**Cons**:
- Prices and stock go stale; the guest sees one total and the signed in cart another.
- Money math moves into the client, against the project rule that the server owns money, and the two carts need two rendering paths.

### Option 3: Server side guest cart with an anonymous token

The guest gets an anonymous cart id (cookie or header), and guest lines live in the database too.

**Pros**:
- One storage model for everyone; merge becomes a row update.

**Cons**:
- Needs a schema change (nullable `user_id` plus a cart token) that contradicts spec 0002, cleanup of abandoned guest carts, and a second token next to the Sanctum Bearer token.
- More moving parts than the budget and the explain every line rule allow.

## Rationale

Option 1 keeps the server as the only place that knows prices, stock, and totals, which is the force that matters most for a marketplace review: a reviewer who changes an offer's price or empties its keys sees every cart reflect it on the next read. Because the preview and `GET /cart` share `BuildCart`, there is one rule set to test, and checkout (feature 10) can reuse it. Option 2 is faster for guests but splits money logic across two languages; Option 3 is the most uniform but costs a migration, a second token type, and garbage collection that the 3 to 4 day budget cannot carry.

The engineer's choices shape the rest: quantity capped at `min(stock, 10)` so one buyer cannot drain a key pool; merge sums then caps, so nothing the buyer picked is lost; stale lines are flagged, excluded, and block checkout, so the order never silently differs from the cart; writes return the whole cart, so the client never refetches or computes; and Checkout goes to a guarded placeholder, so the sign in and merge round trip is verifiable now.

Calls made in the spec (pick, why, runner up):
- **Reads never write.** `GET /cart` shows the effective quantity and a `quantity_reduced` flag instead of clamping the stored row. A GET with side effects surprises caches and tests. Runner up: clamp the row on read, which keeps stored and shown equal but makes a read mutate.
- **DELETE is safe to repeat** (200 with the cart even when the line is gone), so a double click or a retry never shows an error. Runner up: 404 on a missing line, which is stricter but adds a pointless error state.
- **Add returns 200, not 201**, because it is an upsert, not always a creation.
- **The add and merge cap uses `LEAST` inside the upsert**, so concurrent requests cannot exceed the cap, and the unique constraint stops duplicate rows. Runner up: lock the row with `SELECT … FOR UPDATE`, which is heavier for no gain here.
- **No merge idempotency key.** A lost response plus a retry can double quantities, but they stay capped and visible. Runner up: a client generated merge id stored server side, which costs a column or cache entry for a rare case.
- **One single flight `mergeGuestCart()`, called from the sign in hook and on app start, behind a Web Lock.** The cross check showed that merging inside the cart query function races the sign in hook and other tabs, and makes a read write. Keeping the query a plain GET and funnelling every merge through one guarded function removes those races. Runner up: merge inside the query function, which needs no extra trigger but can merge twice.
- **A dedicated `cart` limiter (120 per minute per user).** Stepper clicks and cart reads would otherwise share the `account` limit of 60 with `/auth/me`. Runner up: reuse `account`, which is simpler but easy to hit with fast clicking.
- **The preview route is exempt from `BlockPreviewWrites`.** It is a POST only because a list of lines does not fit a query string well; it writes nothing, so blocking it would break guest carts on Vercel previews for no safety gain.
- **Limits in `CartLimits` plus a mirrored client constant.** The guest add needs the caps before any request. Runner up: send the limits in an API response, which adds a request or a field for two numbers.
- **The toast gains an optional link action** to honor "View cart" in the toast. Runner up: no link (badge only), which loses the shortcut the engineer picked.

## Accepted behavior after verification

- **The guest "quantity lowered" notice can disappear.** When a guest's stored quantity is above stock, the first preview returns `quantity_reduced: true` and the line shows "Only N available, so we lowered the quantity." The client then writes the lowered quantity back to `localStorage` (AC-8). The next preview sends the corrected quantity, so it returns `quantity_reduced: false` and the notice goes away. This is accepted: the stored cart now matches what the buyer can actually buy, and the line still shows the lowered quantity and total. A signed in cart keeps the notice, because reads never write (AC-2). No UI change. Found in `/check verify cart` on 2026-11-13.
