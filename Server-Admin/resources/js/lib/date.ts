/**
 * Format an ISO 8601 timestamp to a localized time string (e.g., "3:45 PM").
 */
export function formatTime(isoString: string | null | undefined): string {
    if (!isoString) return '';

    return new Date(isoString).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

/**
 * Format an ISO 8601 timestamp to a localized date string (e.g., "2026-08-24").
 */
export function formatDate(isoString: string | null | undefined): string {
    if (!isoString) return '';

    return new Date(isoString).toLocaleDateString();
}

/**
 * Format an ISO 8601 timestamp to a relative time string (e.g., "2 hours ago").
 */
export function formatRelativeTime(isoString: string | null | undefined): string {
    if (!isoString) return '';

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

    return formatDate(isoString);
}
