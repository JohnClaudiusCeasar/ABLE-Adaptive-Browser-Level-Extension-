import { Head } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';

const notifications = [
    {
        id: 1,
        type: 'Egress Event Detected',
        status: 'glass-unsafe' as const,
        domain: 'chatgpt.com',
        userId: 'USER78291',
        riskScore: '82%',
        timestamp: '2 min ago',
        unread: true,
    },
    {
        id: 2,
        type: 'Egress Event Detected',
        status: 'glass-unsafe' as const,
        domain: 'deepseek.com',
        userId: 'USER81191',
        riskScore: '81%',
        timestamp: '7 min ago',
        unread: true,
    },
    {
        id: 3,
        type: 'Data Exfiltration Attempt',
        status: 'glass-unlisted' as const,
        domain: 'canva.pro',
        userId: 'USER90012',
        riskScore: '92%',
        timestamp: '15 min ago',
        unread: true,
    },
    {
        id: 4,
        type: 'Egress Event Detected',
        status: 'glass-unsafe' as const,
        domain: 'mega.nz',
        userId: 'USER45201',
        riskScore: '88%',
        timestamp: '32 min ago',
        unread: true,
    },
    {
        id: 5,
        type: 'Policy Violation Detected',
        status: 'glass-unsafe' as const,
        domain: 'pastebin.com',
        userId: 'USER67384',
        riskScore: '95%',
        timestamp: '1 hr ago',
        unread: true,
    },
];

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

export default function Notifications() {
    return (
        <>
            <Head title="Notifications" />
            <div className="mx-auto w-full max-w-[900px] px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header className="text-center mb-10">
                    <h1
                        className="text-3xl font-bold tracking-wider mb-3"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        NOTIFICATIONS
                    </h1>
                    <p className="text-sm text-muted-foreground max-w-[600px] mx-auto leading-relaxed">
                        Real-time alerts for egress events and security violations detected by ABLE.
                    </p>
                </header>

                {/* Notifications List */}
                <div className={`${glassCard} overflow-hidden`}>
                    {notifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`flex gap-4 px-6 py-5 border-b border-white/5 last:border-b-0 transition-colors cursor-pointer ${
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
                            <div className="flex-1 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-base font-semibold text-foreground">
                                        {notification.type}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {notification.timestamp}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Badge variant={notification.status}>
                                        {notification.status.replace('glass-', '').toUpperCase()}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground font-mono">
                                        {notification.domain}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground font-mono">
                                        {notification.userId}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        Risk Score: {notification.riskScore}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
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
