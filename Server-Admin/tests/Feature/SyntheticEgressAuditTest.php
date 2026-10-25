<?php

namespace Tests\Feature;

use App\Models\EgressEvent;
use App\Support\SyntheticFileName;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * A placeholder file name ("upload.csv", "blob.pdf", ...) is fabricated from
 * the MIME type when the extension cannot recover the user's real file name.
 * Nothing was uploaded behind it, so it must never reach egress_events — the
 * audit would report a file that does not exist.
 */
class SyntheticEgressAuditTest extends TestCase
{
    use RefreshDatabase;

    private function postEgress(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/log-egress', array_merge([
            'domain' => 'synthetic-check.test',
            'user_id' => 'ABLE-12345678',
            'file_name' => 'upload.csv',
            'file_size' => 512,
            'risk_score' => 70,
            'action' => 'proceeded',
            'user_action' => 'proceeded',
        ], $overrides));
    }

    public function test_placeholder_names_are_not_persisted(): void
    {
        $names = [
            'upload.csv',
            'upload.pdf',
            'upload.',
            'blob.csv',
            'blob.xlsx',
            'BLOB.PDF',
            'binary-upload.bin',
            'websocket-upload.dat',
            'stream-upload.png',
            'form-upload.csv',
            'unknown',
        ];

        foreach ($names as $name) {
            $this->postEgress(['file_name' => $name])->assertOk();
        }

        $this->assertSame(0, EgressEvent::count());
    }

    public function test_a_client_that_marks_a_name_synthetic_is_never_persisted(): void
    {
        // The marker wins over the name: the extension knows the name is
        // fabricated even when it does not look like a placeholder.
        $this->postEgress([
            'file_name' => 'report.csv',
            'name_source' => 'synthetic',
        ])->assertOk();

        $this->assertSame(0, EgressEvent::count());
    }

    public function test_a_token_backed_user_file_named_like_a_placeholder_is_still_audited(): void
    {
        // "user" provenance is only trusted when the scan token carries it. A
        // name recovered from the user's own selection is a real egress even
        // when it looks like a placeholder.
        $score = $this->postJson('/api/score-content', [
            'domain' => 'synthetic-check.test',
            'text' => 'name,salary',
            'file_name' => 'upload.csv',
            'file_size' => 512,
            'name_source' => 'user',
        ])->json();

        $this->postEgress([
            'file_name' => 'upload.csv',
            'name_source' => 'user',
            'scan_token' => $score['scan_token'],
        ])->assertOk();

        $this->assertDatabaseHas('egress_events', ['file_name' => 'upload.csv']);
    }

    public function test_tokenless_user_provenance_cannot_bypass_the_placeholder_gate(): void
    {
        // A client (or a page driving it) cannot simply assert "user" to smuggle
        // a synthetic row into the audit. Without a token the claim is
        // downgraded to a page name and the placeholder gate applies.
        $this->postEgress([
            'file_name' => 'upload.csv',
            'name_source' => 'user',
        ])->assertOk();

        $this->assertSame(0, EgressEvent::count());
    }

    public function test_real_file_names_are_audited(): void
    {
        $this->postEgress(['file_name' => 'salaries.xlsx'])->assertOk();
        $this->postEgress(['file_name' => 'upload-report.pdf'])->assertOk();
        $this->postEgress(['file_name' => 'myblob.csv'])->assertOk();
        $this->postEgress(['file_name' => 'quarterly report.csv'])->assertOk();

        $this->assertSame(4, EgressEvent::count());
    }

    public function test_purge_removes_placeholder_rows_but_keeps_real_files(): void
    {
        $placeholder = EgressEvent::create([
            'domain' => 'synthetic-check.test',
            'user_id' => 'ABLE-12345678',
            'file_name' => 'upload.csv',
            'file_size' => 512,
            'action' => 'proceeded',
            'risk_score' => 70,
            'occurred_at' => now(),
        ]);

        $real = EgressEvent::create([
            'domain' => 'synthetic-check.test',
            'user_id' => 'ABLE-12345678',
            'file_name' => 'salaries.xlsx',
            'file_size' => 4096,
            'action' => 'proceeded',
            'risk_score' => 70,
            'occurred_at' => now(),
        ]);

        $migration = include database_path('migrations/2026_10_20_000001_purge_synthetic_egress_events.php');
        $migration->up();

        $this->assertDatabaseMissing('egress_events', ['id' => $placeholder->getKey()]);
        $this->assertDatabaseHas('egress_events', ['id' => $real->getKey()]);
    }

    public function test_placeholder_list_matches_the_extension(): void
    {
        // The extension's core/synthetic-names.js is the source of truth; this
        // list must stay in sync with it.
        $expected = ['upload', 'blob', 'binary-upload', 'websocket-upload', 'stream-upload', 'form-upload', 'unknown'];

        $this->assertSame($expected, SyntheticFileName::PLACEHOLDER_BASES);
    }
}
