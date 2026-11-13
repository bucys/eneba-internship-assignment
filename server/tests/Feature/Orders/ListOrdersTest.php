<?php

use App\Actions\Orders\ListOrders;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductKey;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;

const ORDERS_URL = '/api/v1/orders';

/**
 * An order with one item per quantity, placed the given number of minutes ago.
 *
 * @param  list<int>  $quantities
 */
function historyOrder(User $user, int $minutesAgo, array $quantities = [1]): Order
{
    $at = now()->subMinutes($minutesAgo);
    $order = Order::factory()->create(['user_id' => $user->id, 'created_at' => $at, 'paid_at' => $at]);

    foreach ($quantities as $quantity) {
        OrderItem::factory()->create(['order_id' => $order->id, 'quantity' => $quantity]);
    }

    return $order;
}

it('lists the caller\'s orders newest first, 10 per page, as summaries', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    foreach (range(1, 11) as $i) {
        historyOrder($user, 100 + $i);
    }
    $multi = historyOrder($user, 1, [2, 1]);

    $page1 = $this->getJson(ORDERS_URL)->assertOk();
    $page2 = $this->getJson(ORDERS_URL.'?page=2')->assertOk();

    $expected = Order::query()->orderByDesc('created_at')->orderByDesc('id')->pluck('ulid')->all();

    expect($page1->json('data'))->toHaveCount(10)
        ->and($page2->json('data'))->toHaveCount(2)
        ->and([...$page1->json('data.*.ulid'), ...$page2->json('data.*.ulid')])->toBe($expected)
        ->and($page1->json('meta.total'))->toBe(12)
        ->and($page1->json('meta.last_page'))->toBe(2)
        ->and($page1->json('meta.per_page'))->toBe(10)
        ->and($page1->json('links'))->toBeArray();

    $firstItem = $multi->items()->orderBy('id')->with('product')->firstOrFail();
    $detail = $this->getJson(ORDERS_URL.'/'.$multi->ulid)->assertOk()->json('data');

    expect($page1->json('data.0'))->toBe([
        'ulid' => $multi->ulid,
        'status' => 'paid',
        'total' => $detail['total'],
        'paid_at' => $detail['paid_at'],
        'item_count' => 3,
        'line_count' => 2,
        'first_item' => [
            'product_name' => $firstItem->product_name,
            'cover_image_url' => $firstItem->product->cover_image_url,
        ],
    ]);
});

it('never returns items or key codes', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $user->cartItems()->create(['offer_id' => cartOffer(3, ['price_cents' => 400])->id, 'quantity' => 2]);
    $this->postJson('/api/v1/checkout', checkoutBody(800), checkoutHeaders())->assertCreated();

    $response = $this->getJson(ORDERS_URL)->assertOk();
    $codes = ProductKey::query()->whereNotNull('order_item_id')->pluck('code');

    expect($codes)->toHaveCount(2)
        ->and($response->json('data.0'))->not->toHaveKey('items');

    foreach ($codes as $code) {
        expect($response->content())->not->toContain($code);
    }
});

it('runs the same number of queries for 1 and 10 orders', function () {
    $count = function (User $user): int {
        Sanctum::actingAs($user);
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson(ORDERS_URL)->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $one = User::factory()->create();
    historyOrder($one, 1, [1, 2]);

    $ten = User::factory()->create();
    foreach (range(1, 10) as $i) {
        historyOrder($ten, $i, [1, 2]);
    }

    expect($count($ten))->toBe($count($one));
});

it('reads an invalid page as page 1', function (string $page) {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $order = historyOrder($user, 1);

    $response = $this->getJson(ORDERS_URL.'?page='.$page)->assertOk();

    expect($response->json('meta.current_page'))->toBe(1)
        ->and($response->json('data.*.ulid'))->toBe([$order->ulid]);
})->with(['abc', '0', '-3']);

it('returns an empty page beyond the last with the real last page', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    foreach (range(1, 11) as $i) {
        historyOrder($user, $i);
    }

    $response = $this->getJson(ORDERS_URL.'?page=99')->assertOk();

    expect($response->json('data'))->toBe([])
        ->and($response->json('meta.last_page'))->toBe(2)
        ->and($response->json('meta.current_page'))->toBe(99);
});

it('answers a huge page as an empty page beyond the last', function (string $page) {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    historyOrder($user, 1);

    $response = $this->getJson(ORDERS_URL.'?page='.$page)->assertOk();

    expect($response->json('data'))->toBe([])
        ->and($response->json('meta.last_page'))->toBe(1)
        ->and($response->json('meta.current_page'))->toBe(ListOrders::MAX_PAGE);
})->with(['9223372036854775807', '922337203685477580']);

it('returns an empty list for a buyer with no orders', function () {
    Sanctum::actingAs(User::factory()->create());

    $response = $this->getJson(ORDERS_URL)->assertOk();

    expect($response->json('data'))->toBe([])
        ->and($response->json('meta.total'))->toBe(0)
        ->and($response->json('meta.last_page'))->toBe(1);
});

it('never lists another user\'s orders', function () {
    $other = User::factory()->create();
    historyOrder($other, 1);
    historyOrder($other, 2);

    $user = User::factory()->create();
    $own = historyOrder($user, 3);
    Sanctum::actingAs($user);

    $response = $this->getJson(ORDERS_URL)->assertOk();

    expect($response->json('data.*.ulid'))->toBe([$own->ulid])
        ->and($response->json('meta.total'))->toBe(1);
});

it('returns 401 without a token', function () {
    $this->getJson(ORDERS_URL)->assertUnauthorized();
});

it('shares the account limiter and answers 429 with Retry-After', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    $ulid = historyOrder($user, 1)->ulid;

    $this->getJson(ORDERS_URL.'/'.$ulid)->assertOk();

    foreach (range(1, 59) as $i) {
        $this->getJson(ORDERS_URL)->assertOk();
    }

    $this->getJson(ORDERS_URL)
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');

    RateLimiter::clear('account');
});

it('writes nothing when called', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);
    historyOrder($user, 1, [1, 2]);

    $this->travel(5)->minutes();
    $snapshot = fn () => [
        Order::query()->orderBy('id')->pluck('updated_at')->map(fn ($at) => (string) $at)->all(),
        OrderItem::query()->orderBy('id')->pluck('updated_at')->map(fn ($at) => (string) $at)->all(),
    ];
    $before = $snapshot();

    $this->getJson(ORDERS_URL)->assertOk();

    expect($snapshot())->toBe($before);
});
