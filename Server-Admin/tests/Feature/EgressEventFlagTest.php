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
}
