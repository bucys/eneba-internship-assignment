<?php

use App\Models\Order;
use App\Models\ProductKey;
use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

function buyOrder(User $user): TestResponse
{
    $single = cartOffer(2, ['price_cents' => 500]);
    $triple = cartOffer(4, ['price_cents' => 200]);
    $user->cartItems()->create(['offer_id' => $single->id, 'quantity' => 1]);
    $user->cartItems()->create(['offer_id' => $triple->id, 'quantity' => 3]);

    return test()->postJson('/api/v1/checkout', checkoutBody(1100), checkoutHeaders())->assertCreated();
}

/**
 * @return array<int, string>
 */
function codesOf(int $orderItemId): array
{
    return ProductKey::query()->where('order_item_id', $orderItemId)->orderBy('id')->pluck('code')->all();
}

function keysUrl(string $ulid): string
{
    return '/api/v1/orders/'.$ulid.'/keys';
}

it('returns each item\'s codes to the owner, in item and key id order, with no-store', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $ulid = buyOrder($user)->json('data.ulid');

    $itemIds = $this->getJson('/api/v1/orders/'.$ulid)->assertOk()->json('data.items.*.id');
    $response = $this->getJson(keysUrl($ulid))->assertOk();

    expect($response->headers->get('Cache-Control'))->toContain('no-store')
        ->and($response->json('data'))->toBe([
            ['order_item_id' => $itemIds[0], 'codes' => codesOf($itemIds[0])],
            ['order_item_id' => $itemIds[1], 'codes' => codesOf($itemIds[1])],
        ])
        ->and($response->json('data.0.codes'))->toHaveCount(1)
        ->and($response->json('data.1.codes'))->toHaveCount(3)
        ->and($itemIds[0])->toBeLessThan($itemIds[1]);
});

it('adds the item id to checkout and order bodies but never a code', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $created = buyOrder($user);
    $shown = $this->getJson('/api/v1/orders/'.$created->json('data.ulid'))->assertOk();

    $codes = ProductKey::query()->whereNotNull('order_item_id')->pluck('code');
    expect($codes)->toHaveCount(4);

    foreach ([$created, $shown] as $response) {
        expect($response->json('data.items.0.id'))->toBeInt()
            ->and($response->json('data.items.1.id'))->toBeInt();

        foreach ($codes as $code) {
            expect($response->content())->not->toContain($code);
        }
    }
});

it('gives the same 404 with no-store for another user\'s order and an unknown ULID', function () {
    config(['app.debug' => false]);
    $foreign = Order::factory()->create()->ulid;
    Sanctum::actingAs(User::factory()->create());

    $notOwned = $this->getJson(keysUrl($foreign))->assertNotFound();
    $unknown = $this->getJson(keysUrl(strtolower((string) Str::ulid())))->assertNotFound();

    expect($notOwned->content())->toBe($unknown->content())
        ->and($notOwned->headers->get('Cache-Control'))->toContain('no-store')
        ->and($unknown->headers->get('Cache-Control'))->toContain('no-store');
});

it('answers a non owner with the same 404 body as the order endpoint', function () {
    config(['app.debug' => false]);
    $foreign = Order::factory()->create()->ulid;
    Sanctum::actingAs(User::factory()->create());

    $keys = $this->getJson(keysUrl($foreign))->assertNotFound();
    $order = $this->getJson('/api/v1/orders/'.$foreign)->assertNotFound();

    expect($keys->content())->toBe($order->content());
});

it('returns 401 with no-store without a token', function () {
    $response = $this->getJson(keysUrl(Order::factory()->create()->ulid))->assertUnauthorized();

    expect($response->headers->get('Cache-Control'))->toContain('no-store');
});

it('returns 404 for a path that is not a lowercase ULID', function (Closure $ulid) {
    Sanctum::actingAs(User::factory()->create());

    $this->getJson(keysUrl($ulid()))->assertNotFound();
})->with([
    'uppercase' => [fn () => strtoupper(Order::factory()->create()->ulid)],
    'too short' => [fn () => 'abc'],
]);

it('shares the account limiter and answers 429 with Retry-After and no-store', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $ulid = Order::factory()->create(['user_id' => $user->id])->ulid;

    $this->getJson('/api/v1/orders/'.$ulid)->assertOk();

    foreach (range(1, 59) as $i) {
        $this->getJson(keysUrl($ulid))->assertOk();
    }

    $response = $this->getJson(keysUrl($ulid))
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');

    expect($response->headers->get('Cache-Control'))->toContain('no-store');

    RateLimiter::clear('account');
});

it('writes nothing when called', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $ulid = buyOrder($user)->json('data.ulid');

    $this->travel(5)->minutes();
    $snapshot = fn () => [
        ProductKey::query()->count(),
        Order::query()->count(),
        ProductKey::query()->orderBy('id')->pluck('updated_at')->map(fn ($at) => (string) $at)->all(),
        Order::query()->orderBy('id')->pluck('updated_at')->map(fn ($at) => (string) $at)->all(),
    ];
    $before = $snapshot();

    $this->getJson(keysUrl($ulid))->assertOk();
    $this->getJson(keysUrl($ulid))->assertOk();

    expect($snapshot())->toBe($before);
});
