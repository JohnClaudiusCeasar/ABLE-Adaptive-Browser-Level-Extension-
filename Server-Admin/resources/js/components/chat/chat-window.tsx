import {
    ArrowLeft,
    ChevronUp,
    LoaderCircle,
    MessagesSquare,
    Minimize2,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { ChatAvatar } from '@/components/chat/avatar';
import { ChatMessageInput } from '@/components/chat/chat-message-input';
import { MessageBubble } from '@/components/chat/message-bubble';
import { ChatTimeDivider } from '@/components/chat/time-divider';
import { subscribeToConversation } from '@/lib/echo';
import { useChatMessages } from '@/lib/use-chat-messages';
import { cn } from '@/lib/utils';
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
    onClose,
    compact = false,
}: {
    conversation: ChatConversationData;
    initialMessages: ChatMessageData[];
    nextCursor?: string | null;
    currentUserId: number;
    onBack?: () => void;
    onClose?: () => void;
    compact?: boolean;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const otherUser: ChatUser | null = conversation.other_user;
    const autoLoadRef = useRef(false);
    const initialScrollDoneRef = useRef(false);
    const prevConversationIdRef = useRef(conversation.id);
    const prevMessagesLengthRef = useRef(0);
    const prevHeightRef = useRef<number>(0);
    const prevScrollTopRef = useRef<number>(0);

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

    // Reset initial scroll marker if conversation ID changes
    if (prevConversationIdRef.current !== conversation.id) {
        prevConversationIdRef.current = conversation.id;
        initialScrollDoneRef.current = false;
        prevHeightRef.current = 0;
        prevScrollTopRef.current = 0;
        prevMessagesLengthRef.current = 0;
    }

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

    // Scroll management for mount/reload, message arrival/send, and pagination.
    useEffect(() => {
        const el = scrollRef.current;

        if (!el) {
            return;
        }

        // 1. Initial mount / conversation open: unconditionally scroll to the bottom.
        if (!initialScrollDoneRef.current) {
            el.scrollTop = el.scrollHeight;
            requestAnimationFrame(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            });
            initialScrollDoneRef.current = true;
            prevHeightRef.current = el.scrollHeight;
            prevScrollTopRef.current = el.scrollTop;
            prevMessagesLengthRef.current = messages.length;

            return;
        }

        // 2. Pagination: older messages prepended to the top.
        if (
            prevHeightRef.current > 0 &&
            el.scrollHeight > prevHeightRef.current &&
            loadingMore
        ) {
            el.scrollTop =
                prevScrollTopRef.current +
                (el.scrollHeight - prevHeightRef.current);
        } else if (messages.length > prevMessagesLengthRef.current) {
            // 3. New message sent or received: scroll to bottom if near bottom.
            const nearBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight <=
                SCROLL_TO_BOTTOM_THRESHOLD;

            if (nearBottom) {
                el.scrollTop = el.scrollHeight;
                requestAnimationFrame(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                });
            }
        }

        prevHeightRef.current = el.scrollHeight;
        prevScrollTopRef.current = el.scrollTop;
        prevMessagesLengthRef.current = messages.length;
    }, [messages.length, loadingMore, conversation.id]);

    // Auto-load older messages when the user scrolls to the top.
    useEffect(() => {
        const el = scrollRef.current;

        if (!el) {
            return;
        }

        const scrollEl: HTMLDivElement = el;

        function onScroll() {
            // Do not trigger auto-load before initial scroll to bottom has settled.
            if (!initialScrollDoneRef.current) {
                return;
            }

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

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    const groupedMessages = useMemo(() => {
        let windowStartTime = 0;

        return messages.map((message, index) => {
            const msgTime = new Date(message.created_at).getTime();
            let showDivider = false;

            if (
                index === 0 ||
                !windowStartTime ||
                msgTime - windowStartTime >= TWENTY_FOUR_HOURS_MS
            ) {
                showDivider = true;
                windowStartTime = msgTime;
            }

            return {
                message,
                showDivider,
            };
        });
    }, [messages]);

    function onSend(body: string, attachment?: File | null) {
        send(body, attachment).then(() => {
            requestAnimationFrame(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            });
        });
    }

    return (
        <div
            className={cn(
                'relative flex h-full flex-col bg-white/90 shadow-[0_10px_40px_-5px_rgba(34,197,94,0.35)] backdrop-blur-[12px] dark:bg-[#1e4b3e]/95',
                compact
                    ? 'rounded-2xl border border-[rgba(34,197,94,0.45)] overflow-visible'
                    : 'rounded-none border-0 bg-white/50 backdrop-blur-[10px] dark:bg-[rgba(15,23,42,0.35)] shadow-none overflow-hidden',
            )}
        >
            {/* Header */}
            <div className={cn(
                'flex items-center justify-between border-b border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] px-4 py-3',
                compact && 'rounded-t-2xl',
            )}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label="Back to contacts"
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

                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Minimize chat"
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                    >
                        <Minimize2 size={16} />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
            >
                {hasMore && (
                    <div className="flex justify-center py-1.5">
                        <button
                            type="button"
                            onClick={() => loadMore()}
                            disabled={loadingMore}
                            className="flex items-center gap-2 rounded-full border border-[rgba(34,197,94,0.4)] bg-white/60 px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green disabled:opacity-50 dark:bg-[rgba(15,23,42,0.4)]"
                        >
                            {loadingMore ? (
                                <LoaderCircle
                                    size={16}
                                    className="animate-spin"
                                />
                            ) : (
                                <ChevronUp size={16} />
                            )}
                            {loadingMore
                                ? 'Loading...'
                                : 'Load earlier messages'}
                        </button>
                    </div>
                )}

                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground py-8">
                        <MessagesSquare size={compact ? 32 : 40} />
                        <p className={cn(
                            compact ? 'text-sm' : 'text-base',
                        )}>
                            Say hello to {otherUser?.name ?? 'your contact'}!
                        </p>
                    </div>
                ) : (
                    groupedMessages.map(({ message, showDivider }) => (
                        <Fragment key={message.id}>
                            {showDivider && (
                                <ChatTimeDivider
                                    timestamp={message.created_at}
                                    compact={compact}
                                />
                            )}
                            <MessageBubble
                                message={message}
                                isOwn={message.sender_id === currentUserId}
                                compact={compact}
                            />
                        </Fragment>
                    ))
                )}
            </div>

            {/* Composer */}
            <div
                className={cn(
                    'relative z-30 border-t border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.03)] px-4 py-3',
                    compact && 'rounded-b-2xl',
                )}
            >
                <ChatMessageInput
                    onSend={onSend}
                    disabled={sending}
                    autoFocus={!compact}
                    compact={compact}
                />
            </div>
        </div>
    );
}
