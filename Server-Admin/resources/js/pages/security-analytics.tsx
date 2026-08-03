import { Head, Link } from '@inertiajs/react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    return (
        <div className="flex items-center justify-between text-[0.85rem]">
            <span className="w-[70px] font-medium">{label}</span>
            <div className="flex-1 h-3 bg-black/5 dark:bg-white/10 rounded-md mx-4 overflow-hidden">
                <div className="h-full rounded-md" style={{ width: `${total > 0 ? (value / total) * 100 : 0}%`, backgroundColor: color }} />
            </div>
            <span className="w-[30px] text-right">{value}</span>
        </div>
    );
}

interface NudgeEffectivenessRow {
    date: string;
    proceeded: number;
    cancelled: number;
}

interface TopDomainRow {
    domain: string;
    totalVisits: number;
    activeUsers: number;
}

interface SecurityAnalyticsProps {
    uniqueDomains: number;
    domainUsage: {
        safe: number;
        unsafe: number;
        unlisted: number;
    };
    totalNudgesDeployed: number;
    nudgeEffectiveness: NudgeEffectivenessRow[];
    avgSuccessRate: number;
    dataSaved: string;
    dataLost: string;
    topDomains: TopDomainRow[];
}

export default function SecurityAnalytics({
    uniqueDomains,
    domainUsage,
    totalNudgesDeployed,
    nudgeEffectiveness,
    avgSuccessRate,
    dataSaved,
    dataLost,
    topDomains,
}: SecurityAnalyticsProps) {
    const [timeFilter, setTimeFilter] = useState('daily');

    const totalDomains = domainUsage.safe + domainUsage.unsafe + domainUsage.unlisted;

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

                    {/* Data Transfer Summary - Unified Card */}
                    <div className={`${glassCard} p-6`}>
                        <h3 className="text-[1.1rem] font-semibold mb-6" style={{ fontFamily: "'Unbounded', sans-serif" }}>Data Transfer Summary</h3>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="flex flex-col items-center text-center">
                                <p className="text-sm text-muted-foreground mb-2">Data Saved</p>
                                <p className="text-[2.5rem] font-bold text-[#00ff66]">{dataSaved}</p>
                            </div>
                            <div className="flex flex-col items-center text-center">
                                <p className="text-sm text-muted-foreground mb-2">Data Loss</p>
                                <p className="text-[2.5rem] font-bold text-[#ff4d4d]">{dataLost}</p>
                            </div>
                        </div>
                    </div>

                    {/* Row: Detected Domains + Domain Usage */}
                    <div className="grid grid-cols-[3fr_7fr] gap-6">
                        <div className={`${glassCard} p-6 flex flex-col items-center justify-center text-center`}>
                            <h3 className="text-[1.1rem] font-semibold mb-4" style={{ fontFamily: "'Unbounded', sans-serif" }}>Detected Domains</h3>
                            <div className="text-[4rem] font-bold mt-2.5">{uniqueDomains}</div>
                        </div>
                        <div className={`${glassCard} p-6`}>
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="text-[1.1rem] font-semibold" style={{ fontFamily: "'Unbounded', sans-serif" }}>Domain Usage Over time</h3>
                                <Select value={timeFilter} onValueChange={setTimeFilter}>
                                    <SelectTrigger className="w-[120px] bg-black/5 dark:bg-white/10 border border-[rgba(34,197,94,0.7)]">
                                        <SelectValue placeholder="Daily" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="yearly">Yearly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-4">
                                <ProgressBar label="SAFE" value={domainUsage.safe} total={totalDomains} color="#00ff66" />
                                <ProgressBar label="UNSAFE" value={domainUsage.unsafe} total={totalDomains} color="#ff4d4d" />
                                <ProgressBar label="UNLISTED" value={domainUsage.unlisted} total={totalDomains} color="#f066ff" />
                            </div>
                        </div>
                    </div>

                    {/* Shadow Footprint Catalog - Header + View All */}
                    <div className={`${glassCard} p-6 py-12`}>
                        <div className="flex flex-row items-center justify-between mb-2">
                            <h3 className="text-[1.92rem] font-semibold" style={{ fontFamily: "'Unbounded', sans-serif" }}>
                                Shadow Footprint Catalog
                            </h3>
                            <Link href="/security-analytics/shadow-footprints">
                                <Button variant="outline" className="border-[rgba(34,197,94,0.7)] hover:bg-[rgba(34,197,94,0.1)]">
                                    View All
                                </Button>
                            </Link>
                        </div>
                        <p className="text-muted-foreground text-[1.3rem] italic">Monitor and manage shadow application footprints</p>
                    </div>

                    {/* Metrics Row: Total Nudges + Success Rate */}
                    <div className="grid grid-cols-2 gap-6">
                        {[
                            { label: 'Total Nudges Deployed', value: totalNudgesDeployed.toLocaleString() },
                            { label: 'Avg. Success Rate', value: `${avgSuccessRate}%`, highlight: true },
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
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-[1.1rem] font-semibold" style={{ fontFamily: "'Unbounded', sans-serif" }}>Nudge Effectiveness</h3>
                                <Link href="/security-analytics/nudge-effectiveness">
                                    <Button variant="outline" className="border-[rgba(34,197,94,0.7)] hover:bg-[rgba(34,197,94,0.1)] text-sm">
                                        View All
                                    </Button>
                                </Link>
                            </div>
                            <table className="w-full border-collapse text-[0.9rem] text-left">
                                <thead>
                                    <tr>
                                        <th className="pb-5 text-muted-foreground font-medium border-b border-[rgba(34,197,94,0.7)] w-[35%]">Date</th>
                                        <th className="pb-5 text-muted-foreground font-medium border-b border-[rgba(34,197,94,0.7)] w-[20%]">Proceeded</th>
                                        <th className="pb-5 text-muted-foreground font-medium border-b border-[rgba(34,197,94,0.7)] w-[20%]">Cancelled</th>
                                        <th className="pb-5 text-muted-foreground font-medium border-b border-[rgba(34,197,94,0.7)] w-[25%]">Success</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {nudgeEffectiveness.slice(0, 5).map((row, i) => {
                                        const total = row.proceeded + row.cancelled;
                                        const success = total > 0 ? ((row.proceeded / total) * 100).toFixed(1) + '%' : '0%';
                                        return (
                                            <tr key={i} className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0">
                                                <td className="py-3.5">{row.date}</td>
                                                <td className="py-3.5">{row.proceeded}</td>
                                                <td className="py-3.5">{row.cancelled}</td>
                                                <td className="py-3.5">
                                                    <span className={`px-2 py-0.5 rounded-[10px] text-[12px] font-bold inline-block ${
                                                        parseFloat(success) >= 50 ? 'bg-[#00ff66] text-[#15382e]' : 'bg-[#f39c12] text-white'
                                                    }`}>{success}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Top Domains */}
                        <div className={`${glassCard} p-6`}>
                            <h3 className="text-[1.1rem] font-semibold mb-4" style={{ fontFamily: "'Unbounded', sans-serif" }}>Top Domains</h3>
                            <table className="w-full border-collapse text-[0.9rem] text-left">
                                <thead>
                                    <tr>
                                        {['Domain Name', 'Total Visit', 'Active Users'].map((h) => (
                                            <th key={h} className="pb-5 text-muted-foreground font-medium border-b border-[rgba(34,197,94,0.7)]">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {topDomains.map((row, i) => (
                                        <tr key={i} className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0">
                                            <td className="py-3.5">{row.domain}</td>
                                            <td className="py-3.5">{row.totalVisits.toLocaleString()}</td>
                                            <td className="py-3.5">{row.activeUsers}</td>
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
