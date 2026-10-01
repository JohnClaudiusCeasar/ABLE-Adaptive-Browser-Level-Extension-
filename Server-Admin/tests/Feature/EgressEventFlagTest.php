<?php

namespace Tests\Feature;

use App\Models\EgressEvent;
use App\Models\RiskPattern;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EgressEventFlagTest extends TestCase
{
    use RefreshDatabase;

    public function test_log_egress_persists_flagged_items()
    {
        $flaggedItems = json_encode([
            ['label' => 'SSN - Standard Format', 'count' => 2, 'weight' => 35],
            ['label' => 'Email Address', 'count' => 1, 'weight' => 0],
        ]);

        $response = $this->postJson('/api/log-egress', [
            'domain' => 'example.com',
            'user_id' => 'user-1',
            'file_name' => 'report.txt',
            'file_size' => 1200,
            'risk_score' => 45,
            'action' => 'denied',
            'flagged_items' => $flaggedItems,
        ]);

        $response->assertOk();

        $event = EgressEvent::first();
        $this->assertNotNull($event);
        $this->assertSame('SSN - Standard Format', $event->flagged_items[0]['label']);
        $this->assertSame(2, $event->flagged_items[0]['count']);
        $this->assertSame('Email Address', $event->flagged_items[1]['label']);
    }

    public function test_log_egress_accepts_missing_flagged_items()
    {
        $response = $this->postJson('/api/log-egress', [
            'domain' => 'example.com',
            'user_id' => 'user-1',
            'file_name' => 'report.txt',
            'risk_score' => 10,
            'action' => 'allowed',
        ]);

        $response->assertOk();

        $event = EgressEvent::first();
        $this->assertNotNull($event);
        $this->assertNull($event->flagged_items);
    }

    public function test_retry_with_same_event_id_is_deduplicated_past_dedup_window(): void
    {
        $payload = [
            'domain' => 'example.com',
            'user_id' => 'user-1',
            'file_name' => 'report.txt',
            'file_size' => 1200,
            'risk_score' => 45,
            'action' => 'denied',
            'event_id' => 'egress-event-123',
        ];

        $first = $this->postJson('/api/log-egress', $payload);
        $first->assertOk();
        $this->assertFalse($first->json('duplicate'));

        // Advance past the 60-second window: event_id must still dedupe.
        $this->travel(2)->minutes();

        $retry = $this->postJson('/api/log-egress', $payload);
        $retry->assertOk();
        $this->assertTrue($retry->json('duplicate'));
        $this->assertSame(1, EgressEvent::where('domain', 'example.com')->count());
    }

    public function test_single_view_reports_flag_counts_per_pattern_title()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        RiskPattern::create([
            'title' => 'SSN - Standard Format',
            'type' => 'single',
            'regex' => '\b\d{3}-\d{2}-\d{4}\b',
            'priority' => 'high',
            'score' => 35,
        ]);

        foreach ([1, 2] as $i) {
            EgressEvent::create([
                'domain' => "site-{$i}.com",
                'user_id' => 'user-1',
                'file_name' => "file-{$i}.txt",
                'risk_score' => 40,
                'action' => 'denied',
                'flagged_items' => [
                    ['label' => 'SSN - Standard Format', 'count' => 1, 'weight' => 35],
                    ['label' => 'Unrelated Pattern', 'count' => 3, 'weight' => 10],
                ],
                'occurred_at' => now(),
            ]);
        }

        $response = $this->get(route('risk-algorithm.view', 'single'));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('risk-algorithm/single')
                ->where('flagCounts.SSN - Standard Format', 2),
        );
    }

    public function test_egress_logs_labels_unlisted_uploads_under_threshold_as_at_risk()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        // Upload to unlisted site under 90 risk score without modal interaction -> "At Risk"
        EgressEvent::create([
            'domain' => 'unlisted-site.com',
            'user_id' => 'user-1',
            'file_name' => 'document.docx',
            'risk_score' => 50,
            'action' => 'proceeded',
            'occurred_at' => now(),
        ]);

        // Upload exceeding 90 threshold where user proceeded via modal -> "Proceeded"
        EgressEvent::create([
            'domain' => 'unsafe-site.com',
            'user_id' => 'user-2',
            'file_name' => 'confidential.pdf',
            'risk_score' => 95,
            'action' => 'proceeded',
            'occurred_at' => now()->subMinute(),
        ]);

        // Allowed upload to safe site -> "Allowed"
        EgressEvent::create([
            'domain' => 'trusted.com',
            'user_id' => 'user-3',
            'file_name' => 'notes.txt',
            'risk_score' => 0,
            'action' => 'allowed',
            'occurred_at' => now()->subMinutes(2),
        ]);

        $response = $this->get(route('security-analytics.egress-incidents'));
        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('security-analytics/egress-incidents')
                ->has('recentShadowEgress', 3)
                ->where('recentShadowEgress.0.action', 'Proceeded')
                ->where('recentShadowEgress.1.action', 'Proceeded')
                ->where('recentShadowEgress.2.action', 'Allowed')
        );
    }
}
