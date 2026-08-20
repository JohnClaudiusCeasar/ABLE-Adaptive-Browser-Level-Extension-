<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class AuditLog extends Model
{
    protected $fillable = [
        'auditable_type',
        'auditable_id',
        'action',
        'user_id',
        'user_email',
        'data_changes',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'data_changes' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }
}
