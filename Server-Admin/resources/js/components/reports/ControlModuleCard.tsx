import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Timeframe } from './types';

interface ControlModuleCardProps {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    iconColor: string;
    title: string;
    description: string;
    enabled: boolean;
    onToggle: (val: boolean) => void;
    activeTimeframe: Timeframe;
    onTimeframeChange: (tf: Timeframe) => void;
}

export function ControlModuleCard({
    icon: Icon,
    iconColor,
    title,
    description,
    enabled,
    onToggle,
    activeTimeframe,
    onTimeframeChange,
}: ControlModuleCardProps) {
    const timeframes: { key: Timeframe; label: string }[] = [
        { key: 'daily', label: 'Daily' },
        { key: 'weekly', label: 'Weekly' },
        { key: 'monthly', label: 'Monthly' },
        { key: 'yearly', label: 'Yearly' },
    ];

    return (
        <div
            className={cn(
                'flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200',
                enabled
                    ? 'border-able-green/40 bg-card shadow-[0_0_15px_rgba(34,197,94,0.08)]'
                    : 'border-border/60 bg-card/40 opacity-70',
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div
                        className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg bg-white/5',
                            iconColor,
                        )}
                    >
                        <Icon size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                                {title}
                            </span>
                            {enabled && (
                                <Badge
                                    variant="outline"
                                    className="border-able-green/30 text-[10px] text-able-green uppercase"
                                >
                                    {activeTimeframe}
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {description}
                        </p>
                    </div>
                </div>

                <Checkbox
                    checked={enabled}
                    onCheckedChange={(checked) => onToggle(Boolean(checked))}
                    className="data-[state=checked]:bg-able-green data-[state=checked]:text-black"
                />
            </div>

            {/* Timeframe selector pill buttons */}
            {enabled && (
                <div className="mt-1 flex rounded-lg border border-border/70 bg-background/60 p-1">
                    {timeframes.map((tf) => {
                        const isActive = activeTimeframe === tf.key;

                        return (
                            <button
                                key={tf.key}
                                type="button"
                                onClick={() => onTimeframeChange(tf.key)}
                                className={cn(
                                    'flex-1 rounded-md py-1 text-center text-xs font-medium transition-all',
                                    isActive
                                        ? 'bg-able-green/20 font-semibold text-able-green shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {tf.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
