<?php

use App\Enums\OrderStatus;
use App\Enums\ProductType;
use App\Models\CartItem;
use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Platform;
use App\Models\Product;
use App\Models\ProductKey;
use App\Models\Region;
use App\Models\Seller;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

it('creates a valid row from every factory', function (string $model) {
    /** @var class-string<Model> $model */
    $record = $model::factory()->create();

    $this->assertModelExists($record);
})->with([
    Platform::class, Region::class, Seller::class, Product::class, Offer::class,
    Order::class, OrderItem::class, ProductKey::class, CartItem::class,
]);

it('derives stock from available keys across several sellers', function () {
    $product = Product::factory()->create();
    $offers = Offer::factory()->count(3)->for($product)->create();
    ProductKey::factory()->count(4)->for($offers[0])->create();
    ProductKey::factory()->count(2)->for($offers[1])->create();

    $stock = fn () => $product->offers()->withCount('availableKeys')->orderBy('id')->pluck('available_keys_count')->all();

    expect($stock())->toBe([4, 2, 0]);

    $key = $offers[0]->keys()->first();
    $key->update([
        'order_item_id' => OrderItem::factory()->create(['offer_id' => $offers[0]->id])->id,
        'sold_at' => now(),
    ]);

    expect($stock())->toBe([3, 2, 0])
        ->and(ProductKey::available()->count())->toBe(5)
        ->and(Schema::hasColumn('offers', 'stock'))->toBeFalse();
});

it('builds a sold key on an order item for the same offer', function () {
    $key = ProductKey::factory()->sold()->create();

    expect($key->order_item_id)->not->toBeNull()
        ->and($key->sold_at)->toBeInstanceOf(CarbonInterface::class)
        ->and($key->orderItem->offer_id)->toBe($key->offer_id)
        ->and($key->orderItem->keys->pluck('id')->all())->toBe([$key->id])
        ->and(Offer::count())->toBe(1);
});

it('gives an order a ulid as its public route key while id stays the bigint key', function () {
    $order = Order::factory()->create();

    expect($order->ulid)->toBeString()->toHaveLength(26)
        ->and($order->id)->toBeInt()
        ->and($order->getRouteKeyName())->toBe('ulid')
        ->and($order->getRouteKey())->toBe($order->ulid)
        ->and($order->status)->toBe(OrderStatus::Paid)
        ->and($order->paid_at)->toBeInstanceOf(CarbonInterface::class)
        ->and($order->user->orders->pluck('id')->all())->toBe([$order->id]);
});

it('casts product type, release date, and active flags', function () {
    $product = Product::factory()->create()->fresh();

    expect($product->type)->toBe(ProductType::Game)
        ->and($product->release_date)->toBeInstanceOf(CarbonInterface::class)
        ->and($product->is_active)->toBeTrue()
        ->and($product->platform)->toBeInstanceOf(Platform::class)
        ->and($product->region)->toBeInstanceOf(Region::class);
});

it('filters inactive products and offers with the active scopes', function () {
    Product::factory()->create();
    Product::factory()->inactive()->create();
    Offer::factory()->create();
    Offer::factory()->inactive()->create();

    expect(Product::active()->count())->toBe(Product::count() - 1)
        ->and(Offer::active()->count())->toBe(1);
});

it('keeps order item snapshots when the catalog changes', function () {
    $item = OrderItem::factory()->create();
    $original = $item->only(['product_name', 'seller_name', 'unit_price_cents']);

    $item->product->update(['name' => 'Renamed Product']);
    $item->offer->seller->update(['name' => 'Renamed Seller']);
    $item->offer->update(['price_cents' => $item->unit_price_cents + 100]);

    expect($item->fresh()->only(['product_name', 'seller_name', 'unit_price_cents']))->toBe($original)
        ->and($item->product_id)->toBe($item->offer->product_id);
});

it('links cart lines to their user and offer', function () {
    $line = CartItem::factory()->create();

    expect($line->user->cartItems->pluck('id')->all())->toBe([$line->id])
        ->and($line->offer->cartItems->pluck('id')->all())->toBe([$line->id]);
});

it('never serializes a key code', function () {
    $key = ProductKey::factory()->create();

    expect($key->toArray())->not->toHaveKey('code');
});
