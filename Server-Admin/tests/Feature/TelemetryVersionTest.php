<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\User;
use App\Services\TelemetryVersion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class TelemetryVersionTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create();
    }

    private function visit(array $overrides = []): DomainVisit
    {
        $policy = DomainPolicy::create([
            'domain' => 'example-'.uniqid().'.com',
            'domain_status' => 'safe',
        ]);

        return DomainVisit::create(array_merge([
            'domain_policy_id' => $policy->id,
            'domain' => $policy->domain,
            'visited_at' => now(),
        ], $overrides));
    }

    private function egress(array $overrides = []): EgressEvent
    {
        return EgressEvent::create(array_merge([
            'domain' => 'example-'.uniqid().'.com',
            'file_name' => 'report.csv',
            'file_size' => 512,
            'action' => 'denied',
            'risk_score' => 82,
            'occurred_at' => now(),
        ], $overrides));
    }

    public function test_guests_cannot_poll_the_probe(): void
    {
        $this->get(route('telemetry.version'))->assertRedirect(route('login'));
    }

    public function test_probe_reports_a_fingerprint_for_signed_in_users(): void
    {
        $this->visit();
        $this->egress();

        $response = $this->actingAs($this->admin())->getJson(route('telemetry.version'));

        $response->assertOk()
            ->assertJsonStructure(['telemetryLive' => ['version', 'pollIntervalMs', 'enabled']])
            ->assertJsonPath('telemetryLive.enabled', true);

        $version = $response->json('telemetryLive.version');

        $this->assertSame((string) DomainVisit::max('id'), $version['visits']);
        $this->assertStringStartsWith((string) EgressEvent::max('id'), $version['egress']);
    }

    public function test_probe_moves_when_a_new_visit_arrives(): void
    {
        $this->actingAs($this->admin());

        $before = $this->getJson(route('telemetry.version'))->json('telemetryLive.version.visits');

        $this->visit();

        $after = $this->getJson(route('telemetry.version'))->json('telemetryLive.version.visits');

        $this->assertNotSame($before, $after);
        $this->assertSame((string) DomainVisit::max('id'), $after);
    }

    public function test_probe_moves_when_a_new_egress_event_arrives(): void
    {
        $this->actingAs($this->admin());

        $before = $this->getJson(route('telemetry.version'))->json('telemetryLive.version.egress');

        $this->egress();

        $after = $this->getJson(route('telemetry.version'))->json('telemetryLive.version.egress');

        $this->assertNotSame($before, $after);
    }

    public function test_probe_detects_an_egress_row_upgraded_in_place(): void
    {
        $this->actingAs($this->admin());

        $event = $this->egress(['flagged_items' => null]);

        // Park the row an hour in the past: updated_at only has one-second
        // resolution, so without this the upgrade below could land in the
        // same second as the insert and the test would prove nothing.
        $event->timestamps = false;
        $event->updated_at = now()->subHour();
        $event->save();
        $event->timestamps = true;

        $before = $this->getJson(route('telemetry.version'))->json('telemetryLive.version.egress');

        // The dedup path fills in scan data on the existing row instead of
        // inserting a new one, so MAX(id) does not move. The fingerprint must
        // still change or the enrichment never reaches the screen.
        $event->update([
            'risk_score' => 95,
            'flagged_items' => [['label' => 'api_key', 'count' => 1, 'weight' => 40]],
        ]);

        $after = $this->getJson(route('telemetry.version'))->json('telemetryLive.version.egress');

        $this->assertNotSame($before, $after);
    }

    public function test_shared_prop_is_present_with_the_dashboard(): void
    {
        $this->visit();

        $response = $this->actingAs($this->admin())->get(route('dashboard'));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('telemetryLive.version')
            ->where('telemetryLive.enabled', true)
        );
    }

    public function test_shared_prop_is_empty_for_guests(): void
    {
        $this->visit();

        $response = $this->get(route('home'));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('telemetryLive.enabled', false)
            ->where('telemetryLive.version', [])
        );
    }

    public function test_shared_prop_is_disabled_by_config(): void
    {
        config(['able.telemetry_auto_refresh_enabled' => false]);

        $this->actingAs($this->admin())->get(route('dashboard'))
            ->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('telemetryLive.enabled', false)
            );
    }

    public function test_probe_interval_is_configurable(): void
    {
        config(['able.telemetry_poll_interval_ms' => 15000]);

        $response = $this->actingAs($this->admin())->getJson(route('telemetry.version'));

        $response->assertOk()->assertJsonPath('telemetryLive.pollIntervalMs', 15000);
    }

    public function test_fingerprint_is_cheap_indexed_aggregates(): void
    {
        $service = app(TelemetryVersion::class);

        $queries = 0;
        \DB::listen(function () use (&$queries): void {
            $queries++;
        });

        $service->snapshot();

        // One indexed MAX per fingerprinted column: visits id, egress id,
        // egress updated_at. No row reads, no table scans.
        $this->assertLessThanOrEqual(3, $queries);
    }
}
