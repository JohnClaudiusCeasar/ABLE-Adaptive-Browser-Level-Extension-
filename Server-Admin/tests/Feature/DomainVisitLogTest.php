<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia;
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

    public function test_retry_with_same_event_id_is_deduplicated_past_debounce_window(): void
    {
        $payload = [
            'domain' => 'example.com',
            'status' => 'unlisted',
            'source' => 'default',
            'user_id' => 'ABLE-TEST',
            'event_id' => 'visit-event-123',
        ];

        $first = $this->postJson('/api/log-visit', $payload);
        $first->assertOk();
        $this->assertFalse($first->json('duplicate'));

        // Advance past the debounce window: event_id must still dedupe.
        $this->travel(10)->seconds();

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

    public function test_domain_policy_change_does_not_mutate_historical_visit_status(): void
    {
        // 1. First visit logged when domain is unlisted
        $this->logVisit('example.com');
        $firstVisit = DomainVisit::where('domain', 'example.com')->first();
        $this->assertNotNull($firstVisit);
        $this->assertSame('unlisted', $firstVisit->status);
        $this->assertSame('unlisted', $firstVisit->resolvedStatus());
        $this->assertSame('glass-unlisted', $firstVisit->glassStatus());
        $this->assertSame('Warned', $firstVisit->actionLabel());

        // 2. Admin changes the domain status from unlisted to safe
        $policy = DomainPolicy::where('domain', 'example.com')->first();
        $policy->update([
            'domain_status' => 'safe',
            'policy' => 'whitelisted',
        ]);

        // 3. Verify the previous visit row remains unlisted despite policy change
        $firstVisit->refresh();
        $this->assertSame('unlisted', $firstVisit->status);
        $this->assertSame('unlisted', $firstVisit->resolvedStatus());
        $this->assertSame('glass-unlisted', $firstVisit->glassStatus());
        $this->assertSame('Warned', $firstVisit->actionLabel());

        // 4. Second visit arrives after debounce window, inherits the new safe policy
        $this->travel(10)->seconds();
        $this->logVisit('example.com');

        $this->assertSame(2, DomainVisit::where('domain', 'example.com')->count());

        $visits = DomainVisit::where('domain', 'example.com')->orderBy('visited_at', 'asc')->get();
        $this->assertSame('unlisted', $visits[0]->status);
        $this->assertSame('glass-unlisted', $visits[0]->glassStatus());
        $this->assertSame('Warned', $visits[0]->actionLabel());

        $this->assertSame('safe', $visits[1]->status);
        $this->assertSame('glass-safe', $visits[1]->glassStatus());
        $this->assertSame('Allowed', $visits[1]->actionLabel());
    }

    public function test_domain_visits_controller_renders_immutable_point_in_time_status(): void
    {
        $user = User::factory()->create();

        // 1. Initial unlisted visit
        $this->logVisit('testdomain.com');

        // 2. Policy updated to safe
        DomainPolicy::where('domain', 'testdomain.com')->first()->update([
            'domain_status' => 'safe',
        ]);

        // 3. Subsequent visit inherits safe
        $this->travel(10)->seconds();
        $this->logVisit('testdomain.com');

        // 4. Render domain-visits page and assert both statuses exist
        $response = $this->actingAs($user)->get(route('domain-visits'));
        $response->assertOk();

        $response->assertInertia(function (AssertableInertia $page) {
            $page->component('domain-visits')
                ->has('domainVisits', 2)
                ->where('domainVisits.0.status', 'glass-safe')
                ->where('domainVisits.0.action', 'Allowed')
                ->where('domainVisits.1.status', 'glass-unlisted')
                ->where('domainVisits.1.action', 'Warned');
        });
    }

    public function test_get_domain_visits_returns_visit_count_and_active_users_metrics(): void
    {
        $policy = DomainPolicy::create([
            'domain' => 'metrictest.com',
            'domain_status' => 'safe',
            'policy' => 'whitelisted',
            'risk_score' => 0,
            'visit_count' => 10,
        ]);

        // user-Old: visited 25 minutes ago (outside the 15m active window)
        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'domain' => 'metrictest.com',
            'status' => 'safe',
            'user_id' => 'user-Old',
            'visited_at' => now()->subMinutes(25),
        ]);

        // user-A: visited 10 minutes ago and 5 minutes ago (inside the 15m active window)
        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'domain' => 'metrictest.com',
            'status' => 'safe',
            'user_id' => 'user-A',
            'visited_at' => now()->subMinutes(10),
        ]);

        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'domain' => 'metrictest.com',
            'status' => 'safe',
            'user_id' => 'user-A',
            'visited_at' => now()->subMinutes(5),
        ]);

        // user-B: visited right now (inside the 15m active window)
        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'domain' => 'metrictest.com',
            'status' => 'safe',
            'user_id' => 'user-B',
            'visited_at' => now(),
        ]);

        // user-C: had an egress event 3 minutes ago (inside the 15m active window)
        EgressEvent::create([
            'domain' => 'metrictest.com',
            'file_name' => 'confidential.pdf',
            'file_size' => 1024,
            'file_type' => 'application/pdf',
            'risk_score' => 20,
            'action' => 'proceeded',
            'user_id' => 'user-C',
            'occurred_at' => now()->subMinutes(3),
        ]);

        $response = $this->getJson("/api/domain-policies/{$policy->id}/visits");
        $response->assertOk();
        $response->assertJson([
            'visit_count' => 10,
            'active_users' => 3, // user-A, user-B, user-C (user-Old excluded because >15m)
            'total' => 4,
        ]);
    }
}
