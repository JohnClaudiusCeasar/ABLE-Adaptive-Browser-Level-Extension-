export type PaginationItem = number | '...';

/**
 * Build the list of pagination controls for a given page.
 *
 * Returns a sliding window of at most `maxVisible` page-number slots,
 * with a leading and/or trailing `"..."` ellipsis for hidden pages.
 * The window is anchored to `currentPage` and pins to the end when
 * the current page is near the last page, so the last page is always
 * within reach without a separate "last page" button.
 *
 * Examples (totalPages = 10, maxVisible = 4):
 *   currentPage 1  ->  [1, 2, 3, 4, '...']
 *   currentPage 2  ->  ['...', 2, 3, 4, 5, '...']
 *   currentPage 9  ->  ['...', 7, 8, 9, 10]
 *   currentPage 10 ->  ['...', 7, 8, 9, 10]
 */
export function getPaginationPages(
    currentPage: number,
    totalPages: number,
    maxVisible: number = 4,
): PaginationItem[] {
    if (totalPages <= maxVisible) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Defensive clamp — guard against stale values after a filter
    // reduces the number of available pages.
    const page = Math.max(1, Math.min(currentPage, totalPages));

    let start = page;
    let end = page + maxVisible - 1;

    // Pin the window to the end so the last page stays visible.
    if (end > totalPages) {
        end = totalPages;

        start = totalPages - maxVisible + 1;
    }

    const items: PaginationItem[] = [];

    if (start > 1) {
        items.push('...');
    }

    for (let i = start; i <= end; i++) {
        items.push(i);
    }

    if (end < totalPages) {
        items.push('...');
    }

    return items;
}
