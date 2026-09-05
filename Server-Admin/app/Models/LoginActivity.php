<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string $email
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property string $type
 * @property array<string, mixed>|null $metadata
 * @property Carbon|null $created_at
 */
class LoginActivity extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'email',
        'ip_address',
        'user_agent',
        'type',
        'metadata',
    ];

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
