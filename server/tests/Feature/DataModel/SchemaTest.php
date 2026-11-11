<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

dataset('tables', [
    'platforms' => ['platforms', ['id', 'slug', 'name', 'created_at', 'updated_at']],
    'regions' => ['regions', ['id', 'slug', 'name', 'created_at', 'updated_at']],
    'sellers' => ['sellers', ['id', 'slug', 'name', 'rating_basis_points', 'rating_count', 'created_at', 'updated_at']],
    'products' => ['products', [
        'id', 'slug', 'name', 'type', 'platform_id', 'region_id', 'cover_image_url', 'description',
        'release_date', 'developer', 'publisher', 'list_price_cents', 'is_active', 'created_at', 'updated_at',
    ]],
    'offers' => ['offers', ['id', 'product_id', 'seller_id', 'price_cents', 'currency', 'is_active', 'created_at', 'updated_at']],
    'orders' => ['orders', [
        'id', 'ulid', 'user_id', 'status', 'total_cents', 'currency', 'idempotency_key', 'paid_at', 'created_at', 'updated_at',
    ]],
    'order_items' => ['order_items', [
        'id', 'order_id', 'offer_id', 'product_id', 'quantity', 'unit_price_cents',
        'product_name', 'platform_name', 'region_name', 'seller_name', 'created_at', 'updated_at',
    ]],
    'product_keys' => ['product_keys', ['id', 'offer_id', 'code', 'order_item_id', 'sold_at', 'created_at', 'updated_at']],
    'cart_items' => ['cart_items', ['id', 'user_id', 'offer_id', 'quantity', 'created_at', 'updated_at']],
]);

it('creates every table with its columns', function (string $table, array $columns) {
    expect(Schema::hasTable($table))->toBeTrue()
        ->and(Schema::getColumnListing($table))->toEqualCanonicalizing($columns);
})->with('tables');

it('creates every named check constraint', function () {
    $checks = collect(DB::select(
        "SELECT conname FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace"
    ))->pluck('conname');

    expect($checks)->toContain(
        'sellers_rating_basis_points_check',
        'sellers_rating_count_check',
        'products_type_check',
        'products_list_price_cents_check',
        'offers_price_cents_check',
        'offers_currency_check',
        'orders_status_check',
        'orders_total_cents_check',
        'orders_currency_check',
        'order_items_quantity_check',
        'order_items_unit_price_cents_check',
        'product_keys_sold_state_check',
        'cart_items_quantity_check',
    );
});

it('creates every unique constraint and index', function (string $table, array $indexes) {
    $names = collect(Schema::getIndexes($table))->pluck('name');

    expect($names)->toContain(...$indexes);
})->with([
    ['platforms', ['platforms_slug_unique']],
    ['regions', ['regions_slug_unique']],
    ['sellers', ['sellers_slug_unique']],
    ['products', ['products_slug_unique', 'products_platform_id_index', 'products_region_id_index']],
    ['offers', ['offers_product_id_seller_id_unique', 'offers_product_id_price_cents_index', 'offers_seller_id_index']],
    ['orders', ['orders_ulid_unique', 'orders_user_id_idempotency_key_unique', 'orders_user_id_created_at_index']],
    ['order_items', ['order_items_order_id_index', 'order_items_offer_id_index', 'order_items_product_id_index']],
    ['product_keys', ['product_keys_code_unique', 'product_keys_order_item_id_index', 'product_keys_available_offer_id_index']],
    ['cart_items', ['cart_items_user_id_offer_id_unique', 'cart_items_offer_id_index']],
]);

it('makes the available keys index partial on unsold keys', function () {
    $definition = DB::scalar("SELECT pg_get_indexdef('product_keys_available_offer_id_index'::regclass)");

    expect($definition)->toContain('(offer_id) WHERE (order_item_id IS NULL)');
});

it('stores money as integer cents with no float or decimal columns', function () {
    $tables = ['sellers', 'products', 'offers', 'orders', 'order_items', 'product_keys', 'cart_items'];

    foreach ($tables as $table) {
        foreach (Schema::getColumns($table) as $column) {
            expect($column['type_name'])->not->toBeIn(['numeric', 'float4', 'float8', 'money']);

            if (str_ends_with($column['name'], '_cents')) {
                expect($column['type_name'])->toBe('int4', "{$table}.{$column['name']}");
            }
        }
    }
});
