<?php

namespace Database\Factories;

use App\Models\Offer;
use App\Models\OrderItem;
use App\Models\ProductKey;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ProductKey>
 */
class ProductKeyFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'offer_id' => Offer::factory(),
            'code' => Str::upper(fake()->unique()->bothify('?????-?????-?????')),
            'order_item_id' => null,
            'sold_at' => null,
        ];
    }

    /**
     * A sold key, attached to an order item for the same offer.
     */
    public function sold(): static
    {
        // An attribute closure (not a state closure) receives offer_id already resolved to an id.
        return $this->state([
            'order_item_id' => fn (array $attributes) => OrderItem::factory()->create(['offer_id' => $attributes['offer_id']])->id,
            'sold_at' => now(),
        ]);
    }
}
