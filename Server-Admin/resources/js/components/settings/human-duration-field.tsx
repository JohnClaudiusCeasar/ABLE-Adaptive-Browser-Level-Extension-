import { useState } from 'react';
import { Input } from '@/components/ui/input';

export function msToSeconds(ms: number): number {
    return Math.round(ms / 1000);
}

export function secondsToMs(seconds: number): number {
    return Math.round(seconds * 1000);
}

export function minutesToHours(minutes: number): number {
    return Math.round((minutes / 60) * 100) / 100;
}

export function hoursToMinutes(hours: number): number {
    return Math.round(hours * 60);
}

export function HumanDurationField({
    name,
    defaultMs,
    unit,
    min,
    max,
    disabled,
}: {
    name: string;
    defaultMs: number;
    unit: 'seconds' | 'minutes' | 'hours';
    min?: number;
    max?: number;
    disabled?: boolean;
}) {
    const toHuman = (ms: number) =>
        unit === 'seconds'
            ? msToSeconds(ms)
            : unit === 'minutes'
              ? Math.round(ms / 60000)
              : Math.round((ms / 3600000) * 100) / 100;
    const toMs = (human: number) =>
        unit === 'seconds'
            ? secondsToMs(human)
            : unit === 'minutes'
              ? Math.round(human * 60000)
              : Math.round(human * 3600000);

    const [human, setHuman] = useState<number>(toHuman(defaultMs ?? 0));

    return (
        <div className="mt-1 flex items-center gap-2">
            <Input
                type="text"
                inputMode="decimal"
                value={human}
                min={min}
                max={max}
                disabled={disabled}
                onChange={(event) => {
                    const next = Number(event.target.value);
                    const safe = Number.isFinite(next) ? next : 0;
                    setHuman(safe);
                }}
                className="block w-32"
                aria-label={`${name} in ${unit}`}
            />
            <span className="text-sm text-muted-foreground">{unit}</span>
            <input type="hidden" name={name} value={toMs(human)} />
        </div>
    );
}

export function HumanMinutesField({
    name,
    defaultMinutes,
    min,
    max,
    disabled,
}: {
    name: string;
    defaultMinutes: number;
    min?: number;
    max?: number;
    disabled?: boolean;
}) {
    return (
        <div className="mt-1 flex items-center gap-2">
            <Input
                id={name}
                name={name}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={defaultMinutes}
                min={min}
                max={max}
                disabled={disabled}
                className="block w-32"
            />
            <span className="text-sm text-muted-foreground">minutes</span>
        </div>
    );
}
