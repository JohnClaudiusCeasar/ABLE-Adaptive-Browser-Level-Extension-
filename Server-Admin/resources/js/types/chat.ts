export type ChatUser = {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
};

export type ChatMessageData = {
    id: number;
    conversation_id: number;
    sender_id: number;
    body: string;
    attachment_url?: string | null;
    attachment_name?: string | null;
    attachment_size?: number | null;
    attachment_type?: string | null;
    created_at: string;
    read_at: string | null;
};

export type ChatConversationData = {
    id: number;
    path: string;
    other_user: ChatUser;
    last_message: string | null;
    last_message_at: string | null;
    unread_count: number;
};

/**
 * A page of message history returned by GET /chat/{conversation}/messages.
 * `messages` is newest-first; the client reverses it for rendering.
 */
export type ChatMessagesResponse = {
    conversation: ChatConversationData;
    messages: ChatMessageData[];
    next_cursor: string | null;
    total: number;
};
