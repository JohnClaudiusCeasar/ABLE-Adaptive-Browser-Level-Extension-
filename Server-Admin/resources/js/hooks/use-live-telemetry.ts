import { router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { show as telemetryVersion } from '@/actions/App/Http/Controllers/TelemetryVersionController';

export type TelemetrySource = 'visits' | 'egress';

interface TelemetryLivePayload {
    version: Partial<Record<TelemetrySource, string>>;
    pollIntervalMs: number;
    enabled: boolean;
}

interface TelemetryLivePageProps {
    telemetryLive?: TelemetryLivePayload;
    [key: string]: unknown;
}

interface UseLiveTelemetryReturn {
    isLive: boolean;
    lastUpdatedAt: string | null;
    refresh: () => void;
}

function pickWatched(
    version: Partial<Record<TelemetrySource, string>> | undefined,
    watched: readonly TelemetrySource[],
): Record<string, string> {
    const picked: Record<string, string> = {};

    for (const source of watched) {
        picked[source] = version?.[source] ?? '';
    }

    return picked;
}

function watchedChanged(
    baseline: Record<string, string>,
    remote: Partial<Record<TelemetrySource, string>> | undefined,
    watched: readonly TelemetrySource[],
): boolean {
    for (const source of watched) {
        if ((remote?.[source] ?? '') !== (baseline[source] ?? '')) {
            return true;
        }
    }

    return false;
}

/**
 * Poll the telemetry fingerprint and reload the page when watched data moves.
 *
 * The fingerprint arrives as a shared prop, so the baseline is always the
 * data the current render was built with: a change that lands mid-render is
 * either already in the page or it moves the fingerprint and triggers a
 * reload, never both and never neither.
 */
export function useLiveTelemetry(
    watched: readonly TelemetrySource[],
): UseLiveTelemetryReturn {
    const { telemetryLive } = usePage<TelemetryLivePageProps>().props;

    const enabled = telemetryLive?.enabled ?? false;
    const pollIntervalMs = telemetryLive?.pollIntervalMs ?? 5000;
    const watchedKey = watched.join(',');

    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

    const baselineRef = useRef<Record<string, string>>({});
    const inFlightRef = useRef(false);

    // Rebase whenever the server renders a new fingerprint (initial page
    // load and every reload). Without this the poller would compare the
    // probe against a stale baseline and reload forever.
    const sharedVersion = telemetryLive?.version;

    useEffect(() => {
        baselineRef.current = pickWatched(
            sharedVersion,
            watchedKey.split(',').filter(Boolean) as TelemetrySource[],
        );
    }, [sharedVersion, watchedKey]);

    const refresh = useCallback(() => {
        setLastUpdatedAt(new Date().toISOString());
        router.reload();
    }, []);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        if (!watchedKey) {
            return;
        }

        let stopped = false;

        const check = async () => {
            if (stopped || inFlightRef.current) {
                return;
            }

            if (typeof document !== 'undefined' && document.hidden) {
                return;
            }

            inFlightRef.current = true;

            try {
                const response = await fetch(telemetryVersion.url(), {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    return;
                }

                const data = (await response.json()) as {
                    telemetryLive?: TelemetryLivePayload;
                };
                const watchedList = watchedKey
                    .split(',')
                    .filter(Boolean) as TelemetrySource[];

                if (
                    watchedChanged(
                        baselineRef.current,
                        data.telemetryLive?.version,
                        watchedList,
                    )
                ) {
                    if (!stopped) {
                        baselineRef.current = pickWatched(
                            data.telemetryLive?.version,
                            watchedList,
                        );
                        setLastUpdatedAt(new Date().toISOString());
                        router.reload();
                    }
                }
            } catch {
                // The next tick retries. A failed probe must never break
                // the page the operator is looking at.
            } finally {
                inFlightRef.current = false;
            }
        };

        const intervalId = window.setInterval(
            () => {
                void check();
            },
            Math.max(pollIntervalMs, 1000),
        );

        const handleFocus = () => {
            void check();
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            stopped = true;
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [enabled, pollIntervalMs, watchedKey]);

    return {
        isLive: enabled && watchedKey.length > 0,
        lastUpdatedAt,
        refresh,
    };
}
