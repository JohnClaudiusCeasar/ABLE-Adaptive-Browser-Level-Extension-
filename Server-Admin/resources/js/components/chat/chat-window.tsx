import {
    ArrowLeft,
    ChevronUp,
    LoaderCircle,
    MessagesSquare,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ChatAvatar } from '@/components/chat/avatar';
import { ChatMessageInput } from '@/components/chat/chat-message-input';
import { MessageBubble } from '@/components/chat/message-bubble';
import { subscribeToConversation } from '@/lib/echo';
import { useChatMessages } from '@/lib/use-chat-messages';
import type {
    ChatConversationData,
    ChatMessageData,
    ChatUser,
} from '@/types/chat';

const SCROLL_TO_BOTTOM_THRESHOLD = 120;
const AUTO_LOAD_TOP_THRESHOLD = 40;

export function ChatWindow({
    conversation,
    initialMessages,
    nextCursor,
    currentUserId,
    onBack,
    compact = false,
}: {
    conversation: ChatConversationData;
    initialMessages: ChatMessageData[];
    nextCursor?: string | null;
    currentUserId: number;
    onBack?: () => void;
    compact?: boolean;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const otherUser: ChatUser | null = conversation.other_user;
    const autoLoadRef = useRef(false);

    const {
        messages,
        hasMore,
        loadingMore,
        sending,
        loadMore,
        appendMessage,
        send,
    } = useChatMessages({
        conversationId: conversation.id,
        initialMessages,
        nextCursor,
    });

    // Subscribe to real-time messages on this conversation.
    useEffect(() => {
        const unsubscribe = subscribeToConversation(
            conversation.id,
            (message) => {
                appendMessage(message);
            },
        );

        return unsubscribe;
    }, [conversation.id, appendMessage]);

    // Scroll to the bottom when the conversation opens or a new message
    // arrives while the user is already near the bottom.
    useEffect(() => {
        const el = scrollRef.current;

        if (!el) {
            return;
        }

        const nearBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight <=
            SCROLL_TO_BOTTOM_THRESHOLD;

        if (nearBottom) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages.length]);

    // Auto-load older messages when the user scrolls to the top.
    useEffect(() => {
        const el = scrollRef.current;

        if (!el) {
            return;
        }

        const scrollEl: HTMLDivElement = el;

        function onScroll() {
            if (
                scrollEl.scrollTop <= AUTO_LOAD_TOP_THRESHOLD &&
                hasMore &&
                !loadingMore &&
                !autoLoadRef.current
            ) {
                autoLoadRef.current = true;
                loadMore().finally(() => {
                    autoLoadRef.current = false;
                });
            }
        }

        scrollEl.addEventListener('scroll', onScroll);

        return () => scrollEl.removeEventListener('scroll', onScroll);
    }, [hasMore, loadingMore, loadMore]);

    // Preserve scroll position when older messages are prepended.
    const prevHeightRef = useRef<number>(0);
    const prevScrollTopRef = useRef<number>(0);

    useEffect(() => {
        const el = scrollRef.current;

        if (!el) {
            return;
        }

        if (
            prevHeightRef.current > 0 &&
            el.scrollHeight > prevHeightRef.current
        ) {
            el.scrollTop =
                prevScrollTopRef.current +
                (el.scrollHeight - prevHeightRef.current);
        }

        prevHeightRef.current = el.scrollHeight;
        prevScrollTopRef.current = el.scrollTop;
    }, [messages.length]);

    function onSend(body: string) {
        send(body);
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-white/50 backdrop-blur-[10px] dark:bg-[rgba(15,23,42,0.35)]">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-[rgba(34,197,94,0.3)] px-4 py-3">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back"
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                    >
                        <ArrowLeft size={16} />
                    </button>
                )}
                <ChatAvatar user={otherUser} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                        {otherUser?.name ?? 'Unknown'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                        {otherUser?.email ?? ''}
                    </p>
                </div>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
            >
                {hasMore && (
                    <div className="flex justify-center py-1">
                        <button
                            type="button"
                            onClick={() => loadMore()}
                            disabled={loadingMore}
                            className="flex items-center gap-1.5 rounded-full border border-[rgba(34,197,94,0.4)] bg-white/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green disabled:opacity-50 dark:bg-[rgba(15,23,42,0.4)]"
                        >
                            {loadingMore ? (
                                <LoaderCircle
                                    size={13}
                                    className="animate-spin"
                                />
                            ) : (
                                <ChevronUp size={13} />
                            )}
                            {loadingMore
                                ? 'Loading...'
                                : 'Load earlier messages'}
                        </button>
                    </div>
                )}

                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <MessagesSquare size={28} />
                        <p className="text-sm">
                            Say hello to {otherUser?.name ?? 'your contact'}!
                        </p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <MessageBubble
                            key={message.id}
                            message={message}
                            isOwn={message.sender_id === currentUserId}
                        />
                    ))
                )}
            </div>

            {/* Composer */}
            <div className="border-t border-[rgba(34,197,94,0.3)] px-4 py-3">
                <ChatMessageInput
                    onSend={onSend}
                    disabled={sending}
                    autoFocus={!compact}
                />
            </div>
        </div>
    );
}
