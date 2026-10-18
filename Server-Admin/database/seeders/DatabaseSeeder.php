<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        if (app()->isProduction()) {
            // Seed data never ships to the production cloud database.
            // Production data changes ship via migrations with the DB layout.
            return;
        }

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        // Additional users so the chat inbox and user list are populated locally.
        User::factory()->count(5)->create();

        $this->call([
            RiskPatternSeeder::class,
        ]);
    }
}
