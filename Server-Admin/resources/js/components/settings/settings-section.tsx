import type { PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

export function SettingsSection({
    title,
    description,
    children,
    className,
}: PropsWithChildren<{
    title: string;
    description?: string;
    className?: string;
}>) {
    return (
        <section className={cn(glassCard, 'space-y-7 p-7', className)}>
            <header className="space-y-[3px]">
                <h2 className="text-base font-semibold text-foreground">
                    {title}
                </h2>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </header>
            <div className="space-y-7">{children}</div>
        </section>
    );
}
