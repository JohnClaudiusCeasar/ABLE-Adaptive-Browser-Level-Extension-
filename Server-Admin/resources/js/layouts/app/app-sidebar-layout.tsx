import { QuickChat } from '@/components/chat/quick-chat';
import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="h-screen overflow-hidden">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    {children}
                </div>
                {/* Quick chat state lives in the chat store, so it survives
                    page navigation without being keyed by URL. */}
                <QuickChat />
            </AppContent>
        </AppShell>
    );
}
