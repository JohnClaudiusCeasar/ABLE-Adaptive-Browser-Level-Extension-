import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DailyActivity {
    date: string;
    day: string;
    visits: number;
    egress: number;
}

interface GroupedBarChartProps {
    data: DailyActivity[];
    className?: string;
}

export function GroupedBarChart({ data, className }: GroupedBarChartProps) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    const maxVisits = Math.max(...data.map((d) => d.visits), 0);
    const maxEgress = Math.max(...data.map((d) => d.egress), 0);
    const rawMax = Math.max(maxVisits, maxEgress);
    // Round max value up with comfortable headroom
    const maxValue = rawMax > 0 ? Math.ceil(rawMax * 1.15) : 10;
    const hasData = data.some((d) => d.visits > 0 || d.egress > 0);

    const totalVisits = data.reduce((acc, d) => acc + d.visits, 0);
    const totalEgress = data.reduce((acc, d) => acc + d.egress, 0);
    const egressRate =
        totalVisits > 0 ? ((totalEgress / totalVisits) * 100).toFixed(1) : '0.0';

    const chartHeight = 200;

    // Y-axis ticks (top, 2/3, 1/3, 0)
    const yTicks = [
        maxValue,
        Math.round((maxValue * 2) / 3),
        Math.round(maxValue / 3),
        0,
    ];

    return (
        <div className={cn('flex flex-col gap-5', className)}>
            {/* Legend and Summary Stats Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-3 dark:border-white/5">
                {/* Visual Legend */}
                <div className="flex items-center gap-5 text-xs font-medium">
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3.5 rounded-[3px] bg-gradient-to-t from-sky-600 to-sky-400 shadow-xs shadow-sky-500/30" />
                        <span className="text-muted-foreground">
                            Domain Visits
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3.5 rounded-[3px] bg-gradient-to-t from-rose-600 to-rose-400 shadow-xs shadow-rose-500/30" />
                        <span className="text-muted-foreground">
                            Egress Incidents
                        </span>
                    </div>
                </div>

                {/* 7-Day Snapshot Stats */}
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-muted-foreground dark:bg-white/5">
                        <span>7d Visits:</span>
                        <strong className="font-semibold text-foreground tabular-nums">
                            {totalVisits.toLocaleString()}
                        </strong>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400">
                        <span>7d Egress:</span>
                        <strong className="font-semibold tabular-nums">
                            {totalEgress.toLocaleString()}
                        </strong>
                        <span className="text-[10px] opacity-75">
                            ({egressRate}%)
                        </span>
                    </div>
                </div>
            </div>

            {/* Chart Body */}
            <div className="relative pt-6">
                {hasData ? (
                    <div className="relative">
                        {/* Background Horizontal Gridlines & Y-Axis Labels */}
                        <div
                            className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between"
                            style={{ height: chartHeight }}
                        >
                            {yTicks.map((tick, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2"
                                >
                                    <span className="w-7 text-right text-[10px] font-medium text-muted-foreground/60 tabular-nums">
                                        {tick}
                                    </span>
                                    <div
                                        className={cn(
                                            'h-px flex-1',
                                            index === yTicks.length - 1
                                                ? 'bg-black/15 dark:bg-white/15'
                                                : 'border-t border-dashed border-black/10 dark:border-white/10',
                                        )}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Bars Container */}
                        <div
                            className="relative z-10 flex items-end justify-between pl-10 pr-2"
                            style={{ height: chartHeight }}
                        >
                            {data.map((d, idx) => {
                                const isHovered = hoveredIdx === idx;
                                const visitHeight = Math.max(
                                    (d.visits / maxValue) * chartHeight,
                                    d.visits > 0 ? 6 : 0,
                                );
                                const egressHeight = Math.max(
                                    (d.egress / maxValue) * chartHeight,
                                    d.egress > 0 ? 6 : 0,
                                );
                                return (
                                    <div
                                        key={d.date}
                                        className="group relative flex flex-1 flex-col items-center justify-end"
                                        style={{ height: chartHeight }}
                                        onMouseEnter={() => setHoveredIdx(idx)}
                                        onMouseLeave={() => setHoveredIdx(null)}
                                    >
                                        {/* Hover Tooltip Card */}
                                        {isHovered && (
                                            <div
                                                className="pointer-events-none absolute -top-16 z-30 flex flex-col items-center animate-in fade-in zoom-in-95 duration-150"
                                            >
                                                <div className="flex min-w-[135px] flex-col gap-1 rounded-md border border-black/10 bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-lg backdrop-blur-md dark:border-white/15">
                                                    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-1 font-semibold">
                                                        <span>{d.day}</span>
                                                        <span className="text-[10px] font-normal text-muted-foreground">
                                                            {d.date}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 text-[11px]">
                                                        <div className="flex items-center gap-1.5 text-sky-500 dark:text-sky-400">
                                                            <span className="h-2 w-2 rounded-full bg-sky-400" />
                                                            <span>Visits:</span>
                                                        </div>
                                                        <span className="font-semibold tabular-nums text-foreground">
                                                            {d.visits.toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 text-[11px]">
                                                        <div className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400">
                                                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                                                            <span>Egress:</span>
                                                        </div>
                                                        <span className="font-semibold tabular-nums text-foreground">
                                                            {d.egress.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Tooltip Arrow */}
                                                <div className="h-2 w-2 -rotate-45 border-b border-l border-black/10 bg-popover/95 dark:border-white/15 -mt-1" />
                                            </div>
                                        )}

                                        {/* Day Column Track: Exactly matches combined width of dual pillars */}
                                        <div
                                            className={cn(
                                                'relative flex w-10 sm:w-12 items-end justify-center rounded-t-md transition-all duration-300',
                                                isHovered
                                                    ? 'bg-black/[0.04] dark:bg-white/[0.06]'
                                                    : 'bg-black/[0.02] dark:bg-white/[0.02]',
                                            )}
                                            style={{ height: chartHeight }}
                                        >
                                            {/* Touching Dual Pillars Container */}
                                            <div className="flex w-full items-end justify-center">
                                                {/* Bar 1: Domain Visits Pillar */}
                                                <div
                                                    className={cn(
                                                        'relative w-1/2 rounded-tl-md bg-gradient-to-t from-sky-600 via-sky-500 to-sky-400 transition-all duration-300 shadow-xs shadow-sky-500/20',
                                                        isHovered &&
                                                            'from-sky-500 via-sky-400 to-sky-300 shadow-md shadow-sky-500/30',
                                                    )}
                                                    style={{
                                                        height: visitHeight,
                                                        opacity:
                                                            d.visits > 0
                                                                ? 1
                                                                : 0.25,
                                                    }}
                                                >
                                                    {/* Visits Top Accent Edge */}
                                                    {d.visits > 0 && (
                                                        <div className="absolute inset-x-0 top-0 h-[2px] rounded-tl-md bg-sky-200" />
                                                    )}
                                                </div>

                                                {/* Bar 2: Egress Incidents Pillar (Flush to Visits) */}
                                                <div
                                                    className={cn(
                                                        'relative w-1/2 rounded-tr-md bg-gradient-to-t from-rose-600 via-rose-500 to-rose-400 transition-all duration-300 shadow-xs shadow-rose-500/20',
                                                        isHovered &&
                                                            'from-rose-500 via-rose-400 to-rose-300 shadow-md shadow-rose-500/30',
                                                    )}
                                                    style={{
                                                        height: egressHeight,
                                                        opacity:
                                                            d.egress > 0
                                                                ? 1
                                                                : 0.25,
                                                    }}
                                                >
                                                    {/* Egress Top Accent Edge */}
                                                    {d.egress > 0 && (
                                                        <div className="absolute inset-x-0 top-0 h-[2px] rounded-tr-md bg-rose-200" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Day Labels Axis */}
                        <div className="mt-2.5 flex items-center justify-between pl-10 pr-2">
                            {data.map((d, idx) => (
                                <div
                                    key={d.date}
                                    className="flex flex-1 flex-col items-center"
                                >
                                    <span
                                        className={cn(
                                            'text-xs font-medium transition-colors',
                                            hoveredIdx === idx
                                                ? 'font-semibold text-foreground'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {d.day}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Elegant No Data Placeholder */
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="flex items-end gap-3 opacity-25">
                            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                <div
                                    key={i}
                                    className="flex w-10 sm:w-12 items-end justify-center rounded-t-md bg-black/5 dark:bg-white/5"
                                    style={{ height: 120 }}
                                >
                                    <div className="flex w-full items-end justify-center">
                                        <div
                                            className="w-1/2 rounded-tl-md bg-sky-500/20"
                                            style={{ height: 25 + i * 8 }}
                                        />
                                        <div
                                            className="w-1/2 rounded-tr-md bg-rose-500/20"
                                            style={{ height: 12 + i * 4 }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <span className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                            No Activity Recorded in Selected Window
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
