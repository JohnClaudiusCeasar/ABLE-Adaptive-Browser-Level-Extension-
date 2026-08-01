<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
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
