import { CheckCheck, Download, FileText } from 'lucide-react';
import { formatTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { ChatMessageData } from '@/types/chat';

function isImageAttachment(
    type?: string | null,
    name?: string | null,
): boolean {
    if (type && type.startsWith('image/')) {
        return true;
    }
    if (name) {
        const ext = name.split('.').pop()?.toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(
            ext ?? '',
        );
    }
    return false;
}

function formatBytes(bytes?: number | null): string {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function MessageBubble({
    message,
    isOwn,
    compact = false,
}: {
    message: ChatMessageData;
    isOwn: boolean;
    compact?: boolean;
}) {
    const isImage = isImageAttachment(
        message.attachment_type,
        message.attachment_name,
    );

    return (
        <div
            className={cn(
                'flex w-full',
                isOwn ? 'justify-end' : 'justify-start',
            )}
        >
            <div
                className={cn(
                    'max-w-[85%] leading-relaxed break-words shadow-sm',
                    compact
                        ? 'rounded-2xl px-4 py-2.5 text-[0.95rem]'
                        : 'rounded-3xl px-5 py-3.5 text-[1.125rem]',
                    isOwn
                        ? 'rounded-br-md border border-[rgba(34,197,94,0.45)] bg-[rgba(34,197,94,0.15)] text-foreground'
                        : 'rounded-bl-md border border-black/10 bg-white/60 text-foreground dark:border-white/10 dark:bg-[rgba(15,23,42,0.5)]',
                )}
            >
                {/* Image attachment */}
                {message.attachment_url && isImage && (
                    <div className={cn(
                        'mb-2.5 overflow-hidden border border-black/10 dark:border-white/10',
                        compact ? 'rounded-xl' : 'rounded-2xl',
                    )}>
                        <a
                            href={message.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group"
                        >
                            <img
                                src={message.attachment_url}
                                alt={message.attachment_name ?? 'Attached image'}
                                className={cn(
                                    'w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]',
                                    compact ? 'max-h-64' : 'max-h-80',
                                )}
                                loading="lazy"
                            />
                        </a>
                    </div>
                )}

                {/* Non-image file attachment */}
                {message.attachment_url && !isImage && (
                    <div className="mb-2.5">
                        <a
                            href={message.attachment_url}
                            download={message.attachment_name ?? true}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                                'flex items-center gap-3 border border-black/10 bg-black/5 transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10',
                                compact ? 'rounded-xl p-2.5 text-sm' : 'rounded-2xl p-3 text-sm',
                            )}
                        >
                            <div className={cn(
                                'flex shrink-0 items-center justify-center bg-able-green/20 text-able-green',
                                compact ? 'h-9 w-9 rounded-lg' : 'h-11 w-11 rounded-xl',
                            )}>
                                <FileText size={compact ? 20 : 25} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={cn(
                                    'truncate font-medium text-foreground',
                                    compact ? 'text-sm' : 'text-base',
                                )}>
                                    {message.attachment_name ?? 'Download file'}
                                </p>
                                {message.attachment_size && (
                                    <p className="text-xs text-muted-foreground">
                                        {formatBytes(message.attachment_size)}
                                    </p>
                                )}
                            </div>
                            <Download
                                size={compact ? 17 : 21}
                                className="text-muted-foreground shrink-0"
                            />
                        </a>
                    </div>
                )}

                {/* Text Body */}
                {message.body && (
                    <p className="whitespace-pre-wrap">{message.body}</p>
                )}

                {/* Timestamp & Read Receipts */}
                <div
                    className={cn(
                        'mt-1.5 flex items-center gap-1.5 text-muted-foreground',
                        compact ? 'text-[0.75rem]' : 'text-[0.85rem]',
                        isOwn ? 'justify-end' : 'justify-start',
                    )}
                >
                    <span>{formatTime(message.created_at)}</span>
                    {isOwn && (
                        <CheckCheck
                            size={compact ? 15 : 18}
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
