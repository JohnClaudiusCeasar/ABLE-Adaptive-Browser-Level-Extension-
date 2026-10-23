<?php

namespace App\Services;

use App\Exceptions\RecordCountChangedException;
use Closure;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Permanently purges record tables while leaving identity and configuration
 * intact.
 *
 * The purge is deliberately expressed as bulk query deletes rather than
 * row-by-row model deletes: bulk deletes bypass Eloquent model events, so the
 * audit observer never fires and the purge does not leave a trail of deleted
 * rows behind.
 *
 * Every target is described by metadata — its table, the column that carries
 * the event time and the grouping the settings page shows — so the same
 * definition drives the counts, the impact preview and the deletion itself.
 */
class RecordPurgeService
{
    /**
     * The group shown in the scoped deletion panel.
     */
    public const GROUP_TELEMETRY = 'telemetry';

    /**
     * How many rows are removed per statement, so a large backlog never turns
     * into one long lock.
     */
    public const CHUNK = 500;

    /**
     * The cache key holding the timestamp of the last UT1 blacklist import.
     */
    private const UT1_CACHE_KEY = 'ut1.last_import';

    /**
     * The tables the purge can delete.
     *
     * The order matters: children are always removed before their parents so
     * no foreign key constraint is violated part way through the purge. Rows
     * are deleted explicitly rather than relying on database cascades so the
     * reported counts stay accurate.
     *
     * @return list<array{
     *     key: string,
     *     table: string,
     *     label: string,
     *     description: string,
     *     group: string,
     *     date_column: string|null,
     *     implied_by: list<string>,
     *     query: Closure(Carbon|null, Carbon|null, list<string>): Builder
     * }>
     */
    private static function targets(): array
    {
        return [
            [
                'key' => 'criteria_pattern_items',
                'table' => 'criteria_pattern_items',
                'label' => 'Criteria pattern items',
                'description' => 'The individual rules inside a risk criteria pattern.',
                'group' => 'policy',
                'date_column' => null,
                'implied_by' => [],
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => DB::table('criteria_pattern_items'),
            ],
            [
                'key' => 'risk_patterns',
                'table' => 'risk_patterns',
                'label' => 'Risk patterns',
                'description' => 'Saved criteria patterns used to score traffic.',
                'group' => 'policy',
                'date_column' => null,
                'implied_by' => [],
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => DB::table('risk_patterns'),
            ],
            [
                'key' => 'domain_visits',
                'table' => 'domain_visits',
                'label' => 'Domain visits',
                'description' => 'Every recorded page visit, with its verdict and risk score.',
                'group' => self::GROUP_TELEMETRY,
                'date_column' => 'visited_at',
                'implied_by' => [],
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => self::dated(DB::table('domain_visits'), 'visited_at', $from, $to),
            ],
            [
                'key' => 'domain_policies',
                'table' => 'domain_policies',
                'label' => 'Domain policies',
                'description' => 'The allow, block and review rules for known sites.',
                'group' => 'policy',
                'date_column' => null,
                'implied_by' => [],
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => DB::table('domain_policies'),
            ],
            [
                'key' => 'nudge_interactions',
                'table' => 'nudge_interactions',
                'label' => 'Nudge interactions',
                'description' => 'How users responded to upload nudges.',
                'group' => self::GROUP_TELEMETRY,
                'date_column' => 'interacted_at',
                // The foreign key cascades, so these rows disappear whenever
                // their egress event is deleted. They are selected explicitly
                // so the preview and the reported counts include them.
                'implied_by' => ['egress_events'],
                'query' => function (?Carbon $from, ?Carbon $to, array $selected): Builder {
                    $query = DB::table('nudge_interactions');

                    $egressSelected = in_array('egress_events', $selected, true);
                    $selfSelected = in_array('nudge_interactions', $selected, true);

                    if ($egressSelected) {
                        $events = self::dated(
                            DB::table('egress_events')->select('id'),
                            'occurred_at',
                            $from,
                            $to,
                        );

                        $query->whereIn('egress_event_id', $events);

                        if ($selfSelected && $from !== null && $to !== null) {
                            $query->orWhereBetween('interacted_at', [$from, $to]);
                        }

                        return $query;
                    }

                    return self::dated($query, 'interacted_at', $from, $to);
                },
            ],
            [
                'key' => 'egress_events',
                'table' => 'egress_events',
                'label' => 'Egress events',
                'description' => 'Every data-transfer attempt and its verdict.',
                'group' => self::GROUP_TELEMETRY,
                'date_column' => 'occurred_at',
                'implied_by' => [],
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => self::dated(DB::table('egress_events'), 'occurred_at', $from, $to),
            ],
            [
                'key' => 'chat_messages',
                'table' => 'chat_messages',
                'label' => 'Chat messages',
                'description' => 'Messages exchanged between administrators.',
                'group' => 'content',
                'date_column' => null,
                'implied_by' => [],
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => DB::table('chat_messages'),
            ],
            [
                'key' => 'chat_conversations',
                'table' => 'chat_conversations',
                'label' => 'Chat conversations',
                'description' => 'The conversation threads themselves.',
                'group' => 'content',
                'date_column' => null,
                'implied_by' => [],
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => DB::table('chat_conversations'),
            ],
            [
                'key' => 'notifications',
                'table' => 'notifications',
                'label' => 'Notifications',
                'description' => 'The notification feed, including already dismissed entries.',
                'group' => self::GROUP_TELEMETRY,
                'date_column' => 'occurred_at',
                'implied_by' => [],
                // DB::table() reads the table directly, so soft-deleted rows
                // are counted and removed along with the live ones.
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => self::dated(DB::table('notifications'), 'occurred_at', $from, $to),
            ],
            [
                'key' => 'community_messages',
                'table' => 'community_messages',
                'label' => 'Community messages',
                'description' => 'Feedback and access requests submitted by users.',
                'group' => 'content',
                'date_column' => null,
                'implied_by' => [],
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => DB::table('community_messages'),
            ],
            [
                'key' => 'extension_lifecycles',
                'table' => 'extension_lifecycles',
                'label' => 'Extension lifecycles',
                'description' => 'Install, update and uninstall events.',
                'group' => self::GROUP_TELEMETRY,
                'date_column' => 'occurred_at',
                'implied_by' => [],
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => self::dated(DB::table('extension_lifecycles'), 'occurred_at', $from, $to),
            ],
            [
                'key' => 'login_activities',
                'table' => 'login_activities',
                'label' => 'Login activities',
                'description' => 'Sign-in, sign-out and failed-attempt history.',
                'group' => self::GROUP_TELEMETRY,
                'date_column' => 'created_at',
                'implied_by' => [],
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => self::dated(DB::table('login_activities'), 'created_at', $from, $to),
            ],
            [
                'key' => 'audit_logs',
                'table' => 'audit_logs',
                'label' => 'Audit logs',
                'description' => 'Who changed protected settings and policies.',
                'group' => self::GROUP_TELEMETRY,
                'date_column' => 'occurred_at',
                'implied_by' => [],
                'query' => fn (?Carbon $from, ?Carbon $to, array $selected): Builder => self::dated(DB::table('audit_logs'), 'occurred_at', $from, $to),
            ],
        ];
    }

    /**
     * The keys shown in the scoped telemetry deletion panel.
     *
     * @return list<string>
     */
    public static function telemetryKeys(): array
    {
        $keys = [];

        foreach (self::targets() as $target) {
            if ($target['group'] === self::GROUP_TELEMETRY) {
                $keys[] = $target['key'];
            }
        }

        return $keys;
    }

    /**
     * Count every record table, for the legacy "clear all records" summary.
     *
     * @return list<array{
     *     key: string,
     *     label: string,
     *     count: int,
     *     description: string,
     *     group: string,
     *     date_column: string|null,
     *     implied_by: list<string>
     * }>
     */
    public function counts(): array
    {
        return $this->preview(self::allKeys());
    }

    /**
     * Count the records a scoped purge would remove.
     *
     * @param  list<string>  $keys
     * @return list<array{
     *     key: string,
     *     label: string,
     *     count: int,
     *     description: string,
     *     group: string,
     *     date_column: string|null,
     *     implied_by: list<string>
     * }>
     */
    public function preview(array $keys, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $selected = $this->normalize($keys);
        $counts = [];

        foreach (self::targets() as $target) {
            if (! in_array($target['key'], $selected, true)) {
                continue;
            }

            $counts[] = [
                'key' => $target['key'],
                'label' => $target['label'],
                'count' => $this->safeCount(
                    fn (): int => ($target['query'])($from, $to, $selected)->count(),
                ),
                'description' => $target['description'],
                'group' => $target['group'],
                'date_column' => $target['date_column'],
                'implied_by' => $target['implied_by'],
            ];
        }

        return $counts;
    }

    /**
     * Permanently delete the selected records.
     *
     * The whole purge runs in one transaction, so a failure part way through
     * leaves the database exactly as it was instead of half purged. When an
     * expected total is supplied, the transaction aborts unless the current
     * count still matches it: the operator confirmed a specific number of
     * records, not whatever happened to match a moment later.
     *
     * @param  list<string>  $keys
     * @return array<string, int> table key => rows deleted
     *
     * @throws RecordCountChangedException
     */
    public function purgeSelection(array $keys, ?Carbon $from = null, ?Carbon $to = null, ?int $expectedTotal = null): array
    {
        $selected = $this->normalize($keys);

        $deleted = DB::transaction(function () use ($selected, $from, $to, $expectedTotal): array {
            if ($expectedTotal !== null) {
                $actual = 0;

                foreach (self::targets() as $target) {
                    if (in_array($target['key'], $selected, true)) {
                        $actual += ($target['query'])($from, $to, $selected)->count();
                    }
                }

                if ($actual !== $expectedTotal) {
                    throw new RecordCountChangedException($expectedTotal, $actual);
                }
            }

            $deleted = [];

            foreach (self::targets() as $target) {
                if (! in_array($target['key'], $selected, true)) {
                    continue;
                }

                $deleted[$target['key']] = $this->deleteInChunks(
                    $target['table'],
                    ($target['query'])($from, $to, $selected),
                );
            }

            return $deleted;
        });

        $this->forgetCaches($selected);

        return $deleted;
    }

    /**
     * Permanently delete every record.
     *
     * @return array<string, int> table key => rows deleted
     */
    public function purge(): array
    {
        return $this->purgeSelection(self::allKeys());
    }

    /**
     * Delete the matching rows in id batches.
     */
    private function deleteInChunks(string $table, Builder $query): int
    {
        $deleted = 0;

        while (true) {
            $ids = (clone $query)
                ->orderBy('id')
                ->limit(self::CHUNK)
                ->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $deleted += DB::table($table)->whereIn('id', $ids)->delete();

            if ($ids->count() < self::CHUNK) {
                break;
            }
        }

        return $deleted;
    }

    /**
     * Drop the caches a purge can make stale.
     *
     * A telemetry-only purge changes none of the cached policy or pattern
     * data, so it deliberately avoids rebuilding the (large) policy feed.
     *
     * @param  list<string>  $selected
     */
    private function forgetCaches(array $selected): void
    {
        if (in_array('domain_policies', $selected, true)) {
            // The imported blocklist rows are gone, so the cached timestamp
            // of the last successful import is no longer true.
            Cache::forget(self::UT1_CACHE_KEY);

            // Bulk deletes bypass model events, so the cached feed has to be
            // dropped explicitly.
            app(DomainPolicyFeed::class)->forget();
        }

        if (in_array('risk_patterns', $selected, true)
            || in_array('criteria_pattern_items', $selected, true)
        ) {
            app(RiskPatternRepository::class)->forget();
        }
    }

    /**
     * Validate the requested keys and add the rows implied by their parents.
     *
     * @param  list<string>  $keys
     * @return list<string>
     */
    private function normalize(array $keys): array
    {
        if ($keys === []) {
            throw new InvalidArgumentException('At least one purge target is required.');
        }

        $known = self::allKeys();

        foreach ($keys as $key) {
            if (! in_array($key, $known, true)) {
                throw new InvalidArgumentException("Unknown purge target [{$key}].");
            }
        }

        $selected = array_values(array_unique($keys));

        foreach (self::targets() as $target) {
            foreach ($target['implied_by'] as $parent) {
                if (in_array($parent, $selected, true) && ! in_array($target['key'], $selected, true)) {
                    $selected[] = $target['key'];
                }
            }
        }

        return array_values(array_filter(
            $known,
            fn (string $key): bool => in_array($key, $selected, true),
        ));
    }

    /**
     * Restrict a query to a date range when one was supplied.
     */
    private static function dated(Builder $query, string $column, ?Carbon $from, ?Carbon $to): Builder
    {
        if ($from !== null && $to !== null) {
            $query->whereBetween($column, [$from, $to]);
        }

        return $query;
    }

    /**
     * Every target key, in deletion order.
     *
     * @return list<string>
     */
    private static function allKeys(): array
    {
        return array_map(
            fn (array $target): string => $target['key'],
            self::targets(),
        );
    }

    /**
     * Count rows without letting a missing table break the settings page.
     */
    private function safeCount(Closure $callback): int
    {
        try {
            return (int) $callback();
        } catch (\Throwable) {
            return 0;
        }
    }
}
