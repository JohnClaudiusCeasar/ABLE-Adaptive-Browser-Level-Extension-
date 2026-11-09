<?php

namespace App\Http\Controllers;

use App\Models\DomainPolicy;
use App\Models\DomainRecommendation;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\NudgeInteraction;
use App\Services\AbleSettingsService;
use App\Support\AppCategories;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
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
        $activeVisitUsersQuery = DomainVisit::where('visited_at', '>=', $thirtyDaysAgo)
            ->whereNotNull('user_id')
            ->select('user_id');
        $activeEgressUsersQuery = EgressEvent::where('occurred_at', '>=', $thirtyDaysAgo)
            ->whereNotNull('user_id')
            ->select('user_id');
        $activeUsers = DB::query()
            ->fromSub($activeVisitUsersQuery->union($activeEgressUsersQuery), 'active_users')
            ->count();

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

        // Detail list behind the Active Shadow Apps card (same >3 proceeded definition).
        // The aggregation covers the whole egress history, so the list is
        // capped: without a cap the card would read and hold every domain
        // that ever had more than three uploads.
        /** @var Collection<int, object{id: int|null, domain: string, usage_count: int|string}> $activeShadowAppRows */
        $activeShadowAppRows = EgressEvent::select(
            'egress_events.domain',
            'domain_policies.id',
            DB::raw('COUNT(*) as usage_count')
        )
            ->leftJoin('domain_policies', 'domain_policies.domain', '=', 'egress_events.domain')
            ->where('action', 'proceeded')
            ->groupBy('egress_events.domain', 'domain_policies.id')
            ->havingRaw('COUNT(*) > 3')
            ->orderByDesc('usage_count')
            ->limit(100)
            ->get();

        $activeShadowAppsList = $activeShadowAppRows->map(fn ($row) => [
            'id' => $row->id !== null ? (int) $row->id : null,
            'domain' => $row->domain,
            'usage_count' => (int) $row->usage_count,
        ]);

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

        // 4. Nudge Success Rate & Event Counts (Risk-Differentiated)
        // Cancelled = user cancelled upload (nudge prevented data loss)
        // Proceeded (High Risk) = user proceeded on high-risk egress (critical data breach)
        // Proceeded (Low Risk) = user proceeded on low-risk egress (tolerated / benign flow)
        $threshold = (int) app(AbleSettingsService::class)->value('extension', 'behavior.risk_threshold', 85);
        $nudgeStats = NudgeInteraction::containmentStats(null, $threshold, lowRiskPenaltyWeight: 0.25);
        $nudgeCancelled = $nudgeStats['cancelled'];
        $nudgeProceeded = $nudgeStats['proceeded'];
        $nudgeProceededHigh = $nudgeStats['proceeded_high'];
        $nudgeProceededLow = $nudgeStats['proceeded_low'];
        $nudgeSuccessRate = $nudgeStats['success_rate'];
        $nudgeHighRiskSuccessRate = $nudgeStats['high_risk_success_rate'];
        $nudgeLowRiskSuccessRate = $nudgeStats['low_risk_success_rate'];

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
            ->groupByRaw('DATE(visited_at)')
            ->pluck('count', 'date');

        /** @var Collection<string, object{total: int|string, high: int|string, low: int|string}> $dailyEgressStats */
        $dailyEgressStats = EgressEvent::selectRaw("
            DATE(occurred_at) as date,
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN risk_score >= ? THEN 1 ELSE 0 END), 0) as high,
            COALESCE(SUM(CASE WHEN risk_score < ? THEN 1 ELSE 0 END), 0) as low
        ", [$threshold, $threshold])
            ->where('occurred_at', '>=', $sevenDaysAgo)
            ->groupByRaw('DATE(occurred_at)')
            ->get()
            ->keyBy('date');

        $shadowActivity = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $dayEgress = $dailyEgressStats->get($date);
            $shadowActivity[] = [
                'date' => $date,
                'day' => now()->subDays($i)->format('D'),
                'visits' => (int) ($dailyVisits[$date] ?? 0),
                'egress' => (int) ($dayEgress->total ?? 0),
                'egressHigh' => (int) ($dayEgress->high ?? 0),
                'egressLow' => (int) ($dayEgress->low ?? 0),
            ];
        }

        return Inertia::render('dashboard', [
            'activeUsers' => $activeUsers,
            'inactiveUsers' => $inactiveUsers,
            'totalDomainVisits' => $totalDomainVisits,
            'activeShadowApps' => $activeShadowApps,
            'activeShadowAppsList' => $activeShadowAppsList,
            'totalEgressCount' => $totalEgressCount,
            'criticalEgressCount' => $criticalEgressCount,
            'dataSaved' => $this->formatBytes((int) $dataStats->data_saved),
            'dataLost' => $this->formatBytes((int) $dataStats->data_lost),
            'nudgeSuccessRate' => $nudgeSuccessRate,
            'nudgeCancelled' => $nudgeCancelled,
            'nudgeProceeded' => $nudgeProceeded,
            'nudgeProceededHigh' => $nudgeProceededHigh,
            'nudgeProceededLow' => $nudgeProceededLow,
            'nudgeHighRiskSuccessRate' => $nudgeHighRiskSuccessRate,
            'nudgeLowRiskSuccessRate' => $nudgeLowRiskSuccessRate,
            'domainUsage' => $domainUsage,
            'recentEgressEvents' => $recentEgressEvents,
            'recentDomainVisits' => $recentDomainVisits,
            'shadowActivity' => $shadowActivity,
            'recommendationCount' => DomainRecommendation::whereIn('category', AppCategories::recommendationNames())->count(),
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
