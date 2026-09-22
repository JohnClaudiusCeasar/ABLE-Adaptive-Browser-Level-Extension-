import type { LucideIcon } from 'lucide-react';
import { cn, formatMetricNumber } from '@/lib/utils';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    accent: string; // tailwind text color, e.g. text-able-green
    underline: string; // tailwind bg color for the accent line
    suffix?: string;
    subtitle?: string;
}

export function StatCard({
    label,
    value,
    icon: Icon,
    accent,
    underline,
    suffix,
    subtitle,
}: StatCardProps) {
    const formattedValue = formatMetricNumber(value);
    const fullValueTooltip =
        typeof value === 'number'
            ? value.toLocaleString()
            : typeof value === 'string'
              ? value
              : undefined;

    return (
        <div className={cn(glassCard, 'flex flex-col gap-3 p-5')}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span
                    className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        accent,
                        'bg-current/10',
                    )}
                >
                    <Icon size={18} className={accent} />
                </span>
            </div>
            <p
                className={cn(
                    'text-3xl leading-none font-semibold tabular-nums',
                    accent,
                )}
                title={fullValueTooltip}
            >
                {formattedValue}
                {suffix && <span className="ml-1 text-lg">{suffix}</span>}
            </p>
            {subtitle && (
                <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
            <span className={cn('block h-0.5 w-10 rounded-full', underline)} />
        </div>
    );
}
