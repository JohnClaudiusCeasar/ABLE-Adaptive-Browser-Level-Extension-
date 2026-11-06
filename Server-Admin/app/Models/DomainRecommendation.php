<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A sanctioned alternative an admin recommends for an app category.
 *
 * @property int $id
 * @property string $category
 * @property string $domain
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class DomainRecommendation extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'category',
        'domain',
    ];
}
