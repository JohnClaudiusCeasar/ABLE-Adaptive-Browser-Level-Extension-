/**
 * Guards the sign-in screen against browser history.
 *
 * Logging out deliberately returns the operator to the public site, but the
 * sign-in screen they used earlier is still an entry in the history list.
 * Browsing back must not reopen it: re-entering the admin area stays an
 * explicit action taken from the landing page.
 *
 * Two signals must agree before the sign-in screen is abandoned:
 *
 * 1. The session was ended on purpose, recorded by the logout helper so the
 *    behaviour never applies to an operator who simply opened the page.
 * 2. The page was reached through history rather than by following a link,
 *    typing the address or reloading.
 *
 * Together they leave deliberate visits alone - including typing the address
 * directly - while making the Back button fall through to the landing page.
 */

const SIGN_IN_PATH = '/login';

/** Where a signed-out operator is sent when history reaches the sign-in screen. */
const LANDING_PATH = '/';

const SIGNED_OUT_KEY = 'able.signed-out';

let signedOutInMemory = false;

/**
 * Record that the admin session was ended on purpose.
 */
export function markSignedOut(): void {
    signedOutInMemory = true;

    try {
        window.sessionStorage.setItem(SIGNED_OUT_KEY, '1');
    } catch {
        // Non-fatal: the in-memory flag still covers this document.
    }
}

/**
 * Forget the marker so the sign-in screen may be shown again. Called when the
 * operator deliberately opens it from the landing page.
 */
export function clearSignedOut(): void {
    signedOutInMemory = false;

    try {
        window.sessionStorage.removeItem(SIGNED_OUT_KEY);
    } catch {
        // Non-fatal.
    }
}

function isSignedOut(): boolean {
    if (signedOutInMemory) {
        return true;
    }

    try {
        return window.sessionStorage.getItem(SIGNED_OUT_KEY) === '1';
    } catch {
        return false;
    }
}

/**
 * Whether the current page view came from the Back / Forward button rather
 * than from following a link, typing the address, reloading or submitting a
 * form. A document restored from the back-forward cache keeps its original
 * navigation entry, so `pageshow`'s `persisted` flag covers it instead.
 */
function isHistoryNavigation(persisted = false): boolean {
    if (persisted) {
        return true;
    }

    const entries =
        performance.getEntriesByType?.('navigation') ??
        ([] as PerformanceEntry[]);

    const [navigation] = entries as PerformanceNavigationTiming[];

    return navigation?.type === 'back_forward';
}

function shouldLeaveSignInScreen(viaHistory: boolean): boolean {
    if (window.location.pathname !== SIGN_IN_PATH) {
        return false;
    }

    if (!isSignedOut() || !viaHistory) {
        return false;
    }

    // A server-driven arrival carrying a notice (the inactivity timeout, for
    // example) is legitimate, so its message is shown instead of bouncing.
    const params = new URLSearchParams(window.location.search);

    return !params.get('status');
}

function leaveSignInScreenIfNeeded(viaHistory: boolean): boolean {
    if (!shouldLeaveSignInScreen(viaHistory)) {
        return false;
    }

    window.location.replace(LANDING_PATH);

    return true;
}

/**
 * Install the guard and, when this page must be abandoned, start the redirect.
 *
 * @returns true when a redirect has been started, meaning the caller should not
 *          boot the application into the page that is being left behind.
 */
export function installBackNavigationGuard(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    // Resolve before render, so a history navigation to the sign-in screen
    // never flashes the login form.
    if (leaveSignInScreenIfNeeded(isHistoryNavigation())) {
        return true;
    }

    window.addEventListener('pageshow', (event) => {
        // A document restored from the back-forward cache fires no network
        // load, so it is only caught here.
        if (leaveSignInScreenIfNeeded(isHistoryNavigation(event.persisted))) {
            return;
        }

        // Any other restored page still shows its pre-navigation snapshot, so
        // it is reloaded to let the server decide whether the visitor is still
        // authenticated.
        if (event.persisted) {
            window.location.reload();
        }
    });

    // A history entry restored in place by the single-page app moves the URL
    // without loading a document, so `pageshow` never fires. `popstate` only
    // fires for history navigation, which is the signal itself.
    window.addEventListener('popstate', () => {
        leaveSignInScreenIfNeeded(true);
    });

    return false;
}
