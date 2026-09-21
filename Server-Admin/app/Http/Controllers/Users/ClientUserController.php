<?php

namespace App\Http\Controllers\Users;

use App\Http\Controllers\Controller;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use Illuminate\Http\JsonResponse;
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
        $visitCounts = DomainVisit::whereIn('user_id', $allUserIds)
            ->selectRaw('user_id, count(*) as total, max(visited_at) as last_visited, min(visited_at) as first_visited')
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        // Preload egress counts and latest activity
        $egressCounts = EgressEvent::whereIn('user_id', $allUserIds)
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
            $registeredAt = $installedEvent?->occurred_at
                ?? $userLifecycles?->first()?->occurred_at
                ?? $visitStat?->first_visited
                ?? $egressStat?->first_egress
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
                'version' => $latestLifecycle?->version ?? 'v1.0.0',
                'total_visits' => (int) ($visitStat?->total ?? 0),
                'total_egress' => (int) ($egressStat?->total ?? 0),
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
     * Get detailed telemetry logs for a specific client.
     */
    public function show(string $userId): JsonResponse
    {
        $recentVisits = DomainVisit::where('user_id', $userId)
            ->orderByDesc('visited_at')
            ->limit(10)
            ->get(['domain', 'visited_at', 'status']);

        $recentEgress = EgressEvent::where('user_id', $userId)
            ->orderByDesc('occurred_at')
            ->limit(10)
            ->get(['domain', 'file_name', 'action', 'risk_score', 'occurred_at']);

        $lifecycles = ExtensionLifecycle::where('user_id', $userId)
            ->orderByDesc('occurred_at')
            ->get(['event', 'version', 'occurred_at']);

        return response()->json([
            'user_id' => $userId,
            'recent_visits' => $recentVisits,
            'recent_egress' => $recentEgress,
            'lifecycles' => $lifecycles,
        ]);
    }
}
