<?php

namespace App\Services;

use App\Models\DomainPolicy;
use App\Support\DomainBrandMap;
use App\Support\DomainRiskResolver;
use App\Support\HeuristicClassifier;

class DomainClassificationService
{
    public function __construct(
        private readonly DomainRecommendationService $recommendationService,
    ) {}

    /**
     * Classify a URL using database policies, brand map, safe patterns,
     * heuristic page signals, or fallback pending classification.
     *
     * @param  array<string, mixed>  $signals
     * @return array<string, mixed>
     */
    public function classifyUrl(string $url, array $signals = []): array
    {
        $hostname = parse_url($url, PHP_URL_HOST);
        $domain = preg_replace('/^www\./', '', strtolower((string) $hostname));

        // Query the database - exact match first, then a parent domain
        // (e.g. mail.google.com → google.com). The lookup is a set of
        // exact matches so it can use the unique index on the domain.
        $policy = DomainRiskResolver::findPolicy($domain);

        if ($policy) {
            $policy = $this->maybeUpgradeHeuristic($policy, $url, $signals);

            return $this->withRecommendations([
                'status' => $policy->domain_status,
                'domain' => $domain,
                'category' => $policy->category,
                'policy' => $policy->policy,
                'block_access' => (bool) $policy->block_access,
                'risk_score' => $policy->risk_score,
                'source' => 'database',
                'classification_source' => $policy->classification_source,
                'confidence' => $policy->confidence !== null ? (float) $policy->confidence : null,
            ], $domain);
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

            return $this->withRecommendations([
                'status' => 'unlisted',
                'domain' => $domain,
                'category' => $brandCategory,
                'policy' => $policy->policy,
                'block_access' => (bool) $policy->block_access,
                'risk_score' => $policy->risk_score,
                'source' => 'brand',
                'classification_source' => 'brand',
                'confidence' => 1.0,
            ], $domain);
        }

        // Check if domain matches safe patterns (edu, gov, org)
        $safePatterns = DomainRiskResolver::safePatterns();

        foreach ($safePatterns as $pattern) {
            if (preg_match($pattern, $domain)) {
                return $this->withRecommendations([
                    'status' => 'safe',
                    'domain' => $domain,
                    'category' => null,
                    'policy' => 'whitelisted',
                    'block_access' => false,
                    'risk_score' => 0,
                    'source' => 'pattern',
                    'classification_source' => 'pattern',
                    'confidence' => null,
                ], $domain);
            }
        }

        // Auto-categorize unlisted domains from page signals before the fallback.
        $heuristic = null;
        if ($this->autoCategorizeEnabled()) {
            $signals['url'] = $url;
            $heuristic = HeuristicClassifier::classify($domain, $signals);
        }

        if ($heuristic !== null) {
            $this->persistAutoCategory($domain, $heuristic, 'heuristic');

            return $this->withRecommendations([
                'status' => 'unlisted',
                'domain' => $domain,
                'category' => $heuristic['category'],
                'policy' => $heuristic['policy'],
                'block_access' => false,
                'risk_score' => $heuristic['risk_score'],
                'source' => 'heuristic',
                'classification_source' => 'heuristic',
                'confidence' => $heuristic['confidence'],
            ], $domain);
        }

        // Nothing matched: park the domain in the admin review queue.
        if ($this->autoCategorizeEnabled()) {
            $this->persistAutoCategory($domain, [
                'category' => null,
                'confidence' => null,
                'policy' => DomainRiskResolver::fallbackPolicy(),
                'risk_score' => DomainRiskResolver::defaultRiskScore(),
            ], 'pending');
        }

        // Not found in database
        $defaultRiskScore = DomainRiskResolver::defaultRiskScore();
        $fallbackPolicy = DomainRiskResolver::fallbackPolicy();

        return $this->withRecommendations([
            'status' => 'unlisted',
            'domain' => $domain,
            'category' => null,
            'policy' => $fallbackPolicy,
            'block_access' => false,
            'risk_score' => $defaultRiskScore,
            'source' => 'pending',
            'classification_source' => 'pending',
            'confidence' => null,
        ], $domain);
    }

    /**
     * Attach the sanctioned alternatives shown under ABLE Recommends.
     *
     * Only unsafe/unlisted domains get recommendations; a safe domain is
     * never nudged, and a blocked domain is handled by the block flow. A
     * missing category yields an empty list, which the extension treats as
     * "feature off" and renders the legacy warning.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function withRecommendations(array $payload, ?string $domain): array
    {
        $status = $payload['status'] ?? null;

        $payload['recommendations'] = in_array($status, ['unsafe', 'unlisted'], true)
            ? $this->recommendationService->forCategory($payload['category'] ?? null, $domain)
            : [];

        return $payload;
    }

    /**
     * Fill in category/policy for rows that were created before
     * auto-categorization existed (category NULL, no classification_source).
     *
     * @param  array<string, mixed>  $signals
     */
    private function maybeUpgradeHeuristic(DomainPolicy $policy, string $url, array $signals): DomainPolicy
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
                'risk_score' => $policy->risk_score === 60 || $policy->risk_score === 70 || $policy->risk_score === 0 ? $this->riskForCategory($brandCategory) : $policy->risk_score,
            ]);

            return $policy->refresh();
        }

        $signals['url'] = $url;
        $heuristic = HeuristicClassifier::classify($policy->domain, $signals);

        if ($heuristic === null) {
            return $policy;
        }

        $policy->update([
            'policy' => $policy->policy === 'under_review' ? $heuristic['policy'] : $policy->policy,
            'category' => $heuristic['category'],
            'classification_source' => 'heuristic',
            'confidence' => $heuristic['confidence'],
            'risk_score' => $policy->risk_score === 60 || $policy->risk_score === 70 || $policy->risk_score === 0 ? $heuristic['risk_score'] : $policy->risk_score,
        ]);

        return $policy->refresh();
    }

    private function autoCategorizeEnabled(): bool
    {
        return (bool) app(AbleSettingsService::class)->value('server', 'algorithm.auto_categorize_enabled', true);
    }

    private function riskForCategory(string $category): int
    {
        return DomainRiskResolver::riskForCategory($category);
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
                'risk_score' => $policy->risk_score === 60 || $policy->risk_score === 70 || $policy->risk_score === 0 ? $result['risk_score'] : $policy->risk_score,
            ]);
            $policy->refresh();
        }

        return $policy;
    }
}
