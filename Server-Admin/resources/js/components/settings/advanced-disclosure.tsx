import type { PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

export function AdvancedDisclosure({
    title = 'Advanced',
    description = 'Rarely changed tuning. Defaults are safe to keep.',
    children,
    className,
}: PropsWithChildren<{
    title?: string;
    description?: string;
    className?: string;
}>) {
    return (
        <details className={cn(glassCard, 'p-7', className, 'group')}>
            <summary className="cursor-pointer space-y-[3px]">
                <h2 className="text-base font-semibold text-foreground">
                    {title}
                </h2>
                <p className="text-sm text-muted-foreground">{description}</p>
                <p className="text-xs text-muted-foreground group-open:hidden">
                    Show rarely used settings…
                </p>
            </summary>
            <div className="mt-7 space-y-7">{children}</div>
        </details>
    );
}
