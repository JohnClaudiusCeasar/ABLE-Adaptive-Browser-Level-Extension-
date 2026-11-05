import type { LucideIcon } from 'lucide-react';
import { mainNavItems } from '@/components/app-sidebar';
import type { BreadcrumbItem } from '@/types';

export interface BreadcrumbWithIcon extends BreadcrumbItem {
    icon?: LucideIcon;
}

/**
 * Build a map of title → icon from navigation items.
 * This allows breadcrumbs to find their icon by matching the title.
 */
function buildNavTitleMap(): Map<string, LucideIcon> {
    const map = new Map<string, LucideIcon>();

    function flatten(items: typeof mainNavItems) {
        for (const item of items) {
            if (item.title && item.icon) {
                // Don't overwrite — first occurrence (parent) takes precedence for same title
                if (!map.has(item.title)) {
                    map.set(item.title, item.icon);
                }
            }

            if (item.items) {
                flatten(item.items);
            }
        }
    }

    flatten(mainNavItems);

    return map;
}

const navTitleMap = buildNavTitleMap();

/**
 * Breadcrumb titles with no matching navigation title that should still
 * inherit the icon of the navigation item they belong to.
 */
const breadcrumbIconAliases: Record<string, string> = {
    'Community Feedback': 'Access and Feedback',
};

/**
 * Resolve icons for breadcrumb items by matching against the navigation structure.
 * Title matching takes precedence over href matching.
 */
export function getBreadcrumbsWithIcons(
    breadcrumbs: BreadcrumbItem[],
): BreadcrumbWithIcon[] {
    return breadcrumbs.map((crumb) => {
        // Match by title first — this ensures each breadcrumb gets its own icon
        const alias = breadcrumbIconAliases[crumb.title];
        const icon =
            navTitleMap.get(crumb.title) ??
            (alias ? navTitleMap.get(alias) : undefined);

        return { ...crumb, icon };
    });
}
