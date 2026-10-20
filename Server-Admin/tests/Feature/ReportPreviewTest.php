<?php

namespace Tests\Feature;

use App\Http\Controllers\DashboardReportController;
use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\NudgeInteraction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use ReflectionMethod;
use Tests\TestCase;

class ReportPreviewTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Seed one row of every telemetry table the report reads, including a
     * blocked domain so the `block_access` aggregation is exercised.
     */
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

        DomainPolicy::create([
            'domain' => 'safe.example.net',
            'domain_status' => 'safe',
            'policy' => 'whitelisted',
            'category' => 'General Cloud',
            'risk_score' => 10,
            'block_access' => false,
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
     * @return array<string, mixed>
     */
    protected function buildReportData(): array
    {
        $method = new ReflectionMethod(DashboardReportController::class, 'getComprehensiveReportData');
        $method->setAccessible(true);

        return $method->invoke(new DashboardReportController, 'Asia/Manila');
    }

    public function test_report_preview_page_renders(): void
    {
        $this->seedTelemetry();

        $user = User::factory()->superAdmin()->create();

        $this->actingAs($user)
            ->get(route('reports.preview'))
            ->assertOk();
    }

    public function test_report_data_counts_blocked_domains(): void
    {
        $this->seedTelemetry();

        $data = $this->buildReportData();

        $this->assertSame(1, $data['domainUsage']['blocked']);
        $this->assertSame(1, $data['domainUsage']['unsafe']);
        $this->assertSame(1, $data['domainUsage']['safe']);
    }

    /**
     * PostgreSQL has no implicit boolean/integer cast, so comparing the
     * `block_access` boolean column to the literal 1 raises
     * "operator does not exist: boolean = integer" and 500s the report page.
     * MySQL and SQLite coerce silently, so only the live PostgreSQL
     * deployment breaks — which is why this guard inspects the compiled SQL
     * rather than the query result.
     */
    public function test_report_queries_never_compare_a_boolean_column_to_an_integer_literal(): void
    {
        $captured = [];

        DB::listen(function ($query) use (&$captured) {
            $captured[] = $query->sql;
        });

        $this->seedTelemetry();
        $this->buildReportData();

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
