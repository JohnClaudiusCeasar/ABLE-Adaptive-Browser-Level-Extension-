/**
 * Read the CSRF token from the meta tag injected by the app blade layout.
 */
export function getCsrfToken(): string {
    return (
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? ''
    );
}
