# Verify: Data model · spec 0002 · updated 2026-11-11
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands
- [ ] `docker compose up -d`, then `cd server && php artisan migrate` on an empty database → the nine tables are created after `users`, with no errors → AC-1
- [ ] `psql` on the dev DB: `select conname from pg_constraint where contype in ('c','u','f') and conrelid::regclass::text in (...)` → every named check (`<table>_<column>_check`, `product_keys_sold_state_check`), unique, and FK from the spec table; FKs restrict, except `cart_items` user and offer, which cascade → AC-1, AC-4, AC-6
- [ ] `select pg_get_indexdef('product_keys_available_offer_id_index'::regclass)` → `(offer_id) WHERE (order_item_id IS NULL)` → AC-1, AC-3
- [ ] `php artisan migrate:rollback --path=database/migrations/2026_11_11_1000*` style rollback of the nine files (see `tests/Migrations/RollbackTest.php`) → the nine tables are gone, `users` stays; `migrate` brings them back → AC-1
- [ ] In `php artisan tinker`: create two offers with the same `product_id` and `seller_id` → `QueryException` naming `offers_product_id_seller_id_unique`; a second seller on the same product succeeds → AC-2
- [ ] In tinker: a key with `order_item_id` set and `sold_at` null (and the reverse) → `product_keys_sold_state_check`; a duplicate `code` → `product_keys_code_unique` → AC-3
- [ ] `Schema::getColumnListing('offers')` has no stock column, and `Offer::withCount('availableKeys')` changes by exactly one when one key is sold → AC-3 · Value sourcing: offer stock
- [ ] In tinker: a second cart line for the same user and offer → unique violation; `quantity = 0` → `cart_items_quantity_check`; deleting the user removes their lines → AC-4
- [ ] `Order::factory()->create()` → `ulid` is 26 characters, `id` is an integer, `getRouteKey()` returns the ulid; a second order with the same `user_id` and `idempotency_key` → `orders_user_id_idempotency_key_unique`; a different user with the same key succeeds → AC-5 · Value sourcing: order ulid
- [ ] Create an order item, then rename its product and seller and change the offer price → the item's `product_name`, `seller_name`, `unit_price_cents` are unchanged; `product_id` equals the offer's product; deleting that product or offer → FK violation → AC-6 · Value sourcing: snapshot names, `order_items.product_id`
- [ ] Insert an offer or order with `currency = 'USD'` → the `*_currency_check` constraint fails; every `*_cents` column is `int4`, no `numeric` or float columns → AC-7
- [ ] Every factory creates a valid row; `ProductKey::factory()->sold()` creates exactly one offer and an order item on that same offer; `Product.type` reads back as `ProductType`, `Order.status` as `OrderStatus` → AC-8
- [ ] `cd server && composer format:check && composer analyse && php artisan test` → all green locally → AC-9
- [ ] Push the branch → the CI server job (Pint, PHPStan, Pest on Postgres 17) goes green → AC-9

## Acceptance-criteria coverage
- AC-1: steps 1 to 4 · AC-2: step 5 · AC-3: steps 3, 6, 7 · AC-4: steps 2, 8 · AC-5: step 9 · AC-6: steps 2, 10 · AC-7: step 11 · AC-8: step 12 · AC-9: steps 13, 14
- Value sourcing rows built on later features (cheapest price, discount, best sellers, slug rule, checkout values) are verified in those features, not here.
