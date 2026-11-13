<?php

use App\Models\Banner;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

function homeBanner(Product $product, int $position, array $attributes = []): Banner
{
    return Banner::create([
        'product_id' => $product->id,
        'title' => "Tile {$position}",
        'tagline' => 'A tagline',
        'cta_label' => 'Buy now',
        'image_url' => $product->cover_image_url,
        'position' => $position,
        ...$attributes,
    ]);
}

it('returns banners with the exact shape and a live product price', function () {
    $product = storeProduct('Alpha', 1299, ['list_price_cents' => 3999]);
    $banner = homeBanner($product, 1);

    $item = $this->getJson('/api/v1/home/banners')->assertOk()->assertJsonCount(1, 'data')->json('data.0');

    expect(array_keys($item))->toBe(['id', 'title', 'tagline', 'cta_label', 'image_url', 'product'])
        ->and($item)->toMatchArray([
            'id' => $banner->id,
            'title' => 'Tile 1',
            'tagline' => 'A tagline',
            'cta_label' => 'Buy now',
            'image_url' => $product->cover_image_url,
        ])
        ->and(array_keys($item['product']))->toBe([
            'slug', 'name', 'type', 'cover_image_url', 'platform', 'region', 'price', 'list_price', 'discount_percent',
        ])
        ->and($item['product'])->toMatchArray([
            'slug' => $product->slug,
            'price' => ['amount' => 1299, 'currency' => 'EUR'],
            'list_price' => ['amount' => 3999, 'currency' => 'EUR'],
            'discount_percent' => 67,
        ]);
});

it('orders by position, then id', function () {
    $third = homeBanner(storeProduct('C', 999), 2);
    $first = homeBanner(storeProduct('A', 999), 1);
    $second = homeBanner(storeProduct('B', 999), 1);

    expect($this->getJson('/api/v1/home/banners')->json('data.*.id'))->toBe([$first->id, $second->id, $third->id]);
});

it('hides inactive banners and banners on inactive products', function () {
    $shown = homeBanner(storeProduct('Shown', 999), 1);
    homeBanner(storeProduct('Hidden banner', 999), 2, ['is_active' => false]);
    homeBanner(storeProduct('Hidden product', 999, ['is_active' => false]), 3);

    expect($this->getJson('/api/v1/home/banners')->json('data.*.id'))->toBe([$shown->id]);
});

it('keeps a sold out product with a null price', function () {
    homeBanner(storeProduct('Sold out', null, ['list_price_cents' => 3999]), 1);

    $this->getJson('/api/v1/home/banners')
        ->assertOk()
        ->assertJsonPath('data.0.product.price', null)
        ->assertJsonPath('data.0.product.discount_percent', null);
});

it('caps the list at 10', function () {
    foreach (range(1, 11) as $position) {
        homeBanner(storeProduct("Game {$position}", 999), $position);
    }

    $this->getJson('/api/v1/home/banners?limit=50')->assertOk()->assertJsonCount(10, 'data');
});

it('returns an empty list, not a 404, when there are no banners', function () {
    $this->getJson('/api/v1/home/banners')->assertOk()->assertExactJson(['data' => []]);
});

it('loads banners in the same number of queries for 1 and 10 tiles', function () {
    homeBanner(storeProduct('Only', 999), 1);

    DB::enableQueryLog();
    $this->getJson('/api/v1/home/banners')->assertOk();
    $one = count(DB::getQueryLog());

    foreach (range(2, 10) as $position) {
        homeBanner(storeProduct("Game {$position}", 999), $position);
    }
    DB::flushQueryLog();
    $this->getJson('/api/v1/home/banners')->assertOk()->assertJsonCount(10, 'data');

    // banners, products with cheapest price, platforms, regions
    expect($one)->toBe(4)->and(DB::getQueryLog())->toHaveCount(4);
});
