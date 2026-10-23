import { RefreshCw } from 'lucide-react';
import { useLiveTelemetry } from '@/hooks/use-live-telemetry';
import type { TelemetrySource } from '@/hooks/use-live-telemetry';
import { formatRelativeTime } from '@/lib/date';
import { cn } from '@/lib/utils';

export type { TelemetrySource };

/**
 * The live-update pill shown on telemetry pages.
 *
 * A pulsing dot while the fingerprint poller is armed, the time of the last
 * refresh the poller triggered, and a manual refresh button for the moment
 * the operator does not want to wait for the next tick.
 */
export function LiveTelemetryStatus({
    watched,
    className,
}: {
    watched: readonly TelemetrySource[];
    className?: string;
}) {
    const { isLive, lastUpdatedAt, refresh } = useLiveTelemetry(watched);

    if (!isLive) {
        return null;
    }

    return (
        <div
            className={cn(
                'inline-flex items-center gap-2 rounded-full border border-able-green/30 bg-able-green/10 px-3 py-1 text-xs font-medium text-able-green',
                className,
            )}
            role="status"
            aria-live="polite"
        >
            <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-able-green opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-able-green" />
            </span>
            <span>Live</span>
            {lastUpdatedAt && (
                <span className="text-muted-foreground">
                    · updated {formatRelativeTime(lastUpdatedAt)}
                </span>
            )}
            <button
                type="button"
                onClick={refresh}
                title="Refresh now"
                aria-label="Refresh telemetry now"
                className="rounded-full p-0.5 transition-colors hover:bg-able-green/20"
            >
                <RefreshCw size={12} />
            </button>
        </div>
    );
}
