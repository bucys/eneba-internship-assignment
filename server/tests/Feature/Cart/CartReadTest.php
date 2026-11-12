<?php

use App\Models\CartItem;
use App\Models\Platform;
use App\Models\Product;
use App\Models\ProductKey;
use App\Models\Region;
use App\Models\Seller;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->user = User::factory()->create();
    Sanctum::actingAs($this->user);
});

it('returns an empty cart', function () {
    $this->getJson('/api/v1/cart')
        ->assertOk()
        ->assertExactJson(['data' => [
            'lines' => [],
            'item_count' => 0,
            'total' => ['amount' => 0, 'currency' => 'EUR'],
            'can_checkout' => false,
        ]]);
});

it('returns the documented shape, oldest line first', function () {
    $product = Product::factory()->create([
        'slug' => 'the-witcher-3-wild-hunt-pc-europe',
        'name' => 'The Witcher 3: Wild Hunt',
        'cover_image_url' => 'https://img.example.test/w3.jpg',
        'platform_id' => Platform::factory()->create(['slug' => 'pc', 'name' => 'PC'])->id,
        'region_id' => Region::factory()->create(['slug' => 'europe', 'name' => 'Europe'])->id,
    ]);
    $first = cartOffer(3, [
        'product_id' => $product->id,
        'price_cents' => 998,
        'seller_id' => Seller::factory()->create(['name' => 'KeyHub'])->id,
    ]);
    $second = cartOffer(5, ['price_cents' => 1500]);

    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $first->id, 'quantity' => 2]);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $second->id, 'quantity' => 1]);

    $this->getJson('/api/v1/cart')
        ->assertOk()
        ->assertJsonPath('data.lines.0', [
            'offer_id' => $first->id,
            'quantity' => 2,
            'max_quantity' => 3,
            'available' => true,
            'quantity_reduced' => false,
            'unit_price' => ['amount' => 998, 'currency' => 'EUR'],
            'line_total' => ['amount' => 1996, 'currency' => 'EUR'],
            'seller' => ['name' => 'KeyHub'],
            'product' => [
                'slug' => 'the-witcher-3-wild-hunt-pc-europe',
                'name' => 'The Witcher 3: Wild Hunt',
                'cover_image_url' => 'https://img.example.test/w3.jpg',
                'platform' => ['slug' => 'pc', 'name' => 'PC'],
                'region' => ['slug' => 'europe', 'name' => 'Europe'],
            ],
        ])
        ->assertJsonPath('data.lines.1.offer_id', $second->id)
        ->assertJsonPath('data.item_count', 3)
        ->assertJsonPath('data.total', ['amount' => 3496, 'currency' => 'EUR'])
        ->assertJsonPath('data.can_checkout', true);
});

it('applies the line rules', function (Closure $makeOffer, int $stored, array $expected) {
    $offer = $makeOffer();
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id, 'quantity' => $stored]);

    $line = $this->getJson('/api/v1/cart')->assertOk()->json('data.lines.0');
    $cart = $this->getJson('/api/v1/cart')->json('data');

    expect([
        $line['available'], $line['max_quantity'], $line['quantity'], $line['quantity_reduced'],
        $line['line_total']['amount'] ?? null, $cart['total']['amount'], $cart['item_count'], $cart['can_checkout'],
    ])->toBe($expected);
})->with([
    'inactive offer' => [fn () => cartOffer(5, ['price_cents' => 100, 'is_active' => false]), 2, [false, 0, 2, false, null, 0, 2, false]],
    'inactive product' => [fn () => cartOffer(5, ['price_cents' => 100, 'product_id' => Product::factory()->inactive()->create()->id]), 2, [false, 0, 2, false, null, 0, 2, false]],
    'zero stock' => [fn () => cartOffer(0, ['price_cents' => 100]), 2, [false, 0, 2, false, null, 0, 2, false]],
    'stock 3, stored 5' => [fn () => cartOffer(3, ['price_cents' => 100]), 5, [true, 3, 3, true, 300, 300, 3, true]],
    'stock 40, stored 10' => [fn () => cartOffer(40, ['price_cents' => 100]), 10, [true, 10, 10, false, 1000, 1000, 10, true]],
]);

it('counts only unsold keys as stock', function () {
    $offer = cartOffer(2, ['price_cents' => 100]);
    ProductKey::factory()->sold()->create(['offer_id' => $offer->id]);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id, 'quantity' => 1]);

    $this->getJson('/api/v1/cart')->assertJsonPath('data.lines.0.max_quantity', 2);
});

it('blocks checkout when any line is unavailable and leaves it out of the total', function () {
    $good = cartOffer(5, ['price_cents' => 500]);
    $gone = cartOffer(5, ['price_cents' => 900, 'is_active' => false]);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $good->id, 'quantity' => 1]);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $gone->id, 'quantity' => 1]);

    $this->getJson('/api/v1/cart')
        ->assertJsonPath('data.total.amount', 500)
        ->assertJsonPath('data.item_count', 2)
        ->assertJsonPath('data.can_checkout', false);
});

it('never writes when reading', function () {
    $offer = cartOffer(3);
    $item = CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id, 'quantity' => 5]);

    $this->getJson('/api/v1/cart')->assertJsonPath('data.lines.0.quantity', 3);

    expect($item->fresh()->quantity)->toBe(5);
});
