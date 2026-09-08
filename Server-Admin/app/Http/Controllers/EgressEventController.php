<?php

namespace App\Http\Controllers;

use App\Models\DomainPolicy;
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
        ]);

        // Skip excluded domains (defense-in-depth)
        if (in_array($validated['domain'], config('able.excluded_domains', []))) {
            return response()->json(['success' => true, 'egress_event_id' => null]);
        }

        $occurredAt = $validated['occurred_at'] ?? null;

        // Auto-create domain policy if it doesn't exist
        DomainPolicy::firstOrCreate(
            ['domain' => $validated['domain']],
            [
                'domain_status' => 'unlisted',
                'policy' => 'under_review',
                'risk_score' => 70,
            ]
        );

        $egressEvent = EgressEvent::create([
            'domain' => $validated['domain'],
            'user_id' => $validated['user_id'],
            'file_name' => $validated['file_name'],
            'file_size' => $validated['file_size'] ?? 0,
            'risk_score' => $validated['risk_score'],
            'action' => $validated['action'],
            // The extension sends flagged_items as a JSON string; decode it so
            // the model's array cast re-encodes it cleanly (a raw string would
            // be double-encoded).
            'flagged_items' => isset($validated['flagged_items'])
                ? json_decode($validated['flagged_items'], true)
                : null,
            'occurred_at' => $occurredAt
                ? Carbon::createFromTimestampMs($occurredAt)
                : now(),
        ]);

        if (!empty($validated['user_action'])) {
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
