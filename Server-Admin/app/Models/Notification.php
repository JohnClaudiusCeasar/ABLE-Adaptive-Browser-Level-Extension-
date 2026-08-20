<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Notification extends Model
{
    use SoftDeletes;

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
