import { ChatAvatar } from '@/components/chat/avatar';
import { cn } from '@/lib/utils';
import type { ChatConversationData } from '@/types/chat';

const activeCardStyle =
    'bg-white/5 border border-able-green/60 shadow-[0_0_15px_rgba(34,197,94,0.25)]';
const inactiveCardStyle =
    'bg-transparent border border-transparent hover:bg-white/5';

export function ConversationList({
    conversations,
    activeId,
    onSelect,
}: {
    conversations: ChatConversationData[];
    activeId: number | null;
    onSelect: (conversation: ChatConversationData) => void;
}) {
    return (
        <ul className="flex flex-col gap-1.5">
            {conversations.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No conversations yet.
                </li>
            )}
            {conversations.map((conversation) => {
                const active = conversation.id === activeId;

                return (
                    <li key={conversation.id} className="list-none">
                        <button
                            type="button"
                            onClick={() => onSelect(conversation)}
                            className={cn(
                                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                                active ? activeCardStyle : inactiveCardStyle,
                            )}
                        >
                            <ChatAvatar user={conversation.other_user} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-sm font-medium text-foreground">
                                        {conversation.other_user?.name ??
                                            'Unknown'}
                                    </span>
                                    {conversation.last_message_at && (
                                        <span className="shrink-0 text-[0.68rem] text-muted-foreground">
                                            {conversation.last_message_at}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-xs text-muted-foreground">
                                        {conversation.last_message ??
                                            'No messages yet'}
                                    </span>
                                    {conversation.unread_count > 0 && (
                                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-able-green px-1.5 text-[0.65rem] font-semibold text-white">
                                            {conversation.unread_count}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
