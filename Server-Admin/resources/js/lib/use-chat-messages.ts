import { useCallback, useRef, useState } from 'react';
import {
    mergeOlderMessages,
    setCursor,
    upsertMessage,
    useChatStore,
} from '@/lib/chat-store';
import { getCsrfToken } from '@/lib/csrf';
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
    currentUserId,
}: {
    conversationId: number;
    initialMessages?: ChatMessageData[];
    nextCursor?: string | null;
    currentUserId?: number;
}) {
    const store = useChatStore();
    const matchesConversation = store.activeConversation?.id === conversationId;
    const [loadingMore, setLoadingMore] = useState(false);
    const [sending, setSending] = useState(false);
    const loadingMoreRef = useRef(false);

    // Maintain local message list that incorporates initialMessages, store messages, and optimistic sends
    const [localMessages, setLocalMessages] = useState<ChatMessageData[]>(
        () => {
            if (matchesConversation && store.activeMessages.length > 0) {
                return store.activeMessages;
            }

            return initialMessages;
        },
    );

    // Synchronize local messages whenever the source changes: the store for
    // the active conversation, or the messages the page was rendered with.
    //
    // The list is adjusted during render rather than in an effect. An effect
    // would render the chat window twice for every incoming message, and
    // writing state from an effect is what the React compiler rules forbid.
    const source: ChatMessageData[] | null =
        matchesConversation && store.activeMessages.length > 0
            ? store.activeMessages
            : initialMessages.length > 0
              ? initialMessages
              : null;

    const [syncedSource, setSyncedSource] = useState<ChatMessageData[] | null>(
        null,
    );

    if (source && source !== syncedSource) {
        setSyncedSource(source);

        setLocalMessages((prev) => {
            const incoming =
                matchesConversation && store.activeMessages.length > 0
                    ? store.activeMessages
                    : initialMessages;

            const optimistic = prev.filter((m) => m.id < 0);
            const known = new Set(incoming.map((m) => m.id));
            const extra = prev.filter(
                (m) =>
                    !known.has(m.id) &&
                    m.id > 0 &&
                    m.conversation_id === conversationId,
            );

            return dedupe([...optimistic, ...extra, ...incoming]);
        });
    }

    const cursor = matchesConversation ? store.nextCursor : nextCursor;
    const hasMore = cursor !== null;

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
            mergeOlderMessages(data.messages);
            setCursor(data.next_cursor);
            setLocalMessages((prev) => dedupe([...prev, ...data.messages]));
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
    const appendMessage = useCallback(
        (message: ChatMessageData) => {
            if (!message || message.conversation_id !== conversationId) {
                return;
            }

            upsertMessage(message);
            setLocalMessages((prev) => {
                const exists = prev.some((m) => m.id === message.id);

                return exists
                    ? prev.map((m) => (m.id === message.id ? message : m))
                    : [message, ...prev];
            });
        },
        [conversationId],
    );

    /**
     * Send a message (and optional attachment) via plain fetch (no X-Inertia header)
     * and echo the persisted copy back into the list.
     */
    const send = useCallback(
        async (body: string, attachment?: File | null) => {
            setSending(true);

            // Optimistic message so the user immediately sees what they typed
            const tempId = -Date.now();
            const optimisticMessage: ChatMessageData = {
                id: tempId,
                conversation_id: conversationId,
                sender_id: currentUserId ?? 0,
                body: body.trim(),
                attachment_name: attachment?.name ?? null,
                attachment_size: attachment?.size ?? null,
                attachment_type: attachment?.type ?? null,
                attachment_url:
                    attachment && attachment.type.startsWith('image/')
                        ? URL.createObjectURL(attachment)
                        : null,
                created_at: new Date().toISOString(),
                read_at: null,
            };

            setLocalMessages((prev) => [optimisticMessage, ...prev]);

            try {
                let res: Response;

                if (attachment) {
                    const formData = new FormData();

                    if (body.trim()) {
                        formData.append('body', body.trim());
                    }

                    formData.append('attachment', attachment);

                    res = await fetch(`/chat/${conversationId}/messages`, {
                        method: 'POST',
                        headers: {
                            Accept: 'application/json',
                            'X-CSRF-TOKEN': getCsrfToken(),
                        },
                        body: formData,
                    });
                } else {
                    res = await fetch(`/chat/${conversationId}/messages`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-CSRF-TOKEN': getCsrfToken(),
                        },
                        body: JSON.stringify({ body }),
                    });
                }

                if (!res.ok) {
                    throw new Error(`Send failed: ${res.status}`);
                }

                const data = (await res.json()) as { message: ChatMessageData };

                // Replace optimistic message with actual persisted message from server
                setLocalMessages((prev) => {
                    const filtered = prev.filter(
                        (m) => m.id !== tempId && m.id !== data.message.id,
                    );

                    return [data.message, ...filtered];
                });

                upsertMessage(data.message);

                return data.message;
            } catch (err) {
                // Remove optimistic message if send failed
                setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));

                throw err;
            } finally {
                setSending(false);
            }
        },
        [conversationId, currentUserId],
    );

    // Oldest-first for rendering.
    const visibleMessages = dedupe([...localMessages].reverse());

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
