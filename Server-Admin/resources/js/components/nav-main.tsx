import { Link } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { IsCurrentUrlFn } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types';

const activeCardStyle =
    'bg-white/5 border border-able-green/60 shadow-[0_0_15px_rgba(34,197,94,0.6)] text-foreground';
const inactiveCardStyle =
    'bg-transparent border-none shadow-none text-muted-foreground hover:text-foreground active:border active:border-able-green/60 active:shadow-[0_0_15px_rgba(34,197,94,0.6)] active:bg-white/5';

function NavItemContent({ item }: { item: NavItem }) {
    return (
        <>
            {item.icon && <item.icon size={18} className="shrink-0" />}
            <span className="flex-1 truncate text-left text-sm font-medium">
                {item.title}
            </span>
            <span
                className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    item.isActive ? 'bg-able-green shadow-[0_0_6px_rgba(34,197,94,0.8)]' : 'bg-muted-foreground/30',
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
    // href may be a wayfinder UrlMethodPair, so normalize to the URL string.
    const href = typeof item.href === 'string' ? item.href : item.href.url;
    const groupRoot = href.split('/').slice(0, 2).join('/');
    const hasActiveChild = item.items?.some((child) => {
        const childHref = typeof child.href === 'string' ? child.href : child.href.url;
        return isCurrentUrl(childHref);
    });
    const groupActive = isCurrentUrl(groupRoot, undefined, true) || !!hasActiveChild;

    const [open, setOpen] = useState(groupActive);
    const [syncedGroupActive, setSyncedGroupActive] = useState(groupActive);

    // Keep the collapsible open state in sync with the active group without
    // triggering a cascading render. When the group becomes active (or
    // inactive) the state is reset during the same render by keying off the
    // previous value instead of calling setState inside an effect.
    if (syncedGroupActive !== groupActive) {
        setSyncedGroupActive(groupActive);
        setOpen(groupActive);
    }

    function handleOpenChange(next: boolean) {
        setOpen(next);
    }

    return (
        <SidebarMenuItem className="w-full">
            <Collapsible open={open} onOpenChange={handleOpenChange}>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        className={cn(
                            'h-auto gap-2.5 rounded-xl px-3 py-2.5 transition-all',
                            groupActive ? activeCardStyle : inactiveCardStyle,
                        )}
                    >
                        {item.icon && (
                            <item.icon size={18} className="shrink-0" />
                        )}
                        <span className="flex-1 truncate text-left text-sm font-medium">
                            {item.title}
                        </span>
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
                    <SidebarMenuSub className="mx-0 gap-1.5 border-l-0 pl-3">
                        {item.items!.map((child) => {
                            const childActive = isCurrentUrl(child.href);

                            return (
                                <SidebarMenuSubItem key={child.title}>
                                    <SidebarMenuSubButton
                                        asChild
                                        isActive={childActive}
                                        size="md"
                                        className={cn(
                                            'h-auto gap-2.5 rounded-xl px-3 py-2 transition-all',
                                            childActive
                                                ? activeCardStyle
                                                : inactiveCardStyle,
                                        )}
                                    >
                                        <Link href={child.href} prefetch>
                                            <NavItemContent
                                                item={{
                                                    ...child,
                                                    isActive: childActive,
                                                }}
                                            />
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
                            <li key={item.title} className="w-full list-none">
                                <div className="flex items-center gap-3 pt-4 pb-2">
                                    <span
                                        className="text-[0.7rem] font-semibold tracking-[0.18em] text-muted-foreground/80 uppercase"
                                        style={{
                                            fontFamily:
                                                "'Unbounded', sans-serif",
                                        }}
                                    >
                                        {item.title}
                                    </span>
                                    <span className="h-px flex-1 bg-[rgba(34,197,94,0.35)]" />
                                </div>
                                {renderChildren(item, isCurrentUrl)}
                            </li>
                        );
                    }

                    if (!hasChildren) {
                        return (
                            <SidebarMenuItem
                                key={item.title}
                                className="w-full"
                            >
                                <SidebarMenuButton
                                    asChild
                                    isActive={active}
                                    tooltip={{ children: item.title }}
                                    className={cn(
                                        'h-auto gap-2.5 rounded-xl px-3 py-2.5 transition-all',
                                        active
                                            ? activeCardStyle
                                            : inactiveCardStyle,
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
                            <CollapsibleNavItem
                                key={item.title}
                                item={item}
                                isCurrentUrl={isCurrentUrl}
                            />
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
        <SidebarMenuSub className="mx-0 gap-1.5 border-l-0 pl-0">
            {item.items!.map((child) => {
                const childActive = isCurrentUrl(child.href);

                // A child with its own children (e.g. Risk Policy) renders as
                // a nested collapsible instead of a flat link.
                if (child.items?.length) {
                    return (
                        <CollapsibleNavItem
                            key={child.title}
                            item={child}
                            isCurrentUrl={isCurrentUrl}
                        />
                    );
                }

                return (
                    <SidebarMenuSubItem key={child.title}>
                        <SidebarMenuSubButton
                            asChild
                            isActive={childActive}
                            size="md"
                            className={cn(
                                'h-auto gap-2.5 rounded-xl px-3 py-2 transition-all',
                                childActive
                                    ? activeCardStyle
                                    : inactiveCardStyle,
                            )}
                        >
                            <Link href={child.href} prefetch>
                                <NavItemContent
                                    item={{ ...child, isActive: childActive }}
                                />
                            </Link>
                        </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                );
            })}
        </SidebarMenuSub>
    );
}
