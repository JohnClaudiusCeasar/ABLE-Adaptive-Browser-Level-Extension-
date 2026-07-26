import { Head } from '@inertiajs/react';
import { Eye } from 'lucide-react';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    return (
        <div className="flex items-center justify-between text-[0.85rem]">
            <span className="w-[70px] font-medium">{label}</span>
            <div className="flex-1 h-3 bg-black/5 dark:bg-white/10 rounded-md mx-4 overflow-hidden">
                <div className="h-full rounded-md" style={{ width: `${(value / total) * 100}%`, backgroundColor: color }} />
            </div>
            <span className="w-[30px] text-right">{total}</span>
        </div>
    );
}

export default function SecurityAnalytics() {
    return (
        <>
            <Head title="Security Analytics" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px] flex flex-col gap-6">

                    {/* Header */}
                    <header>
                        <h1
                            className="text-[2.6rem] font-bold tracking-wide mb-3"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            SECURITY ANALYTICS
                        </h1>
                        <p className="text-base text-muted-foreground max-w-[850px] leading-relaxed">
                            Monitors and Displays Domain Information and Nudge Success Percentage extracted from the Browser Extension for Admin Review and Approval.
                        </p>
                    </header>

                    {/* Row: Detected Domains + Domain Usage */}
                    <div className="grid grid-cols-[3fr_7fr] gap-6">
                        <div className={`${glassCard} p-6 flex flex-col items-center justify-center text-center`}>
                            <h3 className="text-[1.1rem] font-semibold mb-4" style={{ fontFamily: "'Unbounded', sans-serif" }}>Detected Domains</h3>
                            <div className="text-[4rem] font-bold mt-2.5">45</div>
                        </div>
                        <div className={`${glassCard} p-6`}>
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="text-[1.1rem] font-semibold" style={{ fontFamily: "'Unbounded', sans-serif" }}>Domain Usage Over time</h3>
                                <div className="bg-black/5 dark:bg-white/10 border border-[rgba(34,197,94,0.7)] px-4 py-1 rounded-md text-[0.85rem] cursor-pointer flex items-center gap-2">
                                    Daily <span className="text-[0.6rem] text-able-green">&#9660;</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-4">
                                <ProgressBar label="SAFE" value={215} total={215} color="#00ff66" />
                                <ProgressBar label="UNSAFE" value={115} total={115} color="#ff4d4d" />
                                <ProgressBar label="UNLISTED" value={530} total={530} color="#f066ff" />
                            </div>
                        </div>
                    </div>

                    {/* Shadow Footprint Catalog */}
                    <div className={`${glassCard} p-6`}>
                        <h3 className="text-[1.1rem] font-semibold mb-4" style={{ fontFamily: "'Unbounded', sans-serif" }}>Shadow Footprint Catalog</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[0.9rem] text-left">
                                <thead>
                                    <tr>
                                        {['App Name', 'Domain URL', 'Category', 'Risk Weight', 'Active Users', 'Status', 'Action'].map((h) => (
                                            <th key={h} className={`pb-3 text-muted-foreground font-medium ${h === 'Action' ? 'text-center' : ''} border-b border-[rgba(34,197,94,0.7)]`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { app: 'ChatGPT', domain: 'chat.open.ai', cat: 'Gen AI', risk: 'high', users: 149, status: 'Unapproved' },
                                        { app: 'Notion', domain: 'notion.so', cat: 'Productivity', risk: 'low', users: 89, status: 'Pending' },
                                        { app: 'Github', domain: 'github.com', cat: 'Develop...', risk: 'low', users: 110, status: 'Approved' },
                                        { app: 'Quillbot', domain: 'quillbot.com', cat: 'Productivity', risk: 'low', users: 98, status: 'Approved' },
                                    ].map((row, i) => (
                                        <tr key={i} className="border-b border-black/10 last:border-b-0 dark:border-white/10">
                                            <td className="py-3.5">{row.app}</td>
                                            <td className="py-3.5">{row.domain}</td>
                                            <td className="py-3.5">{row.cat}</td>
                                            <td className="py-3.5">
                                                <span className={`px-2.5 py-0.5 rounded text-[12px] font-bold ${
                                                    row.risk === 'high'
                                                        ? 'bg-[rgba(255,77,77,0.2)] text-[#ff4d4d] border border-[#ff4d4d]'
                                                        : 'bg-[rgba(0,255,102,0.2)] text-[#00ff66] border border-[#00ff66]'
                                                }`}>{row.risk.toUpperCase()}</span>
                                            </td>
                                            <td className="py-3.5">{row.users}</td>
                                            <td className="py-3.5">{row.status}</td>
                                            <td className="py-3.5 text-center">
                                                <button className="text-muted-foreground hover:text-able-green transition-colors bg-transparent border-none cursor-pointer">
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end items-center gap-2.5 mt-5 text-[0.85rem]">
                            <span className="w-[22px] h-[22px] flex items-center justify-center rounded-full bg-able-green text-white font-bold">1</span>
                            <span className="w-[22px] h-[22px] flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">2</span>
                            <span className="w-[22px] h-[22px] flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">3</span>
                            <span className="w-[22px] h-[22px] flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">4</span>
                            <span className="text-muted-foreground">...</span>
                            <span className="text-muted-foreground cursor-pointer font-bold">&gt;</span>
                        </div>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-3 gap-6">
                        {[
                            { label: 'Total Nudges Deployed', value: '1,578' },
                            { label: 'Avg. Success Rate', value: '82.3%', highlight: true },
                            { label: 'Data Saved', value: '1.5GB' },
                        ].map((m) => (
                            <div key={m.label} className={`${glassCard} p-6 flex flex-col items-center justify-center text-center`}>
                                <h4 className="text-[1.2rem] font-medium mb-5" style={{ fontFamily: "'Unbounded', sans-serif" }}>{m.label}</h4>
                                <div className={`text-[3.5rem] font-bold ${m.highlight ? 'text-[#f1c40f]' : ''}`}>{m.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Tables Row */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Nudge Effectiveness */}
                        <div className={`${glassCard} p-6`}>
                            <h3 className="text-[1.1rem] font-semibold mb-4" style={{ fontFamily: "'Unbounded', sans-serif" }}>Nudge Effectiveness</h3>
                            <table className="w-full border-collapse text-[0.9rem] text-left">
                                <thead>
                                    <tr>
                                        {['Date', 'Proceeded', 'Cancelled'].map((h) => (
                                            <th key={h} className="pb-3 text-muted-foreground font-medium border-b border-black/10 dark:border-white/20">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { date: '06-20-2026', proc: 12, canc: 9 },
                                        { date: '06-19-2026', proc: 7, canc: 14 },
                                        { date: '06-18-2026', proc: 14, canc: 2 },
                                        { date: '06-17-2026', proc: 7, canc: 14 },
                                        { date: '06-16-2026', proc: 15, canc: 13 },
                                    ].map((row, i) => (
                                        <tr key={i} className="border-b border-black/10 last:border-b-0 dark:border-white/10">
                                            <td className="py-3.5">{row.date}</td>
                                            <td className="py-3.5">{row.proc}</td>
                                            <td className="py-3.5">{row.canc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Top Domains */}
                        <div className={`${glassCard} p-6`}>
                            <h3 className="text-[1.1rem] font-semibold mb-4" style={{ fontFamily: "'Unbounded', sans-serif" }}>Top Domains</h3>
                            <table className="w-full border-collapse text-[0.9rem] text-left">
                                <thead>
                                    <tr>
                                        {['Domain', 'Total Nudges', 'Cancelled', 'Proceeded', 'Success'].map((h) => (
                                            <th key={h} className="pb-3 text-muted-foreground font-medium border-b border-black/10 dark:border-white/20">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { domain: 'ChatGPT', total: 450, canc: 391, proc: 59, success: '86.8%' },
                                        { domain: 'notion', total: 234, canc: 197, proc: 47, success: '84.1%' },
                                        { domain: 'Discord', total: 156, canc: 142, proc: 14, success: '91.0%' },
                                        { domain: 'Gemini', total: 189, canc: 159, proc: 30, success: '84.1%' },
                                        { domain: 'Pastebin', total: 95, canc: 71, proc: 24, success: '74.7%' },
                                    ].map((row, i) => (
                                        <tr key={i} className="border-b border-black/10 last:border-b-0 dark:border-white/10">
                                            <td className="py-3.5">{row.domain}</td>
                                            <td className="py-3.5">{row.total}</td>
                                            <td className="py-3.5">{row.canc}</td>
                                            <td className="py-3.5">{row.proc}</td>
                                            <td className="py-3.5">
                                                <span className={`px-2 py-0.5 rounded-[10px] text-[12px] font-bold inline-block ${
                                                    parseFloat(row.success) >= 85 ? 'bg-[#00ff66] text-[#15382e]' : 'bg-[#f39c12] text-white'
                                                }`}>{row.success}</span>
                                            </td>
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

SecurityAnalytics.layout = {
    breadcrumbs: [{ title: 'Security Analytics', href: '/security-analytics' }],
};
