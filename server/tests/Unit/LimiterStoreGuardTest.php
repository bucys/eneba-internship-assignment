<?php

use App\Support\LimiterStoreGuard;

// covers: spec 0016 AC-17 (iii)
it('refuses a limiter store name with no configured store', function () {
    LimiterStoreGuard::assertUsable('apcu', null, true);
})->throws(RuntimeException::class, 'Rate limiter store [apcu] is not configured.');

it('refuses an apc limiter store while APCu is off', function () {
    LimiterStoreGuard::assertUsable('apc', ['driver' => 'apc'], false);
})->throws(RuntimeException::class, 'Rate limiter store uses APCu, but APCu is not enabled.');

it('accepts a usable limiter store setting', function (?string $name, ?array $config, bool $apcuEnabled) {
    LimiterStoreGuard::assertUsable($name, $config, $apcuEnabled);

    expect(true)->toBeTrue();
})->with([
    'apc store with APCu on' => ['apc', ['driver' => 'apc'], true],
    'non apc store with APCu off' => ['database', ['driver' => 'database'], false],
    'null means the default store' => [null, null, false],
    'empty string means the default store' => ['', null, false],
]);
