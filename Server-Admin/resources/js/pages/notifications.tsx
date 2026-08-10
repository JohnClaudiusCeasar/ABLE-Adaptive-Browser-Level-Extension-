import { Head, router, usePage } from '@inertiajs/react';
import { CheckCheck, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface NotificationItem {
    id: number;
    source: 'egress' | 'nudge' | 'login';
    type: string;
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

export default function Notifications() {
    const { notifications, unreadCount } = usePage<PageProps>().props;

    const [searchQuery, setSearchQuery] = useState('');

    const filteredNotifications = useMemo(() => {
        if (!searchQuery) {
            return notifications;
        }

        const q = searchQuery.toLowerCase();

        return notifications.filter(
            (n) =>
                n.type.toLowerCase().includes(q) ||
                (n.domain ?? '').toLowerCase().includes(q) ||
                (n.user ?? '').toLowerCase().includes(q) ||
                (n.email ?? '').toLowerCase().includes(q),
        );
    }, [notifications, searchQuery]);

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
                        Real-time alerts for egress events, nudge outcomes, and login activity detected by ABLE.
                    </p>

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
                            {searchQuery
                                ? 'No notifications match your search.'
                                : 'No notifications yet.'}
                        </div>
                    ) : (
                        filteredNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`flex gap-4 px-6 py-5 border-b border-[rgba(34,197,94,0.3)] last:border-b-0 transition-colors ${
                                    notification.unread
                                        ? 'bg-[rgba(34,197,94,0.03)]'
                                        : 'hover:bg-white/5'
                                }`}
                            >
                                {/* Indicator */}
                                <div
                                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-2 ${
                                        notification.unread
                                            ? 'bg-able-green shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                                            : 'bg-muted-foreground/40'
                                    }`}
                                />

                                {/* Content */}
                                <div className="flex-1 flex flex-col gap-2 min-w-0">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-base font-semibold text-foreground truncate">
                                            {notification.type}
                                        </span>
                                        <span className="text-sm text-muted-foreground shrink-0">
                                            {notification.timestamp}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 flex-wrap">
                                        <Badge variant={notification.status}>
                                            {notification.status.replace('glass-', '').toUpperCase()}
                                        </Badge>
                                        {notification.domain && (
                                            <span className="text-sm text-muted-foreground font-mono">
                                                {notification.domain}
                                            </span>
                                        )}
                                        {notification.riskScore && (
                                            <span className="text-sm text-muted-foreground">
                                                Risk Score: {notification.riskScore}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm text-muted-foreground font-mono truncate">
                                            {notification.email ?? notification.user ?? notification.ip ?? ''}
                                        </span>
                                        <span className="text-sm text-muted-foreground shrink-0">
                                            {notification.date} {notification.time}
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
                        ))
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
