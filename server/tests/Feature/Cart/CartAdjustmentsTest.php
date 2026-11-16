<?php

use App\Models\CartItem;
use App\Models\Order;
use App\Models\ProductKey;
use App\Models\User;
use App\Support\CartLimits;
use Laravel\Sanctum\Sanctum;

// Spec 0016 AC-10, AC-11, AC-13: add and merge report a cap in meta.adjustments.

beforeEach(function () {
    $this->user = User::factory()->create();
    Sanctum::actingAs($this->user);
});

it('reports a capped add of 10 with 6 keys left, and checkout buys exactly those 6', function () {
    $offer = cartOffer(6, ['price_cents' => 1000]);

    $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => 10])
        ->assertOk()
        ->assertJsonPath('data.lines.0.quantity', 6)
        ->assertJsonPath('meta.adjustments', [['offer_id' => $offer->id, 'requested' => 10, 'added' => 6]]);

    expect($this->user->cartItems()->value('quantity'))->toBe(6);

    $this->postJson('/api/v1/checkout', checkoutBody(6000), checkoutHeaders())
        ->assertCreated()
        ->assertJsonPath('data.items.0.quantity', 6)
        ->assertJsonPath('data.total.amount', 6000);

    expect(Order::query()->sole()->total_cents)->toBe(6 * 1000)
        ->and(ProductKey::query()->where('offer_id', $offer->id)->whereNotNull('order_item_id')->count())->toBe(6);
});

it('reports only the units added on top of a stored line', function () {
    $offer = cartOffer(4);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id, 'quantity' => 2]);

    $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => 5])
        ->assertOk()
        ->assertJsonPath('data.lines.0.quantity', 4)
        ->assertJsonPath('meta.adjustments', [['offer_id' => $offer->id, 'requested' => 5, 'added' => 2]]);
});

it('returns no adjustments for an add within stock, default quantity included', function () {
    $offer = cartOffer(5);

    $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id])
        ->assertOk()
        ->assertJsonPath('meta.adjustments', []);

    $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id, 'quantity' => 4])
        ->assertOk()
        ->assertJsonPath('data.lines.0.quantity', 5)
        ->assertJsonPath('meta.adjustments', []);
});

it('still rejects an add at the max with 422 and no meta', function () {
    $offer = cartOffer(3);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id, 'quantity' => 3]);

    $this->postJson('/api/v1/cart/items', ['offer_id' => $offer->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['quantity' => 'You already have the maximum for this offer.'])
        ->assertJsonMissingPath('meta');
});

it('reports capped and dropped merge lines in request order, not full ones', function () {
    $capped = cartOffer(3);
    $soldOut = cartOffer(0);
    $full = cartOffer(5);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $capped->id, 'quantity' => 1]);

    $this->postJson('/api/v1/cart/merge', ['items' => [
        ['offer_id' => $capped->id, 'quantity' => 4],
        ['offer_id' => $soldOut->id, 'quantity' => 2],
        ['offer_id' => $full->id, 'quantity' => 2],
    ]])
        ->assertOk()
        ->assertJsonPath('meta.adjustments', [
            ['offer_id' => $capped->id, 'requested' => 4, 'added' => 2],
            ['offer_id' => $soldOut->id, 'requested' => 2, 'added' => 0],
        ]);

    expect(CartItem::query()->where('offer_id', $capped->id)->value('quantity'))->toBe(3)
        ->and(CartItem::query()->where('offer_id', $full->id)->value('quantity'))->toBe(2);
});

it('reports added 0, never negative, when a stored line is already above the cap', function () {
    $offer = cartOffer(3);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id, 'quantity' => 5]);

    $this->postJson('/api/v1/cart/merge', ['items' => [['offer_id' => $offer->id, 'quantity' => 1]]])
        ->assertOk()
        ->assertJsonPath('meta.adjustments', [['offer_id' => $offer->id, 'requested' => 1, 'added' => 0]]);
});

it('reports a new merge line dropped by the line limit with added 0', function () {
    foreach (range(1, CartLimits::MAX_LINES) as $i) {
        CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => cartOffer(0)->id]);
    }
    $dropped = cartOffer(5);

    $this->postJson('/api/v1/cart/merge', ['items' => [['offer_id' => $dropped->id, 'quantity' => 3]]])
        ->assertOk()
        ->assertJsonPath('meta.adjustments', [['offer_id' => $dropped->id, 'requested' => 3, 'added' => 0]]);
});

it('returns an empty adjustments list for an empty or fully added merge', function () {
    $this->postJson('/api/v1/cart/merge', ['items' => []])->assertOk()->assertJsonPath('meta.adjustments', []);
    $this->postJson('/api/v1/cart/merge', ['items' => [['offer_id' => cartOffer(5)->id, 'quantity' => 2]]])
        ->assertOk()
        ->assertJsonPath('meta.adjustments', []);
});

it('keeps every other cart endpoint free of meta', function () {
    $offer = cartOffer(5);
    CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $offer->id]);

    $this->getJson('/api/v1/cart')->assertOk()->assertJsonMissingPath('meta');
    $this->patchJson("/api/v1/cart/items/{$offer->id}", ['quantity' => 2])->assertOk()->assertJsonMissingPath('meta');
    $this->postJson('/api/v1/cart/preview', ['items' => [['offer_id' => $offer->id, 'quantity' => 1]]])
        ->assertOk()
        ->assertJsonMissingPath('meta');
    $this->deleteJson("/api/v1/cart/items/{$offer->id}")->assertOk()->assertJsonMissingPath('meta');
});
