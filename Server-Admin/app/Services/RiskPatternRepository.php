<?php

namespace App\Services;

use App\Models\RiskPattern;
use Illuminate\Support\Facades\Cache;

/**
 * Read-side access to the risk-pattern corpus.
 *
 * The corpus is small, but it is read on every /api/score-content call and
 * on every signed feed request, and each read costs three queries plus the
 * hydration of every pattern and criteria item. It is therefore cached and
 * invalidated whenever a pattern is written.
 *
 * Writes are invalidated explicitly through RiskPatternCacheObserver, so the
 * TTL below is only a safety net for writes that bypass the model layer.
 */
class RiskPatternRepository
{
    public const CACHE_KEY = 'able:risk-patterns:corpus';

    /**
     * How long a cached corpus may be served before it is rebuilt from the
     * database.
     */
    private const TTL_SECONDS = 300;

    /**
     * The full corpus: every pattern with its criteria items, as plain arrays.
     *
     * @return array<int, array<string, mixed>>
     */
    public function corpus(): array
    {
        return Cache::remember(
            self::CACHE_KEY,
            self::TTL_SECONDS,
            static fn (): array => RiskPattern::with('criteriaPatternItems')
                ->orderBy('id')
                ->get()
                ->toArray(),
        );
    }

    /**
     * The corpus ordered the way the signed feed presents it: high priority
     * first, then medium, then low, with the pattern id as a stable
     * tie-breaker so repeated reads return the same order.
     *
     * @return array<int, array<string, mixed>>
     */
    public function orderedCorpus(): array
    {
        $priority = ['high' => 0, 'medium' => 1, 'low' => 2];

        $patterns = $this->corpus();

        usort($patterns, static function (array $a, array $b) use ($priority): int {
            $rankA = $priority[$a['priority'] ?? ''] ?? 3;
            $rankB = $priority[$b['priority'] ?? ''] ?? 3;

            if ($rankA !== $rankB) {
                return $rankA <=> $rankB;
            }

            return ($a['id'] ?? 0) <=> ($b['id'] ?? 0);
        });

        return $patterns;
    }

    /**
     * Drop the cached corpus so the next read rebuilds it from the database.
     */
    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
