<?php

use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Platform;
use App\Models\Product;
use App\Models\ProductKey;
use App\Models\Region;
use App\Models\Seller;
use App\Models\User;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoOrdersSeeder;
use Database\Seeders\Support\OfferPlanner;
use Database\Seeders\Support\ProductPlan;

const SOLD_OUT_SLUGS = [
    'hades-nintendo-north-america',
    'call-of-duty-modern-warfare-iii-playstation-north-america',
    'starfield-xbox-europe',
];

/**
 * @return array<string, mixed>
 */
function seedCatalogData(): array
{
    return require database_path('data/catalog.php');
}

function runSeeder(string $class): void
{
    app($class)->setContainer(app())->__invoke();
}

/**
 * Recomputes every listing's plan from the data file, keyed by product slug.
 *
 * @param  array<string, mixed>  $catalog
 * @return array<string, array{base: int, plan: ProductPlan}>
 */
function expectedPlans(array $catalog): array
{
    $planner = new OfferPlanner;
    $sellerSlugs = array_column($catalog['sellers'], 'slug');
    $plans = [];

    foreach ($catalog['titles'] as $title) {
        foreach ($title['variants'] as $variant) {
            $slug = CatalogSeeder::slugFor($title['name'], $variant['platform'], $variant['region']);
            $plans[$slug] = [
                'base' => $title['base_price_cents'],
                'plan' => $planner->plan($slug, $title['base_price_cents'], $variant['sold_out'] ?? false, $sellerSlugs),
            ];
        }
    }

    return $plans;
}

/**
 * @return array<int, int> offer id => unsold key count
 */
function unsoldCounts(): array
{
    return ProductKey::available()
        ->groupBy('offer_id')
        ->selectRaw('offer_id, count(*) as unsold')
        ->pluck('unsold', 'offer_id')
        ->map(fn ($count) => (int) $count)
        ->all();
}

/**
 * @return array<string, int> table name => row count
 */
function seedTableCounts(): array
{
    return [
        'platforms' => Platform::count(),
        'regions' => Region::count(),
        'sellers' => Seller::count(),
        'products' => Product::count(),
        'offers' => Offer::count(),
        'users' => User::count(),
    ];
}

it('creates the catalog with the expected counts and offers', function () {
    runSeeder(CatalogSeeder::class);

    expect(Platform::count())->toBe(4)
        ->and(Region::count())->toBe(3)
        ->and(Seller::count())->toBe(8)
        ->and(Product::count())->toBe(81)
        ->and(Product::where('type', 'game')->count())->toBe(74)
        ->and(Product::where('type', 'dlc')->count())->toBe(7)
        ->and(Product::where('is_active', false)->count())->toBe(0);

    Product::with('offers')->get()->each(function (Product $product) {
        $offers = $product->offers;

        expect($offers->count())->toBeGreaterThanOrEqual(2)->toBeLessThanOrEqual(5)
            ->and($offers->pluck('seller_id')->unique())->toHaveCount($offers->count())
            ->and($offers->every(fn (Offer $offer) => $offer->is_active && $offer->currency === 'EUR'))->toBeTrue();
    });
});

it('matches the data file for names, slugs, covers, and facts', function () {
    runSeeder(CatalogSeeder::class);
    $catalog = seedCatalogData();

    foreach ($catalog['titles'] as $title) {
        foreach ($title['variants'] as $variant) {
            $slug = CatalogSeeder::slugFor($title['name'], $variant['platform'], $variant['region']);
            $product = Product::where('slug', $slug)->with(['platform', 'region'])->firstOrFail();

            expect($product->name)->toBe($title['name'])
                ->and($product->type->value)->toBe($title['type'])
                ->and($product->platform->slug)->toBe($variant['platform'])
                ->and($product->region->slug)->toBe($variant['region'])
                ->and($product->cover_image_url)->toBe("https://shared.steamstatic.com/store_item_assets/steam/apps/{$title['steam_app_id']}/library_600x900.jpg")
                ->and($product->developer)->toBe($title['developer'])
                ->and($product->publisher)->toBe($title['publisher'])
                ->and($product->description)->not->toBeEmpty()
                ->and($product->release_date?->toDateString())->toBe($title['release_date']);

            if ($title['type'] === 'game') {
                expect($product->release_date)->not->toBeNull();
            }
        }
    }

    expect(Product::where('name', 'ilike', '%witcher%')->count())->toBe(8);
});

it('rejects data that expands to a duplicate slug before writing anything', function () {
    $catalog = seedCatalogData();
    $catalog['titles'][] = $catalog['titles'][0];

    expect(fn () => app(CatalogSeeder::class)->seedFrom($catalog))
        ->toThrow(RuntimeException::class, 'the-witcher-3-wild-hunt-steam-global');

    expect(Product::count())->toBe(0)->and(Platform::count())->toBe(0);
});

it('seeds prices and list prices that match the recomputed plans', function () {
    runSeeder(CatalogSeeder::class);
    $plans = expectedPlans(seedCatalogData());
    $withListPrice = 0;

    foreach ($plans as $slug => ['base' => $base, 'plan' => $plan]) {
        $product = Product::where('slug', $slug)->with('offers.seller')->firstOrFail();
        $seeded = $product->offers
            ->mapWithKeys(fn (Offer $offer) => [$offer->seller->slug => $offer->price_cents])
            ->sortKeys()
            ->all();
        $planned = collect($plan->offers)->pluck('price_cents', 'seller_slug')->sortKeys()->all();

        expect($product->list_price_cents)->toBe($plan->listPriceCents)
            ->and($seeded)->toBe($planned)
            ->and(array_unique($seeded))->toHaveCount(count($seeded));

        foreach ($seeded as $price) {
            expect($price)->toBeGreaterThanOrEqual(intdiv($base * 30, 100))
                ->toBeLessThanOrEqual(intdiv($base * 90, 100));
        }

        if ($product->list_price_cents !== null) {
            expect($product->list_price_cents)->toBe($base);
            $withListPrice++;
        }
    }

    $share = $withListPrice / count($plans);
    expect($share)->toBeGreaterThanOrEqual(0.4)->toBeLessThanOrEqual(0.8);
});

it('seeds each offer with its planned stock and valid unique key codes', function () {
    runSeeder(CatalogSeeder::class);
    $plans = expectedPlans(seedCatalogData());
    $unsold = unsoldCounts();
    $zeroTargets = 0;
    $lowTargets = 0;

    foreach ($plans as $slug => ['plan' => $plan]) {
        $product = Product::where('slug', $slug)->with('offers.seller')->firstOrFail();
        $targets = collect($plan->offers)->pluck('stock_target', 'seller_slug');

        foreach ($product->offers as $offer) {
            $target = $targets[$offer->seller->slug];
            expect($unsold[$offer->id] ?? 0)->toBe($target);
            $zeroTargets += $target === 0 ? 1 : 0;
            $lowTargets += in_array($target, [1, 2], true) ? 1 : 0;
        }

        if (in_array($slug, SOLD_OUT_SLUGS, true)) {
            expect($product->offers->sum(fn (Offer $offer) => $unsold[$offer->id] ?? 0))->toBe(0)
                ->and($product->offers->every(fn (Offer $offer) => $offer->is_active))->toBeTrue();
        } else {
            expect($product->offers->contains(fn (Offer $offer) => ($unsold[$offer->id] ?? 0) >= 5))->toBeTrue();
        }
    }

    $codes = ProductKey::pluck('code');

    expect($zeroTargets)->toBeGreaterThanOrEqual(10)
        ->and($lowTargets)->toBeGreaterThanOrEqual(10)
        ->and($codes->unique())->toHaveCount($codes->count())
        ->and($codes->every(fn (string $code) => preg_match('/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/', $code) === 1))->toBeTrue();
});

it('reruns without changing counts or ids', function () {
    runSeeder(CatalogSeeder::class);
    $counts = seedTableCounts();
    $productIds = Product::orderBy('id')->pluck('id')->all();
    $offerIds = Offer::orderBy('id')->pluck('id')->all();
    $keyCount = ProductKey::count();

    runSeeder(CatalogSeeder::class);

    expect(seedTableCounts())->toBe($counts)
        ->and(Product::orderBy('id')->pluck('id')->all())->toBe($productIds)
        ->and(Offer::orderBy('id')->pluck('id')->all())->toBe($offerIds)
        ->and(ProductKey::count())->toBe($keyCount);
});

it('keeps sold keys and orders on rerun and only tops up unsold keys', function () {
    runSeeder(CatalogSeeder::class);
    $offer = Offer::has('availableKeys', '>=', 5)->firstOrFail();
    $target = unsoldCounts()[$offer->id];
    $orderItem = OrderItem::factory()->create(['offer_id' => $offer->id, 'quantity' => 3]);
    $soldKeyIds = $offer->availableKeys()->orderBy('id')->limit(3)->pluck('id');
    ProductKey::whereIn('id', $soldKeyIds)->update(['order_item_id' => $orderItem->id, 'sold_at' => now()]);
    $counts = seedTableCounts();
    $orderCount = Order::count();
    $orderItemCount = OrderItem::count();

    runSeeder(CatalogSeeder::class);

    expect(ProductKey::whereIn('id', $soldKeyIds)->pluck('order_item_id')->unique()->all())->toBe([$orderItem->id])
        ->and(seedTableCounts())->toBe($counts)
        ->and(Order::count())->toBe($orderCount)
        ->and(OrderItem::count())->toBe($orderItemCount)
        ->and(unsoldCounts()[$offer->id])->toBe($target)
        ->and($offer->keys()->count())->toBe($target + 3);
});

it('never deletes unsold keys above the target', function () {
    runSeeder(CatalogSeeder::class);
    $offer = Offer::has('keys')->firstOrFail();
    ProductKey::factory()->count(4)->create(['offer_id' => $offer->id]);
    $keyCount = ProductKey::count();

    runSeeder(CatalogSeeder::class);

    expect(ProductKey::count())->toBe($keyCount);
});

it('updates content from the data file and leaves dropped rows and is_active alone', function () {
    $seeder = app(CatalogSeeder::class);
    $catalog = seedCatalogData();
    $seeder->seedFrom($catalog);

    $hades = Product::where('slug', 'hades-steam-global')->firstOrFail();
    $witcher = Product::where('slug', 'the-witcher-3-wild-hunt-steam-global')->firstOrFail();
    $inactiveOffer = Offer::where('product_id', $hades->id)->firstOrFail();
    $inactiveOffer->update(['is_active' => false]);

    $hadesIndex = array_search('Hades', array_column($catalog['titles'], 'name'), true);
    $catalog['titles'][$hadesIndex]['base_price_cents'] = 99999;
    $catalog['titles'][$hadesIndex]['description'] = 'A changed description.';
    $catalog['titles'][$hadesIndex]['developer'] = 'Changed Dev';
    $catalog['titles'][$hadesIndex]['publisher'] = 'Changed Pub';
    $catalog['titles'][$hadesIndex]['release_date'] = '2021-01-01';
    $catalog['titles'][0]['name'] = 'The Witcher 3 Renamed';

    $seeder->seedFrom($catalog);

    $hadesAfter = $hades->fresh();
    $sellerSlugs = array_column($catalog['sellers'], 'slug');
    $plan = (new OfferPlanner)->plan('hades-steam-global', 99999, false, $sellerSlugs);

    expect($hadesAfter->description)->toBe('A changed description.')
        ->and($hadesAfter->developer)->toBe('Changed Dev')
        ->and($hadesAfter->publisher)->toBe('Changed Pub')
        ->and($hadesAfter->release_date?->toDateString())->toBe('2021-01-01')
        ->and($hadesAfter->list_price_cents)->toBe($plan->listPriceCents)
        ->and($hadesAfter->offers()->orderBy('price_cents')->pluck('price_cents')->all())
        ->toBe(collect($plan->offers)->pluck('price_cents')->sort()->values()->all())
        ->and($inactiveOffer->fresh()->is_active)->toBeFalse()
        ->and($witcher->fresh()->only(['name', 'is_active', 'updated_at']))->toEqual($witcher->only(['name', 'is_active', 'updated_at']))
        ->and(Product::where('slug', 'the-witcher-3-renamed-steam-global')->exists())->toBeTrue();
});

it('keeps a product turned off by hand inactive after a rerun', function () {
    runSeeder(CatalogSeeder::class);
    $product = Product::where('slug', 'celeste-steam-global')->firstOrFail();
    $product->update(['is_active' => false]);

    runSeeder(DatabaseSeeder::class);

    expect($product->fresh()->is_active)->toBeFalse();
});

it('creates the local test user once outside production', function () {
    runSeeder(DatabaseSeeder::class);
    runSeeder(DatabaseSeeder::class);

    expect(User::where('email', 'test@example.com')->count())->toBe(1)
        ->and(User::pluck('email')->sort()->values()->all())->toBe([DemoOrdersSeeder::EMAIL, 'test@example.com']);
});

it('creates only the demo buyer in production', function () {
    $this->app['env'] = 'production';

    runSeeder(DatabaseSeeder::class);

    // The demo buyer has a random password nobody knows (spec 0014 AC-7).
    expect(User::pluck('email')->all())->toBe([DemoOrdersSeeder::EMAIL])
        ->and(Product::count())->toBe(81);
});

it('uses no factories or Faker in the seeders', function () {
    $source = collect(glob(database_path('seeders/{,Support/}*.php'), GLOB_BRACE))
        ->map(fn (string $path) => file_get_contents($path))
        ->implode("\n");

    expect($source)->not->toContain('::factory(')
        ->not->toContain('fake(')
        ->not->toContain('Faker\\');
});
