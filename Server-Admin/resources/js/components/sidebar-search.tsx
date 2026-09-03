import { router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types';

interface FlatNavItem {
    title: string;
    href: NavItem['href'];
    icon: NavItem['icon'];
    parentTitle: string;
}

function flattenItems(items: NavItem[], parentTitle = ''): FlatNavItem[] {
    return items.flatMap((item) => {
        const flat = item.items?.length
            ? flattenItems(item.items, item.title)
            : [{ title: item.title, href: item.href, icon: item.icon, parentTitle }];

        return flat;
    });
}

export function SidebarSearch({ items }: { items: NavItem[] }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const flatItems = useMemo(() => flattenItems(items), [items]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();

        if (!q) {
            return [];
        }

        return flatItems.filter(
            (item) =>
                item.title.toLowerCase().includes(q) ||
                item.parentTitle.toLowerCase().includes(q),
        );
    }, [flatItems, query]);

    function navigate(href: NavItem['href']) {
        router.visit(href);

        setQuery('');
        setOpen(false);
        setHighlightedIndex(0);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((i) => Math.min(results.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();

            if (results[highlightedIndex]) {
                navigate(results[highlightedIndex].href);
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
        }
    }

    const hasQuery = query.trim() !== '';

    return (
        <div className="relative mx-auto w-4/5">
            <div className="flex items-center rounded-full bg-black/5 border border-black/10 px-3.5 py-2 dark:bg-black/20 dark:border-white/10">
                <Search size={14} className="text-muted-foreground" />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search pages..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                        setHighlightedIndex(0);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => {
                        // Delay so clicks on results register before closing.
                        setTimeout(() => setOpen(false), 150);
                    }}
                    onKeyDown={handleKeyDown}
                    className="ml-2.5 w-full bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
                />
            </div>

            {open && hasQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl bg-[#0f2e24]/95 backdrop-blur-[10px] border border-[rgba(34,197,94,0.4)] shadow-lg overflow-hidden">
                    {results.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground">
                            No pages match your search.
                        </div>
                    ) : (
                        <ul className="max-h-64 overflow-y-auto py-1">
                            {results.map((item, i) => (
                                <li key={`${item.parentTitle}-${item.title}`}>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => navigate(item.href)}
                                        onMouseEnter={() => setHighlightedIndex(i)}
                                        className={cn(
                                            'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors cursor-pointer',
                                            i === highlightedIndex
                                                ? 'bg-white/10 text-foreground'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {item.icon && <item.icon size={16} className="shrink-0 text-able-green" />}
                                        <span className="flex flex-col min-w-0">
                                            <span className="truncate">{item.title}</span>
                                            <span className="text-xs text-muted-foreground/70 truncate">
                                                {item.parentTitle}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
