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
            type="number"
            defaultValue={defaultValue}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className="mt-1 block w-full"
        />
    );
}
