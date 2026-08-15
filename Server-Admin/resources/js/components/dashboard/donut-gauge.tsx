import { cn } from '@/lib/utils';

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
}

export function DonutGauge({ segments, centerLabel, centerValue, size = 200 }: DonutGaugeProps) {
    const total = segments.reduce((sum, s) => sum + s.value, 0);

    const gradient =
        total === 0
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
                className="rounded-full flex items-center justify-center shadow-lg shrink-0"
                style={{ width: size, height: size, background: gradient }}
            >
                <div
                    className="bg-[#1a4033] rounded-full flex items-center justify-center text-center"
                    style={{ width: holeSize, height: holeSize }}
                >
                    <div>
                        <p className="text-2xl font-bold tabular-nums leading-none">{centerValue}</p>
                        <p className="text-[0.8rem] text-muted-foreground mt-1">{centerLabel}</p>
                    </div>
                </div>
            </div>

            <ul className="flex flex-col gap-2.5 min-w-[140px]">
                {segments.map((s) => (
                    <li key={s.label} className="flex items-center gap-2.5 text-sm">
                        <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: s.color }}
                        />
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="ml-auto font-medium tabular-nums">{s.value}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
