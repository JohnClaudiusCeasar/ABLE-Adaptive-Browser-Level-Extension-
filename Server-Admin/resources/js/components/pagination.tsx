import { getPaginationPages } from '@/lib/pagination';
import type { PaginationItem } from '@/lib/pagination';

interface TablePaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    maxVisible?: number;
}

const pageBtnBase =
    'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full font-bold';

export function TablePagination({
    currentPage,
    totalPages,
    onPageChange,
    maxVisible = 4,
}: TablePaginationProps) {
    const safeCurrent = Math.max(1, Math.min(currentPage, totalPages));
    const pages = getPaginationPages(safeCurrent, totalPages, maxVisible);

    return (
        <div className="flex items-center justify-end gap-3 text-[0.95rem]">
            <button
                onClick={() => onPageChange(Math.max(1, safeCurrent - 1))}
                disabled={safeCurrent === 1}
                className="cursor-pointer px-2 font-bold text-muted-foreground disabled:opacity-50"
            >
                &lt;
            </button>

            {pages.map((page: PaginationItem, index: number) =>
                typeof page === 'number' ? (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`${pageBtnBase} ${
                            page === safeCurrent
                                ? 'bg-able-green text-white'
                                : 'text-muted-foreground hover:bg-black/5 dark:hover:text-white'
                        }`}
                    >
                        {page}
                    </button>
                ) : (
                    <span
                        key={`ellipsis-${index}`}
                        className="text-muted-foreground"
                    >
                        ...
                    </span>
                ),
            )}

            <button
                onClick={() =>
                    onPageChange(Math.min(totalPages, safeCurrent + 1))
                }
                disabled={safeCurrent === totalPages}
                className="cursor-pointer px-2 font-bold text-muted-foreground disabled:opacity-50"
            >
                &gt;
            </button>
        </div>
    );
}
