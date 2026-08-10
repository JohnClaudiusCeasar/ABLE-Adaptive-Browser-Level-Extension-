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
