<?php

namespace App\Http\Controllers;

use App\Exports\DashboardExport;
use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\NudgeInteraction;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DashboardReportController extends Controller
{
    /**
     * Render the interactive 2x1 Report Preview page with live datasets.
     */
    /**
     * Render the interactive 2x1 Report Preview page with live datasets.
     */
    public function preview(Request $request): Response
    {
        $timezone = $request->input('timezone') ?: config('app.timezone', 'Asia/Manila');
        $previewData = $this->getComprehensiveReportData($timezone);

        return Inertia::render('reports/preview', $previewData);
    }

    /**
     * Export custom PDF based on selected options or defaults.
     */
    public function pdf(Request $request): HttpResponse
    {
        $timezone = $request->input('timezone') ?: config('app.timezone', 'Asia/Manila');
        $data = $this->getComprehensiveReportData($timezone);

        // Optional request filters to pass to blade view
        $sectionsInput = $request->input('sections', []);
        $data['selectedSections'] = [
            'shadowActivity' => filter_var($sectionsInput['shadowActivity'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'domainTemperature' => filter_var($sectionsInput['domainTemperature'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'shadowIncidents' => filter_var($sectionsInput['shadowIncidents'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'containmentTemperature' => filter_var($sectionsInput['containmentTemperature'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'highRiskDomains' => filter_var($sectionsInput['highRiskDomains'] ?? true, FILTER_VALIDATE_BOOLEAN),
        ];

        $timeframesInput = $request->input('timeframes', []);
        $data['timeframes'] = [
            'shadowActivity' => $timeframesInput['shadowActivity'] ?? 'weekly',
            'domainTemperature' => $timeframesInput['domainTemperature'] ?? 'weekly',
            'shadowIncidents' => $timeframesInput['shadowIncidents'] ?? 'weekly',
            'containmentTemperature' => $timeframesInput['containmentTemperature'] ?? 'weekly',
        ];

        $data['highRiskLimit'] = max(1, (int) $request->input('highRiskLimit', 10));
        $data['minRiskScore'] = (int) $request->input('minRiskScore', 75);
        $data['includeExecutiveSummary'] = filter_var($request->input('includeExecutiveSummary', true), FILTER_VALIDATE_BOOLEAN);

        // Filter high risk domains according to minRiskScore and highRiskLimit
        $data['filteredHighRiskDomains'] = array_slice(
            array_values(array_filter($data['highRiskDomains'], fn ($d) => ($d['risk_score'] ?? 0) >= $data['minRiskScore'])),
            0,
            $data['highRiskLimit']
        );

        $paperSize = $request->input('paperSize', 'a4');
        $orientation = $request->input('orientation', 'portrait');

        $pdf = Pdf::loadView('reports.dashboard', $data)
            ->setPaper($paperSize, $orientation)
            ->setOptions([
                'defaultFont' => 'Helvetica',
                'isRemoteEnabled' => true,
                'isHtml5ParserEnabled' => true,
            ]);

        return $pdf->download('able-security-report-'.now($timezone)->format('Y-m-d').'.pdf');
    }

    /**
     * Export CSV report.
     */
    public function excel(): StreamedResponse
    {
        $data = $this->getReportData();

        $export = new DashboardExport(
            $data['summary'],
            $data['recentEgressEvents'],
            $data['recentDomainVisits']
        );

        return $export->download();
    }

    /**
     * Build the complete multi-timeframe dataset for Report Preview.
     *
     * @return array<string, mixed>
     */
    protected function getComprehensiveReportData(?string $timezone = null): array
    {
        $tz = $timezone ?: config('app.timezone', 'Asia/Manila');
        $baseData = $this->getReportData();

        // 1.1 Shadow Activity (Daily, Weekly, Monthly, Yearly)
        $shadowActivity = [
            'daily' => $this->getShadowActivityDaily(),
            'weekly' => $this->getShadowActivityWeekly(),
            'monthly' => $this->getShadowActivityMonthly(),
            'yearly' => $this->getShadowActivityYearly(),
        ];

        // 1.2 Domain Temperature (Daily, Weekly, Monthly, Yearly)
        $domainTemperature = [
            'daily' => $this->getDomainTemperature('daily'),
            'weekly' => $this->getDomainTemperature('weekly'),
            'monthly' => $this->getDomainTemperature('monthly'),
            'yearly' => $this->getDomainTemperature('yearly'),
        ];

        // 1.3 Shadow Incidents (Daily, Weekly, Monthly, Yearly)
        $shadowIncidents = [
            'daily' => $this->getShadowIncidents('daily', $tz),
            'weekly' => $this->getShadowIncidents('weekly', $tz),
            'monthly' => $this->getShadowIncidents('monthly', $tz),
            'yearly' => $this->getShadowIncidents('yearly', $tz),
        ];

        // 1.4 Containment Temperature (Daily, Weekly, Monthly, Yearly)
        $containmentTemperature = [
            'daily' => $this->getContainmentTemperature('daily'),
            'weekly' => $this->getContainmentTemperature('weekly'),
            'monthly' => $this->getContainmentTemperature('monthly'),
            'yearly' => $this->getContainmentTemperature('yearly'),
        ];

        // 1.5 High Risk Domains Catalog
        $highRiskDomains = $this->getHighRiskDomains();

        return array_merge($baseData, [
            'shadowActivity' => $shadowActivity,
            'domainTemperature' => $domainTemperature,
            'shadowIncidents' => $shadowIncidents,
            'containmentTemperature' => $containmentTemperature,
            'highRiskDomains' => $highRiskDomains,
            'reportMeta' => [
                'generatedAt' => now($tz)->format('F j, Y \a\t g:i A'),
                'isoDate' => now($tz)->toIso8601String(),
                'timezone' => $tz,
                'version' => 'ABLE v2.4 Enterprise',
                'classification' => 'RESTRICTED / SECURITY TELEMETRY',
            ],
        ]);
    }

    /**
     * 1.1 Daily Shadow Activity (Last 7 Days)
     *
     * @return array<int, array<string, mixed>>
     */
    protected function getShadowActivityDaily(): array
    {
        $startDate = now()->subDays(6)->startOfDay();
        $visits = DomainVisit::selectRaw('DATE(visited_at) as date, COUNT(*) as count')
            ->where('visited_at', '>=', $startDate)
            ->groupBy('date')
            ->pluck('count', 'date');

        $egress = EgressEvent::selectRaw('DATE(occurred_at) as date, COUNT(*) as count')
            ->where('occurred_at', '>=', $startDate)
            ->groupBy('date')
            ->pluck('count', 'date');

        $result = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $dt = Carbon::parse($date);
            $result[] = [
                'date' => $date,
                'label' => $dt->format('D, M j'),
                'shortLabel' => $dt->format('D'),
                'visits' => (int) ($visits[$date] ?? 0),
                'egress' => (int) ($egress[$date] ?? 0),
            ];
        }

        return $result;
    }

    /**
     * 1.1 Weekly Shadow Activity (Last 8 Weeks)
     *
     * @return array<int, array<string, mixed>>
     */
    protected function getShadowActivityWeekly(): array
    {
        $result = [];
        for ($i = 7; $i >= 0; $i--) {
            $weekStart = now()->subWeeks($i)->startOfWeek();
            $weekEnd = now()->subWeeks($i)->endOfWeek();

            $visitCount = DomainVisit::whereBetween('visited_at', [$weekStart, $weekEnd])->count();
            $egressCount = EgressEvent::whereBetween('occurred_at', [$weekStart, $weekEnd])->count();

            $result[] = [
                'date' => $weekStart->format('Y-m-d'),
                'label' => 'Wk of '.$weekStart->format('M j'),
                'shortLabel' => 'W'.(8 - $i),
                'visits' => $visitCount,
                'egress' => $egressCount,
            ];
        }

        return $result;
    }

    /**
     * 1.1 Monthly Shadow Activity (Last 12 Months)
     *
     * @return array<int, array<string, mixed>>
     */
    protected function getShadowActivityMonthly(): array
    {
        $result = [];
        for ($i = 11; $i >= 0; $i--) {
            $monthStart = now()->subMonths($i)->startOfMonth();
            $monthEnd = now()->subMonths($i)->endOfMonth();

            $visitCount = DomainVisit::whereBetween('visited_at', [$monthStart, $monthEnd])->count();
            $egressCount = EgressEvent::whereBetween('occurred_at', [$monthStart, $monthEnd])->count();

            $result[] = [
                'date' => $monthStart->format('Y-m'),
                'label' => $monthStart->format('F Y'),
                'shortLabel' => $monthStart->format('M'),
                'visits' => $visitCount,
                'egress' => $egressCount,
            ];
        }

        return $result;
    }

    /**
     * 1.1 Yearly Shadow Activity (Last 4 Years)
     *
     * @return array<int, array<string, mixed>>
     */
    protected function getShadowActivityYearly(): array
    {
        $result = [];
        for ($i = 3; $i >= 0; $i--) {
            $yearStart = now()->subYears($i)->startOfYear();
            $yearEnd = now()->subYears($i)->endOfYear();

            $visitCount = DomainVisit::whereBetween('visited_at', [$yearStart, $yearEnd])->count();
            $egressCount = EgressEvent::whereBetween('occurred_at', [$yearStart, $yearEnd])->count();

            $result[] = [
                'date' => $yearStart->format('Y'),
                'label' => $yearStart->format('Y'),
                'shortLabel' => $yearStart->format('Y'),
                'visits' => $visitCount,
                'egress' => $egressCount,
            ];
        }

        return $result;
    }

    /**
     * 1.2 Domain Temperature & Risk Classification
     *
     * @return array<string, mixed>
     */
    protected function getDomainTemperature(string $timeframe): array
    {
        $cutoff = match ($timeframe) {
            'daily' => now()->subDay(),
            'weekly' => now()->subWeeks(4),
            'monthly' => now()->subMonths(6),
            'yearly' => now()->subYears(2),
            default => now()->subWeeks(4),
        };

        $safeCount = DomainPolicy::where('domain_status', 'safe')->count();
        $unsafeCount = DomainPolicy::where('domain_status', 'unsafe')->count();
        $unlistedCount = DomainPolicy::where('domain_status', 'unlisted')->count();
        $total = max(1, $safeCount + $unsafeCount + $unlistedCount);

        $avgRisk = (int) round(DomainPolicy::avg('risk_score') ?? 35);
        $temperatureIndex = $avgRisk >= 75 ? 'Critical' : ($avgRisk >= 45 ? 'Elevated' : 'Nominal');
        $temperatureColor = $avgRisk >= 75 ? '#ff4d4d' : ($avgRisk >= 45 ? '#f59e0b' : '#22c55e');

        $categories = DomainPolicy::select(
            DB::raw("COALESCE(NULLIF(category, ''), 'General Cloud') as category_name"),
            DB::raw('COUNT(*) as count'),
            DB::raw('ROUND(AVG(risk_score)) as avg_risk')
        )
            ->groupBy('category_name')
            ->orderByDesc('count')
            ->limit(5)
            ->get()
            ->map(function ($row) use ($total) {
                return [
                    'category' => $row->category_name,
                    'count' => (int) $row->count,
                    'percentage' => round(((int) $row->count / $total) * 100),
                    'avgRisk' => (int) $row->avg_risk,
                ];
            });

        return [
            'timeframe' => $timeframe,
            'safe' => $safeCount,
            'unsafe' => $unsafeCount,
            'unlisted' => $unlistedCount,
            'safePct' => round(($safeCount / $total) * 100, 1),
            'unsafePct' => round(($unsafeCount / $total) * 100, 1),
            'unlistedPct' => round(($unlistedCount / $total) * 100, 1),
            'averageRisk' => $avgRisk,
            'temperatureIndex' => $temperatureIndex,
            'temperatureColor' => $temperatureColor,
            'categories' => $categories,
        ];
    }

    /**
     * 1.3 Shadow Incidents
     *
     * @return array<int, array<string, mixed>>
     */
    protected function getShadowIncidents(string $timeframe, ?string $timezone = null): array
    {
        $tz = $timezone ?: config('app.timezone', 'Asia/Manila');
        $limit = match ($timeframe) {
            'daily' => 10,
            'weekly' => 20,
            'monthly' => 30,
            'yearly' => 50,
            default => 20,
        };

        $query = EgressEvent::orderByDesc('occurred_at');

        if ($timeframe === 'daily') {
            $query->where('occurred_at', '>=', now($tz)->subDays(2));
        } elseif ($timeframe === 'weekly') {
            $query->where('occurred_at', '>=', now($tz)->subWeeks(2));
        }

        $events = $query->limit($limit)->get();

        if ($events->isEmpty()) {
            $events = EgressEvent::orderByDesc('occurred_at')->limit($limit)->get();
        }

        return $events->map(function (EgressEvent $event) use ($tz) {
            $occurredAt = $event->occurred_at ? $event->occurred_at->copy()->setTimezone($tz) : null;

            return [
                'id' => $event->id,
                'occurred_at' => $event->occurred_at?->toIso8601String() ?? now($tz)->toIso8601String(),
                'dateFormatted' => $occurredAt ? $occurredAt->format('M j, Y g:i A') : '—',
                'domain' => $event->domain,
                'user' => $event->user_id ?? 'Unknown User',
                'fileName' => $event->file_name ?? '—',
                'fileSize' => $event->file_size ? $this->formatBytes($event->file_size) : '0 B',
                'risk_score' => (int) $event->risk_score,
                'action' => ucfirst($event->action),
                'isCritical' => (int) $event->risk_score >= 76,
            ];
        })->toArray();
    }

    /**
     * 1.4 Containment Temperature
     *
     * @return array<string, mixed>
     */
    protected function getContainmentTemperature(string $timeframe): array
    {
        $nudgeQuery = NudgeInteraction::query();

        if ($timeframe === 'daily') {
            $nudgeQuery->where('interacted_at', '>=', now()->subDays(7));
        } elseif ($timeframe === 'weekly') {
            $nudgeQuery->where('interacted_at', '>=', now()->subWeeks(8));
        } elseif ($timeframe === 'monthly') {
            $nudgeQuery->where('interacted_at', '>=', now()->subMonths(12));
        }

        /** @var object{proceeded: int, cancelled: int} $nudgeStats */
        $nudgeStats = $nudgeQuery->selectRaw("
            COALESCE(SUM(CASE WHEN user_action = 'proceeded' THEN 1 ELSE 0 END), 0) as proceeded,
            COALESCE(SUM(CASE WHEN user_action = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled
        ")->first();

        $proceeded = (int) ($nudgeStats->proceeded ?? 0);
        $cancelled = (int) ($nudgeStats->cancelled ?? 0);
        $total = $proceeded + $cancelled;
        $rate = $total > 0 ? round(($cancelled / $total) * 100, 1) : 0;

        /** @var object{data_saved: int, data_lost: int} $dataStats */
        $dataStats = EgressEvent::selectRaw("
            COALESCE(SUM(CASE WHEN action = 'denied' THEN file_size ELSE 0 END), 0) as data_saved,
            COALESCE(SUM(CASE WHEN action IN ('proceeded', 'allowed') THEN file_size ELSE 0 END), 0) as data_lost
        ")->first();

        $statusLabel = $rate >= 80 ? 'Optimal Containment' : ($rate >= 50 ? 'Moderate Protection' : 'Attention Required');
        $statusColor = $rate >= 80 ? '#22c55e' : ($rate >= 50 ? '#f59e0b' : '#ff4d4d');

        return [
            'timeframe' => $timeframe,
            'cancelled' => $cancelled,
            'proceeded' => $proceeded,
            'total' => $total,
            'containmentRate' => $rate,
            'statusLabel' => $statusLabel,
            'statusColor' => $statusColor,
            'dataSaved' => $this->formatBytes((int) ($dataStats->data_saved ?? 0)),
            'dataLost' => $this->formatBytes((int) ($dataStats->data_lost ?? 0)),
        ];
    }

    /**
     * 1.5 High Risk Domains Catalog
     *
     * @return array<int, array<string, mixed>>
     */
    protected function getHighRiskDomains(): array
    {
        return DomainPolicy::select(
            'domain_policies.id',
            'domain_policies.domain',
            'domain_policies.category',
            'domain_policies.risk_score',
            'domain_policies.domain_status',
            'domain_policies.policy',
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
                'domain_policies.visit_count'
            )
            ->orderByDesc('domain_policies.risk_score')
            ->limit(15)
            ->get()
            ->map(function ($row) {
                return [
                    'id' => $row->id,
                    'domain' => $row->domain,
                    'category' => $row->category ?: 'Cloud App',
                    'risk_score' => (int) $row->risk_score,
                    'domain_status' => $row->domain_status,
                    'policy' => $row->policy,
                    'active_users' => (int) $row->active_users,
                    'visit_count' => (int) ($row->visit_count ?: $row->active_users),
                ];
            })
            ->toArray();
    }

    /**
     * Base report statistics.
     *
     * @return array<string, mixed>
     */
    protected function getReportData(): array
    {
        // Active Extension Users
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

        // Inactive Extension Users
        $inactiveUsers = ExtensionLifecycle::select('user_id')
            ->selectRaw('MAX(occurred_at) as last_event_at')
            ->groupBy('user_id')
            ->havingRaw('MAX(CASE WHEN event = ? THEN occurred_at END) = MAX(occurred_at)', ['uninstalled'])
            ->count();

        // Total telemetry counts
        $totalDomainVisits = DomainVisit::count();
        $totalEgressAttempts = EgressEvent::count();
        $criticalEgressCount = EgressEvent::where('risk_score', '>=', 76)->count();

        // Data Saved/Lost
        /** @var object{data_saved: int, data_lost: int} $dataStats */
        $dataStats = EgressEvent::selectRaw("
            COALESCE(SUM(CASE WHEN action = 'denied' THEN file_size ELSE 0 END), 0) as data_saved,
            COALESCE(SUM(CASE WHEN action IN ('proceeded', 'allowed') THEN file_size ELSE 0 END), 0) as data_lost
        ")->first();

        // Nudge Success Rate
        /** @var object{proceeded: int, cancelled: int} $nudgeStats */
        $nudgeStats = NudgeInteraction::selectRaw("
            SUM(CASE WHEN user_action = 'proceeded' THEN 1 ELSE 0 END) as proceeded,
            SUM(CASE WHEN user_action = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        ")->first();
        $totalInteractions = (int) ($nudgeStats->proceeded ?? 0) + (int) ($nudgeStats->cancelled ?? 0);
        $nudgeSuccessRate = $totalInteractions > 0
            ? round(((int) $nudgeStats->cancelled / $totalInteractions) * 100, 1)
            : 0;

        // Domain Usage
        /** @var object{safe: int, unsafe: int, unlisted: int} $statusCounts */
        $statusCounts = DomainPolicy::selectRaw("
            SUM(CASE WHEN domain_status = 'safe' THEN 1 ELSE 0 END) as safe,
            SUM(CASE WHEN domain_status = 'unsafe' THEN 1 ELSE 0 END) as unsafe,
            SUM(CASE WHEN domain_status = 'unlisted' THEN 1 ELSE 0 END) as unlisted
        ")->first();
        $domainUsage = [
            'safe' => (int) ($statusCounts->safe ?? 0),
            'unsafe' => (int) ($statusCounts->unsafe ?? 0),
            'unlisted' => (int) ($statusCounts->unlisted ?? 0),
        ];

        // Recent Egress Events (20 for reports)
        $recentEgressEvents = EgressEvent::orderByDesc('occurred_at')
            ->limit(20)
            ->get()
            ->map(function ($event) {
                if ($event->action === 'allowed') {
                    $status = 'glass-safe';
                } elseif ($event->risk_score >= 90) {
                    $status = 'glass-unsafe';
                } else {
                    $status = 'glass-unlisted';
                }

                if ($status !== 'glass-safe' && ($event->risk_score ?? 0) < 90 && $event->action === 'proceeded') {
                    $action = 'At Risk';
                } elseif ($event->action === 'allowed') {
                    $action = 'Allowed';
                } elseif ($event->action === 'denied') {
                    $action = 'Denied';
                } else {
                    $action = ucfirst($event->action);
                }

                return [
                    'occurred_at' => $event->occurred_at?->toIso8601String() ?? now()->toIso8601String(),
                    'domain' => $event->domain,
                    'status' => $status,
                    'user' => $event->user_id,
                    'fileName' => $event->file_name,
                    'action' => $action,
                ];
            })->toArray();

        // Recent Domain Visits (20 for reports)
        $recentDomainVisits = DomainVisit::with('domainPolicy')
            ->orderByDesc('visited_at')
            ->limit(20)
            ->get()
            ->map(function (DomainVisit $visit) {
                return [
                    'visited_at' => $visit->visited_at?->toIso8601String() ?? now()->toIso8601String(),
                    'url' => $visit->domain,
                    'domain' => $visit->domain,
                    'status' => $visit->glassStatus(),
                    'user' => $visit->user_id,
                    'action' => $visit->actionLabel(),
                ];
            })->toArray();

        return [
            'activeUsers' => $activeUsers,
            'inactiveUsers' => $inactiveUsers,
            'totalDomainVisits' => $totalDomainVisits,
            'totalEgressAttempts' => $totalEgressAttempts,
            'criticalEgressCount' => $criticalEgressCount,
            'dataSaved' => $this->formatBytes((int) ($dataStats->data_saved ?? 0)),
            'dataLost' => $this->formatBytes((int) ($dataStats->data_lost ?? 0)),
            'nudgeSuccessRate' => $nudgeSuccessRate,
            'domainUsage' => $domainUsage,
            'recentEgressEvents' => $recentEgressEvents,
            'recentDomainVisits' => $recentDomainVisits,
            'summary' => [
                'activeUsers' => $activeUsers,
                'inactiveUsers' => $inactiveUsers,
                'totalDomainVisits' => $totalDomainVisits,
                'totalEgressAttempts' => $totalEgressAttempts,
                'criticalEgressCount' => $criticalEgressCount,
                'dataSaved' => $this->formatBytes((int) ($dataStats->data_saved ?? 0)),
                'dataLost' => $this->formatBytes((int) ($dataStats->data_lost ?? 0)),
                'nudgeSuccessRate' => $nudgeSuccessRate,
                'domainUsage' => $domainUsage,
            ],
        ];
    }

    protected function formatBytes(int $bytes): string
    {
        if ($bytes === 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = (int) floor(log($bytes, 1024));

        return round($bytes / (1024 ** $i), 1).' '.$units[$i];
    }
}
