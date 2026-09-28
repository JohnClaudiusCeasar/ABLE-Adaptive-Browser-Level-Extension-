import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Search, ArrowUpDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { TablePagination } from '@/components/pagination';
import { formatMetricNumber } from '@/lib/utils';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface NudgeEffectivenessRow {
    date: string;
    proceeded: number;
    cancelled: number;
}

interface NudgeEffectivenessProps {
    nudgeEffectiveness: NudgeEffectivenessRow[];
}

const ROWS_PER_PAGE = 10;

export default function NudgeEffectiveness({
    nudgeEffectiveness,
}: NudgeEffectivenessProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<'date_desc' | 'date_asc' | 'rate_desc' | 'rate_asc' | 'cancelled_desc'>('date_desc');
    const [currentPage, setCurrentPage] = useState(1);

    const processedItems = useMemo(() => {
        let items = [...nudgeEffectiveness];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            items = items.filter((row) => row.date.toLowerCase().includes(query));
        }

        items.sort((a, b) => {
            const totalA = a.proceeded + a.cancelled;
            const rateA = totalA > 0 ? (a.cancelled / totalA) * 100 : 0;
            const totalB = b.proceeded + b.cancelled;
            const rateB = totalB > 0 ? (b.cancelled / totalB) * 100 : 0;

            switch (sortOption) {
                case 'date_desc':
                    return b.date.localeCompare(a.date);
                case 'date_asc':
                    return a.date.localeCompare(b.date);
                case 'rate_desc':
                    return rateB - rateA;
                case 'rate_asc':
                    return rateA - rateB;
                case 'cancelled_desc':
                    return b.cancelled - a.cancelled;
                default:
                    return 0;
            }
        });

        return items;
    }, [nudgeEffectiveness, searchQuery, sortOption]);

    const totalPages = Math.max(1, Math.ceil(processedItems.length / ROWS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedItems = useMemo(() => {
        const start = (safePage - 1) * ROWS_PER_PAGE;

        return processedItems.slice(start, start + ROWS_PER_PAGE);
    }, [processedItems, safePage]);

    return (
        <>
            <Head title="Shadow Containment" />
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
                                SHADOW CONTAINMENT
                            </h1>
                            <p className="max-w-[760px] text-[1.05rem] leading-relaxed text-muted-foreground">
                                Detailed interaction telemetry and employee compliance outcomes upon receiving data upload warnings.
                            </p>
                        </div>
                    </div>
                </header>

                {/* Main Table Card */}
                <div className={`${glassCard} p-6`}>
                    {/* Card Header Toolbar */}
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                                Total Records:
                            </span>
                            <span className="rounded-full bg-able-green/15 px-2.5 py-0.5 text-xs font-semibold text-able-green">
                                {formatMetricNumber(processedItems.length)} Days Tracked
                            </span>
                        </div>

                        {/* Search & Sort Controls */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-[220px]">
                                <Search
                                    size={14}
                                    className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                                />
                                <input
                                    type="text"
                                    placeholder="Search by date..."
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
                                    <option value="rate_desc">Sort: Success (High-Low)</option>
                                    <option value="rate_asc">Sort: Success (Low-High)</option>
                                    <option value="cancelled_desc">Sort: Prevented (Most)</option>
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
                                        Date
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Prevented (Cancelled)
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Overridden (Proceeded)
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Total Nudges
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-4 text-left font-medium">
                                        Containment Rate
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedItems.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="py-10 text-center text-muted-foreground"
                                        >
                                            {searchQuery
                                                ? 'No records match your search criteria.'
                                                : 'No containment telemetry recorded yet.'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((row, i) => {
                                        const total = row.proceeded + row.cancelled;
                                        const successRate =
                                            total > 0
                                                ? Math.round((row.cancelled / total) * 100)
                                                : 0;

                                        return (
                                            <tr
                                                key={i}
                                                className="border-b border-[rgba(34,197,94,0.3)] transition-colors hover:bg-black/5 last:border-b-0 dark:hover:bg-white/5"
                                            >
                                                <td className="py-3.5 pr-2.5 font-medium text-foreground">
                                                    {row.date}
                                                </td>
                                                <td
                                                    className="py-3.5 pr-2.5 font-semibold text-emerald-500 tabular-nums"
                                                    title={row.cancelled.toLocaleString()}
                                                >
                                                    {formatMetricNumber(row.cancelled)}
                                                </td>
                                                <td
                                                    className="py-3.5 pr-2.5 font-semibold text-rose-500 tabular-nums"
                                                    title={row.proceeded.toLocaleString()}
                                                >
                                                    {formatMetricNumber(row.proceeded)}
                                                </td>
                                                <td
                                                    className="py-3.5 pr-2.5 text-foreground tabular-nums"
                                                    title={total.toLocaleString()}
                                                >
                                                    {formatMetricNumber(total)}
                                                </td>
                                                <td className="py-3.5">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                            successRate >= 70
                                                                ? 'border border-[#00ff66] bg-[rgba(0,255,102,0.15)] text-[#00ff66]'
                                                                : successRate >= 40
                                                                  ? 'border border-[#f59e0b] bg-[rgba(245,158,11,0.15)] text-[#f59e0b]'
                                                                  : 'border border-[#ff4d4d] bg-[rgba(255,77,77,0.15)] text-[#ff4d4d]'
                                                        }`}
                                                    >
                                                        {successRate}% Contained
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

NudgeEffectiveness.layout = {
    breadcrumbs: [
        { title: 'Shadow Analytics', href: '/security-analytics' },
        {
            title: 'Shadow Containment',
            href: '/security-analytics/nudge-effectiveness',
        },
    ],
};
