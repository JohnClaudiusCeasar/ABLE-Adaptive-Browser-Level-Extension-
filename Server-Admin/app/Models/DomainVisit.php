<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $domain_policy_id
 * @property string $domain
 * @property string|null $user_id
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
        'user_id',
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
}
