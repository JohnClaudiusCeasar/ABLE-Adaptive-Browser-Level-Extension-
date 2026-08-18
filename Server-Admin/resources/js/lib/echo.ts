import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import type { ChatMessageData } from '@/types/chat';

declare global {
    interface Window {
        Echo?: Echo<'reverb'>;
        Pusher?: typeof Pusher;
    }
}

let echo: Echo<'reverb'> | null = null;

/**
 * Lazily create the Echo instance bound to the local Reverb server.
 * Guarded for SSR (no window) and repeated calls.
 */
export function getEcho(): Echo<'reverb'> | null {
    if (typeof window === 'undefined') {
        return null;
    }

    if (echo) {
        return echo;
    }

    if (!window.Pusher) {
        window.Pusher = Pusher;
    }

    echo = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: import.meta.env.VITE_REVERB_HOST || '127.0.0.1',
        wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
        wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
        forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https',
        enabledTransports: ['ws', 'wss'],
    });

    return echo;
}

export type MessageSentPayload = {
    message: ChatMessageData;
};

/**
 * Subscribe to a conversation channel and invoke the handler for each
 * incoming message. Returns an unsubscribe function.
 */
export function subscribeToConversation(
    conversationId: number,
    onMessage: (message: ChatMessageData) => void,
): () => void {
    const instance = getEcho();

    if (!instance) {
        return () => {};
    }

    const channel = instance.private(`chat.${conversationId}`);
    channel.listen('.message.sent', (payload: MessageSentPayload) => {
        onMessage(payload.message);
    });

    return () => {
        channel.stopListening('.message.sent');
        instance.leaveChannel(`private-chat.${conversationId}`);
    };
}
