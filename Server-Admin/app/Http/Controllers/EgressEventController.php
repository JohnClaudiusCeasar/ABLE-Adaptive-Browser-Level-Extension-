<?php

namespace App\Http\Controllers;

use App\Concerns\BoundsAdminRows;
use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\NudgeInteraction;
use App\Support\EgressAuditPolicy;
use App\Support\ScanToken;
use App\Support\SyntheticFileName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class EgressEventController extends Controller
{
    use BoundsAdminRows;

    /**
     * Display the Egress Logs page with live data.
     */
    public function index(): Response
    {
        $limit = $this->rowLimit();

        $egressEvents = EgressEvent::orderByDesc('occurred_at')
            ->limit($limit)
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
                    'occurred_at' => $event->occurred_at->toIso8601String(),
                    'domain' => $event->domain,
                    'status' => $status,
                    'user' => $event->user_id,
                    'fileName' => $event->file_name,
                    'fileSize' => $event->file_size,
                    'risk_score' => $event->risk_score ?? 0,
                    'action' => $action,
                ];
            });

        return Inertia::render('egress-logs', [
            'egressEvents' => $egressEvents,
            'truncated' => $egressEvents->count() >= $limit,
            'rowLimit' => $limit,
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
            'action' => 'required|in:proceeded,denied,allowed,blocked',
            'user_action' => 'nullable|in:proceeded,cancelled,allowed,typing',
            // Read to tell a typed-text event from a file upload. It is not
            // persisted: the table blueprint stays as it is.
            'source' => 'nullable|string|max:255',
            'occurred_at' => 'nullable|numeric',
            'flagged_items' => 'nullable|string',
            'content_hash' => 'nullable|string',
            'event_id' => 'nullable|string|max:255',
            'scan_token' => 'nullable|string',
            'name_source' => 'nullable|in:user,page,synthetic',
        ]);

        // Skip excluded domains (defense-in-depth)
        if (in_array($validated['domain'], config('able.excluded_domains', []))) {
            return response()->json(['success' => true, 'egress_event_id' => null]);
        }

        // A placeholder file name is not an egress incident. The extension
        // fabricates one from the MIME type when it cannot recover the user's
        // real file name, and nothing was uploaded behind it — auditing it
        // would report a file that does not exist and pollute the incident
        // list with a MIME type dressed up as a file name.
        //
        // The client marks the names it knows are synthetic. A name recovered
        // from the user's own file selection is always audited, even when it
        // happens to look like a placeholder — the user may genuinely have a
        // file called "upload.csv". Older clients that send no marker fall
        // back to the name itself.
        $nameSource = $validated['name_source'] ?? null;
        if ($nameSource === 'synthetic'
            || ($nameSource !== 'user' && SyntheticFileName::isPlaceholder($validated['file_name']))) {
            return response()->json(['success' => true, 'egress_event_id' => null, 'skipped' => true]);
        }

        // A valid scan token carries the server-computed verdict from
        // /api/score-content; its score and flagged items are authoritative and
        // override whatever the client supplied.
        $flaggedItems = null;
        $scanClaims = ScanToken::verify($validated['scan_token'] ?? null);
        if ($scanClaims !== null && ($scanClaims['domain'] ?? null) === $validated['domain']) {
            $validated['risk_score'] = (int) $scanClaims['total_score'];
            if (isset($scanClaims['flagged_items']) && is_array($scanClaims['flagged_items'])) {
                $flaggedItems = $scanClaims['flagged_items'];
            }
        }

        // Typed text is not a file upload. It is audited only when the text
        // itself carried a detected risk: the scan token's pattern score is
        // the content score the scoring service computed from the matched
        // patterns alone, and the domain's own risk score is not part of it.
        //
        // The token is the proof that the server really scored that text for
        // that domain — a client cannot forge one, so routine typing, a stale
        // queued event or a forged POST cannot manufacture a text incident.
        if (EgressAuditPolicy::isTextIntercept(
            $validated['source'] ?? null,
            $validated['file_name'],
            $validated['user_action'] ?? null,
        )) {
            // Expiry is tolerated here: an event queued while the server was
            // unreachable can flush hours later, and the signature still
            // proves the verdict.
            $claims = ScanToken::verify($validated['scan_token'] ?? null, allowExpired: true);

            if ($claims === null || ($claims['domain'] ?? null) !== $validated['domain']) {
                return response()->json([
                    'success' => true,
                    'egress_event_id' => null,
                    'skipped' => true,
                    'reason' => 'unverified_scan',
                ]);
            }

            if (! EgressAuditPolicy::isHighRisk($claims)) {
                return response()->json([
                    'success' => true,
                    'egress_event_id' => null,
                    'skipped' => true,
                    'reason' => 'not_high_risk',
                ]);
            }

            // The server's own score and patterns are authoritative, even when
            // the token expired in the queue.
            $validated['risk_score'] = (int) $claims['total_score'];
            if (isset($claims['flagged_items']) && is_array($claims['flagged_items'])) {
                $flaggedItems = $claims['flagged_items'];
            }
        }

        // Validate flagged_items JSON shape (client-supplied fallback when no token)
        if ($flaggedItems === null && isset($validated['flagged_items'])) {
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
        $eventId = $validated['event_id'] ?? null;

        // Idempotency: a client-provided event_id is unique, so a retry of the
        // same logical event (e.g. after an offline reconnect) is a duplicate.
        if ($eventId && EgressEvent::where('event_id', $eventId)->exists()) {
            return response()->json(['success' => true, 'egress_event_id' => null, 'duplicate' => true]);
        }

        // The visit, the egress event and the nudge are written together, so a
        // failure part way through cannot leave a visit logged without the
        // event that caused it.
        return DB::transaction(function () use ($validated, $flaggedItems, $eventId, $occurredAt) {
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
                    'status' => $policy->domain_status ?? 'unlisted',
                    'risk_score' => $policy->risk_score,
                    'user_id' => $validated['user_id'] ?? null,
                    'visited_at' => now(),
                ]);
            }

            // Dedup: one logical event within 60 seconds. When the earlier row was
            // logged without scan data (fallback/timeout paths) and this event
            // carries the scanned verdict, upgrade the stored row instead of
            // silently dropping the pattern data.
            $contentHash = $validated['content_hash'] ?? null;
            $existing = EgressEvent::where('domain', $validated['domain'])
                ->where('file_name', $validated['file_name'])
                ->where('action', $validated['action'])
                ->where('occurred_at', '>=', now()->subSeconds(60))
                ->when($contentHash, function ($q) use ($contentHash) {
                    $q->where(function ($q2) use ($contentHash) {
                        $q2->where('content_hash', $contentHash)->orWhereNull('content_hash');
                    });
                })
                ->orderByDesc('occurred_at')
                ->first();

            if ($existing) {
                if ($flaggedItems !== null && $existing->flagged_items === null) {
                    $existing->update([
                        'risk_score' => $validated['risk_score'],
                        'flagged_items' => $flaggedItems,
                        'content_hash' => $existing->content_hash ?? $contentHash,
                    ]);

                    return response()->json([
                        'success' => true,
                        'egress_event_id' => $existing->id,
                        'duplicate' => false,
                        'upgraded' => true,
                    ]);
                }

                return response()->json(['success' => true, 'egress_event_id' => null, 'duplicate' => true]);
            }

            $egressEvent = EgressEvent::create([
                'domain' => $validated['domain'],
                'user_id' => $validated['user_id'],
                'file_name' => $validated['file_name'],
                'file_size' => $validated['file_size'] ?? 0,
                'risk_score' => $validated['risk_score'],
                'action' => $validated['action'],
                'event_id' => $eventId,
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
                'duplicate' => false,
            ]);
        });
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

        $events = $query->with('nudgeInteractions')
            ->orderByDesc('occurred_at')
            ->limit(min(100, max(1, (int) $request->input('limit', 100))))
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
