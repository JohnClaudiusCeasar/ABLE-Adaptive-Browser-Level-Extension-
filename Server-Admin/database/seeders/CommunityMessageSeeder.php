<?php

namespace Database\Seeders;

use App\Models\CommunityMessage;
use Illuminate\Database\Seeder;

class CommunityMessageSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $initialMessages = [
            [
                'author' => 'SecurityResearch_01',
                'category' => 'suggestion',
                'domain' => 'chat.openai.com',
                'message' => 'Holding the request at the DOM event level completely prevents token exfiltration into AI chat contexts. Would love to see an automated preset for GCP service accounts.',
                'status' => 'approved',
                'created_at' => now()->subMinutes(15),
                'updated_at' => now()->subMinutes(15),
            ],
            [
                'author' => 'AuditAnalyst_PH',
                'category' => 'comment',
                'domain' => 'claude.ai',
                'message' => 'The pseudonymous device IDs (ABLE-XXXXXXXX) make this much easier to evaluate internally without worrying about employee tracking or surveillance friction.',
                'status' => 'approved',
                'created_at' => now()->subHours(1),
                'updated_at' => now()->subHours(1),
            ],
            [
                'author' => 'DevLead_K',
                'category' => 'false-positive',
                'domain' => 'github.com',
                'message' => 'A 40-character git commit hash triggered a high-entropy secret detection alert. Adding domain-level heuristic weights would prevent this edge case.',
                'status' => 'approved',
                'created_at' => now()->subHours(4),
                'updated_at' => now()->subHours(4),
            ],
            [
                'author' => 'EnterpriseAdmin',
                'category' => 'complaint',
                'domain' => 'internal.corp',
                'message' => 'Would appreciate an instant one-click bypass for internal staging URLs without needing to configure the policy table on the research server.',
                'status' => 'approved',
                'created_at' => now()->subDays(1),
                'updated_at' => now()->subDays(1),
            ],
        ];

        foreach ($initialMessages as $msg) {
            CommunityMessage::firstOrCreate(
                [
                    'author' => $msg['author'],
                    'message' => $msg['message'],
                ],
                $msg
            );
        }
    }
}
