import { useEffect, useMemo, useState } from 'react';
import ServerSettingsController from '@/actions/App/Http/Controllers/Settings/ServerSettingsController';
import RecordsPurgeDialog from '@/components/settings/records-purge-dialog';
import type { RecordCount } from '@/components/settings/records-purge-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const TELEMETRY_GROUP = 'telemetry';

type Mode = 'all' | 'range';

type PreviewState = {
    signature: string;
    counts: RecordCount[];
    total: number;
    error: string | null;
};

type Props = {
    counts: RecordCount[];
    onClose: () => void;
};

function isoDaysAgo(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    return date.toISOString().slice(0, 10);
}

export default function TelemetryPurgePanel({ counts, onClose }: Props) {
    const rows = useMemo(
        () => counts.filter((count) => count.group === TELEMETRY_GROUP),
        [counts],
    );

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [mode, setMode] = useState<Mode>('all');
    const [from, setFrom] = useState(() => isoDaysAgo(6));
    const [to, setTo] = useState(() => isoDaysAgo(0));
    const [previewState, setPreviewState] = useState<PreviewState | null>(null);
    const [revision, setRevision] = useState(0);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // A parent's rows cascade, so the child is included automatically just
    // like the server does it. Keeping the two in step is what makes the
    // preview and the confirmed count agree.
    const effective = useMemo(() => {
        const next = new Set(selected);

        rows.forEach((row) => {
            if (row.implied_by?.some((parent) => next.has(parent))) {
                next.add(row.key);
            }
        });

        return next;
    }, [rows, selected]);

    const allSelected =
        rows.length > 0 && rows.every((row) => effective.has(row.key));

    const allImpact = useMemo(
        () => rows.filter((row) => effective.has(row.key)),
        [rows, effective],
    );

    const allTotal = useMemo(
        () => allImpact.reduce((sum, row) => sum + row.count, 0),
        [allImpact],
    );

    const previewTargets = useMemo(
        () =>
            rows.filter((row) => effective.has(row.key)).map((row) => row.key),
        [rows, effective],
    );

    // The revision is part of the signature so a failed confirmation can
    // invalidate the cached preview and ask the server again.
    const previewSignature = useMemo(
        () => JSON.stringify({ from, to, targets: previewTargets, revision }),
        [from, to, previewTargets, revision],
    );

    const rangeReady = Boolean(from && to);
    const rangeActive = mode === 'range' && effective.size > 0 && rangeReady;

    const previewMatches = previewState?.signature === previewSignature;
    const previewing = rangeActive && !previewMatches;
    const previewError =
        previewMatches && previewState ? previewState.error : null;

    const impact =
        mode === 'all'
            ? allImpact
            : previewMatches && previewState
              ? previewState.counts
              : [];
    const impactTotal =
        mode === 'all'
            ? allTotal
            : previewMatches && previewState
              ? previewState.total
              : 0;

    useEffect(() => {
        if (!rangeActive) {
            return;
        }

        const controller = new AbortController();
        const signature = previewSignature;
        const targets = previewTargets;

        const timer = window.setTimeout(() => {
            const params = new URLSearchParams();

            targets.forEach((key) => params.append('targets[]', key));
            params.set('date_from', from);
            params.set('date_to', to);

            fetch(
                `${ServerSettingsController.previewRecords.url()}?${params.toString()}`,
                {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    signal: controller.signal,
                },
            )
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error('preview-failed');
                    }

                    return (await response.json()) as {
                        counts: RecordCount[];
                        total: number;
                    };
                })
                .then((payload) => {
                    setPreviewState({
                        signature,
                        counts: payload.counts,
                        total: payload.total,
                        error: null,
                    });
                })
                .catch(() => {
                    if (controller.signal.aborted) {
                        return;
                    }

                    setPreviewState({
                        signature,
                        counts: [],
                        total: 0,
                        error: 'Could not calculate the impact. Try again.',
                    });
                });
        }, 300);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [rangeActive, from, to, previewSignature, previewTargets]);

    function toggle(key: string) {
        setSelected((previous) => {
            const next = new Set(previous);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    }

    function toggleAll(checked: boolean) {
        setSelected(checked ? new Set(rows.map((row) => row.key)) : new Set());
    }

    function applyPreset(days: number) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - (days - 1));

        const format = (date: Date) => date.toISOString().slice(0, 10);

        setFrom(format(start));
        setTo(format(end));
    }

    const canDelete =
        effective.size > 0 &&
        impactTotal > 0 &&
        !previewing &&
        !previewError &&
        (mode === 'all' || rangeActive);

    const confirmData = {
        targets: previewTargets,
        ...(mode === 'range' ? { date_from: from, date_to: to } : {}),
    };

    return (
        <div
            className="space-y-5 rounded-xl border border-red-500/30 bg-red-500/[0.04] p-5"
            data-test="telemetry-purge-panel"
        >
            <header className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                    Delete telemetry
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    Choose the telemetry to remove, then delete all of it or
                    only the rows inside a date range. Accounts, settings,
                    policies and chat are kept.
                </p>
            </header>

            <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Telemetry tables
                    </span>
                    <button
                        type="button"
                        onClick={() => toggleAll(!allSelected)}
                        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                        {allSelected ? 'Clear selection' : 'Select all'}
                    </button>
                </div>

                <div className="grid gap-2">
                    {rows.map((row) => {
                        const implied =
                            row.implied_by?.some((parent) =>
                                selected.has(parent),
                            ) ?? false;
                        const checked = effective.has(row.key);

                        return (
                            <div
                                key={row.key}
                                className={cn(
                                    'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                                    checked
                                        ? 'border-red-500/40 bg-red-500/10'
                                        : 'border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]',
                                )}
                            >
                                <Checkbox
                                    id={`purge-${row.key}`}
                                    checked={checked}
                                    disabled={implied}
                                    onCheckedChange={() => toggle(row.key)}
                                    className="mt-0.5"
                                />
                                <label
                                    htmlFor={`purge-${row.key}`}
                                    className={cn(
                                        'flex-1 select-none',
                                        implied
                                            ? 'cursor-default'
                                            : 'cursor-pointer',
                                    )}
                                >
                                    <span className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-medium text-foreground">
                                            {row.label}
                                        </span>
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                            {row.count.toLocaleString()}
                                        </span>
                                    </span>
                                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                        {row.description}
                                    </span>
                                    <span className="mt-1 block text-[11px] text-muted-foreground/80">
                                        {implied
                                            ? 'Removed with egress events'
                                            : row.date_column
                                              ? `Dated by ${row.date_column}`
                                              : 'No event timestamp'}
                                    </span>
                                </label>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    {(
                        [
                            ['all', 'All dates'],
                            ['range', 'Date range'],
                        ] as const
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setMode(value)}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                                mode === value
                                    ? 'bg-red-500/15 text-red-600 dark:text-red-300'
                                    : 'bg-black/5 text-muted-foreground hover:bg-black/10 dark:bg-white/5',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {mode === 'range' && (
                    <div className="flex flex-wrap items-center gap-3">
                        <input
                            type="date"
                            value={from}
                            max={to || undefined}
                            onChange={(event) => setFrom(event.target.value)}
                            className="rounded-full border border-black/10 bg-black/5 px-3.5 py-2 text-[0.85rem] outline-none dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                        />
                        <span className="text-sm text-muted-foreground">
                            to
                        </span>
                        <input
                            type="date"
                            value={to}
                            min={from || undefined}
                            onChange={(event) => setTo(event.target.value)}
                            className="rounded-full border border-black/10 bg-black/5 px-3.5 py-2 text-[0.85rem] outline-none dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                        />
                        <div className="flex items-center gap-2">
                            {[7, 30, 90].map((days) => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => applyPreset(days)}
                                    className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-black/10 dark:bg-white/5"
                                >
                                    {days}d
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {mode === 'range' && !rangeReady && (
                    <p className="text-xs text-amber-500">
                        Choose both a start and an end date.
                    </p>
                )}
            </div>

            <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/60 p-4 dark:border-red-200/10 dark:bg-red-700/10">
                {mode === 'range' && !rangeActive ? (
                    <p className="text-sm text-muted-foreground">
                        {effective.size === 0
                            ? 'Select at least one table.'
                            : 'Choose both a start and an end date.'}
                    </p>
                ) : previewing ? (
                    <p className="text-sm text-muted-foreground">
                        Calculating the impact…
                    </p>
                ) : previewError ? (
                    <p className="text-sm text-red-600 dark:text-red-100">
                        {previewError}
                    </p>
                ) : (
                    <>
                        <p className="text-sm font-medium text-red-600 dark:text-red-100">
                            {impactTotal.toLocaleString()} record
                            {impactTotal === 1 ? '' : 's'} will be deleted
                        </p>
                        {impact.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                {effective.size === 0
                                    ? 'Select at least one table.'
                                    : 'No records match this scope.'}
                            </p>
                        ) : (
                            <ul className="max-h-48 space-y-1 overflow-y-auto">
                                {impact.map((item) => (
                                    <li
                                        key={item.key}
                                        className="flex items-center justify-between gap-4 text-xs"
                                    >
                                        <span className="text-muted-foreground">
                                            {item.label}
                                        </span>
                                        <span className="tabular-nums">
                                            {item.count.toLocaleString()}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
                Notification copies created from visits, egress events and
                extension events are removed only when{' '}
                <span className="font-medium text-foreground">
                    Notifications
                </span>{' '}
                is selected as well.
            </p>

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!canDelete}
                    data-test="start-telemetry-purge"
                >
                    Delete selected telemetry
                </Button>
                <Button type="button" variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
            </div>

            <RecordsPurgeDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Delete telemetry records"
                description={`This permanently deletes ${impactTotal.toLocaleString()} records and cannot be undone. Accounts, settings, policies and chat are kept.`}
                counts={impact}
                total={impactTotal}
                phrase={String(impactTotal)}
                confirmLabel="Delete selected telemetry"
                data={confirmData}
                onCompleted={onClose}
                onFailed={() => setRevision((value) => value + 1)}
            />
        </div>
    );
}
