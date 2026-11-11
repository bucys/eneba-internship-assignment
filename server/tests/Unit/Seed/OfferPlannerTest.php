<?php

use Database\Seeders\Support\OfferPlanner;

$sellers = ['pixel-vault', 'keystone-games', 'nordic-keys', 'game-harbor', 'level-up-deals', 'checkpoint-market', 'loot-lane', 'byte-bazaar'];

it('returns equal plans for equal input', function () use ($sellers) {
    $planner = new OfferPlanner;

    expect($planner->plan('hades-steam-global', 2499, false, $sellers))
        ->toEqual($planner->plan('hades-steam-global', 2499, false, $sellers));
});

it('returns different plans for different slugs', function () use ($sellers) {
    $planner = new OfferPlanner;

    expect($planner->plan('hades-steam-global', 2499, false, $sellers))
        ->not->toEqual($planner->plan('celeste-steam-global', 2499, false, $sellers));
});

it('follows the offer rules across many slugs', function () use ($sellers) {
    $planner = new OfferPlanner;

    foreach (range(1, 300) as $i) {
        $base = 999 + $i * 23;
        $plan = $planner->plan("product-{$i}", $base, false, $sellers);
        $sellerSlugs = array_column($plan->offers, 'seller_slug');
        $prices = array_column($plan->offers, 'price_cents');
        $targets = array_column($plan->offers, 'stock_target');

        expect(count($plan->offers))->toBeGreaterThanOrEqual(2)->toBeLessThanOrEqual(5)
            ->and(array_unique($sellerSlugs))->toHaveCount(count($sellerSlugs))
            ->and(array_diff($sellerSlugs, $sellers))->toBeEmpty()
            ->and(array_unique($prices))->toHaveCount(count($prices))
            ->and($plan->listPriceCents === null || $plan->listPriceCents === $base)->toBeTrue()
            ->and(max($targets))->toBeGreaterThanOrEqual(5);

        foreach ($prices as $price) {
            expect($price)->toBeGreaterThanOrEqual(intdiv($base * 30, 100))
                ->toBeLessThanOrEqual(intdiv($base * 90, 100));
        }
    }
});

it('sets every stock target to zero for a sold out product', function () use ($sellers) {
    $plan = (new OfferPlanner)->plan('starfield-xbox-europe', 6999, true, $sellers);

    expect(array_column($plan->offers, 'stock_target'))->each->toBe(0);
});

it('keeps prices for a sold out product the same as when in stock', function () use ($sellers) {
    $planner = new OfferPlanner;
    $inStock = $planner->plan('starfield-xbox-europe', 6999, false, $sellers);
    $soldOut = $planner->plan('starfield-xbox-europe', 6999, true, $sellers);

    expect(array_column($soldOut->offers, 'price_cents'))->toBe(array_column($inStock->offers, 'price_cents'))
        ->and($soldOut->listPriceCents)->toBe($inStock->listPriceCents);
});
