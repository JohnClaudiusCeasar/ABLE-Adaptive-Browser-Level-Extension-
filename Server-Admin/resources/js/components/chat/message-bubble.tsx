import { CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/date';
import type { ChatMessageData } from '@/types/chat';

export function MessageBubble({
    message,
    isOwn,
}: {
    message: ChatMessageData;
    isOwn: boolean;
}) {
    return (
        <div
            className={cn(
                'flex w-full',
                isOwn ? 'justify-end' : 'justify-start',
            )}
        >
            <div
                className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words shadow-sm',
                    isOwn
                        ? 'rounded-br-sm border border-[rgba(34,197,94,0.45)] bg-[rgba(34,197,94,0.15)] text-foreground'
                        : 'rounded-bl-sm border border-black/10 bg-white/60 text-foreground dark:border-white/10 dark:bg-[rgba(15,23,42,0.5)]',
                )}
            >
                <p className="whitespace-pre-wrap">{message.body}</p>
                <div
                    className={cn(
                        'mt-1 flex items-center gap-1 text-[0.68rem] text-muted-foreground',
                        isOwn ? 'justify-end' : 'justify-start',
                    )}
                >
                    <span>{formatTime(message.created_at)}</span>
                    {isOwn && (
                        <CheckCheck
                            size={13}
                            className={
                                message.read_at
                                    ? 'text-able-green'
                                    : 'text-muted-foreground/60'
                            }
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
