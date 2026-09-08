import { Input } from '@/components/ui/input';

export function NumberField({
    name,
    defaultValue,
    min,
    max,
    step,
    disabled,
}: {
    name: string;
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
}) {
    return (
        <Input
            id={name}
            name={name}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={defaultValue}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className="mt-1 block w-full"
        />
    );
}
