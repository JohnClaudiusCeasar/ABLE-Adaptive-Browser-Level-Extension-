<?php

namespace App\Http\Controllers;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\NudgeInteraction;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Display the Dashboard page with live data.
     */
    public function index(): Response
    {
        // 1. Active Extension Users - distinct extension user IDs with activity in the last 30 days
        $thirtyDaysAgo = now()->subDays(30);
        $activeVisitUsers = DomainVisit::where('visited_at', '>=', $thirtyDaysAgo)
            ->whereNotNull('user_id')
            ->distinct('user_id')
            ->pluck('user_id');
        $activeEgressUsers = EgressEvent::where('occurred_at', '>=', $thirtyDaysAgo)
            ->whereNotNull('user_id')
            ->distinct('user_id')
            ->pluck('user_id');
        $activeUsers = $activeVisitUsers->merge($activeEgressUsers)->unique()->count();

        // Inactive Extension Users - users whose latest lifecycle event is 'uninstalled'
        $inactiveUsers = ExtensionLifecycle::select('user_id')
            ->selectRaw('MAX(occurred_at) as last_event_at')
            ->groupBy('user_id')
            ->havingRaw('MAX(CASE WHEN event = ? THEN occurred_at END) = MAX(occurred_at)', ['uninstalled'])
            ->count();

        // 2. Total telemetry counts
        $totalDomainVisits = DomainVisit::count();
        $activeShadowApps = EgressEvent::select('domain')
            ->where('action', 'proceeded')
            ->groupBy('domain')
            ->havingRaw('COUNT(*) > 3')
            ->count();

        // Total Egress Count - egress events for domains with policies
        $totalEgressCount = EgressEvent::whereIn('domain', function ($query) {
            $query->select('domain')->from('domain_policies');
        })->count();

        // Critical Egress Count - egress events with high risk scores
        $criticalEgressCount = EgressEvent::where('risk_score', '>=', 90)->count();

        // 3. Data Saved/Lost - single conditional aggregation
        /** @var object{data_saved: int, data_lost: int} $dataStats */
        $dataStats = EgressEvent::selectRaw("
            COALESCE(SUM(CASE WHEN action = 'denied' THEN file_size ELSE 0 END), 0) as data_saved,
            COALESCE(SUM(CASE WHEN action IN ('proceeded', 'allowed') THEN file_size ELSE 0 END), 0) as data_lost
        ")->first();

        // 4. Nudge Success Rate
        // Success = user cancelled upload (nudge prevented data loss)
        // Failure = user proceeded with upload (data left the network)
        /** @var object{success: int, failure: int} $nudgeStats */
        $nudgeStats = NudgeInteraction::selectRaw("
            SUM(CASE WHEN user_action = 'cancelled' THEN 1 ELSE 0 END) as success,
            SUM(CASE WHEN user_action = 'proceeded' THEN 1 ELSE 0 END) as failure
        ")->first();
        $totalInteractions = (int) $nudgeStats->success + (int) $nudgeStats->failure;
        $nudgeSuccessRate = $totalInteractions > 0
            ? round(((int) $nudgeStats->success / $totalInteractions) * 100, 1)
            : 0;

        // 5. Domain Usage - single conditional aggregation
        /** @var object{safe: int, unsafe: int, unlisted: int} $statusCounts */
        $statusCounts = DomainPolicy::selectRaw("
            SUM(CASE WHEN domain_status = 'safe' THEN 1 ELSE 0 END) as safe,
            SUM(CASE WHEN domain_status = 'unsafe' THEN 1 ELSE 0 END) as unsafe,
            SUM(CASE WHEN domain_status = 'unlisted' THEN 1 ELSE 0 END) as unlisted
        ")->first();
        $domainUsage = [
            'safe' => (int) $statusCounts->safe,
            'unsafe' => (int) $statusCounts->unsafe,
            'unlisted' => (int) $statusCounts->unlisted,
        ];

        // 6. Recent Egress Events
        $recentEgressEvents = EgressEvent::orderByDesc('occurred_at')
            ->limit(5)
            ->get()
            ->map(function ($event) {
                if ($event->action === 'allowed') {
                    $status = 'glass-safe';
                } elseif ($event->risk_score >= 90) {
                    $status = 'glass-unsafe';
                } else {
                    $status = 'glass-unlisted';
                }

                return [
                    'occurred_at' => $event->occurred_at->toIso8601String(),
                    'domain' => $event->domain,
                    'status' => $status,
                    'user' => $event->user_id,
                    'fileName' => $event->file_name,
                    'action' => ucfirst($event->action),
                ];
            });

        // 7. Recent Domain Visits
        $recentDomainVisits = DomainVisit::with('domainPolicy')
            ->orderByDesc('visited_at')
            ->limit(5)
            ->get()
            ->map(function (DomainVisit $visit) {
                return [
                    'visited_at' => $visit->visited_at->toIso8601String(),
                    'url' => $visit->domain,
                    'domain' => $visit->domain,
                    'status' => $visit->glassStatus(),
                    'user' => $visit->user_id,
                    'action' => $visit->actionLabel(),
                ];
            });

        // 8. Shadow Activity Timeline - daily counts for last 7 days
        $sevenDaysAgo = now()->subDays(6)->startOfDay();

        $dailyVisits = DomainVisit::selectRaw('DATE(visited_at) as date, COUNT(*) as count')
            ->where('visited_at', '>=', $sevenDaysAgo)
            ->groupBy('date')
            ->pluck('count', 'date');

        $dailyEgress = EgressEvent::selectRaw('DATE(occurred_at) as date, COUNT(*) as count')
            ->where('occurred_at', '>=', $sevenDaysAgo)
            ->groupBy('date')
            ->pluck('count', 'date');

        $shadowActivity = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $shadowActivity[] = [
                'date' => $date,
                'day' => now()->subDays($i)->format('D'),
                'visits' => (int) ($dailyVisits[$date] ?? 0),
                'egress' => (int) ($dailyEgress[$date] ?? 0),
            ];
        }

        return Inertia::render('dashboard', [
            'activeUsers' => $activeUsers,
            'inactiveUsers' => $inactiveUsers,
            'totalDomainVisits' => $totalDomainVisits,
            'activeShadowApps' => $activeShadowApps,
            'totalEgressCount' => $totalEgressCount,
            'criticalEgressCount' => $criticalEgressCount,
            'dataSaved' => $this->formatBytes((int) $dataStats->data_saved),
            'dataLost' => $this->formatBytes((int) $dataStats->data_lost),
            'nudgeSuccessRate' => $nudgeSuccessRate,
            'domainUsage' => $domainUsage,
            'recentEgressEvents' => $recentEgressEvents,
            'recentDomainVisits' => $recentDomainVisits,
            'shadowActivity' => $shadowActivity,
        ]);
    }

    /**
     * Format bytes to human readable format.
     */
    private function formatBytes(int $bytes): string
    {
        if ($bytes === 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = (int) floor(log($bytes, 1024));

        return round($bytes / (1024 ** $i), 1).' '.$units[$i];
    }
}
