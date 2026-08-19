<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DomainVisitLogTest extends TestCase
{
    use RefreshDatabase;

    private function logVisit(string $domain = 'example.com'): array
    {
        return $this->postJson('/api/log-visit', [
            'domain' => $domain,
            'status' => 'unlisted',
            'source' => 'default',
            'user_id' => 'ABLE-TEST',
        ])->json();
    }

    public function test_visit_count_increments_on_repeat_visits_to_the_same_domain(): void
    {
        $first = $this->logVisit();
        $this->assertTrue($first['success']);
        $this->assertSame(1, $first['visit_count']);

        $second = $this->logVisit();
        $this->assertSame(2, $second['visit_count']);

        $third = $this->logVisit();
        $this->assertSame(3, $third['visit_count']);

        // One policy row for the domain, with a visit_count matching the visits...
        $this->assertSame(1, DomainPolicy::where('domain', 'example.com')->count());
        $this->assertSame(3, DomainPolicy::where('domain', 'example.com')->value('visit_count'));
        // ...and one DomainVisit row per individual visit.
        $this->assertSame(3, DomainVisit::where('domain', 'example.com')->count());
    }

    public function test_visit_count_is_independent_per_domain(): void
    {
        $this->logVisit('alpha.com');

        $this->assertSame(1, $this->logVisit('beta.com')['visit_count']);
        $this->assertSame(2, $this->logVisit('alpha.com')['visit_count']);
    }
}
