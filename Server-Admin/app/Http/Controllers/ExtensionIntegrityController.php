<?php

namespace App\Http\Controllers;

use App\Models\ExtensionIntegrityEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Integrity telemetry from the extension guard.
 *
 * A tamper signal is deliberately not an egress event: nothing left the
 * browser, no file was involved, and the score is not a content verdict. It
 * has its own table so the Egress Logs and incident counts stay about data
 * transfers only.
 */
class ExtensionIntegrityController extends Controller
{
    /**
     * Log a guard-tamper signal from the extension.
     */
    public function logIntegrity(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|string|max:255',
            'domain' => 'nullable|string|max:255',
            'reason' => 'nullable|string|max:255',
            'extension_id' => 'nullable|string|max:255',
            'version' => 'nullable|string|max:50',
            'event_id' => 'nullable|string|max:255',
            'occurred_at' => 'nullable|numeric',
        ]);

        $domain = $validated['domain'] ?? null;

        // Skip excluded domains (defense-in-depth), matching the egress and
        // visit endpoints: these hosts are not part of the research telemetry.
        if ($domain !== null && in_array($domain, config('able.excluded_domains', []), true)) {
            return response()->json(['success' => true, 'skipped' => true]);
        }

        $eventId = $validated['event_id'] ?? null;

        if ($eventId !== null && ExtensionIntegrityEvent::where('event_id', $eventId)->exists()) {
            return response()->json(['success' => true, 'duplicate' => true]);
        }

        $occurredAt = $validated['occurred_at'] ?? null;

        ExtensionIntegrityEvent::create([
            'user_id' => $validated['user_id'],
            'domain' => $domain,
            'reason' => $validated['reason'] ?? null,
            'extension_id' => $validated['extension_id'] ?? null,
            'version' => $validated['version'] ?? null,
            'event_id' => $eventId,
            'occurred_at' => $occurredAt
                ? Carbon::createFromTimestampMs($occurredAt)
                : now(),
        ]);

        return response()->json(['success' => true]);
    }
}
