<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Removes research telemetry older than the retention window.
 *
 * The telemetry tables grow for as long as the deployment is up: one row per
 * visit, per egress event, per notification and per nudge. Every admin page
 * that reads them reads the whole table, so an unbounded table eventually
 * costs more memory than the server has.
 *
 * The window is the retention period published in PRIVACY.md. Nothing that
 * is configuration or user-authored content is touched: the risk patterns,
 * the domain policies, the community messages and the chat are not research
 * telemetry and are not pruned.
 */
class PruneTelemetryCommand extends Command
{
    /**
     * The tables to prune, with the column that carries the row's timestamp.
     *
     * @var array<string, string>
     */
    private const TABLES = [
        'egress_events' => 'occurred_at',
        'domain_visits' => 'visited_at',
        'notifications' => 'occurred_at',
        'nudge_interactions' => 'interacted_at',
        'audit_logs' => 'occurred_at',
        'login_activities' => 'created_at',
        'extension_lifecycles' => 'occurred_at',
    ];

    /**
     * How many rows are removed per statement, so a large backlog never turns
     * into one long lock.
     */
    private const CHUNK = 500;

    /**
     * Usage:
     *   php artisan able:prune-telemetry [--days=365] [--dry-run]
     */
    protected $signature = 'able:prune-telemetry
                            {--days= : The retention window in days, overriding the configured one}
                            {--dry-run : Report what would be removed without removing it}';

    protected $description = 'Remove research telemetry older than the retention window';

    public function handle(): int
    {
        $days = $this->option('days');
        $days = $days === null
            ? (int) config('able.retention_days', 365)
            : (int) $days;

        if ($days < 1) {
            $this->error('The retention window must be at least one day.');

            return self::FAILURE;
        }

        $cutoff = Carbon::now()->subDays($days);
        $dryRun = (bool) $this->option('dry-run');

        $this->info($dryRun
            ? "Would prune telemetry older than {$cutoff->toDateTimeString()}."
            : "Pruning telemetry older than {$cutoff->toDateTimeString()}.");

        $total = 0;

        foreach (self::TABLES as $table => $column) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $removed = $dryRun
                ? DB::table($table)->where($column, '<', $cutoff)->count()
                : $this->deleteInChunks($table, $column, $cutoff);

            $total += $removed;

            if ($removed > 0) {
                $this->line(sprintf('  %-22s %d row(s)', $table, $removed));
            }
        }

        $this->info($dryRun
            ? "{$total} row(s) would be removed."
            : "Removed {$total} row(s).");

        return self::SUCCESS;
    }

    /**
     * Delete the matching rows in batches.
     */
    private function deleteInChunks(string $table, string $column, Carbon $cutoff): int
    {
        $deleted = 0;

        while (true) {
            $ids = DB::table($table)
                ->where($column, '<', $cutoff)
                ->orderBy('id')
                ->limit(self::CHUNK)
                ->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $deleted += DB::table($table)->whereIn('id', $ids)->delete();
        }

        return $deleted;
    }
}
