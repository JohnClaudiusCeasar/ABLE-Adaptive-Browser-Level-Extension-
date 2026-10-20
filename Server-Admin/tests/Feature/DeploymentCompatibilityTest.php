<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\NudgeInteraction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Guards the two production-only 500s found in the PostgreSQL deployment audit.
 *
 * The live deployment runs PostgreSQL (render.yaml), while local dev uses
 * MySQL and the suite runs on SQLite. Both of those silently accept SQL that
 * PostgreSQL rejects, so neither a passing test suite nor a working local
 * environment proves a page renders on the cloud.
 */
class DeploymentCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    protected function seedTelemetry(): void
    {
        $policy = DomainPolicy::create([
            'domain' => 'example.com',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'category' => 'Cloud App',
            'risk_score' => 90,
            'block_access' => true,
            'visit_count' => 7,
        ]);

        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'domain' => 'example.com',
            'status' => 'unsafe',
            'user_id' => 'ABLE-TESTUSER',
            'visited_at' => now(),
        ]);

        $egress = EgressEvent::create([
            'domain' => 'example.com',
            'user_id' => 'ABLE-TESTUSER',
            'file_name' => 'secret.pdf',
            'file_size' => 1024,
            'action' => 'denied',
            'risk_score' => 88,
            'occurred_at' => now(),
        ]);

        NudgeInteraction::create([
            'egress_event_id' => $egress->id,
            'domain' => 'example.com',
            'user_id' => 'ABLE-TESTUSER',
            'user_action' => 'cancelled',
            'interacted_at' => now(),
        ]);

        ExtensionLifecycle::create([
            'user_id' => 'ABLE-TESTUSER',
            'event' => 'uninstalled',
            'occurred_at' => now(),
        ]);
    }

    /**
     * The uninstall URL the extension registers contains user_id and
     * extension_id only, so the endpoint must survive a missing version.
     */
    public function test_uninstall_endpoint_accepts_the_extension_uninstall_url(): void
    {
        $response = $this->get('/api/extension/uninstall?user_id=ABLE-TESTUSER&extension_id=abcdefghijklmnop');

        $response->assertOk();

        $this->assertDatabaseHas('extension_lifecycles', [
            'user_id' => 'ABLE-TESTUSER',
            'event' => 'uninstalled',
        ]);
    }

    public function test_lifecycle_endpoint_accepts_a_request_without_optional_fields(): void
    {
        $response = $this->postJson('/api/extension/lifecycle', [
            'user_id' => 'ABLE-TESTUSER',
            'event' => 'installed',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('extension_lifecycles', [
            'user_id' => 'ABLE-TESTUSER',
            'event' => 'installed',
        ]);
    }

    /**
     * Every page that reads telemetry, so the guard sees the queries the
     * report, dashboard and analytics screens actually issue.
     */
    public function test_telemetry_pages_render(): void
    {
        $this->seedTelemetry();

        $user = User::factory()->superAdmin()->create();

        foreach ([
            '/dashboard',
            '/reports/preview',
            '/dashboard/report-preview',
            '/dashboard/report/excel',
            '/dashboard/report/pdf',
            '/security-analytics',
            '/shadow-analytics',
            '/domain-visits',
        ] as $url) {
            $this->actingAs($user)
                ->get($url)
                ->assertOk();
        }
    }

    /**
     * PostgreSQL has no implicit boolean/integer cast, so comparing a boolean
     * column to the literal 1 raises "operator does not exist: boolean =
     * integer" and 500s the page. MySQL and SQLite coerce silently, which is
     * why only the cloud deployment breaks — so inspect the compiled SQL
     * rather than the query result.
     */
    public function test_no_query_compares_a_boolean_column_to_an_integer_literal(): void
    {
        $captured = [];

        DB::listen(function ($query) use (&$captured) {
            $captured[] = $query->sql;
        });

        $this->seedTelemetry();

        $user = User::factory()->superAdmin()->create();

        foreach ([
            '/dashboard',
            '/reports/preview',
            '/dashboard/report/excel',
            '/security-analytics',
            '/domain-visits',
            '/settings/server',
        ] as $url) {
            $this->actingAs($user)->get($url);
        }

        $offenders = array_values(array_filter(
            $captured,
            fn (string $sql): bool => preg_match('/\bblock_access\s*=\s*\d/', $sql) === 1
        ));

        $this->assertSame([], $offenders, sprintf(
            'Boolean column compared to an integer literal; PostgreSQL rejects this: %s',
            implode(' | ', $offenders)
        ));
    }
}
