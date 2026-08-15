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
            <h3 className="text-sm text-muted-foreground mb-3">{title}</h3>
            <div className="h-3 w-full rounded-md bg-black/5 dark:bg-white/10 overflow-hidden flex">
                {segments.map((s) => (
                    <div
                        key={s.label}
                        className={cn('h-full transition-all', s.pct === 0 && 'hidden')}
                        style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                    />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
                {segments.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-sm">
                        <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: s.color }}
                        />
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="font-medium tabular-nums">{s.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
