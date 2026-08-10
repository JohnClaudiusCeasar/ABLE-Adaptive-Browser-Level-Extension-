import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl, type IsCurrentUrlFn } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';
import { cn } from '@/lib/utils';

const activeCardStyle =
    'bg-white/5 border border-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.6)] text-foreground';
const inactiveCardStyle =
    'bg-transparent border-none shadow-none text-muted-foreground hover:text-foreground';

function NavItemContent({ item }: { item: NavItem }) {
    return (
        <>
            {item.icon && <item.icon size={18} className="shrink-0" />}
            <span className="flex-1 truncate text-sm font-medium text-left">{item.title}</span>
            <span
                className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    item.isActive ? 'bg-able-green' : 'bg-[#1e3a5f]',
                )}
            />
        </>
    );
}

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarMenu className="flex flex-col gap-2">
                {items.map((item) => {
                    const active = isCurrentUrl(item.href);
                    const hasChildren = !!item.items?.length;

                    // Section divider: parents flagged isSection render as a
                    // static "MENU —————" header instead of a collapsible button.
                    if (item.isSection && hasChildren) {
                        return (
                            <li key={item.title} className="list-none w-full">
                                <div className="flex items-center gap-3 pt-4 pb-2">
                                    <span
                                        className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80"
                                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                                    >
                                        {item.title}
                                    </span>
                                    <span className="flex-1 h-px bg-[rgba(34,197,94,0.35)]" />
                                </div>
                                {renderChildren(item, isCurrentUrl)}
                            </li>
                        );
                    }

                    if (!hasChildren) {
                        return (
                            <SidebarMenuItem key={item.title} className="w-full">
                                <SidebarMenuButton
                                    asChild
                                    isActive={active}
                                    tooltip={{ children: item.title }}
                                    className={cn(
                                        'h-auto py-2.5 px-3 gap-2.5 rounded-xl transition-all',
                                        active ? activeCardStyle : inactiveCardStyle,
                                    )}
                                >
                                    <Link href={item.href} prefetch>
                                        <NavItemContent item={item} />
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    }

                    return null;
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}

function renderChildren(item: NavItem, isCurrentUrl: IsCurrentUrlFn) {
    return (
        <SidebarMenuSub className="gap-1.5 mx-0 border-l-0 pl-0">
            {item.items!.map((child) => {
                const childActive = isCurrentUrl(child.href);

                return (
                    <SidebarMenuSubItem key={child.title}>
                        <SidebarMenuSubButton
                            asChild
                            isActive={childActive}
                            size="md"
                            className={cn(
                                'h-auto py-2 px-3 gap-2.5 rounded-xl transition-all',
                                childActive
                                    ? activeCardStyle
                                    : inactiveCardStyle,
                            )}
                        >
                            <Link href={child.href} prefetch>
                                <NavItemContent item={{ ...child, isActive: childActive }} />
                            </Link>
                        </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                );
            })}
        </SidebarMenuSub>
    );
}
