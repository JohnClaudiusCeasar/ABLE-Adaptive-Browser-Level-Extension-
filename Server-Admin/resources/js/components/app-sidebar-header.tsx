import { Fragment } from 'react';
import { Link, router } from '@inertiajs/react';
import { ChevronRight, LogOut } from 'lucide-react';
import { getBreadcrumbsWithIcons } from '@/lib/breadcrumb-utils';
import type { BreadcrumbItem } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItem[];
}) {
    const breadcrumbsWithIcons = getBreadcrumbsWithIcons(breadcrumbs);

    return (
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-[rgba(34,197,94,0.3)] bg-white/80 px-6 shadow-[0_4px_12px_-2px_rgba(34,197,94,0.15)] backdrop-blur-[10px] transition-[width,height] ease-linear md:px-4 dark:border-[rgba(34,197,94,0.7)] dark:bg-[#1e4b3e] dark:shadow-[0_8px_20px_-5px_rgba(34,197,94,0.4)]">
            {/* Breadcrumb with Icons */}
            <nav className="flex items-center gap-1.5">
                {breadcrumbsWithIcons.length > 0 ? (
                    breadcrumbsWithIcons.map((item, index) => {
                        const isLast = index === breadcrumbsWithIcons.length - 1;
                        const href = typeof item.href === 'string' ? item.href : item.href.url;

                        return (
                            <Fragment key={index}>
                                {index > 0 && (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                                )}
                                <Link
                                    href={href}
                                    className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors ${
                                        isLast
                                            ? 'font-semibold text-foreground'
                                            : 'font-medium text-muted-foreground hover:text-foreground hover:bg-able-green/10'
                                    }`}
                                    style={{ fontFamily: "'Unbounded', sans-serif" }}
                                >
                                    {item.icon && (
                                        <item.icon className="h-4 w-4 shrink-0" />
                                    )}
                                    <span className="truncate">{item.title}</span>
                                </Link>
                            </Fragment>
                        );
                    })
                ) : (
                    <h2
                        className="text-lg font-semibold text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Dashboard
                    </h2>
                )}
            </nav>

            {/* Logout Button */}
            <button
                onClick={() =>
                    router.post(
                        '/logout',
                        {},
                        { onFinish: () => router.visit('/login') },
                    )
                }
                className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 active:scale-95"
                aria-label="Logout"
            >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logout</span>
            </button>
        </header>
    );
}
