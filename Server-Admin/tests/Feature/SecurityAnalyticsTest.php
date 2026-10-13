<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SecurityAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_shadow_catalog_renders_globally_without_a_scope()
    {
        $admin = User::factory()->create();

        DomainPolicy::create([
            'domain' => 'example.com',
            'domain_status' => 'safe',
        ]);

        $response = $this->actingAs($admin)
            ->get(route('security-analytics.shadow-apps'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('security-analytics/shadow-apps')
                ->has('shadowCatalog', 1)
                ->where('scoped_user', null),
            );
    }

    public function test_shadow_catalog_scopes_rows_and_counts_to_a_single_client()
    {
        $admin = User::factory()->create();

        $touched = DomainPolicy::create([
            'domain' => 'github.com',
            'domain_status' => 'safe',
            'category' => 'Developer Tools',
            'risk_score' => 42,
        ]);

        DomainPolicy::create([
            'domain' => 'untouched.com',
            'domain_status' => 'safe',
            'category' => 'Streaming',
            'risk_score' => 90,
        ]);

        DomainVisit::create([
            'domain_policy_id' => $touched->id,
            'user_id' => 'usr_catalog_user',
            'domain' => 'github.com',
            'visited_at' => now(),
        ]);

        DomainVisit::create([
            'domain_policy_id' => $touched->id,
            'user_id' => 'usr_catalog_user',
            'domain' => 'github.com',
            'visited_at' => now()->subDay(),
        ]);

        // Another client's visit must not count toward this client's totals.
        DomainVisit::create([
            'domain_policy_id' => $touched->id,
            'user_id' => 'usr_other_client',
            'domain' => 'github.com',
            'visited_at' => now(),
        ]);

        EgressEvent::create([
            'domain' => 'github.com',
            'user_id' => 'usr_catalog_user',
            'file_name' => 'secrets.txt',
            'file_size' => 512,
            'action' => 'denied',
            'risk_score' => 82,
            'occurred_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->get(route('security-analytics.shadow-apps', ['user_id' => 'usr_catalog_user']));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('security-analytics/shadow-apps')
                ->where('scoped_user', 'usr_catalog_user')
                ->has('shadowCatalog', 1)
                ->where('shadowCatalog.0.domain', 'github.com')
                ->where('shadowCatalog.0.user_visits', 2)
                ->where('shadowCatalog.0.user_incidents', 1),
            );
    }
}
