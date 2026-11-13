<?php

use App\Models\Offer;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

function sellUnits(Product $product, int $quantity): void
{
    $offer = Offer::where('product_id', $product->id)->firstOrFail();
    OrderItem::factory()->create(['offer_id' => $offer->id, 'quantity' => $quantity]);
}

function bestSellerNames(): array
{
    return test()->getJson('/api/v1/home/best-sellers')->assertOk()->json('data.*.name');
}

it('ranks products by units sold, then name, then id', function () {
    $bravo = storeProduct('Bravo', 999);
    $alpha = storeProduct('Alpha', 999);
    $charlie = storeProduct('Charlie', 999);
    sellUnits($bravo, 2);
    sellUnits($alpha, 2);
    sellUnits($charlie, 1);
    sellUnits($charlie, 4);

    expect(bestSellerNames())->toBe(['Charlie', 'Alpha', 'Bravo']);
});

it('returns the product shape without the units count', function () {
    $product = storeProduct('Alpha', 1299, ['list_price_cents' => 3999]);
    sellUnits($product, 3);

    $item = $this->getJson('/api/v1/home/best-sellers')->assertOk()->json('data.0');

    expect(array_keys($item))->toBe([
        'slug', 'name', 'type', 'cover_image_url', 'platform', 'region', 'price', 'list_price', 'discount_percent',
    ])->and($item['price'])->toBe(['amount' => 1299, 'currency' => 'EUR']);
});

it('leaves out unsold, sold out, and inactive products', function () {
    storeProduct('Never sold', 999);
    $soldOut = storeProduct('Sold out', 999);
    sellUnits($soldOut, 5);
    Offer::where('product_id', $soldOut->id)->first()->keys()->delete();
    $inactive = storeProduct('Inactive', 999);
    sellUnits($inactive, 5);
    $inactive->update(['is_active' => false]);
    $shown = storeProduct('Shown', 999);
    sellUnits($shown, 1);

    expect(bestSellerNames())->toBe(['Shown']);
});

it('moves a product into the top 12 on the next request after a new paid order', function () {
    foreach (range(1, 12) as $i) {
        sellUnits(storeProduct(sprintf('Game %02d', $i), 999), 2);
    }
    $newcomer = storeProduct('Newcomer', 999);
    sellUnits($newcomer, 1);

    expect(bestSellerNames())->toHaveCount(12)->not->toContain('Newcomer');

    sellUnits($newcomer, 5);

    expect(bestSellerNames())->toHaveCount(12)->and(bestSellerNames()[0])->toBe('Newcomer');
});

it('returns an empty list, not a 404, with no sales', function () {
    storeProduct('Alpha', 999);

    $this->getJson('/api/v1/home/best-sellers')->assertOk()->assertExactJson(['data' => []]);
});

it('loads best sellers in the same number of queries for 1 and 12 products', function () {
    sellUnits(storeProduct('Only', 999), 1);

    DB::enableQueryLog();
    $this->getJson('/api/v1/home/best-sellers')->assertOk();
    $one = count(DB::getQueryLog());

    foreach (range(2, 12) as $i) {
        sellUnits(storeProduct("Game {$i}", 999), 1);
    }
    DB::flushQueryLog();
    $this->getJson('/api/v1/home/best-sellers')->assertOk()->assertJsonCount(12, 'data');

    // ranked products, platforms, regions
    expect($one)->toBe(3)->and(DB::getQueryLog())->toHaveCount(3);
});
