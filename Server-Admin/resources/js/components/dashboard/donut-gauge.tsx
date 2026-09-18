import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface DonutSegment {
    color: string;
    value: number;
    label: string;
}

interface DonutGaugeProps {
    segments: DonutSegment[];
    centerLabel: string;
    centerValue: string;
    size?: number;
    noData?: boolean;
    className?: string;
}

export function DonutGauge({
    segments,
    centerLabel,
    centerValue,
    size = 220,
    noData = false,
    className,
}: DonutGaugeProps) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    const total = segments.reduce((sum, s) => sum + s.value, 0);
    const isEmpty = noData || total === 0;

    // SVG geometry calculations
    const strokeWidth = 24;
    const activeStrokeWidth = 32;
    const radius = (size - activeStrokeWidth) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    // Filter valid positive segments for arc calculations
    const activeSegments = segments.filter((s) => s.value > 0);
    const hasMultipleSegments = activeSegments.length > 1;
    // Small gap in circumference units between slices (e.g. 3px gap)
    const gapAngle = hasMultipleSegments ? 3 : 0;

    // Calculate strokeDasharray & offset for each segment
    let accumulatedAngle = 0;
    const arcData = segments.map((segment, index) => {
        if (isEmpty || segment.value <= 0) {
            return {
                ...segment,
                index,
                pct: 0,
                strokeDasharray: '0',
                strokeDashoffset: 0,
                startPct: 0,
            };
        }

        const pct = (segment.value / total) * 100;
        const segmentLength = (segment.value / total) * circumference;
        const dashLength = Math.max(0, segmentLength - gapAngle);
        const spaceLength = circumference - dashLength;

        const offset = -accumulatedAngle;
        accumulatedAngle += segmentLength;

        return {
            ...segment,
            index,
            pct,
            strokeDasharray: `${dashLength} ${spaceLength}`,
            strokeDashoffset: offset,
        };
    });

    const activeHoveredSegment =
        hoveredIdx !== null && segments[hoveredIdx]
            ? {
                  ...segments[hoveredIdx],
                  pct:
                      total > 0
                          ? ((segments[hoveredIdx].value / total) * 100).toFixed(
                                1,
                            )
                          : '0.0',
              }
            : null;

    return (
        <div
            className={cn(
                'flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10',
                className,
            )}
        >
            {/* Interactive SVG Donut Container */}
            <div
                className="relative flex shrink-0 items-center justify-center select-none"
                style={{ width: size, height: size }}
            >
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="-rotate-90 overflow-visible transition-transform duration-300"
                >
                    <defs>
                        <filter
                            id="glow-shadow"
                            x="-20%"
                            y="-20%"
                            width="140%"
                            height="140%"
                        >
                            <feDropShadow
                                dx="0"
                                dy="0"
                                stdDeviation="4"
                                floodOpacity="0.4"
                            />
                        </filter>
                    </defs>

                    {/* Base Background Track Circle */}
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-black/5 dark:text-white/5"
                    />

                    {/* Interactive Segments */}
                    {!isEmpty ? (
                        arcData.map((arc) => {
                            if (arc.value <= 0) return null;
                            const isHovered = hoveredIdx === arc.index;
                            const isAnyHovered = hoveredIdx !== null;

                            return (
                                <circle
                                    key={arc.label}
                                    cx={center}
                                    cy={center}
                                    r={radius}
                                    fill="transparent"
                                    stroke={arc.color}
                                    strokeWidth={
                                        isHovered
                                            ? activeStrokeWidth
                                            : strokeWidth
                                    }
                                    strokeDasharray={arc.strokeDasharray}
                                    strokeDashoffset={arc.strokeDashoffset}
                                    strokeLinecap="round"
                                    filter={
                                        isHovered
                                            ? 'url(#glow-shadow)'
                                            : undefined
                                    }
                                    className="cursor-pointer transition-all duration-300 ease-out"
                                    style={{
                                        opacity:
                                            isAnyHovered && !isHovered
                                                ? 0.35
                                                : 1,
                                    }}
                                    onMouseEnter={() =>
                                        setHoveredIdx(arc.index)
                                    }
                                    onMouseLeave={() => setHoveredIdx(null)}
                                />
                            );
                        })
                    ) : (
                        /* Empty State Arc */
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="transparent"
                            stroke="#3f4a44"
                            strokeWidth={strokeWidth}
                            strokeDasharray="4 6"
                            className="opacity-40"
                        />
                    )}
                </svg>

                {/* HUD Center Hole (Dynamic Telemetry Inspection) */}
                <div
                    className={cn(
                        'pointer-events-none absolute flex flex-col items-center justify-center rounded-full text-center transition-all duration-300',
                        'bg-background/80 shadow-inner backdrop-blur-md dark:bg-[#12241e]/90',
                        hoveredIdx !== null && 'scale-105 shadow-md',
                    )}
                    style={{
                        width: radius * 2 - strokeWidth - 6,
                        height: radius * 2 - strokeWidth - 6,
                    }}
                >
                    {activeHoveredSegment ? (
                        /* Inspected Segment Hover Mode */
                        <div className="flex flex-col items-center px-2 animate-in fade-in zoom-in-95 duration-150">
                            <span
                                className="text-xs font-semibold uppercase tracking-wider"
                                style={{ color: activeHoveredSegment.color }}
                            >
                                {activeHoveredSegment.label}
                            </span>
                            <p className="text-xl font-bold tabular-nums text-foreground">
                                {activeHoveredSegment.value.toLocaleString()}
                            </p>
                            <span className="text-[11px] font-medium text-muted-foreground">
                                {activeHoveredSegment.pct}% of total
                            </span>
                        </div>
                    ) : (
                        /* Default Overview Mode */
                        <div className="flex flex-col items-center px-2">
                            <p className="text-2xl leading-none font-bold tabular-nums text-foreground">
                                {centerValue}
                            </p>
                            <p className="mt-1 text-[0.8rem] text-muted-foreground">
                                {centerLabel}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bi-Directional Interactive Legend */}
            {isEmpty ? (
                <div className="flex min-w-[150px] items-center justify-center">
                    <span className="text-sm font-medium text-muted-foreground italic">
                        No Data Available
                    </span>
                </div>
            ) : (
                <ul className="flex min-w-[160px] flex-col gap-2">
                    {segments.map((s, idx) => {
                        const isHovered = hoveredIdx === idx;
                        const pct =
                            total > 0
                                ? ((s.value / total) * 100).toFixed(1)
                                : '0.0';

                        return (
                            <li
                                key={s.label}
                                className={cn(
                                    'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-200',
                                    isHovered
                                        ? 'bg-black/10 shadow-xs dark:bg-white/10'
                                        : 'hover:bg-black/5 dark:hover:bg-white/5',
                                )}
                                onMouseEnter={() => setHoveredIdx(idx)}
                                onMouseLeave={() => setHoveredIdx(null)}
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            'h-2.5 w-2.5 shrink-0 rounded-full transition-transform duration-200',
                                            isHovered && 'scale-125 shadow-sm',
                                        )}
                                        style={{ backgroundColor: s.color }}
                                    />
                                    <span
                                        className={cn(
                                            'transition-colors',
                                            isHovered
                                                ? 'font-semibold text-foreground'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {s.label}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold tabular-nums text-foreground">
                                        {s.value.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground tabular-nums">
                                        ({pct}%)
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
