<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $user_id
 * @property string|null $extension_id
 * @property string $event
 * @property string|null $version
 * @property Carbon|null $occurred_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ExtensionLifecycle extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'extension_id',
        'event',
        'version',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
        ];
    }
}
