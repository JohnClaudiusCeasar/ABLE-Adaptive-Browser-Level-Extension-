<?php

namespace App\Observers;

use App\Services\RiskPatternRepository;
use Illuminate\Database\Eloquent\Model;

/**
 * Drops the cached risk-pattern corpus whenever a pattern or a criteria item
 * is written.
 *
 * The corpus is read by the scoring endpoint and by the signed feed, both of
 * which must reflect an administrator's change immediately. Without this the
 * server would keep scoring uploads against the previous pattern set until
 * the cache TTL expired.
 */
class RiskPatternCacheObserver
{
    public function created(Model $model): void
    {
        $this->invalidate();
    }

    public function updated(Model $model): void
    {
        $this->invalidate();
    }

    public function deleted(Model $model): void
    {
        $this->invalidate();
    }

    private function invalidate(): void
    {
        app(RiskPatternRepository::class)->forget();
    }
}
