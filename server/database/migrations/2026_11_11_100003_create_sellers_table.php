<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sellers', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->smallInteger('rating_basis_points');
            $table->integer('rating_count')->default(0);
            $table->timestamps();
        });

        DB::statement('ALTER TABLE sellers ADD CONSTRAINT sellers_rating_basis_points_check CHECK (rating_basis_points BETWEEN 0 AND 10000)');
        DB::statement('ALTER TABLE sellers ADD CONSTRAINT sellers_rating_count_check CHECK (rating_count >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('sellers');
    }
};
