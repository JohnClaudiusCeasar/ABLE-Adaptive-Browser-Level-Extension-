<?php

namespace App\Http\Middleware;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'chat' => $this->chatProps($request),
        ];
    }

    /**
     * The chat data shared with every page so the Quick Chat widget can
     * render without a dedicated request.
     *
     * @return array<string, mixed>
     */
    private function chatProps(Request $request): array
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user === null) {
            return [
                'conversations' => [],
                'users' => [],
                'unreadCount' => 0,
            ];
        }

        return [
            'conversations' => $this->conversationsFor($user),
            'users' => $this->usersFor($user),
            'unreadCount' => $this->unreadCountFor($user),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function conversationsFor(User $user): array
    {
        return ChatConversation::query()
            ->where('user_one_id', $user->id)
            ->orWhere('user_two_id', $user->id)
            ->orderByDesc('last_message_at')
            ->get()
            ->map(function (ChatConversation $conversation) use ($user) {
                $otherUser = $conversation->otherUser($user);
                $lastMessage = $conversation->messages()->latest('created_at')->first();

                return [
                    'id' => $conversation->id,
                    'path' => route('chat.show', $conversation),
                    'other_user' => $otherUser !== null ? $this->userData($otherUser) : null,
                    'last_message' => $lastMessage?->body,
                    'last_message_at' => $conversation->last_message_at?->diffForHumans(),
                    'unread_count' => $conversation->messages()
                        ->where('sender_id', '!=', $user->id)
                        ->whereNull('read_at')
                        ->count(),
                ];
            })
            ->values()
            ->all();
    }

    /**
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
     * @return array<string, mixed>
     */
    private function userData(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => $user->avatar_url,
        ];
    }
}
