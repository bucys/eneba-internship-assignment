<?php

use Illuminate\Support\Facades\DB;

function dealNames(): array
{
    return test()->getJson('/api/v1/home/deals')->assertOk()->json('data.*.name');
}

it('orders deals by discount percent, then name, then id', function () {
    storeProduct('Bravo', 500, ['list_price_cents' => 1000]);
    storeProduct('Alpha', 500, ['list_price_cents' => 1000]);
    storeProduct('Deepest', 100, ['list_price_cents' => 1000]);
    storeProduct('Small', 900, ['list_price_cents' => 1000]);

    $response = $this->getJson('/api/v1/home/deals')->assertOk();

    expect($response->json('data.*.name'))->toBe(['Deepest', 'Alpha', 'Bravo', 'Small'])
        ->and($response->json('data.*.discount_percent'))->toBe([90, 50, 50, 10]);
});

it('excludes products with no list price, no discount, a 0% rounded discount, or no stock', function () {
    storeProduct('No list price', 500, ['list_price_cents' => null]);
    storeProduct('Equal', 1000, ['list_price_cents' => 1000]);
    storeProduct('Above', 1200, ['list_price_cents' => 1000]);
    storeProduct('Rounds to zero', 999, ['list_price_cents' => 1000]);
    storeProduct('Sold out', null, ['list_price_cents' => 1000]);
    storeProduct('Inactive', 500, ['list_price_cents' => 1000, 'is_active' => false]);
    storeProduct('One percent', 990, ['list_price_cents' => 1000]);

    expect(dealNames())->toBe(['One percent']);
});

it('keeps the order consistent with the rounded down percent', function () {
    // 33.3% and 33.9% both round down to 33, so the name breaks the tie.
    storeProduct('Zulu', 667, ['list_price_cents' => 1000]);
    storeProduct('Yankee', 661, ['list_price_cents' => 1000]);

    $response = $this->getJson('/api/v1/home/deals')->assertOk();

    expect($response->json('data.*.name'))->toBe(['Yankee', 'Zulu'])
        ->and($response->json('data.*.discount_percent'))->toBe([33, 33]);
});

it('caps the list at 12', function () {
    foreach (range(1, 13) as $i) {
        storeProduct("Game {$i}", 500, ['list_price_cents' => 1000]);
    }

    DB::flushQueryLog();
    $this->getJson('/api/v1/home/deals')->assertOk()->assertJsonCount(12, 'data');
});

it('returns an empty list, not a 404, with no deals', function () {
    $this->getJson('/api/v1/home/deals')->assertOk()->assertExactJson(['data' => []]);
});

it('loads deals in the same number of queries for 1 and 12 products', function () {
    storeProduct('Only', 500, ['list_price_cents' => 1000]);

    DB::enableQueryLog();
    $this->getJson('/api/v1/home/deals')->assertOk();
    $one = count(DB::getQueryLog());

    foreach (range(2, 12) as $i) {
        storeProduct("Game {$i}", 500, ['list_price_cents' => 1000]);
    }
    DB::flushQueryLog();
    $this->getJson('/api/v1/home/deals')->assertOk()->assertJsonCount(12, 'data');

    // deals, platforms, regions
    expect($one)->toBe(3)->and(DB::getQueryLog())->toHaveCount(3);
});
