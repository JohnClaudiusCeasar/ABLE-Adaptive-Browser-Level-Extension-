interface DonutSegment {
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
}

export function DonutGauge({
    segments,
    centerLabel,
    centerValue,
    size = 200,
    noData = false,
}: DonutGaugeProps) {
    const total = segments.reduce((sum, s) => sum + s.value, 0);

    const gradient =
        noData || total === 0
            ? 'conic-gradient(#3f4a44 0% 100%)'
            : (() => {
                  let cursor = 0;
                  const stops = segments.map((s) => {
                      const pct = (s.value / total) * 100;
                      const start = cursor;
                      cursor += pct;

                      return `${s.color} ${start}% ${cursor}%`;
                  });

                  return `conic-gradient(${stops.join(', ')})`;
              })();

    const holeSize = Math.round(size * 0.65);

    return (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
            <div
                className="flex shrink-0 items-center justify-center rounded-full shadow-lg"
                style={{ width: size, height: size, background: gradient }}
            >
                <div
                    className="flex items-center justify-center rounded-full bg-[#1a4033] text-center"
                    style={{ width: holeSize, height: holeSize }}
                >
                    <div>
                        <p className="text-2xl leading-none font-bold tabular-nums">
                            {centerValue}
                        </p>
                        <p className="mt-1 text-[0.8rem] text-muted-foreground">
                            {centerLabel}
                        </p>
                    </div>
                </div>
            </div>

            {noData ? (
                <div className="flex min-w-[140px] items-center justify-center">
                    <span className="text-sm font-medium text-muted-foreground italic">
                        No Data
                    </span>
                </div>
            ) : (
                <ul className="flex min-w-[140px] flex-col gap-2.5">
                    {segments.map((s) => (
                        <li
                            key={s.label}
                            className="flex items-center gap-2.5 text-sm"
                        >
                            <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: s.color }}
                            />
                            <span className="text-muted-foreground">{s.label}</span>
                            <span className="ml-auto font-medium tabular-nums">
                                {s.value}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
