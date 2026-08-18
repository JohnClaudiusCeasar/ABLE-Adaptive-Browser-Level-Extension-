<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ChatController extends Controller
{
    /**
     * The number of messages returned per page of history.
     */
    private const PAGE_SIZE = 10;

    /**
     * Display the Chat page with the user's conversations and all users.
     */
    public function index(): Response
    {
        $user = $this->authUser();

        return Inertia::render('chat', [
            'conversations' => $this->conversationsFor($user),
            'users' => $this->usersFor($user),
            'unreadCount' => $this->unreadCountFor($user),
        ]);
    }

    /**
     * Display the Chat page with a specific conversation open.
     */
    public function show(ChatConversation $conversation): Response
    {
        $user = $this->authUser();

        abort_unless($conversation->involves($user), 403);

        $this->markIncomingAsRead($conversation, $user);

        $page = $this->recentPage($conversation);

        return Inertia::render('chat', [
            'conversations' => $this->conversationsFor($user),
            'users' => $this->usersFor($user),
            'conversation' => $this->conversationData($conversation, $user),
            'messages' => $page['messages'],
            'next_cursor' => $page['next_cursor'],
            'total' => $conversation->messages()->count(),
            'unreadCount' => $this->unreadCountFor($user),
        ]);
    }

    /**
     * Find or create the conversation with the given user.
     */
    public function startConversation(User $user): RedirectResponse
    {
        $currentUser = $this->authUser();

        abort_if($user->id === $currentUser->id, 422);

        $conversation = ChatConversation::forPair($currentUser, $user);

        return redirect()->route('chat.show', $conversation);
    }

    /**
     * List the messages of a conversation (JSON, used by quick chat and the
     * full chat page). Returns the most recent page; pass ?before=<id> to
     * load an earlier page of history.
     */
    public function indexMessages(ChatConversation $conversation, Request $request): JsonResponse
    {
        $user = $this->authUser();

        abort_unless($conversation->involves($user), 403);

        $this->markIncomingAsRead($conversation, $user);

        $before = $request->integer('before') ?: null;
        $page = $this->recentPage($conversation, $before);

        return response()->json([
            'conversation' => $this->conversationData($conversation, $user),
            'messages' => $page['messages'],
            'next_cursor' => $page['next_cursor'],
            'total' => $conversation->messages()->count(),
        ]);
    }

    /**
     * Store a new message in the conversation and broadcast it.
     */
    public function store(ChatConversation $conversation, Request $request): JsonResponse
    {
        $user = $this->authUser();

        abort_unless($conversation->involves($user), 403);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $message = ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $user->id,
            'body' => trim($validated['body']),
        ]);

        $conversation->touchLastMessage();

        broadcast(new MessageSent($message))->toOthers();

        return response()->json([
            'message' => $this->messageData($message),
        ], 201);
    }

    /**
     * Get the total unread message count for the current user.
     */
    public function unreadCount(): JsonResponse
    {
        $user = $this->authUser();

        return response()->json([
            'count' => $this->unreadCountFor($user),
        ]);
    }

    /**
     * The currently authenticated user.
     */
    private function authUser(): User
    {
        /** @var User $user */
        $user = auth()->user();

        return $user;
    }

    /**
     * The conversations for the given user, most recent first.
     *
     * @return array<int, array<string, mixed>>
     */
    private function conversationsFor(User $user): array
    {
        return ChatConversation::query()
            ->where('user_one_id', $user->id)
            ->orWhere('user_two_id', $user->id)
            ->orderByDesc('last_message_at')
            ->with(['messages' => fn ($query) => $query->orderByDesc('created_at')])
            ->get()
            ->map(fn (ChatConversation $conversation) => $this->conversationData($conversation, $user))
            ->values()
            ->all();
    }

    /**
     * All registered users except the given user, for starting conversations.
     *
     * @return array<int, array<string, mixed>>
     */
    private function usersFor(User $user): array
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
     * One page of message history, newest-first. Fetches one extra row to
     * determine whether more history exists.
     *
     * @return array{messages: array<int, array<string, mixed>>, next_cursor: string|null}
     */
    private function recentPage(ChatConversation $conversation, ?int $before = null): array
    {
        $rows = $conversation->messages()
            ->when($before !== null, fn ($query) => $query->where('id', '<', $before))
            ->orderByDesc('id')
            ->limit(self::PAGE_SIZE + 1)
            ->get();

        $hasMore = $rows->count() > self::PAGE_SIZE;
        $page = $hasMore ? $rows->take(self::PAGE_SIZE) : $rows;
        $oldestId = $page->last()?->id;

        return [
            'messages' => $page->map(fn (ChatMessage $message) => $this->messageData($message))
                ->values()
                ->all(),
            'next_cursor' => $hasMore ? (string) $oldestId : null,
        ];
    }

    /**
     * Mark messages from the other participant as read.
     */
    private function markIncomingAsRead(ChatConversation $conversation, User $user): void
    {
        $conversation->messages()
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }

    /**
     * The unread message count for the given user.
     */
    private function unreadCountFor(User $user): int
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
     * The messages relation must be loaded (see conversationsFor) so the
     * last message and unread count can be derived without extra queries.
     * When it isn't loaded yet (single-conversation endpoints), it is
     * fetched here.
     *
     * @return array<string, mixed>
     */
    private function conversationData(ChatConversation $conversation, User $user): array
    {
        $otherUser = $conversation->otherUser($user);

        $messages = $conversation->relationLoaded('messages')
            ? $conversation->messages
            : $conversation->messages()->orderByDesc('created_at')->get();

        $lastMessage = $messages->first();
        $unreadCount = $messages
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->count();

        return [
            'id' => $conversation->id,
            'path' => route('chat.show', $conversation),
            'other_user' => $otherUser !== null ? $this->userData($otherUser) : null,
            'last_message' => $lastMessage?->body,
            'last_message_at' => $conversation->last_message_at?->diffForHumans(),
            'unread_count' => $unreadCount,
        ];
    }

    /**
     * Serializable user data.
     *
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

    /**
     * Serializable message data.
     *
     * @return array<string, mixed>
     */
    private function messageData(ChatMessage $message): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'sender_id' => $message->sender_id,
            'body' => $message->body,
            'time' => $message->created_at?->format('g:i A'),
            'created_at' => $message->created_at?->toIso8601String(),
            'read_at' => $message->read_at?->toIso8601String(),
        ];
    }
}
