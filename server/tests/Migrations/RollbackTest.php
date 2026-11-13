<?php

use Illuminate\Support\Facades\Schema;

// Runs outside RefreshDatabase on purpose: rollback drops tables, which a test transaction cannot isolate.
it('rolls back the data model migrations cleanly and applies them again', function () {
    $tables = ['banners', 'cart_items', 'product_keys', 'order_items', 'orders', 'offers', 'products', 'sellers', 'regions', 'platforms'];
    // banners references products, so it rolls back with the data model (spec 0014).
    $paths = [
        ...glob(database_path('migrations/2026_11_11_1000*_create_*_table.php')),
        database_path('migrations/2026_11_13_200002_create_banners_table.php'),
    ];

    expect($paths)->toHaveCount(10);

    $this->artisan('migrate:fresh')->assertSuccessful();
    $this->artisan('migrate:rollback', ['--path' => $paths, '--realpath' => true])->assertSuccessful();

    foreach ($tables as $table) {
        expect(Schema::hasTable($table))->toBeFalse("{$table} should be dropped");
    }
    expect(Schema::hasTable('users'))->toBeTrue();

    $this->artisan('migrate')->assertSuccessful();

    foreach ($tables as $table) {
        expect(Schema::hasTable($table))->toBeTrue("{$table} should be back");
    }
});
