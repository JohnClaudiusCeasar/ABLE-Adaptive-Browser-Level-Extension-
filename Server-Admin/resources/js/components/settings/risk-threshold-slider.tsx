import { useState } from 'react';
import { Input } from '@/components/ui/input';

export function RiskThresholdSlider({
    name,
    defaultValue,
    disabled,
}: {
    name: string;
    defaultValue?: number;
    disabled?: boolean;
}) {
    const [value, setValue] = useState<number>(defaultValue ?? 85);

    const mood = value >= 85 ? 'Strict' : value >= 60 ? 'Balanced' : 'Lenient';

    return (
        <div className="mt-1 space-y-2">
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={value}
                    disabled={disabled}
                    onChange={(event) => setValue(Number(event.target.value))}
                    className="w-full accent-able-green"
                    aria-label={name}
                />
                <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={value}
                    disabled={disabled}
                    onChange={(event) => {
                        const next = Number(event.target.value);
                        setValue(
                            Number.isFinite(next)
                                ? Math.min(100, Math.max(0, next))
                                : 0,
                        );
                    }}
                    className="w-20"
                />
            </div>
            <p className="text-xs text-muted-foreground">
                {value} / 100 — {mood}
            </p>
            <input type="hidden" name={name} value={value} />
        </div>
    );
}
