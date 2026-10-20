<?php

namespace App\Services;

use App\Models\CommunityMessage;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\Notification;
use App\Models\NudgeInteraction;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors the research telemetry into the notifications table.
 *
 * Captured sources: egress events, domain visits, extension lifecycle,
 * community feedback. The mirror is idempotent: a notification is only
 * created once per source event.
 *
 * The telemetry tables grow for as long as the deployment is up, so the
 * mirror only looks at the rows it has not seen yet. Each source keeps a
 * high-water mark — the id of the last source row that was mirrored — and
 * the sync starts from there.
 *
 * The high-water mark lives in the cache. If it is lost, the sync falls back
 * to scanning every row, which is slower but produces the same result: the
 * per-chunk duplicate check keeps the mirror idempotent.
 */
class SyncNotifications
{
    /**
     * The cache key prefix holding the last mirrored source row id per source.
     */
    private const WATERMARK_PREFIX = 'able:notification-sync:';

    /**
     * How many source rows are processed per statement.
     */
    private const CHUNK = 250;

    public function sync(): void
    {
        if (! app(AbleSettingsService::class)->value('server', 'runtime.notification_sync_enabled', true)) {
            return;
        }

        $this->syncEgressEvents();
        $this->syncDomainVisits();
        $this->syncExtensionLifecycles();
        $this->syncCommunityMessages();
    }

    private function syncEgressEvents(): void
    {
        $now = now();

        EgressEvent::query()
            ->where('id', '>', $this->watermark('egress'))
            ->orderBy('id')
            ->chunkById(self::CHUNK, function ($events) use ($now) {
                $existing = $this->existingMessages('egress', $events
                    ->map(fn (EgressEvent $event): string => 'egress-event-'.$event->id)
                    ->all());

                $unprocessed = $events->reject(
                    fn (EgressEvent $event) => isset($existing['egress-event-'.$event->id])
                );

                if ($unprocessed->isEmpty()) {
                    $this->advanceWatermark('egress', $events->last()->id);

                    return;
                }

                $nudgeActions = NudgeInteraction::query()
                    ->whereIn('egress_event_id', $unprocessed->pluck('id'))
                    ->pluck('user_action', 'egress_event_id');

                $records = [];
                foreach ($unprocessed as $event) {
                    $messageKey = 'egress-event-'.$event->id;
                    $nudgeAction = $nudgeActions->get($event->id);
                    $status = $this->statusForRisk($event->risk_score);

                    $records[] = [
                        'source' => 'egress',
                        'type' => $this->typeForEgress($event, $nudgeAction),
                        'description' => $this->descriptionForEgress($event, $nudgeAction),
                        'domain' => $event->domain,
                        'user_id' => $event->user_id,
                        'email' => null,
                        'ip_address' => null,
                        'risk_score' => $event->risk_score,
                        'status' => $status,
                        'message' => $messageKey,
                        'occurred_at' => $event->occurred_at,
                        'read_at' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                if (! empty($records)) {
                    Notification::insert($records);
                }

                $this->advanceWatermark('egress', $events->last()->id);
            });
    }

    private function syncDomainVisits(): void
    {
        $now = now();

        DomainVisit::query()
            ->where('id', '>', $this->watermark('domain'))
            ->orderBy('id')
            ->with('domainPolicy')
            ->chunkById(self::CHUNK, function ($visits) use ($now) {
                $existing = $this->existingMessages('domain', $visits
                    ->map(fn (DomainVisit $visit): string => 'domain-visit-'.$visit->id)
                    ->all());

                $records = [];
                foreach ($visits as $visit) {
                    $messageKey = 'domain-visit-'.$visit->id;
                    if (isset($existing[$messageKey])) {
                        continue;
                    }

                    $isFirstVisit = $visit->domainPolicy !== null && $visit->domainPolicy->visit_count === 1;
                    $type = $isFirstVisit ? 'New Domain Detected' : 'New Domain Visit';
                    $status = $this->statusForDomainStatus($visit->resolvedStatus());
                    $riskScore = $visit->domainPolicy->risk_score ?? 0;

                    $records[] = [
                        'source' => 'domain',
                        'type' => $type,
                        'description' => $isFirstVisit
                            ? "First visit to {$visit->domain} by user {$visit->user_id}"
                            : "Visit to {$visit->domain} by user {$visit->user_id}",
                        'domain' => $visit->domain,
                        'user_id' => $visit->user_id,
                        'email' => null,
                        'ip_address' => null,
                        'risk_score' => $riskScore,
                        'status' => $status,
                        'message' => $messageKey,
                        'occurred_at' => $visit->visited_at,
                        'read_at' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                if (! empty($records)) {
                    Notification::insert($records);
                }

                $this->advanceWatermark('domain', $visits->last()->id);
            });
    }

    private function syncExtensionLifecycles(): void
    {
        $now = now();

        $typeMap = [
            'installed' => 'Extension Installed',
            'updated' => 'Extension Updated',
            'uninstalled' => 'Extension Uninstalled',
        ];

        $statusMap = [
            'installed' => 'glass-safe',
            'updated' => 'glass-unlisted',
            'uninstalled' => 'glass-unsafe',
        ];

        ExtensionLifecycle::query()
            ->where('id', '>', $this->watermark('extension'))
            ->orderBy('id')
            ->chunkById(self::CHUNK, function ($lifecycles) use ($now, $typeMap, $statusMap) {
                $existing = $this->existingMessages('extension', $lifecycles
                    ->map(fn (ExtensionLifecycle $lifecycle): string => 'extension-lifecycle-'.$lifecycle->id)
                    ->all());

                $records = [];
                foreach ($lifecycles as $lifecycle) {
                    $messageKey = 'extension-lifecycle-'.$lifecycle->id;
                    if (isset($existing[$messageKey])) {
                        continue;
                    }

                    $records[] = [
                        'source' => 'extension',
                        'type' => $typeMap[$lifecycle->event] ?? 'Extension Event',
                        'description' => "Extension {$lifecycle->extension_id} {$lifecycle->event} by user {$lifecycle->user_id}",
                        'domain' => null,
                        'user_id' => $lifecycle->user_id,
                        'email' => null,
                        'ip_address' => null,
                        'risk_score' => null,
                        'status' => $statusMap[$lifecycle->event] ?? 'glass-unlisted',
                        'message' => $messageKey,
                        'occurred_at' => $lifecycle->occurred_at,
                        'read_at' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                if (! empty($records)) {
                    Notification::insert($records);
                }

                $this->advanceWatermark('extension', $lifecycles->last()->id);
            });
    }

    private function syncCommunityMessages(): void
    {
        if (! Schema::hasTable('community_messages')) {
            return;
        }

        $now = now();

        CommunityMessage::query()
            ->where('id', '>', $this->watermark('community'))
            ->orderBy('id')
            ->chunkById(self::CHUNK, function ($messages) use ($now) {
                $existing = $this->existingMessages('community', $messages
                    ->map(fn (CommunityMessage $message): string => 'community-message-'.$message->id)
                    ->all());

                $records = [];
                foreach ($messages as $msg) {
                    $messageKey = 'community-message-'.$msg->id;
                    if (isset($existing[$messageKey])) {
                        continue;
                    }

                    $status = match ($msg->status) {
                        'approved' => 'glass-safe',
                        'rejected' => 'glass-unsafe',
                        default => 'glass-unlisted',
                    };

                    $type = match ($msg->status) {
                        'approved' => 'community_feedback_approved',
                        'rejected' => 'community_feedback_rejected',
                        default => $msg->category === 'false-positive' ? 'false_positive_report' : 'community_feedback',
                    };

                    $records[] = [
                        'source' => 'community',
                        'type' => $type,
                        'description' => "Community message from {$msg->author} ({$msg->category})",
                        'domain' => $msg->domain,
                        'user_id' => null,
                        'email' => null,
                        'ip_address' => $msg->ip_address,
                        'risk_score' => null,
                        'status' => $status,
                        'message' => $messageKey,
                        'occurred_at' => $msg->created_at ?? $now,
                        'read_at' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                if (! empty($records)) {
                    Notification::insert($records);
                }

                $this->advanceWatermark('community', $messages->last()->id);
            });
    }

    /**
     * The notification keys that already exist for the given source.
     *
     * Only the keys of the chunk being processed are looked up, so this is an
     * indexed lookup on a bounded set rather than a read of the whole
     * notifications table.
     *
     * @param  array<int, string>  $keys
     * @return array<string, int>
     */
    private function existingMessages(string $source, array $keys): array
    {
        if ($keys === []) {
            return [];
        }

        return Notification::withTrashed()
            ->where('source', $source)
            ->whereIn('message', $keys)
            ->pluck('message')
            ->flip()
            ->all();
    }

    /**
     * The id of the last source row that was mirrored.
     */
    private function watermark(string $source): int
    {
        return (int) Cache::get(self::WATERMARK_PREFIX.$source, 0);
    }

    /**
     * Record the id of the last source row that was mirrored.
     */
    private function advanceWatermark(string $source, int $id): void
    {
        if ($id > $this->watermark($source)) {
            Cache::forever(self::WATERMARK_PREFIX.$source, $id);
        }
    }

    private function statusForRisk(int $riskScore): string
    {
        return match (true) {
            $riskScore >= 85 => 'glass-unsafe',
            $riskScore >= 31 => 'glass-unlisted',
            default => 'glass-safe',
        };
    }

    private function statusForDomainStatus(?string $domainStatus): string
    {
        return match ($domainStatus) {
            'unsafe' => 'glass-unsafe',
            'unlisted' => 'glass-unlisted',
            'safe' => 'glass-safe',
            default => 'glass-unlisted',
        };
    }

    private function typeForEgress(EgressEvent $event, ?string $nudgeAction): string
    {
        if ($event->action === 'allowed') {
            return 'Egress Allowed';
        }

        if ($nudgeAction === 'cancelled') {
            return 'Nudge Success - Upload Cancelled';
        }

        if ($nudgeAction === 'proceeded') {
            return 'Egress Event Detected';
        }

        return $event->action === 'denied' ? 'Egress Attempt Blocked' : 'Egress Event Detected';
    }

    private function descriptionForEgress(EgressEvent $event, ?string $nudgeAction): string
    {
        $size = $this->formatFileSize($event->file_size);

        if ($event->action === 'allowed') {
            return "{$event->file_name} ({$size}) — upload allowed on safe domain {$event->domain}";
        }

        return match ($nudgeAction) {
            'cancelled' => "{$event->file_name} ({$size}) — user cancelled upload after nudge prompt",
            'proceeded' => "{$event->file_name} ({$size}) — user proceeded with upload after nudge prompt",
            default => $event->action === 'denied'
                ? "{$event->file_name} ({$size}) — upload blocked by policy"
                : "{$event->file_name} ({$size}) — data transferred to {$event->domain}",
        };
    }

    private function formatFileSize(int $bytes): string
    {
        return match (true) {
            $bytes >= 1073741824 => round($bytes / 1073741824, 1).' GB',
            $bytes >= 1048576 => round($bytes / 1048576, 1).' MB',
            $bytes >= 1024 => round($bytes / 1024, 1).' KB',
            default => $bytes.' B',
        };
    }
}
