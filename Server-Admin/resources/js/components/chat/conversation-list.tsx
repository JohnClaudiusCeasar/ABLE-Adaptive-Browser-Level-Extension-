import { Trash2 } from 'lucide-react';
import { ChatAvatar } from '@/components/chat/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { formatRelativeTime } from '@/lib/date';
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
    onDelete,
    selectable = false,
    selectedIds = new Set(),
    onSelectionChange,
}: {
    conversations: ChatConversationData[];
    activeId: number | null;
    onSelect: (conversation: ChatConversationData) => void;
    onDelete?: (conversation: ChatConversationData) => void;
    selectable?: boolean;
    selectedIds?: Set<number>;
    onSelectionChange?: (ids: Set<number>) => void;
}) {
    function toggleSelection(id: number) {
        if (!onSelectionChange) {
return;
}

        const next = new Set(selectedIds);

        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }

        onSelectionChange(next);
    }

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
                        <div
                            className={cn(
                                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                                active ? activeCardStyle : inactiveCardStyle,
                            )}
                        >
                            {selectable && (
                                <Checkbox
                                    checked={selectedIds.has(conversation.id)}
                                    onCheckedChange={() =>
                                        toggleSelection(conversation.id)
                                    }
                                    className="border-white/20"
                                    aria-label={`Select conversation with ${conversation.other_user?.name ?? 'Unknown'}`}
                                />
                            )}
                            <div
                                className="group/avatar relative h-9 w-9 shrink-0"
                                onClick={(e) => {
                                    if (selectable) {
                                        e.stopPropagation();
                                        toggleSelection(conversation.id);
                                    }
                                }}
                            >
                                <div
                                    className={cn(
                                        'transition-opacity duration-200',
                                        !selectable &&
                                            'group-hover/avatar:opacity-0',
                                    )}
                                >
                                    <ChatAvatar
                                        user={conversation.other_user}
                                    />
                                </div>
                                {!selectable && onDelete && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(conversation);
                                        }}
                                        aria-label={`Delete conversation with ${conversation.other_user?.name ?? 'Unknown'}`}
                                        className="absolute inset-0 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 opacity-0 transition-opacity duration-200 hover:bg-red-500/20 group-hover/avatar:opacity-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    selectable
                                        ? toggleSelection(conversation.id)
                                        : onSelect(conversation)
                                }
                                className="min-w-0 flex-1 text-left"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-sm font-medium text-foreground">
                                        {conversation.other_user?.name ??
                                            'Unknown'}
                                    </span>
                                    {conversation.last_message_at && (
                                        <span className="shrink-0 text-[0.68rem] text-muted-foreground">
                                            {formatRelativeTime(conversation.last_message_at)}
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
                            </button>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
