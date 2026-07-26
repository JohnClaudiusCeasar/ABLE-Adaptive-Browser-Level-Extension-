import { BarChart3, Bell, LayoutGrid, Search, Settings, Shield, ShieldCheck, TrendingUp, UserCircle } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
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
        title: 'Security Analytics',
        href: '/security-analytics',
        icon: TrendingUp,
    },
    {
        title: 'Risk Algorithm',
        href: '/risk-algorithm',
        icon: Shield,
    },
    {
        title: 'Policy Algorithm',
        href: '/policy-algorithm',
        icon: ShieldCheck,
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="none" variant="inset" className="border-r border-white/5" style={{ boxShadow: 'inset -8px 0 15px -5px rgba(0,0,0,0.5)' }}>
            <SidebarHeader className="pt-6 pb-4">
                {/* ABLE Brand - Read Only */}
                <div className="px-2 py-2">
                    <AppLogo />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-4 py-2 text-able-green">
                    <button className="transition-colors hover:text-white" aria-label="Profile">
                        <UserCircle size={20} />
                    </button>
                    <button className="transition-colors hover:text-white" aria-label="Settings">
                        <Settings size={20} />
                    </button>
                    <button className="transition-colors hover:text-white" aria-label="Notifications">
                        <Bell size={20} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="mx-auto w-4/5">
                    <div className="flex items-center rounded-full bg-black/20 border border-white/10 px-3.5 py-2">
                        <Search size={14} className="text-muted-foreground" />
                        <input
                            type="text"
                            placeholder=""
                            className="ml-2.5 w-full bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                </div>

                {/* Divider */}
                <div className="mx-auto w-4/5 border-t border-white/10 my-2" />
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>
        </Sidebar>
    );
}
