<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Typo tolerant search (spec 0013 AC-5). pg_trgm is a trusted extension, so the database
 * owner can create it on Neon without superuser.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        DB::statement('CREATE INDEX products_name_trgm_idx ON products USING gin (name gin_trgm_ops)');
    }

    /**
     * Keeps pg_trgm: the extension is database wide, and other objects may come to depend on it.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS products_name_trgm_idx');
    }
};
