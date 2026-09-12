<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Support\DomainBrandMap;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DomainBrandMapTest extends TestCase
{
    use RefreshDatabase;

    public function test_lookup_resolves_exact_and_subdomain(): void
    {
        $this->assertSame('Streaming', DomainBrandMap::lookup('youtube.com'));
        $this->assertSame('Streaming', DomainBrandMap::lookup('music.youtube.com'));
        $this->assertNull(DomainBrandMap::lookup('not-a-brand-xyz123.com'));
    }

    public function test_manual_rows_win_over_brand_map(): void
    {
        DomainPolicy::create([
            'domain' => 'youtube.com',
            'domain_status' => 'unlisted',
            'policy' => 'under_review',
            'category' => 'Reference',
            'classification_source' => 'manual',
            'risk_score' => 20,
        ]);

        $this->postJson('/api/classify-domain', [
            'url' => 'https://www.youtube.com/',
            'signals' => ['title' => 'YouTube'],
        ])->assertOk()->assertJson([
            'category' => 'Reference',
            'source' => 'database',
        ]);
    }
}
