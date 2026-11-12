<?php

use App\Models\Offer;
use App\Models\Product;
use App\Models\ProductKey;
use App\Models\Seller;

function sellerOffer(Product $product, int $priceCents, array $seller = [], int $keys = 1, bool $active = true): Offer
{
    $offer = Offer::factory()->create([
        'product_id' => $product->id,
        'seller_id' => Seller::factory()->create($seller)->id,
        'price_cents' => $priceCents,
        'is_active' => $active,
    ]);
    ProductKey::factory()->count($keys)->create(['offer_id' => $offer->id]);

    return $offer;
}

it('returns the product detail with sorted offers and the best offer', function () {
    $product = Product::factory()->create([
        'list_price_cents' => 3000,
        'description' => 'Hunt monsters.',
        'developer' => 'Studio',
        'publisher' => 'Publisher',
        'release_date' => '2015-05-18',
    ]);
    $noKeys = sellerOffer($product, 500, ['rating_basis_points' => 9900, 'rating_count' => 10], keys: 0);
    $pricier = sellerOffer($product, 1500, ['rating_basis_points' => 9900, 'rating_count' => 10]);
    $cheapLowRated = sellerOffer($product, 1000, ['rating_basis_points' => 8000, 'rating_count' => 10], keys: 2);
    $cheapHighRated = sellerOffer($product, 1000, ['name' => 'KeyHub', 'rating_basis_points' => 9850, 'rating_count' => 1204], keys: 3);

    $response = $this->getJson("/api/v1/products/{$product->slug}")->assertOk();
    $data = $response->json('data');

    expect(array_keys($data))->toBe([
        'slug', 'name', 'type', 'cover_image_url', 'description', 'developer', 'publisher', 'release_date',
        'platform', 'region', 'price', 'list_price', 'discount_percent', 'best_offer_id', 'offers',
    ])->and($data)->toMatchArray([
        'slug' => $product->slug,
        'name' => $product->name,
        'type' => 'game',
        'cover_image_url' => $product->cover_image_url,
        'description' => 'Hunt monsters.',
        'developer' => 'Studio',
        'publisher' => 'Publisher',
        'release_date' => '2015-05-18',
        'platform' => ['slug' => $product->platform->slug, 'name' => $product->platform->name],
        'region' => ['slug' => $product->region->slug, 'name' => $product->region->name],
        'price' => ['amount' => 1000, 'currency' => 'EUR'],
        'list_price' => ['amount' => 3000, 'currency' => 'EUR'],
        'discount_percent' => 66,
        'best_offer_id' => $cheapHighRated->id,
    ]);

    expect(array_column($data['offers'], 'id'))
        ->toBe([$cheapHighRated->id, $cheapLowRated->id, $pricier->id, $noKeys->id])
        ->and($data['offers'][0])->toBe([
            'id' => $cheapHighRated->id,
            'price' => ['amount' => 1000, 'currency' => 'EUR'],
            'stock' => 3,
            'seller' => ['name' => 'KeyHub', 'rating_basis_points' => 9850, 'rating_count' => 1204],
        ])
        ->and($data['offers'][3]['stock'])->toBe(0);
});

it('returns null for nullable detail columns', function () {
    $product = Product::factory()->create([
        'description' => null,
        'developer' => null,
        'publisher' => null,
        'release_date' => null,
    ]);

    $this->getJson("/api/v1/products/{$product->slug}")
        ->assertOk()
        ->assertJsonPath('data.description', null)
        ->assertJsonPath('data.developer', null)
        ->assertJsonPath('data.publisher', null)
        ->assertJsonPath('data.release_date', null);
});

it('breaks price ties by rating, unrated sellers, name, then id', function (array $first, array $second) {
    $product = Product::factory()->create();
    $b = sellerOffer($product, 1000, $second);
    $a = sellerOffer($product, 1000, $first);

    $ids = $this->getJson("/api/v1/products/{$product->slug}")->assertOk()->json('data.offers.*.id');

    expect($ids)->toBe([$a->id, $b->id]);
})->with([
    'rated beats unrated' => [
        ['rating_basis_points' => 5000, 'rating_count' => 1],
        ['rating_basis_points' => 10000, 'rating_count' => 0],
    ],
    'higher rating first' => [
        ['rating_basis_points' => 9900, 'rating_count' => 5],
        ['rating_basis_points' => 9000, 'rating_count' => 500],
    ],
    'equal rating by name' => [
        ['name' => 'Alpha Keys', 'rating_basis_points' => 9500, 'rating_count' => 5],
        ['name' => 'Beta Keys', 'rating_basis_points' => 9500, 'rating_count' => 5],
    ],
]);

it('breaks a full tie by offer id', function () {
    $product = Product::factory()->create();
    $twinSeller = ['name' => 'Twin Keys', 'rating_basis_points' => 9500, 'rating_count' => 5];
    $first = sellerOffer($product, 1000, $twinSeller);
    $second = sellerOffer($product, 1000, $twinSeller);

    $ids = $this->getJson("/api/v1/products/{$product->slug}")->assertOk()->json('data.offers.*.id');

    expect($ids)->toBe([$first->id, $second->id]);
});

it('hides inactive offers and never exposes key codes', function () {
    $product = Product::factory()->create();
    $inactive = sellerOffer($product, 100, active: false);
    $active = sellerOffer($product, 900, keys: 2);
    ProductKey::factory()->sold()->create(['offer_id' => $active->id]);

    $response = $this->getJson("/api/v1/products/{$product->slug}")->assertOk();

    expect($response->json('data.offers.*.id'))->toBe([$active->id])
        ->and($response->json('data.offers.0.stock'))->toBe(2);

    $body = $response->getContent();
    expect($body)->not->toContain('"code"');
    ProductKey::query()->pluck('code')->each(fn (string $code) => expect($body)->not->toContain($code));
    expect($response->json('data.offers.*.id'))->not->toContain($inactive->id);
});

it('returns null best offer, price and discount when nothing is in stock', function (bool $withOffers) {
    $product = Product::factory()->create(['list_price_cents' => 2000]);
    if ($withOffers) {
        sellerOffer($product, 500, keys: 0);
        sellerOffer($product, 700, keys: 0);
    }

    $this->getJson("/api/v1/products/{$product->slug}")
        ->assertOk()
        ->assertJsonPath('data.best_offer_id', null)
        ->assertJsonPath('data.price', null)
        ->assertJsonPath('data.discount_percent', null)
        ->assertJsonPath('data.list_price', ['amount' => 2000, 'currency' => 'EUR'])
        ->assertJsonCount($withOffers ? 2 : 0, 'data.offers');
})->with(['sold out offers' => true, 'no offers' => false]);

it('agrees with the product list on price and discount', function (bool $inStock) {
    $product = Product::factory()->create(['list_price_cents' => 4999]);
    sellerOffer($product, 300, active: false);
    sellerOffer($product, 800, keys: 0);
    if ($inStock) {
        sellerOffer($product, 1999);
        sellerOffer($product, 2499);
    }

    $listItem = $this->getJson('/api/v1/products')->assertOk()->json('data.0');
    $detail = $this->getJson("/api/v1/products/{$product->slug}")->assertOk()->json('data');

    expect($detail['price'])->toBe($listItem['price'])
        ->and($detail['discount_percent'])->toBe($listItem['discount_percent'])
        ->and($detail['price'])->toBe($inStock ? ['amount' => 1999, 'currency' => 'EUR'] : null);
})->with(['in stock' => true, 'sold out' => false]);

it('returns 404 JSON for unknown, inactive, or malformed slugs', function (string $slug) {
    Product::factory()->inactive()->create(['slug' => 'inactive-game']);

    $this->getJson("/api/v1/products/{$slug}")
        ->assertNotFound()
        ->assertJsonStructure(['message']);
})->with(['unknown' => 'no-such-game', 'inactive' => 'inactive-game', 'malformed' => 'Bad_Slug']);

it('shares the catalog rate limit of 120 requests per minute', function () {
    $product = Product::factory()->create();

    for ($i = 0; $i < 120; $i++) {
        $this->getJson("/api/v1/products/{$product->slug}")->assertOk();
    }

    $this->getJson("/api/v1/products/{$product->slug}")
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');
});

it('loads the detail in a fixed number of queries', function () {
    $product = Product::factory()->create();
    foreach ([900, 1000, 1100, 1200] as $price) {
        sellerOffer($product, $price);
    }

    DB::enableQueryLog();
    $this->getJson("/api/v1/products/{$product->slug}")->assertOk();

    // product, platform, region, offers with stock count, sellers
    expect(DB::getQueryLog())->toHaveCount(5);
});
