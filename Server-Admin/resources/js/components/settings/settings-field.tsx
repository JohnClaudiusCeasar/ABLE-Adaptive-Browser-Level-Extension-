import type { PropsWithChildren } from 'react';
import InputError from '@/components/input-error';

export function SettingsField({
    label,
    description,
    error,
    children,
}: PropsWithChildren<{
    label: string;
    description?: string;
    error?: string;
}>) {
    return (
        <div className="grid gap-3">
            <label className="text-sm font-medium text-foreground">
                {label}
            </label>
            {description && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                    {description}
                </p>
            )}
            {children}
            {error && <InputError message={error} />}
        </div>
    );
}
