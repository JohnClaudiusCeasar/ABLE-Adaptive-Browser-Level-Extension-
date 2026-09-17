<?php

namespace App\Http\Controllers;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Services\AbleSettingsService;
use App\Support\DomainBrandMap;
use App\Support\HeuristicClassifier;
use App\Support\JsCanonical;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class DomainPolicyController extends Controller
{
    /**
     * Display a listing of the domain policies.
     */
    public function index(): Response
    {
        $domainPolicies = DomainPolicy::orderBy('created_at', 'desc')->get();

        return Inertia::render('policy-algorithm', [
            'domainPolicies' => $domainPolicies,
        ]);
    }

    /**
     * Store a newly created domain policy.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string|max:255|unique:domain_policies,domain',
            'domain_status' => 'required|in:safe,unsafe,unlisted',
            'policy' => 'required|in:whitelisted,blacklisted,under_review',
            'category' => 'nullable|string|max:255',
            'classification_source' => 'nullable|string|max:50',
            'confidence' => 'nullable|numeric|min:0|max:1',
            'risk_score' => 'required|integer|min:0|max:100',
        ]);

        if (! empty($validated['category']) && empty($validated['classification_source'])) {
            $validated['classification_source'] = 'manual';
        }

        DomainPolicy::create($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Domain policy created successfully.']);

        return Redirect::back();
    }

    /**
     * Update the specified domain policy.
     */
    public function update(Request $request, DomainPolicy $domainPolicy): RedirectResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string|max:255|unique:domain_policies,domain,'.$domainPolicy->id,
            'domain_status' => 'required|in:safe,unsafe,unlisted',
            'policy' => 'required|in:whitelisted,blacklisted,under_review',
            'category' => 'nullable|string|max:255',
            'classification_source' => 'nullable|string|max:50',
            'confidence' => 'nullable|numeric|min:0|max:1',
            'risk_score' => 'required|integer|min:0|max:100',
        ]);

        if (! empty($validated['category']) && empty($validated['classification_source'])) {
            $validated['classification_source'] = 'manual';
        }

        $domainPolicy->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Domain policy updated successfully.']);

        return Redirect::back();
    }

    /**
     * Remove the specified domain policy.
     */
    public function destroy(DomainPolicy $domainPolicy): RedirectResponse
    {
        $domainPolicy->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Domain policy deleted successfully.']);

        return Redirect::back();
    }

    /**
     * Remove all domain policies.
     */
    public function destroyAll(): RedirectResponse
    {
        DomainPolicy::query()->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'All domain policies deleted successfully.']);

        return Redirect::back();
    }

    /**
     * API endpoint: Log a domain visit from the extension.
     */
    public function logVisit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string|max:255',
            'status' => 'required|string|in:safe,unsafe,unlisted',
            'source' => 'nullable|string|max:50',
            'user_id' => 'nullable|string|max:255',
            'visited_at' => 'nullable|numeric',
        ]);

        // Skip excluded domains (defense-in-depth)
        if (in_array($validated['domain'], config('able.excluded_domains', []))) {
            return response()->json(['success' => true, 'visit_count' => 0]);
        }

        $domain = $validated['domain'];
        $status = $validated['status'];
        $source = $validated['source'] ?? null;
        $userId = $validated['user_id'] ?? null;
        $visitedAt = $validated['visited_at'] ?? null;

        $visitTime = $visitedAt
            ? Carbon::createFromTimestampMs($visitedAt)
            : now();

        $policy = DomainPolicy::firstOrCreate(
            ['domain' => $domain],
            [
                'domain_status' => $status,
                'policy' => 'under_review',
                'risk_score' => $status === 'unlisted' ? 70 : 0,
                'visit_count' => 0,
                'last_visited_at' => now(),
                'last_source' => $source,
            ]
        );

        $debounceMs = (int) app(AbleSettingsService::class)->value('extension', 'logging.visit_debounce_ms', 5000);

        if ($debounceMs > 0) {
            $duplicate = DomainVisit::where('domain_policy_id', $policy->id)
                ->where('domain', $domain)
                ->where('visited_at', '>', $visitTime->copy()->subMilliseconds($debounceMs))
                ->exists();

            if ($duplicate) {
                return response()->json([
                    'success' => true,
                    'visit_count' => $policy->visit_count,
                    'duplicate' => true,
                ]);
            }
        }

        $policy->increment('visit_count', 1, [
            'last_visited_at' => now(),
            'last_source' => $source,
        ]);

        $visitStatus = $policy->domain_status ?? $status ?? 'unlisted';

        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'domain' => $domain,
            'status' => $visitStatus,
            'user_id' => $userId,
            'visited_at' => $visitTime,
        ]);

        $policy->refresh();

        return response()->json([
            'success' => true,
            'visit_count' => $policy->visit_count,
            'duplicate' => false,
        ]);
    }

    /**
     * API endpoint: Return all domain policies for extension offline cache.
     */
    public function all(): JsonResponse
    {
        $policies = DomainPolicy::all();

        return response()->json([
            'policies' => $policies,
            'count' => $policies->count(),
        ]);
    }

    /**
     * API endpoint: Return all domain policies wrapped in an HMAC-signed envelope.
     * The extension verifies this signature before trusting the offline cache.
     */
    public function signed(): JsonResponse
    {
        $payload = [
            'policies' => DomainPolicy::all()->toArray(),
            'issued_at' => now()->timestamp,
        ];

        return response()->json($this->signEnvelope($payload));
    }

    /**
     * Sign a payload with the server's HMAC secret and return the envelope.
     * Format: { payload, signature, key_version }
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function signEnvelope(array $payload): array
    {
        $key = $this->signingKey();
        $signature = JsCanonical::sign($payload, $key);

        return [
            'payload' => $payload,
            'signature' => $signature,
            'key_version' => (int) config('able.signing_key_version', 1),
        ];
    }

    private function signingKey(): string
    {
        $key = config('able.signing_key');
        if (! $key || strlen($key) < 32) {
            abort(500, 'ABLE signing key not configured');
        }

        return $key;
    }

    /**
     * API endpoint: Classify a domain for the browser extension.
     *
     * Accepts GET ?url= (legacy) and POST {url, signals} where signals are
     * rich page hints (title, meta, headings, excerpt, JSON-LD, URL tokens,
     * anchors, forms) used to auto-categorize unlisted domains. Lookup order:
     * database → brand seed map → safe patterns → heuristic → pending/default.
     * Everything resolves offline on our own infrastructure; no visited
     * domain is ever sent to a third party.
     */
    public function classify(Request $request): JsonResponse
    {
        $request->validate([
            'url' => 'required|string|max:2048',
            'signals.title' => 'nullable|string|max:500',
            'signals.meta' => 'nullable|array',
            'signals.meta.*' => 'nullable|string|max:500',
            'signals.headings' => 'nullable|array',
            'signals.headings.*' => 'nullable|string|max:500',
            'signals.excerpt' => 'nullable|string|max:10000',
            'signals.ldJson' => 'nullable|array',
            'signals.ldJson.*' => 'nullable|string|max:3000',
            'signals.canonical' => 'nullable|string|max:500',
            'signals.urlTokens' => 'nullable|array',
            'signals.urlTokens.hostParts' => 'nullable|array',
            'signals.urlTokens.hostParts.*' => 'nullable|string|max:100',
            'signals.urlTokens.pathSegs' => 'nullable|array',
            'signals.urlTokens.pathSegs.*' => 'nullable|string|max:100',
            'signals.urlTokens.queryKeys' => 'nullable|array',
            'signals.urlTokens.queryKeys.*' => 'nullable|string|max:100',
            'signals.anchors' => 'nullable|array',
            'signals.forms' => 'nullable|array',
            'signals.forms.hasPassword' => 'nullable|boolean',
            'signals.forms.hasFileInput' => 'nullable|boolean',
            'signals.forms.actionMismatch' => 'nullable|boolean',
            'signals.lang' => 'nullable|string|max:20',
            'signals.favicon' => 'nullable|string|max:500',
        ]);

        try {
            $hostname = parse_url($request->input('url'), PHP_URL_HOST);
            $domain = preg_replace('/^www\./', '', strtolower((string) $hostname));

            // Query the database - exact match first
            $policy = DomainPolicy::where('domain', $domain)->first();

            // If no exact match, check for subdomain match (e.g. mail.google.com → google.com)
            if (! $policy) {
                $policy = DomainPolicy::whereRaw('? LIKE CONCAT("%.", domain)', [$domain])->first();
            }

            if ($policy) {
                $policy = $this->maybeUpgradeHeuristic($policy, $request);

                return response()->json([
                    'status' => $policy->domain_status,
                    'domain' => $domain,
                    'category' => $policy->category,
                    'policy' => $policy->policy,
                    'risk_score' => $policy->risk_score,
                    'source' => 'database',
                    'classification_source' => $policy->classification_source,
                    'confidence' => $policy->confidence !== null ? (float) $policy->confidence : null,
                ]);
            }

            // Curated brand map: deterministic categories for mainstream domains.
            $brandCategory = DomainBrandMap::lookup($domain);

            if ($brandCategory !== null && $this->autoCategorizeEnabled()) {
                $policy = $this->persistAutoCategory($domain, [
                    'category' => $brandCategory,
                    'confidence' => 1.0,
                    'policy' => 'under_review',
                    'risk_score' => $this->riskForCategory($brandCategory),
                ], 'brand');

                return response()->json([
                    'status' => 'unlisted',
                    'domain' => $domain,
                    'category' => $brandCategory,
                    'policy' => $policy->policy,
                    'risk_score' => $policy->risk_score,
                    'source' => 'brand',
                    'classification_source' => 'brand',
                    'confidence' => 1.0,
                ]);
            }

            // Check if domain matches safe patterns (edu, gov, org)
            $safePatterns = app(AbleSettingsService::class)->value(
                'server',
                'algorithm.safe_patterns',
                [
                    '/^([\w-]+\.)*\.(edu|gov|org)$/i',
                    '/^([\w-]+\.)*gov\.(uk|au|nz|ca)$/i',
                ],
            );

            foreach ($safePatterns as $pattern) {
                if (preg_match($pattern, $domain)) {
                    return response()->json([
                        'status' => 'safe',
                        'domain' => $domain,
                        'category' => null,
                        'policy' => 'whitelisted',
                        'risk_score' => 0,
                        'source' => 'pattern',
                        'classification_source' => 'pattern',
                        'confidence' => null,
                    ]);
                }
            }

            // Auto-categorize unlisted domains from page signals before the fallback.
            $heuristic = null;
            if ($this->autoCategorizeEnabled()) {
                $signals = $request->input('signals', []);
                if (! is_array($signals)) {
                    $signals = [];
                }
                $signals['url'] = $request->input('url');
                $heuristic = HeuristicClassifier::classify($domain, $signals);
            }

            if ($heuristic !== null) {
                $this->persistAutoCategory($domain, $heuristic, 'heuristic');

                return response()->json([
                    'status' => 'unlisted',
                    'domain' => $domain,
                    'category' => $heuristic['category'],
                    'policy' => $heuristic['policy'],
                    'risk_score' => $heuristic['risk_score'],
                    'source' => 'heuristic',
                    'classification_source' => 'heuristic',
                    'confidence' => $heuristic['confidence'],
                ]);
            }

            // Nothing matched: park the domain in the admin review queue.
            if ($this->autoCategorizeEnabled()) {
                $this->persistAutoCategory($domain, [
                    'category' => null,
                    'confidence' => null,
                    'policy' => (string) app(AbleSettingsService::class)->value('server', 'algorithm.fallback_policy', 'under_review'),
                    'risk_score' => (int) app(AbleSettingsService::class)->value('server', 'algorithm.default_risk_score', 70),
                ], 'pending');
            }

            // Not found in database
            $defaultRiskScore = (int) app(AbleSettingsService::class)->value('server', 'algorithm.default_risk_score', 70);
            $fallbackPolicy = (string) app(AbleSettingsService::class)->value('server', 'algorithm.fallback_policy', 'under_review');

            return response()->json([
                'status' => 'unlisted',
                'domain' => $domain,
                'category' => null,
                'policy' => $fallbackPolicy,
                'risk_score' => $defaultRiskScore,
                'source' => 'pending',
                'classification_source' => 'pending',
                'confidence' => null,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'unlisted',
                'domain' => 'unknown',
                'category' => null,
                'policy' => 'under_review',
                'risk_score' => 70,
                'source' => 'error',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Fill in category/policy for rows that were created before
     * auto-categorization existed (category NULL, no classification_source).
     */
    private function maybeUpgradeHeuristic(DomainPolicy $policy, Request $request): DomainPolicy
    {
        if ($policy->category !== null || $policy->classification_source !== null) {
            return $policy;
        }

        if (! $this->autoCategorizeEnabled()) {
            return $policy;
        }

        $brandCategory = DomainBrandMap::lookup($policy->domain);

        if ($brandCategory !== null) {
            $policy->update([
                'category' => $brandCategory,
                'classification_source' => 'brand',
                'confidence' => 1.0,
                'risk_score' => $policy->risk_score === 70 || $policy->risk_score === 0 ? $this->riskForCategory($brandCategory) : $policy->risk_score,
            ]);

            return $policy->refresh();
        }

        $signals = $request->input('signals', []);
        if (! is_array($signals)) {
            $signals = [];
        }
        $signals['url'] = $request->input('url');
        $heuristic = HeuristicClassifier::classify($policy->domain, $signals);

        if ($heuristic === null) {
            return $policy;
        }

        $policy->update([
            'policy' => $policy->policy === 'under_review' ? $heuristic['policy'] : $policy->policy,
            'category' => $heuristic['category'],
            'classification_source' => 'heuristic',
            'confidence' => $heuristic['confidence'],
            'risk_score' => $policy->risk_score === 70 || $policy->risk_score === 0 ? $heuristic['risk_score'] : $policy->risk_score,
        ]);

        return $policy->refresh();
    }

    private function autoCategorizeEnabled(): bool
    {
        return (bool) app(AbleSettingsService::class)->value('server', 'algorithm.auto_categorize_enabled', true);
    }

    private function riskForCategory(string $category): int
    {
        return match ($category) {
            'Gambling' => 90,
            'Adult' => 95,
            'Finance' => 60,
            'E-commerce' => 55,
            'Health' => 55,
            'Shopping' => 50,
            'Government' => 10,
            'Education' => 15,
            'Search Engine' => 10,
            'Reference' => 20,
            default => 70,
        };
    }

    /**
     * Create or backfill a domain row with an auto-derived category.
     * A bare row may already exist (e.g. log-visit won the race) — backfill
     * it so the admin UI never shows a blank category.
     *
     * @param  array{category: string|null, confidence: float|null, policy: string, risk_score: int}  $result
     */
    private function persistAutoCategory(string $domain, array $result, string $source): DomainPolicy
    {
        $policy = DomainPolicy::firstOrCreate(
            ['domain' => $domain],
            [
                'domain_status' => 'unlisted',
                'policy' => $result['policy'],
                'category' => $result['category'],
                'classification_source' => $source,
                'confidence' => $result['confidence'],
                'risk_score' => $result['risk_score'],
                'visit_count' => 0,
            ]
        );

        if ($policy->category === null && $policy->classification_source === null) {
            $policy->update([
                'policy' => $policy->policy === 'under_review' ? $result['policy'] : $policy->policy,
                'category' => $result['category'],
                'classification_source' => $source,
                'confidence' => $result['confidence'],
                'risk_score' => $policy->risk_score === 70 || $policy->risk_score === 0 ? $result['risk_score'] : $policy->risk_score,
            ]);
            $policy->refresh();
        }

        return $policy;
    }

    /**
     * API endpoint: Get paginated visits for a domain policy.
     */
    public function getDomainVisits(Request $request, DomainPolicy $domainPolicy): JsonResponse
    {
        $perPage = $request->input('per_page', 10);
        $search = $request->input('search');

        $query = DomainVisit::where('domain_policy_id', $domainPolicy->id)
            ->orderBy('visited_at', 'desc');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('user_id', 'like', "%{$search}%")
                    ->orWhere('domain', 'like', "%{$search}%");
            });
        }

        $visits = $query->paginate($perPage);

        $activeWindow = now()->subMinutes(15);

        $activeVisitUsers = DomainVisit::where('domain_policy_id', $domainPolicy->id)
            ->where('visited_at', '>=', $activeWindow)
            ->whereNotNull('user_id')
            ->distinct('user_id')
            ->pluck('user_id');

        $activeEgressUsers = EgressEvent::where('domain', $domainPolicy->domain)
            ->where('occurred_at', '>=', $activeWindow)
            ->whereNotNull('user_id')
            ->distinct('user_id')
            ->pluck('user_id');

        $activeUsers = $activeVisitUsers->merge($activeEgressUsers)->unique()->count();

        $visitCount = max((int) ($domainPolicy->visit_count ?? 0), DomainVisit::where('domain_policy_id', $domainPolicy->id)->count());

        return response()->json([
            'visits' => $visits->items(),
            'total' => $visits->total(),
            'current_page' => $visits->currentPage(),
            'last_page' => $visits->lastPage(),
            'per_page' => $visits->perPage(),
            'visit_count' => $visitCount,
            'active_users' => $activeUsers,
        ]);
    }
}
