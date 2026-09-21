import { Head, usePage } from '@inertiajs/react';
import { Search, ArrowUpDown, Layers } from 'lucide-react';
import { useState, useMemo } from 'react';
import { TablePagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface EgressEvent {
    occurred_at: string;
    domain: string;
    status: 'glass-safe' | 'glass-unsafe' | 'glass-unlisted';
    risk_score: number;
    user: string;
    fileName: string;
    action: string;
}

interface PageProps {
    egressEvents: EgressEvent[];
    [key: string]: unknown;
}

const ROWS_PER_PAGE = 5;

type SortField = 'occurred_at' | 'domain' | 'status' | 'risk_score' | 'action';
type SortDir = 'asc' | 'desc';
type GroupField = 'none' | 'status' | 'action';

const statusLabels: Record<string, string> = {
    'glass-safe': 'Safe',
    'glass-unsafe': 'Unsafe',
    'glass-unlisted': 'Unlisted',
};

function getRiskScoreBadgeClass(score: number): string {
    if (score >= 76) {
        return 'border border-[#ff4d4d] bg-[rgba(255,77,77,0.2)] text-[#ff4d4d]';
    }
    if (score >= 41) {
        return 'border border-[#f59e0b] bg-[rgba(245,158,11,0.2)] text-[#f59e0b]';
    }
    return 'border border-[#00ff66] bg-[rgba(0,255,102,0.2)] text-[#00ff66]';
}

function formatTimestamp(ts: string): { date: string; time: string } {
    const d = new Date(ts);

    return {
        date: d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }),
        time: d.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        }),
    };
}

export default function EgressLogs() {
    const { egressEvents } = usePage<PageProps>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<SortField>('occurred_at');
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
                case 'occurred_at':
                    cmp = a.occurred_at.localeCompare(b.occurred_at);
                    break;
                case 'domain':
                    cmp = a.domain.localeCompare(b.domain);
                    break;
                case 'status':
                    cmp = a.status.localeCompare(b.status);
                    break;
                case 'risk_score':
                    cmp = a.risk_score - b.risk_score;
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

    function renderTableRows(items: EgressEvent[], isGrouped = false) {
        return items.map((row, i) => {
            const { date, time } = formatTimestamp(row.occurred_at);

            return (
                <tr
                    key={i}
                    className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                >
                    <td className={`py-3 pr-2.5 ${isGrouped ? 'w-[12%] pl-4' : ''}`}>
                        {date}
                    </td>
                    <td className={`py-3 pr-2.5 ${isGrouped ? 'w-[10%]' : ''}`}>
                        {time}
                    </td>
                    <td
                        className={`py-3 pr-2.5 ${isGrouped ? 'w-[20%] truncate' : ''}`}
                    >
                        {row.domain}
                    </td>
                    <td className={`py-3 pr-2.5 ${isGrouped ? 'w-[12%]' : ''}`}>
                        <Badge variant={row.status}>
                            {row.status.replace('glass-', '').toUpperCase()}
                        </Badge>
                    </td>
                    <td className={`py-3 pr-2.5 ${isGrouped ? 'w-[12%]' : ''}`}>
                        {row.user}
                    </td>
                    <td
                        className={`py-3 pr-2.5 ${isGrouped ? 'w-[14%] truncate' : ''}`}
                    >
                        {row.fileName}
                    </td>
                    <td className={`py-3 pr-2.5 ${isGrouped ? 'w-[10%]' : ''}`}>
                        <span
                            className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-[10px] ${getRiskScoreBadgeClass(
                                row.risk_score,
                            )}`}
                        >
                            {row.risk_score}%
                        </span>
                    </td>
                    <td className={`py-3 ${isGrouped ? 'w-[10%] pr-4' : ''}`}>
                        {row.action}
                    </td>
                </tr>
            );
        });
    }

    function renderGroupedContent() {
        if (!groupedEvents) {
            return null;
        }

        const groupKeys = Object.keys(groupedEvents);

        if (groupKeys.length === 0) {
            return (
                <div className="py-10 text-center text-muted-foreground">
                    {searchQuery
                        ? 'No events match your search.'
                        : 'No egress events recorded yet.'}
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-6">
                {groupKeys.map((groupKey) => {
                    const items = groupedEvents[groupKey];
                    const isScrollable = items.length > 5;

                    return (
                        <div
                            key={groupKey}
                            className="overflow-hidden rounded-lg border border-[rgba(34,197,94,0.3)] bg-black/[0.02] shadow-xs dark:bg-white/[0.02]"
                        >
                            {/* Group Header Banner */}
                            <div className="flex items-center justify-between border-b border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] px-5 py-3">
                                <span className="text-sm font-bold tracking-wider text-able-green uppercase">
                                    {groupKey}
                                </span>
                                <span className="rounded-full bg-able-green/15 px-2.5 py-0.5 text-xs font-semibold text-able-green">
                                    {items.length} {items.length === 1 ? 'Event' : 'Events'}
                                </span>
                            </div>

                            {/* Static Column Headers (Blends with Card Gradient Background) */}
                            <div className="border-b border-[rgba(34,197,94,0.3)] bg-transparent">
                                <table className="w-full table-fixed border-collapse text-[0.85rem]">
                                    <thead>
                                        <tr className="text-muted-foreground">
                                            <th className="w-[12%] py-3 pr-2.5 pl-4 text-left font-medium">
                                                Date
                                            </th>
                                            <th className="w-[10%] py-3 pr-2.5 text-left font-medium">
                                                Time
                                            </th>
                                            <th className="w-[20%] py-3 pr-2.5 text-left font-medium">
                                                Domain Name
                                            </th>
                                            <th className="w-[12%] py-3 pr-2.5 text-left font-medium">
                                                Domain Status
                                            </th>
                                            <th className="w-[12%] py-3 pr-2.5 text-left font-medium">
                                                User ID
                                            </th>
                                            <th className="w-[14%] py-3 pr-2.5 text-left font-medium">
                                                File Name
                                            </th>
                                            <th className="w-[10%] py-3 pr-2.5 text-left font-medium">
                                                Risk Score
                                            </th>
                                            <th className="w-[10%] py-3 pr-4 text-left font-medium">
                                                Action Taken
                                            </th>
                                        </tr>
                                    </thead>
                                </table>
                            </div>

                            {/* Scrollable Body Rows (Scrollbar starts below column header area) */}
                            <div
                                className={`overflow-x-auto ${
                                    isScrollable
                                        ? 'max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-[rgba(34,197,94,0.4)] scrollbar-track-transparent'
                                        : ''
                                }`}
                            >
                                <table className="w-full table-fixed border-collapse text-[0.85rem]">
                                    <tbody>{renderTableRows(items, true)}</tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    function renderUngroupedContent() {
        if (paginatedItems.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td
                            colSpan={8}
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
                                <option value="occurred_at__desc">
                                    Sort: Date (Newest)
                                </option>
                                <option value="occurred_at__asc">
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
                                <option value="risk_score__desc">
                                    Sort: Risk (High-Low)
                                </option>
                                <option value="risk_score__asc">
                                    Sort: Risk (Low-High)
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
                <div className={`${glassCard} p-6`}>
                    {groupField !== 'none' ? (
                        renderGroupedContent()
                    ) : (
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
                                            Domain Status
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                            User ID
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                            File Name
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                            Risk Score
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pb-5 text-left font-medium">
                                            Action Taken
                                        </th>
                                    </tr>
                                </thead>
                                {renderUngroupedContent()}
                            </table>
                        </div>
                    )}

                    {/* Pagination (only when not grouped) */}
                    {groupField === 'none' && totalPages > 1 && (
                        <TablePagination
                            currentPage={safePage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

EgressLogs.layout = {
    breadcrumbs: [{ title: 'Egress Logs', href: '/egress-logs' }],
};
