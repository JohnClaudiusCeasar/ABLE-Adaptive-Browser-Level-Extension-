<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the indexes the hot paths actually need.
 *
 * Every column listed here is used by a WHERE, ORDER BY or JOIN in the
 * request path, and was previously scanned without an index:
 *
 *  - nudge_interactions.user_id — the per-client telemetry page
 *  - chat_conversations.user_two_id, last_message_at — the conversation list
 *  - chat_messages.read_at — the unread message counts
 *  - criteria_pattern_items.criteria_pattern_id, parent_id — the pattern corpus
 *  - risk_patterns.parent_criteria_id — the auto-created single patterns
 *  - domain_policies.block_access, created_at — the policy listing and status
 *  - egress_events.flagged_items — the per-pattern flag counts
 *  - notifications.deleted_at — the soft-delete filter on every read
 *  - domain_visits (domain_policy_id, domain, visited_at) — the visit debounce
 *  - jobs (queue, reserved_at, available_at) — the database queue's pop query
 *
 * On PostgreSQL the indexes are built with CREATE INDEX CONCURRENTLY so the
 * build does not lock out the extension's writes while it runs. That
 * requires the migration to stay outside a transaction.
 */
return new class extends Migration
{
    /**
     * CREATE INDEX CONCURRENTLY cannot run inside a transaction.
     *
     * @var bool
     */
    public $withinTransaction = false;

    /**
     * The indexes to create, as table => [index name => columns].
     *
     * @var array<string, array<string, list<string>>>
     */
    private const INDEXES = [
        'nudge_interactions' => [
            'nudge_interactions_user_id_idx' => ['user_id'],
        ],
        'chat_conversations' => [
            'chat_conversations_user_two_id_idx' => ['user_two_id'],
            'chat_conversations_last_message_at_idx' => ['last_message_at'],
        ],
        'chat_messages' => [
            'chat_messages_read_at_idx' => ['read_at'],
            'chat_messages_sender_id_idx' => ['sender_id'],
        ],
        'criteria_pattern_items' => [
            'criteria_pattern_items_criteria_pattern_id_idx' => ['criteria_pattern_id'],
            'criteria_pattern_items_parent_id_idx' => ['parent_id'],
        ],
        'risk_patterns' => [
            'risk_patterns_parent_criteria_id_idx' => ['parent_criteria_id'],
        ],
        'domain_policies' => [
            'domain_policies_block_access_idx' => ['block_access'],
            'domain_policies_created_at_idx' => ['created_at'],
        ],
        'egress_events' => [
            'egress_events_flagged_items_idx' => ['flagged_items'],
        ],
        'notifications' => [
            'notifications_deleted_at_idx' => ['deleted_at'],
        ],
        'domain_visits' => [
            'domain_visits_policy_domain_visited_idx' => ['domain_policy_id', 'domain', 'visited_at'],
        ],
        'jobs' => [
            'jobs_queue_reserved_available_idx' => ['queue', 'reserved_at', 'available_at'],
        ],
    ];

    public function up(): void
    {
        $driver = DB::getDriverName();

        $this->dropInvalidIndexes();

        foreach (self::INDEXES as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($indexes as $name => $columns) {
                $this->createIndex($driver, $table, $name, $columns);
            }
        }
    }

    public function down(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach (array_keys($indexes) as $name) {
                try {
                    if (DB::getDriverName() === 'pgsql') {
                        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS "'.$name.'"');
                    } else {
                        DB::statement('DROP INDEX IF EXISTS "'.$name.'"');
                    }
                } catch (Throwable) {
                    // The index is already gone.
                }
            }
        }
    }

    /**
     * @param  list<string>  $columns
     */
    private function createIndex(string $driver, string $table, string $name, array $columns): void
    {
        $columnList = implode(', ', array_map(
            fn (string $column): string => '"'.$column.'"',
            $columns,
        ));

        try {
            if ($driver === 'pgsql') {
                DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS "'.$name.'" ON "'.$table.'" ('.$columnList.')');
            } elseif ($driver === 'sqlite') {
                DB::statement('CREATE INDEX IF NOT EXISTS "'.$name.'" ON "'.$table.'" ('.$columnList.')');
            } elseif (! Schema::hasIndex($table, $name)) {
                DB::statement('CREATE INDEX "'.$name.'" ON "'.$table.'" ('.$columnList.')');
            }
        } catch (Throwable) {
            // The index already exists, or the driver refused it. The
            // application works without it; it only costs a scan.
        }
    }

    /**
     * Drops indexes a previous concurrent build left behind in an invalid
     * state.
     *
     * A concurrent build that is interrupted leaves the index in place but
     * marked invalid, and CREATE INDEX IF NOT EXISTS would then skip it. An
     * invalid index is ignored by the database, so the application still
     * works — it just does not get the index. Dropping it here means a
     * retried migration can rebuild it; if the build was interrupted after
     * this migration was recorded, drop the invalid index by name and the
     * next deploy will rebuild it.
     */
    private function dropInvalidIndexes(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $names = [];

        foreach (self::INDEXES as $indexes) {
            foreach (array_keys($indexes) as $name) {
                $names[] = $name;
            }
        }

        $quoted = implode(', ', array_map(
            fn (string $name): string => "'".$name."'",
            $names,
        ));

        $invalid = DB::select(
            'SELECT c.relname AS name
               FROM pg_class c
               JOIN pg_index i ON i.indexrelid = c.oid
              WHERE NOT i.indisvalid
                AND c.relname IN ('.$quoted.')'
        );

        foreach ($invalid as $index) {
            DB::statement('DROP INDEX CONCURRENTLY IF EXISTS "'.$index->name.'"');
        }
    }
};
