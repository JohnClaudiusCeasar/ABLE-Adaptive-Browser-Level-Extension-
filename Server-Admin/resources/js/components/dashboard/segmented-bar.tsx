import { cn } from '@/lib/utils';

interface Segment {
    color: string;
    label: string;
    value: string | number;
    pct: number; // 0-100 share of the combined total
}

interface SegmentedBarProps {
    title: string;
    segments: Segment[];
}

export function SegmentedBar({ title, segments }: SegmentedBarProps) {
    return (
        <div>
            <h3 className="mb-3 text-sm text-muted-foreground">{title}</h3>
            <div className="flex h-3 w-full overflow-hidden rounded-md bg-black/5 dark:bg-white/10">
                {segments.map((s) => (
                    <div
                        key={s.label}
                        className={cn(
                            'h-full transition-all',
                            s.pct === 0 && 'hidden',
                        )}
                        style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                    />
                ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {segments.map((s) => (
                    <div
                        key={s.label}
                        className="flex items-center gap-2 text-sm"
                    >
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                        />
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="font-medium tabular-nums">
                            {s.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
