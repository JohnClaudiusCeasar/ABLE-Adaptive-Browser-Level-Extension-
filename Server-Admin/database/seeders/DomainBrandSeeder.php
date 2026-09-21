<?php

namespace Database\Seeders;

use App\Models\DomainPolicy;
use Illuminate\Database\Seeder;

class DomainBrandSeeder extends Seeder
{
    /**
     * Seed the curated brand map as reviewable rows so the signed offline
     * cache ships them to extensions without a config deploy.
     */
    public function run(): void
    {
        /** @var array<string, string> $brands */
        $brands = config('domain_brands', []);

        foreach ($brands as $domain => $category) {
            DomainPolicy::firstOrCreate(
                ['domain' => $domain],
                [
                    'domain_status' => 'unlisted',
                    'policy' => 'under_review',
                    'category' => $category,
                    'classification_source' => 'seed',
                    'confidence' => 1.0,
                    'risk_score' => 60,
                    'visit_count' => 0,
                ]
            );
        }
    }
}
