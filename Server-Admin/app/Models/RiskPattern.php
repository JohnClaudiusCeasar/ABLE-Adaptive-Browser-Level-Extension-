<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RiskPattern extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'title',
        'type',
        'regex',
        'status',
        'score',
        'parent_criteria_id',
    ];

    /**
     * Get the criteria pattern items for this pattern.
     */
    public function criteriaPatternItems(): HasMany
    {
        return $this->hasMany(CriteriaPatternItem::class, 'criteria_pattern_id')
            ->whereNull('parent_id')
            ->with('subItems');
    }

    /**
     * Get the parent criteria pattern (if this is an auto-created single).
     */
    public function parentCriteria(): BelongsTo
    {
        return $this->belongsTo(RiskPattern::class, 'parent_criteria_id');
    }

    /**
     * Get the auto-created single patterns linked to this criteria.
     */
    public function autoCreatedSingles(): HasMany
    {
        return $this->hasMany(RiskPattern::class, 'parent_criteria_id');
    }

    /**
     * Check if this is a single pattern.
     */
    public function isSingle(): bool
    {
        return $this->type === 'single';
    }

    /**
     * Check if this is a criteria pattern.
     */
    public function isCriteria(): bool
    {
        return $this->type === 'criteria';
    }
}
