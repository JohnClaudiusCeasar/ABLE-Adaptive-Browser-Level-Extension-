import { router } from '@inertiajs/react';
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
            : [
                  {
                      title: item.title,
                      href: item.href,
                      icon: item.icon,
                      parentTitle,
                  },
              ];

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

    // Keyboard shortcut to focus search (Cmd+K / Ctrl+K)
    useEffect(() => {
        function handleGlobalKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                setOpen(true);
            }
        }

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

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
        <div className="relative w-full px-3">
            <div
                className={cn(
                    'flex items-center rounded-xl border border-black/10 bg-black/5 px-3 py-2 transition-all duration-200 dark:border-white/10 dark:bg-black/20',
                    open && hasQuery && 'border-able-green/50 shadow-[0_0_12px_rgba(34,197,94,0.2)] dark:border-able-green/50',
                )}
            >
                <Search size={14} className="shrink-0 text-muted-foreground transition-colors" />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search navigation..."
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
                    className="ml-2 w-full border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70"
                />
                {hasQuery ? (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('');
                            setOpen(false);
                            inputRef.current?.focus();
                        }}
                        className="rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
                    >
                        <X size={13} />
                    </button>
                ) : (
                    <kbd className="hidden shrink-0 rounded border border-black/10 bg-black/5 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground/60 sm:inline-block dark:border-white/10 dark:bg-white/5">
                        ⌘K
                    </kbd>
                )}
            </div>

            {open && hasQuery && (
                <div className="absolute top-full right-3 left-3 z-50 mt-1.5 overflow-hidden rounded-xl border border-[rgba(34,197,94,0.4)] bg-[#0f2e24]/95 shadow-xl backdrop-blur-xl">
                    {results.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-muted-foreground">
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
                                        onMouseEnter={() =>
                                            setHighlightedIndex(i)
                                        }
                                        className={cn(
                                            'flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-left text-xs transition-colors',
                                            i === highlightedIndex
                                                ? 'bg-white/10 text-foreground'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {item.icon && (
                                            <item.icon
                                                size={15}
                                                className="shrink-0 text-able-green"
                                            />
                                        )}
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate font-medium">
                                                {item.title}
                                            </span>
                                            <span className="truncate text-[10px] text-muted-foreground/70">
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
