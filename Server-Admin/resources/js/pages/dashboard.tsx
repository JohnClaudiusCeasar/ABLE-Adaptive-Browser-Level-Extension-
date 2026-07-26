import { Head } from '@inertiajs/react';
import { dashboard } from '@/routes';

const glassCard = 'bg-white/5 border border-[rgba(34,197,94,0.7)] rounded-lg backdrop-blur-[10px]';

function Badge({ variant, children }: { variant: 'unsafe' | 'unlisted' | 'safe'; children: React.ReactNode }) {
    const styles = {
        unsafe: 'bg-[#ff4d4d] text-white border border-[#ff7a7a]',
        unlisted: 'bg-[#cc66ff] text-white border border-[#d98cff]',
        safe: 'bg-able-green text-white border border-able-green',
    };
    return <span className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold tracking-wide ${styles[variant]}`}>{children}</span>;
}

export default function Dashboard() {
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
                        <div className="w-2 h-2 bg-foreground rounded-full mx-auto mt-7 shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                    </header>

                    {/* Metrics Row */}
                    <div className={`${glassCard} p-5 mb-5`}>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-sm text-muted-foreground mb-2.5">Active Users</p>
                                <p className="text-2xl font-semibold text-able-green">45</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-2.5">Total Egress Attempts</p>
                                <p className="text-2xl font-semibold">1,500</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-2.5">Inactive Users</p>
                                <p className="text-2xl font-semibold">65</p>
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-2 gap-5 mb-5">
                        <div className={`${glassCard} p-8 flex justify-center items-center`}>
                            <div className="w-[200px] h-[200px] rounded-full flex justify-center items-center shadow-lg"
                                style={{ background: 'conic-gradient(#ff3b3b 0% 25%, #22c55e 25% 100%)' }}>
                                <div className="w-[130px] h-[130px] bg-[#1a4033] rounded-full flex justify-center items-center text-center">
                                    <span className="text-[0.85rem] font-medium leading-tight">Nudge<br />Success</span>
                                </div>
                            </div>
                        </div>
                        <div className={`${glassCard} p-8 flex justify-center items-center`}>
                            <div className="w-[200px] h-[200px] rounded-full flex justify-center items-center shadow-lg"
                                style={{ background: 'conic-gradient(#ff3b3b 0% 15%, #ff007f 15% 45%, #22c55e 45% 100%)' }}>
                                <div className="w-[130px] h-[130px] bg-[#1a4033] rounded-full flex justify-center items-center text-center">
                                    <span className="text-[0.85rem] font-medium leading-tight">Domain<br />Usage</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Logs Table */}
                    <div className={`${glassCard} p-6`}>
                        <h2
                            className="text-2xl mb-5 font-semibold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Recent Logs
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[0.85rem]">
                                <thead>
                                    <tr className="text-muted-foreground">
                                        <th className="text-left pb-3 pr-2.5 font-medium border-b border-white/10">Date/Time</th>
                                        <th className="text-left pb-3 pr-2.5 font-medium border-b border-white/10">Destination URL</th>
                                        <th className="text-left pb-3 pr-2.5 font-medium border-b border-white/10">Status</th>
                                        <th className="text-left pb-3 pr-2.5 font-medium border-b border-white/10">User Endpoint</th>
                                        <th className="text-left pb-3 pr-2.5 font-medium border-b border-white/10">Risk Score</th>
                                        <th className="text-left pb-3 font-medium border-b border-white/10">Action Taken</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { date: '2026-06-22 1:30 PM', url: 'chatgpt.com', status: 'unsafe' as const, user: 'USER78291', score: '82%', action: 'Proceeded' },
                                        { date: '2026-06-22 1:25 PM', url: 'deepseek.com', status: 'unsafe' as const, user: 'USER81191', score: '81%', action: 'Denied' },
                                        { date: '2026-06-12 1:20 PM', url: 'canva.pro', status: 'unlisted' as const, user: 'USER90012', score: '92%', action: 'Proceeded' },
                                    ].map((row, i) => (
                                        <tr key={i} className="border-b border-white/10 last:border-b-0">
                                            <td className="py-3 pr-2.5">{row.date}</td>
                                            <td className="py-3 pr-2.5">{row.url}</td>
                                            <td className="py-3 pr-2.5"><Badge variant={row.status}>{row.status.toUpperCase()}</Badge></td>
                                            <td className="py-3 pr-2.5">{row.user}</td>
                                            <td className="py-3 pr-2.5">{row.score}</td>
                                            <td className="py-3">{row.action}</td>
                                        </tr>
                                    ))}
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
