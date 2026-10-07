import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const WARNING_WINDOW_MS = 30 * 1000; // 30 seconds
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
const CHANNEL_NAME = 'able_session_sync';

export function useInactivityTimeout(enabled: boolean = true) {
    const [isWarningOpen, setIsWarningOpen] = useState(false);
    const [secondsRemaining, setSecondsRemaining] = useState(30);

    const lastActivityRef = useRef<number>(Date.now());
    const lastHeartbeatRef = useRef<number>(Date.now());
    const channelRef = useRef<BroadcastChannel | null>(null);

    // Send heartbeat to backend
    const sendHeartbeat = useCallback(async () => {
        try {
            await fetch('/session/heartbeat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') || '',
                },
            });
            lastHeartbeatRef.current = Date.now();
        } catch {
            // Heartbeat failure ignored gracefully
        }
    }, []);

    // Perform logout when idle expires
    const performLogout = useCallback(() => {
        setIsWarningOpen(false);
        router.post(
            '/logout',
            {},
            {
                onFinish: () => {
                    window.location.href =
                        '/login?status=' +
                        encodeURIComponent(
                            'You were logged out due to 5 minutes of inactivity.'
                        );
                },
            }
        );
    }, []);

    // Reset inactivity timer
    const resetTimer = useCallback(
        (broadcast: boolean = true) => {
            const now = Date.now();
            lastActivityRef.current = now;
            setIsWarningOpen(false);
            setSecondsRemaining(Math.ceil(WARNING_WINDOW_MS / 1000));

            // If heartbeat interval passed, send heartbeat
            if (now - lastHeartbeatRef.current >= HEARTBEAT_INTERVAL_MS) {
                sendHeartbeat();
            }

            if (broadcast && channelRef.current) {
                try {
                    channelRef.current.postMessage({
                        type: 'ACTIVITY',
                        timestamp: now,
                    });
                } catch {
                    // Channel post error ignored
                }
            }
        },
        [sendHeartbeat]
    );

    useEffect(() => {
        if (!enabled) return;

        // Initialize BroadcastChannel for multi-tab sync
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const channel = new BroadcastChannel(CHANNEL_NAME);
            channelRef.current = channel;

            channel.onmessage = (event) => {
                if (event.data?.type === 'ACTIVITY') {
                    lastActivityRef.current = event.data.timestamp;
                    setIsWarningOpen(false);
                    setSecondsRemaining(Math.ceil(WARNING_WINDOW_MS / 1000));
                } else if (event.data?.type === 'LOGOUT') {
                    performLogout();
                }
            };
        }

        // Activity event listeners with throttling
        let throttleTimer: number | null = null;
        const handleUserActivity = () => {
            if (throttleTimer) return;
            throttleTimer = window.setTimeout(() => {
                throttleTimer = null;
            }, 1000);
            resetTimer(true);
        };

        const activityEvents = [
            'mousemove',
            'mousedown',
            'keydown',
            'scroll',
            'touchstart',
            'click',
        ];

        activityEvents.forEach((event) => {
            window.addEventListener(event, handleUserActivity, {
                passive: true,
            });
        });

        // Interval to check idle timeout
        const checkInterval = window.setInterval(() => {
            const now = Date.now();
            const elapsed = now - lastActivityRef.current;
            const remaining = IDLE_TIMEOUT_MS - elapsed;

            if (remaining <= 0) {
                performLogout();
            } else if (remaining <= WARNING_WINDOW_MS) {
                setIsWarningOpen(true);
                setSecondsRemaining(Math.max(1, Math.ceil(remaining / 1000)));
            } else {
                if (isWarningOpen) {
                    setIsWarningOpen(false);
                }
            }
        }, 1000);

        // Window / tab close beacon
        const handlePageHide = () => {
            try {
                navigator.sendBeacon('/session/terminate-beacon');
            } catch {
                // Fallback for older browsers
                fetch('/session/terminate-beacon', {
                    method: 'POST',
                    keepalive: true,
                }).catch(() => {});
            }
        };

        window.addEventListener('pagehide', handlePageHide);

        return () => {
            activityEvents.forEach((event) => {
                window.removeEventListener(event, handleUserActivity);
            });
            window.removeEventListener('pagehide', handlePageHide);
            window.clearInterval(checkInterval);
            if (channelRef.current) {
                channelRef.current.close();
            }
        };
    }, [enabled, performLogout, resetTimer, isWarningOpen]);

    return {
        isWarningOpen,
        secondsRemaining,
        stayLoggedIn: () => resetTimer(true),
    };
}
