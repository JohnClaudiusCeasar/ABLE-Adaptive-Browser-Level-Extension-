<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = [
        'source',
        'type',
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
