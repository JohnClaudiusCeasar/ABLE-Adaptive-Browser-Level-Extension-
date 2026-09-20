<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $conversation_id
 * @property int $sender_id
 * @property string|null $body
 * @property string|null $attachment_path
 * @property string|null $attachment_name
 * @property int|null $attachment_size
 * @property string|null $attachment_type
 * @property Carbon|null $read_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['conversation_id', 'sender_id', 'body', 'attachment_path', 'attachment_name', 'attachment_size', 'attachment_type', 'read_at'])]
class ChatMessage extends Model
{
    /**
     * Get the conversation the message belongs to.
     *
     * @return BelongsTo<ChatConversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(ChatConversation::class);
    }

    /**
     * Get the user who sent the message.
     *
     * @return BelongsTo<User, $this>
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
        ];
    }
}
