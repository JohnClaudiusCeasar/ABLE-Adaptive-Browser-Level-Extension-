import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

export function toISODate(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseISODate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
        return null;
    }

    return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
    );
}

function formatDisplayDate(value: string): string {
    const date = parseISODate(value);

    if (!date) {
        return value;
    }

    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

interface DatePickerProps {
    value: string;
    onChange: (value: string) => void;
    min?: string;
    max?: string;
    ariaLabel?: string;
}

export function DatePicker({
    value,
    onChange,
    min,
    max,
    ariaLabel,
}: DatePickerProps) {
    const [open, setOpen] = useState(false);
    const [viewDate, setViewDate] = useState(
        () => parseISODate(value) ?? new Date(),
    );
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const selected = parseISODate(value);

        if (selected) {
            setViewDate(selected);
        }

        function handlePointerDown(event: MouseEvent) {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, value]);

    const cells = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const leadingBlanks = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const dates: (Date | null)[] = Array.from(
            { length: leadingBlanks },
            () => null,
        );

        for (let day = 1; day <= daysInMonth; day++) {
            dates.push(new Date(year, month, day));
        }

        return dates;
    }, [viewDate]);

    const monthLabel = viewDate.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });

    const minDate = min ? parseISODate(min) : null;
    const maxDate = max ? parseISODate(max) : null;
    const viewMonthStart = new Date(
        viewDate.getFullYear(),
        viewDate.getMonth(),
        1,
    );
    const minMonthStart = minDate
        ? new Date(minDate.getFullYear(), minDate.getMonth(), 1)
        : null;
    const maxMonthStart = maxDate
        ? new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)
        : null;
    const canGoPrev = !minMonthStart || viewMonthStart > minMonthStart;
    const canGoNext = !maxMonthStart || viewMonthStart < maxMonthStart;

    function changeMonth(offset: number) {
        setViewDate(
            (current) =>
                new Date(current.getFullYear(), current.getMonth() + offset, 1),
        );
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                className="w-full rounded-full border border-black/10 bg-black/5 px-3.5 py-2 text-left text-[0.85rem] tabular-nums outline-none transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-white/5"
            >
                {formatDisplayDate(value)}
            </button>

            {open && (
                <div className="absolute top-full left-0 z-50 mt-2 w-64 rounded-xl border border-[rgba(34,197,94,0.4)] bg-background/95 p-3 shadow-xl backdrop-blur-xl">
                    <div className="mb-2 flex items-center justify-between">
                        <button
                            type="button"
                            aria-label="Previous month"
                            disabled={!canGoPrev}
                            onClick={() => changeMonth(-1)}
                            className={cn(
                                'rounded p-1 transition-colors',
                                canGoPrev
                                    ? 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10'
                                    : 'cursor-not-allowed text-muted-foreground opacity-30',
                            )}
                        >
                            <ChevronLeft size={15} />
                        </button>
                        <span className="text-xs font-semibold">
                            {monthLabel}
                        </span>
                        <button
                            type="button"
                            aria-label="Next month"
                            disabled={!canGoNext}
                            onClick={() => changeMonth(1)}
                            className={cn(
                                'rounded p-1 transition-colors',
                                canGoNext
                                    ? 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10'
                                    : 'cursor-not-allowed text-muted-foreground opacity-30',
                            )}
                        >
                            <ChevronRight size={15} />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
                        {WEEKDAYS.map((weekday) => (
                            <span key={weekday} className="py-1">
                                {weekday}
                            </span>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {cells.map((date, index) => {
                            if (!date) {
                                return <span key={`blank-${index}`} />;
                            }

                            const iso = toISODate(date);
                            const disabled =
                                (min !== undefined && iso < min) ||
                                (max !== undefined && iso > max);
                            const selected = iso === value;

                            return (
                                <button
                                    key={iso}
                                    type="button"
                                    disabled={disabled}
                                    aria-pressed={selected}
                                    onClick={() => {
                                        onChange(iso);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        'rounded-lg py-1.5 text-xs tabular-nums transition-colors',
                                        disabled
                                            ? 'cursor-not-allowed text-muted-foreground opacity-30'
                                            : 'text-foreground hover:bg-[rgba(34,197,94,0.15)]',
                                        selected &&
                                            !disabled &&
                                            'bg-able-green/20 font-semibold text-able-green',
                                    )}
                                >
                                    {date.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
