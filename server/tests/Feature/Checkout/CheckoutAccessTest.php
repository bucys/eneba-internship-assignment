<?php

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

it('requires a token for checkout and order lookup', function () {
    $this->postJson('/api/v1/checkout', checkoutBody(1000), checkoutHeaders())->assertUnauthorized();
    $this->getJson('/api/v1/orders/'.Order::factory()->create()->ulid)->assertUnauthorized();
});

it('returns the owner\'s order with items in id order', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $offer = cartOffer(5, ['price_cents' => 700]);
    $other = cartOffer(5, ['price_cents' => 300]);
    $user->cartItems()->create(['offer_id' => $offer->id, 'quantity' => 2]);
    $user->cartItems()->create(['offer_id' => $other->id, 'quantity' => 1]);

    $created = $this->postJson('/api/v1/checkout', checkoutBody(1700), checkoutHeaders())->assertCreated();

    $this->getJson('/api/v1/orders/'.$created->json('data.ulid'))
        ->assertOk()
        ->assertExactJson($created->json());
});

it('returns 404 for another user\'s order, an unknown ULID, or a malformed path', function (Closure $ulid) {
    Sanctum::actingAs(User::factory()->create());

    $this->getJson('/api/v1/orders/'.$ulid())->assertNotFound();
})->with([
    'another user' => [fn () => Order::factory()->create()->ulid],
    'unknown' => [fn () => strtolower((string) Str::ulid())],
    'uppercase' => [fn () => strtoupper(Order::factory()->create()->ulid)],
    'too short' => [fn () => 'abc'],
]);

it('limits checkout to 10 requests a minute per user', function () {
    Sanctum::actingAs(User::factory()->create());

    foreach (range(1, 10) as $i) {
        $this->postJson('/api/v1/checkout', [], checkoutHeaders())->assertUnprocessable();
    }

    $this->postJson('/api/v1/checkout', [], checkoutHeaders())
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');

    RateLimiter::clear('checkout');
});

it('blocks checkout from a preview origin', function () {
    config([
        'cors.frontend_url' => 'https://eneba.example.com',
        'cors.preview_origin_pattern' => '^https://eneba-[a-z0-9]{9}-team\.vercel\.app$',
    ]);
    Sanctum::actingAs(User::factory()->create());

    $this->postJson('/api/v1/checkout', checkoutBody(1000), checkoutHeaders() + ['Origin' => 'https://eneba-abc123xyz-team.vercel.app'])
        ->assertForbidden();
});
