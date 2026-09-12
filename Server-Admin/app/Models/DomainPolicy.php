<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $domain
 * @property string $domain_status
 * @property string $policy
 * @property string|null $category
 * @property string|null $classification_source
 * @property float|null $confidence
 * @property int $risk_score
 * @property int $visit_count
 * @property Carbon|null $last_visited_at
 * @property string|null $last_source
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class DomainPolicy extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'domain',
        'domain_status',
        'policy',
        'category',
        'classification_source',
        'confidence',
        'risk_score',
        'visit_count',
        'last_visited_at',
        'last_source',
    ];

    protected $casts = [
        'risk_score' => 'integer',
        'visit_count' => 'integer',
        'confidence' => 'float',
        'last_visited_at' => 'datetime',
    ];

    /**
     * Get all visits for this domain policy.
     *
     * @return HasMany<DomainVisit, $this>
     */
    public function visits(): HasMany
    {
        return $this->hasMany(DomainVisit::class);
    }
}
