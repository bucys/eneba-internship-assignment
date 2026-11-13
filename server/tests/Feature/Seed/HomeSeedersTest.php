<?php

use App\Models\Banner;
use App\Models\CartItem;
use App\Models\HomeBlock;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoOrdersSeeder;
use Database\Seeders\HomeSeeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

function runHomeSeeder(string $class): void
{
    app($class)->setContainer(app())->__invoke();
}

/**
 * Planned units per product from the demo data file, highest first.
 *
 * @return array<string, int>
 */
function plannedUnits(): array
{
    $units = [];
    foreach (require database_path('data/demo_orders.php') as $order) {
        foreach ($order['lines'] as [$slug, $quantity]) {
            $units[$slug] = ($units[$slug] ?? 0) + $quantity;
        }
    }
    arsort($units);

    return $units;
}

it('seeds a homepage with all four blocks full on a fresh database', function () {
    runHomeSeeder(DatabaseSeeder::class);

    $this->getJson('/api/v1/home')->assertOk()->assertExactJson(['data' => [
        ['type' => 'banners', 'title' => 'Featured'],
        ['type' => 'best_sellers', 'title' => 'Best sellers'],
        ['type' => 'deals', 'title' => 'Deals'],
        ['type' => 'products', 'title' => 'Browse games'],
    ]]);

    $banners = $this->getJson('/api/v1/home/banners')->assertOk()->assertJsonCount(8, 'data')->json('data');
    foreach ($banners as $banner) {
        expect($banner['image_url'])->toBe($banner['product']['cover_image_url'])
            ->and($banner['product']['price'])->not->toBeNull();
    }
    expect(collect($banners)->whereNotNull('product.discount_percent'))->toHaveCount(6)
        ->and(collect($banners)->pluck('product.platform.slug')->unique())->toHaveCount(4);

    $planned = plannedUnits();
    expect(array_values($planned))->toHaveCount(12)->toBe(array_values(array_unique($planned)))
        ->and($this->getJson('/api/v1/home/best-sellers')->json('data.*.slug'))->toBe(array_keys($planned));

    $percents = $this->getJson('/api/v1/home/deals')->assertOk()->assertJsonCount(12, 'data')->json('data.*.discount_percent');
    expect($percents)->toBe(collect($percents)->sortDesc()->values()->all());

    expect(Order::count())->toBe(15)
        ->and(User::where('email', DemoOrdersSeeder::EMAIL)->first()->cartItems()->count())->toBe(0);
});

it('runs the home and demo seeders twice without new rows and keeps hand edits', function () {
    runHomeSeeder(CatalogSeeder::class);
    runHomeSeeder(HomeSeeder::class);
    runHomeSeeder(DemoOrdersSeeder::class);

    $demo = User::where('email', DemoOrdersSeeder::EMAIL)->firstOrFail();
    $hash = $demo->password;
    Banner::orderBy('position')->first()->update(['is_active' => false]);
    HomeBlock::where('type', 'deals')->update(['is_active' => false]);
    $counts = [Banner::count(), HomeBlock::count(), Order::count(), User::count()];

    runHomeSeeder(HomeSeeder::class);
    runHomeSeeder(DemoOrdersSeeder::class);

    expect([Banner::count(), HomeBlock::count(), Order::count(), User::count()])->toBe($counts)
        ->and(Banner::where('is_active', false)->count())->toBe(1)
        ->and(HomeBlock::where('type', 'deals')->value('is_active'))->toBeFalse()
        ->and($demo->fresh()->password)->toBe($hash)
        ->and(Hash::check('password', $hash))->toBeFalse()
        ->and($demo->name)->toBe('Demo Buyer');
});

it('clears a stray demo cart line instead of buying it', function () {
    runHomeSeeder(CatalogSeeder::class);
    $demo = User::create(['email' => DemoOrdersSeeder::EMAIL, 'name' => 'Demo Buyer', 'password' => Str::random(64)]);
    $stray = Offer::whereHas('product', fn ($query) => $query->where('slug', 'celeste-steam-global'))->firstOrFail();
    CartItem::create(['user_id' => $demo->id, 'offer_id' => $stray->id, 'quantity' => 1]);

    runHomeSeeder(DemoOrdersSeeder::class);

    expect($demo->cartItems()->count())->toBe(0)
        ->and(Product::where('slug', 'celeste-steam-global')->first()->orderItems()->count())->toBe(0);
});

it('fails clearly when a banner names an inactive product', function () {
    runHomeSeeder(CatalogSeeder::class);
    Product::where('slug', 'hollow-knight-xbox-north-america')->update(['is_active' => false]);

    expect(fn () => runHomeSeeder(HomeSeeder::class))
        ->toThrow(RuntimeException::class, 'Home banner names an inactive product: hollow-knight-xbox-north-america');
    expect(Banner::count())->toBe(0);
});
