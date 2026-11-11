<?php

use Illuminate\Support\Facades\Schema;

// Runs outside RefreshDatabase on purpose: rollback drops tables, which a test transaction cannot isolate.
it('rolls back the data model migrations cleanly and applies them again', function () {
    $tables = ['cart_items', 'product_keys', 'order_items', 'orders', 'offers', 'products', 'sellers', 'regions', 'platforms'];
    $paths = glob(database_path('migrations/2026_11_11_1000*_create_*_table.php'));

    expect($paths)->toHaveCount(9);

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
