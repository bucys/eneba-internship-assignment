<?php

namespace Database\Seeders;

use App\Models\Offer;
use App\Models\Platform;
use App\Models\Product;
use App\Models\ProductKey;
use App\Models\Region;
use App\Models\Seller;
use Database\Seeders\Support\OfferPlanner;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Idempotent catalog seed (spec 0004): upserts by natural key and tops up unsold keys.
 * It never deletes a row and never changes is_active on an existing row.
 *
 * @phpstan-type Variant array{platform: string, region: string, sold_out?: bool}
 * @phpstan-type Title array{name: string, type: 'game'|'dlc', steam_app_id: int, developer: string, publisher: string, release_date: ?string, description: string, base_price_cents: int, variants: list<Variant>}
 * @phpstan-type Catalog array{platforms: list<array{slug: string, name: string}>, regions: list<array{slug: string, name: string}>, sellers: list<array{slug: string, name: string, rating_basis_points: int, rating_count: int}>, titles: list<Title>}
 */
class CatalogSeeder extends Seeder
{
    private const KEY_INSERT_CHUNK = 500;

    public function __construct(private readonly OfferPlanner $planner) {}

    public function run(): void
    {
        /** @var Catalog $catalog */
        $catalog = require database_path('data/catalog.php');

        $this->seedFrom($catalog);
    }

    /**
     * @param  Catalog  $catalog
     */
    public function seedFrom(array $catalog): void
    {
        $listings = $this->expandListings($catalog);

        DB::transaction(function () use ($catalog, $listings) {
            $platformIds = $this->upsertPlatforms($catalog['platforms']);
            $regionIds = $this->upsertRegions($catalog['regions']);
            $sellerIds = $this->upsertSellers($catalog['sellers']);

            $productIds = $this->upsertProducts($listings, $platformIds, $regionIds);
            $offers = $this->upsertOffers($listings, $productIds, $sellerIds);

            $this->topUpKeys($offers);
        });
    }

    public static function slugFor(string $name, string $platformSlug, string $regionSlug): string
    {
        return Str::slug("{$name} {$platformSlug} {$regionSlug}");
    }

    public static function coverUrlFor(int $steamAppId): string
    {
        return "https://shared.steamstatic.com/store_item_assets/steam/apps/{$steamAppId}/library_600x900.jpg";
    }

    /**
     * One listing per title × variant, each with its offer plan.
     *
     * @param  Catalog  $catalog
     * @return array<string, array{title: Title, variant: Variant, plan: Support\ProductPlan}>
     */
    private function expandListings(array $catalog): array
    {
        $sellerSlugs = array_column($catalog['sellers'], 'slug');
        $listings = [];

        foreach ($catalog['titles'] as $title) {
            foreach ($title['variants'] as $variant) {
                $slug = self::slugFor($title['name'], $variant['platform'], $variant['region']);

                if (isset($listings[$slug])) {
                    throw new RuntimeException("Catalog data expands to a duplicate product slug: {$slug}");
                }

                $listings[$slug] = [
                    'title' => $title,
                    'variant' => $variant,
                    'plan' => $this->planner->plan(
                        $slug,
                        $title['base_price_cents'],
                        $variant['sold_out'] ?? false,
                        $sellerSlugs,
                    ),
                ];
            }
        }

        return $listings;
    }

    /**
     * @param  list<array{slug: string, name: string}>  $platforms
     * @return array<string, int>
     */
    private function upsertPlatforms(array $platforms): array
    {
        Platform::upsert($platforms, ['slug'], ['name']);

        return Platform::whereIn('slug', array_column($platforms, 'slug'))->pluck('id', 'slug')->all();
    }

    /**
     * @param  list<array{slug: string, name: string}>  $regions
     * @return array<string, int>
     */
    private function upsertRegions(array $regions): array
    {
        Region::upsert($regions, ['slug'], ['name']);

        return Region::whereIn('slug', array_column($regions, 'slug'))->pluck('id', 'slug')->all();
    }

    /**
     * @param  list<array{slug: string, name: string, rating_basis_points: int, rating_count: int}>  $sellers
     * @return array<string, int>
     */
    private function upsertSellers(array $sellers): array
    {
        Seller::upsert($sellers, ['slug'], ['name', 'rating_basis_points', 'rating_count']);

        return Seller::whereIn('slug', array_column($sellers, 'slug'))->pluck('id', 'slug')->all();
    }

    /**
     * @param  array<string, array{title: Title, variant: Variant, plan: Support\ProductPlan}>  $listings
     * @param  array<string, int>  $platformIds
     * @param  array<string, int>  $regionIds
     * @return array<string, int>
     */
    private function upsertProducts(array $listings, array $platformIds, array $regionIds): array
    {
        $rows = [];
        foreach ($listings as $slug => ['title' => $title, 'variant' => $variant, 'plan' => $plan]) {
            $rows[] = [
                'slug' => $slug,
                'name' => $title['name'],
                'type' => $title['type'],
                'platform_id' => $platformIds[$variant['platform']],
                'region_id' => $regionIds[$variant['region']],
                'cover_image_url' => self::coverUrlFor($title['steam_app_id']),
                'description' => $title['description'],
                'release_date' => $title['release_date'],
                'developer' => $title['developer'],
                'publisher' => $title['publisher'],
                'list_price_cents' => $plan->listPriceCents,
                'is_active' => true,
            ];
        }

        $contentColumns = array_values(array_diff(array_keys($rows[0]), ['slug', 'is_active']));
        Product::upsert($rows, ['slug'], $contentColumns);

        return Product::whereIn('slug', array_keys($listings))->pluck('id', 'slug')->all();
    }

    /**
     * @param  array<string, array{title: Title, variant: Variant, plan: Support\ProductPlan}>  $listings
     * @param  array<string, int>  $productIds
     * @param  array<string, int>  $sellerIds
     * @return list<array{offer_id: int, stock_target: int}>
     */
    private function upsertOffers(array $listings, array $productIds, array $sellerIds): array
    {
        $rows = [];
        $targets = [];
        foreach ($listings as $slug => ['plan' => $plan]) {
            foreach ($plan->offers as $offer) {
                $productId = $productIds[$slug];
                $sellerId = $sellerIds[$offer['seller_slug']];

                $rows[] = [
                    'product_id' => $productId,
                    'seller_id' => $sellerId,
                    'price_cents' => $offer['price_cents'],
                    'currency' => 'EUR',
                    'is_active' => true,
                ];
                $targets["{$productId}:{$sellerId}"] = $offer['stock_target'];
            }
        }

        Offer::upsert($rows, ['product_id', 'seller_id'], ['price_cents', 'currency']);

        $offerIds = Offer::whereIn('product_id', array_values($productIds))
            ->get(['id', 'product_id', 'seller_id'])
            ->mapWithKeys(fn (Offer $offer) => ["{$offer->product_id}:{$offer->seller_id}" => $offer->id]);

        $offers = [];
        foreach ($targets as $key => $target) {
            $offers[] = ['offer_id' => (int) $offerIds[$key], 'stock_target' => $target];
        }

        return $offers;
    }

    /**
     * Adds keys until each offer's unsold count reaches its target. Never removes a key.
     *
     * @param  list<array{offer_id: int, stock_target: int}>  $offers
     */
    private function topUpKeys(array $offers): void
    {
        $unsold = ProductKey::available()
            ->whereIn('offer_id', array_column($offers, 'offer_id'))
            ->groupBy('offer_id')
            ->selectRaw('offer_id, count(*) as unsold')
            ->pluck('unsold', 'offer_id');

        $missingByOffer = [];
        foreach ($offers as ['offer_id' => $offerId, 'stock_target' => $target]) {
            $missing = $target - (int) ($unsold[$offerId] ?? 0);
            if ($missing > 0) {
                $missingByOffer[$offerId] = $missing;
            }
        }

        $codes = $this->uniqueCodes(array_sum($missingByOffer));
        $now = now();
        $rows = [];
        foreach ($missingByOffer as $offerId => $missing) {
            foreach (array_splice($codes, 0, $missing) as $code) {
                $rows[] = ['offer_id' => $offerId, 'code' => $code, 'created_at' => $now, 'updated_at' => $now];
            }
        }

        foreach (array_chunk($rows, self::KEY_INSERT_CHUNK) as $chunk) {
            ProductKey::insert($chunk);
        }
    }

    /**
     * Random codes that clash neither with each other nor with keys already in the database.
     *
     * @return list<string>
     */
    private function uniqueCodes(int $count): array
    {
        $seen = [];

        while (count($seen) < $count) {
            $batch = [];
            while (count($seen) + count($batch) < $count) {
                $code = $this->randomCode();
                if (! isset($seen[$code]) && ! isset($batch[$code])) {
                    $batch[$code] = true;
                }
            }

            foreach (array_chunk(array_keys($batch), self::KEY_INSERT_CHUNK) as $chunk) {
                $taken = ProductKey::whereIn('code', $chunk)->pluck('code')->all();
                foreach ($taken as $code) {
                    unset($batch[$code]);
                }
            }

            $seen += $batch;
        }

        return array_map('strval', array_keys($seen));
    }

    private function randomCode(): string
    {
        return implode('-', [
            Str::upper(Str::random(5)),
            Str::upper(Str::random(5)),
            Str::upper(Str::random(5)),
        ]);
    }
}
