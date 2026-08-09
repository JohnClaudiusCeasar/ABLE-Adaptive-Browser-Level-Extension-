import { Head } from '@inertiajs/react';
import { dashboard } from '@/routes';
import { Badge } from '@/components/ui/badge';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface RecentEgressEvent {
    date: string;
    time: string;
    domain: string;
    status: 'glass-safe' | 'glass-unsafe' | 'glass-unlisted';
    user: string | null;
    fileName: string | null;
    action: string;
}

interface RecentDomainVisit {
    date: string;
    time: string;
    url: string;
    domain: string;
    status: 'glass-safe' | 'glass-unsafe' | 'glass-unlisted';
    user: string | null;
    action: string;
}

interface DashboardProps {
    activeUsers: number;
    inactiveUsers: number;
    totalDomainVisits: number;
    totalEgressAttempts: number;
    dataSaved: string;
    dataLost: string;
    nudgeSuccessRate: number;
    domainUsage: {
        safe: number;
        unsafe: number;
        unlisted: number;
    };
    recentEgressEvents: RecentEgressEvent[];
    recentDomainVisits: RecentDomainVisit[];
}

export default function Dashboard({
    activeUsers,
    inactiveUsers,
    totalDomainVisits,
    totalEgressAttempts,
    dataSaved,
    dataLost,
    nudgeSuccessRate,
    domainUsage,
    recentEgressEvents,
    recentDomainVisits,
}: DashboardProps) {
    const totalDomains = domainUsage.safe + domainUsage.unsafe + domainUsage.unlisted;

    const nudgeGradient = `conic-gradient(#ff3b3b 0% ${nudgeSuccessRate}%, #22c55e ${nudgeSuccessRate}% 100%)`;

    const domainGradient = (() => {
        if (totalDomains === 0) return 'conic-gradient(#3f4a44 0% 100%)';

        const safe = (domainUsage.safe / totalDomains) * 100;
        const unsafe = (domainUsage.unsafe / totalDomains) * 100;
        const unlisted = (domainUsage.unlisted / totalDomains) * 100;

        let cursor = 0;
        const segments = [
            { color: '#ff3b3b', pct: unsafe },
            { color: '#ff007f', pct: unlisted },
            { color: '#22c55e', pct: safe },
        ];

        return `conic-gradient(${segments
            .map((s) => `${s.color} ${cursor}% ${(cursor += s.pct)}%`)
            .join(', ')})`;
    })();

    return (
        <>
            <Head title="Dashboard" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">

                    {/* Hero Section */}
                    <header className="text-center mb-10">
                        <h3 className="text-base font-normal text-muted-foreground mb-[-5px]">Welcome to</h3>
                        <h1
                            className="text-[5rem] font-bold tracking-wider leading-none"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            ABL<span className="text-able-green">E</span>
                        </h1>
                        <p className="text-sm italic text-muted-foreground max-w-[600px] mx-auto mt-3 leading-relaxed">
                            "An Adaptive Security System designed to monitor shadow-related activities from all over the world, and help users secure their personal information against third-party websites."
                        </p>
                        <div className="flex items-center gap-3 max-w-[200px] mx-auto mt-7">
                            <div className="flex-1 h-px bg-muted-foreground/30" />
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                            <div className="flex-1 h-px bg-muted-foreground/30" />
                        </div>
                    </header>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className={`${glassCard} p-5`}>
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2.5">Active Users</p>
                                    <p className="text-2xl font-semibold text-able-green">{activeUsers}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2.5">Inactive Users</p>
                                    <p className="text-2xl font-semibold">{inactiveUsers}</p>
                                </div>
                            </div>
                        </div>
                        <div className={`${glassCard} p-5 flex flex-col justify-center items-center`}>
                            <div className="grid grid-cols-2 gap-4 text-center w-full">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2.5">Total Domain Visits</p>
                                    <p className="text-2xl font-semibold">{totalDomainVisits.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2.5">Total Egress Attempts</p>
                                    <p className="text-2xl font-semibold">{totalEgressAttempts.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data Usage Card */}
                    <div className={`${glassCard} p-5 mb-6`}>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <p className="text-sm text-muted-foreground mb-2.5">Data Saved</p>
                                <p className="text-2xl font-semibold text-able-green">{dataSaved}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-2.5">Data Lost</p>
                                <p className="text-2xl font-semibold">{dataLost}</p>
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-2 gap-5 mb-6">
                        <div className={`${glassCard} p-8 flex justify-center items-center`}>
                            <div className="w-[200px] h-[200px] rounded-full flex justify-center items-center shadow-lg"
                                style={{ background: nudgeGradient }}>
                                <div className="w-[130px] h-[130px] bg-[#1a4033] rounded-full flex justify-center items-center text-center">
                                    <span className="text-[0.85rem] font-medium leading-tight">Nudge<br />Success</span>
                                </div>
                            </div>
                        </div>
                        <div className={`${glassCard} p-8 flex justify-center items-center`}>
                            <div className="w-[200px] h-[200px] rounded-full flex justify-center items-center shadow-lg"
                                style={{ background: domainGradient }}>
                                <div className="w-[130px] h-[130px] bg-[#1a4033] rounded-full flex justify-center items-center text-center">
                                    <span className="text-[0.85rem] font-medium leading-tight">Domain<br />Usage</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Egress Events Table */}
                    <div className={`${glassCard} p-6 mb-5`}>
                        <h2
                            className="text-2xl mb-8 font-semibold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Recent Egress Events
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[0.85rem]">
                                <thead>
                                    <tr className="text-muted-foreground">
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">Date</th>
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">Time</th>
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">Domain Name</th>
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">Status</th>
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">User ID</th>
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">File Name</th>
                                        <th className="text-left pb-5 font-medium border-b border-[rgba(34,197,94,0.7)]">Action Taken</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentEgressEvents.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-10 text-center text-muted-foreground">
                                                No egress events recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        recentEgressEvents.map((row, i) => (
                                            <tr key={i} className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0">
                                                <td className="py-3 pr-2.5">{row.date}</td>
                                                <td className="py-3 pr-2.5">{row.time}</td>
                                                <td className="py-3 pr-2.5">{row.domain}</td>
                                                <td className="py-3 pr-2.5"><Badge variant={row.status}>{row.status.replace('glass-', '').toUpperCase()}</Badge></td>
                                                <td className="py-3 pr-2.5">{row.user ?? '—'}</td>
                                                <td className="py-3 pr-2.5">{row.fileName ?? '—'}</td>
                                                <td className="py-3">{row.action}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent Domain Visit Table */}
                    <div className={`${glassCard} p-6 mb-3`}>
                        <h2
                            className="text-2xl mb-8 font-semibold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Recent Domain Visit
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[0.85rem]">
                                <thead>
                                    <tr className="text-muted-foreground">
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">Date</th>
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">Time</th>
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">URL</th>
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">Domain Name</th>
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">Status</th>
                                        <th className="text-left pb-5 pr-2.5 font-medium border-b border-[rgba(34,197,94,0.7)]">User ID</th>
                                        <th className="text-left pb-5 font-medium border-b border-[rgba(34,197,94,0.7)]">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentDomainVisits.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-10 text-center text-muted-foreground">
                                                No domain visits recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        recentDomainVisits.map((row, i) => (
                                            <tr key={i} className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0">
                                                <td className="py-3 pr-2.5">{row.time}</td>
                                                <td className="py-3 pr-2.5">{row.date}</td>
                                                <td className="py-3 pr-2.5">{row.url}</td>
                                                <td className="py-3 pr-2.5">{row.domain}</td>
                                                <td className="py-3 pr-2.5"><Badge variant={row.status}>{row.status.replace('glass-', '').toUpperCase()}</Badge></td>
                                                <td className="py-3 pr-2.5">{row.user ?? '—'}</td>
                                                <td className="py-3">{row.action}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
