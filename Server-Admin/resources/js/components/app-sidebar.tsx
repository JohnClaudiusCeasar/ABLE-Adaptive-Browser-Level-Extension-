import { router } from '@inertiajs/react';
import {
    BarChart3,
    Bell,
    FileCode2,
    LayoutGrid,
    Menu,
    MessageSquareText,
    MousePointerClick,
    Shield,
    ShieldCheck,
    TrendingUp,
    UserCircle,
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

const mainNavItems: NavItem[] = [
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
                title: 'Egress Logs',
                href: '/egress-logs',
                icon: BarChart3,
            },
            {
                title: 'Domain Visits',
                href: '/domain-visits',
                icon: MousePointerClick,
            },
            {
                title: 'Security Analytics',
                href: '/security-analytics',
                icon: TrendingUp,
            },
            {
                title: 'Risk Algorithm',
                href: '/risk-algorithm/criteria',
                icon: Shield,
                items: [
                    {
                        title: 'Pattern Settings',
                        href: '/risk-algorithm/criteria',
                        icon: LayoutGrid,
                    },
                    {
                        title: 'All Patterns',
                        href: '/risk-algorithm/single',
                        icon: FileCode2,
                    },
                ],
            },
            {
                title: 'Policy Algorithm',
                href: '/policy-algorithm',
                icon: ShieldCheck,
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
                        className="transition-colors hover:text-able-green-muted dark:hover:text-white"
                        aria-label="Notifications"
                        onClick={() => router.visit(notifications())}
                    >
                        <Bell size={20} />
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
