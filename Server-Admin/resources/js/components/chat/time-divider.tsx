import { formatDividerDate } from '@/lib/date';
import { cn } from '@/lib/utils';

export function ChatTimeDivider({
    timestamp,
    compact = false,
}: {
    timestamp: string;
    compact?: boolean;
}) {
    const { monthDay, time } = formatDividerDate(timestamp);

    if (!monthDay) {
        return null;
    }

    return (
        <div
            className={cn(
                'flex items-center gap-2.5 px-1 select-none',
                compact ? 'my-2.5' : 'my-4',
            )}
            role="separator"
            aria-label={`Timeframe starting ${monthDay} at ${time}`}
        >
            <div className="h-px flex-1 bg-[rgba(34,197,94,0.3)] dark:bg-[rgba(34,197,94,0.4)]" />
            <div
                className={cn(
                    'flex items-center gap-2 rounded-full border border-[rgba(34,197,94,0.35)] bg-white/85 font-medium text-muted-foreground shadow-sm backdrop-blur-[8px] dark:border-[rgba(34,197,94,0.5)] dark:bg-[rgba(15,23,42,0.7)]',
                    compact
                        ? 'px-3 py-0.5 text-[0.725rem]'
                        : 'px-4 py-1 text-xs',
                )}
            >
                <span className="font-semibold text-foreground/90">{monthDay}</span>
                <span
                    className={cn(
                        'rounded-full bg-able-green shrink-0 shadow-[0_0_6px_rgba(34,197,94,0.6)]',
                        compact ? 'h-1.5 w-1.5' : 'h-2 w-2',
                    )}
                />
                <span>{time}</span>
            </div>
            <div className="h-px flex-1 bg-[rgba(34,197,94,0.3)] dark:bg-[rgba(34,197,94,0.4)]" />
        </div>
    );
}
