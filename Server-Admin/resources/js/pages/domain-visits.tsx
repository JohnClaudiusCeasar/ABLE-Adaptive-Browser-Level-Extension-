import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Search, ArrowUpDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { LiveTelemetryStatus } from '@/components/live-telemetry-status';
import { TablePagination } from '@/components/pagination';
import { RowLimitNotice } from '@/components/row-limit-notice';
import { Badge } from '@/components/ui/badge';
import { formatMetricNumber } from '@/lib/utils';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface DomainVisit {
    visited_at: string;
    domain: string;
    status: 'glass-safe' | 'glass-unsafe' | 'glass-unlisted';
    risk_score: number | null;
    user: string | null;
    action: string;
}

interface PageProps {
    domainVisits: DomainVisit[];
    truncated?: boolean;
    rowLimit?: number;
    [key: string]: unknown;
}

const ROWS_PER_PAGE = 10;

type SortField = 'visited_at' | 'risk_score';
type SortDir = 'asc' | 'desc';

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

export default function DomainVisits() {
    const { domainVisits, truncated, rowLimit } = usePage<PageProps>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<SortField>('visited_at');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // Filter & Sort logic
    const processedVisits = useMemo(() => {
        let items = [...domainVisits];

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            items = items.filter(
                (v) =>
                    v.domain.toLowerCase().includes(query) ||
                    (v.user && v.user.toLowerCase().includes(query)) ||
                    v.action.toLowerCase().includes(query),
            );
        }

        // Sort
        items.sort((a, b) => {
            let cmp = 0;

            switch (sortField) {
                case 'visited_at':
                    cmp = a.visited_at.localeCompare(b.visited_at);
                    break;
                case 'risk_score':
                    cmp = (a.risk_score ?? -1) - (b.risk_score ?? -1);
                    break;
            }

            return sortDir === 'asc' ? cmp : -cmp;
        });

        return items;
    }, [domainVisits, searchQuery, sortField, sortDir]);

    // Pagination
    const totalPages = Math.max(
        1,
        Math.ceil(processedVisits.length / ROWS_PER_PAGE),
    );
    const safePage = Math.min(currentPage, totalPages);
    const paginatedItems = useMemo(() => {
        const start = (safePage - 1) * ROWS_PER_PAGE;

        return processedVisits.slice(start, start + ROWS_PER_PAGE);
    }, [processedVisits, safePage]);

    function renderTableRows(items: DomainVisit[]) {
        return items.map((row, i) => {
            const { date, time } = formatTimestamp(row.visited_at);

            return (
                <tr
                    key={i}
                    className="border-b border-[rgba(34,197,94,0.3)] transition-colors last:border-b-0 hover:bg-black/5 dark:hover:bg-white/5"
                >
                    <td className="py-3.5 pr-2.5">
                        <div className="flex flex-col">
                            <span>{date}</span>
                            <span className="text-xs text-muted-foreground">
                                {time}
                            </span>
                        </div>
                    </td>
                    <td className="py-3.5 pr-2.5">{row.user ?? '—'}</td>
                    <td className="py-3.5 pr-2.5">{row.domain}</td>
                    <td className="py-3.5 pr-2.5">
                        <Badge variant={row.status}>
                            {row.status.replace('glass-', '').toUpperCase()}
                        </Badge>
                    </td>
                    <td className="py-3.5">
                        {row.risk_score !== null ? (
                            <span
                                className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-[10px] ${getRiskScoreBadgeClass(
                                    row.risk_score,
                                )}`}
                            >
                                {row.risk_score}%
                            </span>
                        ) : (
                            <span className="text-muted-foreground">—</span>
                        )}
                    </td>
                </tr>
            );
        });
    }

    function renderTableBody() {
        if (paginatedItems.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td
                            colSpan={5}
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
            <Head title="Shadow Visits" />
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-8 pt-12 pb-[22px]">
                {/* Page Header */}
                <header>
                    <Link
                        href="/security-analytics"
                        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-able-green transition-colors hover:text-able-green-muted"
                    >
                        <ArrowLeft size={14} />
                        Back to Shadow Overview
                    </Link>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1
                                className="mb-2.5 text-[2.8rem] font-bold tracking-wide text-foreground uppercase"
                                style={{
                                    fontFamily: "'Unbounded', sans-serif",
                                }}
                            >
                                SHADOW VISITS
                            </h1>
                            <p className="max-w-[760px] text-[1.05rem] leading-relaxed text-muted-foreground">
                                Complete timeline of domain interactions and
                                shadow activity recorded by the ABLE browser
                                extension.
                            </p>
                            <LiveTelemetryStatus
                                watched={['visits']}
                                className="mt-3"
                            />
                        </div>
                    </div>
                </header>

                {/* Main Table Card */}
                <div className={`${glassCard} p-6`}>
                    <RowLimitNotice truncated={truncated} limit={rowLimit} />

                    {/* Card Header Toolbar */}
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                                Total Visits:
                            </span>
                            <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-semibold text-cyan-400">
                                {formatMetricNumber(processedVisits.length)}{' '}
                                Sessions
                            </span>
                        </div>

                        {/* Search & Sort Controls */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-[260px]">
                                <Search
                                    size={16}
                                    className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                                />
                                <input
                                    type="text"
                                    placeholder="Search visits..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full rounded-full border border-black/10 bg-black/5 py-2.5 pr-3.5 pl-11 text-[0.9rem] text-foreground outline-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                                />
                            </div>

                            {/* Sort Dropdown */}
                            <div className="relative">
                                <select
                                    value={`${sortField}__${sortDir}`}
                                    onChange={(e) => {
                                        const parts =
                                            e.target.value.split('__');
                                        setSortField(parts[0] as SortField);
                                        setSortDir(parts[1] as SortDir);
                                        setCurrentPage(1);
                                    }}
                                    className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-2.5 pr-8 pl-9 text-[0.85rem] text-foreground transition-all duration-200 outline-none hover:border-able-green/50 hover:bg-black/10 focus:border-able-green focus:ring-1 focus:ring-able-green/30 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-white/5"
                                >
                                    <option value="visited_at__desc">
                                        Sort By: Date(Newest)
                                    </option>
                                    <option value="visited_at__asc">
                                        Sort By: Date(Oldest)
                                    </option>
                                    <option value="risk_score__desc">
                                        Sort By: Risk Score(High-Low)
                                    </option>
                                    <option value="risk_score__asc">
                                        Sort By: Risk Score(Low-High)
                                    </option>
                                </select>
                                <ArrowUpDown
                                    size={16}
                                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Data Table Content */}
                    <div className="overflow-x-auto">
                        <table className="mb-4 w-full border-collapse text-[0.85rem]">
                            <thead>
                                <tr className="text-muted-foreground">
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Date & Time
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        User ID
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Domain Name
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Domain Status
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-4 text-left font-medium">
                                        Risk Score
                                    </th>
                                </tr>
                            </thead>
                            {renderTableBody()}
                        </table>
                    </div>

                    {totalPages > 1 && (
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
    breadcrumbs: [
        { title: 'Shadow Analytics', href: '/security-analytics' },
        { title: 'Shadow Visits', href: '/domain-visits' },
    ],
};
