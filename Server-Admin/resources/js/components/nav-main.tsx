import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';
import { cn } from '@/lib/utils';

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarMenu className="flex flex-col items-center gap-3">
                {items.map((item) => {
                    const active = isCurrentUrl(item.href);
                    return (
                        <SidebarMenuItem key={item.title} className="w-[60%]">
                            <SidebarMenuButton
                                asChild
                                isActive={active}
                                tooltip={{ children: item.title }}
                                className={cn(
                                    'flex-col h-auto py-3 gap-1.5 rounded-xl transition-all',
                                    active
                                        ? 'bg-white/5 border border-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.6)] text-foreground'
                                        : 'bg-transparent border-none shadow-none text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Link href={item.href} prefetch className="flex flex-col items-center gap-1.5">
                                    {item.icon && <item.icon size={24} />}
                                    <span className="text-xs font-medium">{item.title}</span>
                                    <span className={cn(
                                        'w-1.5 h-1.5 rounded-full mt-0.5',
                                        active ? 'bg-able-green' : 'bg-[#1e3a5f]',
                                    )} />
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
