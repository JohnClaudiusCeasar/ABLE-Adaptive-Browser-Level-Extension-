import type { InertiaLinkProps } from '@inertiajs/react';
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function toUrl(url: NonNullable<InertiaLinkProps['href']>): string {
    return typeof url === 'string' ? url : url.url;
}

export function truncateFileName(fileName: string, maxLength = 15): string {
    if (!fileName) {
        return fileName;
    }

    const lastDotIndex = fileName.lastIndexOf('.');

    if (lastDotIndex > 0) {
        const baseName = fileName.slice(0, lastDotIndex);
        const extension = fileName.slice(lastDotIndex);

        if (baseName.length > maxLength) {
            return `${baseName.slice(0, maxLength)}..${extension}`;
        }

        return fileName;
    }

    if (fileName.length > maxLength) {
        return `${fileName.slice(0, maxLength)}..`;
    }

    return fileName;
}

/**
 * Formats a numeric metric count using compact notation (e.g. 1000 -> "1K", 1100 -> "1.1K", 1500000 -> "1.5M", 2000000000 -> "2B").
 * Values under 1000 remain formatted as locale integers (e.g. 950).
 * Preserves pre-formatted strings with units (e.g., "12.5 MB", "85%").
 */
export function formatMetricNumber(value: number | string | null | undefined): string {
    if (value === null || value === undefined) {
        return '0';
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();

        // If string contains explicit unit suffixes (e.g., MB, KB, %, etc.) or non-numeric tokens
        if (/[a-zA-Z%]/.test(trimmed) || trimmed === '' || trimmed === '—') {
            return trimmed;
        }

        const parsed = Number(trimmed.replace(/,/g, ''));

        if (isNaN(parsed)) {
            return trimmed;
        }

        value = parsed;
    }

    const num = Number(value);

    if (isNaN(num)) {
        return String(value);
    }

    const absNum = Math.abs(num);

    if (absNum < 1000) {
        return num.toLocaleString();
    }

    const units = [
        { threshold: 1e9, suffix: 'B' },
        { threshold: 1e6, suffix: 'M' },
        { threshold: 1e3, suffix: 'K' },
    ];

    for (const { threshold, suffix } of units) {
        if (absNum >= threshold) {
            const rawFormatted = (num / threshold).toFixed(2);
            // Remove unnecessary trailing zeros: 1.00 -> 1, 1.10 -> 1.1, 1.12 -> 1.12
            const cleanFormatted = rawFormatted
                .replace(/(\.[0-9]*[1-9])0+$/, '$1')
                .replace(/\.00$/, '');

            return `${cleanFormatted}${suffix}`;
        }
    }

    return num.toLocaleString();
}
