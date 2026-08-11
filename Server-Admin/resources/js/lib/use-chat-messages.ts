import { useCallback, useRef, useState } from 'react';
import { getCsrfToken } from '@/lib/echo';
import {
    mergeOlderMessages,
    setCursor,
    upsertMessage,
    useChatStore,
} from '@/lib/chat-store';
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
 * Messages and cursor state live in the module-level chat store (persisted to
 * sessionStorage), so the conversation window survives page navigation and
 * full reloads. Internally the list is kept newest-first (matching the API);
 * `messages` returns it reversed so the UI renders oldest-to-newest.
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
    const store = useChatStore();
    const matchesConversation = store.activeConversation?.id === conversationId;
    const [loadingMore, setLoadingMore] = useState(false);
    const [sending, setSending] = useState(false);
    const loadingMoreRef = useRef(false);

    // If the persisted window belongs to a different conversation, fall back
    // to the freshly supplied props for this window.
    const messages = matchesConversation
        ? store.activeMessages
        : initialMessages;
    const cursor = matchesConversation ? store.nextCursor : nextCursor;
    const hasMore = cursor !== null;

    /**
     * Load the next older page of history and prepend it.
     */
    const loadMore = useCallback(async () => {
        if (loadingMoreRef.current || cursor === null || !matchesConversation) {
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
            mergeOlderMessages(data.messages);
            setCursor(data.next_cursor);
        } catch {
            // Keep the current cursor so the user can retry.
        } finally {
            loadingMoreRef.current = false;
            setLoadingMore(false);
        }
    }, [conversationId, cursor, matchesConversation]);

    /**
     * Append a single message (live broadcast or local echo).
     */
    const appendMessage = useCallback((message: ChatMessageData) => {
        upsertMessage(message);
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
                upsertMessage(data.message);
            } finally {
                setSending(false);
            }
        },
        [conversationId],
    );

    // Oldest-first for rendering.
    const visibleMessages = dedupe([...messages].reverse());

    return {
        messages: visibleMessages,
        total: visibleMessages.length,
        hasMore,
        loadingMore,
        sending,
        loadMore,
        appendMessage,
        send,
    };
}
