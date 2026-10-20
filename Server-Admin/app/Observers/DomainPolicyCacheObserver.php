<?php

namespace App\Observers;

use App\Services\DomainPolicyFeed;
use Illuminate\Database\Eloquent\Model;

/**
 * Drops the cached domain-policy feed when a policy changes in a way the
 * extension can see.
 *
 * The invalidation is attribute-aware on purpose. Every logged visit bumps
 * the policy's visit counter, and a visit must not cost the server a full
 * rebuild of the signed feed.
 */
class DomainPolicyCacheObserver
{
    public function created(Model $model): void
    {
        $this->invalidate();
    }

    public function updated(Model $model): void
    {
        if (app(DomainPolicyFeed::class)->affectsFeed($model->getChanges())) {
            $this->invalidate();
        }
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
