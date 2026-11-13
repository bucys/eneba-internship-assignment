<?php

use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;

/**
 * An active product with one in stock offer at the given price, or no stock when null.
 *
 * @param  array<string, mixed>  $attributes
 */
function storeProduct(string $name, ?int $priceCents, array $attributes = []): Product
{
    $product = Product::factory()->create(['name' => $name, ...$attributes]);
    cartOffer($priceCents === null ? 0 : 1, [
        'product_id' => $product->id,
        'price_cents' => $priceCents ?? 999,
    ]);

    return $product;
}

/**
 * @return list<string>
 */
function storeNames(string $query): array
{
    return test()->getJson("/api/v1/products{$query}")->assertOk()->json('data.*.name');
}

describe('filters', function () {
    beforeEach(function () {
        $this->steam = Platform::factory()->create(['slug' => 'steam', 'name' => 'Steam']);
        $this->xbox = Platform::factory()->create(['slug' => 'xbox', 'name' => 'Xbox']);
        $this->psn = Platform::factory()->create(['slug' => 'psn', 'name' => 'PSN']);
        $this->europe = Region::factory()->create(['slug' => 'europe', 'name' => 'Europe']);
        $this->global = Region::factory()->create(['slug' => 'global', 'name' => 'Global']);
    });

    it('combines platforms with OR, regions with AND, and a price cap, cheapest first', function () {
        storeProduct('A Steam EU 25', 2500, ['platform_id' => $this->steam->id, 'region_id' => $this->europe->id]);
        storeProduct('B Xbox EU 10', 1000, ['platform_id' => $this->xbox->id, 'region_id' => $this->europe->id]);
        storeProduct('C Steam EU 31', 3100, ['platform_id' => $this->steam->id, 'region_id' => $this->europe->id]);
        storeProduct('D Steam Global 5', 500, ['platform_id' => $this->steam->id, 'region_id' => $this->global->id]);
        storeProduct('E PSN EU 5', 500, ['platform_id' => $this->psn->id, 'region_id' => $this->europe->id]);
        storeProduct('F Steam EU 30', 3000, ['platform_id' => $this->steam->id, 'region_id' => $this->europe->id]);

        $response = $this->getJson('/api/v1/products?platform=steam,xbox&region=europe&price_max=30&sort=price_asc')
            ->assertOk();

        expect($response->json('data.*.name'))->toBe(['B Xbox EU 10', 'A Steam EU 25', 'F Steam EU 30'])
            ->and($response->json('meta.total'))->toBe(3);
    });

    it('treats the price bounds as inclusive whole euros', function () {
        storeProduct('Nine', 999);
        storeProduct('Ten', 1000);
        storeProduct('Twenty', 2000);
        storeProduct('Twenty and a cent', 2001);

        expect(storeNames('?price_min=10&price_max=20'))->toBe(['Ten', 'Twenty'])
            ->and(storeNames('?price_min=10'))->toBe(['Ten', 'Twenty', 'Twenty and a cent'])
            ->and(storeNames('?price_max=9'))->toBe([]);
    });

    it('drops out of stock products once any price bound is set', function () {
        storeProduct('In stock', 500);
        storeProduct('Sold out', null);

        expect(storeNames(''))->toBe(['In stock', 'Sold out'])
            ->and(storeNames('?price_min=0'))->toBe(['In stock'])
            ->and(storeNames('?price_max=10000'))->toBe(['In stock']);
    });

    it('matches the name ignoring case', function () {
        storeProduct('The Witcher 3', 500);
        storeProduct('Cyberpunk 2077', 500);

        expect(storeNames('?q=WITCHER'))->toBe(['The Witcher 3'])
            ->and(storeNames('?q=%20%20witcher%20'))->toBe(['The Witcher 3']);
    });

    it('matches the LIKE wildcards literally', function (string $q, string $expected) {
        storeProduct('Hundred % Off', 500);
        storeProduct('Snake_Case', 500);
        storeProduct('Back\\Slash', 500);
        storeProduct('Plain Name', 500);

        expect(storeNames('?q='.rawurlencode($q)))->toBe([$expected]);
    })->with([
        ['%', 'Hundred % Off'],
        ['_', 'Snake_Case'],
        ['\\', 'Back\\Slash'],
    ]);

    it('accepts a slug that has no active product and returns nothing', function () {
        storeProduct('Steam game', 500, ['platform_id' => $this->steam->id]);

        $this->getJson('/api/v1/products?platform=psn')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total', 0);
    });

    it('drops empty items and duplicates from a list', function () {
        storeProduct('Steam game', 500, ['platform_id' => $this->steam->id]);
        storeProduct('Xbox game', 500, ['platform_id' => $this->xbox->id]);

        expect(storeNames('?platform=steam,,steam'))->toBe(['Steam game'])
            ->and(storeNames('?platform=&region=&q=%20'))->toBe(['Steam game', 'Xbox game']);
    });

    it('accepts exactly ten list values', function () {
        Platform::factory()->count(7)->create();
        $slugs = Platform::query()->orderBy('id')->limit(10)->pluck('slug')->implode(',');

        $this->getJson("/api/v1/products?platform={$slugs}")->assertOk();
    });

    it('loads a filtered page in a fixed number of queries', function (int $count) {
        Product::factory()->count($count)->create(['platform_id' => $this->steam->id, 'region_id' => $this->europe->id])
            ->each(fn (Product $product) => cartOffer(1, ['product_id' => $product->id, 'price_cents' => 900]));

        DB::enableQueryLog();
        $this->getJson('/api/v1/products?platform=steam&region=europe&price_max=20&q=a')->assertOk();

        // platform lookup, region lookup, count, page, platforms, regions
        expect(DB::getQueryLog())->toHaveCount(6);
    })->with([2, 12]);
});

describe('sort', function () {
    beforeEach(function () {
        storeProduct('Bravo', 2000);
        storeProduct('Alpha', 3000);
        storeProduct('Aardvark sold out', null);
        storeProduct('Charlie', 1000);
    });

    it('sorts by name by default and with sort=name', function () {
        expect(storeNames(''))->toBe(['Alpha', 'Bravo', 'Charlie', 'Aardvark sold out'])
            ->and(storeNames('?sort=name'))->toBe(['Alpha', 'Bravo', 'Charlie', 'Aardvark sold out']);
    });

    it('sorts by price both ways with out of stock last', function () {
        expect(storeNames('?sort=price_asc'))->toBe(['Charlie', 'Bravo', 'Alpha', 'Aardvark sold out'])
            ->and(storeNames('?sort=price_desc'))->toBe(['Alpha', 'Bravo', 'Charlie', 'Aardvark sold out']);
    });

    it('breaks equal prices by name then id', function () {
        $first = storeProduct('Zulu', 1000);
        $second = storeProduct('Zulu', 1000);

        $slugs = $this->getJson('/api/v1/products?sort=price_asc')->assertOk()->json('data.*.slug');

        expect(array_slice($slugs, 0, 3))->toBe([
            Product::query()->where('name', 'Charlie')->value('slug'),
            $first->slug,
            $second->slug,
        ]);
    });
});

it('keeps every sort stable across pages', function (string $sort) {
    Product::factory()->count(30)->create()->each(
        fn (Product $product, int $index) => cartOffer($index % 5 === 0 ? 0 : 1, [
            'product_id' => $product->id,
            'price_cents' => 1000 + ($index % 3) * 100,
        ]),
    );

    $first = $this->getJson("/api/v1/products?sort={$sort}")->assertOk()->json('data.*.slug');
    $second = $this->getJson("/api/v1/products?sort={$sort}&page=2")->assertOk()->json('data.*.slug');

    expect(array_unique([...$first, ...$second]))->toHaveCount(30);
})->with(['name', 'price_asc', 'price_desc']);

describe('invalid input', function () {
    beforeEach(function () {
        Platform::factory()->create(['slug' => 'steam']);
        Region::factory()->create(['slug' => 'europe']);
    });

    it('returns 422 keyed by the param itself', function (string $query, string $key) {
        $response = $this->getJson("/api/v1/products?{$query}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$key]);

        expect(array_keys($response->json('errors')))->toBe([$key]);
    })->with([
        'unknown platform' => ['platform=sega', 'platform'],
        'one unknown in a list' => ['platform=steam,sega', 'platform'],
        'case sensitive slug' => ['platform=Steam', 'platform'],
        'unknown region' => ['region=mars', 'region'],
        'platform as array' => ['platform[]=steam', 'platform'],
        'q as array' => ['q[]=x', 'q'],
        'sort as array' => ['sort[]=name', 'sort'],
        'price as array' => ['price_min[]=1', 'price_min'],
        'min above max' => ['price_min=50&price_max=10', 'price_min'],
        'decimal price' => ['price_max=9.5', 'price_max'],
        'leading zero' => ['price_max=007', 'price_max'],
        'plus sign' => ['price_max=%2B5', 'price_max'],
        'exponent' => ['price_max=1e3', 'price_max'],
        'trailing decimal' => ['price_max=5.0', 'price_max'],
        'leading space' => ['price_max=%205', 'price_max'],
        'negative zero' => ['price_min=-0', 'price_min'],
        'above the cap' => ['price_max=10001', 'price_max'],
        'unknown sort' => ['sort=popular', 'sort'],
        'NUL in q' => ['q=a%00b', 'q'],
        'invalid UTF-8 in q' => ['q=%FF', 'q'],
        'NUL in platform' => ['platform=st%00eam', 'platform'],
        'invalid UTF-8 in platform' => ['platform=%FF', 'platform'],
        'NUL in region' => ['region=eu%00rope', 'region'],
        'invalid UTF-8 in region' => ['region=%C3%28', 'region'],
    ]);

    it('rejects more than ten distinct list values', function () {
        $slugs = implode(',', array_map(fn (int $i) => "p{$i}", range(1, 11)));

        $this->getJson("/api/v1/products?platform={$slugs}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['platform']);
    });

    it('rejects a q longer than 100 characters after trimming', function () {
        $this->getJson('/api/v1/products?q='.str_repeat('a', 101))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['q']);

        $this->getJson('/api/v1/products?q='.rawurlencode('  '.str_repeat('a', 100).'  '))->assertOk();
    });

    it('accepts one price bound alone and the 10000 cap', function () {
        $this->getJson('/api/v1/products?price_min=10')->assertOk();
        $this->getJson('/api/v1/products?price_max=10000')->assertOk();
        $this->getJson('/api/v1/products?price_min=0&price_max=0')->assertOk();
    });
});

it('caps a huge page instead of overflowing into page 1', function () {
    storeProduct('Only product', 500);

    $this->getJson('/api/v1/products?page=9223372036854775807')
        ->assertOk()
        ->assertJsonCount(0, 'data')
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('meta.last_page', 1);
});
