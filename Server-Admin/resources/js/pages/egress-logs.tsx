import { Head } from '@inertiajs/react';
import { Search } from 'lucide-react';

const glassCard = 'bg-white/5 border border-[rgba(34,197,94,0.7)] rounded-lg backdrop-blur-[10px]';

function Badge({ variant, children }: { variant: 'unsafe' | 'unlisted' | 'safe'; children: React.ReactNode }) {
    const styles = {
        unsafe: 'bg-[#ff5c5c] text-white border border-[#ff8080]',
        unlisted: 'bg-[#f066ff] text-white border border-[#f599ff]',
        safe: 'bg-able-green text-white border border-able-green',
    };
    return <span className={`px-3 py-[5px] rounded-[15px] text-[12px] font-bold tracking-wider inline-block ${styles[variant]}`}>{children}</span>;
}

const logs = [
    { date: '2026-06-22 1:30 PM', url: 'chatgpt.com', status: 'unsafe' as const, user: 'USER78291', score: '82%', action: 'Proceeded' },
    { date: '2026-06-22 1:25 PM', url: 'deepseek.com', status: 'unsafe' as const, user: 'USER81191', score: '81%', action: 'Denied' },
    { date: '2026-06-12 1:20 PM', url: 'canva.pro', status: 'unlisted' as const, user: 'USER90012', score: '92%', action: 'Proceeded' },
];

export default function EgressLogs() {
    return (
        <>
            <Head title="Egress Logs" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">

                    {/* Page Header */}
                    <header className="mb-8">
                        <h1
                            className="text-[2.8rem] font-bold tracking-wide mb-2.5 uppercase"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            EGRESS LOGS
                        </h1>
                        <p className="text-[1.05rem] text-[#d1e0e0] mb-8">
                            Displays raw, telemetry data being intercepted by the ABLE browser extension.
                        </p>
                        <div className="flex items-center bg-[#273740] rounded-full py-2 px-4 w-[250px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                            <Search size={16} className="text-[#a0aab2] mr-2.5" />
                            <input
                                type="text"
                                placeholder="Search"
                                className="bg-transparent border-none text-white text-[0.95rem] w-full outline-none placeholder:text-[#a0aab2]"
                            />
                        </div>
                    </header>

                    {/* Data Table */}
                    <div className={`${glassCard} px-10 py-8`}>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[0.95rem] mb-5">
                                <thead>
                                    <tr>
                                        <th className="text-left text-[#e0e0e0] font-medium pb-4 border-b border-white/10">Date/Time</th>
                                        <th className="text-left text-[#e0e0e0] font-medium pb-4 border-b border-white/10">Destination URL</th>
                                        <th className="text-left text-[#e0e0e0] font-medium pb-4 border-b border-white/10">Status</th>
                                        <th className="text-left text-[#e0e0e0] font-medium pb-4 border-b border-white/10">User ID</th>
                                        <th className="text-left text-[#e0e0e0] font-medium pb-4 border-b border-white/10">Risk Score</th>
                                        <th className="text-left text-[#e0e0e0] font-medium pb-4 border-b border-white/10">User Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((row, i) => (
                                        <tr key={i} className="border-b border-white/15 last:border-b-0">
                                            <td className="py-[18px] text-[#f8f8f8]">{row.date}</td>
                                            <td className="py-[18px] text-[#f8f8f8]">{row.url}</td>
                                            <td className="py-[18px]"><Badge variant={row.status}>{row.status.toUpperCase()}</Badge></td>
                                            <td className="py-[18px] text-[#f8f8f8]">{row.user}</td>
                                            <td className="py-[18px] text-[#f8f8f8]">{row.score}</td>
                                            <td className="py-[18px] text-[#f8f8f8]">{row.action}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-end items-center gap-3 text-[0.95rem]">
                            <a href="#" className="text-white font-bold px-1">&lt;</a>
                            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-able-green text-white font-bold text-[0.95rem]">1</span>
                            <a href="#" className="text-white hover:bg-white/10 w-6 h-6 flex items-center justify-center rounded-full">2</a>
                            <a href="#" className="text-white hover:bg-white/10 w-6 h-6 flex items-center justify-center rounded-full">3</a>
                            <a href="#" className="text-white hover:bg-white/10 w-6 h-6 flex items-center justify-center rounded-full">4</a>
                            <span className="text-muted-foreground">...</span>
                            <a href="#" className="text-white font-bold px-1">&gt;</a>
                        </div>
                    </div>

                </div>
        </>
    );
}

EgressLogs.layout = {
    breadcrumbs: [{ title: 'Egress Logs', href: '/egress-logs' }],
};
