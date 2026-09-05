<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $auditable_type
 * @property int $auditable_id
 * @property string $action
 * @property int|null $user_id
 * @property string|null $user_email
 * @property array<string, mixed>|null $data_changes
 * @property Carbon|null $occurred_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class AuditLog extends Model
{
    /** @var list<string> */
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

    /**
     * @return MorphTo<Model, $this>
     */
    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }
}
