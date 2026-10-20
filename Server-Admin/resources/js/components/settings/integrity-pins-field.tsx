import { cn } from '@/lib/utils';

/**
 * Read-only view of the published integrity pins.
 *
 * The list of pinned files comes from the server (AbleSettingsSchema), so the
 * panel can never disagree with what the publish command actually writes.
 *
 * These are not hand-edited: they are written by
 * `php artisan able:publish-integrity` and signed into the runtime payload,
 * so editing them here would only be overwritten on the next publish.
 */
export function IntegrityPinsField({
    pins,
    files,
}: {
    pins: Record<string, string>;
    files: Record<string, string>;
}) {
    return (
        <div className="mt-1 divide-y divide-border overflow-hidden rounded-md border border-border">
            {Object.entries(files).map(([key, file]) => {
                const hash = pins[key] ?? '';

                return (
                    <div
                        key={key}
                        className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <span className="font-mono text-xs text-muted-foreground">
                            {file}
                        </span>
                        <span
                            className={cn(
                                'font-mono text-xs break-all',
                                hash
                                    ? 'text-foreground'
                                    : 'italic text-muted-foreground',
                            )}
                        >
                            {hash || 'not published'}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
