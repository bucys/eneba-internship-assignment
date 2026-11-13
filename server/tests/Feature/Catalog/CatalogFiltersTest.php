<?php

use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;

it('lists the platforms and regions active products use, by name', function () {
    $xbox = Platform::factory()->create(['slug' => 'xbox', 'name' => 'Xbox']);
    $steam = Platform::factory()->create(['slug' => 'steam', 'name' => 'Steam']);
    $global = Region::factory()->create(['slug' => 'global', 'name' => 'Global']);
    $europe = Region::factory()->create(['slug' => 'europe', 'name' => 'Europe']);

    Product::factory()->create(['platform_id' => $xbox->id, 'region_id' => $global->id]);
    Product::factory()->create(['platform_id' => $steam->id, 'region_id' => $europe->id]);

    $this->getJson('/api/v1/catalog/filters')
        ->assertOk()
        ->assertExactJson([
            'data' => [
                'platforms' => [
                    ['slug' => 'steam', 'name' => 'Steam'],
                    ['slug' => 'xbox', 'name' => 'Xbox'],
                ],
                'regions' => [
                    ['slug' => 'europe', 'name' => 'Europe'],
                    ['slug' => 'global', 'name' => 'Global'],
                ],
            ],
        ]);
});

it('leaves out platforms and regions with only inactive products or none', function () {
    $sega = Platform::factory()->create(['slug' => 'sega']);
    $mars = Region::factory()->create(['slug' => 'mars']);
    Product::factory()->inactive()->create(['platform_id' => $sega->id, 'region_id' => $mars->id]);
    Platform::factory()->create(['slug' => 'unused']);
    $active = Product::factory()->create();

    $this->getJson('/api/v1/catalog/filters')
        ->assertOk()
        ->assertJsonPath('data.platforms.*.slug', [$active->platform->slug])
        ->assertJsonPath('data.regions.*.slug', [$active->region->slug]);
});

it('uses the catalog limiter', function () {
    for ($i = 0; $i < 120; $i++) {
        $this->getJson('/api/v1/catalog/filters')->assertOk();
    }

    $this->getJson('/api/v1/catalog/filters')
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');
});
