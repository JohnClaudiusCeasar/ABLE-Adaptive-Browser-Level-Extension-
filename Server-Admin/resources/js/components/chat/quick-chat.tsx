import { router, usePage } from '@inertiajs/react';
import { MessageCircle, MessagesSquare, Minimize2, X } from 'lucide-react';
import { ChatWindow } from '@/components/chat/chat-window';
import { ConversationList } from '@/components/chat/conversation-list';
import { UserList } from '@/components/chat/user-list';
import {
    clearQuickChatConversation,
    openQuickChatConversation,
    setQuickChatOpen,
    useChatStore,
} from '@/lib/chat-store';
import type { ChatConversationData, ChatUser } from '@/types/chat';

type QuickChatProps = {
    conversations: ChatConversationData[];
    users: ChatUser[];
    unreadCount: number;
};

interface PageProps {
    auth: { user: { id: number } };
    chat?: QuickChatProps;
    [key: string]: unknown;
}

export function QuickChat() {
    const { auth, chat } = usePage<PageProps>().props;
    const currentUserId = auth.user?.id;
    const conversations = chat?.conversations ?? [];
    const users = chat?.users ?? [];
    const unreadCount = chat?.unreadCount ?? 0;

    const { quickChatOpen, activeConversation, activeMessages, nextCursor } =
        useChatStore();

    if (!currentUserId) {
        return null;
    }

    function openConversation(conversation: ChatConversationData) {
        fetch(`/chat/${conversation.id}/messages`, {
            headers: { Accept: 'application/json' },
        })
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data) => {
                openQuickChatConversation(
                    conversation,
                    data.messages ?? [],
                    data.next_cursor ?? null,
                );
            })
            .catch(() => {
                openQuickChatConversation(conversation, [], null);
            });
    }

    function startConversation(user: ChatUser) {
        router.post(`/chat/with/${user.id}`, {}, { preserveScroll: true });
    }

    function openFullChat() {
        router.visit('/chat');
    }

    return (
        <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3">
            {quickChatOpen && (
                <div className="w-[380px] overflow-hidden rounded-2xl border border-[rgba(34,197,94,0.45)] bg-white/90 shadow-[0_10px_40px_-5px_rgba(34,197,94,0.35)] backdrop-blur-[12px] dark:bg-[#1e4b3e]/95">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] px-4 py-3">
                        <div className="flex items-center gap-2">
                            <MessagesSquare
                                size={17}
                                className="text-able-green"
                            />
                            <span
                                className="text-sm font-semibold tracking-wider text-foreground uppercase"
                                style={{
                                    fontFamily: "'Unbounded', sans-serif",
                                }}
                            >
                                Quick Chat
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={openFullChat}
                                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-white/10 hover:text-able-green"
                            >
                                Open full chat
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickChatOpen(false)}
                                aria-label="Collapse quick chat"
                                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                            >
                                <Minimize2 size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    {activeConversation ? (
                        <div className="h-[420px] p-3">
                            <ChatWindow
                                conversation={activeConversation}
                                initialMessages={activeMessages}
                                nextCursor={nextCursor}
                                currentUserId={currentUserId}
                                compact
                                onBack={clearQuickChatConversation}
                            />
                        </div>
                    ) : (
                        <div className="max-h-[420px] overflow-y-auto p-3">
                            <div className="mb-2 px-1 text-[0.7rem] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                                Conversations
                            </div>
                            <ConversationList
                                conversations={conversations}
                                activeId={null}
                                onSelect={openConversation}
                            />
                            <div className="mx-auto my-3 w-4/5 border-t border-[rgba(34,197,94,0.3)]" />
                            <div className="mb-2 px-1 text-[0.7rem] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                                All Users
                            </div>
                            <UserList
                                users={users}
                                onSelect={startConversation}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Toggle bubble */}
            <button
                type="button"
                onClick={() => setQuickChatOpen(!quickChatOpen)}
                aria-label={
                    quickChatOpen ? 'Close quick chat' : 'Open quick chat'
                }
                className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(34,197,94,0.6)] bg-white/90 text-able-green shadow-[0_8px_30px_-5px_rgba(34,197,94,0.5)] backdrop-blur-[12px] transition-all hover:scale-105 hover:bg-[rgba(34,197,94,0.1)] dark:bg-[#1e4b3e]/95"
            >
                {quickChatOpen ? <X size={22} /> : <MessageCircle size={22} />}
                {unreadCount > 0 && !quickChatOpen && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[0.65rem] font-semibold text-white">
                        {unreadCount}
                    </span>
                )}
            </button>
        </div>
    );
}
