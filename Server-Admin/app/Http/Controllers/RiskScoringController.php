<?php

namespace App\Http\Controllers;

use App\Models\RiskPattern;
use App\Services\RiskScoringService;
use App\Support\DomainRiskResolver;
use App\Support\JsCanonical;
use App\Support\ScanToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Server-authoritative content scoring for the browser extension.
 *
 * The extension extracts text locally and POSTs it here; the server runs the
 * full regex scoring algorithm (RiskScoringService, including the per-pattern
 * regex modifiers) against its own database patterns and returns an HMAC-signed
 * verdict plus a scan_token the extension replays on /api/log-egress.
 *
 * Unscannable content (text = null, e.g. PDF/OLE/images) still receives the
 * server-computed domain risk baseline — it is never scored 0 by default.
 */
class RiskScoringController extends Controller
{
    public function score(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string|max:255',
            'text' => 'nullable|string|max:200000',
            'file_name' => 'nullable|string|max:255',
            'file_size' => 'nullable|integer|min:0',
            'file_type' => 'nullable|string|max:20',
            'file_format' => 'nullable|string|max:20',
            'content_hash' => 'nullable|string|max:128',
            'page_context' => 'nullable|array',
            'event_id' => 'nullable|string|max:255',
        ]);

        $domainRisk = app(DomainRiskResolver::class)->resolve($validated['domain']);

        // Pattern scoring (layers 1-5) against the server's own database patterns.
        $patternScore = 0;
        $flagged = [];
        $suppressed = [];
        $text = $validated['text'] ?? null;
        if (is_string($text) && $text !== '') {
            $patterns = RiskPattern::with('criteriaPatternItems')->get()->toArray();
            $result = app(RiskScoringService::class)->score(
                $text,
                $patterns,
                is_array($validated['page_context'] ?? null) ? $validated['page_context'] : null,
            );
            $patternScore = $result['pattern_score'];
            $flagged = $result['flagged_items'];
            $suppressed = $result['suppressed'];
        }

        // (6) File-type heuristic multiplier on the pattern score only.
        $fileTypeMult = app(RiskScoringService::class)->fileTypeMultiplier(
            $validated['file_type'] ?? null,
            $validated['file_format'] ?? null,
        );
        $adjustedPatternScore = $fileTypeMult !== 1.0
            ? min(100, (int) round($patternScore * $fileTypeMult))
            : $patternScore;

        $domainRiskScore = $domainRisk['risk_score'];
        $totalScore = min(100, $domainRiskScore + $adjustedPatternScore);

        $flaggedItems = [];
        if ($domainRiskScore > 0) {
            $flaggedItems[] = [
                'label' => 'Domain Risk ('.($domainRisk['status'] === 'unlisted' ? 'Unlisted' : 'Unsafe').')',
                'count' => 1,
                'weight' => $domainRiskScore,
            ];
        }
        foreach ($flagged as $item) {
            $flaggedItems[] = $item;
        }

        $key = $this->signingKey();
        $keyVersion = (int) config('able.signing_key_version', 1);

        $payload = [
            'total_score' => $totalScore,
            'pattern_score' => $adjustedPatternScore,
            'domain_risk_score' => $domainRiskScore,
            'domain_status' => $domainRisk['status'],
            'flagged_items' => $flaggedItems,
            'scored_at' => now()->timestamp,
            'issued_at' => now()->timestamp,
        ];

        $scanToken = ScanToken::issue([
            'total_score' => $totalScore,
            'pattern_score' => $adjustedPatternScore,
            'domain_risk_score' => $domainRiskScore,
            'flagged_items' => $flaggedItems,
            'domain' => $domainRisk['domain'],
            'content_hash' => $validated['content_hash'] ?? null,
            'event_id' => $validated['event_id'] ?? null,
            'exp' => now()->addHour()->timestamp,
        ]);

        return response()->json([
            'payload' => $payload,
            'signature' => JsCanonical::sign($payload, $key),
            'key_version' => $keyVersion,
            'scan_token' => $scanToken,
            'file_type_multiplier' => $fileTypeMult,
            'suppressed' => $suppressed,
        ]);
    }

    private function signingKey(): string
    {
        $key = config('able.signing_key');
        if (! $key || strlen($key) < 32) {
            abort(500, 'ABLE signing key not configured');
        }

        return $key;
    }
}
