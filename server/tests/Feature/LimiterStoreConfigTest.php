<?php

// covers: spec 0016 AC-17 (iii). Local, Pest, and CI leave CACHE_LIMITER_STORE unset, so the limiter uses the default store.
it('uses the default store for the rate limiter unless CACHE_LIMITER_STORE is set', function () {
    expect(config('cache.limiter'))->toBeNull();
});

it('configures an apc store with the apc driver', function () {
    expect(config('cache.stores.apc'))->toBe(['driver' => 'apc']);
});
