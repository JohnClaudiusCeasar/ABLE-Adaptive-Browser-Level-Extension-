<?php

namespace App\Http\Controllers;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\NudgeInteraction;
use App\Models\User;
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
        // 1. Active/Inactive Users - active = distinct users with a session in the last 30 days
        $activeUsers = (int) DB::table('sessions')
            ->whereNotNull('user_id')
            ->where('last_activity', '>=', now()->subDays(30)->timestamp)
            ->distinct('user_id')
            ->count('user_id');
        $inactiveUsers = max(0, User::count() - $activeUsers);

        // 2. Total telemetry counts
        $totalDomainVisits = DomainVisit::count();
        $totalEgressAttempts = EgressEvent::count();

        // 3. Data Saved/Lost - single conditional aggregation
        $dataStats = EgressEvent::selectRaw("
            COALESCE(SUM(CASE WHEN action = 'denied' THEN file_size ELSE 0 END), 0) as data_saved,
            COALESCE(SUM(CASE WHEN action = 'proceeded' THEN file_size ELSE 0 END), 0) as data_lost
        ")->first();

        // 4. Nudge Success Rate
        $nudgeStats = NudgeInteraction::selectRaw("
            SUM(CASE WHEN user_action = 'proceeded' THEN 1 ELSE 0 END) as proceeded,
            SUM(CASE WHEN user_action = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        ")->first();
        $totalInteractions = (int) $nudgeStats->proceeded + (int) $nudgeStats->cancelled;
        $nudgeSuccessRate = $totalInteractions > 0
            ? round(((int) $nudgeStats->proceeded / $totalInteractions) * 100, 1)
            : 0;

        // 5. Domain Usage - single conditional aggregation
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
                $status = $event->risk_score >= 75 ? 'glass-unsafe' : 'glass-unlisted';

                return [
                    'date' => $event->occurred_at->format('Y-m-d'),
                    'time' => $event->occurred_at->format('g:i A'),
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
                    'date' => $visit->visited_at->format('Y-m-d'),
                    'time' => $visit->visited_at->format('g:i A'),
                    'url' => $visit->domain,
                    'domain' => $visit->domain,
                    'status' => $status,
                    'user' => $visit->user_id,
                    'action' => $actionMap[$status],
                ];
            });

        return Inertia::render('dashboard', [
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
