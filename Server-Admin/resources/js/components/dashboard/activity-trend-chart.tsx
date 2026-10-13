import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TrendPoint {
    date: string;
    day: string;
    label: string;
    visits: number;
    egress: number;
}

interface ActivityTrendChartProps {
    data: TrendPoint[];
    className?: string;
}

type SeriesKey = 'visits' | 'egress';

const SERIES: Record<
    SeriesKey,
    { label: string; stroke: string; fill: string; dot: string }
> = {
    visits: {
        label: 'Domain Visits',
        stroke: '#38bdf8',
        fill: 'rgba(56, 189, 248, 0.12)',
        dot: 'bg-sky-400',
    },
    egress: {
        label: 'Egress Incidents',
        stroke: '#fb7185',
        fill: 'rgba(251, 113, 133, 0.12)',
        dot: 'bg-rose-500',
    },
};

const CHART_HEIGHT = 220;
const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

function smoothPath(
    points: { x: number; y: number }[],
    xFor: (i: number) => number,
): string {
    if (points.length < 3) {
        return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(
            ' ',
        );
    }

    let d = `M${points[0].x},${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
        void xFor;
    }

    return d;
}

export function ActivityTrendChart({ data, className }: ActivityTrendChartProps) {
    const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    const visible = (['visits', 'egress'] as SeriesKey[]).filter(
        (k) => !hidden.has(k),
    );
    const hasData = data.some((d) => d.visits > 0 || d.egress > 0);

    const toggle = (key: SeriesKey) => {
        setHidden((prev) => {
            if (!prev.has(key) && visible.length === 1) {
                return prev;
            }

            const next = new Set(prev);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    };

    const maxValue = Math.max(
        ...data.flatMap((d) => visible.map((k) => d[k])),
        0,
    );
    const yMax = maxValue > 0 ? Math.ceil(maxValue * 1.15) : 10;
    const yTicks = [
        yMax,
        Math.round((yMax * 2) / 3),
        Math.round(yMax / 3),
        0,
    ];

    const width = 720;
    const innerWidth = width - PAD_LEFT - PAD_RIGHT;
    const innerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
    const xFor = (i: number) =>
        data.length === 1
            ? PAD_LEFT + innerWidth / 2
            : PAD_LEFT + (i / (data.length - 1)) * innerWidth;
    const yFor = (v: number) =>
        PAD_TOP + innerHeight - (v / yMax) * innerHeight;

    const tickStep = Math.max(1, Math.ceil(data.length / 7));
    const tickIdxs = Array.from(
        new Set([
            ...data.map((_, i) => i).filter((i) => i % tickStep === 0),
            data.length - 1,
        ]),
    );
    const shortTick = (p: TrendPoint) => {
        const d = new Date(`${p.date}T12:00:00`);

        return isNaN(d.getTime()) ? p.day : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const totalVisits = data.reduce((acc, d) => acc + d.visits, 0);
    const totalEgress = data.reduce((acc, d) => acc + d.egress, 0);

    const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * width;
        let best = 0;
        let bestDist = Infinity;

        data.forEach((_, i) => {
            const dist = Math.abs(xFor(i) - px);

            if (dist < bestDist) {
                bestDist = dist;
                best = i;
            }
        });

        setHoveredIdx(best);
    };

    return (
        <div className={cn('flex flex-col gap-5', className)}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-3 dark:border-white/5">
                <div className="flex items-center gap-2 text-xs font-medium">
                    {(Object.keys(SERIES) as SeriesKey[]).map((key) => {
                        const active = !hidden.has(key);
                        const isLastActive = active && visible.length === 1;

                        return (
                            <button
                                key={key}
                                type="button"
                                aria-pressed={active}
                                disabled={isLastActive}
                                onClick={() => toggle(key)}
                                title={
                                    isLastActive
                                        ? 'At least one series stays visible'
                                        : `${active ? 'Hide' : 'Show'} ${SERIES[key].label}`
                                }
                                className={cn(
                                    'inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-able-green focus-visible:outline-none',
                                    active
                                        ? 'bg-black/5 text-foreground dark:bg-white/10'
                                        : 'text-muted-foreground/60 hover:text-muted-foreground',
                                    isLastActive && 'cursor-not-allowed',
                                )}
                            >
                                <span
                                    className={cn(
                                        'h-2.5 w-2.5 rounded-full',
                                        SERIES[key].dot,
                                        !active && 'opacity-30',
                                    )}
                                />
                                <span>{SERIES[key].label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-muted-foreground dark:bg-white/5">
                        <span>Visits:</span>
                        <strong className="font-semibold text-foreground tabular-nums">
                            {totalVisits.toLocaleString()}
                        </strong>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400">
                        <span>Egress:</span>
                        <strong className="font-semibold tabular-nums">
                            {totalEgress.toLocaleString()}
                        </strong>
                    </div>
                </div>
            </div>

            <div className="relative">
                {!hasData ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <svg
                            width="100%"
                            height="120"
                            viewBox={`0 0 ${width} 120`}
                            preserveAspectRatio="none"
                            className="opacity-25"
                        >
                            <path
                                d={`M0,90 C120,70 240,95 360,60 S600,40 720,70`}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth="2"
                                opacity="0.4"
                            />
                            <path
                                d={`M0,100 C150,95 300,100 450,90 S600,85 720,95`}
                                fill="none"
                                stroke="#fb7185"
                                strokeWidth="2"
                                opacity="0.4"
                            />
                        </svg>
                        <span className="mt-4 text-xs font-medium tracking-wider text-muted-foreground/70 uppercase">
                            No Activity Recorded in Selected Window
                        </span>
                    </div>
                ) : (
                    <div className="relative">
                        <div
                            className="pointer-events-none absolute flex flex-col justify-between"
                            style={{
                                left: 0,
                                right: 0,
                                top: PAD_TOP,
                                height: innerHeight,
                            }}
                        >
                            {yTicks.map((tick, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="w-7 shrink-0 text-right text-[10px] font-medium text-muted-foreground/60 tabular-nums">
                                        {tick}
                                    </span>
                                    <div
                                        className={cn(
                                            'h-px flex-1',
                                            i === yTicks.length - 1
                                                ? 'bg-black/15 dark:bg-white/15'
                                                : 'border-t border-dashed border-black/10 dark:border-white/10',
                                        )}
                                    />
                                </div>
                            ))}
                        </div>

                        <svg
                            role="img"
                            aria-label={`Domain visits and egress trend: ${totalVisits.toLocaleString()} visits and ${totalEgress.toLocaleString()} egress incidents across ${data.length} days.`}
                            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
                            className="relative z-10 block w-full"
                            onMouseMove={onMove}
                            onMouseLeave={() => setHoveredIdx(null)}
                        >
                            {visible.map((key) => {
                                const pts = data.map((d, i) => ({
                                    x: xFor(i),
                                    y: yFor(d[key]),
                                }));
                                const line = smoothPath(pts, xFor);
                                const area = `${line} L${pts[pts.length - 1].x},${PAD_TOP + innerHeight} L${pts[0].x},${PAD_TOP + innerHeight} Z`;

                                return (
                                    <g key={key}>
                                        <path
                                            d={area}
                                            fill={SERIES[key].fill}
                                        />
                                        <path
                                            d={line}
                                            fill="none"
                                            stroke={SERIES[key].stroke}
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </g>
                                );
                            })}

                            {data.length <= 14 &&
                                visible.map((key) =>
                                    data.map((d, i) => (
                                        <circle
                                            key={`${key}-${i}`}
                                            cx={xFor(i)}
                                            cy={yFor(d[key])}
                                            r={hoveredIdx === i ? 4.5 : 3}
                                            fill={SERIES[key].stroke}
                                            stroke="var(--background)"
                                            strokeWidth="1.5"
                                        />
                                    )),
                                )}

                            {hoveredIdx !== null && (
                                <line
                                    x1={xFor(hoveredIdx)}
                                    x2={xFor(hoveredIdx)}
                                    y1={PAD_TOP}
                                    y2={PAD_TOP + innerHeight}
                                    stroke="currentColor"
                                    strokeOpacity="0.25"
                                    strokeDasharray="3 3"
                                />
                            )}
                        </svg>

                        {hoveredIdx !== null && (
                            <div
                                className="pointer-events-none absolute z-30 flex flex-col items-center"
                                style={{
                                    left: `clamp(70px, ${(xFor(hoveredIdx) / width) * 100}%, calc(100% - 70px))`,
                                    top: 0,
                                    transform: 'translate(-50%, 0)',
                                }}
                            >
                                <div className="flex min-w-[135px] flex-col gap-1 rounded-md border border-black/10 bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-lg backdrop-blur-md dark:border-white/15">
                                    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-1 font-semibold">
                                        <span>{data[hoveredIdx].day}</span>
                                        <span className="text-[10px] font-normal text-muted-foreground">
                                            {data[hoveredIdx].label}
                                        </span>
                                    </div>
                                    {visible.map((key) => (
                                        <div
                                            key={key}
                                            className="flex items-center justify-between gap-3 text-[11px]"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className={cn(
                                                        'h-2 w-2 rounded-full',
                                                        SERIES[key].dot,
                                                    )}
                                                />
                                                <span className="text-muted-foreground">
                                                    {key === 'visits'
                                                        ? 'Visits:'
                                                        : 'Egress:'}
                                                </span>
                                            </div>
                                            <span className="font-semibold text-foreground tabular-nums">
                                                {data[hoveredIdx][
                                                    key
                                                ].toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="relative z-10 mt-1 overflow-hidden">
                            <div
                                className="relative"
                                style={{
                                    marginLeft: PAD_LEFT,
                                    marginRight: PAD_RIGHT,
                                    height: 16,
                                }}
                            >
                                {tickIdxs.map((i) => {
                                    const pct =
                                        data.length === 1
                                            ? 50
                                            : (i / (data.length - 1)) * 100;
                                    const align =
                                        pct <= 8
                                            ? 'left'
                                            : pct >= 92
                                              ? 'right'
                                              : 'center';

                                    return (
                                        <span
                                            key={data[i].date}
                                            className="absolute top-0 text-[10px] font-medium whitespace-nowrap text-muted-foreground tabular-nums"
                                            style={{
                                                left: `${pct}%`,
                                                transform:
                                                    align === 'left'
                                                        ? 'translateX(0)'
                                                        : align === 'right'
                                                          ? 'translateX(-100%)'
                                                          : 'translateX(-50%)',
                                            }}
                                        >
                                            {shortTick(data[i])}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
