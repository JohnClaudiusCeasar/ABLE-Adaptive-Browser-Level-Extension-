<?php

namespace App\Http\Controllers;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\NudgeInteraction;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SecurityAnalyticsController extends Controller
{
    /**
     * Display the Security Analytics page with live data.
     */
    public function index(): Response
    {
        // 1. Detected Domains - count unique domains from domain_visits
        $uniqueDomains = DomainVisit::distinct('domain')->count();

        // 2. Domain Usage - single conditional aggregation instead of 3 separate counts
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

        // 3. Total Nudges Deployed - count egress events
        $totalNudgesDeployed = EgressEvent::count();

        // 4. Nudge Effectiveness - count interactions grouped by date and action
        $nudgeEffectiveness = NudgeInteraction::select(
            DB::raw('DATE(interacted_at) as date'),
            DB::raw("SUM(CASE WHEN user_action = 'proceeded' THEN 1 ELSE 0 END) as proceeded"),
            DB::raw("SUM(CASE WHEN user_action = 'cancelled' THEN 1 ELSE 0 END) as cancelled")
        )
            ->groupBy(DB::raw('DATE(interacted_at)'))
            ->orderByDesc('date')
            ->limit(10)
            ->get()
            ->map(function ($row) {
                /** @var object{date: string, proceeded: int, cancelled: int} $row */
                return [
                    'date' => $row->date,
                    'proceeded' => (int) $row->proceeded,
                    'cancelled' => (int) $row->cancelled,
                ];
            });

        // 5. Average Success Rate - compute from nudge effectiveness data
        $totalProceeded = $nudgeEffectiveness->sum('proceeded');
        $totalCancelled = $nudgeEffectiveness->sum('cancelled');
        $totalInteractions = $totalProceeded + $totalCancelled;
        $avgSuccessRate = $totalInteractions > 0
            ? round(($totalProceeded / $totalInteractions) * 100, 1)
            : 0;

        // 6 & 7. Data Saved/Lost - single conditional aggregation instead of 2 separate sums
        /** @var object{data_saved: int, data_lost: int} $dataStats */
        $dataStats = EgressEvent::selectRaw("
            COALESCE(SUM(CASE WHEN action = 'denied' THEN file_size ELSE 0 END), 0) as data_saved,
            COALESCE(SUM(CASE WHEN action = 'proceeded' THEN file_size ELSE 0 END), 0) as data_lost
        ")->first();

        // 8. Top Domains - LEFT JOIN instead of correlated subqueries
        $topDomains = DomainPolicy::select(
            'domain_policies.domain',
            'domain_policies.visit_count as totalVisits',
            DB::raw('COUNT(DISTINCT domain_visits.user_id) as activeUsers')
        )
            ->leftJoin('domain_visits', 'domain_visits.domain', '=', 'domain_policies.domain')
            ->groupBy('domain_policies.id', 'domain_policies.domain', 'domain_policies.visit_count')
            ->orderByRaw('(domain_policies.visit_count + COUNT(DISTINCT domain_visits.user_id)) / 2 DESC')
            ->limit(5)
            ->get()
            ->map(function ($row) {
                /** @var object{domain: string, totalVisits: int, activeUsers: int} $row */
                return [
                    'domain' => $row->domain,
                    'totalVisits' => (int) $row->totalVisits,
                    'activeUsers' => (int) $row->activeUsers,
                ];
            });

        return Inertia::render('security-analytics', [
            'uniqueDomains' => $uniqueDomains,
            'domainUsage' => $domainUsage,
            'totalNudgesDeployed' => $totalNudgesDeployed,
            'nudgeEffectiveness' => $nudgeEffectiveness,
            'avgSuccessRate' => $avgSuccessRate,
            'dataSaved' => $this->formatBytes((int) $dataStats->data_saved),
            'dataLost' => $this->formatBytes((int) $dataStats->data_lost),
            'topDomains' => $topDomains,
        ]);
    }

    /**
     * Display the Shadow Footprint Catalog page with live data.
     */
    public function shadowFootprints(): Response
    {
        $shadowFootprints = DomainPolicy::select(
            'domain_policies.id', 'domain_policies.domain', 'domain_policies.category', 'domain_policies.risk_score', 'domain_policies.policy',
            DB::raw('COUNT(DISTINCT domain_visits.user_id) as active_users')
        )
            ->leftJoin('domain_visits', 'domain_visits.domain', '=', 'domain_policies.domain')
            ->groupBy('domain_policies.id', 'domain_policies.domain', 'domain_policies.category', 'domain_policies.risk_score', 'domain_policies.policy')
            ->orderByDesc('domain_policies.risk_score')
            ->get()
            ->map(function ($row) {
                /** @var object{id: int, domain: string, category: string|null, risk_score: int, policy: string, active_users: int} $row */
                $domainName = explode('.', $row->domain)[0];
                $appName = ucfirst($domainName);

                $statusMap = [
                    'whitelisted' => 'Approved',
                    'blacklisted' => 'Unapproved',
                    'under_review' => 'Pending',
                ];

                return [
                    'id' => $row->id,
                    'app' => $appName,
                    'domain' => $row->domain,
                    'category' => $row->category ?? '—',
                    'risk' => $row->risk_score > 50 ? 'high' : 'low',
                    'users' => (int) $row->active_users,
                    'status' => $statusMap[$row->policy],
                ];
            });

        return Inertia::render('security-analytics/shadow-footprints', [
            'shadowFootprints' => $shadowFootprints,
        ]);
    }

    /**
     * Display the Nudge Effectiveness subpage with full data.
     */
    public function nudgeEffectiveness(): Response
    {
        $nudgeEffectiveness = NudgeInteraction::select(
            DB::raw('DATE(interacted_at) as date'),
            DB::raw("SUM(CASE WHEN user_action = 'proceeded' THEN 1 ELSE 0 END) as proceeded"),
            DB::raw("SUM(CASE WHEN user_action = 'cancelled' THEN 1 ELSE 0 END) as cancelled")
        )
            ->groupBy(DB::raw('DATE(interacted_at)'))
            ->orderByDesc('date')
            ->get()
            ->map(function ($row) {
                /** @var object{date: string, proceeded: int, cancelled: int} $row */
                return [
                    'date' => $row->date,
                    'proceeded' => (int) $row->proceeded,
                    'cancelled' => (int) $row->cancelled,
                ];
            });

        return Inertia::render('security-analytics/nudge-effectiveness', [
            'nudgeEffectiveness' => $nudgeEffectiveness,
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
