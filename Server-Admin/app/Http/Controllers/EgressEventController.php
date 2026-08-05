<?php

namespace App\Http\Controllers;

use App\Models\EgressEvent;
use App\Models\NudgeInteraction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'action' => 'required|in:proceeded,denied',
            'user_action' => 'required|in:proceeded,cancelled',
        ]);

        $egressEvent = EgressEvent::create([
            'domain' => $validated['domain'],
            'user_id' => $validated['user_id'],
            'file_name' => $validated['file_name'],
            'file_size' => $validated['file_size'] ?? 0,
            'risk_score' => $validated['risk_score'],
            'action' => $validated['action'],
            'occurred_at' => now(),
        ]);

        NudgeInteraction::create([
            'egress_event_id' => $egressEvent->id,
            'domain' => $validated['domain'],
            'user_id' => $validated['user_id'],
            'user_action' => $validated['user_action'],
            'interacted_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'egress_event_id' => $egressEvent->id,
        ]);
    }
}
