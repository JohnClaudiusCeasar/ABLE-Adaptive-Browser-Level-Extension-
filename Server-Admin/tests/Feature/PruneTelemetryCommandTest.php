<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\Notification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PruneTelemetryCommandTest extends TestCase
{
    use RefreshDatabase;

    private function egressEvent(string $domain, int $daysAgo): EgressEvent
    {
        return EgressEvent::create([
            'domain' => $domain,
            'user_id' => 'ABLE-TEST1',
            'file_name' => 'file.pdf',
            'file_size' => 128,
            'risk_score' => 60,
            'action' => 'proceeded',
            'occurred_at' => now()->subDays($daysAgo),
        ]);
    }

    public function test_it_removes_rows_older_than_the_retention_window(): void
    {
        $old = $this->egressEvent('old.test', 400);
        $recent = $this->egressEvent('recent.test', 10);

        $this->artisan('able:prune-telemetry --days=365')->assertSuccessful();

        $this->assertNull(EgressEvent::find($old->id));
        $this->assertNotNull(EgressEvent::find($recent->id));
    }

    public function test_a_dry_run_reports_without_removing_anything(): void
    {
        $old = $this->egressEvent('old.test', 400);

        $this->artisan('able:prune-telemetry --days=365 --dry-run')->assertSuccessful();

        $this->assertNotNull(EgressEvent::find($old->id));
    }

    public function test_it_prunes_the_other_telemetry_tables(): void
    {
        $policy = DomainPolicy::create([
            'domain' => 'old.test',
            'domain_status' => 'unlisted',
            'policy' => 'under_review',
            'risk_score' => 70,
        ]);

        $oldVisit = DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'domain' => 'old.test',
            'status' => 'unlisted',
            'visited_at' => now()->subDays(400),
        ]);

        $oldNotification = Notification::create([
            'source' => 'egress',
            'type' => 'Egress Event Detected',
            'description' => 'old',
            'message' => 'egress-event-1',
            'occurred_at' => now()->subDays(400),
        ]);

        $this->artisan('able:prune-telemetry --days=365')->assertSuccessful();

        $this->assertNull(DomainVisit::find($oldVisit->id));
        $this->assertNull(Notification::withTrashed()->find($oldNotification->id));
    }

    public function test_it_leaves_configuration_alone(): void
    {
        $policy = DomainPolicy::create([
            'domain' => 'kept.test',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'risk_score' => 70,
        ]);

        $this->artisan('able:prune-telemetry --days=1')->assertSuccessful();

        $this->assertNotNull(DomainPolicy::find($policy->id));
    }

    public function test_it_rejects_a_retention_window_below_one_day(): void
    {
        $this->artisan('able:prune-telemetry --days=0')->assertFailed();
    }
}
