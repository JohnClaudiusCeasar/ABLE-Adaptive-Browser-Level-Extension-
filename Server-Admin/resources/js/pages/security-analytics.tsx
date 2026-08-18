import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

function ProgressBar({
    label,
    value,
    total,
    color,
}: {
    label: string;
    value: number;
    total: number;
    color: string;
}) {
    return (
        <div className="flex items-center justify-between text-[0.85rem]">
            <span className="w-[70px] font-medium">{label}</span>
            <div className="mx-4 h-3 flex-1 overflow-hidden rounded-md bg-black/5 dark:bg-white/10">
                <div
                    className="h-full rounded-md"
                    style={{
                        width: `${total > 0 ? (value / total) * 100 : 0}%`,
                        backgroundColor: color,
                    }}
                />
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

    const totalDomains =
        domainUsage.safe + domainUsage.unsafe + domainUsage.unlisted;

    return (
        <>
            <Head title="Security Analytics" />
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header>
                    <h1
                        className="mb-3 text-[2.6rem] font-bold tracking-wide"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        SECURITY ANALYTICS
                    </h1>
                    <p className="max-w-[850px] text-base leading-relaxed text-muted-foreground">
                        Monitors and Displays Domain Information and Nudge
                        Success Percentage extracted from the Browser Extension
                        for Admin Review and Approval.
                    </p>
                </header>

                {/* Data Transfer Summary - Unified Card */}
                <div className={`${glassCard} p-6`}>
                    <h3
                        className="mb-6 text-[1.1rem] font-semibold"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Data Transfer Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-8">
                        <div className="flex flex-col items-center text-center">
                            <p className="mb-2 text-sm text-muted-foreground">
                                Data Saved
                            </p>
                            <p className="text-[2.5rem] font-bold text-[#00ff66]">
                                {dataSaved}
                            </p>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            <p className="mb-2 text-sm text-muted-foreground">
                                Data Loss
                            </p>
                            <p className="text-[2.5rem] font-bold text-[#ff4d4d]">
                                {dataLost}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Row: Detected Domains + Domain Usage */}
                <div className="grid grid-cols-[3fr_7fr] gap-6">
                    <div
                        className={`${glassCard} flex flex-col items-center justify-center p-6 text-center`}
                    >
                        <h3
                            className="mb-4 text-[1.1rem] font-semibold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Detected Domains
                        </h3>
                        <div className="mt-2.5 text-[4rem] font-bold">
                            {uniqueDomains}
                        </div>
                    </div>
                    <div className={`${glassCard} p-6`}>
                        <div className="mb-5 flex items-center justify-between">
                            <h3
                                className="text-[1.1rem] font-semibold"
                                style={{
                                    fontFamily: "'Unbounded', sans-serif",
                                }}
                            >
                                Domain Usage Over time
                            </h3>
                            <Select
                                value={timeFilter}
                                onValueChange={setTimeFilter}
                            >
                                <SelectTrigger className="w-[120px] border border-[rgba(34,197,94,0.7)] bg-black/5 dark:bg-white/10">
                                    <SelectValue placeholder="Daily" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">
                                        Weekly
                                    </SelectItem>
                                    <SelectItem value="monthly">
                                        Monthly
                                    </SelectItem>
                                    <SelectItem value="yearly">
                                        Yearly
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-4">
                            <ProgressBar
                                label="SAFE"
                                value={domainUsage.safe}
                                total={totalDomains}
                                color="#00ff66"
                            />
                            <ProgressBar
                                label="UNSAFE"
                                value={domainUsage.unsafe}
                                total={totalDomains}
                                color="#ff4d4d"
                            />
                            <ProgressBar
                                label="UNLISTED"
                                value={domainUsage.unlisted}
                                total={totalDomains}
                                color="#f066ff"
                            />
                        </div>
                    </div>
                </div>

                {/* Shadow Footprint Catalog - Header + View All */}
                <div className={`${glassCard} p-6 py-12`}>
                    <div className="mb-2 flex flex-row items-center justify-between">
                        <h3
                            className="text-[1.92rem] font-semibold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Shadow Footprint Catalog
                        </h3>
                        <Link href="/security-analytics/shadow-footprints">
                            <Button
                                variant="outline"
                                className="border-[rgba(34,197,94,0.7)] hover:bg-[rgba(34,197,94,0.1)]"
                            >
                                View All
                            </Button>
                        </Link>
                    </div>
                    <p className="text-[1.3rem] text-muted-foreground italic">
                        Monitor and manage shadow application footprints
                    </p>
                </div>

                {/* Metrics Row: Total Nudges + Success Rate */}
                <div className="grid grid-cols-2 gap-6">
                    {[
                        {
                            label: 'Total Nudges Deployed',
                            value: totalNudgesDeployed.toLocaleString(),
                        },
                        {
                            label: 'Avg. Success Rate',
                            value: `${avgSuccessRate}%`,
                            highlight: true,
                        },
                    ].map((m) => (
                        <div
                            key={m.label}
                            className={`${glassCard} flex flex-col items-center justify-center p-6 text-center`}
                        >
                            <h4
                                className="mb-5 text-[1.2rem] font-medium"
                                style={{
                                    fontFamily: "'Unbounded', sans-serif",
                                }}
                            >
                                {m.label}
                            </h4>
                            <div
                                className={`text-[3.5rem] font-bold ${m.highlight ? 'text-[#f1c40f]' : ''}`}
                            >
                                {m.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Tables Row */}
                <div className="grid grid-cols-2 gap-6">
                    {/* Nudge Effectiveness */}
                    <div className={`${glassCard} p-6`}>
                        <div className="mb-4 flex items-center justify-between">
                            <h3
                                className="text-[1.1rem] font-semibold"
                                style={{
                                    fontFamily: "'Unbounded', sans-serif",
                                }}
                            >
                                Nudge Effectiveness
                            </h3>
                            <Link href="/security-analytics/nudge-effectiveness">
                                <Button
                                    variant="outline"
                                    className="border-[rgba(34,197,94,0.7)] text-sm hover:bg-[rgba(34,197,94,0.1)]"
                                >
                                    View All
                                </Button>
                            </Link>
                        </div>
                        <table className="w-full border-collapse text-left text-[0.9rem]">
                            <thead>
                                <tr>
                                    <th className="w-[35%] border-b border-[rgba(34,197,94,0.7)] pb-5 font-medium text-muted-foreground">
                                        Date
                                    </th>
                                    <th className="w-[20%] border-b border-[rgba(34,197,94,0.7)] pb-5 font-medium text-muted-foreground">
                                        Proceeded
                                    </th>
                                    <th className="w-[20%] border-b border-[rgba(34,197,94,0.7)] pb-5 font-medium text-muted-foreground">
                                        Cancelled
                                    </th>
                                    <th className="w-[25%] border-b border-[rgba(34,197,94,0.7)] pb-5 font-medium text-muted-foreground">
                                        Success
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {nudgeEffectiveness
                                    .slice(0, 5)
                                    .map((row, i) => {
                                        const total =
                                            row.proceeded + row.cancelled;
                                        const success =
                                            total > 0
                                                ? (
                                                      (row.proceeded / total) *
                                                      100
                                                  ).toFixed(1) + '%'
                                                : '0%';

                                        return (
                                            <tr
                                                key={i}
                                                className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                            >
                                                <td className="py-3.5">
                                                    {row.date}
                                                </td>
                                                <td className="py-3.5">
                                                    {row.proceeded}
                                                </td>
                                                <td className="py-3.5">
                                                    {row.cancelled}
                                                </td>
                                                <td className="py-3.5">
                                                    <span
                                                        className={`inline-block rounded-[10px] px-2 py-0.5 text-[12px] font-bold ${
                                                            parseFloat(
                                                                success,
                                                            ) >= 50
                                                                ? 'bg-[#00ff66] text-[#15382e]'
                                                                : 'bg-[#f39c12] text-white'
                                                        }`}
                                                    >
                                                        {success}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>

                    {/* Top Domains */}
                    <div className={`${glassCard} p-6`}>
                        <h3
                            className="mb-4 text-[1.1rem] font-semibold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Top Domains
                        </h3>
                        <table className="w-full border-collapse text-left text-[0.9rem]">
                            <thead>
                                <tr>
                                    {[
                                        'Domain Name',
                                        'Total Visit',
                                        'Active Users',
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            className="border-b border-[rgba(34,197,94,0.7)] pb-5 font-medium text-muted-foreground"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {topDomains.map((row, i) => (
                                    <tr
                                        key={i}
                                        className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                    >
                                        <td className="py-3.5">{row.domain}</td>
                                        <td className="py-3.5">
                                            {row.totalVisits.toLocaleString()}
                                        </td>
                                        <td className="py-3.5">
                                            {row.activeUsers}
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
