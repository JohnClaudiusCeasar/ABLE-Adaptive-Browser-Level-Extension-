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

        $policy = DomainPolicy::where('domain', $domain)->first()
            ?? DomainPolicy::whereRaw("? LIKE CONCAT('%.', domain)", [$domain])->first();

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
        return (array) app(AbleSettingsService::class)->value(
            'server',
            'algorithm.safe_patterns',
            [
                '/^([\w-]+\.)*\.(edu|gov|org)$/i',
                '/^([\w-]+\.)*gov\.(uk|au|nz|ca)$/i',
            ],
        );
    }
}
