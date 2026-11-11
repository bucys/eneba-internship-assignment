<?php

namespace Database\Factories;

use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderItem>
 */
class OrderItemFactory extends Factory
{
    /**
     * Product id, unit price, and name snapshots are copied from the offer, like checkout does.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'offer_id' => Offer::factory(),
            'quantity' => 1,
        ];
    }

    public function configure(): static
    {
        return $this->afterMaking(function (OrderItem $item) {
            $offer = Offer::with(['product.platform', 'product.region', 'seller'])->findOrFail($item->offer_id);

            $item->product_id ??= $offer->product_id;
            $item->unit_price_cents ??= $offer->price_cents;
            $item->product_name ??= $offer->product->name;
            $item->platform_name ??= $offer->product->platform->name;
            $item->region_name ??= $offer->product->region->name;
            $item->seller_name ??= $offer->seller->name;
        });
    }
}
