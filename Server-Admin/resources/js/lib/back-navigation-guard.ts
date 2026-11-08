/**
 * Chrome restores `Cache-Control: no-store` pages from the back-forward cache,
 * so headers alone cannot stop the Back button from showing a pre-logout
 * snapshot. A restored document still has the old DOM in memory; a reload
 * re-asks the server, which redirects guests to the login screen.
 */
export function installBackNavigationGuard(): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            window.location.reload();
        }
    });
}
