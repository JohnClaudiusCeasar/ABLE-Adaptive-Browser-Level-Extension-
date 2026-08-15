import { cn } from '@/lib/utils';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface PanelCardProps {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

export function PanelCard({ title, subtitle, action, className, children }: PanelCardProps) {
    return (
        <div className={cn(glassCard, 'p-6', className)}>
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h2
                        className="text-xl font-semibold uppercase tracking-wide"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                    )}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}
