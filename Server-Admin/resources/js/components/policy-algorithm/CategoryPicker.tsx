import { useEffect, useRef, useState } from 'react';
import type { CategoryOption } from './types';

export function CategoryPicker({
    value,
    onChange,
    categories,
}: {
    value: string;
    onChange: (category: string) => void;
    categories: CategoryOption[];
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value);
    const [prevValue, setPrevValue] = useState(value);
    const rootRef = useRef<HTMLDivElement>(null);

    if (prevValue !== value) {
        setPrevValue(value);
        setDraft(value);
    }

    useEffect(() => {
        if (!open) {
            return;
        }

        function handleClickOutside(e: MouseEvent) {
            if (
                rootRef.current &&
                !rootRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [open]);

    function commitTyped() {
        const trimmed = draft.trim();

        if (trimmed && trimmed !== value) {
            onChange(trimmed);
        } else {
            setDraft(value);
        }
    }

    const query = draft.trim().toLowerCase();
    const filtered = query
        ? categories.filter((c) => c.name.toLowerCase().includes(query))
        : categories;
    const showCustom =
        query !== '' && !categories.some((c) => c.name.toLowerCase() === query);

    return (
        <div ref={rootRef} className="relative w-full">
            <div className="flex w-full items-center rounded-lg border border-black/10 bg-transparent transition-colors focus-within:border-able-green dark:border-white/10">
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitTyped}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commitTyped();
                            setOpen(false);
                        }
                    }}
                    placeholder="Type or pick a category…"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label="Open category list"
                    className="shrink-0 px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                    ▾
                </button>
            </div>
            {open && (
                <ul
                    role="listbox"
                    className="absolute z-10 mt-1 max-h-40 w-[480px] max-w-full overflow-y-auto rounded-lg border border-black/10 bg-[#1a2f2b] py-1 shadow-xl dark:border-white/10"
                >
                    {filtered.map((c) => (
                        <li key={c.name} title={c.detail}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={c.name === value}
                                title={c.detail}
                                onClick={() => {
                                    onChange(c.name);
                                    setDraft(c.name);
                                    setOpen(false);
                                }}
                                className={`block w-full px-3 py-1 text-left text-[0.8rem] transition-colors ${
                                    c.name === value
                                        ? 'bg-[rgba(34,197,94,0.35)] text-white'
                                        : 'text-slate-100 hover:bg-[rgba(34,197,94,0.15)]'
                                }`}
                            >
                                {c.name}
                            </button>
                        </li>
                    ))}
                    {showCustom && (
                        <li>
                            <button
                                type="button"
                                onClick={() => {
                                    commitTyped();
                                    setOpen(false);
                                }}
                                className="block w-full px-3 py-1 text-left text-[0.8rem] text-slate-100 hover:bg-[rgba(34,197,94,0.15)]"
                            >
                                Use “{draft.trim()}”
                            </button>
                        </li>
                    )}
                    {filtered.length === 0 && !showCustom && (
                        <li className="px-3 py-1 text-[0.8rem] text-slate-400">
                            No matches — press Enter to use your text.
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
