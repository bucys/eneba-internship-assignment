<?php

namespace Database\Factories;

use App\Models\Seller;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Seller>
 */
class SellerFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = Str::title(fake()->unique()->words(3, true));

        return [
            'slug' => Str::slug($name),
            'name' => $name,
            'rating_basis_points' => fake()->numberBetween(7000, 10000),
            'rating_count' => fake()->numberBetween(0, 5000),
        ];
    }
}
