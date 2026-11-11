<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'status' => OrderStatus::Paid,
            'total_cents' => fake()->numberBetween(499, 5999),
            'currency' => 'EUR',
            'idempotency_key' => fake()->uuid(),
            'paid_at' => now(),
        ];
    }
}
