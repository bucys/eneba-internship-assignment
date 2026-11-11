# 0002. Data model: rationale

Decision record for [index.md](index.md). `/develop` builds from `index.md` and skips this file.

## Context

Every journey in the scope (purchase, discovery, landing) reads or writes the same core data: what is for sale, who sells it, how many keys are left, what a signed in user has in their cart, and what they bought. The assignment asks for offers from several sellers per product, a unique digital key per purchase, and order history. The scope adds a guest cart that merges into the account on sign in, server side price recalculation, and protection against double submits.

The stack is fixed by spec 0001: Laravel 13 with Eloquent on Postgres 17 (Neon in production), integer cents plus an ISO currency code, EUR only, and a guest cart kept in the browser's `localStorage`. Only signed in users have a cart on the server. Payment is simulated and synchronous inside one database transaction. Prod migrations run automatically on deploy and must never be destructive, so a schema that has to be reshaped mid build is expensive.

Forces: a 3 to 4 day build budget, a developer who must explain every table in review, and correctness under concurrency for key allocation (the same key must never go to two buyers). The catalog is small (60 to 100 products, 2 to 5 offers each), so read performance is not a real constraint.

## Options considered

### Option 1: Listing centric relational model with derived stock

A product is one listing (game, edition, platform, region). Offers attach per seller. Each key is a row; its link to an order item marks it sold. Stock and cheapest price are computed. Orders exist only once paid, with name and price snapshots. The database enforces invariants through unique and check constraints.

**Pros**:
- Matches how eneba.com lists products, so offers on one page compare like for like.
- Filters are plain columns (platform, region) on one table.
- One source of truth for stock; nothing to keep in sync.
- Constraints catch bugs that code review would miss.

**Cons**:
- Game metadata repeats across platform and region listings.
- Aggregate queries for stock and price on every listing read.

### Option 2: Game, variants, offers

A `games` table holds shared metadata; `product_variants` carry platform and region; offers attach to variants.

**Pros**:
- No repeated metadata; one product page can switch between platforms.
- Closer to how a large catalog would be normalized.

**Cons**:
- One more table and join in every catalog query, filter, and search.
- More concepts to explain, with little payoff for 60 to 100 seeded listings.

### Option 3: Denormalized counters and stored prices

Same entities as Option 1, but `offers.stock` and `products.min_price_cents` are stored columns updated at checkout and seed time.

**Pros**:
- Fastest reads; store sorting by price is a simple `ORDER BY`.

**Cons**:
- Every write path (checkout, seed, future admin) must update the counters, or the UI shows wrong stock and prices.
- Adds failure modes to exactly the code (checkout) that needs to be most correct.

## Rationale

Option 1 fits the forces best. The assignment grades a working purchase flow and code the developer can explain; a listing per row mirrors Eneba's own store, and the constraints make the critical rules (one key per buyer, one order per checkout attempt, EUR cents only) hold even if application code has a bug. Option 2 solves a duplication problem this seeded catalog does not have. Option 3 optimizes reads that are already fast at this size and moves risk into checkout.

Sub decisions made with the engineer (pick, then runner up):

- **Platforms and regions**: lookup tables, so the API serves filter lists from the database and nothing is hardcoded. Runner up: strings cast to PHP enums.
- **Genres**: none now; an additive table later. Runner up: many to many genres.
- **Product type**: a string column cast to a PHP enum (game, dlc, gift card, subscription). Runner up: games only.
- **Deals**: `products.list_price_cents` (the recommended retail price); the discount is derived from real offer prices, so deals stay honest. Runner up: an old price per offer.
- **Seller rating**: seeded `rating_basis_points` (hundredths of a percent, avoiding floats) and `rating_count`. Reviews stay deferred.
- **Stock**: counted from available keys. Runner up: a counter column.
- **Key codes**: plain text with a unique index. Runner up: encrypted cast plus a hash column for uniqueness.
- **Key state**: nullable `order_item_id` plus `sold_at`, tied together by a check. No reserved state, because payment is synchronous. Runner up: a status enum.
- **Server cart**: a single `cart_items` table keyed by user; no parent cart row. Live prices only. Runner up: `carts` plus `cart_items`.
- **Orders**: written only on successful payment, `status` kept for future states. Runner up: pending then paid or failed.
- **Double submit**: unique (`user_id`, `idempotency_key`) enforced by Postgres. Runner up: row locks in code only, which do not recognize a retried request after success.
- **Order item snapshots**: unit price and the product, platform, region, and seller names. Runner up: price only.
- **Order IDs**: bigint primary key plus a unique ULID for URLs, so order counts stay hidden. Runner up: plain bigint.
- **Currency**: `currency` columns on offers and orders, checked to `EUR`. Runner up: orders only.
- **Offers**: one per seller per product. Runner up: several allowed.
- **Delisting**: `is_active` on products and offers, FKs restrict deletes. Runner up: soft deletes, which complicate every join and unique index.
- **Banners**: left to the homepage blocks spec (feature 15).
- **Build slicing**: all tables in this feature. Runner up: catalog now, cart and orders with their features.

Decisions made by the architect (not asked):

- **One migration per table** in FK order. This is Laravel convention, easy to read, and each rollback is clean. Runner up: one big migration, harder to review.
- **Raw SQL check constraints** in migrations. They give database enforcement that Eloquent validation alone cannot guarantee under concurrency. Runner up: application only checks.
- **Partial index** on available keys per offer, so stock counts and key allocation scan only unsold keys. Runner up: a plain `offer_id` index.
- **FK delete rules**: restrict everywhere order history depends on a row (orders included, since they are never deleted); cascade only for cart lines. Changed from cascade on `order_items.order_id` after the cross check: sold keys restrict anyway, so cascade only hid the intent.
- **Offer identifier**: the plain `offers.id` (from the cross check). Offers are public, so a ULID adds a column for no gain. Runner up: a ULID on offers.
- **Name and slug**: the full display name includes the edition, and the slug is built from name, platform, and region (from the cross check). Runner up: a separate `edition` column.
