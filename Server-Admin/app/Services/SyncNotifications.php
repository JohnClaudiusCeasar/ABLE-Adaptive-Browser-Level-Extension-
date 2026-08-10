<?php

namespace App\Services;

use App\Models\EgressEvent;
use App\Models\LoginActivity;
use App\Models\Notification;
use App\Models\NudgeInteraction;

class SyncNotifications
{
    /**
     * Sync notifications from the source tables (egress events, nudge
     * interactions, login activities). Idempotent: a notification is only
     * created once per source event.
     */
    public function sync(): void
    {
        $this->syncEgressEvents();
        $this->syncLoginActivities();
    }

    private function syncEgressEvents(): void
    {
        // Grab only the nudge outcome per egress event in one query.
        $nudgeActions = NudgeInteraction::query()
            ->select('egress_event_id', 'user_action')
            ->get()
            ->keyBy('egress_event_id');

        EgressEvent::query()
            ->orderBy('occurred_at')
            ->get()
            ->each(function (EgressEvent $event) use ($nudgeActions) {
                $alreadySynced = Notification::query()
                    ->where('source', 'egress')
                    ->where('message', 'egress-event-'.$event->id)
                    ->exists();

                if ($alreadySynced) {
                    return;
                }

                $nudgeAction = $nudgeActions->get($event->id)?->user_action;
                $status = $this->statusForRisk($event->risk_score);

                // One notification per egress event; the nudge outcome is
                // folded into the same notification's message/type.
                Notification::create([
                    'source' => 'egress',
                    'type' => $this->typeForEgress($event, $nudgeAction),
                    'domain' => $event->domain,
                    'user_id' => $event->user_id,
                    'email' => null,
                    'ip_address' => null,
                    'risk_score' => $event->risk_score,
                    'status' => $status,
                    'message' => 'egress-event-'.$event->id,
                    'occurred_at' => $event->occurred_at,
                    'read_at' => null,
                ]);
            });
    }

    private function syncLoginActivities(): void
    {
        LoginActivity::query()
            ->orderBy('created_at')
            ->get()
            ->each(function (LoginActivity $activity) {
                $alreadySynced = Notification::query()
                    ->where('source', 'login')
                    ->where('message', 'login-activity-'.$activity->id)
                    ->exists();

                if ($alreadySynced) {
                    return;
                }

                $status = $activity->type === 'failed' ? 'glass-unsafe' : 'glass-unlisted';

                Notification::create([
                    'source' => 'login',
                    'type' => $activity->type === 'failed'
                        ? 'Failed Login Attempt'
                        : 'New Login',
                    'domain' => null,
                    'user_id' => $activity->user_id !== null ? (string) $activity->user_id : null,
                    'email' => $activity->email,
                    'ip_address' => $activity->ip_address,
                    'risk_score' => null,
                    'status' => $status,
                    'message' => 'login-activity-'.$activity->id,
                    'occurred_at' => $activity->created_at ?? now(),
                    'read_at' => null,
                ]);
            });
    }

    private function statusForRisk(int $riskScore): string
    {
        return match (true) {
            $riskScore >= 75 => 'glass-unsafe',
            $riskScore >= 50 => 'glass-unlisted',
            default => 'glass-safe',
        };
    }

    private function typeForEgress(EgressEvent $event, ?string $nudgeAction): string
    {
        if ($nudgeAction === 'cancelled') {
            return 'Nudge Success - Upload Cancelled';
        }

        if ($nudgeAction === 'proceeded') {
            return 'Egress Event Detected';
        }

        return $event->action === 'denied' ? 'Egress Attempt Blocked' : 'Egress Event Detected';
    }
}
