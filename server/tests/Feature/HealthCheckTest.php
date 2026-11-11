<?php

use Illuminate\Support\Facades\DB;

it('returns 200 from the health check', function () {
    $this->get('/up')->assertOk();
});

it('runs tests against the separate eneba_test Postgres database', function () {
    expect(DB::connection()->getDriverName())->toBe('pgsql')
        ->and(DB::connection()->getDatabaseName())->toBe('eneba_test');
});
