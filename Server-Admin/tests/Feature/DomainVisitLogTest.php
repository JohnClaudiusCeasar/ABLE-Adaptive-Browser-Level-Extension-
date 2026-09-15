<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
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

        // Space visits outside the debounce window so each counts as a new visit.
        $this->travel(10)->seconds();

        $second = $this->logVisit();
        $this->assertSame(2, $second['visit_count']);

        $this->travel(10)->seconds();

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

        $this->travel(10)->seconds();

        $this->assertSame(2, $this->logVisit('alpha.com')['visit_count']);
    }

    public function test_duplicate_visit_within_debounce_window_is_ignored(): void
    {
        $first = $this->logVisit();
        $this->assertSame(1, $first['visit_count']);

        $second = $this->logVisit();
        $this->assertTrue($second['success']);
        $this->assertTrue($second['duplicate']);
        $this->assertSame(1, $second['visit_count']);

        $this->assertSame(1, DomainPolicy::where('domain', 'example.com')->value('visit_count'));
        $this->assertSame(1, DomainVisit::where('domain', 'example.com')->count());
    }

    public function test_repeat_visit_after_debounce_window_is_counted(): void
    {
        $this->logVisit();
        $this->travel(10)->seconds();

        $second = $this->logVisit();
        $this->assertFalse($second['duplicate']);
        $this->assertSame(2, $second['visit_count']);
        $this->assertSame(2, DomainVisit::where('domain', 'example.com')->count());
    }

    public function test_retry_with_same_client_timestamp_is_deduplicated(): void
    {
        $clientTimestamp = (int) (now()->valueOf());

        $payload = [
            'domain' => 'example.com',
            'status' => 'unlisted',
            'source' => 'default',
            'user_id' => 'ABLE-TEST',
            'visited_at' => $clientTimestamp,
        ];

        $first = $this->postJson('/api/log-visit', $payload);
        $first->assertOk();
        $this->assertFalse($first->json('duplicate'));

        // Same page load retried (queue flush, double submit): identical
        // client timestamp must not create a second row.
        $retry = $this->postJson('/api/log-visit', $payload);
        $retry->assertOk();
        $this->assertTrue($retry->json('duplicate'));
        $this->assertSame(1, $retry->json('visit_count'));
        $this->assertSame(1, DomainVisit::where('domain', 'example.com')->count());
    }

    public function test_client_provided_timestamp_is_stored(): void
    {
        // Send a fixed epoch timestamp (2024-01-15 10:30:00 UTC = 1705312200000 ms)
        $clientTimestamp = 1705312200000;

        $this->postJson('/api/log-visit', [
            'domain' => 'example.com',
            'status' => 'unlisted',
            'source' => 'default',
            'user_id' => 'ABLE-TEST',
            'visited_at' => $clientTimestamp,
        ])->assertOk();

        $visit = DomainVisit::where('domain', 'example.com')->first();
        $this->assertNotNull($visit);

        // The stored timestamp should match the client's device time, not the server's now()
        $expected = Carbon::createFromTimestampMs($clientTimestamp);
        $this->assertSame(
            $expected->format('Y-m-d H:i:s'),
            $visit->visited_at->format('Y-m-d H:i:s'),
            'visited_at should use the client-provided timestamp, not server now()',
        );

        // Server-generated timestamp would differ significantly from the fixed client value
        $this->assertNotEquals(
            now()->format('Y-m-d H:i:s'),
            $visit->visited_at->format('Y-m-d H:i:s'),
        );
    }

    public function test_missing_timestamp_falls_back_to_server_now(): void
    {
        $before = now();

        $this->postJson('/api/log-visit', [
            'domain' => 'example.com',
            'status' => 'unlisted',
            'source' => 'default',
            'user_id' => 'ABLE-TEST',
        ])->assertOk();

        $visit = DomainVisit::where('domain', 'example.com')->first();
        $this->assertNotNull($visit);

        // Without a client timestamp, server now() is used as fallback
        $this->assertGreaterThanOrEqual(
            $before->timestamp,
            $visit->visited_at->timestamp,
        );
    }
}
