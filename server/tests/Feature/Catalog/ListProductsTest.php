<?php

use App\Models\Offer;
use App\Models\Product;
use App\Models\ProductKey;

function offerWithKeys(Product $product, int $priceCents, int $keys = 1, bool $active = true): Offer
{
    $offer = Offer::factory()->create([
        'product_id' => $product->id,
        'price_cents' => $priceCents,
        'is_active' => $active,
    ]);
    ProductKey::factory()->count($keys)->create(['offer_id' => $offer->id]);

    return $offer;
}

it('lists active products with the exact item shape', function () {
    $product = Product::factory()->create(['name' => 'Alpha', 'list_price_cents' => 3999]);
    offerWithKeys($product, 1299);

    $response = $this->getJson('/api/v1/products')->assertOk();

    $response->assertJsonStructure(['data', 'links', 'meta' => ['current_page', 'last_page', 'per_page', 'total']])
        ->assertJsonPath('meta.per_page', 24);

    $item = $response->json('data.0');
    expect(array_keys($item))->toBe([
        'slug', 'name', 'type', 'cover_image_url', 'platform', 'region', 'price', 'list_price', 'discount_percent',
    ])->and($item)->toMatchArray([
        'slug' => $product->slug,
        'name' => 'Alpha',
        'type' => 'game',
        'cover_image_url' => $product->cover_image_url,
        'platform' => ['slug' => $product->platform->slug, 'name' => $product->platform->name],
        'region' => ['slug' => $product->region->slug, 'name' => $product->region->name],
        'price' => ['amount' => 1299, 'currency' => 'EUR'],
        'list_price' => ['amount' => 3999, 'currency' => 'EUR'],
        'discount_percent' => 67,
    ]);
});

it('orders priced products by name, then id, before unpriced ones', function () {
    $soldOut = Product::factory()->create(['name' => 'Aardvark']);
    offerWithKeys($soldOut, 500, keys: 0);
    $charlie = Product::factory()->create(['name' => 'Charlie']);
    offerWithKeys($charlie, 900);
    $bravoOne = Product::factory()->create(['name' => 'Bravo']);
    offerWithKeys($bravoOne, 900);
    $bravoTwo = Product::factory()->create(['name' => 'Bravo']);
    offerWithKeys($bravoTwo, 900);

    $slugs = $this->getJson('/api/v1/products')->assertOk()->json('data.*.slug');

    expect($slugs)->toBe([$bravoOne->slug, $bravoTwo->slug, $charlie->slug, $soldOut->slug]);
});

it('prices a product from its cheapest active offer that has stock', function () {
    $product = Product::factory()->create();
    offerWithKeys($product, 300, active: false);
    offerWithKeys($product, 400, keys: 0);
    offerWithKeys($product, 1500);
    $soldKeyOffer = offerWithKeys($product, 350, keys: 0);
    ProductKey::factory()->sold()->create(['offer_id' => $soldKeyOffer->id]);

    $this->getJson('/api/v1/products')
        ->assertOk()
        ->assertJsonPath('data.0.price', ['amount' => 1500, 'currency' => 'EUR']);
});

it('returns a null price and discount when no offer can be bought', function () {
    $product = Product::factory()->create(['list_price_cents' => 2000]);
    offerWithKeys($product, 500, keys: 0);

    $this->getJson('/api/v1/products')
        ->assertOk()
        ->assertJsonPath('data.0.price', null)
        ->assertJsonPath('data.0.list_price', ['amount' => 2000, 'currency' => 'EUR'])
        ->assertJsonPath('data.0.discount_percent', null);
});

it('returns a null list price when the column is null', function () {
    $product = Product::factory()->create(['list_price_cents' => null]);
    offerWithKeys($product, 500);

    $this->getJson('/api/v1/products')
        ->assertOk()
        ->assertJsonPath('data.0.list_price', null)
        ->assertJsonPath('data.0.discount_percent', null);
});

it('never lists inactive products', function () {
    Product::factory()->inactive()->create();
    $active = Product::factory()->create();

    $this->getJson('/api/v1/products')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.slug', $active->slug);
});

it('falls back to page 1 for an invalid page', function (string $page) {
    Product::factory()->count(25)->create();

    $this->getJson("/api/v1/products?page={$page}")
        ->assertOk()
        ->assertJsonPath('meta.current_page', 1)
        ->assertJsonCount(24, 'data');
})->with(['abc', '0']);

it('serves later pages and an empty page past the end', function () {
    Product::factory()->count(25)->create();

    $this->getJson('/api/v1/products?page=2')->assertOk()->assertJsonCount(1, 'data');

    $this->getJson('/api/v1/products?page=999')
        ->assertOk()
        ->assertJsonCount(0, 'data')
        ->assertJsonPath('meta.total', 25)
        ->assertJsonPath('meta.last_page', 2)
        ->assertJsonPath('meta.current_page', 999);
});

it('ignores a per_page query param', function () {
    Product::factory()->count(25)->create();

    $this->getJson('/api/v1/products?per_page=100')
        ->assertOk()
        ->assertJsonPath('meta.per_page', 24)
        ->assertJsonCount(24, 'data');
});

it('loads the list in a fixed number of queries', function () {
    Product::factory()->count(5)->create()->each(fn (Product $product) => offerWithKeys($product, 999));

    DB::enableQueryLog();
    $this->getJson('/api/v1/products')->assertOk();

    // count, page, platforms, regions
    expect(DB::getQueryLog())->toHaveCount(4);
});
