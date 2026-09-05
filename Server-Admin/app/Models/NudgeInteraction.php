<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $egress_event_id
 * @property string $domain
 * @property string|null $user_id
 * @property string $user_action
 * @property Carbon|null $interacted_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class NudgeInteraction extends Model
{
    /** @var list<string> */
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
     *
     * @return BelongsTo<EgressEvent, $this>
     */
    public function egressEvent(): BelongsTo
    {
        return $this->belongsTo(EgressEvent::class);
    }
}
