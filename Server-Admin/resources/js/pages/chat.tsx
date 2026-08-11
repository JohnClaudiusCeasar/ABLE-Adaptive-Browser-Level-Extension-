import { Head, router, usePage } from '@inertiajs/react';
import { MessageSquarePlus, MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import { ChatWindow } from '@/components/chat/chat-window';
import { ConversationList } from '@/components/chat/conversation-list';
import { UserList } from '@/components/chat/user-list';
import { setActiveConversation, useChatStore } from '@/lib/chat-store';
import type {
    ChatConversationData,
    ChatMessageData,
    ChatUser,
} from '@/types/chat';

interface ChatPageProps {
    conversations: ChatConversationData[];
    users: ChatUser[];
    conversation?: ChatConversationData;
    messages?: ChatMessageData[];
    next_cursor?: string | null;
    [key: string]: unknown;
}

export default function Chat() {
    const { auth, conversation, conversations, messages, next_cursor, users } =
        usePage<ChatPageProps>().props;
    const currentUserId = auth.user.id;

    // The active conversation window is persisted in the chat store so it
    // survives navigating away and back. If the page deep-linked to a
    // conversation, seed the store with the server-rendered page.
    const store = useChatStore();

    const [seeded] = useState(() => {
        if (conversation && store.activeConversation?.id !== conversation.id) {
            setActiveConversation(
                conversation,
                messages ?? [],
                next_cursor ?? null,
            );
        }

        return true;
    });
    void seeded;

    const activeConversation =
        store.activeConversation ??
        conversations.find((c) => c.id === conversation?.id) ??
        null;

    const [showNewChat, setShowNewChat] = useState(false);

    function openConversation(next: ChatConversationData) {
        setShowNewChat(false);

        fetch(`/chat/${next.id}/messages`, {
            headers: { Accept: 'application/json' },
        })
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data) => {
                setActiveConversation(
                    next,
                    data.messages ?? [],
                    data.next_cursor ?? null,
                );
            })
            .catch(() => {
                setActiveConversation(next, [], null);
            });
    }

    function startConversation(user: ChatUser) {
        // Inertia router: follows the 302 to /chat/{conversation} as an
        // Inertia response, which is what the client expects.
        router.post(`/chat/with/${user.id}`, {}, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Chat" />
            <div className="mx-auto w-full max-w-[1200px] px-8 pt-12 pb-[22px]">
                {/* Page Header */}
                <header className="mb-6">
                    <h1
                        className="mb-2.5 text-[2.6rem] font-bold tracking-wide text-foreground uppercase"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        CHAT
                    </h1>
                    <p className="mb-6 text-[1.05rem] text-muted-foreground">
                        Real-time conversations with registered ABLE users.
                    </p>
                </header>

                {/* Chat Body */}
                <div className="flex h-[calc(100vh-260px)] min-h-[480px] gap-3">
                    {/* Chat-exclusive sidebar */}
                    <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-[rgba(34,197,94,0.35)] bg-white/50 backdrop-blur-[10px] dark:bg-[rgba(15,23,42,0.35)]">
                        <div className="flex items-center justify-between border-b border-[rgba(34,197,94,0.3)] px-4 py-3">
                            <span
                                className="text-sm font-semibold tracking-wider text-foreground uppercase"
                                style={{
                                    fontFamily: "'Unbounded', sans-serif",
                                }}
                            >
                                Inbox
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowNewChat((prev) => !prev)}
                                aria-label="New chat"
                                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/10 hover:text-able-green"
                            >
                                <MessageSquarePlus size={15} />
                                New
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 p-3">
                            {showNewChat && (
                                <div className="rounded-lg border border-[rgba(34,197,94,0.3)] bg-white/5 p-2">
                                    <div className="mb-1.5 px-1 text-[0.7rem] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                                        Start a conversation
                                    </div>
                                    <UserList
                                        users={users}
                                        onSelect={startConversation}
                                    />
                                </div>
                            )}
                            <ConversationList
                                conversations={conversations}
                                activeId={activeConversation?.id ?? null}
                                onSelect={openConversation}
                            />
                        </div>
                    </aside>

                    {/* Conversation window */}
                    <main className="min-w-0 flex-1">
                        {activeConversation ? (
                            <ChatWindow
                                key={activeConversation.id}
                                conversation={activeConversation}
                                initialMessages={
                                    store.activeConversation?.id ===
                                    activeConversation.id
                                        ? store.activeMessages
                                        : []
                                }
                                nextCursor={store.nextCursor}
                                currentUserId={currentUserId}
                            />
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-[rgba(34,197,94,0.35)] bg-white/50 text-muted-foreground backdrop-blur-[10px] dark:bg-[rgba(15,23,42,0.35)]">
                                <MessagesSquare
                                    size={40}
                                    className="text-able-green/60"
                                />
                                <p className="text-base">
                                    Select a conversation to start chatting
                                </p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </>
    );
}

Chat.layout = {
    breadcrumbs: [
        {
            title: 'Chat',
            href: '/chat',
        },
    ],
};
