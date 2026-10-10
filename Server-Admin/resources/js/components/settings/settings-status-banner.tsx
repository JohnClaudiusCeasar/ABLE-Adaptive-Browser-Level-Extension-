import { cn } from '@/lib/utils';

type StatusItem = {
    label: string;
    value: string;
    tone?: 'ok' | 'warn' | 'bad' | 'muted';
};

const toneStyles: Record<NonNullable<StatusItem['tone']>, string> = {
    ok: 'text-able-green',
    warn: 'text-amber-500',
    bad: 'text-destructive',
    muted: 'text-muted-foreground',
};

export function SettingsStatusBanner({
    title,
    items,
    className,
}: {
    title: string;
    items: StatusItem[];
    className?: string;
}) {
    return (
        <section
            aria-label={title}
            className={cn(
                'rounded-lg border border-border bg-muted/40 p-4',
                className,
            )}
        >
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                    <div key={item.label} className="space-y-0.5">
                        <dt className="text-xs text-muted-foreground">
                            {item.label}
                        </dt>
                        <dd
                            className={cn(
                                'text-sm font-medium',
                                toneStyles[item.tone ?? 'muted'],
                            )}
                        >
                            {item.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
