import { usePage } from '@inertiajs/react';
import { MessageCircle, MessagesSquare, Minimize2, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    index as confirmOptions,
    store as confirmStore,
} from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController';
import { ChatWindow } from '@/components/chat/chat-window';
import { UserList } from '@/components/chat/user-list';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
    clearQuickChatConversation,
    clearUnreadCount,
    incrementUnreadCount,
    openQuickChatConversation,
    setQuickChatOpen,
    setUnreadCount,
    useChatStore,
} from '@/lib/chat-store';
import { getCsrfToken } from '@/lib/csrf';
import { subscribeToUser } from '@/lib/echo';
import type { ChatConversationData, ChatUser } from '@/types/chat';

type QuickChatProps = {
    conversations?: ChatConversationData[];
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
    const users = chat?.users ?? [];

    const {
        quickChatOpen,
        activeConversation,
        activeMessages,
        nextCursor,
        unreadCount,
    } = useChatStore();

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordProcessing, setPasswordProcessing] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const initialSyncedRef = useRef(false);

    // Sync initial unread count once on mount from server props (if quick chat is closed)
    useEffect(() => {
        if (!initialSyncedRef.current) {
            initialSyncedRef.current = true;

            if (!quickChatOpen && typeof chat?.unreadCount === 'number' && chat.unreadCount > 0) {
                setUnreadCount(chat.unreadCount);
            }
        }
    }, [chat?.unreadCount, quickChatOpen]);

    // Listen for incoming messages across all conversations in real-time
    useEffect(() => {
        if (!currentUserId) {
            return;
        }

        const unsubscribe = subscribeToUser(currentUserId, (message) => {
            // Only fire/increment notification indicator for messages from other users
            // Fallback condition: only fires when quick chat is closed (handled in incrementUnreadCount)
            if (message.sender_id !== currentUserId) {
                incrementUnreadCount();
            }
        });

        return unsubscribe;
    }, [currentUserId]);

    if (!currentUserId) {
        return null;
    }

    function handleUnlockSuccess() {
        setIsAuthenticated(true);
        setPassword('');
        setPasswordError(null);
        clearUnreadCount();

        // Persist read status to backend so server props also stay 0
        fetch('/chat/read-all', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
            },
        }).catch(() => {});
    }

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
                handleUnlockSuccess();
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

    function handleCloseQuickChat() {
        setQuickChatOpen(false);
        setIsAuthenticated(false);
        setPassword('');
        setPasswordError(null);
    }

    function handleToggleQuickChat() {
        if (!quickChatOpen) {
            setIsAuthenticated(false);
            setPassword('');
            setPasswordError(null);
            setQuickChatOpen(true);
        } else {
            handleCloseQuickChat();
        }
    }

    async function startConversation(user: ChatUser) {
        try {
            const res = await fetch(`/chat/with/${user.id}`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
            });

            if (!res.ok) {
                throw new Error(`Failed to start conversation: ${res.status}`);
            }

            const data = await res.json();
            openQuickChatConversation(
                data.conversation,
                data.messages ?? [],
                data.next_cursor ?? null,
            );
        } catch (error) {
            console.error('Error starting quick chat conversation:', error);
        }
    }

    return (
        <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3">
            {quickChatOpen && (
                <>
                    {!isAuthenticated ? (
                        /* Password Confirmation Modal for Quick Chat */
                        <div className="w-[380px] overflow-hidden rounded-2xl border border-[rgba(34,197,94,0.45)] bg-white/90 shadow-[0_10px_40px_-5px_rgba(34,197,94,0.35)] backdrop-blur-[12px] dark:bg-[#1e4b3e]/95">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck
                                        size={17}
                                        className="text-able-green"
                                    />
                                    <span
                                        className="text-sm font-semibold tracking-wider text-foreground uppercase"
                                        style={{
                                            fontFamily:
                                                "'Unbounded', sans-serif",
                                        }}
                                    >
                                        Confirm Password
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={handleCloseQuickChat}
                                        aria-label="Collapse quick chat"
                                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                                    >
                                        <Minimize2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="space-y-4 p-4">
                                <p className="text-xs text-muted-foreground">
                                    This is a secure area of the application. Please confirm your password before continuing.
                                </p>

                                <PasskeyVerify
                                    routes={{
                                        options: confirmOptions(),
                                        submit: confirmStore(),
                                    }}
                                    label="Confirm with passkey"
                                    loadingLabel="Confirming..."
                                    separator="Or confirm with password"
                                    onSuccess={() => handleUnlockSuccess()}
                                />

                                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="quick-chat-password">Password</Label>
                                        <PasswordInput
                                            id="quick-chat-password"
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

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={passwordProcessing || !password}
                                    >
                                        {passwordProcessing && <Spinner />}
                                        Confirm password
                                    </Button>
                                </form>
                            </div>
                        </div>
                    ) : activeConversation ? (
                        /* Dedicated message window without the outer Quick Chat wrapper */
                        <div className="relative h-[480px] w-[380px] overflow-visible">
                            <ChatWindow
                                conversation={activeConversation}
                                initialMessages={activeMessages}
                                nextCursor={nextCursor}
                                currentUserId={currentUserId}
                                compact
                                onBack={clearQuickChatConversation}
                                onClose={handleCloseQuickChat}
                            />
                        </div>
                    ) : (
                        /* User selection modal */
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
                                            fontFamily:
                                                "'Unbounded', sans-serif",
                                        }}
                                    >
                                        Conversations
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={handleCloseQuickChat}
                                        aria-label="Collapse quick chat"
                                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                                    >
                                        <Minimize2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Body - All Users */}
                            <div className="max-h-[420px] overflow-y-auto p-3">
                                <div className="mb-2 px-1 text-[0.7rem] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                                    All Users
                                </div>
                                <UserList
                                    users={users}
                                    onSelect={startConversation}
                                />
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Toggle bubble */}
            <button
                type="button"
                onClick={handleToggleQuickChat}
                aria-label={
                    quickChatOpen ? 'Close quick chat' : 'Open quick chat'
                }
                className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(34,197,94,0.6)] bg-white/90 text-able-green shadow-[0_8px_30px_-5px_rgba(34,197,94,0.5)] backdrop-blur-[12px] transition-all hover:scale-105 hover:bg-[rgba(34,197,94,0.1)] dark:bg-[#1e4b3e]/95"
            >
                {quickChatOpen ? <X size={22} /> : <MessageCircle size={22} />}
                {unreadCount > 0 && !quickChatOpen && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[0.65rem] font-semibold text-white shadow-md animate-in fade-in zoom-in duration-200">
                        {unreadCount}
                    </span>
                )}
            </button>
        </div>
    );
}
