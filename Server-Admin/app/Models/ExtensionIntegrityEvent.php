<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $user_id
 * @property string|null $domain
 * @property string|null $reason
 * @property string|null $extension_id
 * @property string|null $version
 * @property string|null $event_id
 * @property Carbon|null $occurred_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ExtensionIntegrityEvent extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'domain',
        'reason',
        'extension_id',
        'version',
        'event_id',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
        ];
    }
}
