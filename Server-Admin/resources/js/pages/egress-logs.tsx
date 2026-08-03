import { Head } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

const logs = [
    { date: '2026-06-22 1:30 PM', url: 'chatgpt.com', status: 'glass-unsafe' as const, user: 'USER78291', score: '82%', action: 'Proceeded' },
    { date: '2026-06-22 1:25 PM', url: 'deepseek.com', status: 'glass-unsafe' as const, user: 'USER81191', score: '81%', action: 'Denied' },
    { date: '2026-06-12 1:20 PM', url: 'canva.pro', status: 'glass-unlisted' as const, user: 'USER90012', score: '92%', action: 'Proceeded' },
];

export default function EgressLogs() {
    return (
        <>
            <Head title="Egress Logs" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">

                    {/* Page Header */}
                    <header className="mb-8">
                        <h1
                            className="text-[2.8rem] font-bold tracking-wide mb-2.5 uppercase text-foreground"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            EGRESS LOGS
                        </h1>
                        <p className="text-[1.05rem] text-muted-foreground mb-8">
                            Displays raw, telemetry data being intercepted by the ABLE browser extension.
                        </p>
                        <div className="flex items-center bg-black/5 rounded-full py-2 px-4 w-[250px] border border-black/10 dark:bg-[#273740] dark:border-white/10">
                            <Search size={16} className="text-muted-foreground mr-2.5" />
                            <input
                                type="text"
                                placeholder="Search"
                                className="bg-transparent border-none text-foreground text-[0.95rem] w-full outline-none placeholder:text-muted-foreground"
                            />
                        </div>
                    </header>

                    {/* Data Table */}
                    <div className={`${glassCard} px-10 py-8`}>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[0.95rem] mb-5">
                                <thead>
                                    <tr>
                                        <th className="text-left text-muted-foreground font-medium pb-6 border-b border-[rgba(34,197,94,0.7)]">Date/Time</th>
                                        <th className="text-left text-muted-foreground font-medium pb-6 border-b border-[rgba(34,197,94,0.7)]">Destination URL</th>
                                        <th className="text-left text-muted-foreground font-medium pb-6 border-b border-[rgba(34,197,94,0.7)]">Status</th>
                                        <th className="text-left text-muted-foreground font-medium pb-6 border-b border-[rgba(34,197,94,0.7)]">User ID</th>
                                        <th className="text-left text-muted-foreground font-medium pb-6 border-b border-[rgba(34,197,94,0.7)]">Risk Score</th>
                                        <th className="text-left text-muted-foreground font-medium pb-6 border-b border-[rgba(34,197,94,0.7)]">User Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((row, i) => (
                                        <tr key={i} className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0">
                                            <td className="py-[18px]">{row.date}</td>
                                            <td className="py-[18px]">{row.url}</td>
                                            <td className="py-[18px]"><Badge variant={row.status}>{row.status.replace('glass-', '').toUpperCase()}</Badge></td>
                                            <td className="py-[18px]">{row.user}</td>
                                            <td className="py-[18px]">{row.score}</td>
                                            <td className="py-[18px]">{row.action}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-end items-center gap-3 text-[0.95rem]">
                            <a href="#" className="text-muted-foreground font-bold px-1">&lt;</a>
                            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-able-green text-white font-bold text-[0.95rem]">1</span>
                            <a href="#" className="text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 w-6 h-6 flex items-center justify-center rounded-full">2</a>
                            <a href="#" className="text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 w-6 h-6 flex items-center justify-center rounded-full">3</a>
                            <a href="#" className="text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 w-6 h-6 flex items-center justify-center rounded-full">4</a>
                            <span className="text-muted-foreground">...</span>
                            <a href="#" className="text-muted-foreground font-bold px-1">&gt;</a>
                        </div>
                    </div>

                </div>
        </>
    );
}

EgressLogs.layout = {
    breadcrumbs: [{ title: 'Egress Logs', href: '/egress-logs' }],
};
