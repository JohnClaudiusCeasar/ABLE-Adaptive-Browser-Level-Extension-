<?php

namespace App\Http\Controllers;

use App\Concerns\BoundsAdminRows;
use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\NudgeInteraction;
use App\Services\AbleSettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SecurityAnalyticsController extends Controller
{
    use BoundsAdminRows;

    /**
     * Display the Shadow Analytics page with live data.
     */
    public function index(): Response
    {
        // 1. Active Shadow Apps - domains with more than three proceeded egress events
        // (same definition as the Dashboard's Active Shadow Apps card).
        $activeShadowApps = EgressEvent::select('domain')
            ->where('action', 'proceeded')
            ->groupBy('domain')
            ->havingRaw('COUNT(*) > 3')
            ->count();

        // Detail list behind the Active Shadow Apps card (same >3 proceeded definition).
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

        // 2. Shadow Adopters - users with more than five egress attempts scoring at or
        // above the interception threshold against unlisted/unsafe domains.
        $riskThreshold = (int) app(AbleSettingsService::class)->value('extension', 'behavior.risk_threshold', 85);

        $unlistedUnsafeDomains = DomainPolicy::whereIn('domain_status', ['unsafe', 'unlisted'])
            ->select('domain');

        $shadowAdopterQuery = fn () => EgressEvent::whereIn('domain', $unlistedUnsafeDomains)
            ->whereNotNull('user_id')
            ->where('risk_score', '>=', $riskThreshold)
            ->select('user_id')
            ->groupBy('user_id')
            ->havingRaw('COUNT(*) > 5');

        $shadowAdopters = DB::query()
            ->fromSub($shadowAdopterQuery(), 'shadow_adopters')
            ->count();

        // Detail list behind the Shadow Adopters card, ordered by attempt volume.
        $shadowAdopterList = $shadowAdopterQuery()
            ->selectRaw('COUNT(*) as attempt_count')
            ->orderByDesc('attempt_count')
            ->orderBy('user_id')
            ->limit($this->rowLimit())
            ->get()
            ->values()
            ->map(fn ($row, int $index) => [
                'id' => $index + 1,
                'client_name' => $row->user_id,
            ]);

        // 3. Shadow Egress Attempts
        $shadowEgressAttempts = EgressEvent::count();
        $criticalEgressAttempts = EgressEvent::where('risk_score', '>=', 76)->count();

        // 4. Data Protection Volume
        /** @var object{data_saved: int, data_lost: int} $dataStats */
        $dataStats = EgressEvent::selectRaw("
            COALESCE(SUM(CASE WHEN action = 'denied' THEN file_size ELSE 0 END), 0) as data_saved,
            COALESCE(SUM(CASE WHEN action IN ('proceeded', 'allowed') THEN file_size ELSE 0 END), 0) as data_lost
        ")->first();

        // 5. Nudge Interactions & Containment Rate
        /** @var object{cancelled: int, proceeded: int} $nudgeStats */
        $nudgeStats = NudgeInteraction::selectRaw("
            COALESCE(SUM(CASE WHEN user_action = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled,
            COALESCE(SUM(CASE WHEN user_action = 'proceeded' THEN 1 ELSE 0 END), 0) as proceeded
        ")->first();
        $nudgeCancelled = (int) ($nudgeStats->cancelled ?? 0);
        $nudgeProceeded = (int) ($nudgeStats->proceeded ?? 0);
        $totalNudgeInteractions = $nudgeCancelled + $nudgeProceeded;
        $shadowContainmentRate = $totalNudgeInteractions > 0
            ? round(($nudgeCancelled / $totalNudgeInteractions) * 100, 1)
            : 0;

        // 6. Section 2 Chart 1: Shadow Activity Velocity (Last 7 Days)
        $sevenDaysAgo = now()->subDays(6)->startOfDay();
        $dailyVisits = DomainVisit::selectRaw('DATE(visited_at) as date, COUNT(*) as count')
            ->where('visited_at', '>=', $sevenDaysAgo)
            ->groupByRaw('DATE(visited_at)')
            ->pluck('count', 'date');

        $dailyEgress = EgressEvent::selectRaw('DATE(occurred_at) as date, COUNT(*) as count')
            ->where('occurred_at', '>=', $sevenDaysAgo)
            ->groupByRaw('DATE(occurred_at)')
            ->pluck('count', 'date');

        $velocityActivity = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $velocityActivity[] = [
                'date' => $date,
                'day' => now()->subDays($i)->format('D'),
                'visits' => (int) ($dailyVisits[$date] ?? 0),
                'egress' => (int) ($dailyEgress[$date] ?? 0),
            ];
        }

        // 7. Section 2 Chart 2: Shadow Category Risk Distribution
        $totalPolicies = DomainPolicy::count();
        $categoriesRaw = DomainPolicy::select(
            DB::raw("COALESCE(NULLIF(category, ''), 'General Cloud') as category_name"),
            DB::raw('COUNT(*) as count'),
            DB::raw('ROUND(AVG(risk_score)) as avg_risk')
        )
            ->groupByRaw("COALESCE(NULLIF(category, ''), 'General Cloud')")
            ->orderByDesc('count')
            ->limit(6)
            ->get();

        $categoryDistribution = $categoriesRaw->map(function ($row) use ($totalPolicies) {
            /** @var object{category_name: string, count: int|string, avg_risk: int|string} $row */
            return [
                'category' => $row->category_name,
                'count' => (int) $row->count,
                'percentage' => $totalPolicies > 0 ? round(((int) $row->count / $totalPolicies) * 100) : 0,
                'avgRisk' => (int) $row->avg_risk,
            ];
        });

        // 8. Section 2 Chart 3: Policy Stance
        /** @var object{unapproved: int, under_review: int, sanctioned: int} $policyCounts */
        $policyCounts = DomainPolicy::selectRaw("
            COALESCE(SUM(CASE WHEN policy = 'blacklisted' OR domain_status = 'unsafe' THEN 1 ELSE 0 END), 0) as unapproved,
            COALESCE(SUM(CASE WHEN policy = 'under_review' OR domain_status = 'unlisted' THEN 1 ELSE 0 END), 0) as under_review,
            COALESCE(SUM(CASE WHEN policy = 'whitelisted' OR domain_status = 'safe' THEN 1 ELSE 0 END), 0) as sanctioned
        ")->first();
        $policyStance = [
            'unapproved' => (int) ($policyCounts->unapproved ?? 0),
            'underReview' => (int) ($policyCounts->under_review ?? 0),
            'sanctioned' => (int) ($policyCounts->sanctioned ?? 0),
            'total' => (int) (($policyCounts->unapproved ?? 0) + ($policyCounts->under_review ?? 0) + ($policyCounts->sanctioned ?? 0)),
        ];

        // 9. Section 2 Chart 4: Nudge Containment Efficacy
        $nudgeEfficacy = [
            'cancelled' => $nudgeCancelled,
            'proceeded' => $nudgeProceeded,
            'total' => $totalNudgeInteractions,
            'rate' => $shadowContainmentRate,
        ];

        return Inertia::render('security-analytics', [
            'kpi' => [
                'activeShadowApps' => $activeShadowApps,
                'shadowAdopters' => $shadowAdopters,
                'shadowEgressAttempts' => $shadowEgressAttempts,
                'criticalEgressAttempts' => $criticalEgressAttempts,
                'dataSaved' => $this->formatBytes((int) $dataStats->data_saved),
                'dataLost' => $this->formatBytes((int) $dataStats->data_lost),
                'shadowContainmentRate' => $shadowContainmentRate,
            ],
            'activeShadowAppsList' => $activeShadowAppsList,
            'shadowAdopterList' => $shadowAdopterList,
            'velocityActivity' => $velocityActivity,
            'categoryDistribution' => $categoryDistribution,
            'policyStance' => $policyStance,
            'nudgeEfficacy' => $nudgeEfficacy,
        ]);
    }

    /**
     * Display the standalone Discovered Shadow Applications catalog subpage.
     *
     * When a user_id query param is supplied the catalog is scoped to the
     * domains that specific client touched, and rows carry that client's
     * own visit and incident counts.
     */
    public function shadowApps(Request $request): Response
    {
        $scopedUserId = trim((string) $request->query('user_id', ''));
        $scopedUserId = $scopedUserId !== '' ? $scopedUserId : null;

        $visitsByDomain = collect();
        $incidentsByDomain = collect();

        $catalogQuery = DomainPolicy::select(
            'domain_policies.id',
            'domain_policies.domain',
            'domain_policies.category',
            'domain_policies.risk_score',
            'domain_policies.domain_status',
            'domain_policies.policy',
            'domain_policies.block_access',
            'domain_policies.visit_count',
            DB::raw('COUNT(DISTINCT domain_visits.user_id) as active_users')
        )
            ->leftJoin('domain_visits', 'domain_visits.domain', '=', 'domain_policies.domain')
            ->groupBy(
                'domain_policies.id',
                'domain_policies.domain',
                'domain_policies.category',
                'domain_policies.risk_score',
                'domain_policies.domain_status',
                'domain_policies.policy',
                'domain_policies.block_access',
                'domain_policies.visit_count'
            )
            ->orderByDesc('domain_policies.risk_score');

        if ($scopedUserId !== null) {
            $touchedDomains = DomainVisit::where('user_id', $scopedUserId)
                ->select('domain')
                ->union(
                    EgressEvent::where('user_id', $scopedUserId)->select('domain')
                );

            $catalogQuery->whereIn('domain_policies.domain', $touchedDomains);

            $visitsByDomain = DomainVisit::where('user_id', $scopedUserId)
                ->selectRaw('domain, COUNT(*) as visits')
                ->groupBy('domain')
                ->get()
                ->keyBy('domain');

            $incidentsByDomain = EgressEvent::where('user_id', $scopedUserId)
                ->selectRaw('domain, COUNT(*) as incidents')
                ->groupBy('domain')
                ->get()
                ->keyBy('domain');
        }

        $shadowCatalog = $catalogQuery->limit($this->rowLimit())->get()->map(function ($row) use ($visitsByDomain, $incidentsByDomain) {
            /** @var object{id: int, domain: string, category: string|null, risk_score: int, domain_status: string, policy: string, block_access: bool, visit_count: int, active_users: int} $row */
            $domainParts = explode('.', $row->domain);
            $appName = ucfirst($domainParts[0]);

            $statusMap = [
                'whitelisted' => 'Sanctioned',
                'blacklisted' => 'Unapproved',
                'under_review' => 'Under Review',
            ];

            return [
                'id' => $row->id,
                'app' => $appName,
                'domain' => $row->domain,
                'category' => $row->category ?: 'General Cloud',
                'risk_score' => (int) $row->risk_score,
                'users' => (int) $row->active_users,
                'visit_count' => (int) ($row->visit_count ?: $row->active_users),
                'user_visits' => (int) ($visitsByDomain->get($row->domain)->visits ?? 0),
                'user_incidents' => (int) ($incidentsByDomain->get($row->domain)->incidents ?? 0),
                'status' => $statusMap[$row->policy] ?? 'Under Review',
                'policy' => $row->policy,
                'domain_status' => $row->domain_status,
                'block_access' => (bool) $row->block_access,
            ];
        });

        return Inertia::render('security-analytics/shadow-apps', [
            'shadowCatalog' => $shadowCatalog,
            'scoped_user' => $scopedUserId,
            'truncated' => $shadowCatalog->count() >= $this->rowLimit(),
            'rowLimit' => $this->rowLimit(),
        ]);
    }

    /**
     * Display the standalone Shadow Egress Incidents subpage.
     */
    public function egressIncidents(): Response
    {
        $limit = $this->rowLimit();

        // The threshold the extension intercepts uploads at, so the table can
        // explain why a row proceeded. Defaults to the built-in 85.
        $riskThreshold = (int) app(AbleSettingsService::class)->value('extension', 'behavior.risk_threshold', 85);

        $recentShadowEgress = EgressEvent::orderByDesc('occurred_at')
            ->limit($limit)
            ->get()
            ->map(function ($event) {
                return [
                    'id' => $event->id,
                    'occurred_at' => $event->occurred_at->toIso8601String(),
                    'domain' => $event->domain,
                    'user' => $event->user_id ?? 'Unknown',
                    'fileName' => $event->file_name ?? '—',
                    'fileSize' => $event->file_size ? $this->formatBytes($event->file_size) : '—',
                    'risk_score' => (int) $event->risk_score,
                    'flagged_items' => is_array($event->flagged_items) ? $event->flagged_items : null,
                    'action' => ucfirst($event->action),
                ];
            });

        return Inertia::render('security-analytics/egress-incidents', [
            'recentShadowEgress' => $recentShadowEgress,
            'truncated' => $recentShadowEgress->count() >= $limit,
            'rowLimit' => $limit,
            'riskThreshold' => $riskThreshold,
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
