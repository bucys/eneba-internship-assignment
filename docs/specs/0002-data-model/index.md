# 0002. Relational data model for catalog, keys, cart, and orders

**Date**: 2026-11-11
**Status**: Accepted

## Summary

This spec sets the database tables every journey builds on: platforms, regions, sellers, products, offers, keys, the signed in cart, orders, and order items. A product is one store listing (game, edition, platform, and region), and sellers compete on it with one offer each. Stock and the cheapest price are always counted from the data, never stored, so they cannot drift. You build every table now, with its Eloquent model (the PHP class for a table), factory (test data maker), and schema tests, so later features add code but never reshape the schema.

## Requirements

**User stories**:
- As a buyer, I want to compare several sellers' offers for the same listing so that I can pick the best price.
- As a buyer, I want each key I buy to be mine alone so that it works when I redeem it.
- As a signed in buyer, I want my cart kept on the server so that it survives sign in and devices.
- As a buyer, I want my past orders and keys to look exactly as they did when I paid, even if the catalog changes later.
- As the developer, I want the database itself to reject invalid data so that bugs in one code path cannot corrupt orders or keys.

**Acceptance criteria** (the contract):
- **AC-1**: `php artisan migrate` on an empty Postgres 17 database creates the nine new tables in *Data model sketch* (next to the existing `users` table), with every listed column, foreign key (FK), unique constraint, check constraint, and index. `php artisan migrate:rollback` removes them cleanly.
- **AC-2**: A product can hold offers from several sellers. Inserting a second offer for the same product and seller fails with a unique violation.
- **AC-3**: A key `code` exists only once in the whole table. A key is either available (`order_item_id` and `sold_at` both null) or sold (both set); the database rejects any other mix. An offer's stock is the count of its available keys, read through a model scope, with no stock column anywhere.
- **AC-4**: A user's server cart holds at most one line per offer (unique `user_id, offer_id`), quantity must be greater than zero, and deleting the user deletes their cart lines.
- **AC-5**: An order belongs to exactly one user and is addressed publicly by a unique ULID (a sortable random ID). Inserting a second order with the same `user_id` and `idempotency_key` fails with a unique violation.
- **AC-6**: An order item stores the unit price and the product, platform, region, and seller names as they were at purchase time. Renaming the product or seller afterwards does not change them. A product or offer that an order item references cannot be deleted (FK restrict).
- **AC-7**: Every money column is an integer count of cents, every `currency` column only accepts `EUR`, and no table has a float or decimal money column.
- **AC-8**: Each new table has an Eloquent model with its relations and casts, plus a factory that creates a valid row (including a sold key state). `ProductType` and `OrderStatus` are backed PHP enums used as casts.
- **AC-9**: Pint, PHPStan (level 6, no baseline), and Pest all pass locally and in CI with the new code.

## Decision

**Chosen option**: Option 1: Listing centric relational model with derived stock

You build one listing per product row, offers per seller on that listing, one key row per sellable unit, a user keyed cart table, and orders written only on successful payment with name and price snapshots. The database enforces uniqueness, money rules, and key state with constraints.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

All tables have a `bigint` auto increment `id` primary key and `created_at` / `updated_at` timestamps. `?` marks a nullable column; everything else is `NOT NULL`. FK columns get their own index (Postgres does not add one for you) unless a composite index or unique constraint already starts with that column.

| Table | Columns | Constraints and indexes |
|---|---|---|
| `platforms` | `slug` string, `name` string | unique `slug` |
| `regions` | `slug` string, `name` string | unique `slug` |
| `sellers` | `slug` string, `name` string, `rating_basis_points` smallint, `rating_count` integer default 0 | unique `slug`; check `rating_basis_points BETWEEN 0 AND 10000`; check `rating_count >= 0` |
| `products` | `slug` string, `name` string, `type` string default `'game'`, `platform_id` FK, `region_id` FK, `cover_image_url` string(2048), `description`? text, `release_date`? date, `developer`? string, `publisher`? string, `list_price_cents`? integer, `is_active` boolean default true | unique `slug`; check `type IN ('game','dlc','gift_card','subscription')`; check `list_price_cents IS NULL OR list_price_cents > 0`; index `platform_id`; index `region_id`; FKs restrict on delete |
| `offers` | `product_id` FK, `seller_id` FK, `price_cents` integer, `currency` char(3) default `'EUR'`, `is_active` boolean default true | unique (`product_id`, `seller_id`); index (`product_id`, `price_cents`); index `seller_id`; check `price_cents > 0`; check `currency = 'EUR'`; FKs restrict |
| `orders` | `ulid` char(26), `user_id` FK, `status` string default `'paid'`, `total_cents` integer, `currency` char(3) default `'EUR'`, `idempotency_key` uuid, `paid_at` timestamp | unique `ulid`; unique (`user_id`, `idempotency_key`); index (`user_id`, `created_at`); check `status IN ('paid')`; check `total_cents > 0`; check `currency = 'EUR'`; FK `user_id` restrict |
| `order_items` | `order_id` FK, `offer_id` FK, `product_id` FK, `quantity` integer, `unit_price_cents` integer, `product_name` string, `platform_name` string, `region_name` string, `seller_name` string | index `order_id`; index `offer_id`; index `product_id`; check `quantity > 0`; check `unit_price_cents > 0`; all FKs restrict (orders are never deleted) |
| `product_keys` | `offer_id` FK, `code` string, `order_item_id`? FK, `sold_at`? timestamp | unique `code`; index `order_item_id`; partial index on `offer_id WHERE order_item_id IS NULL` (fast available stock lookups); check `(order_item_id IS NULL) = (sold_at IS NULL)`; FKs restrict |
| `cart_items` | `user_id` FK, `offer_id` FK, `quantity` integer | unique (`user_id`, `offer_id`); index `offer_id`; check `quantity > 0`; FK `user_id` cascade; FK `offer_id` cascade |
| `users` | existing Laravel table, unchanged | |

Relationships:

| From | To | Cardinality |
|---|---|---|
| `platforms` | `products` | 1:N |
| `regions` | `products` | 1:N |
| `products` | `offers` | 1:N |
| `sellers` | `offers` | 1:N |
| `offers` | `product_keys` | 1:N |
| `users` | `cart_items` | 1:N |
| `offers` | `cart_items` | 1:N |
| `users` | `orders` | 1:N |
| `orders` | `order_items` | 1:N |
| `offers` | `order_items` | 1:N |
| `products` | `order_items` | 1:N |
| `order_items` | `product_keys` | 1:N (exactly `quantity` keys per item) |

Implementation notes:
- Write check constraints and the partial index as raw SQL (`DB::statement(...)`) inside the migration that creates the table. Before writing them, check the Laravel 13 schema builder docs: if Blueprint offers a native check or partial index method, prefer it. `down()` is just `Schema::dropIfExists(...)`, because checks and indexes are dropped with the table.
- Name every check constraint explicitly as `<table>_<column>_check` (for example `orders_status_check`, `product_keys_sold_state_check`). Adding a value later (a new order status or product type) means a migration that drops the named check and adds it again with the wider list.
- The partial index serves only lookups of unsold keys. Lookups of sold keys go through the `order_item_id` index. At this catalog size, no plain `offer_id` index is needed.
- Public identifiers: products by `slug`, orders by `ulid`, offers by their plain `id` (offers are public catalog data, so a guessable ID leaks nothing). The guest cart in `localStorage`, add to cart, and checkout all name an offer by `offers.id`.
- `products.name` is the full display name, edition included (for example "The Witcher 3: Wild Hunt GOTY Edition"); there is no separate edition column. The seeder builds `slug` as `Str::slug("{name} {platform slug} {region slug}")`.
- One migration per table, in FK order: `platforms`, `regions`, `sellers`, `products`, `offers`, `orders`, `order_items`, `product_keys`, `cart_items`. `product_keys` comes after `order_items` because it points to it.
- `orders.ulid`: use `$table->ulid('ulid')->unique()`. On the model, generate it on create (the `HasUlids` trait with `uniqueIds()` returning `['ulid']`, so the bigint stays the primary key; confirm this in the Laravel 13 docs) and set `getRouteKeyName()` to `'ulid'`.
- Models: `Platform`, `Region`, `Seller`, `Product`, `Offer`, `ProductKey`, `CartItem`, `Order`, `OrderItem`, plus `cartItems()` and `orders()` on `User`.
- Relations (both directions for every FK in the relationship table), including at least: `Product::platform()`, `region()`, `offers()`; `Offer::product()`, `seller()`, `keys()`, `availableKeys()`; `Order::user()`, `items()`; `OrderItem::order()`, `offer()`, `product()`, `keys()`; `ProductKey::offer()`, `orderItem()`; `CartItem::user()`, `offer()`.
- Casts: `Product.type` → `ProductType`, `Order.status` → `OrderStatus`, `release_date` → `date`, `is_active` → `boolean`, `sold_at` and `paid_at` → `datetime`.
- Scopes: `Product::active()`, `Offer::active()`, `ProductKey::available()` (`whereNull('order_item_id')`); relation `Offer::availableKeys()` so a reader can call `withCount('availableKeys')`.
- No soft deletes. Taking something off sale means `is_active = false`.

**State transitions**:
- Key: `available` (no order item) → `sold` (order item and `sold_at` set). One way only; nothing ever unsells a key.
- Order: written directly as `paid`. A declined payment writes no order. Future states (for example `refunded`) are added by widening the status check, which is additive.

**API surface**:

None in this feature. Endpoints come with features 6 to 15, which read and write these tables.

**Value sourcing** (values later features will read from this model):

| Action | Value produced / displayed | Source |
|---|---|---|
| Product page, cart | Offer stock | derived: `COUNT(product_keys WHERE offer_id = ? AND order_item_id IS NULL)` via `withCount('availableKeys')` |
| Store, product page | Cheapest price | derived: lowest `offers.price_cents` among active offers with stock above zero |
| Deals block | Discount percent | derived: `list_price_cents` vs cheapest price; no discount when `list_price_cents` is null or not higher |
| Best sellers block | Units sold per product | derived: `SUM(order_items.quantity)` grouped by `order_items.product_id` |
| Product page | Seller rating | `sellers.rating_basis_points / 100` shown as a percent, plus `sellers.rating_count` (seeded) |
| Checkout | Order `ulid` | generated by the model on create |
| Checkout | `idempotency_key` | input from the client per checkout attempt; how it is sent is decided in the checkout spec (feature 10) |
| Checkout | `unit_price_cents`, snapshot names | copied from the offer, product, platform, region, and seller rows inside the checkout transaction |
| Checkout | `order_items.product_id` | copied from `offers.product_id` at insert, never from client input |
| Checkout | `total_cents` | derived: `SUM(quantity * unit_price_cents)` of the order's items, stored as the amount paid |
| Checkout | `paid_at`, `sold_at` | server time at the moment the payment transaction commits |
| Filters | Platform and region lists | `platforms` and `regions` rows |
| Cart, checkout | Offer reference | `offers.id` |
| Seed | Product `slug` | derived: `Str::slug` of name, platform slug, region slug |
| Order history | Sort order | `paid_at` descending, then `id` descending |

**Key invariants**:
- One offer per seller per product (DB unique).
- A key code is globally unique (DB unique), and a key belongs to at most one order item (single FK column).
- A key is sold exactly when `order_item_id` and `sold_at` are both set (DB check).
- An order item has exactly `quantity` keys (application: checkout and key delivery, features 10 and 11, enforced and tested there).
- `order_items.product_id` equals the product of its offer (application: set from the offer; an offer never moves to another product).
- `orders.total_cents` equals the sum of its items' `quantity * unit_price_cents` (application, checkout).
- One idempotency key per user produces at most one order (DB unique).
- Money is integer cents, currency is `EUR` (DB checks).
- Order history never loses data: referenced products and offers cannot be deleted (FK restrict), and line details live in snapshots.

**Security model**:
- Catalog tables (`platforms`, `regions`, `sellers`, `products`, `offers`) are public to read. Nothing writes them except seeders (no admin panel in scope).
- `product_keys.code` is never returned by any API unless the key is sold to the requesting user. Available codes never leave the server.
- `cart_items`, `orders`, and `order_items` are private to their `user_id`. Access checks live in the cart, checkout, and order history features (policies or query scoping by the signed in user). There is one database user, so there is no row level security in Postgres.
- Key codes are plain text in the database. They are fake seed data; a real store would encrypt them (see Consequences).
- No regulated data. Payment card details are simulated and are never stored.

**Configuration required**: none. This feature adds no env variables.

**Critical test scenarios** (Pest, against the `eneba_test` Postgres database):
- Happy path: factories create a product with three sellers' offers and available keys; `withCount('availableKeys')` returns the right stock; marking one key sold lowers it by one, verifies **AC-2**, **AC-3**, **AC-8**
- Failure case: inserting a duplicate key code, a key with `order_item_id` set but no `sold_at`, a second offer for the same product and seller, a second order with the same idempotency key, a zero quantity cart line, and an offer in `USD` each throw a `QueryException`, verifies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-7**. Write **one expected violation per test** (a dataset is fine). In Postgres, the first failed statement aborts the test's transaction, so a second statement in the same test would error for the wrong reason.
- Failure case: deleting a product, offer, or order that order items or sold keys reference throws; deleting a user removes their cart lines, verifies **AC-4**, **AC-6**
- Snapshot: after creating an order item, renaming the product and seller leaves the item's stored names unchanged, verifies **AC-6**
- Schema: after `migrate`, every expected table and column exists, verifies **AC-1**. Test rollback in one isolated test that does not use the shared `RefreshDatabase` transaction (for example, run `migrate:rollback` for this feature's migrations, then `migrate` again, and restore the schema at the end), so the schema never disappears under other tests.
- Auth/permission: not applicable at schema level; ownership checks are tested in features 9 to 12.

## Build plan

Approach: Journey. This is a foundation every journey stands on, so the whole target schema lands in this one feature (you chose this), and no journey later changes it in a breaking way.

1. Create backed enums `App\Enums\ProductType` (`game`, `dlc`, `gift_card`, `subscription`) and `App\Enums\OrderStatus` (`paid`), satisfies **AC-8**
2. Write the catalog migrations: `platforms`, `regions`, `sellers`, `products`, `offers`, with their checks and indexes, satisfies **AC-1**, **AC-2**, **AC-7**
3. Write the order and key migrations: `orders`, `order_items`, `product_keys` (with the sold state check and the partial index), satisfies **AC-1**, **AC-3**, **AC-5**, **AC-6**, **AC-7**
4. Write the `cart_items` migration, satisfies **AC-1**, **AC-4**
5. Add the nine models with relations, casts, scopes, the ULID setup on `Order`, and `cartItems()` / `orders()` on `User`, satisfies **AC-3**, **AC-5**, **AC-8**
6. Add a factory per model, including `ProductKey` `sold()` and `Offer` / `Product` `inactive()` states, satisfies **AC-8**
7. Write the Pest schema tests from *Critical test scenarios*, satisfies **AC-1** to **AC-7**
8. Run `composer format`, `composer analyse`, and `php artisan test`, then push and confirm CI is green, satisfies **AC-9**

## Consequences

**Positive**:
- The database itself rejects duplicate keys, double orders, bad money, and broken key states, so a bug in one code path cannot corrupt purchases.
- Stock and prices are counted from real rows, so they can never drift out of sync.
- Order history renders from the order alone and stays correct if the catalog changes.
- Every later feature adds code on top of a finished schema; there is no breaking migration ahead.

**Negative / tradeoffs**:
- The same game on two platforms or regions is two product rows with repeated description and publisher text.
- Stock is an aggregate query per offer. That is fine for a few hundred offers but would need a counter or cache at real marketplace scale.
- Key codes are plain text. A database leak would expose every unsold key. Acceptable for fake seed data; the README should say a real store encrypts them.
- Check constraints and the partial index are Postgres specific raw SQL, which ties tests to Postgres (already the project rule).
- `order_items.product_id` duplicates what the offer already knows. It is kept for simple best seller queries and direct links, and code must always copy it from the offer.
- Declined payments leave no record, so there is no history of failed attempts.

**Neutral**:
- Natural keys for idempotent seeding (spec 0001 rule): `platforms.slug`, `regions.slug`, `sellers.slug`, `products.slug`, offers by (`product_id`, `seller_id`), keys by `code`.
- Sanctum's `personal_access_tokens` table arrives with the authentication feature (7), not here.

## Follow-up

- [ ] Seed catalog (feature 5): upsert by the natural keys above, and build slugs by the rule above. Best sellers reflect real order data, so decide there whether the seed also creates a few demo orders (otherwise the block starts empty).
- [ ] Cart (feature 9): settle the merge rules. The cross check suggests an upsert on (`user_id`, `offer_id`) that sums quantities and caps them at stock and a maximum per line, drops lines for unknown or inactive offers, and flags lines that are out of stock on read.
- [ ] Checkout (feature 10): decide how the client sends `idempotency_key` and what a repeated request returns. Suggested: on unique violation `23505`, catch it **outside** the `DB::transaction` closure, load the existing order by key, and return it; delete cart lines inside the successful transaction.
- [ ] Key delivery (feature 11): settle allocation. Suggested: insert the order item first, then `SELECT ... WHERE offer_id = ? AND order_item_id IS NULL ORDER BY id LIMIT n FOR UPDATE SKIP LOCKED`, then update those keys in the same transaction; fewer keys than requested rolls back with a stock error.
- [ ] Store catalog (feature 13): define one `Product::withCheapestPrice()` scope (lowest active, in stock offer price) used by every list endpoint, and decide how products with no sellable offer show (suggested: listed as out of stock with a null price, sorted last).
- [ ] Search (feature 14): a migration runs `CREATE EXTENSION IF NOT EXISTS pg_trgm` and adds the trigram index on `products.name`; confirm it runs on Neon, in CI, and on `eneba_test`. This is additive.
- [ ] Homepage blocks (feature 15): design the `banners` table, and pin the deal threshold, discount rounding, block size, and best sellers fallback when there are no orders.
- [ ] Submission README (feature 16): mention plain text keys and listing per platform and region as conscious tradeoffs.
- [ ] Check the Laravel 13 docs for native check constraint and partial index support in Blueprint, and for `HasUlids` with `uniqueIds()` on a non primary key column, before writing the migrations.
