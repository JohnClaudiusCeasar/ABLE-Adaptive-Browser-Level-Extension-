<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NudgeInteraction extends Model
{
    protected $fillable = [
        'egress_event_id',
        'domain',
        'user_id',
        'user_action',
        'interacted_at',
    ];

    protected $casts = [
        'interacted_at' => 'datetime',
    ];

    /**
     * Get the egress event that owns this interaction.
     */
    public function egressEvent(): BelongsTo
    {
        return $this->belongsTo(EgressEvent::class);
    }
}
