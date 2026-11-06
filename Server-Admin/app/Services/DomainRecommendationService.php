<?php

namespace App\Services;

use App\Models\DomainPolicy;
use App\Models\DomainRecommendation;
use App\Support\AppCategories;

/**
 * Resolves the sanctioned alternatives shown under ABLE Recommends.
 *
 * The admin-curated recommendation list wins. When a category has no manual
 * entries, the service falls back to the previous behaviour: whitelisted
 * domains in that category. That keeps existing installations working until
 * an admin configures the new page.
 *
 * Manual entries are independent of Domain Policy: an admin may recommend a
 * domain that is not whitelisted, and this service does not change it.
 */
class DomainRecommendationService
{
    /**
     * Sanctioned alternatives for a category, excluding the current domain.
     *
     * @return list<string>
     */
    public function forCategory(?string $category, ?string $excludeDomain = null, ?int $limit = null): array
    {
        $key = strtolower(trim((string) $category));

        // No category means there is nothing to recommend against. The
        // extension renders its legacy warning in that case.
        if ($key === '') {
            return [];
        }

        // Gambling and Adult are never recommended: neither the manual list
        // nor the whitelisted fallback applies.
        if (AppCategories::isExcludedFromRecommendations($key)) {
            return [];
        }

        $limit = max(1, min(20, $limit ?? (int) config('able.recommendations_limit', 6)));

        $manual = DomainRecommendation::query()
            ->whereRaw('LOWER(TRIM(category)) = ?', [$key])
            ->orderBy('domain')
            ->pluck('domain')
            ->all();

        $recommendations = $this->select($manual, $excludeDomain, $limit);

        if ($recommendations !== []) {
            return $recommendations;
        }

        return $this->select($this->fromWhitelistedPolicies($key), $excludeDomain, $limit);
    }

    /**
     * The fallback source: domains the admin marked whitelisted.
     *
     * @return list<string>
     */
    private function fromWhitelistedPolicies(string $categoryKey): array
    {
        /** @var list<string> $domains */
        $domains = DomainPolicy::query()
            ->where('policy', 'whitelisted')
            ->where('block_access', false)
            ->whereNotNull('category')
            // Case/whitespace-insensitive so a hand-typed category still
            // matches the seeded taxonomy. This predicate cannot use
            // domain_policies_category_idx; at this table size the scan is
            // cheaper than maintaining a normalized key column.
            ->whereRaw('LOWER(TRIM(category)) = ?', [$categoryKey])
            ->orderBy('domain')
            ->pluck('domain')
            ->all();

        return $domains;
    }

    /**
     * Normalize, exclude related domains, dedupe, and cap.
     *
     * @param  array<int, string>  $candidates
     * @return list<string>
     */
    private function select(array $candidates, ?string $excludeDomain, int $limit): array
    {
        $excluded = $this->normalizeDomain($excludeDomain);
        $seen = [];
        $recommendations = [];

        foreach ($candidates as $candidate) {
            $domain = $this->normalizeDomain($candidate);

            if ($domain === '' || isset($seen[$domain])) {
                continue;
            }

            if ($excluded !== '' && $this->isRelated($domain, $excluded)) {
                continue;
            }

            $seen[$domain] = true;
            $recommendations[] = $domain;

            if (count($recommendations) >= $limit) {
                break;
            }
        }

        return $recommendations;
    }

    /**
     * True when two domains are the same host or one contains the other.
     *
     * Recommending the site the user is already on, or its parent, adds no
     * value and looks like a bug.
     */
    private function isRelated(string $candidate, string $domain): bool
    {
        return $candidate === $domain
            || str_ends_with($domain, '.'.$candidate)
            || str_ends_with($candidate, '.'.$domain);
    }

    private function normalizeDomain(?string $domain): string
    {
        return preg_replace('/^www\./', '', strtolower(trim((string) $domain)));
    }
}
