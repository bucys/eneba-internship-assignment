<?php

namespace Database\Factories;

use App\Enums\ProductType;
use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = Str::title(fake()->unique()->words(4, true));

        return [
            'slug' => Str::slug($name),
            'name' => $name,
            'type' => ProductType::Game,
            'platform_id' => Platform::factory(),
            'region_id' => Region::factory(),
            'cover_image_url' => 'https://picsum.photos/seed/'.Str::slug($name).'/600/800',
            'description' => fake()->paragraph(),
            'release_date' => fake()->date(),
            'developer' => fake()->company(),
            'publisher' => fake()->company(),
            'list_price_cents' => fake()->numberBetween(1999, 6999),
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
