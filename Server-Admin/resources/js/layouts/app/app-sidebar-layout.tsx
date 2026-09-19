import { usePage } from '@inertiajs/react';
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

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="h-screen overflow-hidden">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                <div className="flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
                    {children}
                </div>
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
