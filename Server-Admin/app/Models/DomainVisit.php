<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $domain_policy_id
 * @property string $domain
 * @property string|null $status
 * @property string|null $user_id
 * @property string|null $event_id
 * @property Carbon|null $visited_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property DomainPolicy|null $domainPolicy
 */
class DomainVisit extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'domain_policy_id',
        'domain',
        'status',
        'user_id',
        'event_id',
        'visited_at',
    ];

    protected $casts = [
        'visited_at' => 'datetime',
    ];

    /**
     * Get the domain policy that owns this visit.
     *
     * @return BelongsTo<DomainPolicy, $this>
     */
    public function domainPolicy(): BelongsTo
    {
        return $this->belongsTo(DomainPolicy::class);
    }

    /**
     * Resolve the point-in-time domain status for this visit.
     */
    public function resolvedStatus(): string
    {
        return $this->status ?? $this->domainPolicy?->domain_status ?? 'unlisted';
    }

    /**
     * Get the CSS glass status badge class for this visit.
     */
    public function glassStatus(): string
    {
        return match ($this->resolvedStatus()) {
            'safe' => 'glass-safe',
            'unsafe' => 'glass-unsafe',
            default => 'glass-unlisted',
        };
    }

    /**
     * Get the user action text for this visit.
     */
    public function actionLabel(): string
    {
        return match ($this->resolvedStatus()) {
            'safe' => 'Allowed',
            'unsafe' => 'Blocked',
            default => 'Warned',
        };
    }
}
