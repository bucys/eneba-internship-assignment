<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offer_id')->constrained()->restrictOnDelete();
            $table->string('code')->unique();
            $table->foreignId('order_item_id')->nullable()->index()->constrained()->restrictOnDelete();
            $table->timestamp('sold_at')->nullable();
            $table->timestamps();
        });

        DB::statement('ALTER TABLE product_keys ADD CONSTRAINT product_keys_sold_state_check CHECK ((order_item_id IS NULL) = (sold_at IS NULL))');
        // Blueprint has no partial index method; this one serves only unsold key (stock) lookups.
        DB::statement('CREATE INDEX product_keys_available_offer_id_index ON product_keys (offer_id) WHERE order_item_id IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('product_keys');
    }
};
