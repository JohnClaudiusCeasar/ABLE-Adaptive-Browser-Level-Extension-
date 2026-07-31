<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DomainPolicy extends Model
{
    protected $fillable = [
        'domain',
        'domain_status',
        'policy',
        'category',
        'risk_score',
        'visit_count',
        'last_visited_at',
        'last_source',
    ];

    protected $casts = [
        'risk_score' => 'integer',
        'visit_count' => 'integer',
        'last_visited_at' => 'datetime',
    ];

    /**
     * Get all visits for this domain policy.
     */
    public function visits(): HasMany
    {
        return $this->hasMany(DomainVisit::class);
    }
}