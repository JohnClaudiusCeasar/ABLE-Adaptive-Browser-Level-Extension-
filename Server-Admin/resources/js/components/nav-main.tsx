import { Link } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

function CollapsibleNavItem({
    item,
    isCurrentUrl,
}: {
    item: NavItem;
    isCurrentUrl: IsCurrentUrlFn;
}) {
    // Group root path (e.g. "/risk-algorithm/single" -> "/risk-algorithm")
    // keeps the group highlighted while any of its sub-pages is active.
    const groupRoot = item.href.split('/').slice(0, 2).join('/');
    const groupActive = isCurrentUrl(groupRoot, undefined, true);
    const [open, setOpen] = useState(() => groupActive);

    // Keep the group expanded while one of its children is active.
    useEffect(() => {
        if (groupActive) setOpen(true);
    }, [groupActive]);

    return (
        <SidebarMenuItem className="w-full">
            <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        className={cn(
                            'h-auto py-2.5 px-3 gap-2.5 rounded-xl transition-all',
                            groupActive ? activeCardStyle : inactiveCardStyle,
                        )}
                    >
                        {item.icon && <item.icon size={18} className="shrink-0" />}
                        <span className="flex-1 truncate text-sm font-medium text-left">{item.title}</span>
                        <ChevronDown
                            size={16}
                            className={cn(
                                'shrink-0 transition-transform',
                                open ? 'rotate-0' : '-rotate-90',
                            )}
                        />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub className="gap-1.5 mx-0 border-l-0 pl-3">
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
                </CollapsibleContent>
            </Collapsible>
        </SidebarMenuItem>
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

                    if (item.items) {
                        return (
                            <CollapsibleNavItem key={item.title} item={item} isCurrentUrl={isCurrentUrl} />
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

                // A child with its own children (e.g. Risk Algorithm) renders as
                // a nested collapsible instead of a flat link.
                if (child.items?.length) {
                    return <CollapsibleNavItem key={child.title} item={child} isCurrentUrl={isCurrentUrl} />;
                }

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
