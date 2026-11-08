/**
 * Abandon the admin session and return to a public page.
 *
 * Uses a raw fetch with the CSRF meta token (the same pattern as the
 * inactivity timeout) and `Accept: application/json`, so Fortify answers 204
 * and no redirect is followed. `location.replace` then performs a full
 * document navigation, discarding the Inertia SPA and replacing the current
 * (authenticated) history entry instead of stacking another one on top.
 */
export async function performLogout(redirectTo = '/'): Promise<void> {
    const token =
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content') ?? '';

    try {
        await fetch('/logout', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'X-CSRF-TOKEN': token,
                Accept: 'application/json',
            },
        });
    } finally {
        try {
            // Chat transcript is per-tab state, not part of the server session.
            window.sessionStorage.removeItem('able.chat.session');
        } catch {
            // Storage can be unavailable; logout must still proceed.
        }

        window.location.replace(redirectTo);
    }
}
