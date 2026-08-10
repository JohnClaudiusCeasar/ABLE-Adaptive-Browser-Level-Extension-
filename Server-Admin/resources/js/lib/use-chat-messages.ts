import { useCallback, useRef, useState } from 'react';
import { getCsrfToken } from '@/lib/echo';
import type { ChatMessageData, ChatMessagesResponse } from '@/types/chat';

function dedupe(messages: ChatMessageData[]): ChatMessageData[] {
    const seen = new Set<number>();

    return messages.filter((message) => {
        if (seen.has(message.id)) {
            return false;
        }

        seen.add(message.id);

        return true;
    });
}

/**
 * Manages a conversation's message list with cursor-based pagination.
 *
 * Internally the list is kept newest-first (matching the API); `messages`
 * returns it reversed so the UI renders oldest-to-newest.
 *
 * The host component must remount this hook when the conversation changes
 * (e.g. by keying the ChatWindow on the conversation id).
 */
export function useChatMessages({
    conversationId,
    initialMessages = [],
    nextCursor = null,
}: {
    conversationId: number;
    initialMessages?: ChatMessageData[];
    nextCursor?: string | null;
}) {
    const [messages, setMessages] = useState<ChatMessageData[]>(() =>
        dedupe(initialMessages),
    );
    const [cursor, setCursor] = useState<string | null>(nextCursor);
    const [hasMore, setHasMore] = useState(nextCursor !== null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [sending, setSending] = useState(false);
    const loadingMoreRef = useRef(false);

    /**
     * Load the next older page of history and prepend it.
     */
    const loadMore = useCallback(async () => {
        if (loadingMoreRef.current || cursor === null) {
            return;
        }

        loadingMoreRef.current = true;
        setLoadingMore(true);

        try {
            const res = await fetch(
                `/chat/${conversationId}/messages?before=${cursor}`,
                {
                    headers: { Accept: 'application/json' },
                },
            );

            if (!res.ok) {
                throw new Error(`Load more failed: ${res.status}`);
            }

            const data = (await res.json()) as ChatMessagesResponse;

            setMessages((prev) => {
                // API is newest-first; reverse the older page, then merge.
                const older = [...data.messages].reverse();

                return dedupe([...older, ...prev]);
            });
            setCursor(data.next_cursor);
            setHasMore(data.next_cursor !== null);
        } catch {
            // Keep the current cursor so the user can retry.
        } finally {
            loadingMoreRef.current = false;
            setLoadingMore(false);
        }
    }, [conversationId, cursor]);

    /**
     * Append a single message (live broadcast or local echo).
     */
    const appendMessage = useCallback((message: ChatMessageData) => {
        setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) {
                return prev;
            }

            return dedupe([message, ...prev]);
        });
    }, []);

    /**
     * Send a message via plain fetch (no X-Inertia header) and echo the
     * persisted copy back into the list.
     */
    const send = useCallback(
        async (body: string) => {
            setSending(true);

            try {
                const res = await fetch(`/chat/${conversationId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': getCsrfToken(),
                    },
                    body: JSON.stringify({ body }),
                });

                if (!res.ok) {
                    throw new Error(`Send failed: ${res.status}`);
                }

                const data = (await res.json()) as { message: ChatMessageData };
                appendMessage(data.message);
            } finally {
                setSending(false);
            }
        },
        [conversationId, appendMessage],
    );

    /**
     * Re-fetch the most recent window of history (e.g. after a reconnect or
     * conversation switch).
     */
    const refresh = useCallback(async () => {
        try {
            const res = await fetch(`/chat/${conversationId}/messages`, {
                headers: { Accept: 'application/json' },
            });

            if (!res.ok) {
                throw new Error(`Refresh failed: ${res.status}`);
            }

            const data = (await res.json()) as ChatMessagesResponse;

            setMessages(dedupe(data.messages));
            setCursor(data.next_cursor);
            setHasMore(data.next_cursor !== null);
        } catch {
            // Keep whatever is loaded.
        }
    }, [conversationId]);

    // Oldest-first for rendering.
    const visibleMessages = [...messages].reverse();

    return {
        messages: visibleMessages,
        total: messages.length,
        hasMore,
        loadingMore,
        sending,
        loadMore,
        appendMessage,
        send,
        refresh,
    };
}
