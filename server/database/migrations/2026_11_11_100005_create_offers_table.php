<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('seller_id')->index()->constrained()->restrictOnDelete();
            $table->integer('price_cents');
            $table->char('currency', 3)->default('EUR');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['product_id', 'seller_id']);
            $table->index(['product_id', 'price_cents']);
        });

        DB::statement('ALTER TABLE offers ADD CONSTRAINT offers_price_cents_check CHECK (price_cents > 0)');
        DB::statement("ALTER TABLE offers ADD CONSTRAINT offers_currency_check CHECK (currency = 'EUR')");
    }

    public function down(): void
    {
        Schema::dropIfExists('offers');
    }
};
