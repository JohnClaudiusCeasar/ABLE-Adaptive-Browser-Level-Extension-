import { Head, router, usePage } from '@inertiajs/react';
import { CheckSquare, MessageSquarePlus, MessagesSquare, X } from 'lucide-react';
import { useState } from 'react';
import {
    index as confirmOptions,
    store as confirmStore,
} from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController';
import { ChatWindow } from '@/components/chat/chat-window';
import { ConversationList } from '@/components/chat/conversation-list';
import { UserList } from '@/components/chat/user-list';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { setActiveConversation, useChatStore } from '@/lib/chat-store';
import { getCsrfToken } from '@/lib/csrf';
import { cn } from '@/lib/utils';
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

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordProcessing, setPasswordProcessing] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

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

    async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!password) {
            setPasswordError('Please enter your password.');

            return;
        }

        setPasswordProcessing(true);
        setPasswordError(null);

        try {
            const res = await fetch('/user/confirm-password', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                setIsAuthenticated(true);
                setPassword('');
                setPasswordError(null);
            } else {
                const data = await res.json().catch(() => null);
                setPasswordError(
                    data?.errors?.password?.[0] ??
                        data?.message ??
                        'The provided password was incorrect.',
                );
            }
        } catch {
            setPasswordError('Failed to confirm password. Please try again.');
        } finally {
            setPasswordProcessing(false);
        }
    }

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

            {/* Full Content Area Container */}
            <div className="relative h-[calc(100vh-64px)] min-h-[480px] w-full overflow-hidden">
                {/* Chat Body - rendered behind overlay, blurred when unauthenticated */}
                <div
                    className={cn(
                        'flex h-full gap-3 transition-all duration-300',
                        !isAuthenticated &&
                            'pointer-events-none select-none filter blur-[8px] opacity-70 brightness-90',
                    )}
                    aria-hidden={!isAuthenticated}
                >
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

                {/* Unauthenticated Overlay and Password Confirmation Modal */}
                {!isAuthenticated && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
                        {/* Dark green ambient overlay backdrop that tints the viewport while keeping the blurred chat interface visible */}
                        <div className="absolute inset-0 bg-[#072418]/45 backdrop-blur-[1px] dark:bg-[#051c13]/55" />

                        {/* Original modal card wrapper */}
                        <div
                            className="relative z-10 w-full max-w-md rounded-xl border border-[rgba(34,197,94,0.7)] bg-[#0e271d]/90 p-8 md:p-10 shadow-[0_16px_50px_rgba(0,0,0,0.6),0_0_60px_rgba(34,197,94,0.15)] backdrop-blur-2xl dark:bg-[#0a2219]/95"
                            style={{ animation: 'authCardIn 0.5s ease forwards' }}
                        >
                            {/* Brand */}
                            <div className="mb-6 flex flex-col items-center">
                                <h1
                                    className="text-[2rem] font-bold tracking-widest text-foreground"
                                    style={{ fontFamily: "'Unbounded', sans-serif" }}
                                >
                                    ABL<span className="text-able-green">E</span>
                                </h1>
                                <p className="text-[0.85rem] text-muted-foreground">
                                    Adaptive Browser-Level Extension
                                </p>
                            </div>

                            <div className="flex flex-col gap-6">
                                {/* Title */}
                                <div className="space-y-2 text-center">
                                    <h2 className="text-xl font-medium text-foreground">
                                        Confirm password
                                    </h2>
                                    <p className="text-center text-sm text-muted-foreground">
                                        This is a secure area of the application. Please confirm your password before continuing.
                                    </p>
                                </div>

                                <PasskeyVerify
                                    routes={{
                                        options: confirmOptions(),
                                        submit: confirmStore(),
                                    }}
                                    label="Confirm with passkey"
                                    loadingLabel="Confirming..."
                                    separator="Or confirm with password"
                                    onSuccess={() => {
                                        setIsAuthenticated(true);
                                        setPassword('');
                                        setPasswordError(null);
                                    }}
                                />

                                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                                    <div className="grid gap-2">
                                        <Label htmlFor="chat-confirm-password">Password</Label>
                                        <PasswordInput
                                            id="chat-confirm-password"
                                            name="password"
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);

                                                if (passwordError) {
                                                    setPasswordError(null);
                                                }
                                            }}
                                            placeholder="Password"
                                            autoComplete="current-password"
                                            autoFocus
                                        />
                                        {passwordError && (
                                            <InputError message={passwordError} />
                                        )}
                                    </div>

                                    <div className="flex items-center">
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={passwordProcessing || !password}
                                        >
                                            {passwordProcessing && <Spinner />}
                                            Confirm password
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
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
