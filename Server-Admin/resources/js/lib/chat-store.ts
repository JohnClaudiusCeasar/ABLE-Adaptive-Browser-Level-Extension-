import { useSyncExternalStore } from 'react';
import type { ChatConversationData, ChatMessageData } from '@/types/chat';

const STORAGE_KEY = 'able.chat.session';

type ChatStore = {
    /**
     * The conversation currently open in the quick chat widget.
     */
    quickChatOpen: boolean;
    /**
     * The conversation the user was last reading, with the messages loaded
     * so far. Survives page navigation and full reloads.
     */
    activeConversation: ChatConversationData | null;
    activeMessages: ChatMessageData[];
    nextCursor: string | null;
    /**
     * The unread messages count indicator for quick chat.
     */
    unreadCount: number;
};

const initialState: ChatStore = {
    quickChatOpen: false,
    activeConversation: null,
    activeMessages: [],
    nextCursor: null,
    unreadCount: 0,
};

function loadInitialState(): ChatStore {
    if (typeof window === 'undefined') {
        return initialState;
    }

    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);

        if (raw === null) {
            return initialState;
        }

        return {
            ...initialState,
            ...(JSON.parse(raw) as Partial<ChatStore>),
        };
    } catch {
        return initialState;
    }
}

let state: ChatStore = loadInitialState();
const listeners = new Set<() => void>();

function persist() {
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Non-fatal; the store still works for the current page.
    }
}

function setState(
    update: Partial<ChatStore> | ((prev: ChatStore) => Partial<ChatStore>),
) {
    state = {
        ...state,
        ...(typeof update === 'function' ? update(state) : update),
    };
    persist();
    listeners.forEach((listener) => listener());
}

/**
 * Open a conversation in the quick chat widget and clear unread indicator.
 */
export function openQuickChatConversation(
    conversation: ChatConversationData,
    messages: ChatMessageData[],
    nextCursor: string | null,
) {
    setState({
        quickChatOpen: true,
        activeConversation: conversation,
        activeMessages: messages,
        nextCursor,
        unreadCount: 0,
    });
}

/**
 * Clear the conversation shown in the quick chat widget.
 */
export function clearQuickChatConversation() {
    setState({
        activeConversation: null,
        activeMessages: [],
        nextCursor: null,
    });
}

export function setQuickChatOpen(open: boolean) {
    setState((prev) => ({
        quickChatOpen: open,
        // When quick chat window is opened, vanish the notification indicator
        unreadCount: open ? 0 : prev.unreadCount,
    }));
}

/**
 * Clear/vanish the unread message notification indicator.
 */
export function clearUnreadCount() {
    setState({ unreadCount: 0 });
}

/**
 * Increment the unread count only when quick chat is closed.
 * Fallback condition: does nothing if quick chat window is opened.
 */
export function incrementUnreadCount() {
    setState((prev) => {
        if (prev.quickChatOpen) {
            return { unreadCount: 0 };
        }

        return { unreadCount: prev.unreadCount + 1 };
    });
}

/**
 * Set the unread count only when quick chat is closed.
 * Fallback condition: keeps 0 if quick chat window is opened.
 */
export function setUnreadCount(count: number) {
    setState((prev) => {
        if (prev.quickChatOpen) {
            return { unreadCount: 0 };
        }

        return { unreadCount: Math.max(0, count) };
    });
}

/**
 * Append (or replace) a message in the persisted conversation window.
 */
export function upsertMessage(message: ChatMessageData) {
    setState((prev) => {
        const exists = prev.activeMessages.some((m) => m.id === message.id);

        return {
            activeMessages: exists
                ? prev.activeMessages.map((m) =>
                      m.id === message.id ? message : m,
                  )
                : [message, ...prev.activeMessages],
        };
    });
}

/**
 * Merge an older page of history (newest-first from the API) into the
 * persisted window.
 */
export function mergeOlderMessages(older: ChatMessageData[]) {
    setState((prev) => {
        const known = new Set(prev.activeMessages.map((m) => m.id));
        const fresh = older.filter((m) => !known.has(m.id));

        return {
            // Older messages are prepended (they have smaller ids).
            activeMessages: dedupeStore([...fresh, ...prev.activeMessages]),
        };
    });
}

/**
 * Update the persisted "load more" cursor.
 */
export function setCursor(nextCursor: string | null) {
    setState({ nextCursor });
}

/**
 * Replace the persisted conversation window (used when switching or
 * restoring a conversation).
 */
export function setActiveConversation(
    conversation: ChatConversationData | null,
    messages: ChatMessageData[],
    nextCursor: string | null,
) {
    setState({
        activeConversation: conversation,
        activeMessages: dedupeStore(messages),
        nextCursor,
    });
}

function dedupeStore(messages: ChatMessageData[]): ChatMessageData[] {
    const seen = new Set<number>();

    return messages.filter((message) => {
        if (seen.has(message.id)) {
            return false;
        }

        seen.add(message.id);

        return true;
    });
}

export function useChatStore(): ChatStore {
    return useSyncExternalStore(
        (callback) => {
            listeners.add(callback);

            return () => listeners.delete(callback);
        },
        () => state,
    );
}
