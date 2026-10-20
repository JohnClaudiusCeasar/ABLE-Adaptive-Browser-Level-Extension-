<?php

namespace App\Support;

use App\Models\DomainPolicy;
use App\Services\AbleSettingsService;

/**
 * Read-only domain risk resolution shared by DomainPolicyController::classify()
 * and RiskScoringController.
 *
 * Lookup order (matches classify()):
 *   database (exact then subdomain) -> brand seed map -> safe patterns -> default.
 *
 * Keeping this chain in one place guarantees the domain risk baseline
 * (0 safe / 60 unlisted / 70 unsafe) is always server-computed and never
 * collapses to a client-side `|| 0` coercion.
 */
class DomainRiskResolver
{
    /**
     * @return array{domain: string, status: string, category: string|null, policy: string, risk_score: int, source: string}
     */
    public function resolve(string $domain): array
    {
        $domain = preg_replace('/^www\./', '', strtolower($domain));

        $policy = self::findPolicy($domain);

        if ($policy) {
            return [
                'domain' => $domain,
                'status' => (string) $policy->domain_status,
                'category' => $policy->category,
                'policy' => (string) $policy->policy,
                'risk_score' => (int) $policy->risk_score,
                'source' => 'database',
            ];
        }

        $brandCategory = DomainBrandMap::lookup($domain);

        if ($brandCategory !== null) {
            return [
                'domain' => $domain,
                'status' => 'unlisted',
                'category' => $brandCategory,
                'policy' => 'under_review',
                'risk_score' => self::riskForCategory($brandCategory),
                'source' => 'brand',
            ];
        }

        foreach (self::safePatterns() as $pattern) {
            if (preg_match($pattern, $domain)) {
                return [
                    'domain' => $domain,
                    'status' => 'safe',
                    'category' => null,
                    'policy' => 'whitelisted',
                    'risk_score' => 0,
                    'source' => 'pattern',
                ];
            }
        }

        return [
            'domain' => $domain,
            'status' => 'unlisted',
            'category' => null,
            'policy' => self::fallbackPolicy(),
            'risk_score' => self::defaultRiskScore(),
            'source' => 'pending',
        ];
    }

    /**
     * Find the policy that applies to a domain.
     *
     * The exact domain is checked first, then each parent domain, so
     * "mail.google.com" matches a policy for "google.com".
     *
     * The lookup is a set of exact matches against the unique index on the
     * domain column. A suffix pattern would need a leading wildcard, which
     * cannot use that index and would scan the whole policy table on every
     * classification.
     */
    public static function findPolicy(string $domain): ?DomainPolicy
    {
        $candidates = self::suffixCandidates($domain);

        if ($candidates === []) {
            return null;
        }

        $matches = DomainPolicy::whereIn('domain', $candidates)->get()->keyBy('domain');

        // The candidates are ordered most specific first, so the first hit
        // is the most specific policy that applies.
        foreach ($candidates as $candidate) {
            $policy = $matches->get($candidate);

            if ($policy instanceof DomainPolicy) {
                return $policy;
            }
        }

        return null;
    }

    /**
     * The domain and each of its parent domains, most specific first.
     *
     * The bare top-level domain is left out: a policy for "com" or "co.uk"
     * would match every site on the internet and is never a real policy.
     *
     * @return list<string>
     */
    public static function suffixCandidates(string $domain): array
    {
        $parts = explode('.', $domain);
        $candidates = [];

        while (count($parts) > 1) {
            $candidates[] = implode('.', $parts);
            array_shift($parts);
        }

        return $candidates;
    }

    public static function riskForCategory(string $category): int
    {
        return match ($category) {
            'Gambling' => 90,
            'Adult' => 95,
            'Finance' => 60,
            'E-commerce' => 55,
            'Health' => 55,
            'Shopping' => 50,
            'AI' => 50,
            'Government' => 10,
            'Education' => 15,
            'Search Engine' => 10,
            'Reference' => 20,
            default => 60,
        };
    }

    public static function defaultRiskScore(): int
    {
        return (int) app(AbleSettingsService::class)->value('server', 'algorithm.default_risk_score', 60);
    }

    public static function fallbackPolicy(): string
    {
        return (string) app(AbleSettingsService::class)->value('server', 'algorithm.fallback_policy', 'under_review');
    }

    /**
     * @return list<string>
     */
    public static function safePatterns(): array
    {
        $patterns = (array) app(AbleSettingsService::class)->value(
            'server',
            'algorithm.safe_patterns',
            [
                '/^([\w-]+\.)*\.(edu|gov|org)$/i',
                '/^([\w-]+\.)*gov\.(uk|au|nz|ca)$/i',
            ],
        );

        return array_values(array_map('strval', $patterns));
    }
}
