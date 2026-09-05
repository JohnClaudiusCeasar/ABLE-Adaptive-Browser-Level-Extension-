import { router } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import { login, logout } from '@/routes';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    return (
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-[rgba(34,197,94,0.3)] bg-white/80 px-6 shadow-[0_4px_12px_-2px_rgba(34,197,94,0.15)] backdrop-blur-[10px] transition-[width,height] ease-linear md:px-4 dark:border-[rgba(34,197,94,0.7)] dark:bg-[#1e4b3e] dark:shadow-[0_8px_20px_-5px_rgba(34,197,94,0.4)]">
            <h2
                className="text-lg font-semibold text-foreground"
                style={{ fontFamily: "'Unbounded', sans-serif" }}
            >
                {breadcrumbs.length > 0
                    ? breadcrumbs[breadcrumbs.length - 1].title
                    : 'Dashboard'}
            </h2>

            <button
                onClick={() =>
                    router.post(
                        logout(),
                        {},
                        { onFinish: () => router.visit(login()) },
                    )
                }
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/10 hover:text-red-400"
                aria-label="Logout"
            >
                <LogOut size={18} />
                <span>Logout</span>
            </button>
        </header>
    );
}
