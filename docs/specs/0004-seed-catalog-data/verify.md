# Verify: Seed catalog data · spec 0004 · updated 2026-11-11
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones. Run them from `server/` with `docker compose up -d` already done._

## Commands
- [x] `php artisan migrate:fresh --seed` → succeeds; tinker counts show 4 platforms, 3 regions, 8 sellers, 81 products (74 `game`, 7 `dlc`), all active → AC-1
- [x] Tinker: every product has 2 to 5 active offers, distinct sellers, all `EUR` → AC-1
- [x] Tinker: `Product::where('name', 'ilike', '%witcher%')->count()` → 8 → AC-2
- [x] Tinker: spot check `the-witcher-3-wild-hunt-nintendo-europe` → cover URL uses app 292030, developer `CD PROJEKT RED`, release date `2015-05-18` → AC-2
- [x] Tinker: a DLC row (`cyberpunk-2077-phantom-liberty-steam-global`) → cover uses app 1091500, `release_date` is null → AC-2
- [x] Run `php artisan db:seed` twice in a row and compare prices of one product's offers → identical → AC-3
- [x] Tinker: every offer price is 30% to 90% of its title's base price in `database/data/catalog.php`; prices within one product differ; 40% to 80% of products have a list price → AC-3
- [x] Tinker: the three sold out slugs have 0 unsold keys and active offers; every other product has an offer with 5 or more unsold keys → AC-4
- [x] Tinker: all key codes match `^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$` and are unique → AC-4
- [x] Attach 3 keys of one offer to an order item, run `php artisan db:seed` → those keys keep their `order_item_id`, order count unchanged, unsold count back at target, no row counts or ids changed → AC-5
- [x] Edit one title's base price and description in `catalog.php`, run `php artisan db:seed` → same product id shows new description, offer prices change; revert the edit → AC-6
- [x] Set one offer `is_active = false` by hand, run `php artisan db:seed` → still inactive → AC-6
- [x] Run `php artisan db:seed` twice locally → exactly one `test@example.com`, password `password` works with `Hash::check` → AC-7
- [x] `grep -rn "factory(\|fake(\|Faker\\\\" database/seeders` → no matches → AC-7
- [x] Run the spec's *Cover URL check* → prints 29 and no `FAIL` lines → AC-8
- [x] `grep -n COVER_ASPECT_CLASS client/src/components/product/ProductCard.tsx` → `aspect-[2/3]`; `client/design.md` says 2:3 cover → AC-9
- [x] `composer format:check && composer analyse && php artisan test` in `server/`, and all client checks in `client/` → pass locally; then the CI run on the pushed commit is green → AC-10

## UI / manual
- [x] Open the dev `/ui` showcase → product card covers render in a 2:3 frame without awkward cropping → AC-9

## Value sourcing
- [x] Platforms, regions, sellers → change a seller's `rating_count` in the data, reseed, row updates in place → data file
- [x] Product facts → match the Steam app details copied on 2026-11-11 (spot check two titles against the store page) → data file
- [x] `slug` → rename a title in a copy of the data passed to `seedFrom` → new slug row created, old row untouched → derived
- [x] `cover_image_url` → all 81 rows follow the Steam portrait pattern from `steam_app_id` → derived
- [x] `platform_id`, `region_id` → each product's platform and region slugs match its variant in the data → upsert id maps
- [x] `list_price_cents` → equals the recomputed `OfferPlanner` plan (null or base price) → planner
- [x] `is_active` → new rows true; a hand set false survives a rerun → constant on insert only
- [x] Seller set and `price_cents` → equal the recomputed plan; change the base price and the prices move → planner
- [x] `currency` → every offer is `EUR` → constant
- [x] Stock target → unsold count equals the plan; `sold_out` variants are 0 → planner plus flag
- [x] Keys inserted → only `target − unsold`, floored at 0; extra unsold keys never removed → derived
- [x] `code` → random, unique, never printed by the seeder output → `Str::random`
- [x] Key `created_at`, `updated_at` → set (not null) on every seeded key → `now()`
- [x] Local user → absent when seeding with `APP_ENV=production` → constants plus environment guard

## Acceptance-criteria coverage
- AC-1 covered by the first two commands and the `creates the catalog` feature test
- AC-2 covered by the Witcher, spot check, DLC commands, and the `matches the data file` test
- AC-3 covered by the determinism and price commands, the planner unit tests, and the `recomputed plans` test
- AC-4 covered by the sold out and key code commands, and the `planned stock` test
- AC-5 covered by the sales rerun command, and the `reruns` and `keeps sold keys` tests
- AC-6 covered by the edit and inactive commands, and the `updates content` and `turned off by hand` tests
- AC-7 covered by the user and grep commands, and the two user tests plus the no factories test
- AC-8 covered by the Cover URL check
- AC-9 covered by the grep command and the `/ui` showcase step
- AC-10 covered by the full check command (CI still owed after push)
