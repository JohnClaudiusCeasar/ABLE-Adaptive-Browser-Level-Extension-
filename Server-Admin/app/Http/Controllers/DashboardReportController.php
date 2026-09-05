<?php

namespace App\Http\Controllers;

use App\Exports\DashboardExport;
use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\NudgeInteraction;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response as HttpResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DashboardReportController extends Controller
{
    public function pdf(): HttpResponse
    {
        $data = $this->getReportData();

        $pdf = Pdf::loadView('reports.dashboard', $data)
            ->setPaper('a4', 'portrait')
            ->setOptions([
                'defaultFont' => 'Helvetica',
                'isRemoteEnabled' => false,
            ]);

        return $pdf->download('able-security-report-'.now()->format('Y-m-d').'.pdf');
    }

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

        // Data Saved/Lost
        /** @var object{data_saved: int, data_lost: int} $dataStats */
        $dataStats = EgressEvent::selectRaw("
            COALESCE(SUM(CASE WHEN action = 'denied' THEN file_size ELSE 0 END), 0) as data_saved,
            COALESCE(SUM(CASE WHEN action = 'proceeded' THEN file_size ELSE 0 END), 0) as data_lost
        ")->first();

        // Nudge Success Rate
        /** @var object{proceeded: int, cancelled: int} $nudgeStats */
        $nudgeStats = NudgeInteraction::selectRaw("
            SUM(CASE WHEN user_action = 'proceeded' THEN 1 ELSE 0 END) as proceeded,
            SUM(CASE WHEN user_action = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        ")->first();
        $totalInteractions = (int) $nudgeStats->proceeded + (int) $nudgeStats->cancelled;
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
            'safe' => (int) $statusCounts->safe,
            'unsafe' => (int) $statusCounts->unsafe,
            'unlisted' => (int) $statusCounts->unlisted,
        ];

        // Recent Egress Events (20 for reports)
        $recentEgressEvents = EgressEvent::orderByDesc('occurred_at')
            ->limit(20)
            ->get()
            ->map(function ($event) {
                $status = $event->risk_score >= 90 ? 'glass-unsafe' : 'glass-unlisted';

                return [
                    'occurred_at' => $event->occurred_at->toIso8601String(),
                    'domain' => $event->domain,
                    'status' => $status,
                    'user' => $event->user_id,
                    'fileName' => $event->file_name,
                    'action' => ucfirst($event->action),
                ];
            })->toArray();

        // Recent Domain Visits (20 for reports)
        $recentDomainVisits = DomainVisit::with('domainPolicy')
            ->orderByDesc('visited_at')
            ->limit(20)
            ->get()
            ->map(function ($visit) {
                $status = match ($visit->domainPolicy?->domain_status) {
                    'safe' => 'glass-safe',
                    'unsafe' => 'glass-unsafe',
                    default => 'glass-unlisted',
                };

                $actionMap = [
                    'glass-safe' => 'Allowed',
                    'glass-unsafe' => 'Blocked',
                    'glass-unlisted' => 'Warned',
                ];

                return [
                    'visited_at' => $visit->visited_at->toIso8601String(),
                    'url' => $visit->domain,
                    'domain' => $visit->domain,
                    'status' => $status,
                    'user' => $visit->user_id,
                    'action' => $actionMap[$status],
                ];
            })->toArray();

        return [
            'activeUsers' => $activeUsers,
            'inactiveUsers' => $inactiveUsers,
            'totalDomainVisits' => $totalDomainVisits,
            'totalEgressAttempts' => $totalEgressAttempts,
            'dataSaved' => $this->formatBytes((int) $dataStats->data_saved),
            'dataLost' => $this->formatBytes((int) $dataStats->data_lost),
            'nudgeSuccessRate' => $nudgeSuccessRate,
            'domainUsage' => $domainUsage,
            'recentEgressEvents' => $recentEgressEvents,
            'recentDomainVisits' => $recentDomainVisits,
            'summary' => [
                'activeUsers' => $activeUsers,
                'inactiveUsers' => $inactiveUsers,
                'totalDomainVisits' => $totalDomainVisits,
                'totalEgressAttempts' => $totalEgressAttempts,
                'dataSaved' => $this->formatBytes((int) $dataStats->data_saved),
                'dataLost' => $this->formatBytes((int) $dataStats->data_lost),
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
