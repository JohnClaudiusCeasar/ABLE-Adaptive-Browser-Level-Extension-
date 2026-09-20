import { Head, router, usePage } from '@inertiajs/react';
import { CheckSquare, MessageSquarePlus, MessagesSquare, X } from 'lucide-react';
import { useState } from 'react';
import { ChatWindow } from '@/components/chat/chat-window';
import { ConversationList } from '@/components/chat/conversation-list';
import { UserList } from '@/components/chat/user-list';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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

    const [showRecipientPicker, setShowRecipientPicker] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [deleteSingleConfirm, setDeleteSingleConfirm] =
        useState<ChatConversationData | null>(null);
    const [deleteBulkConfirm, setDeleteBulkConfirm] = useState(false);

    function openConversation(next: ChatConversationData) {
        setShowRecipientPicker(false);

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

    function handleDeleteSingle(conversation: ChatConversationData) {
        setDeleteSingleConfirm(conversation);
    }

    function confirmDeleteSingle() {
        if (!deleteSingleConfirm) {
            return;
        }

        router.delete(`/chat/${deleteSingleConfirm.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                if (activeConversation?.id === deleteSingleConfirm.id) {
                    setActiveConversation(null, [], null);
                }

                setDeleteSingleConfirm(null);
            },
        });
    }

    function handleDeleteSelected() {
        if (selectedIds.size === 0) {
            return;
        }

        setDeleteBulkConfirm(true);
    }

    function confirmDeleteSelected() {
        router.delete('/chat-all', {
            data: { ids: [...selectedIds] },
            preserveScroll: true,
            onSuccess: () => {
                if (
                    activeConversation &&
                    selectedIds.has(activeConversation.id)
                ) {
                    setActiveConversation(null, [], null);
                }

                setSelectedIds(new Set());
                setSelectMode(false);
                setDeleteBulkConfirm(false);
            },
        });
    }

    function exitSelectMode() {
        setSelectMode(false);
        setSelectedIds(new Set());
    }

    return (
        <>
            <Head title="Chat" />
            {/* Chat Body - inbox floats above the content aligned with the chat window, chat window fills the viewport */}
            <div className="flex h-[calc(100vh-64px)] min-h-[480px] gap-3">
                {/* Inbox - inset from the sidebar and header via margin, shares the sidebar texture */}
                <div className="relative m-2 w-72 shrink-0">
                    <aside
                        className="h-full overflow-hidden bg-white/50 backdrop-blur-[10px] dark:bg-[rgba(15,23,42,0.35)]"
                        style={{
                            boxShadow: 'var(--sidebar-shadow)',
                        }}
                    >
                        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
                            <span
                                className="text-sm font-semibold tracking-wider text-foreground uppercase"
                                style={{
                                    fontFamily: "'Unbounded', sans-serif",
                                }}
                            >
                                Inbox
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() =>
                                        selectMode
                                            ? exitSelectMode()
                                            : setSelectMode(true)
                                    }
                                    aria-label={
                                        selectMode
                                            ? 'Exit selection mode'
                                            : 'Select conversations'
                                    }
                                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/10 hover:text-able-green"
                                >
                                    <CheckSquare size={15} />
                                </button>
                                {!selectMode && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowRecipientPicker(
                                                (prev) => !prev,
                                            )
                                        }
                                        aria-label="New chat"
                                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/10 hover:text-able-green"
                                    >
                                        <MessageSquarePlus size={15} />
                                        New
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 p-3">
                            <ConversationList
                                conversations={conversations}
                                activeId={activeConversation?.id ?? null}
                                onSelect={openConversation}
                                onDelete={handleDeleteSingle}
                                selectable={selectMode}
                                selectedIds={selectedIds}
                                onSelectionChange={setSelectedIds}
                            />
                        </div>
                    </aside>

                    {selectMode && selectedIds.size > 0 && (
                        <button
                            type="button"
                            onClick={handleDeleteSelected}
                            className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center border-t border-white/20 bg-gradient-to-t from-red-600 to-red-500 px-4 py-4 text-sm font-medium text-white shadow-[0_-4px_20px_rgba(239,68,68,0.4)] transition-all hover:from-red-700 hover:to-red-600 hover:shadow-[0_-4px_28px_rgba(239,68,68,0.55)]"
                        >
                            ({selectedIds.size}){' '}
                            {selectedIds.size === 1 ? 'Message' : 'Messages'}{' '}
                            Selected
                        </button>
                    )}
                </div>

                {/* Conversation window - takes up the remaining viewport */}
                <main className="relative flex min-w-0 flex-1 flex-col p-2">
                    {/* Floating New Message Overlay Layer */}
                    {showRecipientPicker && (
                        <div className="absolute top-4 left-4 z-40 w-[380px] sm:w-[420px] rounded-2xl border border-[rgba(34,197,94,0.45)] bg-white/95 p-3.5 shadow-[0_12px_40px_-5px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-[rgba(34,197,94,0.6)] dark:bg-[#15342a]/95">
                            <div className="flex items-center justify-between mb-2.5 px-1">
                                <span
                                    className="text-xs font-semibold tracking-wider text-foreground uppercase"
                                    style={{
                                        fontFamily: "'Unbounded', sans-serif",
                                    }}
                                >
                                    New Message
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowRecipientPicker(false)}
                                    aria-label="Close user picker"
                                    className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                            <UserList
                                users={users}
                                picker
                                onSelect={(user) => {
                                    setShowRecipientPicker(false);
                                    startConversation(user);
                                }}
                                placeholder="Search user by name or email..."
                            />
                        </div>
                    )}

                    <div className="min-w-0 flex-1 overflow-hidden">
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
                            <div className="flex h-full flex-col items-center justify-center gap-3 bg-white/50 text-muted-foreground backdrop-blur-[10px] dark:bg-[rgba(15,23,42,0.35)]">
                                <MessagesSquare
                                    size={40}
                                    className="text-able-green/60"
                                />
                                <p className="text-base">
                                    Select a conversation to start chatting
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <ConfirmDialog
                open={deleteSingleConfirm !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteSingleConfirm(null);
                    }
                }}
                title="Delete conversation"
                description={`Delete conversation with ${deleteSingleConfirm?.other_user?.name ?? 'Unknown'}?`}
                confirmLabel="Delete"
                onConfirm={confirmDeleteSingle}
            />

            <ConfirmDialog
                open={deleteBulkConfirm}
                onOpenChange={setDeleteBulkConfirm}
                title="Delete selected conversations"
                description={`Delete ${selectedIds.size} conversation(s)?`}
                confirmLabel={`Delete ${selectedIds.size}`}
                onConfirm={confirmDeleteSelected}
            />
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
