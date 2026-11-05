<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\User;
use App\Services\AbleSettingsService;
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

    public function test_egress_incidents_page_receives_the_extension_block_threshold()
    {
        $admin = User::factory()->create();

        // The table marks a Proceeded row as low risk against this number, so
        // it has to be the threshold the extension actually intercepts at.
        app(AbleSettingsService::class)->put('extension', 'behavior.risk_threshold', 55);

        $response = $this->actingAs($admin)
            ->get(route('security-analytics.egress-incidents'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('security-analytics/egress-incidents')
                ->where('riskThreshold', 55),
            );
    }

    public function test_egress_incidents_page_defaults_the_threshold_to_85()
    {
        $admin = User::factory()->create();

        $response = $this->actingAs($admin)
            ->get(route('security-analytics.egress-incidents'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('security-analytics/egress-incidents')
                ->where('riskThreshold', 85),
            );
    }

    public function test_shadow_adopters_only_counts_users_with_more_than_five_at_risk_egress_attempts()
    {
        $admin = User::factory()->create();

        DomainPolicy::create([
            'domain' => 'dropshare.io',
            'domain_status' => 'unsafe',
        ]);

        $this->egressAttempts('usr_repeat', 6, 90);
        $this->egressAttempts('usr_five_only', 5, 90);
        $this->egressAttempts('usr_low_risk', 6, 40);

        $response = $this->actingAs($admin)
            ->get(route('security-analytics'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('security-analytics')
                ->where('kpi.shadowAdopters', 1)
                ->has('shadowAdopterList', 1)
                ->where('shadowAdopterList.0.id', 1)
                ->where('shadowAdopterList.0.client_name', 'usr_repeat'),
            );
    }

    public function test_shadow_adopters_respects_the_configured_risk_threshold()
    {
        $admin = User::factory()->create();

        app(AbleSettingsService::class)->put('extension', 'behavior.risk_threshold', 55);

        DomainPolicy::create([
            'domain' => 'dropshare.io',
            'domain_status' => 'unlisted',
        ]);

        // Scores 60: below the default 85, above the configured 55.
        $this->egressAttempts('usr_above_configured', 6, 60);

        $response = $this->actingAs($admin)
            ->get(route('security-analytics'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('security-analytics')
                ->where('kpi.shadowAdopters', 1),
            );
    }

    public function test_active_shadow_apps_counts_domains_with_more_than_three_proceeded_uploads()
    {
        $admin = User::factory()->create();

        $policy = DomainPolicy::create([
            'domain' => 'dropshare.io',
            'domain_status' => 'unsafe',
        ]);

        $this->proceededUploads('dropshare.io', 4);
        $this->proceededUploads('megaupload.net', 3);

        // Denied uploads never make an app active.
        $this->egressAttempts('usr_denied', 5, 90);

        $response = $this->actingAs($admin)
            ->get(route('security-analytics'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('security-analytics')
                ->where('kpi.activeShadowApps', 1)
                ->has('activeShadowAppsList', 1)
                ->where('activeShadowAppsList.0.id', $policy->id)
                ->where('activeShadowAppsList.0.domain', 'dropshare.io')
                ->where('activeShadowAppsList.0.usage_count', 4),
            );
    }

    private function egressAttempts(string $userId, int $count, int $riskScore): void
    {
        for ($i = 0; $i < $count; $i++) {
            EgressEvent::create([
                'domain' => 'dropshare.io',
                'user_id' => $userId,
                'file_name' => "file-{$i}.txt",
                'file_size' => 128,
                'action' => 'denied',
                'risk_score' => $riskScore,
                'occurred_at' => now(),
            ]);
        }
    }

    private function proceededUploads(string $domain, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            EgressEvent::create([
                'domain' => $domain,
                'user_id' => 'usr_uploader',
                'file_name' => "upload-{$i}.txt",
                'file_size' => 256,
                'action' => 'proceeded',
                'risk_score' => 90,
                'occurred_at' => now(),
            ]);
        }
    }
}
