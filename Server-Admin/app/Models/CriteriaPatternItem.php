<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CriteriaPatternItem extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'criteria_pattern_id',
        'parent_id',
        'title',
        'regex',
        'operator',
        'score',
    ];

    /**
     * Get the risk pattern that owns this item.
     */
    public function riskPattern(): BelongsTo
    {
        return $this->belongsTo(RiskPattern::class, 'criteria_pattern_id');
    }

    /**
     * Get the parent item (if this is a sub-item).
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(CriteriaPatternItem::class, 'parent_id');
    }

    /**
     * Get the sub-items for this item.
     */
    public function subItems(): HasMany
    {
        return $this->hasMany(CriteriaPatternItem::class, 'parent_id');
    }
}
