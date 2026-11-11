<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * No factories or Faker here, so `db:seed` runs without dev dependencies (spec 0004).
     */
    public function run(): void
    {
        $this->call(CatalogSeeder::class);

        if (! app()->isProduction()) {
            User::firstOrCreate(
                ['email' => 'test@example.com'],
                ['name' => 'Test User', 'password' => 'password'],
            );
        }
    }
}
