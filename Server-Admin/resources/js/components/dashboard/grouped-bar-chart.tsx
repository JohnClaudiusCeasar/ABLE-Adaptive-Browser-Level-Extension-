interface DailyActivity {
    date: string;
    day: string;
    visits: number;
    egress: number;
}

interface GroupedBarChartProps {
    data: DailyActivity[];
}

export function GroupedBarChart({ data }: GroupedBarChartProps) {
    const maxVisits = Math.max(...data.map((d) => d.visits), 1);
    const maxEgress = Math.max(...data.map((d) => d.egress), 1);
    const maxValue = Math.max(maxVisits, maxEgress);
    const hasData = data.some((d) => d.visits > 0 || d.egress > 0);

    const chartHeight = 180;
    const barWidth = 28;
    const groupGap = 16;
    const barGap = 4;

    // Y-axis grid lines
    const gridLines = 4;

    return (
        <div className="flex flex-col gap-6">
            {/* Legend */}
            <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-blue-400" />
                    <span className="text-sm text-muted-foreground">
                        Domain Visits
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-[#ff4d4d]" />
                    <span className="text-sm text-muted-foreground">
                        Egress Count
                    </span>
                </div>
            </div>

            {/* Chart */}
            <div className="relative">
                {hasData ? (
                    <div className="flex items-end justify-between gap-2 px-2">
                        {data.map((d) => {
                            const visitHeight =
                                (d.visits / maxValue) * chartHeight;
                            const egressHeight =
                                (d.egress / maxValue) * chartHeight;

                            return (
                                <div
                                    key={d.date}
                                    className="flex flex-col items-center gap-1"
                                >
                                    {/* Tooltip */}
                                    <div className="mb-1 text-xs font-medium tabular-nums">
                                        {d.visits > 0 && (
                                            <span className="text-blue-400">
                                                {d.visits}
                                            </span>
                                        )}
                                        {d.visits > 0 && d.egress > 0 && (
                                            <span className="text-muted-foreground">
                                                {' '}
                                                /{' '}
                                            </span>
                                        )}
                                        {d.egress > 0 && (
                                            <span className="text-[#ff4d4d]">
                                                {d.egress}
                                            </span>
                                        )}
                                        {d.visits === 0 && d.egress === 0 && (
                                            <span className="text-muted-foreground">
                                                0
                                            </span>
                                        )}
                                    </div>

                                    {/* Bars */}
                                    <div
                                        className="flex items-end gap-0.5"
                                        style={{ height: chartHeight }}
                                    >
                                        {/* Visits bar */}
                                        <div
                                            className="w-4 rounded-t-sm bg-gradient-to-t from-blue-500 to-blue-400 transition-all duration-300 hover:from-blue-400 hover:to-blue-300"
                                            style={{
                                                height: Math.max(
                                                    visitHeight,
                                                    2
                                                ),
                                                opacity:
                                                    d.visits > 0 ? 1 : 0.3,
                                            }}
                                        />
                                        {/* Egress bar */}
                                        <div
                                            className="w-4 rounded-t-sm bg-gradient-to-t from-[#ff4d4d] to-[#ff6b6b] transition-all duration-300 hover:from-[#ff6b6b] hover:to-[#ff8a8a]"
                                            style={{
                                                height: Math.max(
                                                    egressHeight,
                                                    2
                                                ),
                                                opacity:
                                                    d.egress > 0 ? 1 : 0.3,
                                            }}
                                        />
                                    </div>

                                    {/* Day label */}
                                    <span className="mt-2 text-xs font-medium text-muted-foreground">
                                        {d.day}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* No Data state */
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="flex items-end gap-3 opacity-30">
                            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                <div
                                    key={i}
                                    className="flex gap-0.5"
                                    style={{ height: 100 }}
                                >
                                    <div
                                        className="w-4 rounded-t-sm bg-[#3f4a4a]"
                                        style={{ height: 20 + i * 5 }}
                                    />
                                    <div
                                        className="w-4 rounded-t-sm bg-[#3f4a4a]"
                                        style={{ height: 15 + i * 3 }}
                                    />
                                </div>
                            ))}
                        </div>
                        <span className="mt-4 text-sm font-medium italic text-muted-foreground">
                            No Data
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
