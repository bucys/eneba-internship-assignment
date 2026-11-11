<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->index()->constrained()->restrictOnDelete();
            $table->foreignId('offer_id')->index()->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->index()->constrained()->restrictOnDelete();
            $table->integer('quantity');
            $table->integer('unit_price_cents');
            $table->string('product_name');
            $table->string('platform_name');
            $table->string('region_name');
            $table->string('seller_name');
            $table->timestamps();
        });

        DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_check CHECK (quantity > 0)');
        DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_unit_price_cents_check CHECK (unit_price_cents > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
