import { createInertiaApp } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { installBackNavigationGuard } from '@/lib/back-navigation-guard';

const appTitle = 'ABLE - Shadow IT Prevention and Egress Data Monitoring';

createInertiaApp({
    title: () => appTitle,
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#22c55e',
    },
});

// A page restored from the back-forward cache still shows its pre-navigation
// snapshot, so it is reloaded to let the server decide whether the visitor is
// still authenticated.
installBackNavigationGuard();

// This will set light / dark mode on load...
initializeTheme();
