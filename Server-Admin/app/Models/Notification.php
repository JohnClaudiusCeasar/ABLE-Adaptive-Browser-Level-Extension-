<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $source
 * @property string $type
 * @property string|null $description
 * @property string|null $domain
 * @property string|null $user_id
 * @property string|null $email
 * @property string|null $ip_address
 * @property int|null $risk_score
 * @property string $status
 * @property string $message
 * @property Carbon|null $occurred_at
 * @property Carbon|null $read_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
class Notification extends Model
{
    use SoftDeletes;

    /** @var list<string> */
    protected $fillable = [
        'source',
        'type',
        'description',
        'domain',
        'user_id',
        'email',
        'ip_address',
        'risk_score',
        'status',
        'message',
        'occurred_at',
        'read_at',
    ];

    protected $casts = [
        'risk_score' => 'integer',
        'occurred_at' => 'datetime',
        'read_at' => 'datetime',
    ];
}
