<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * One-off cleanup: remove the four demo community messages that
 * CommunityMessageSeeder used to push into production on every boot.
 *
 * Rows are matched on the exact (author, message) pairs from the seeder so
 * real visitor posts — including ones reusing a seeded author name — are
 * never touched. Production no longer runs any seeder, so these rows will
 * not come back. Irreversible: demo content is not worth restoring.
 */
return new class extends Migration
{
    public function up(): void
    {
        $seeded = [
            [
                'author' => 'SecurityResearch_01',
                'message' => 'Holding the request at the DOM event level completely prevents token exfiltration into AI chat contexts. Would love to see an automated preset for GCP service accounts.',
            ],
            [
                'author' => 'AuditAnalyst_PH',
                'message' => 'The pseudonymous device IDs (ABLE-XXXXXXXX) make this much easier to evaluate internally without worrying about employee tracking or surveillance friction.',
            ],
            [
                'author' => 'DevLead_K',
                'message' => 'A 40-character git commit hash triggered a high-entropy secret detection alert. Adding domain-level heuristic weights would prevent this edge case.',
            ],
            [
                'author' => 'EnterpriseAdmin',
                'message' => 'Would appreciate an instant one-click bypass for internal staging URLs without needing to configure the policy table on the research server.',
            ],
        ];

        foreach ($seeded as $row) {
            DB::table('community_messages')
                ->where('author', $row['author'])
                ->where('message', $row['message'])
                ->delete();
        }
    }

    public function down(): void
    {
        // Irreversible one-off cleanup of demo content.
    }
};
