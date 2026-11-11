# 0004. Seed catalog: curated PHP data file, deterministic offer planner, idempotent upserts

**Date**: 2026-11-11
**Status**: In Progress

## Summary

This spec fills the database with a believable store: 30 real games plus 4 DLC, sold as 81 listings across Steam, Xbox, PlayStation, and Nintendo in three regions. Each listing gets offers from 2 to 5 of 8 made up sellers, plus a pool of fake keys. You write the games by hand in one PHP data file. A small planner class then works out sellers, prices, discounts, and stock from each listing's slug, so every run gives the same numbers. The seeder is idempotent (safe to run again and again): it updates rows in place and only tops up unsold keys, so you can run it against production without touching orders.

## Requirements

**User stories**:
- As a visitor, I want a catalog of real, recognizable games with real cover art so that the store feels like Eneba.
- As a buyer, I want several sellers per listing with different prices, discounts, and stock so that comparing offers means something.
- As the developer, I want one command that resets and seeds my local database so that I can start every feature from known data.
- As the developer, I want to rerun the seed in production safely so that I can fix catalog data or restock keys without losing orders.

**Acceptance criteria** (the contract, each one independently checkable):
- **AC-1**: On an empty local database, `php artisan migrate:fresh --seed` succeeds and creates exactly 4 platforms, 3 regions, 8 sellers, and 81 products (74 of type `game`, 7 of type `dlc`, none `gift_card` or `subscription`), all `is_active = true`. Every product has 2 to 5 active offers, each from a different seller, all in `EUR`.
- **AC-2**: Products match the *Catalog* table below: one row per listed variant, `name` exactly as listed, `slug` equal to `Str::slug("{name} {platform slug} {region slug}")`, `cover_image_url` equal to `https://shared.steamstatic.com/store_item_assets/steam/apps/{appId}/library_600x900.jpg` with the listed Steam app ID (DLC uses its parent game's ID), `developer`, `publisher`, and a non empty original `description` filled on every row, and `release_date` filled on every `game` row. `Product::where('name', 'ilike', '%witcher%')->count()` returns 8. No two rows in the data expand to the same slug.
- **AC-3**: Prices are deterministic (the same on every run) and follow the *Offer plan rules*: every offer's `price_cents` is between 30% and 90% of its product's base price, offer prices within one product are all different, and a product's `list_price_cents` is either `null` or exactly its base price. Between 40% and 80% of products have a list price. `OfferPlanner::plan` returns equal plans for equal input, and the seeded `list_price_cents`, offer seller sets, and offer prices match the plans recomputed from the data file. (Base prices are not stored, so tests read them from the data file.)
- **AC-4**: After a fresh seed, each offer's unsold key count equals its planned stock target (recomputed from the data file, as in AC-3). The three sold out products, `hades-nintendo-north-america`, `call-of-duty-modern-warfare-iii-playstation-north-america`, and `starfield-xbox-europe`, have 0 unsold keys on every offer, and their offers stay `is_active = true` (so the out of stock state is testable). Every other product has at least one offer with 5 or more unsold keys. At least 10 offers have a target of 0, and at least 10 offers have a target of 1 or 2. Key codes match `^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$` and are all unique. (A simulation of the planner on this catalog gave 287 offers, 59% list prices, 34 zero targets, and 26 low targets, so these thresholds hold. If a later data edit breaks one, tune the threshold in the test, not the planner.)
- **AC-5**: Running `php artisan db:seed` a second time succeeds and changes no row counts in `platforms`, `regions`, `sellers`, `products`, `offers`, or `users`, and no product or offer `id`. If keys were sold in between (attached to an order item), the rerun leaves those keys, `orders`, `order_items`, and `cart_items` exactly as they were, and adds only enough new keys to bring each offer's unsold count back to its target. It never deletes a key, even when an offer has more unsold keys than its target.
- **AC-6**: The data file wins for content: after changing a title's base price, `description`, `developer`, `publisher`, or `release_date` in the data passed to the seeder and seeding again, the existing rows (same `id`, matched by `slug`) and their offers show the new values. Changing a `name` changes the slug, so it creates a new listing. A product row whose slug is no longer in the data (including the old row after a rename) is left unchanged, not deleted or deactivated. A rerun never changes `is_active` on an existing product or offer, so anything you turned off by hand stays off.
- **AC-7**: Outside production, seeding creates the local account `test@example.com` (password `password`) once and reuses it on later runs. With `APP_ENV=production`, seeding creates no user. No seeder uses model factories or Faker, so `db:seed` works without dev dependencies installed.
- **AC-8**: All 29 distinct cover URLs in the data file return HTTP 200 with an `image/jpeg` content type (checked by hand with the *Cover URL check* below, not in CI, since CI must not depend on Steam).
- **AC-9**: `ProductCard`'s `COVER_ASPECT_CLASS` is `aspect-[2/3]`, and `client/design.md` describes the card cover as 2:3.
- **AC-10**: `composer format:check`, `composer analyse`, and `php artisan test` pass in `server/`. All client checks (`npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`) pass, both locally and in CI.

## Decision

**Chosen option**: Option 1: Curated PHP data file plus a deterministic offer planner, written with idempotent upserts.

Real catalog content lives in `server/database/data/catalog.php`. A pure `OfferPlanner` class derives each product's offers, prices, list price, and stock from a random generator seeded by the product slug. `CatalogSeeder` upserts everything by natural key in one transaction and tops up unsold keys to target.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

No schema change. The seed writes the tables from [spec 0002](../0002-data-model/index.md) and reads nothing else. Content comes from one PHP file, `server/database/data/catalog.php`, which returns:

```php
return [
    'platforms' => [['slug' => 'steam', 'name' => 'Steam'], /* ... */],
    'regions'   => [['slug' => 'global', 'name' => 'Global'], /* ... */],
    'sellers'   => [['slug' => 'pixel-vault', 'name' => 'Pixel Vault', 'rating_basis_points' => 9950, 'rating_count' => 48210], /* ... */],
    'titles'    => [
        [
            'name' => 'The Witcher 3: Wild Hunt',
            'type' => 'game',               // 'game' | 'dlc'
            'steam_app_id' => 292030,       // DLC: the parent game's ID
            'developer' => 'CD PROJEKT RED',
            'publisher' => 'CD PROJEKT RED',
            'release_date' => '2015-05-18',
            'description' => 'One or two original sentences.',
            'base_price_cents' => 2999,
            'variants' => [
                ['platform' => 'steam', 'region' => 'global'],
                ['platform' => 'xbox', 'region' => 'europe'],
                ['platform' => 'nintendo', 'region' => 'europe'],
            ],
        ],
        // a variant may add 'sold_out' => true
    ],
];
```

Type it for PHPStan level 6 with a `@phpstan-type Catalog array{platforms: list<array{slug: string, name: string}>, regions: list<...>, sellers: list<array{slug: string, name: string, rating_basis_points: int, rating_count: int}>, titles: list<array{name: string, type: 'game'|'dlc', steam_app_id: int, developer: string, publisher: string, release_date: ?string, description: string, base_price_cents: int, variants: list<array{platform: string, region: string, sold_out?: bool}>}>}` declared on `CatalogSeeder`, plus `/** @var Catalog $catalog */` at the `require` in `run()`. `seedFrom` takes `@param Catalog $catalog`. Each `title` × `variant` becomes one `products` row.

**Platforms** (`slug`, `name`): `steam` Steam · `xbox` Xbox · `playstation` PlayStation · `nintendo` Nintendo.

**Regions** (`slug`, `name`): `global` Global · `europe` Europe · `north-america` North America.

**Sellers** (made up names, no real Eneba sellers):

| slug | name | rating_basis_points | rating_count |
|---|---|---|---|
| `pixel-vault` | Pixel Vault | 9950 | 48210 |
| `keystone-games` | Keystone Games | 9870 | 23140 |
| `nordic-keys` | Nordic Keys | 9810 | 12876 |
| `game-harbor` | Game Harbor | 9720 | 8411 |
| `level-up-deals` | Level Up Deals | 9560 | 3207 |
| `checkpoint-market` | Checkpoint Market | 9430 | 1189 |
| `loot-lane` | Loot Lane | 9180 | 342 |
| `byte-bazaar` | Byte Bazaar | 8850 | 57 |

**Catalog** (S Steam, X Xbox, P PlayStation, N Nintendo; G Global, EU Europe, NA North America). Every app ID below was checked on 2026-11-11: its `library_600x900.jpg` returned 200, and the Steam store's app details named the matching game.

| # | Name | Type | Steam app ID | Base € | Variants (platform/region) |
|---|---|---|---|---|---|
| 1 | The Witcher 3: Wild Hunt | game | 292030 | 29.99 | S/G, X/EU, N/EU |
| 2 | The Witcher 3: Wild Hunt Complete Edition | game | 292030 | 49.99 | S/G, P/EU |
| 3 | Cyberpunk 2077 | game | 1091500 | 59.99 | S/G, X/EU, P/NA |
| 4 | Elden Ring | game | 1245620 | 59.99 | S/G, X/NA, P/EU |
| 5 | Red Dead Redemption 2 | game | 1174180 | 59.99 | S/G, X/EU, P/EU |
| 6 | Grand Theft Auto V | game | 271590 | 29.99 | S/G, X/NA, P/EU |
| 7 | Baldur's Gate 3 | game | 1086940 | 59.99 | S/G, P/EU |
| 8 | Hogwarts Legacy | game | 990080 | 59.99 | S/G, X/EU, N/EU |
| 9 | Hades | game | 1145360 | 24.99 | S/G, N/NA **sold out** |
| 10 | Hollow Knight | game | 367520 | 14.99 | S/G, N/EU, X/NA |
| 11 | Stardew Valley | game | 413150 | 13.99 | S/G, N/EU |
| 12 | Forza Horizon 5 | game | 1551360 | 59.99 | S/G, X/EU |
| 13 | Sea of Thieves | game | 1172620 | 39.99 | S/G, X/NA, P/EU |
| 14 | It Takes Two | game | 1426210 | 39.99 | S/G, P/EU, N/EU |
| 15 | Split Fiction | game | 2001120 | 49.99 | S/G, X/EU, P/NA |
| 16 | EA Sports FC 25 | game | 2669320 | 69.99 | S/G, X/EU, P/EU |
| 17 | Call of Duty: Black Ops III | game | 311210 | 39.99 | S/G, X/NA, P/EU |
| 18 | Call of Duty: Modern Warfare III | game | 2519060 | 69.99 | S/G, P/NA **sold out** |
| 19 | Assassin's Creed Valhalla | game | 2208920 | 59.99 | S/EU, X/EU |
| 20 | Assassin's Creed Mirage | game | 3035570 | 49.99 | S/G, P/EU |
| 21 | Sekiro: Shadows Die Twice | game | 814380 | 59.99 | S/G, X/EU |
| 22 | Resident Evil 4 | game | 2050650 | 39.99 | S/G, P/EU, X/NA |
| 23 | Diablo IV | game | 2344520 | 69.99 | S/G, X/EU |
| 24 | Starfield | game | 1716740 | 69.99 | S/G, X/EU **sold out** |
| 25 | God of War | game | 1593500 | 49.99 | S/G, P/EU |
| 26 | Ghost of Tsushima Director's Cut | game | 2215430 | 59.99 | S/G, P/NA |
| 27 | The Elder Scrolls V: Skyrim Special Edition | game | 489830 | 39.99 | S/G, X/EU, N/NA |
| 28 | Celeste | game | 504230 | 19.99 | S/G, N/EU |
| 29 | Black Myth: Wukong | game | 2358720 | 59.99 | S/G, P/EU |
| 30 | Helldivers 2 | game | 553850 | 39.99 | S/G, P/EU |
| 31 | The Witcher 3: Wild Hunt Hearts of Stone | dlc | 292030 | 9.99 | S/G |
| 32 | The Witcher 3: Wild Hunt Blood and Wine | dlc | 292030 | 19.99 | S/G, X/EU |
| 33 | Cyberpunk 2077: Phantom Liberty | dlc | 1091500 | 29.99 | S/G, P/EU |
| 34 | Elden Ring Shadow of the Erdtree | dlc | 1245620 | 39.99 | S/G, X/EU |

That is 74 game rows and 7 DLC rows (81 products). A *sold out* mark applies only to that one variant (for example Starfield on Xbox Europe), not to the title's other variants.

**Title facts**: during the build, copy `developer` (first listed), `publisher` (first listed), and `release_date` once from the Steam store's public app details for the listed app ID, and write them into the data file by hand. Every variant of a title shares the Steam `release_date` (a stated simplification: for example, the Switch Witcher 3 shipped later). The Complete Edition uses the same app ID, so it takes the base game's facts. If the build has no web access, stop and ask the developer for the facts; never invent them. DLC rows take the parent game's `developer` and `publisher`. Their `release_date` stays `null` unless you confirm it on the DLC's own Steam store page (the column is nullable; never guess a date). Write each `description` yourself: one or two original sentences, never copied from a store page. The seeder never calls Steam.

**Offer plan rules** (`Database\Seeders\Support\OfferPlanner`, a pure class with no database access):

`plan(string $productSlug, int $basePriceCents, bool $soldOut, list<string> $sellerSlugs): ProductPlan`

`$sellerSlugs` is always the data file's `sellers` slugs in file order (never a database query, whose order is not guaranteed). `shuffleArray` depends on input order, so adding, removing, or reordering sellers is frozen after the production seed, just like the draw order.

`ProductPlan` is a `final readonly` class with `public ?int $listPriceCents` and `public array $offers` typed `list<array{seller_slug: string, price_cents: int, stock_target: int}>`. The seeder and the tests both use these names.

1. Create `new \Random\Randomizer(new \Random\Engine\Mt19937(crc32($productSlug)))`. Seeding by slug keeps each product's numbers stable even when other products are added or reordered.
2. Draw in this fixed order, from that one randomizer:
   1. Offer count `n = getInt(2, 5)`.
   2. Sellers: `shuffleArray($sellerSlugs)`, take the first `n`.
   3. For each chosen seller, in that order: price `intdiv($basePriceCents * getInt(31, 89), 100)`. If that price is already used in this product, subtract 1 cent until it is unique. (Drawing 31 to 89 leaves room for those few cents, so every price stays within 30% to 90% even for the cheapest €9.99 title.)
   4. For each chosen seller, in that order: stock roll `r = getInt(1, 100)`: `r ≤ 10` → 0; `r ≤ 20` → `getInt(1, 2)`; else `getInt(5, 30)`.
   5. List price roll `getInt(1, 100) ≤ 60` → `list_price_cents = basePriceCents`, else `null`.
3. Then apply overrides: if `soldOut`, every stock target is 0. Otherwise, if no offer has a target of 5 or more, set the first offer's target to 10.
4. Return a `ProductPlan`.

Do not let the fixed draw order change once seeded data is in production: changing it changes every price and seller set on the next rerun (see Consequences).

**Seeder structure**:

- `DatabaseSeeder::run()`: calls `CatalogSeeder`. Then, only when `! app()->isProduction()`, runs `User::firstOrCreate(['email' => 'test@example.com'], ['name' => 'Test User', 'password' => 'password'])`. `User` already has the `hashed` cast and `password` is fillable, so the password is hashed. Check `app()->isProduction()` inside `run()`, not a constructor. No factories.
- `CatalogSeeder::run()`: `$this->seedFrom(require database_path('data/catalog.php'))`.
- `CatalogSeeder::seedFrom(array $catalog)` (public, so tests can pass changed data): first expands titles × variants into product rows and throws an exception if two rows share a slug (Postgres would otherwise fail the whole upsert with "cannot affect row a second time"). Then, inside one `DB::transaction`, in order:
  1. `Platform::upsert(..., ['slug'], ['name'])`, the same for `Region`, and `Seller::upsert(..., ['slug'], ['name', 'rating_basis_points', 'rating_count'])`. Then load `slug → id` maps with `whereIn('slug', <this run's slugs>)->pluck('id', 'slug')`.
  2. Product rows: slug by the rule above, cover URL from the app ID, `list_price_cents` from the plan, `is_active = true`. Then `Product::upsert(..., ['slug'], [content columns])`, where the update list is every column except `slug` and `is_active`. That way `is_active` is set on insert only. Load `slug → id` with `whereIn`, limited to this run's slugs.
  3. Offer rows from each plan, with `currency = 'EUR'` and `is_active = true`: `Offer::upsert(..., ['product_id', 'seller_id'], ['price_cents', 'currency'])` (again no `is_active` on update). Load the offers for this run's product ids, keyed `"{product_id}:{seller_id}"`.
  4. Key top up: load unsold counts with one grouped query on `ProductKey::available()->whereIn('offer_id', $offerIds)`. For each offer, `missing = target − unsold`. If `missing > 0`, build that many codes: three separate `Str::upper(Str::random(5))` calls joined by `-`. Check each against a `$seen` set holding this run's new codes plus any existing codes that match (one `whereIn('code', ...)` query per batch); regenerate on a clash, so a duplicate can never abort the transaction. Insert with `ProductKey::insert()` in chunks of 500 (for readability; the size is far under Postgres' parameter limit), with `created_at`/`updated_at` set to `now()`.

  Eloquent `upsert` skips casts and mass assignment, so every value is a plain scalar: `type` is the string `'game'` or `'dlc'` (not a `ProductType` case), `release_date` is a `Y-m-d` string or `null`, and every row in one call has the same keys (include nullable columns as `null`). `upsert` sets `created_at` on insert and refreshes `updated_at` on every rerun. Plain `insert` for keys sets no timestamps, which is why step 4 sets them. `ON CONFLICT` uses up sequence values on every rerun, so ids will have gaps; nothing may assume contiguous ids.

**Cover URL check** (run by hand from `server/` after a local seed, for AC-8; prints only failures, so empty output is a pass):

```bash
php artisan tinker --execute="foreach (App\Models\Product::query()->distinct()->pluck('cover_image_url') as \$u) { echo \$u.PHP_EOL; }" \
  | grep '^https://' | tee /dev/stderr | wc -l    # expect 29
php artisan tinker --execute="foreach (App\Models\Product::query()->distinct()->pluck('cover_image_url') as \$u) { echo \$u.PHP_EOL; }" \
  | grep '^https://' | while read -r url; do
      result=$(curl -sL --max-time 15 -o /dev/null -w "%{http_code} %{content_type}" "$url")
      case "$result" in "200 image/jpeg"*) ;; *) echo "FAIL $result $url" ;; esac
    done
```

**Commands**:
- Local reset: `php artisan migrate:fresh --seed` (production blocks it already, via spec 0001's guard).
- Production (feature 6): `APP_ENV=production DB_URL=<neon direct url> php artisan db:seed --force`, run from your machine per spec 0001. Pass `DB_URL` inline, so it never lands in `.env`, and add a leading space so it stays out of shell history (with zsh's `HIST_IGNORE_SPACE` set). Use Neon's direct host, not the pooled one, because the pooler can break PDO prepared statements.

**State transitions**: none new. Keys enter the existing `available` state only; the seed never sells or unsells a key.

**API surface**: none. This feature adds no endpoints; feature 6 serves the first product read.

**Value sourcing**:

| Action | Value produced | Source |
|---|---|---|
| Seed platforms, regions, sellers | slug, name, rating, rating count | data file |
| Seed products | `name`, `type`, `developer`, `publisher`, `release_date`, `description` | data file (facts copied once from Steam app details at build time) |
| Seed products | `slug` | derived: `Str::slug("{name} {platform slug} {region slug}")` (spec 0002) |
| Seed products | `cover_image_url` | derived: the Steam portrait URL pattern from the data file's `steam_app_id` |
| Seed products | `platform_id`, `region_id` | the variant's slugs mapped to ids after the platform and region upserts |
| Seed products | `list_price_cents` | `OfferPlanner`: the data file's `base_price_cents` or `null` |
| Seed products, offers | `is_active` | constant `true` |
| Seed offers | seller set, `price_cents` | `OfferPlanner`, seeded by product slug, from `base_price_cents` |
| Seed offers | `currency` | constant `EUR` |
| Seed keys | stock target | `OfferPlanner`, plus the variant's `sold_out` flag |
| Seed keys | number of keys inserted | derived: target − current unsold count, floored at 0 |
| Seed keys | `code` | `Str::random` (cryptographically random, not seeded, so codes are unguessable from the public repo) |
| Seed keys | `created_at`, `updated_at` | `now()` at insert |
| Local user | email, name, password | constants in `DatabaseSeeder` |

**Key invariants**:
- Seeding is idempotent: a rerun with unchanged data changes no counts, ids, prices, or seller sets.
- The seed never writes `orders`, `order_items`, or `cart_items`, never updates or deletes a `product_keys` row, and never deletes any row.
- After a fresh seed with an unchanged planner, every product has 2 to 5 offers from distinct sellers (the DB unique constraint covers distinctness), and every offer price is 30% to 90% of its base price.
- Product slugs are unique within the data (checked in `seedFrom` before any write).
- A rerun never changes `is_active` on an existing row.
- A key's `order_item_id` and `sold_at` stay `null` on insert (spec 0002's sold state check).
- The whole catalog seed is one transaction: a failure leaves the database as it was before.

**Security model**: the seed is a developer command, never reachable over HTTP. Key codes are random, stay in the database, and are never printed or logged by the seeder. The only credential is the local test account, which production never gets. No secrets or env vars are added.

**Configuration required**: none.

**Critical test scenarios** (Pest, `tests/Feature/Seed/` and `tests/Unit/Seed/`, against `eneba_test`):
- Happy path: seed once, then assert the counts, type split, offers per product, slug and cover URL rules, and the "witcher" match count. Verifies **AC-1**, **AC-2**.
- Determinism and price rules: `OfferPlanner::plan` returns equal plans for the same input (unit test, `tests/Unit/Seed/`, no app or database needed). In a feature test, seed once, then load `database/data/catalog.php` and recompute each product's plan with the data file's seller order. The seeded list prices, seller sets, and prices must equal the plans, and each price must be within 30% to 90% of the base. Verifies **AC-3**.
- Stock: after one seed, the unsold count per offer equals the recomputed plan target, plus the sold out slugs, minimum stock, low stock, and key code format rules. Verifies **AC-4**.
- Failure case, rerun after sales: seed, sell 3 keys of one offer by attaching them to a factory order item, seed again. The sold keys are unchanged (same ids, same `order_item_id`), the order count is unchanged, and unsold keys are back at target. Assert counts and ids only, since `updated_at` changes on every rerun. Verifies **AC-5**.
- Data file wins: `seedFrom` with one title's base price and description changed updates the same ids. A renamed title creates a new slug while the old row stays untouched. An offer set to `is_active = false` by hand is still inactive after a rerun. Verifies **AC-6**.
- Environment guard: inside the one test, set `$this->app['env'] = 'production'` (never `putenv` or `$_ENV`, which leak across tests; each test boots a fresh app, and `AppServiceProvider` resets the destructive command flag). `DatabaseSeeder` then creates no user. Outside production, two runs leave exactly one `test@example.com`. Verifies **AC-7**.

## Build plan

Journey approach: this is a foundation feature with no user path of its own, so it is built as one complete slice, from data to tests, before feature 6 starts.

1. Write `server/database/data/catalog.php`: platforms, regions, sellers, and the 34 titles with variants, sold out flags, base prices, facts from Steam app details, and original descriptions, plus its PHPDoc array shape. Satisfies **AC-2**.
2. Build `Database\Seeders\Support\OfferPlanner` (and its small `ProductPlan` value object or array shape), with unit tests for determinism and the rules. Satisfies **AC-3**, **AC-4**.
3. Build `CatalogSeeder` (`run` and `seedFrom`: upserts, id maps, key top up, one transaction), and rewrite `DatabaseSeeder` (call the catalog seeder, local only `firstOrCreate` user, no factories). Satisfies **AC-1**, **AC-5**, **AC-6**, **AC-7**.
4. Write the feature tests: happy path, stock, rerun after sales, data wins, and the environment guard. Satisfies **AC-1** to **AC-7**.
5. Client: change `COVER_ASPECT_CLASS` to `aspect-[2/3]` and the 3:4 line in `client/design.md`. Then run the *Cover URL check* and every server and client check. Satisfies **AC-8**, **AC-9**, **AC-10**.

## Consequences

**Positive**:
- Real titles and real art make search, filters, and the product page look like Eneba from day one, with no image files or API keys in the repo.
- One readable data file is the whole catalog. You can explain every row and every price rule.
- Production reruns are safe: they fix typos, restock demo keys, and never touch orders.

**Negative / tradeoffs**:
- Covers are hotlinked (loaded straight from Steam's servers). If Steam moves or removes an image, the card shows its placeholder. The art belongs to its publishers; the README should say it is used for a non commercial demo.
- Changing `OfferPlanner`'s draw order, or the seller list, reshuffles prices and seller sets on the next rerun. Offers that drop out of a plan stay in the table (rows are never deleted), so a product could end up with more than 5 offers. Treat the planner as frozen once production is seeded.
- Unsold keys above a lowered target are never removed, so lowering stock, or marking a variant `sold_out` after it already has keys, has no effect until those keys sell.
- Renaming a title creates a new listing and leaves the old one live with its offers and keys. To retire the old one, set `is_active = false` by hand (reruns keep it off).
- New rows from the data file always start active, but a rerun never reactivates a row you turned off.
- The seeded `Randomizer` output must stay stable on the PHP version of the machine that runs the production seed. A PHP upgrade there could shift prices on the next rerun. The tests check rules, not exact prices.
- Best sellers has no order data until real purchases happen. Feature 15 owns that gap.
- Title facts are a one time copy. If Steam data changes, the file goes stale, which is acceptable for a demo.

**Neutral**:
- The card ratio moves from 3:4 to 2:3 (one constant); `ProductFactory`'s Picsum URL stays 600×800, which only affects tests.
- This spec amends one rule in spec 0001's *Prod data seeding* row: keys are topped up to target, rather than added only to offers with no keys.
- Seeding writes about 280 offers and about 4,000 keys. Batched inserts keep a full seed to a few seconds.

## Follow-up

- [ ] Spec 0001, *Prod data seeding*: its wording "add keys only to offers that have none" is now superseded by this spec's top up rule. Add a pointer there to 0004 (or let `/sync` flag it).
- [ ] Feature 15 (homepage blocks): decide whether to seed demo orders for best sellers. Reuse the checkout and key allocation code from features 10 and 11, not a copy in the seeder.
- [ ] Feature 16 (submission package): the README credits the cover art source and notes it is hotlinked for a non commercial demo, and that key codes are fake and stored in plain text.
- [ ] Feature 6 (walking skeleton): run `php artisan db:seed --force` against Neon after the first deploy, then run the cover URL check once against production data.
