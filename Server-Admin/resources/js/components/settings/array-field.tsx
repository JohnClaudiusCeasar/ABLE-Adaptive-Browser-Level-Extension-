import { useState } from 'react';
import { formatStringArray, parseStringArray } from '@/lib/settings';

export function ArrayField({
    name,
    defaultValue,
    placeholder,
}: {
    name: string;
    defaultValue?: string[];
    placeholder?: string;
}) {
    const [value, setValue] = useState(formatStringArray(defaultValue ?? []));

    return (
        <>
            <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                rows={4}
                className="mt-1 block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <input
                type="hidden"
                name={name}
                value={JSON.stringify(parseStringArray(value))}
            />
        </>
    );
}
