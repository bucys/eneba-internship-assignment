<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('status')->default('paid');
            $table->integer('total_cents');
            $table->char('currency', 3)->default('EUR');
            $table->uuid('idempotency_key');
            $table->timestamp('paid_at');
            $table->timestamps();

            $table->unique(['user_id', 'idempotency_key']);
            $table->index(['user_id', 'created_at']);
        });

        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('paid'))");
        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_total_cents_check CHECK (total_cents > 0)');
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_currency_check CHECK (currency = 'EUR')");
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
