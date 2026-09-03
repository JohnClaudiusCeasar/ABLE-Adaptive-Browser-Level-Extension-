import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserStatCardProps {
    label: string;
    value: number;
    icon: LucideIcon;
    accent: string;
    subtitle: string;
    pulseColor: string;
}

export function UserStatCard({
    label,
    value,
    icon: Icon,
    accent,
    subtitle,
    pulseColor,
}: UserStatCardProps) {
    const ringSize = 64;
    const strokeWidth = 3;
    const radius = (ringSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <div
            className={cn(
                'relative flex items-center gap-5 rounded-xl border p-6 backdrop-blur-[12px]',
                'bg-[rgba(34,197,94,0.06)] border-[rgba(34,197,94,0.3)]',
                'dark:bg-white/[0.04] dark:border-[rgba(34,197,94,0.5)]',
            )}
            style={{
                boxShadow: `0 0 20px -4px ${pulseColor}15, 0 4px 12px -2px rgba(0,0,0,0.08)`,
            }}
        >
            {/* Circular ring with icon */}
            <div className="relative flex shrink-0 items-center justify-center">
                <svg
                    width={ringSize}
                    height={ringSize}
                    className="rotate-[-90deg]"
                >
                    {/* Background ring */}
                    <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-black/5 dark:text-white/10"
                    />
                    {/* Accent ring */}
                    <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * 0.25}
                        strokeLinecap="round"
                        className={cn(accent)}
                    />
                </svg>
                <Icon
                    size={24}
                    className={cn('absolute', accent)}
                />
            </div>

            {/* Value and label */}
            <div className="flex flex-col gap-1 min-w-0">
                <p
                    className={cn(
                        'text-4xl font-bold tabular-nums leading-none tracking-tight',
                        accent,
                    )}
                >
                    {value}
                </p>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                        {label}
                    </span>
                    <span
                        className="h-2 w-2 rounded-full animate-status-pulse"
                        style={{ backgroundColor: pulseColor }}
                    />
                </div>
                <span className="text-xs text-muted-foreground">
                    {subtitle}
                </span>
            </div>
        </div>
    );
}
