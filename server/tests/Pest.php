<?php

use App\Models\Offer;
use App\Models\ProductKey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

// No RefreshDatabase here: these tests change the schema itself (see tests/Migrations).
pest()->extend(TestCase::class)->in('Migrations');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function something()
{
    // ..
}

/**
 * An offer with the given number of unsold keys (stock), for the cart tests.
 *
 * @param  array<string, mixed>  $attributes
 */
function cartOffer(int $stock = 5, array $attributes = []): Offer
{
    $offer = Offer::factory()->create($attributes);

    if ($stock > 0) {
        ProductKey::factory()->count($stock)->create(['offer_id' => $offer->id]);
    }

    return $offer;
}

/**
 * A valid checkout body (spec 0009 AC-3) that pays the given total with the approving test card.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function checkoutBody(int $expectedTotal, array $overrides = []): array
{
    return array_merge([
        'card_number' => '4242 4242 4242 4242',
        'card_expiry' => now('UTC')->addYear()->format('m/y'),
        'card_cvc' => '123',
        'card_name' => 'Jane Buyer',
        'expected_total' => $expectedTotal,
    ], $overrides);
}

/**
 * @return array<string, string>
 */
function checkoutHeaders(?string $key = null): array
{
    return ['Idempotency-Key' => $key ?? (string) Str::uuid()];
}
