<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CriteriaPatternItem extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'criteria_pattern_id',
        'parent_id',
        'title',
        'regex',
        'operator',
        'score',
        'risk_weight',
    ];

    /**
     * Get the risk pattern that owns this item.
     *
     * @return BelongsTo<RiskPattern, $this>
     */
    public function riskPattern(): BelongsTo
    {
        return $this->belongsTo(RiskPattern::class, 'criteria_pattern_id');
    }

    /**
     * Get the parent item (if this is a sub-item).
     *
     * @return BelongsTo<CriteriaPatternItem, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(CriteriaPatternItem::class, 'parent_id');
    }

    /**
     * Get the sub-items for this item.
     *
     * @return HasMany<CriteriaPatternItem, $this>
     */
    public function subItems(): HasMany
    {
        return $this->hasMany(CriteriaPatternItem::class, 'parent_id');
    }
}
