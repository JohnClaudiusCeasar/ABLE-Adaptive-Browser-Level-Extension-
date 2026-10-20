<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\CommunityMessage;
use App\Models\CriteriaPatternItem;
use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\LoginActivity;
use App\Models\Notification;
use App\Models\NudgeInteraction;
use App\Models\RiskPattern;
use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Permanently purges every record table in the app while leaving identity and
 * configuration intact.
 *
 * The purge is deliberately expressed as bulk query deletes rather than
 * row-by-row model deletes: bulk deletes bypass Eloquent model events, so the
 * audit observer never fires and the purge does not leave a trail of deleted
 * rows behind.
 */
class RecordPurgeService
{
    /**
     * The cache key holding the timestamp of the last UT1 blacklist import.
     */
    private const UT1_CACHE_KEY = 'ut1.last_import';

    /**
     * The record tables to purge.
     *
     * The order matters: children are always removed before their parents so
     * no foreign key constraint is violated part way through the purge. Rows
     * are deleted explicitly rather than relying on database cascades so the
     * reported counts stay accurate.
     *
     * @return list<array{key: string, label: string, count: Closure(): int, purge: Closure(): int}>
     */
    private static function targets(): array
    {
        return [
            [
                'key' => 'criteria_pattern_items',
                'label' => 'Criteria pattern items',
                'count' => fn (): int => CriteriaPatternItem::query()->count(),
                'purge' => fn (): int => CriteriaPatternItem::query()->delete(),
            ],
            [
                'key' => 'risk_patterns',
                'label' => 'Risk patterns',
                'count' => fn (): int => RiskPattern::query()->count(),
                'purge' => fn (): int => RiskPattern::query()->delete(),
            ],
            [
                'key' => 'domain_visits',
                'label' => 'Domain visits',
                'count' => fn (): int => DomainVisit::query()->count(),
                'purge' => fn (): int => DomainVisit::query()->delete(),
            ],
            [
                'key' => 'domain_policies',
                'label' => 'Domain policies',
                'count' => fn (): int => DomainPolicy::query()->count(),
                'purge' => fn (): int => DomainPolicy::query()->delete(),
            ],
            [
                'key' => 'nudge_interactions',
                'label' => 'Nudge interactions',
                'count' => fn (): int => NudgeInteraction::query()->count(),
                'purge' => fn (): int => NudgeInteraction::query()->delete(),
            ],
            [
                'key' => 'egress_events',
                'label' => 'Egress events',
                'count' => fn (): int => EgressEvent::query()->count(),
                'purge' => fn (): int => EgressEvent::query()->delete(),
            ],
            [
                'key' => 'chat_messages',
                'label' => 'Chat messages',
                'count' => fn (): int => ChatMessage::query()->count(),
                'purge' => fn (): int => ChatMessage::query()->delete(),
            ],
            [
                'key' => 'chat_conversations',
                'label' => 'Chat conversations',
                'count' => fn (): int => ChatConversation::query()->count(),
                'purge' => fn (): int => ChatConversation::query()->delete(),
            ],
            [
                'key' => 'notifications',
                'label' => 'Notifications',
                // Notifications are soft-deleted, so a plain delete would only
                // flag the rows. Count and purge them including trashed ones.
                'count' => fn (): int => Notification::withTrashed()->count(),
                'purge' => fn (): int => Notification::withTrashed()->forceDelete(),
            ],
            [
                'key' => 'community_messages',
                'label' => 'Community messages',
                'count' => fn (): int => CommunityMessage::query()->count(),
                'purge' => fn (): int => CommunityMessage::query()->delete(),
            ],
            [
                'key' => 'extension_lifecycles',
                'label' => 'Extension lifecycles',
                'count' => fn (): int => ExtensionLifecycle::query()->count(),
                'purge' => fn (): int => ExtensionLifecycle::query()->delete(),
            ],
            [
                'key' => 'login_activities',
                'label' => 'Login activities',
                'count' => fn (): int => LoginActivity::query()->count(),
                'purge' => fn (): int => LoginActivity::query()->delete(),
            ],
            [
                'key' => 'audit_logs',
                'label' => 'Audit logs',
                'count' => fn (): int => AuditLog::query()->count(),
                'purge' => fn (): int => AuditLog::query()->delete(),
            ],
        ];
    }

    /**
     * Count the records that a purge would remove.
     *
     * @return list<array{key: string, label: string, count: int}>
     */
    public function counts(): array
    {
        $counts = [];

        foreach (self::targets() as $target) {
            $counts[] = [
                'key' => $target['key'],
                'label' => $target['label'],
                'count' => $this->safeCount($target['count']),
            ];
        }

        return $counts;
    }

    /**
     * Permanently delete every record.
     *
     * The whole purge runs in one transaction, so a failure part way through
     * leaves the database exactly as it was instead of half purged.
     *
     * @return array<string, int> table key => rows deleted
     */
    public function purge(): array
    {
        $deleted = DB::transaction(function (): array {
            $deleted = [];

            foreach (self::targets() as $target) {
                $deleted[$target['key']] = ($target['purge'])();
            }

            return $deleted;
        });

        // The imported blocklist rows are gone, so the cached timestamp of the
        // last successful import is no longer true.
        Cache::forget(self::UT1_CACHE_KEY);

        return $deleted;
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
