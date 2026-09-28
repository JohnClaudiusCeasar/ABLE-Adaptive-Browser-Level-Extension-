import { Link, usePage } from '@inertiajs/react';
import { Printer } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import type { AppLayoutProps } from '@/types';

// The chat widget and its full dependency tree (Echo/Pusher, message input,
// bubbles) only load once the user actually opens the chat bubble.
const QuickChat = lazy(() =>
    import('@/components/chat/quick-chat').then((module) => ({
        default: module.QuickChat,
    })),
);

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { url } = usePage();
    const isChatPage = url === '/chat' || url.startsWith('/chat/');
    const isPreviewPage = url === '/reports/preview' || url.startsWith('/reports/preview') || url.startsWith('/dashboard/report-preview');

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="h-screen overflow-hidden">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                <div className="able-scrollbar flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
                    {children}
                </div>
                {!isPreviewPage && !isChatPage && (
                    <div data-print-trigger className="no-print fixed right-6 bottom-[92px] z-40">
                        <Link
                            href="/reports/preview"
                            aria-label="Print Report & Preview"
                            title="Print Report & Preview"
                            className="group relative flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/50 bg-[#0a1f33]/90 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)] backdrop-blur-xl transition-all duration-200 hover:scale-105 hover:border-blue-400 hover:bg-[#0d2a45] hover:text-blue-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.65)] active:scale-95"
                        >
                            <Printer size={22} className="transition-transform group-hover:rotate-6" />
                            {/* Ambient subtle blue pulse glow */}
                            <span className="absolute inset-0 -z-10 rounded-2xl bg-blue-500/20 blur-md transition-opacity group-hover:opacity-100" />
                        </Link>
                    </div>
                )}
                {!isChatPage && (
                    <Suspense fallback={null}>
                        {/* Quick chat state lives in the chat store, so it survives
                            page navigation without being keyed by URL. */}
                        <QuickChat />
                    </Suspense>
                )}
            </AppContent>
        </AppShell>
    );
}
