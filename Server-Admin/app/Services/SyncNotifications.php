<?php

namespace App\Services;

use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\Notification;
use App\Models\NudgeInteraction;

class SyncNotifications
{
    /**
     * Sync notifications from extension-related source tables. Idempotent: a
     * notification is only created once per source event.
     *
     * Captured sources: egress events, domain visits, extension lifecycle.
     */
    public function sync(): void
    {
        if (! app(AbleSettingsService::class)->value('server', 'runtime.notification_sync_enabled', true)) {
            return;
        }

        $this->syncEgressEvents();
        $this->syncDomainVisits();
        $this->syncExtensionLifecycles();
    }

    private function syncEgressEvents(): void
    {
        $existing = Notification::withTrashed()
            ->where('source', 'egress')
            ->pluck('message')
            ->flip();

        // Grab only the nudge outcome per egress event in one query.
        $nudgeActions = NudgeInteraction::query()
            ->select('egress_event_id', 'user_action')
            ->get()
            ->keyBy('egress_event_id');

        EgressEvent::query()
            ->orderBy('occurred_at')
            ->get()
            ->each(function (EgressEvent $event) use ($existing, $nudgeActions) {
                $messageKey = 'egress-event-'.$event->id;
                if (isset($existing[$messageKey])) {
                    return;
                }

                $nudgeAction = $nudgeActions->get($event->id)?->user_action;
                $status = $this->statusForRisk($event->risk_score);

                // One notification per egress event; the nudge outcome is
                // folded into the same notification's message/type.
                Notification::create([
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
                ]);
            });
    }

    private function syncDomainVisits(): void
    {
        $existing = Notification::withTrashed()
            ->where('source', 'domain')
            ->pluck('message')
            ->flip();

        DomainVisit::query()
            ->with('domainPolicy')
            ->orderBy('visited_at')
            ->get()
            ->each(function (DomainVisit $visit) use ($existing) {
                $messageKey = 'domain-visit-'.$visit->id;
                if (isset($existing[$messageKey])) {
                    return;
                }

                $isFirstVisit = $visit->domainPolicy !== null && $visit->domainPolicy->visit_count === 1;
                $type = $isFirstVisit ? 'New Domain Detected' : 'New Domain Visit';
                $status = $this->statusForDomainStatus($visit->resolvedStatus());
                $riskScore = $visit->domainPolicy->risk_score ?? 0;

                Notification::create([
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
                ]);
            });
    }

    private function syncExtensionLifecycles(): void
    {
        $existing = Notification::withTrashed()
            ->where('source', 'extension')
            ->pluck('message')
            ->flip();

        ExtensionLifecycle::query()
            ->orderBy('occurred_at')
            ->get()
            ->each(function (ExtensionLifecycle $lifecycle) use ($existing) {
                $messageKey = 'extension-lifecycle-'.$lifecycle->id;
                if (isset($existing[$messageKey])) {
                    return;
                }

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

                Notification::create([
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
                ]);
            });
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
