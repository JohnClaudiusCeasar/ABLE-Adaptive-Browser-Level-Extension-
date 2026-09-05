import { Input } from '@/components/ui/input';

export function TextField({
    name,
    defaultValue,
    placeholder,
    disabled,
}: {
    name: string;
    defaultValue?: string;
    placeholder?: string;
    disabled?: boolean;
}) {
    return (
        <Input
            id={name}
            name={name}
            defaultValue={defaultValue}
            placeholder={placeholder}
            disabled={disabled}
            className="mt-1 block w-full"
        />
    );
}
