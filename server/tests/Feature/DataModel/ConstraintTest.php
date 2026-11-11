<?php

use App\Models\CartItem;
use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Platform;
use App\Models\Product;
use App\Models\ProductKey;
use App\Models\Region;
use App\Models\Seller;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

// One violation per case: in Postgres the first failed statement aborts the test transaction.
it('rejects invalid data at the database', function (Closure $violate, string $constraint) {
    expect($violate)->toThrow(QueryException::class, $constraint);
})->with([
    'second offer for the same product and seller' => [function () {
        $offer = Offer::factory()->create();
        Offer::factory()->create(['product_id' => $offer->product_id, 'seller_id' => $offer->seller_id]);
    }, 'offers_product_id_seller_id_unique'],

    'duplicate key code' => [function () {
        $key = ProductKey::factory()->create();
        ProductKey::factory()->create(['code' => $key->code]);
    }, 'product_keys_code_unique'],

    'key with an order item but no sold_at' => [function () {
        ProductKey::factory()->create(['order_item_id' => OrderItem::factory(), 'sold_at' => null]);
    }, 'product_keys_sold_state_check'],

    'key with sold_at but no order item' => [function () {
        ProductKey::factory()->create(['order_item_id' => null, 'sold_at' => now()]);
    }, 'product_keys_sold_state_check'],

    'second cart line for the same user and offer' => [function () {
        $line = CartItem::factory()->create();
        CartItem::factory()->create(['user_id' => $line->user_id, 'offer_id' => $line->offer_id]);
    }, 'cart_items_user_id_offer_id_unique'],

    'zero quantity cart line' => [function () {
        CartItem::factory()->create(['quantity' => 0]);
    }, 'cart_items_quantity_check'],

    'second order with the same user and idempotency key' => [function () {
        $order = Order::factory()->create();
        Order::factory()->create(['user_id' => $order->user_id, 'idempotency_key' => $order->idempotency_key]);
    }, 'orders_user_id_idempotency_key_unique'],

    'duplicate order ulid' => [function () {
        $order = Order::factory()->create();
        Order::factory()->create(['ulid' => $order->ulid]);
    }, 'orders_ulid_unique'],

    'order status outside the allowed list' => [function () {
        $order = Order::factory()->create();
        DB::table('orders')->where('id', $order->id)->update(['status' => 'refunded']);
    }, 'orders_status_check'],

    'zero order total' => [function () {
        Order::factory()->create(['total_cents' => 0]);
    }, 'orders_total_cents_check'],

    'order in USD' => [function () {
        Order::factory()->create(['currency' => 'USD']);
    }, 'orders_currency_check'],

    'offer in USD' => [function () {
        Offer::factory()->create(['currency' => 'USD']);
    }, 'offers_currency_check'],

    'zero offer price' => [function () {
        Offer::factory()->create(['price_cents' => 0]);
    }, 'offers_price_cents_check'],

    'zero quantity order item' => [function () {
        OrderItem::factory()->create(['quantity' => 0]);
    }, 'order_items_quantity_check'],

    'zero unit price order item' => [function () {
        OrderItem::factory()->create(['unit_price_cents' => 0]);
    }, 'order_items_unit_price_cents_check'],

    'unknown product type' => [function () {
        $product = Product::factory()->create();
        DB::table('products')->where('id', $product->id)->update(['type' => 'bundle']);
    }, 'products_type_check'],

    'zero list price' => [function () {
        Product::factory()->create(['list_price_cents' => 0]);
    }, 'products_list_price_cents_check'],

    'seller rating above 100 percent' => [function () {
        Seller::factory()->create(['rating_basis_points' => 10001]);
    }, 'sellers_rating_basis_points_check'],

    'negative seller rating count' => [function () {
        Seller::factory()->create(['rating_count' => -1]);
    }, 'sellers_rating_count_check'],

    'duplicate platform slug' => [function () {
        $platform = Platform::factory()->create();
        Platform::factory()->create(['slug' => $platform->slug]);
    }, 'platforms_slug_unique'],

    'duplicate region slug' => [function () {
        $region = Region::factory()->create();
        Region::factory()->create(['slug' => $region->slug]);
    }, 'regions_slug_unique'],

    'duplicate product slug' => [function () {
        $product = Product::factory()->create();
        Product::factory()->create(['slug' => $product->slug]);
    }, 'products_slug_unique'],
]);

it('lets different users reuse the same idempotency key', function () {
    $order = Order::factory()->create();

    Order::factory()->create(['user_id' => User::factory(), 'idempotency_key' => $order->idempotency_key]);

    expect(Order::where('idempotency_key', $order->idempotency_key)->count())->toBe(2);
});

it('defaults currency to EUR and product type to game', function () {
    $offer = Offer::factory()->create();
    $product = Product::factory()->create();
    DB::table('offers')->where('id', $offer->id)->update(['currency' => DB::raw('DEFAULT')]);
    DB::table('products')->where('id', $product->id)->update(['type' => DB::raw('DEFAULT')]);

    expect($offer->fresh()->currency)->toBe('EUR')
        ->and($product->fresh()->type->value)->toBe('game');
});
