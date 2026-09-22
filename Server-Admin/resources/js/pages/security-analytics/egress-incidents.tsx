import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Search, ArrowUpDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { TablePagination } from '@/components/pagination';
import { cn, truncateFileName, formatMetricNumber } from '@/lib/utils';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface RecentShadowEgressItem {
    id: number;
    occurred_at: string;
    domain: string;
    user: string;
    fileName: string;
    fileSize: string;
    risk_score: number;
    action: string;
}

interface EgressIncidentsProps {
    recentShadowEgress: RecentShadowEgressItem[];
}

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

const ROWS_PER_PAGE = 10;

export default function EgressIncidents({ recentShadowEgress }: EgressIncidentsProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<'date_desc' | 'date_asc' | 'risk_desc' | 'risk_asc' | 'domain_asc'>('date_desc');
    const [currentPage, setCurrentPage] = useState(1);

    const processedItems = useMemo(() => {
        let items = [...recentShadowEgress];
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter(
                (item) =>
                    item.domain.toLowerCase().includes(q) ||
                    item.user.toLowerCase().includes(q) ||
                    item.fileName.toLowerCase().includes(q) ||
                    item.action.toLowerCase().includes(q),
            );
        }

        items.sort((a, b) => {
            switch (sortOption) {
                case 'date_desc':
                    return b.occurred_at.localeCompare(a.occurred_at);
                case 'date_asc':
                    return a.occurred_at.localeCompare(b.occurred_at);
                case 'risk_desc':
                    return b.risk_score - a.risk_score;
                case 'risk_asc':
                    return a.risk_score - b.risk_score;
                case 'domain_asc':
                    return a.domain.localeCompare(b.domain);
                default:
                    return 0;
            }
        });

        return items;
    }, [recentShadowEgress, searchQuery, sortOption]);

    const totalPages = Math.max(1, Math.ceil(processedItems.length / ROWS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedItems = useMemo(() => {
        const start = (safePage - 1) * ROWS_PER_PAGE;
        return processedItems.slice(start, start + ROWS_PER_PAGE);
    }, [processedItems, safePage]);

    return (
        <>
            <Head title="Shadow Incidents" />
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-8 pt-12 pb-[22px]">
                {/* Header */}
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
                                style={{ fontFamily: "'Unbounded', sans-serif" }}
                            >
                                SHADOW INCIDENTS
                            </h1>
                            <p className="max-w-[760px] text-[1.05rem] leading-relaxed text-muted-foreground">
                                Global telemetry stream of intercepted file uploads and data exfiltration
                                events intercepted by the ABLE browser extension.
                            </p>
                        </div>
                    </div>
                </header>

                {/* Main Table Card */}
                <div className={`${glassCard} p-6`}>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                                Total Incidents:
                            </span>
                            <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-500">
                                {formatMetricNumber(processedItems.length)} Records
                            </span>
                        </div>

                        {/* Search & Sort Controls */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-[240px]">
                                <Search
                                    size={14}
                                    className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                                />
                                <input
                                    type="text"
                                    placeholder="Search incidents..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full rounded-full border border-black/10 bg-black/5 py-1.5 pr-3 pl-9 text-xs text-foreground outline-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                                />
                            </div>

                            <div className="relative">
                                <select
                                    value={sortOption}
                                    onChange={(e) => {
                                        setSortOption(e.target.value as typeof sortOption);
                                        setCurrentPage(1);
                                    }}
                                    className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-1.5 pr-7 pl-8 text-xs text-foreground outline-none hover:border-able-green/50 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                                >
                                    <option value="date_desc">Sort: Date (Newest)</option>
                                    <option value="date_asc">Sort: Date (Oldest)</option>
                                    <option value="risk_desc">Sort: Risk (High-Low)</option>
                                    <option value="risk_asc">Sort: Risk (Low-High)</option>
                                    <option value="domain_asc">Sort: Domain (A-Z)</option>
                                </select>
                                <ArrowUpDown
                                    size={13}
                                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
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
                                        Target Domain
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        File Name
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Payload Size
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Risk Score
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-4 text-left font-medium">
                                        Interception Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedItems.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="py-10 text-center text-muted-foreground"
                                        >
                                            No egress incidents recorded matching search.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((row) => {
                                        const { date, time } = formatTimestamp(row.occurred_at);
                                        return (
                                            <tr
                                                key={row.id}
                                                className="border-b border-[rgba(34,197,94,0.3)] transition-colors hover:bg-black/5 last:border-b-0 dark:hover:bg-white/5"
                                            >
                                                <td className="py-3.5 pr-2.5">
                                                    <div className="flex flex-col">
                                                        <span>{date}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {time}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 pr-2.5 font-mono text-xs">
                                                    {row.user}
                                                </td>
                                                <td className="py-3.5 pr-2.5 font-mono text-xs text-foreground">
                                                    {row.domain}
                                                </td>
                                                <td
                                                    className="py-3.5 pr-2.5 max-w-[200px] truncate"
                                                    title={row.fileName}
                                                >
                                                    {truncateFileName(row.fileName)}
                                                </td>
                                                <td className="py-3.5 pr-2.5 tabular-nums">
                                                    {row.fileSize}
                                                </td>
                                                <td className="py-3.5 pr-2.5">
                                                    <span
                                                        className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-[10px] ${getRiskScoreBadgeClass(
                                                            row.risk_score,
                                                        )}`}
                                                    >
                                                        {row.risk_score}%
                                                    </span>
                                                </td>
                                                <td className="py-3.5">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                                            row.action === 'Denied'
                                                                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                                                : row.action === 'Proceeded'
                                                                  ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                                                                  : 'bg-sky-500/15 text-sky-500 border border-sky-500/30',
                                                        )}
                                                    >
                                                        {row.action}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
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

EgressIncidents.layout = {
    breadcrumbs: [
        {
            title: 'Shadow Analytics',
            href: '/security-analytics',
        },
        {
            title: 'Shadow Incidents',
            href: '/security-analytics/egress-incidents',
        },
    ],
};
