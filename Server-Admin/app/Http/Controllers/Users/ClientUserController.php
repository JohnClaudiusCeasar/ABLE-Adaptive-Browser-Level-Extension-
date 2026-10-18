<?php

namespace App\Http\Controllers\Users;

use App\Http\Controllers\Controller;
use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\NudgeInteraction;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ClientUserController extends Controller
{
    /**
     * Display a listing of sanitized client extension users.
     */
    public function index(): Response
    {
        // Gather unique user IDs across all telemetry and lifecycle tables
        $lifecycleUsers = ExtensionLifecycle::whereNotNull('user_id')->distinct()->pluck('user_id');
        $visitUsers = DomainVisit::whereNotNull('user_id')->distinct()->pluck('user_id');
        $egressUsers = EgressEvent::whereNotNull('user_id')->distinct()->pluck('user_id');

        $allUserIds = $lifecycleUsers
            ->merge($visitUsers)
            ->merge($egressUsers)
            ->unique()
            ->values();

        $thirtyDaysAgo = now()->subDays(30);

        // Preload lifecycle stats
        $lifecycles = ExtensionLifecycle::whereIn('user_id', $allUserIds)
            ->orderBy('occurred_at')
            ->get()
            ->groupBy('user_id');

        // Preload visit counts and latest activity
        $visitCounts = DB::table('domain_visits')->whereIn('user_id', $allUserIds)
            ->selectRaw('user_id, count(*) as total, max(visited_at) as last_visited, min(visited_at) as first_visited')
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        // Preload egress counts and latest activity
        $egressCounts = DB::table('egress_events')->whereIn('user_id', $allUserIds)
            ->selectRaw('user_id, count(*) as total, max(occurred_at) as last_egress, min(occurred_at) as first_egress')
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        $clients = $allUserIds->map(function (string $userId, int $index) use ($lifecycles, $visitCounts, $egressCounts, $thirtyDaysAgo) {
            $userLifecycles = $lifecycles->get($userId);
            $installedEvent = $userLifecycles?->firstWhere('event', 'installed');
            $uninstalledEvent = $userLifecycles?->where('event', 'uninstalled')->last();
            $latestLifecycle = $userLifecycles?->last();

            $visitStat = $visitCounts->get($userId);
            $egressStat = $egressCounts->get($userId);

            // Determine earliest registration date
            $registeredAt = $installedEvent->occurred_at
                ?? $userLifecycles?->first()->occurred_at
                ?? $visitStat->first_visited
                ?? $egressStat->first_egress
                ?? now();

            // Determine latest active date
            $dates = array_filter([
                $latestLifecycle?->occurred_at,
                $visitStat?->last_visited,
                $egressStat?->last_egress,
            ]);
            $lastActiveAt = ! empty($dates) ? max($dates) : $registeredAt;

            // Status: Active if not uninstalled and active recently
            $isUninstalled = $uninstalledEvent && (! $latestLifecycle || $latestLifecycle->id === $uninstalledEvent->id);
            $isActive = ! $isUninstalled && $lastActiveAt >= $thirtyDaysAgo;

            return [
                'id' => $index + 1,
                'user_id' => $userId,
                'client_name' => $userId,
                'registered_at' => $registeredAt ? (string) $registeredAt : null,
                'last_active_at' => $lastActiveAt ? (string) $lastActiveAt : null,
                'status' => $isActive ? 'active' : ($isUninstalled ? 'uninstalled' : 'inactive'),
                'version' => $latestLifecycle->version ?? 'v1.0.0',
                'total_visits' => (int) ($visitStat->total ?? 0),
                'total_egress' => (int) ($egressStat->total ?? 0),
            ];
        })->sortByDesc('registered_at')->values()->all();

        // Re-assign 1-based sequential indices after sorting
        foreach ($clients as $i => &$client) {
            $client['id'] = $i + 1;
        }
        unset($client);

        return Inertia::render('users/client', [
            'clients' => $clients,
        ]);
    }

    /**
     * Get detailed telemetry logs for a specific client, with daily aggregates.
     */
    public function show(string $userId, Request $request): JsonResponse
    {
        $filters = $this->resolveRangeFilters($request);
        $data = $this->resolveTelemetry($userId, $filters['from'], $filters['to'], (int) $filters['limit']);

        return response()->json(array_merge(
            ['user_id' => $userId, 'date_from' => $filters['from']->toDateString(), 'date_to' => $filters['to']->toDateString()],
            $data,
        ));
    }

    /**
     * Render the dedicated per-user daily telemetry page.
     */
    public function telemetry(string $userId, Request $request): Response
    {
        $filters = $this->resolveRangeFilters($request);
        $data = $this->resolveTelemetry($userId, $filters['from'], $filters['to'], (int) $filters['limit']);

        return Inertia::render('users/client-show', array_merge(
            ['date_from' => $filters['from']->toDateString(), 'date_to' => $filters['to']->toDateString()],
            $data,
        ));
    }

    /**
     * Validate and normalize the date range + timeline limit query params.
     *
     * @return array{from: CarbonInterface, to: CarbonInterface, limit: int}
     */
    private function resolveRangeFilters(Request $request): array
    {
        $validated = $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $to = isset($validated['date_to']) ? Carbon::parse($validated['date_to'])->endOfDay() : now()->endOfDay();
        $from = isset($validated['date_from']) ? Carbon::parse($validated['date_from'])->startOfDay() : $to->copy()->subDays(29)->startOfDay();

        if ($from->greaterThan($to)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }

        if ($from->diffInDays($to) > 89) {
            $from = $to->copy()->subDays(89)->startOfDay();
        }

        return ['from' => $from, 'to' => $to, 'limit' => $validated['limit'] ?? 20];
    }

    /**
     * Build the full per-user telemetry payload: profile, daily series,
     * top domains, risk breakdown, timelines, and lifecycle chain.
     *
     * @return array<string, mixed>
     */
    private function resolveTelemetry(string $userId, CarbonInterface $from, CarbonInterface $to, int $limit): array
    {
        $visitRows = DomainVisit::where('user_id', $userId)
            ->whereBetween('visited_at', [$from, $to])
            ->selectRaw("DATE(visited_at) as d, COUNT(*) as visits, SUM(CASE WHEN status = 'safe' THEN 1 ELSE 0 END) as safe, SUM(CASE WHEN status = 'unsafe' THEN 1 ELSE 0 END) as unsafe, SUM(CASE WHEN status NOT IN ('safe', 'unsafe') THEN 1 ELSE 0 END) as unlisted, COUNT(DISTINCT domain) as domains")
            ->groupByRaw('DATE(visited_at)')
            ->get()
            ->keyBy('d');

        $egressRows = EgressEvent::where('user_id', $userId)
            ->whereBetween('occurred_at', [$from, $to])
            ->selectRaw("DATE(occurred_at) as d, COUNT(*) as egress, SUM(CASE WHEN action = 'denied' THEN 1 ELSE 0 END) as denied, SUM(CASE WHEN action = 'proceeded' THEN 1 ELSE 0 END) as proceeded, SUM(CASE WHEN action = 'allowed' THEN 1 ELSE 0 END) as allowed, SUM(CASE WHEN action = 'blocked' THEN 1 ELSE 0 END) as blocked, AVG(risk_score) as avg_risk, MAX(risk_score) as max_risk")
            ->groupByRaw('DATE(occurred_at)')
            ->get()
            ->keyBy('d');

        $nudgeRows = NudgeInteraction::where('user_id', $userId)
            ->whereBetween('interacted_at', [$from, $to])
            ->selectRaw("DATE(interacted_at) as d, SUM(CASE WHEN user_action = 'cancelled' THEN 1 ELSE 0 END) as cancelled, SUM(CASE WHEN user_action = 'proceeded' THEN 1 ELSE 0 END) as proceeded")
            ->groupByRaw('DATE(interacted_at)')
            ->get()
            ->keyBy('d');

        $dailySeries = [];
        $days = (int) $from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay());
        for ($i = 0; $i <= $days; $i++) {
            $cursor = $from->copy()->startOfDay()->addDays($i);
            $key = $cursor->toDateString();
            $visit = $visitRows->get($key);
            $egress = $egressRows->get($key);
            $nudge = $nudgeRows->get($key);

            $dailySeries[] = [
                'date' => $key,
                'day' => $cursor->format('D'),
                'label' => $cursor->format('D, M j'),
                'visits' => (int) ($visit->visits ?? 0),
                'visits_safe' => (int) ($visit->safe ?? 0),
                'visits_unsafe' => (int) ($visit->unsafe ?? 0),
                'visits_unlisted' => (int) ($visit->unlisted ?? 0),
                'distinct_domains' => (int) ($visit->domains ?? 0),
                'egress' => (int) ($egress->egress ?? 0),
                'egress_denied' => (int) ($egress->denied ?? 0),
                'egress_proceeded' => (int) ($egress->proceeded ?? 0),
                'egress_allowed' => (int) ($egress->allowed ?? 0),
                'egress_blocked' => (int) ($egress->blocked ?? 0),
                'avg_risk' => $egress && $egress->avg_risk !== null ? round((float) $egress->avg_risk, 1) : null,
                'max_risk' => $egress && $egress->max_risk !== null ? (int) $egress->max_risk : null,
                'nudges_cancelled' => (int) ($nudge->cancelled ?? 0),
                'nudges_proceeded' => (int) ($nudge->proceeded ?? 0),
            ];
        }

        $visitTotals = DomainVisit::where('user_id', $userId)
            ->whereBetween('visited_at', [$from, $to])
            ->selectRaw('COUNT(*) as visits, COUNT(DISTINCT domain) as domains')
            ->first();

        $egressTotals = EgressEvent::where('user_id', $userId)
            ->whereBetween('occurred_at', [$from, $to])
            ->selectRaw('COUNT(*) as egress, AVG(risk_score) as avg_risk, MAX(risk_score) as max_risk, SUM(CASE WHEN risk_score >= 70 THEN 1 ELSE 0 END) as high_risk')
            ->first();

        $topVisits = DomainVisit::where('user_id', $userId)
            ->whereBetween('visited_at', [$from, $to])
            ->selectRaw('domain, COUNT(*) as visits')
            ->groupBy('domain')
            ->orderByDesc('visits')
            ->limit(5)
            ->get();

        $topEgress = EgressEvent::where('user_id', $userId)
            ->whereBetween('occurred_at', [$from, $to])
            ->selectRaw('domain, COUNT(*) as egress, AVG(risk_score) as avg_risk')
            ->groupBy('domain')
            ->get()
            ->keyBy('domain');

        $topDomains = $topVisits->map(fn ($row) => [
            'domain' => $row->domain,
            'visits' => (int) $row->visits,
            'egress' => (int) ($topEgress->get($row->domain)->egress ?? 0),
            'avg_risk' => ($avg = $topEgress->get($row->domain)->avg_risk ?? null) !== null ? round((float) $avg, 1) : null,
        ])->values()->all();

        $recentVisits = DomainVisit::where('user_id', $userId)
            ->whereBetween('visited_at', [$from, $to])
            ->orderByDesc('visited_at')
            ->limit(min($limit, 15))
            ->get(['domain', 'visited_at', 'status']);

        $recentEgress = EgressEvent::where('user_id', $userId)
            ->whereBetween('occurred_at', [$from, $to])
            ->orderByDesc('occurred_at')
            ->limit($limit)
            ->get(['domain', 'file_name', 'action', 'risk_score', 'occurred_at']);

        $userVisitedDomains = DomainVisit::where('user_id', $userId)
            ->whereBetween('visited_at', [$from, $to])
            ->select('domain');

        $totalCategorized = DomainPolicy::whereIn('domain', $userVisitedDomains)->count();

        $categoryDistribution = DomainPolicy::whereIn('domain', $userVisitedDomains)
            ->select(
                DB::raw("COALESCE(NULLIF(category, ''), 'General Cloud') as category_name"),
                DB::raw('COUNT(*) as count'),
                DB::raw('ROUND(AVG(risk_score)) as avg_risk')
            )
            ->groupByRaw("COALESCE(NULLIF(category, ''), 'General Cloud')")
            ->orderByDesc('count')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'category' => $row->category_name,
                'count' => (int) $row->count,
                'percentage' => $totalCategorized > 0 ? round(((int) $row->count / $totalCategorized) * 100) : 0,
                'avgRisk' => (int) $row->avg_risk,
            ]);

        return [
            'profile' => $this->resolveProfile($userId),
            'summary' => [
                'visits' => (int) ($visitTotals->visits ?? 0),
                'distinct_domains' => (int) ($visitTotals->domains ?? 0),
                'egress' => (int) ($egressTotals->egress ?? 0),
                'active_days' => collect($dailySeries)->where(fn ($d) => $d['visits'] > 0 || $d['egress'] > 0)->count(),
            ],
            'daily_series' => $dailySeries,
            'top_domains' => $topDomains,
            'risk_breakdown' => [
                'avg_risk' => $egressTotals && $egressTotals->avg_risk !== null ? round((float) $egressTotals->avg_risk, 1) : null,
                'max_risk' => $egressTotals && $egressTotals->max_risk !== null ? (int) $egressTotals->max_risk : null,
                'high_risk_egress_count' => (int) ($egressTotals->high_risk ?? 0),
            ],
            'recent_visits' => $recentVisits,
            'recent_egress' => $recentEgress,
            'category_distribution' => $categoryDistribution,
        ];
    }

    /**
     * Derive the lifetime profile header for a single user id.
     *
     * @return array<string, mixed>
     */
    private function resolveProfile(string $userId): array
    {
        $thirtyDaysAgo = now()->subDays(30);

        $userLifecycles = ExtensionLifecycle::where('user_id', $userId)->orderBy('occurred_at')->get();
        $installedEvent = $userLifecycles->firstWhere('event', 'installed');
        $uninstalledEvent = $userLifecycles->where('event', 'uninstalled')->last();
        $latestLifecycle = $userLifecycles->last();

        $visitStat = DB::table('domain_visits')->where('user_id', $userId)
            ->selectRaw('count(*) as total, max(visited_at) as last_visited, min(visited_at) as first_visited')
            ->first();

        $egressStat = DB::table('egress_events')->where('user_id', $userId)
            ->selectRaw('count(*) as total, max(occurred_at) as last_egress, min(occurred_at) as first_egress')
            ->first();

        $registeredAt = $installedEvent?->occurred_at
            ?? $userLifecycles->first()?->occurred_at
            ?? $visitStat?->first_visited
            ?? $egressStat?->first_egress
            ?? now();

        $dates = array_filter([
            $latestLifecycle?->occurred_at,
            $visitStat?->last_visited,
            $egressStat?->last_egress,
        ]);
        $lastActiveAt = ! empty($dates) ? max($dates) : $registeredAt;

        $isUninstalled = $uninstalledEvent && (! $latestLifecycle || $latestLifecycle->id === $uninstalledEvent->id);
        $isActive = ! $isUninstalled && $lastActiveAt >= $thirtyDaysAgo;

        return [
            'user_id' => $userId,
            'client_name' => $userId,
            'registered_at' => $registeredAt ? (string) $registeredAt : null,
            'last_active_at' => $lastActiveAt ? (string) $lastActiveAt : null,
            'status' => $isActive ? 'active' : ($isUninstalled ? 'uninstalled' : 'inactive'),
            'version' => $latestLifecycle?->version ?? 'v1.0.0',
            'total_visits' => (int) ($visitStat->total ?? 0),
            'total_egress' => (int) ($egressStat->total ?? 0),
        ];
    }
}
