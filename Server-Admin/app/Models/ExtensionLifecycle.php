<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExtensionLifecycle extends Model
{
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
