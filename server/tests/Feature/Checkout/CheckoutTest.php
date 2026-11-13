<?php

use App\Actions\Cart\BuildCart;
use App\Models\CartItem;
use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductKey;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->user = User::factory()->create();
    Sanctum::actingAs($this->user);
});

/**
 * @param  array<int, int>  $lines  offer id => stored quantity, in cart order
 */
function fillCart(User $user, array $lines): void
{
    foreach ($lines as $offerId => $quantity) {
        CartItem::factory()->create(['user_id' => $user->id, 'offer_id' => $offerId, 'quantity' => $quantity]);
    }
}

function soldKeys(int $offerId): int
{
    return ProductKey::query()->where('offer_id', $offerId)->whereNotNull('order_item_id')->count();
}

function expectNothingWritten(User $user, int $cartLines): void
{
    expect(Order::query()->count())->toBe(0)
        ->and(OrderItem::query()->count())->toBe(0)
        ->and(ProductKey::query()->whereNotNull('order_item_id')->count())->toBe(0)
        ->and($user->cartItems()->count())->toBe($cartLines);
}

it('buys the cart in one paid order with snapshots, sold keys, and an empty cart', function () {
    $first = cartOffer(3, ['price_cents' => 998]);
    $second = cartOffer(4, ['price_cents' => 1500]);
    fillCart($this->user, [$first->id => 5, $second->id => 1]);
    $total = 3 * 998 + 1 * 1500;

    $response = $this->postJson('/api/v1/checkout', checkoutBody($total), checkoutHeaders())
        ->assertCreated()
        ->assertJsonPath('data.status', 'paid')
        ->assertJsonPath('data.total', ['amount' => $total, 'currency' => 'EUR'])
        ->assertJsonPath('data.items.0.product_name', $first->product->name)
        ->assertJsonPath('data.items.0.seller_name', $first->seller->name)
        ->assertJsonPath('data.items.0.platform_name', $first->product->platform->name)
        ->assertJsonPath('data.items.0.region_name', $first->product->region->name)
        ->assertJsonPath('data.items.0.product.slug', $first->product->slug)
        ->assertJsonPath('data.items.0.quantity', 3)
        ->assertJsonPath('data.items.0.unit_price', ['amount' => 998, 'currency' => 'EUR'])
        ->assertJsonPath('data.items.0.line_total', ['amount' => 2994, 'currency' => 'EUR'])
        ->assertJsonPath('data.items.1.quantity', 1);

    expect($response->json('data.paid_at'))->toMatch('/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\z/')
        ->and($response->json('data.ulid'))->toMatch('/\A[0-9a-z]{26}\z/')
        ->and($response->content())->not->toContain('"code"');

    $order = Order::query()->sole();
    $items = $order->items()->orderBy('id')->get();

    expect($order->user_id)->toBe($this->user->id)
        ->and($order->total_cents)->toBe($total)
        ->and($order->total_cents)->toBe($items->sum(fn (OrderItem $item) => $item->quantity * $item->unit_price_cents))
        ->and($items->pluck('offer_id')->all())->toBe([$first->id, $second->id])
        ->and($items[0]->product_id)->toBe($first->product_id)
        ->and($this->user->cartItems()->count())->toBe(0);

    foreach ($items as $item) {
        $keys = ProductKey::query()->where('order_item_id', $item->id)->get();

        expect($keys)->toHaveCount($item->quantity);
        $keys->each(fn (ProductKey $key) => expect($key->offer_id)->toBe($item->offer_id)
            ->and($key->sold_at?->equalTo($order->paid_at))->toBeTrue());
    }

    $this->getJson('/api/v1/products/'.$first->product->slug)
        ->assertJsonPath('data.offers.0.stock', 0);
    $this->getJson('/api/v1/products/'.$second->product->slug)
        ->assertJsonPath('data.offers.0.stock', 3);
});

it('keeps the order snapshots when the catalog changes later', function () {
    $offer = cartOffer(2, ['price_cents' => 1000]);
    fillCart($this->user, [$offer->id => 1]);
    $response = $this->postJson('/api/v1/checkout', checkoutBody(1000), checkoutHeaders())->assertCreated();

    $offer->update(['price_cents' => 5000]);
    $offer->product->update(['name' => 'Renamed']);

    $this->getJson('/api/v1/orders/'.$response->json('data.ulid'))
        ->assertOk()
        ->assertJsonPath('data.items.0.unit_price.amount', 1000)
        ->assertJsonPath('data.items.0.product_name', $response->json('data.items.0.product_name'));
});

it('replays the same key with 200 and writes nothing new, even with an invalid body or empty cart', function () {
    $offer = cartOffer(5, ['price_cents' => 1000]);
    fillCart($this->user, [$offer->id => 1]);
    $headers = checkoutHeaders();

    $ulid = $this->postJson('/api/v1/checkout', checkoutBody(1000), $headers)->assertCreated()->json('data.ulid');

    $this->postJson('/api/v1/checkout', checkoutBody(1000), $headers)
        ->assertOk()
        ->assertJsonPath('data.ulid', $ulid);

    $this->postJson('/api/v1/checkout', ['card_number' => '1234', 'card_expiry' => '01/20'], $headers)
        ->assertOk()
        ->assertJsonPath('data.ulid', $ulid);

    expect(Order::query()->count())->toBe(1)
        ->and(soldKeys($offer->id))->toBe(1);

    $this->postJson('/api/v1/checkout', ['card_number' => '1234'], checkoutHeaders())
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['card_number']);
});

it('does not replay another user\'s order with the same key', function () {
    $key = (string) Str::uuid();
    Order::factory()->create(['idempotency_key' => $key]);

    $this->postJson('/api/v1/checkout', checkoutBody(1000), checkoutHeaders($key))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['cart' => 'Your cart is empty.']);
});

it('declines the two test cards with 422 on payment and writes nothing', function (string $number, string $message) {
    $offer = cartOffer(5, ['price_cents' => 1000]);
    fillCart($this->user, [$offer->id => 2]);

    $this->postJson('/api/v1/checkout', checkoutBody(2000, ['card_number' => $number]), checkoutHeaders())
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['payment' => $message]);

    expectNothingWritten($this->user, 1);
    expect($this->user->cartItems()->value('quantity'))->toBe(2);
})->with([
    'declined' => ['4000 0000 0000 0002', 'Your card was declined.'],
    'insufficient funds' => ['4000-0000-0000-9995', 'Your card has insufficient funds.'],
]);

it('returns 409 when the cart changed and writes nothing', function (Closure $change) {
    $offer = cartOffer(5, ['price_cents' => 1000]);
    fillCart($this->user, [$offer->id => 1]);

    $expected = $change($offer);

    $this->postJson('/api/v1/checkout', checkoutBody($expected), checkoutHeaders())
        ->assertStatus(409)
        ->assertExactJson(['message' => 'Your cart changed. Check the updated total and try again.']);

    expectNothingWritten($this->user, 1);
})->with([
    'total off by one cent' => [fn (Offer $offer) => 999],
    'price changed' => [function (Offer $offer) {
        $offer->update(['price_cents' => 1100]);

        return 1000;
    }],
    'offer made inactive' => [function (Offer $offer) {
        $offer->update(['is_active' => false]);

        return 1000;
    }],
    'sold out' => [function (Offer $offer) {
        ProductKey::query()->where('offer_id', $offer->id)->delete();

        return 1000;
    }],
]);

it('returns 409 when fewer keys can be taken than the line needs', function () {
    $offer = cartOffer(1, ['price_cents' => 1000]);
    fillCart($this->user, [$offer->id => 3]);

    // Stands in for a parallel buyer who took keys after the cart was read.
    app()->instance(BuildCart::class, new class extends BuildCart
    {
        public function loadOffers(array $offerIds): Collection
        {
            return parent::loadOffers($offerIds)->each(fn (Offer $offer) => $offer->available_keys_count = 5);
        }
    });

    $this->postJson('/api/v1/checkout', checkoutBody(3000), checkoutHeaders())->assertStatus(409);

    expectNothingWritten($this->user, 1);
});

it('returns 422 on cart for an empty cart', function () {
    $this->postJson('/api/v1/checkout', checkoutBody(0), checkoutHeaders())
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['cart' => 'Your cart is empty.']);

    expect(Order::query()->count())->toBe(0);
});

it('answers in the AC-4 order: header, replay, body, empty cart', function () {
    $this->postJson('/api/v1/checkout', [], [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['idempotency_key' => 'Missing or invalid idempotency key.'])
        ->assertJsonMissingValidationErrors(['card_number']);

    $this->postJson('/api/v1/checkout', [], checkoutHeaders())
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['card_number'])
        ->assertJsonMissingValidationErrors(['cart']);
});
