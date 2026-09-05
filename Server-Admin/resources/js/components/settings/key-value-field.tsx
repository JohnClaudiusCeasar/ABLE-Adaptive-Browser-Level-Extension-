import { useState } from 'react';
import { formatKeyValue, parseKeyValue } from '@/lib/settings';

export function KeyValueField({
    name,
    defaultValue,
    placeholder,
}: {
    name: string;
    defaultValue?: Record<string, string[]>;
    placeholder?: string;
}) {
    const [value, setValue] = useState(formatKeyValue(defaultValue ?? {}));

    return (
        <>
            <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                    placeholder ?? 'hostname: base64-spki-pin, base64-spki-pin'
                }
                rows={4}
                className="mt-1 block w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <input
                type="hidden"
                name={name}
                value={JSON.stringify(parseKeyValue(value))}
            />
        </>
    );
}
