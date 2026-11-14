interface PaperMetricCardProps {
    label: string;
    value: string;
    sub: string;
    accent: string;
}

export function PaperMetricCard({
    label,
    value,
    sub,
    accent,
}: PaperMetricCardProps) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-xs">
            <span className="block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                {label}
            </span>
            <p
                style={{ color: accent }}
                className="mt-0.5 font-mono text-xl font-bold"
            >
                {value}
            </p>
            <span className="block text-[9px] text-slate-500">{sub}</span>
        </div>
    );
}
