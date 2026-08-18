import { Head, usePage } from '@inertiajs/react';
import { Search, ArrowUpDown, Layers } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface EgressEvent {
    date: string;
    time: string;
    domain: string;
    status: 'glass-unsafe' | 'glass-unlisted';
    user: string;
    fileName: string;
    action: string;
}

interface PageProps {
    egressEvents: EgressEvent[];
    [key: string]: unknown;
}

const ROWS_PER_PAGE = 5;

type SortField = 'date' | 'domain' | 'status' | 'action';
type SortDir = 'asc' | 'desc';
type GroupField = 'none' | 'status' | 'action';

const statusLabels: Record<string, string> = {
    'glass-unsafe': 'Unsafe',
    'glass-unlisted': 'Unlisted',
};

export default function EgressLogs() {
    const { egressEvents } = usePage<PageProps>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [groupField, setGroupField] = useState<GroupField>('none');

    // Filter, sort logic
    const processedEvents = useMemo(() => {
        let items = [...egressEvents];

        // Filter by search
        if (searchQuery) {
            items = items.filter((e) =>
                e.domain.toLowerCase().includes(searchQuery.toLowerCase()),
            );
        }

        // Sort
        items.sort((a, b) => {
            let cmp = 0;

            switch (sortField) {
                case 'date':
                    cmp =
                        a.date.localeCompare(b.date) ||
                        a.time.localeCompare(b.time);
                    break;
                case 'domain':
                    cmp = a.domain.localeCompare(b.domain);
                    break;
                case 'status':
                    cmp = a.status.localeCompare(b.status);
                    break;
                case 'action':
                    cmp = a.action.localeCompare(b.action);
                    break;
            }

            return sortDir === 'asc' ? cmp : -cmp;
        });

        return items;
    }, [egressEvents, searchQuery, sortField, sortDir]);

    // Group the processed items
    const groupedEvents = useMemo(() => {
        if (groupField === 'none') {
            return null;
        }

        const groups: Record<string, EgressEvent[]> = {};

        for (const item of processedEvents) {
            const key =
                groupField === 'status'
                    ? statusLabels[item.status]
                    : item.action;

            if (!groups[key]) {
                groups[key] = [];
            }

            groups[key].push(item);
        }

        return groups;
    }, [processedEvents, groupField]);

    // Pagination
    const totalPages = Math.max(
        1,
        Math.ceil(processedEvents.length / ROWS_PER_PAGE),
    );
    // Clamp to a valid page when filters change, so the current page
    // naturally resets if it falls past the last page.
    const safePage = Math.min(currentPage, totalPages);
    const paginatedItems = useMemo(() => {
        if (groupField !== 'none') {
            return processedEvents;
        }

        const start = (safePage - 1) * ROWS_PER_PAGE;

        return processedEvents.slice(start, start + ROWS_PER_PAGE);
    }, [processedEvents, safePage, groupField]);

    function renderTableRows(items: EgressEvent[]) {
        return items.map((row, i) => (
            <tr
                key={i}
                className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
            >
                <td className="py-3 pr-2.5">{row.date}</td>
                <td className="py-3 pr-2.5">{row.time}</td>
                <td className="py-3 pr-2.5">{row.domain}</td>
                <td className="py-3 pr-2.5">
                    <Badge variant={row.status}>
                        {row.status.replace('glass-', '').toUpperCase()}
                    </Badge>
                </td>
                <td className="py-3 pr-2.5">{row.user}</td>
                <td className="py-3 pr-2.5">{row.fileName}</td>
                <td className="py-3">{row.action}</td>
            </tr>
        ));
    }

    function renderGroupedContent() {
        if (!groupedEvents) {
            return null;
        }

        const groupKeys = Object.keys(groupedEvents);

        if (groupKeys.length === 0) {
            return (
                <tr>
                    <td
                        colSpan={7}
                        className="py-10 text-center text-muted-foreground"
                    >
                        {searchQuery
                            ? 'No events match your search.'
                            : 'No egress events recorded yet.'}
                    </td>
                </tr>
            );
        }

        return groupKeys.map((groupKey) => (
            <tbody key={groupKey}>
                <tr className="bg-[rgba(34,197,94,0.05)]">
                    <td
                        colSpan={7}
                        className="px-4 py-2 text-sm font-semibold tracking-wider text-able-green uppercase"
                    >
                        {groupKey} ({groupedEvents[groupKey].length})
                    </td>
                </tr>
                {renderTableRows(groupedEvents[groupKey])}
            </tbody>
        ));
    }

    function renderUngroupedContent() {
        if (paginatedItems.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td
                            colSpan={7}
                            className="py-10 text-center text-muted-foreground"
                        >
                            {searchQuery
                                ? 'No events match your search.'
                                : 'No egress events recorded yet.'}
                        </td>
                    </tr>
                </tbody>
            );
        }

        return <tbody>{renderTableRows(paginatedItems)}</tbody>;
    }

    // Generate pagination pages (1-4 with "...")
    function getPaginationPages() {
        const pages: (number | string)[] = [];
        const maxVisible = 4;

        for (let i = 1; i <= Math.min(maxVisible, totalPages); i++) {
            pages.push(i);
        }

        if (totalPages > maxVisible) {
            pages.push('...');
        }

        return pages;
    }

    return (
        <>
            <Head title="Egress Logs" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                {/* Page Header */}
                <header className="mb-8">
                    <h1
                        className="mb-2.5 text-[2.8rem] font-bold tracking-wide text-foreground uppercase"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        EGRESS LOGS
                    </h1>
                    <p className="mb-6 text-[1.05rem] text-muted-foreground">
                        Displays raw, telemetry data being intercepted by the
                        ABLE browser extension.
                    </p>

                    {/* Search + Sort + Group row */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative w-[260px]">
                            <Search
                                size={16}
                                className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-full border border-black/10 bg-black/5 py-2.5 pr-3.5 pl-11 text-[0.9rem] text-foreground outline-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                            />
                        </div>

                        {/* Sort Dropdown */}
                        <div className="relative">
                            <select
                                value={`${sortField}__${sortDir}`}
                                onChange={(e) => {
                                    const parts = e.target.value.split('__');
                                    setSortField(parts[0] as SortField);
                                    setSortDir(parts[1] as SortDir);
                                }}
                                className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-2.5 pr-8 pl-9 text-[0.85rem] text-foreground transition-all duration-200 outline-none hover:border-able-green/50 hover:bg-black/10 focus:border-able-green focus:ring-1 focus:ring-able-green/30 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-white/5"
                            >
                                <option value="date__desc">
                                    Sort: Date (Newest)
                                </option>
                                <option value="date__asc">
                                    Sort: Date (Oldest)
                                </option>
                                <option value="domain__asc">
                                    Sort: Domain (A-Z)
                                </option>
                                <option value="domain__desc">
                                    Sort: Domain (Z-A)
                                </option>
                                <option value="status__asc">
                                    Sort: Status (A-Z)
                                </option>
                                <option value="status__desc">
                                    Sort: Status (Z-A)
                                </option>
                                <option value="action__asc">
                                    Sort: Action (A-Z)
                                </option>
                                <option value="action__desc">
                                    Sort: Action (Z-A)
                                </option>
                            </select>
                            <ArrowUpDown
                                size={16}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                            />
                        </div>

                        {/* Group Dropdown */}
                        <div className="relative">
                            <select
                                value={groupField}
                                onChange={(e) =>
                                    setGroupField(e.target.value as GroupField)
                                }
                                className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-2.5 pr-8 pl-9 text-[0.85rem] text-foreground transition-all duration-200 outline-none hover:border-able-green/50 hover:bg-black/10 focus:border-able-green focus:ring-1 focus:ring-able-green/30 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-white/5"
                            >
                                <option value="none">Group: None</option>
                                <option value="status">Group: Status</option>
                                <option value="action">Group: Action</option>
                            </select>
                            <Layers
                                size={16}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                            />
                        </div>
                    </div>
                </header>

                {/* Data Table */}
                <div className={`${glassCard} px-10 py-8`}>
                    <div className="overflow-x-auto">
                        <table className="mb-5 w-full border-collapse text-[0.85rem]">
                            <thead>
                                <tr className="text-muted-foreground">
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                        Date
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                        Time
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                        Domain Name
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                        Status
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                        User ID
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                        File Name
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-5 text-left font-medium">
                                        Action Taken
                                    </th>
                                </tr>
                            </thead>
                            {groupField !== 'none'
                                ? renderGroupedContent()
                                : renderUngroupedContent()}
                        </table>
                    </div>

                    {/* Pagination (only when not grouped) */}
                    {groupField === 'none' && totalPages > 1 && (
                        <div className="flex items-center justify-end gap-3 text-[0.95rem]">
                            <button
                                onClick={() =>
                                    setCurrentPage(Math.max(1, safePage - 1))
                                }
                                disabled={safePage === 1}
                                className="px-1 font-bold text-muted-foreground disabled:opacity-50"
                            >
                                &lt;
                            </button>
                            {getPaginationPages().map((page, i) =>
                                typeof page === 'number' ? (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(page)}
                                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                            page === safePage
                                                ? 'bg-able-green text-[0.95rem] font-bold text-white'
                                                : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ) : (
                                    <span
                                        key={i}
                                        className="text-muted-foreground"
                                    >
                                        ...
                                    </span>
                                ),
                            )}
                            <button
                                onClick={() =>
                                    setCurrentPage(
                                        Math.min(totalPages, safePage + 1),
                                    )
                                }
                                disabled={safePage === totalPages}
                                className="px-1 font-bold text-muted-foreground disabled:opacity-50"
                            >
                                &gt;
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

EgressLogs.layout = {
    breadcrumbs: [{ title: 'Egress Logs', href: '/egress-logs' }],
};
