import { Head, router, usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCheck, Database, Globe, MessageSquare, Plug, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface NotificationItem {
    id: number;
    source: 'egress' | 'domain' | 'audit' | 'extension' | 'chat';
    type: string;
    description: string | null;
    domain: string | null;
    user: string | null;
    email: string | null;
    ip: string | null;
    riskScore: string | null;
    status: 'glass-safe' | 'glass-unsafe' | 'glass-unlisted';
    timestamp: string;
    date: string;
    time: string;
    unread: boolean;
}

interface PageProps {
    notifications: NotificationItem[];
    unreadCount: number;
    [key: string]: unknown;
}

const sourceLabels: Record<NotificationItem['source'], string> = {
    egress: 'Egress',
    domain: 'Domain',
    audit: 'Audit',
    extension: 'Extension',
    chat: 'Chat',
};

const sourceIcons: Record<NotificationItem['source'], React.ElementType> = {
    egress: AlertTriangle,
    domain: Globe,
    audit: Database,
    extension: Plug,
    chat: MessageSquare,
};

const sourceColors: Record<NotificationItem['source'], string> = {
    egress: 'text-red-400',
    domain: 'text-purple-400',
    audit: 'text-amber-400',
    extension: 'text-blue-400',
    chat: 'text-green-400',
};

const sourceBorderColors: Record<NotificationItem['source'], string> = {
    egress: 'border-l-red-500/50',
    domain: 'border-l-purple-500/50',
    audit: 'border-l-amber-500/50',
    extension: 'border-l-blue-500/50',
    chat: 'border-l-green-500/50',
};

const sourceBadgeClasses: Record<NotificationItem['source'], string> = {
    egress: 'bg-[rgba(255,77,77,0.12)] text-[rgba(255,77,77,0.85)]',
    domain: 'bg-[rgba(204,102,255,0.12)] text-[rgba(204,102,255,0.85)]',
    audit: 'bg-[rgba(255,159,64,0.12)] text-[rgba(255,159,64,0.85)]',
    extension: 'bg-[rgba(59,130,246,0.12)] text-[rgba(59,130,246,0.85)]',
    chat: 'bg-[rgba(34,197,94,0.12)] text-[rgba(34,197,94,0.85)]',
};

const allSources: NotificationItem['source'][] = ['egress', 'domain', 'audit', 'extension', 'chat'];

export default function Notifications() {
    const { notifications, unreadCount } = usePage<PageProps>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [activeSources, setActiveSources] = useState<Set<NotificationItem['source']>>(new Set(allSources));

    const filteredNotifications = useMemo(() => {
        let result = notifications;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (n) =>
                    n.type.toLowerCase().includes(q) ||
                    (n.description ?? '').toLowerCase().includes(q) ||
                    (n.domain ?? '').toLowerCase().includes(q) ||
                    (n.user ?? '').toLowerCase().includes(q) ||
                    (n.email ?? '').toLowerCase().includes(q) ||
                    (n.ip ?? '').toLowerCase().includes(q),
            );
        }

        return result.filter((n) => activeSources.has(n.source));
    }, [notifications, searchQuery, activeSources]);

    function toggleSource(source: NotificationItem['source']) {
        setActiveSources((prev) => {
            const next = new Set(prev);
            if (next.has(source)) {
                next.delete(source);
            } else {
                next.add(source);
            }
            return next;
        });
    }

    function markAllRead() {
        router.post('/notifications/read-all', {}, { preserveScroll: true });
    }

    function clearAll() {
        if (window.confirm('Delete all notifications?')) {
            router.delete('/notifications-all', { preserveScroll: true });
        }
    }

    function markRead(id: number) {
        router.post(`/notifications/${id}/read`, {}, { preserveScroll: true });
    }

    function remove(id: number) {
        router.delete(`/notifications/${id}`, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Notifications" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">

                {/* Page Header */}
                <header className="mb-8">
                    <h1
                        className="text-[2.6rem] font-bold tracking-wide mb-2.5 uppercase text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        NOTIFICATIONS
                    </h1>
                    <p className="text-[1.05rem] text-muted-foreground mb-6">
                        Real-time alerts for egress events, domain visits, database edits, extension changes, and new chat messages.
                    </p>

                    {/* Source Filter Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-4">
                        {allSources.map((source) => {
                            const Icon = sourceIcons[source];
                            const isActive = activeSources.has(source);
                            return (
                                <button
                                    key={source}
                                    onClick={() => toggleSource(source)}
                                    className={`
                                        inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-medium
                                        transition-all duration-150
                                        ${isActive
                                            ? `${sourceBadgeClasses[source]} ring-1 ring-[rgba(34,197,94,0.3)] scale-105`
                                            : 'bg-white/3 text-muted-foreground hover:text-foreground hover:bg-white/5'}
                                    `}
                                >
                                    <Icon size={14} className={isActive ? sourceColors[source] : ''} />
                                    {sourceLabels[source]}
                                </button>
                            );
                        })}
                    </div>

                    {/* Toolbar: search + bulk actions */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative w-[260px]">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full py-2.5 pl-11 pr-3.5 bg-black/5 border border-black/10 rounded-full text-foreground text-[0.9rem] outline-none placeholder:text-muted-foreground dark:bg-[rgba(15,23,42,0.4)] dark:border-white/10"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={markAllRead}
                                className="gap-2 border-[rgba(34,197,94,0.7)] hover:bg-[rgba(34,197,94,0.1)]"
                            >
                                <CheckCheck size={16} />
                                Mark all read
                            </Button>
                            <Button
                                variant="outline"
                                onClick={clearAll}
                                className="gap-2 border-[rgba(34,197,94,0.7)] hover:bg-[rgba(34,197,94,0.1)] text-muted-foreground"
                            >
                                <Trash2 size={16} />
                                Clear all
                            </Button>
                        </div>

                        {unreadCount > 0 && (
                            <span className="text-sm text-muted-foreground ml-auto">
                                {unreadCount} unread
                            </span>
                        )}
                    </div>
                </header>

                {/* Notifications List */}
                <div className={`${glassCard} overflow-hidden`}>
                    {filteredNotifications.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground">
                            {searchQuery || activeSources.size < allSources.length
                                ? 'No notifications match your filters.'
                                : 'No notifications yet.'}
                        </div>
                    ) : (
                        filteredNotifications.map((notification) => {
                            const SourceIcon = sourceIcons[notification.source];
                            return (
                                <div
                                    key={notification.id}
                                    className={`
                                        relative flex gap-4 px-6 py-5 border-b border-[rgba(34,197,94,0.3)] last:border-b-0
                                        ${sourceBorderColors[notification.source]}
                                        transition-colors
                                        ${notification.unread
                                            ? 'bg-[rgba(34,197,94,0.03)]'
                                            : 'hover:bg-white/5'}
                                    `}
                                >
                                    {/* Icon + unread dot */}
                                    <div className="flex-shrink-0 mt-1 w-6 h-6 flex items-center justify-center rounded-md">
                                        <SourceIcon size={16} className={sourceColors[notification.source]} />
                                        {notification.unread && (
                                            <span className="absolute w-2 h-2 bg-able-green rounded-full shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                        {/* Title row */}
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 truncate">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[0.65rem] font-medium px-1.5 py-0.5 ${sourceBadgeClasses[notification.source]}`}
                                                >
                                                    {sourceLabels[notification.source]}
                                                </Badge>
                                                <span
                                                    className={`text-base text-foreground truncate ${
                                                        notification.unread ? 'font-bold' : 'font-medium'
                                                    }`}
                                                    title={notification.type}
                                                >
                                                    {notification.type}
                                                </span>
                                            </div>
                                            <span className="text-sm text-muted-foreground shrink-0">
                                                {notification.timestamp}
                                            </span>
                                        </div>

                                        {/* Description */}
                                        {notification.description && (
                                            <p
                                                className="text-sm text-muted-foreground truncate"
                                                title={notification.description}
                                            >
                                                {notification.description}
                                            </p>
                                        )}

                                        {/* Metadata row */}
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <Badge
                                                variant={notification.status}
                                                className="text-[0.7rem]"
                                            >
                                                {notification.status.replace('glass-', '').toUpperCase()}
                                            </Badge>
                                            {notification.domain && (
                                                <span
                                                    className="text-sm text-muted-foreground font-mono"
                                                    title={notification.domain}
                                                >
                                                    {notification.domain}
                                                </span>
                                            )}
                                            {notification.riskScore && (
                                                <span className="text-sm text-muted-foreground">
                                                    Risk Score: {notification.riskScore}
                                                </span>
                                            )}
                                            <span
                                                className="text-sm text-muted-foreground font-mono truncate"
                                                title={notification.email ?? notification.user ?? notification.ip ?? undefined}
                                            >
                                                {notification.email ?? notification.user ?? notification.ip ?? ''}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {notification.unread && (
                                            <button
                                                onClick={() => markRead(notification.id)}
                                                title="Mark as read"
                                                className="p-1.5 rounded-md text-muted-foreground hover:text-able-green hover:bg-white/5 transition-colors cursor-pointer"
                                            >
                                                <CheckCheck size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => remove(notification.id)}
                                            title="Delete"
                                            className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
}

Notifications.layout = {
    breadcrumbs: [
        {
            title: 'Notifications',
            href: '/notifications',
        },
    ],
};
