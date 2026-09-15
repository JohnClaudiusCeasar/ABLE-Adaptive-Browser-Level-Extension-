<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $domain
 * @property string|null $user_id
 * @property string $file_name
 * @property int $file_size
 * @property string $action
 * @property int $risk_score
 * @property array<int, array{label: string, count: int, weight: int}>|null $flagged_items
 * @property Carbon|null $occurred_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class EgressEvent extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'domain',
        'user_id',
        'file_name',
        'file_size',
        'action',
        'risk_score',
        'flagged_items',
        'content_hash',
        'occurred_at',
    ];

    protected $casts = [
        'risk_score' => 'integer',
        'occurred_at' => 'datetime',
        'flagged_items' => 'array',
        'content_hash' => 'string',
    ];

    /**
     * Get all nudge interactions for this egress event.
     *
     * @return HasMany<NudgeInteraction, $this>
     */
    public function nudgeInteractions(): HasMany
    {
        return $this->hasMany(NudgeInteraction::class);
    }
}
