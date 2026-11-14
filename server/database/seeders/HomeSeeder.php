<?php

namespace Database\Seeders;

use App\Models\Banner;
use App\Models\HomeBlock;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Idempotent homepage seed (spec 0014 AC-6): upserts the layout by type and banners by product.
 * Updates touch content columns only, so a row hidden by hand stays hidden after a reseed.
 *
 * @phpstan-type BannerRow array{product_slug: string, title: string, tagline: string, cta_label: string, image?: string, position: int}
 * @phpstan-type HomeData array{banners: list<BannerRow>}
 */
class HomeSeeder extends Seeder
{
    /**
     * The homepage layout, in display order.
     */
    public const BLOCKS = [
        ['type' => 'banners', 'title' => 'Featured', 'position' => 1],
        ['type' => 'best_sellers', 'title' => 'Best sellers', 'position' => 2],
        ['type' => 'deals', 'title' => 'Deals', 'position' => 3],
        ['type' => 'products', 'title' => 'Browse games', 'position' => 4],
    ];

    public function run(): void
    {
        /** @var HomeData $home */
        $home = require database_path('data/home.php');

        $this->seedFrom($home);
    }

    /**
     * @param  HomeData  $home
     */
    public function seedFrom(array $home): void
    {
        $this->assertImagesExist($home['banners']);

        DB::transaction(function () use ($home) {
            $this->upsertBlocks();
            $this->upsertBanners($home['banners']);
        });
    }

    private function upsertBlocks(): void
    {
        $rows = array_map(fn (array $block) => [...$block, 'is_active' => true], self::BLOCKS);

        HomeBlock::upsert($rows, ['type'], ['title', 'position']);
    }

    /**
     * Checked before any write, so a missing file never leaves a banner pointing at a 404.
     *
     * @param  list<BannerRow>  $banners
     */
    private function assertImagesExist(array $banners): void
    {
        foreach ($banners as $banner) {
            $image = $banner['image'] ?? null;

            if ($image !== null && ! is_file(public_path($image))) {
                throw new RuntimeException("Home banner image is missing: public/{$image}");
            }
        }
    }

    /**
     * @param  list<BannerRow>  $banners
     */
    private function upsertBanners(array $banners): void
    {
        $products = Product::whereIn('slug', array_column($banners, 'product_slug'))
            ->get(['id', 'slug', 'cover_image_url', 'is_active'])
            ->keyBy('slug');

        $rows = [];
        foreach ($banners as $banner) {
            $product = $products->get($banner['product_slug']);

            if ($product === null) {
                throw new RuntimeException("Home banner names an unknown product: {$banner['product_slug']}");
            }

            if (! $product->is_active) {
                throw new RuntimeException("Home banner names an inactive product: {$banner['product_slug']}");
            }

            $rows[] = [
                'product_id' => $product->id,
                'title' => $banner['title'],
                'tagline' => $banner['tagline'],
                'cta_label' => $banner['cta_label'],
                'image_url' => isset($banner['image']) ? url($banner['image']) : $product->cover_image_url,
                'position' => $banner['position'],
                'is_active' => true,
            ];
        }

        Banner::upsert($rows, ['product_id'], ['title', 'tagline', 'cta_label', 'image_url', 'position']);
    }
}
