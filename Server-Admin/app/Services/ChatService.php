<?php

namespace App\Services;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * The read side of the chat module.
 *
 * The conversation list is shared with the chat page and used by the Quick
 * Chat widget. It only needs one message per conversation — the newest — plus
 * a count of the unread ones, so the whole message history is never loaded.
 */
class ChatService
{
    /**
     * The conversations for the given user, most recent first.
     *
     * @return array<int, array<string, mixed>>
     */
    public function conversationsFor(User $user): array
    {
        $conversations = ChatConversation::query()
            ->where('user_one_id', $user->id)
            ->orWhere('user_two_id', $user->id)
            ->orderByDesc('last_message_at')
            ->with(['userOne', 'userTwo', 'latestMessage'])
            ->get();

        $unreadCounts = $this->unreadCountsFor($conversations, $user);

        return $conversations
            ->map(fn (ChatConversation $conversation) => $this->buildConversationData(
                $conversation,
                $user,
                $unreadCounts[$conversation->id] ?? 0,
            ))
            ->values()
            ->all();
    }

    /**
     * All registered users except the given user, for starting conversations.
     *
     * @return array<int, array<string, mixed>>
     */
    public function usersFor(User $user): array
    {
        return User::query()
            ->whereKeyNot($user->id)
            ->orderBy('name')
            ->get()
            ->map(fn (User $other) => $this->userData($other))
            ->values()
            ->all();
    }

    /**
     * The unread message count for the given user, across every conversation.
     */
    public function unreadCountFor(User $user): int
    {
        return ChatMessage::query()
            ->whereHas('conversation', function ($query) use ($user) {
                $query->where('user_one_id', $user->id)
                    ->orWhere('user_two_id', $user->id);
            })
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->count();
    }

    /**
     * Serializable conversation data from the perspective of the given user.
     *
     * @return array<string, mixed>
     */
    public function conversationData(ChatConversation $conversation, User $user): array
    {
        $unreadCount = ChatMessage::query()
            ->where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->count();

        return $this->buildConversationData($conversation, $user, (int) $unreadCount);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildConversationData(ChatConversation $conversation, User $user, int $unreadCount): array
    {
        $conversation->loadMissing(['userOne', 'userTwo']);
        $otherUser = $conversation->otherUser($user);

        $lastMessage = $conversation->latestMessage;

        $lastMessageText = null;
        if ($lastMessage instanceof ChatMessage) {
            $lastMessageText = ! empty($lastMessage->body)
                ? $lastMessage->body
                : ($lastMessage->attachment_name ? '📎 '.$lastMessage->attachment_name : 'Attachment');
        }

        return [
            'id' => $conversation->id,
            'path' => route('chat.show', $conversation),
            'other_user' => $otherUser !== null ? $this->userData($otherUser) : null,
            'last_message' => $lastMessageText,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'unread_count' => $unreadCount,
        ];
    }

    /**
     * The unread message count per conversation.
     *
     * Counting in the database keeps the whole message history out of memory:
     * the list only ever needs the newest message and a number.
     *
     * @param  Collection<int, ChatConversation>  $conversations
     * @return array<int, int>
     */
    private function unreadCountsFor(Collection $conversations, User $user): array
    {
        if ($conversations->isEmpty()) {
            return [];
        }

        return ChatMessage::query()
            ->whereIn('conversation_id', $conversations->modelKeys())
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->selectRaw('conversation_id, COUNT(*) as unread_count')
            ->groupBy('conversation_id')
            ->pluck('unread_count', 'conversation_id')
            ->map(fn ($count): int => (int) $count)
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function userData(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }
}
