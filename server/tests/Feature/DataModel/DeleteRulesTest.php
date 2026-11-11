<?php

use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductKey;
use Illuminate\Database\QueryException;

it('keeps a product that an order item references', function () {
    $item = OrderItem::factory()->create();

    expect(fn () => $item->product->delete())->toThrow(QueryException::class, 'violates foreign key constraint');
});

it('keeps an offer that an order item references', function () {
    $item = OrderItem::factory()->create();

    expect(fn () => $item->offer->delete())->toThrow(QueryException::class, 'violates foreign key constraint');
});

it('keeps an order that has items', function () {
    $item = OrderItem::factory()->create();

    expect(fn () => $item->order->delete())->toThrow(QueryException::class, 'order_items_order_id_foreign');
});

it('keeps an order item that a sold key references', function () {
    $key = ProductKey::factory()->sold()->create();

    expect(fn () => $key->orderItem->delete())->toThrow(QueryException::class, 'product_keys_order_item_id_foreign');
});

it('keeps a user who has orders', function () {
    $order = Order::factory()->create();

    expect(fn () => $order->user->delete())->toThrow(QueryException::class, 'orders_user_id_foreign');
});

it('deletes cart lines when the user is deleted', function () {
    $line = CartItem::factory()->create();

    $line->user->delete();

    $this->assertModelMissing($line);
});

it('deletes cart lines when the offer is deleted', function () {
    $line = CartItem::factory()->create();

    $line->offer->delete();

    $this->assertModelMissing($line);
});
