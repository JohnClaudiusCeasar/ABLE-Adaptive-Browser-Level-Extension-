import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    accent: string; // tailwind text color, e.g. text-able-green
    underline: string; // tailwind bg color for the accent line
    suffix?: string;
}

export function StatCard({ label, value, icon: Icon, accent, underline, suffix }: StatCardProps) {
    return (
        <div className={cn(glassCard, 'p-5 flex flex-col gap-3')}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span
                    className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                        accent,
                        'bg-current/10',
                    )}
                >
                    <Icon size={18} className={accent} />
                </span>
            </div>
            <p className={cn('text-3xl font-semibold tabular-nums leading-none', accent)}>
                {value}
                {suffix && <span className="text-lg ml-1">{suffix}</span>}
            </p>
            <span className={cn('block h-0.5 w-10 rounded-full', underline)} />
        </div>
    );
}
