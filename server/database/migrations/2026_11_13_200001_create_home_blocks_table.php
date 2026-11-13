<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('home_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('type', 32)->unique();
            $table->string('title', 80);
            $table->smallInteger('position');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'position']);
        });

        // Keeps every stored type inside HomeBlockType, so the enum cast never throws (spec 0014).
        DB::statement("ALTER TABLE home_blocks ADD CONSTRAINT home_blocks_type_check CHECK (type IN ('banners', 'best_sellers', 'deals', 'products'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('home_blocks');
    }
};
