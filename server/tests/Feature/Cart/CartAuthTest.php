<?php

use App\Models\CartItem;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

it('returns 401 without a token on every signed in route', function (string $method, string $uri) {
    $this->json($method, $uri, ['offer_id' => 1, 'quantity' => 1, 'items' => []])->assertUnauthorized();
})->with([
    ['GET', '/api/v1/cart'],
    ['POST', '/api/v1/cart/items'],
    ['PATCH', '/api/v1/cart/items/1'],
    ['DELETE', '/api/v1/cart/items/1'],
    ['POST', '/api/v1/cart/merge'],
]);

it('never lets one user read or change another user\'s lines', function () {
    $offer = cartOffer(5);
    $owner = User::factory()->create();
    $item = CartItem::factory()->create(['user_id' => $owner->id, 'offer_id' => $offer->id, 'quantity' => 2]);

    Sanctum::actingAs(User::factory()->create());

    $this->getJson('/api/v1/cart')->assertJsonPath('data.lines', []);
    $this->patchJson("/api/v1/cart/items/{$offer->id}", ['quantity' => 4])->assertNotFound();
    $this->deleteJson("/api/v1/cart/items/{$offer->id}")->assertOk()->assertJsonPath('data.lines', []);

    expect($item->fresh()?->quantity)->toBe(2);
});

it('limits cart routes to 120 requests per minute per user, apart from the account limit', function () {
    Sanctum::actingAs(User::factory()->create());

    for ($i = 0; $i < 120; $i++) {
        $this->getJson('/api/v1/cart')->assertOk();
    }

    $this->getJson('/api/v1/cart')->assertTooManyRequests()->assertHeader('Retry-After');
    $this->getJson('/api/v1/auth/me')->assertOk();
});
