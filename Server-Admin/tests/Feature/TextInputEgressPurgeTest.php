<?php

namespace Tests\Feature;

use App\Models\EgressEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * "[text-input]" is a placeholder file name the extension passes to
 * /api/score-content because the endpoint requires one — typed text is not a
 * file, so those rows are not egress incidents and must not reach the audit.
 */
class TextInputEgressPurgeTest extends TestCase
{
    use RefreshDatabase;

    private function runPurgeMigration(): void
    {
        $migration = include database_path('migrations/2026_10_18_000001_remove_text_input_egress_events.php');

        $migration->up();
    }

    public function test_purge_removes_text_input_events_but_keeps_real_files(): void
    {
        $textEvent = EgressEvent::create([
            'domain' => 'mail.example.com',
            'user_id' => 'ABLE-12345678',
            'file_name' => '[text-input]',
            'file_size' => 420,
            'action' => 'proceeded',
            'risk_score' => 12,
            'occurred_at' => now(),
        ]);

        $fileEvent = EgressEvent::create([
            'domain' => 'files.example.com',
            'user_id' => 'ABLE-12345678',
            'file_name' => 'quarterly-report.pdf',
            'file_size' => 2048,
            'action' => 'denied',
            'risk_score' => 92,
            'occurred_at' => now(),
        ]);

        $this->runPurgeMigration();

        $this->assertDatabaseMissing('egress_events', ['id' => $textEvent->getKey()]);
        $this->assertDatabaseHas('egress_events', ['id' => $fileEvent->getKey()]);
    }

    public function test_purge_cascades_nudge_rows_and_removes_only_matching_notifications(): void
    {
        $textEvent = EgressEvent::create([
            'domain' => 'mail.example.com',
            'user_id' => 'ABLE-12345678',
            'file_name' => '[text-input]',
            'file_size' => 64,
            'action' => 'blocked',
            'risk_score' => 95,
            'occurred_at' => now(),
        ]);

        $fileEvent = EgressEvent::create([
            'domain' => 'files.example.com',
            'user_id' => 'ABLE-12345678',
            'file_name' => 'salaries.xlsx',
            'file_size' => 4096,
            'action' => 'proceeded',
            'risk_score' => 70,
            'occurred_at' => now(),
        ]);

        DB::table('nudge_interactions')->insert([
            'egress_event_id' => $textEvent->getKey(),
            'domain' => 'mail.example.com',
            'user_id' => 'ABLE-12345678',
            'user_action' => 'typing',
            'interacted_at' => now(),
        ]);

        foreach ([$textEvent, $fileEvent] as $event) {
            DB::table('notifications')->insert([
                'source' => 'egress',
                'type' => 'Egress Event Detected',
                'description' => $event->file_name,
                'domain' => $event->domain,
                'user_id' => $event->user_id,
                'status' => 'glass-unlisted',
                'message' => 'egress-event-'.$event->getKey(),
                'occurred_at' => $event->occurred_at,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->runPurgeMigration();

        $this->assertDatabaseMissing('egress_events', ['id' => $textEvent->getKey()]);
        $this->assertDatabaseMissing('nudge_interactions', ['egress_event_id' => $textEvent->getKey()]);

        $this->assertDatabaseMissing('notifications', ['message' => 'egress-event-'.$textEvent->getKey()]);
        $this->assertDatabaseHas('notifications', ['message' => 'egress-event-'.$fileEvent->getKey()]);
    }

    public function test_purge_is_a_no_op_when_no_text_input_rows_exist(): void
    {
        $fileEvent = EgressEvent::create([
            'domain' => 'files.example.com',
            'user_id' => 'ABLE-12345678',
            'file_name' => 'notes.txt',
            'file_size' => 10,
            'action' => 'allowed',
            'risk_score' => 3,
            'occurred_at' => now(),
        ]);

        $this->runPurgeMigration();

        $this->assertDatabaseHas('egress_events', ['id' => $fileEvent->getKey()]);
    }
}
