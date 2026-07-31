<?php

namespace App\Http\Controllers;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
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
    public function store(Request $request)
    {
        $validated = $request->validate([
            'domain' => 'required|string|max:255|unique:domain_policies,domain',
            'domain_status' => 'required|in:safe,unsafe,unlisted',
            'policy' => 'required|in:whitelisted,blacklisted,under_review',
            'category' => 'nullable|string|max:255',
            'risk_score' => 'required|integer|min:0|max:100',
        ]);

        DomainPolicy::create($validated);

        return Redirect::back()->with('success', 'Domain policy created successfully.');
    }

    /**
     * Update the specified domain policy.
     */
    public function update(Request $request, DomainPolicy $domainPolicy)
    {
        $validated = $request->validate([
            'domain' => 'required|string|max:255|unique:domain_policies,domain,' . $domainPolicy->id,
            'domain_status' => 'required|in:safe,unsafe,unlisted',
            'policy' => 'required|in:whitelisted,blacklisted,under_review',
            'category' => 'nullable|string|max:255',
            'risk_score' => 'required|integer|min:0|max:100',
        ]);

        $domainPolicy->update($validated);

        return Redirect::back()->with('success', 'Domain policy updated successfully.');
    }

    /**
     * Remove the specified domain policy.
     */
    public function destroy(DomainPolicy $domainPolicy)
    {
        $domainPolicy->delete();

        return Redirect::back()->with('success', 'Domain policy deleted successfully.');
    }

    /**
     * Remove all domain policies.
     */
    public function destroyAll()
    {
        DomainPolicy::truncate();

        return Redirect::back()->with('success', 'All domain policies deleted successfully.');
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
        ]);

        $domain = $validated['domain'];
        $status = $validated['status'];
        $source = $validated['source'] ?? null;
        $userId = $validated['user_id'] ?? null;

        // Find or create the domain policy
        $policy = DomainPolicy::where('domain', $domain)->first();

        if (!$policy) {
            // Create new record with visit tracking
            $policy = DomainPolicy::create([
                'domain' => $domain,
                'domain_status' => $status,
                'policy' => 'under_review',
                'risk_score' => 0,
                'visit_count' => 0,
                'last_visited_at' => now(),
                'last_source' => $source,
            ]);
        }

        // Update the policy's visit tracking
        $policy->increment('visit_count');
        $policy->update([
            'last_visited_at' => now(),
            'last_source' => $source,
        ]);

        // Create an individual visit record
        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'domain' => $domain,
            'user_id' => $userId,
            'visited_at' => now(),
        ]);

        return response()->json(['success' => true]);
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
     * API endpoint: Classify a domain for the browser extension.
     */
    public function classify(Request $request): JsonResponse
    {
        $request->validate([
            'url' => 'required|string|max:2048',
        ]);

        try {
            $hostname = strtolower(parse_url($request->input('url'), PHP_URL_HOST));
            $domain = preg_replace('/^www\./', '', $hostname);

            // Query the database - exact match first
            $policy = DomainPolicy::where('domain', $domain)->first();

            // If no exact match, check for subdomain match
            if (!$policy) {
                $allPolicies = DomainPolicy::all();
                $policy = $allPolicies->first(function ($p) use ($domain) {
                    return $domain !== $p->domain && str_ends_with($domain, '.' . $p->domain);
                });
            }

            if ($policy) {
                return response()->json([
                    'status' => $policy->domain_status,
                    'domain' => $domain,
                    'category' => $policy->category,
                    'policy' => $policy->policy,
                    'risk_score' => $policy->risk_score,
                    'source' => 'database',
                ]);
            }

            // Check if domain matches safe patterns (edu, gov, org)
            $safePatterns = [
                '/^([\w-]+\.)*\.(edu|gov|org)$/i',
                '/^([\w-]+\.)*gov\.(uk|au|nz|ca)$/i',
            ];

            foreach ($safePatterns as $pattern) {
                if (preg_match($pattern, $domain)) {
                    return response()->json([
                        'status' => 'safe',
                        'domain' => $domain,
                        'category' => null,
                        'policy' => 'whitelisted',
                        'risk_score' => 0,
                        'source' => 'pattern',
                    ]);
                }
            }

            // Not found in database
            return response()->json([
                'status' => 'unlisted',
                'domain' => $domain,
                'category' => null,
                'policy' => 'under_review',
                'risk_score' => 0,
                'source' => 'default',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'unlisted',
                'domain' => 'unknown',
                'category' => null,
                'policy' => 'under_review',
                'risk_score' => 0,
                'source' => 'error',
                'error' => $e->getMessage(),
            ], 500);
        }
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

        return response()->json([
            'visits' => $visits->items(),
            'total' => $visits->total(),
            'current_page' => $visits->currentPage(),
            'last_page' => $visits->lastPage(),
            'per_page' => $visits->perPage(),
        ]);
    }
}