<?php

namespace App\Http\Controllers;

use App\Concerns\BoundsAdminRows;
use App\Models\DomainPolicy;
use App\Models\DomainRecommendation;
use App\Support\AppCategories;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RecommendationPolicyController extends Controller
{
    use BoundsAdminRows;

    /**
     * A hostname with at least one dot, no scheme, path, port, or spaces.
     */
    private const HOSTNAME_PATTERN = '/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/';

    /**
     * Show the Recommendation Policy page.
     */
    public function index(): Response
    {
        $recommendations = DomainRecommendation::query()
            ->whereIn('category', AppCategories::recommendationNames())
            ->orderBy('category')
            ->orderBy('domain')
            ->get(['id', 'category', 'domain'])
            ->groupBy('category');

        // The "Add Existing" picker offers domains that already exist in
        // Domain Policy, so an admin does not have to retype one.
        $existingDomains = DomainPolicy::query()
            ->orderBy('domain')
            ->limit($this->rowLimit())
            ->get(['domain', 'policy', 'domain_status', 'category']);

        return Inertia::render('recommendation-policy', [
            'recommendations' => $recommendations,
            'categories' => AppCategories::recommendable(),
            'existingDomains' => $existingDomains,
            'limit' => $this->limit(),
        ]);
    }

    /**
     * Assign a domain to a category as a sanctioned alternative.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->merge(['domain' => $this->normalizeDomain($request->input('domain'))]);

        $validated = $request->validate([
            'category' => ['required', 'string', Rule::in(AppCategories::recommendationNames())],
            'domain' => [
                'required',
                'string',
                'max:255',
                'regex:'.self::HOSTNAME_PATTERN,
                Rule::unique('domain_recommendations', 'domain')->where(
                    fn ($query) => $query->where('category', $request->input('category'))
                ),
            ],
        ], [
            'domain.regex' => 'Enter a valid domain, for example notion.so.',
            'domain.unique' => 'That domain is already recommended for this category.',
        ]);

        $limit = $this->limit();
        $existing = DomainRecommendation::where('category', $validated['category'])->count();

        if ($existing >= $limit) {
            throw ValidationException::withMessages([
                'domain' => 'This category already has the maximum of '.$limit.' recommendations.',
            ]);
        }

        DomainRecommendation::create([
            'category' => $validated['category'],
            'domain' => $validated['domain'],
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Recommendation added.']);

        return Redirect::back();
    }

    /**
     * Remove every recommendation for a category.
     */
    public function destroyCategory(string $category): RedirectResponse
    {
        if (! in_array($category, AppCategories::recommendationNames(), true)) {
            abort(404);
        }

        // Delete model by model so the cache observer invalidates the signed
        // feed. A query-level delete would skip Eloquent events.
        DomainRecommendation::where('category', $category)
            ->get()
            ->each(fn (DomainRecommendation $recommendation) => $recommendation->delete());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Category card deleted.']);

        return Redirect::back();
    }

    /**
     * Remove a recommendation.
     */
    public function destroy(DomainRecommendation $domainRecommendation): RedirectResponse
    {
        $domainRecommendation->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Recommendation removed.']);

        return Redirect::back();
    }

    private function limit(): int
    {
        return max(1, min(20, (int) config('able.recommendations_limit', 6)));
    }

    /**
     * Reduce a submitted value to a bare hostname.
     */
    private function normalizeDomain(mixed $value): string
    {
        if (! is_string($value)) {
            return '';
        }

        $value = trim($value);

        if ($value === '') {
            return '';
        }

        $url = str_contains($value, '://') ? $value : 'https://'.$value;
        $host = parse_url($url, PHP_URL_HOST);

        if (! is_string($host)) {
            return '';
        }

        return preg_replace('/^www\./', '', strtolower($host));
    }
}
