import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ChatAvatar } from '@/components/chat/avatar';
import type { ChatUser } from '@/types/chat';

export function UserList({
    users,
    onSelect,
    emptyMessage = 'No other registered users yet.',
}: {
    users: ChatUser[];
    onSelect: (user: ChatUser) => void;
    emptyMessage?: string;
}) {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();

        if (!q) {
            return users;
        }

        return users.filter(
            (user) =>
                user.name.toLowerCase().includes(q) ||
                user.email.toLowerCase().includes(q),
        );
    }, [users, query]);

    return (
        <div className="flex flex-col gap-2">
            <div className="relative">
                <Search
                    size={14}
                    className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search users..."
                    className="w-full rounded-lg border border-black/10 bg-black/5 py-2 pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-able-green dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                />
            </div>

            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {filtered.length === 0 && (
                    <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {query ? 'No users match your search.' : emptyMessage}
                    </li>
                )}
                {filtered.map((user) => (
                    <li key={user.id} className="list-none">
                        <button
                            type="button"
                            onClick={() => onSelect(user)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5"
                        >
                            <ChatAvatar user={user} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">
                                    {user.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {user.email}
                                </p>
                            </div>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
