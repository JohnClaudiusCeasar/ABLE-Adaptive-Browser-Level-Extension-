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

        // 2. Domain Usage - count domains grouped by status
        $domainUsage = [
            'safe' => DomainPolicy::where('domain_status', 'safe')->count(),
            'unsafe' => DomainPolicy::where('domain_status', 'unsafe')->count(),
            'unlisted' => DomainPolicy::where('domain_status', 'unlisted')->count(),
        ];

        // 3. Total Nudges Deployed - count egress events
        $totalNudgesDeployed = EgressEvent::count();

        // 4. Nudge Effectiveness - count interactions grouped by date and action
        $nudgeEffectiveness = NudgeInteraction::select(
            DB::raw("DATE(interacted_at) as date"),
            DB::raw("SUM(CASE WHEN user_action = 'proceeded' THEN 1 ELSE 0 END) as proceeded"),
            DB::raw("SUM(CASE WHEN user_action = 'cancelled' THEN 1 ELSE 0 END) as cancelled")
        )
            ->groupBy(DB::raw("DATE(interacted_at)"))
            ->orderByDesc('date')
            ->limit(5)
            ->get()
            ->map(function ($row) {
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

        // 6. Data Saved - sum file_size where action = 'denied' (user cancelled)
        $dataSaved = EgressEvent::where('action', 'denied')->sum('file_size');

        // 7. Data Lost - sum file_size where action = 'proceeded' (user proceeded)
        $dataLost = EgressEvent::where('action', 'proceeded')->sum('file_size');

        // 8. Top Domains - top 5 domains by average of visit_count and active users
        $topDomains = DomainPolicy::select(
            'domain',
            'visit_count as totalVisits',
            DB::raw('(SELECT COUNT(DISTINCT user_id) FROM domain_visits WHERE domain_visits.domain = domain_policies.domain) as activeUsers')
        )
            ->orderByRaw('(visit_count + (SELECT COUNT(DISTINCT user_id) FROM domain_visits WHERE domain_visits.domain = domain_policies.domain)) / 2 DESC')
            ->limit(5)
            ->get()
            ->map(function ($row) {
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
            'dataSaved' => $this->formatBytes($dataSaved),
            'dataLost' => $this->formatBytes($dataLost),
            'topDomains' => $topDomains,
        ]);
    }

    /**
     * Format bytes to human readable format.
     */
    private function formatBytes(int $bytes): string
    {
        if ($bytes === 0) return '0 B';

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = (int) floor(log($bytes, 1024));

        return round($bytes / (1024 ** $i), 1) . ' ' . $units[$i];
    }
}
