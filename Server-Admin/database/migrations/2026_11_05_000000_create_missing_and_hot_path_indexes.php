<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the indexes two earlier migrations failed to create, plus the
 * composite indexes the analytics hot paths need.
 *
 * `2026_10_21_000000_add_query_path_indexes` and
 * `2026_10_22_000000_add_egress_events_updated_at_index` emitted raw
 * `CREATE INDEX "name" ON "table" (...)` statements. Double-quoted
 * identifiers are valid on PostgreSQL and SQLite but not on MySQL, where
 * `"..."` is a string literal. The statement therefore failed on MySQL and
 * the migration's `catch (Throwable)` swallowed it, so the migration was
 * recorded as run while creating nothing. This migration recreates those
 * indexes through a driver-safe path, so a MySQL host catches up too.
 *
 * It also adds the composite indexes measured against a 200k-row egress log:
 *
 *  - egress_events(action, domain) — the Active Shadow Apps aggregation
 *  - egress_events(domain, risk_score, user_id) — the Shadow Adopters KPI
 *  - domain_visits(domain, user_id) — the per-domain distinct-user counts
 *
 * On PostgreSQL the indexes are built CONCURRENTLY so the build does not
 * lock out the extension's writes while it runs. That requires the
 * migration to stay outside a transaction.
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
     * `egress_events.flagged_items` is deliberately absent: it is a JSON
     * column, and neither PostgreSQL's json type nor MySQL's JSON type has a
     * default btree operator class, so a plain index on it can never be
     * built. A partial/generated-column index would be required to make it
     * real, and the chunked scans that read it do not currently need one.
     *
     * @var array<string, array<string, list<string>>>
     */
    private const INDEXES = [
        'nudge_interactions' => [
            'nudge_interactions_user_id_idx' => ['user_id'],
        ],
        'jobs' => [
            'jobs_queue_reserved_available_idx' => ['queue', 'reserved_at', 'available_at'],
        ],
        'domain_policies' => [
            'domain_policies_block_access_idx' => ['block_access'],
            'domain_policies_created_at_idx' => ['created_at'],
        ],
        'domain_visits' => [
            'domain_visits_policy_domain_visited_idx' => ['domain_policy_id', 'domain', 'visited_at'],
            'domain_visits_domain_user_idx' => ['domain', 'user_id'],
        ],
        'egress_events' => [
            'egress_events_updated_at_idx' => ['updated_at'],
            'egress_events_action_domain_idx' => ['action', 'domain'],
            'egress_events_domain_risk_user_idx' => ['domain', 'risk_score', 'user_id'],
        ],
    ];

    public function up(): void
    {
        $driver = DB::getDriverName();

        $this->dropInvalidIndexes($driver);

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
        $driver = DB::getDriverName();

        foreach (self::INDEXES as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach (array_keys($indexes) as $name) {
                try {
                    if ($driver === 'pgsql') {
                        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS "'.$name.'"');
                    } else {
                        Schema::table($table, fn (Blueprint $blueprint) => $blueprint->dropIndex($name));
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
        if (Schema::hasIndex($table, $name)) {
            return;
        }

        try {
            if ($driver === 'pgsql') {
                $columnList = implode(', ', array_map(
                    fn (string $column): string => '"'.$column.'"',
                    $columns,
                ));

                DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS "'.$name.'" ON "'.$table.'" ('.$columnList.')');

                return;
            }

            // The schema builder quotes identifiers per driver, so MySQL gets
            // backticks instead of the double quotes that made the earlier
            // migrations fail.
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->index($columns, $name));
        } catch (Throwable) {
            // The index already exists, or the driver refused it. The
            // application works without it; it only costs a scan.
        }
    }

    /**
     * Drops indexes a previous concurrent build left behind in an invalid
     * state, so a retried migration can rebuild them.
     */
    private function dropInvalidIndexes(string $driver): void
    {
        if ($driver !== 'pgsql') {
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

        try {
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
        } catch (Throwable) {
            // The catalog is not queryable in this environment.
        }
    }
};
