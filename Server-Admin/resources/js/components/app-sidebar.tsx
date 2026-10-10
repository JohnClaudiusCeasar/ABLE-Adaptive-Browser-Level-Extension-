import { router, usePage } from '@inertiajs/react';
import {
    BarChart3,
    Bell,
    CheckCircle2,
    FileCode2,
    Ghost,
    Laptop,
    LayoutGrid,
    Menu,
    MessageSquareText,
    MousePointerClick,
    Shield,
    ShieldAlert,
    ShieldCheck,
    TrendingUp,
    UserCircle,
    Users,
    UsersRound,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { SidebarSearch } from '@/components/sidebar-search';
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
} from '@/components/ui/sidebar';
import { dashboard, notifications } from '@/routes';
import type { NavItem } from '@/types';

export const mainNavItems: NavItem[] = [
    {
        title: 'Menu',
        href: '/',
        icon: Menu,
        isSection: true,
        items: [
            {
                title: 'Dashboard',
                href: dashboard(),
                icon: LayoutGrid,
            },
            {
                title: 'Shadow Analytics',
                href: '/security-analytics',
                icon: TrendingUp,
                items: [
                    {
                        title: 'Shadow Overview',
                        href: '/security-analytics',
                        icon: LayoutGrid,
                    },
                    {
                        title: 'Shadow Catalog',
                        href: '/security-analytics/shadow-apps',
                        icon: Ghost,
                    },
                    {
                        title: 'Shadow Visits',
                        href: '/domain-visits',
                        icon: MousePointerClick,
                    },
                    {
                        title: 'Shadow Incidents',
                        href: '/security-analytics/egress-incidents',
                        icon: ShieldAlert,
                    },
                    {
                        title: 'Shadow Containment',
                        href: '/security-analytics/nudge-effectiveness',
                        icon: CheckCircle2,
                    },
                ],
            },
            {
                title: 'Policy Administration',
                href: '/risk-algorithm/criteria',
                icon: Shield,
                items: [
                    {
                        title: 'Risk Policy',
                        href: '/risk-algorithm/criteria',
                        icon: ShieldAlert,
                    },
                    {
                        title: 'All Patterns',
                        href: '/risk-algorithm/single',
                        icon: FileCode2,
                    },
                    {
                        title: 'Domain Policy',
                        href: '/policy-algorithm',
                        icon: ShieldCheck,
                    },
                ],
            },
            {
                title: 'Users',
                href: '/users/client',
                icon: Users,
                items: [
                    {
                        title: 'Client',
                        href: '/users/client',
                        icon: Laptop,
                    },
                    {
                        title: 'Team',
                        href: '/users/team',
                        icon: UsersRound,
                    },
                ],
            },
            {
                title: 'Chat',
                href: '/chat',
                icon: MessageSquareText,
            },
        ],
    },
];

export function AppSidebar() {
    const { unreadNotificationsCount = 0 } = usePage<{
        unreadNotificationsCount?: number;
    }>().props;

    return (
        <Sidebar
            collapsible="none"
            variant="inset"
            className="border-r border-black/10 dark:border-white/5"
        >
            <SidebarHeader className="pt-6 pb-4">
                {/* ABLE Brand - Read Only */}
                <div className="px-2 py-2">
                    <AppLogo />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-4 py-2 text-able-green">
                    <button
                        className="transition-colors hover:text-able-green-muted dark:hover:text-white"
                        aria-label="Profile"
                        onClick={() => router.visit('/settings/profile')}
                    >
                        <UserCircle size={20} />
                    </button>
                    <button
                        className="transition-colors hover:text-able-green-muted dark:hover:text-white"
                        aria-label="Security"
                        onClick={() => router.visit('/security')}
                    >
                        <Shield size={20} />
                    </button>
                    <button
                        className="relative transition-colors hover:text-able-green-muted dark:hover:text-white"
                        aria-label="Notifications"
                        onClick={() => router.visit(notifications())}
                    >
                        <Bell size={20} />
                        {unreadNotificationsCount > 0 && (
                            <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
                                {unreadNotificationsCount > 99
                                    ? '99+'
                                    : unreadNotificationsCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Search Bar */}
                <SidebarSearch items={mainNavItems} />

                {/* Divider */}
                <div className="mx-auto my-2 w-4/5 border-t border-black/10 dark:border-white/10" />
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>
        </Sidebar>
    );
}
