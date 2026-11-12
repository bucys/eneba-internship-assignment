<?php

use App\Models\CartItem;
use App\Models\Product;
use App\Models\User;
use App\Support\CartLimits;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->user = User::factory()->create();
    Sanctum::actingAs($this->user);
});

function storedQuantity(User $user, int $offerId): ?int
{
    return CartItem::query()->where('user_id', $user->id)->where('offer_id', $offerId)->value('quantity');
}

it('adds a new line with quantity 1 by default and returns the cart', function () {
    $offer = cartOffer(5);

    $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id])
        ->assertOk()
        ->assertJsonPath('data.lines.0.offer_id', $offer->id)
        ->assertJsonPath('data.lines.0.quantity', 1);
});

it('adds to an existing line instead of making a second row', function () {
    $offer = cartOffer(5);

    $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id]);
    $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => 2])->assertOk();

    expect(CartItem::query()->count())->toBe(1)
        ->and(storedQuantity($this->user, $offer->id))->toBe(3);
});

it('stores at most the cap on a new line', function () {
    $offer = cartOffer(3);

    $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => 10])->assertOk();

    expect(storedQuantity($this->user, $offer->id))->toBe(3);
});

it('never passes the cap with repeated adds', function () {
    $offer = cartOffer(4);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id, 'quantity' => 3]);

    $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => 5])->assertOk();

    expect(storedQuantity($this->user, $offer->id))->toBe(4);
});

it('rejects an add at the cap and leaves a reduced line unchanged', function (int $stock, int $stored) {
    $offer = cartOffer($stock);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id, 'quantity' => $stored]);

    $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['quantity' => 'You already have the maximum for this offer.']);

    expect(storedQuantity($this->user, $offer->id))->toBe($stored);
})->with([
    'at cap' => [3, 3],
    'reduced' => [3, 5],
]);

it('rejects offers that cannot be bought', function (Closure $offerId, string $message) {
    $this->postJson('/api/v1/cart/items', ['offer_id' => $offerId()])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['offer_id' => $message]);
})->with([
    'unknown' => [fn () => 999999, 'This offer is no longer available.'],
    'inactive offer' => [fn () => cartOffer(5, ['is_active' => false])->id, 'This offer is no longer available.'],
    'inactive product' => [fn () => cartOffer(5, ['product_id' => Product::factory()->inactive()->create()->id])->id, 'This offer is no longer available.'],
    'out of stock' => [fn () => cartOffer(0)->id, 'This offer is out of stock.'],
]);

it('rejects a new line when the cart is full', function () {
    foreach (range(1, CartLimits::MAX_LINES) as $i) {
        CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => cartOffer(0)->id]);
    }

    $this->postJson('/api/v1/cart/items', ['offer_id' => cartOffer(5)->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['offer_id' => 'Your cart is full.']);
});

it('validates the add body', function (array $body, string $field) {
    $this->postJson('/api/v1/cart/items', $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field]);
})->with([
    'missing offer' => [[], 'offer_id'],
    'offer above PHP_INT_MAX' => [['offer_id' => 9223372036854775808], 'offer_id'],
    'offer as huge string' => [['offer_id' => '99999999999999999999'], 'offer_id'],
    'offer zero' => [['offer_id' => 0], 'offer_id'],
    'quantity 0' => [['offer_id' => 1, 'quantity' => 0], 'quantity'],
    'quantity 11' => [['offer_id' => 1, 'quantity' => 11], 'quantity'],
]);

it('sets a quantity within the cap', function () {
    $offer = cartOffer(5);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id, 'quantity' => 1]);

    $this->patchJson("/api/v1/cart/items/{$offer->id}", ['quantity' => 4])
        ->assertOk()
        ->assertJsonPath('data.lines.0.quantity', 4);
});

it('rejects a quantity above the cap', function () {
    $offer = cartOffer(3);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id, 'quantity' => 1]);

    $this->patchJson("/api/v1/cart/items/{$offer->id}", ['quantity' => 4])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['quantity' => 'Only 3 available.']);
});

it('checks availability before the cap', function () {
    $offer = cartOffer(3, ['is_active' => false]);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id, 'quantity' => 1]);

    $this->patchJson("/api/v1/cart/items/{$offer->id}", ['quantity' => 9])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['offer_id' => 'This offer is no longer available.']);
});

it('returns 404 for a missing line or a too long id, and 422 first for a bad body', function () {
    $this->patchJson('/api/v1/cart/items/12345', ['quantity' => 2])->assertNotFound();
    $this->patchJson('/api/v1/cart/items/1234567890123456789', ['quantity' => 2])->assertNotFound();
    $this->deleteJson('/api/v1/cart/items/1234567890123456789')->assertNotFound();
    $this->patchJson('/api/v1/cart/items/12345', ['quantity' => 0])->assertUnprocessable();
});

it('removes a line, and removing it again is still fine', function () {
    $offer = cartOffer(5);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id]);

    $this->deleteJson("/api/v1/cart/items/{$offer->id}")->assertOk()->assertJsonPath('data.lines', []);
    $this->deleteJson("/api/v1/cart/items/{$offer->id}")->assertOk()->assertJsonPath('data.item_count', 0);
});
