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
