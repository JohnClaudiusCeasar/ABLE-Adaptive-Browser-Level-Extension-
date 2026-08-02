<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EgressEvent extends Model
{
    protected $fillable = [
        'domain',
        'user_id',
        'file_name',
        'file_size',
        'action',
        'risk_score',
        'occurred_at',
    ];

    protected $casts = [
        'risk_score' => 'integer',
        'occurred_at' => 'datetime',
    ];

    /**
     * Get all nudge interactions for this egress event.
     */
    public function nudgeInteractions(): HasMany
    {
        return $this->hasMany(NudgeInteraction::class);
    }
}
