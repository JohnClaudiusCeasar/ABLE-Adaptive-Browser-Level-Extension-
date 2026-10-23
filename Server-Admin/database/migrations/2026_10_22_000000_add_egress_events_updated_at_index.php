<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the index the live telemetry fingerprint reads.
 *
 * The panel polls a fingerprint of the telemetry tables so it only re-renders
 * a page when something actually arrived. The egress fingerprint includes the
 * newest update time, because an egress event can be completed in place when
 * the same upload is reported again with a scan verdict. Without an index on
 * that column, reading it is a full scan of the egress log on every poll.
 *
 * On PostgreSQL the indexes are built with CREATE INDEX CONCURRENTLY so the
 * build does not lock out the extension's writes while it runs. That requires
 * the migration to stay outside a transaction.
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
        'egress_events' => [
            'egress_events_updated_at_idx' => ['updated_at'],
        ],
    ];

    public function up(): void
    {
        $driver = DB::getDriverName();

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
            foreach (array_keys($indexes) as $name) {
                try {
                    if ($driver === 'pgsql') {
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
};
