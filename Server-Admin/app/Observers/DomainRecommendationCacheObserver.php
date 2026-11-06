<?php

namespace App\Observers;

use App\Services\DomainPolicyFeed;
use Illuminate\Database\Eloquent\Model;

/**
 * Drops the cached domain-policy feed when a recommendation changes.
 *
 * Recommendations ride in the signed policy feed so the extension can show
 * them offline. A cached feed that outlived an add or remove would keep
 * serving the previous list for up to the cache TTL.
 */
class DomainRecommendationCacheObserver
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
        app(DomainPolicyFeed::class)->forget();
    }
}
