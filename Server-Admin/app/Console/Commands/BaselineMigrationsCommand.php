<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BaselineMigrationsCommand extends Command
{
    protected $signature = 'app:baseline-migrations';

    protected $description = 'Baselines existing database tables into the migrations tracking table';

    public function handle(): int
    {
        if (! Schema::hasTable('migrations')) {
            $this->call('migrate:install');
        }

        $existing = DB::table('migrations')->pluck('migration')->all();

        $tableMigrationMap = [
            'users' => '0001_01_01_000000_create_users_table',
            'cache' => '0001_01_01_000001_create_cache_table',
            'jobs' => '0001_01_01_000002_create_jobs_table',
            'passkeys' => '2024_01_01_000000_create_passkeys_table',
            'domain_policies' => '2026_07_30_160000_create_domain_policies_table',
            'domain_visits' => '2026_07_31_000000_create_domain_visits_table',
            'risk_patterns' => '2026_07_31_120000_create_risk_patterns_table',
            'criteria_pattern_items' => '2026_07_31_120001_create_criteria_pattern_items_table',
            'egress_events' => '2026_08_02_000000_create_egress_events_table',
            'nudge_interactions' => '2026_08_02_000001_create_nudge_interactions_table',
            'login_activities' => '2026_08_06_000000_create_login_activities_table',
            'notifications' => '2026_08_10_000000_create_notifications_table',
            'chat_conversations' => '2026_08_10_000001_create_chat_conversations_table',
            'chat_messages' => '2026_08_10_000002_create_chat_messages_table',
            'audit_logs' => '2026_08_20_000000_create_audit_logs_table',
            'extension_lifecycles' => '2026_08_20_000001_create_extension_lifecycles_table',
            'able_settings' => '2026_09_05_000000_create_able_settings_table',
        ];

        $baselined = 0;
        foreach ($tableMigrationMap as $table => $migration) {
            if (Schema::hasTable($table) && ! in_array($migration, $existing, true)) {
                DB::table('migrations')->insert([
                    'migration' => $migration,
                    'batch' => 1,
                ]);
                $existing[] = $migration;
                $baselined++;
            }
        }

        // Check if event_id column already exists on domain_visits
        $eventIdMigration = '2026_09_30_000000_add_event_id_to_visit_and_egress_tables';
        if (Schema::hasTable('domain_visits') && Schema::hasColumn('domain_visits', 'event_id') && ! in_array($eventIdMigration, $existing, true)) {
            DB::table('migrations')->insert([
                'migration' => $eventIdMigration,
                'batch' => 1,
            ]);
            $baselined++;
        }

        $this->info("Baselined {$baselined} migration(s).");

        return 0;
    }
}
