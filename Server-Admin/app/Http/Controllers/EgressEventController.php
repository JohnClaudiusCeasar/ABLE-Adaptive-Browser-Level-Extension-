<?php

namespace App\Http\Controllers;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\NudgeInteraction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class EgressEventController extends Controller
{
    /**
     * Display the Egress Logs page with live data.
     */
    public function index(): Response
    {
        $egressEvents = EgressEvent::orderByDesc('occurred_at')
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
                    'fileSize' => $event->file_size,
                    'action' => ucfirst($event->action),
                ];
            });

        return Inertia::render('egress-logs', [
            'egressEvents' => $egressEvents,
        ]);
    }

    /**
     * Log an egress event from the client extension.
     */
    public function logEgress(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string',
            'user_id' => 'required|string',
            'file_name' => 'required|string',
            'file_size' => 'integer|min:0',
            'risk_score' => 'required|integer|min:0|max:100',
            'action' => 'required|in:proceeded,denied,allowed',
            'user_action' => 'nullable|in:proceeded,cancelled,allowed',
            'occurred_at' => 'nullable|numeric',
            'flagged_items' => 'nullable|string',
            'content_hash' => 'nullable|string',
        ]);

        // Skip excluded domains (defense-in-depth)
        if (in_array($validated['domain'], config('able.excluded_domains', []))) {
            return response()->json(['success' => true, 'egress_event_id' => null]);
        }

        // Validate flagged_items JSON shape
        $flaggedItems = null;
        if (isset($validated['flagged_items'])) {
            $decoded = json_decode($validated['flagged_items'], true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return response()->json(['success' => false, 'error' => 'Invalid flagged_items JSON'], 422);
            }
            if (is_array($decoded)) {
                foreach ($decoded as $item) {
                    if (! is_array($item) || ! isset($item['label']) || ! isset($item['count']) || ! isset($item['weight'])) {
                        return response()->json(['success' => false, 'error' => 'Invalid flagged_items shape'], 422);
                    }
                }
                $flaggedItems = $decoded;
            }
        }

        $occurredAt = $validated['occurred_at'] ?? null;

        // Auto-create domain policy if it doesn't exist
        $policy = DomainPolicy::firstOrCreate(
            ['domain' => $validated['domain']],
            [
                'domain_status' => 'unlisted',
                'policy' => 'under_review',
                'risk_score' => 70,
            ]
        );

        // Correlate with visit: log a DomainVisit if none in last 5 minutes
        $fiveMinutesAgo = now()->subMinutes(5);
        $recentVisit = DomainVisit::where('domain', $validated['domain'])
            ->where('visited_at', '>=', $fiveMinutesAgo)
            ->exists();

        if (! $recentVisit) {
            DomainVisit::create([
                'domain_policy_id' => $policy->id,
                'domain' => $validated['domain'],
                'user_id' => $validated['user_id'] ?? null,
                'visited_at' => now(),
            ]);
        }

        // Dedup: check for duplicate egress event within 60 seconds
        $contentHash = $validated['content_hash'] ?? null;
        $exists = EgressEvent::where('domain', $validated['domain'])
            ->where('file_name', $validated['file_name'])
            ->where('action', $validated['action'])
            ->where('occurred_at', '>=', now()->subSeconds(60))
            ->when($contentHash, function ($q) use ($contentHash) {
                $q->where('content_hash', $contentHash);
            })
            ->exists();

        if ($exists) {
            return response()->json(['success' => true, 'egress_event_id' => null, 'duplicate' => true]);
        }

        $egressEvent = EgressEvent::create([
            'domain' => $validated['domain'],
            'user_id' => $validated['user_id'],
            'file_name' => $validated['file_name'],
            'file_size' => $validated['file_size'] ?? 0,
            'risk_score' => $validated['risk_score'],
            'action' => $validated['action'],
            'flagged_items' => $flaggedItems,
            'content_hash' => $contentHash,
            'occurred_at' => $occurredAt
                ? Carbon::createFromTimestampMs($occurredAt)
                : now(),
        ]);

        if (! empty($validated['user_action'])) {
            NudgeInteraction::create([
                'egress_event_id' => $egressEvent->id,
                'domain' => $validated['domain'],
                'user_id' => $validated['user_id'],
                'user_action' => $validated['user_action'],
                'interacted_at' => now(),
            ]);
        }

        return response()->json([
            'success' => true,
            'egress_event_id' => $egressEvent->id,
        ]);
    }

    /**
     * API endpoint: Get egress events with filtering.
     */
    public function getEgressEvents(Request $request): JsonResponse
    {
        $query = EgressEvent::query();

        if ($request->filled('domain')) {
            $query->where('domain', $request->input('domain'));
        }

        if ($request->filled('date_from')) {
            $query->where('occurred_at', '>=', Carbon::parse($request->input('date_from')));
        }

        if ($request->filled('date_to')) {
            $query->where('occurred_at', '<=', Carbon::parse($request->input('date_to')));
        }

        if ($request->filled('risk_score_min')) {
            $query->where('risk_score', '>=', $request->input('risk_score_min'));
        }

        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        $events = $query->orderByDesc('occurred_at')
            ->limit($request->input('limit', 100))
            ->get()
            ->map(function ($event) {
                return [
                    'id' => $event->id,
                    'occurred_at' => $event->occurred_at->toIso8601String(),
                    'domain' => $event->domain,
                    'file_name' => $event->file_name,
                    'file_size' => $event->file_size,
                    'risk_score' => $event->risk_score,
                    'action' => $event->action,
                    'user_action' => $event->nudgeInteractions->last()?->user_action,
                    'flagged_items' => $event->flagged_items,
                    'content_hash' => $event->content_hash,
                ];
            });

        return response()->json([
            'success' => true,
            'events' => $events,
            'count' => $events->count(),
        ]);
    }

    /**
     * Delete a single egress event.
     */
    public function destroy(EgressEvent $egressEvent): JsonResponse
    {
        $egressEvent->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Delete all egress events.
     */
    public function destroyAll(): JsonResponse
    {
        EgressEvent::query()->delete();

        return response()->json(['success' => true]);
    }
}
