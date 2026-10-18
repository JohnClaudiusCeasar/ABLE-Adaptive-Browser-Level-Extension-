<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $indexes = [
            'login_activities' => [
                'login_activities_created_at_idx' => 'created_at',
                'login_activities_type_idx' => 'type',
                'login_activities_email_idx' => 'email',
            ],
            'domain_policies' => [
                'domain_policies_policy_idx' => 'policy',
                'domain_policies_category_idx' => 'category',
                'domain_policies_risk_score_idx' => 'risk_score',
            ],
            'egress_events' => [
                'egress_events_risk_score_idx' => 'risk_score',
                'egress_events_user_id_idx' => 'user_id',
            ],
            'domain_visits' => [
                'domain_visits_user_id_idx' => 'user_id',
            ],
        ];

        $driver = DB::getDriverName();

        foreach ($indexes as $table => $tableIndexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($tableIndexes as $indexName => $column) {
                try {
                    if ($driver === 'pgsql' || $driver === 'sqlite') {
                        DB::statement("CREATE INDEX IF NOT EXISTS {$indexName} ON {$table} ({$column})");
                    } else {
                        Schema::table($table, function (Blueprint $blueprint) use ($table, $indexName, $column) {
                            if (! Schema::hasIndex($table, $indexName)) {
                                $blueprint->index($column, $indexName);
                            }
                        });
                    }
                } catch (Throwable $e) {
                    // Index already exists or cannot be created, ignore safely
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $indexes = [
            'login_activities' => ['login_activities_created_at_idx', 'login_activities_type_idx', 'login_activities_email_idx'],
            'domain_policies' => ['domain_policies_policy_idx', 'domain_policies_category_idx', 'domain_policies_risk_score_idx'],
            'egress_events' => ['egress_events_risk_score_idx', 'egress_events_user_id_idx'],
            'domain_visits' => ['domain_visits_user_id_idx'],
        ];

        foreach ($indexes as $table => $tableIndexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($tableIndexes as $indexName) {
                try {
                    DB::statement("DROP INDEX IF EXISTS {$indexName}");
                } catch (Throwable $e) {
                    // Ignore safely
                }
            }
        }
    }
};
