<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_one_id
 * @property int $user_two_id
 * @property Carbon|null $last_message_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['user_one_id', 'user_two_id', 'last_message_at'])]
class ChatConversation extends Model
{
    use HasFactory;

    /**
     * Get the first participant of the conversation.
     */
    public function userOne(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_one_id');
    }

    /**
     * Get the second participant of the conversation.
     */
    public function userTwo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_two_id');
    }

    /**
     * Get the messages belonging to the conversation.
     */
    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class, 'conversation_id');
    }

    /**
     * Determine whether the given user belongs to this conversation.
     */
    public function involves(User $user): bool
    {
        return $this->user_one_id === $user->id || $this->user_two_id === $user->id;
    }

    /**
     * Get the other participant of the conversation.
     */
    public function otherUser(User $user): ?User
    {
        /** @var User|null $other */
        $other = $this->user_one_id === $user->id ? $this->userTwo : $this->userOne;

        return $other;
    }

    /**
     * Find the conversation for a user pair, or create it.
     *
     * The lower user id is always stored in user_one_id so there is exactly
     * one row per pair, regardless of which user starts the conversation.
     */
    public static function forPair(User $first, User $second): self
    {
        [$userOne, $userTwo] = $first->id < $second->id ? [$first, $second] : [$second, $first];

        return self::firstOrCreate([
            'user_one_id' => $userOne->id,
            'user_two_id' => $userTwo->id,
        ]);
    }

    /**
     * Bump the last-message timestamp used to sort conversations.
     */
    public function touchLastMessage(): void
    {
        $this->update(['last_message_at' => now()]);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
        ];
    }
}
