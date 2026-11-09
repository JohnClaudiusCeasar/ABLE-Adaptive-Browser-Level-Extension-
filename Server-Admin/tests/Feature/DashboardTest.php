<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_users_can_visit_the_dashboard()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->get(route('dashboard'));
        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('recommendationCount', 0)
            ->has('nudgeSuccessRate')
            ->has('nudgeProceededHigh')
            ->has('nudgeProceededLow'));
    }

    public function test_nudge_containment_distinguishes_high_risk_and_low_risk_proceeded_events()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        // Cancelled high-risk egress (risk_score = 90)
        $egressCancelled = \App\Models\EgressEvent::create([
            'domain' => 'example.com',
            'user_id' => 'ABLE-TEST',
            'file_name' => 'critical.doc',
            'file_size' => 1024,
            'action' => 'denied',
            'risk_score' => 90,
            'occurred_at' => now(),
        ]);
        \App\Models\NudgeInteraction::create([
            'egress_event_id' => $egressCancelled->id,
            'domain' => 'example.com',
            'user_id' => 'ABLE-TEST',
            'user_action' => 'cancelled',
            'interacted_at' => now(),
        ]);

        // Proceeded low-risk egress (risk_score = 40)
        $egressLow = \App\Models\EgressEvent::create([
            'domain' => 'example.com',
            'user_id' => 'ABLE-TEST',
            'file_name' => 'benign.txt',
            'file_size' => 512,
            'action' => 'proceeded',
            'risk_score' => 40,
            'occurred_at' => now(),
        ]);
        \App\Models\NudgeInteraction::create([
            'egress_event_id' => $egressLow->id,
            'domain' => 'example.com',
            'user_id' => 'ABLE-TEST',
            'user_action' => 'proceeded',
            'interacted_at' => now(),
        ]);

        // Proceeded high-risk egress (risk_score = 95)
        $egressHigh = \App\Models\EgressEvent::create([
            'domain' => 'example.com',
            'user_id' => 'ABLE-TEST',
            'file_name' => 'leaked.key',
            'file_size' => 2048,
            'action' => 'proceeded',
            'risk_score' => 95,
            'occurred_at' => now(),
        ]);
        \App\Models\NudgeInteraction::create([
            'egress_event_id' => $egressHigh->id,
            'domain' => 'example.com',
            'user_id' => 'ABLE-TEST',
            'user_action' => 'proceeded',
            'interacted_at' => now(),
        ]);

        $response = $this->get(route('dashboard'));
        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('nudgeCancelled', 1)
            ->where('nudgeProceeded', 2)
            ->where('nudgeProceededHigh', 1)
            ->where('nudgeProceededLow', 1)
            ->where('nudgeSuccessRate', 58.3)
            ->where('nudgeHighRiskSuccessRate', 50));
    }
}
