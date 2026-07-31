<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DomainVisit extends Model
{
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
     */
    public function domainPolicy(): BelongsTo
    {
        return $this->belongsTo(DomainPolicy::class);
    }
}
