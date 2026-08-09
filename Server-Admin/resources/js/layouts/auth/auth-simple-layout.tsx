import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div
            className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10"
            style={{ background: 'linear-gradient(135deg, #374151 0%, #1e4b3e 50%, #143e2e 100%)' }}
        >
            <div
                className="w-full max-w-md rounded-xl border border-[rgba(34,197,94,0.7)] bg-white/5 p-12 shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_60px_rgba(34,197,94,0.08)] backdrop-blur-xl"
                style={{ animation: 'authCardIn 0.5s ease forwards' }}
            >
                {/* Brand */}
                <div className="flex flex-col items-center mb-9">
                    <Link href={home()} className="flex flex-col items-center gap-1.5 mb-2.5">
                        <div className="mb-1 flex items-center justify-center">
                            <AppLogoIcon className="size-10 fill-current text-white" />
                        </div>
                    </Link>
                    <h1
                        className="text-[2.4rem] font-bold tracking-widest text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        ABL<span className="text-able-green">E</span>
                    </h1>
                    <p className="text-[0.9rem] text-muted-foreground mt-2">
                        Adaptive Browser-Level Extension
                    </p>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Title */}
                    <div className="space-y-2 text-center">
                        <h2 className="text-xl font-medium text-foreground">{title}</h2>
                        <p className="text-center text-sm text-muted-foreground">
                            {description}
                        </p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
