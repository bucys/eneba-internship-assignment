<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->unique()->constrained()->restrictOnDelete();
            $table->string('title', 80);
            $table->string('tagline', 160);
            $table->string('cta_label', 30);
            $table->string('image_url', 2048);
            $table->smallInteger('position');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banners');
    }
};
