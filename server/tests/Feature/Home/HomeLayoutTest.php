<?php

use App\Models\HomeBlock;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

it('lists active blocks by position, then id, with only type and title', function () {
    HomeBlock::create(['type' => 'deals', 'title' => 'Deals', 'position' => 2]);
    HomeBlock::create(['type' => 'banners', 'title' => 'Featured', 'position' => 1]);
    HomeBlock::create(['type' => 'products', 'title' => 'Browse games', 'position' => 2]);
    HomeBlock::create(['type' => 'best_sellers', 'title' => 'Best sellers', 'position' => 0, 'is_active' => false]);

    $this->getJson('/api/v1/home')
        ->assertOk()
        ->assertExactJson(['data' => [
            ['type' => 'banners', 'title' => 'Featured'],
            ['type' => 'deals', 'title' => 'Deals'],
            ['type' => 'products', 'title' => 'Browse games'],
        ]]);
});

it('returns an empty list when no block is active', function () {
    HomeBlock::create(['type' => 'deals', 'title' => 'Deals', 'position' => 1, 'is_active' => false]);

    $this->getJson('/api/v1/home')->assertOk()->assertExactJson(['data' => []]);
});

it('ignores query params', function () {
    HomeBlock::create(['type' => 'deals', 'title' => 'Deals', 'position' => 1]);

    $this->getJson('/api/v1/home?limit=0&type=banners')->assertOk()->assertJsonCount(1, 'data');
});

it('rejects a type outside the known set at the database', function () {
    expect(fn () => DB::table('home_blocks')->insert(['type' => 'recently_viewed', 'title' => 'x', 'position' => 1]))
        ->toThrow(QueryException::class);
});

it('loads the layout in one query', function () {
    HomeBlock::create(['type' => 'deals', 'title' => 'Deals', 'position' => 1]);

    DB::enableQueryLog();
    $this->getJson('/api/v1/home')->assertOk();

    expect(DB::getQueryLog())->toHaveCount(1);
});
