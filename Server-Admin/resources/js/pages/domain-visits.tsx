import { Head, usePage } from '@inertiajs/react';
import { Search, ArrowUpDown, Layers } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { TablePagination } from '@/components/pagination';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface DomainVisit {
    visited_at: string;
    domain: string;
    status: 'glass-safe' | 'glass-unsafe' | 'glass-unlisted';
    user: string | null;
    action: string;
}

interface PageProps {
    domainVisits: DomainVisit[];
    [key: string]: unknown;
}

const ROWS_PER_PAGE = 5;

type SortField = 'visited_at' | 'domain' | 'status' | 'action';
type SortDir = 'asc' | 'desc';
type GroupField = 'none' | 'status' | 'action';

const statusLabels: Record<string, string> = {
    'glass-safe': 'Safe',
    'glass-unsafe': 'Unsafe',
    'glass-unlisted': 'Unlisted',
};

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
            hour12: true,
        }),
    };
}

export default function DomainVisits() {
    const { domainVisits } = usePage<PageProps>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<SortField>('visited_at');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [groupField, setGroupField] = useState<GroupField>('none');

    // Filter, sort logic
    const processedVisits = useMemo(() => {
        let items = [...domainVisits];

        // Filter by search
        if (searchQuery) {
            items = items.filter((v) =>
                v.domain.toLowerCase().includes(searchQuery.toLowerCase()),
            );
        }

        // Sort
        items.sort((a, b) => {
            let cmp = 0;

            switch (sortField) {
                case 'visited_at':
                    cmp = a.visited_at.localeCompare(b.visited_at);
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
    }, [domainVisits, searchQuery, sortField, sortDir]);

    // Group the processed items
    const groupedVisits = useMemo(() => {
        if (groupField === 'none') {
            return null;
        }

        const groups: Record<string, DomainVisit[]> = {};

        for (const item of processedVisits) {
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
    }, [processedVisits, groupField]);

    // Pagination
    const totalPages = Math.max(
        1,
        Math.ceil(processedVisits.length / ROWS_PER_PAGE),
    );
    // Clamp to a valid page when filters change, so the current page
    // naturally resets if it falls past the last page.
    const safePage = Math.min(currentPage, totalPages);
    const paginatedItems = useMemo(() => {
        if (groupField !== 'none') {
            return processedVisits;
        }

        const start = (safePage - 1) * ROWS_PER_PAGE;

        return processedVisits.slice(start, start + ROWS_PER_PAGE);
    }, [processedVisits, safePage, groupField]);

    function renderTableRows(items: DomainVisit[]) {
        return items.map((row, i) => {
            const { date, time } = formatTimestamp(row.visited_at);
            return (
            <tr
                key={i}
                className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
            >
                <td className="py-3 pr-2.5">{date}</td>
                <td className="py-3 pr-2.5">{time}</td>
                <td className="py-3 pr-2.5">{row.domain}</td>
                <td className="py-3 pr-2.5">
                    <Badge variant={row.status}>
                        {row.status.replace('glass-', '').toUpperCase()}
                    </Badge>
                </td>
                <td className="py-3 pr-2.5">{row.user ?? '—'}</td>
                <td className="py-3">{row.action}</td>
                </tr>
            );
        });
    }

    function renderGroupedContent() {
        if (!groupedVisits) {
            return null;
        }

        const groupKeys = Object.keys(groupedVisits);

        if (groupKeys.length === 0) {
            return (
                <tr>
                    <td
                        colSpan={6}
                        className="py-10 text-center text-muted-foreground"
                    >
                        {searchQuery
                            ? 'No visits match your search.'
                            : 'No domain visits recorded yet.'}
                    </td>
                </tr>
            );
        }

        return groupKeys.map((groupKey) => (
            <tbody key={groupKey}>
                <tr className="bg-[rgba(34,197,94,0.05)]">
                    <td
                        colSpan={6}
                        className="px-4 py-2 text-sm font-semibold tracking-wider text-able-green uppercase"
                    >
                        {groupKey} ({groupedVisits[groupKey].length})
                    </td>
                </tr>
                {renderTableRows(groupedVisits[groupKey])}
            </tbody>
        ));
    }

    function renderUngroupedContent() {
        if (paginatedItems.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td
                            colSpan={6}
                            className="py-10 text-center text-muted-foreground"
                        >
                            {searchQuery
                                ? 'No visits match your search.'
                                : 'No domain visits recorded yet.'}
                        </td>
                    </tr>
                </tbody>
            );
        }

        return <tbody>{renderTableRows(paginatedItems)}</tbody>;
    }

    return (
        <>
            <Head title="Domain Visits" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                {/* Page Header */}
                <header className="mb-8">
                    <h1
                        className="mb-2.5 text-[2.8rem] font-bold tracking-wide text-foreground uppercase"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        DOMAIN VISITS
                    </h1>
                    <p className="mb-6 text-[1.05rem] text-muted-foreground">
                        Displays all domain visits recorded by the ABLE browser
                        extension.
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
                                <option value="visited_at__desc">
                                    Sort: Date (Newest)
                                </option>
                                <option value="visited_at__asc">
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
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-5 text-left font-medium">
                                        Action
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

DomainVisits.layout = {
    breadcrumbs: [{ title: 'Domain Visits', href: '/domain-visits' }],
};
