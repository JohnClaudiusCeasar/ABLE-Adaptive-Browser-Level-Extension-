import { Head, Link } from '@inertiajs/react';
import { Users, UserMinus, Globe, ShieldAlert, Activity, Printer, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { DonutGauge } from '@/components/dashboard/donut-gauge';
import { PanelCard } from '@/components/dashboard/panel-card';
import { SegmentedBar } from '@/components/dashboard/segmented-bar';
import { StatCard } from '@/components/dashboard/stat-card';
import { UserStatCard } from '@/components/dashboard/user-stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { dashboard } from '@/routes';

interface RecentEgressEvent {
    occurred_at: string;
    domain: string;
    status: 'glass-safe' | 'glass-unsafe' | 'glass-unlisted';
    user: string | null;
    fileName: string | null;
    action: string;
}

interface RecentDomainVisit {
    visited_at: string;
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

function formatTimestamp(ts: string): { date: string; time: string } {
    const d = new Date(ts);

    return {
        date: d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }),
        time: d.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }),
    };
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
    const totalDomains =
        domainUsage.safe + domainUsage.unsafe + domainUsage.unlisted;

    // Data protection shares (client-computed from the formatted bytes strings).
    const savedBytes = parseFloat(dataSaved) || 0;
    const lostBytes = parseFloat(dataLost) || 0;
    const totalBytes = savedBytes + lostBytes;
    const savedPct = totalBytes > 0 ? (savedBytes / totalBytes) * 100 : 0;
    const lostPct = totalBytes > 0 ? (lostBytes / totalBytes) * 100 : 0;

    const nudgeSegments = [
        { color: '#22c55e', value: nudgeSuccessRate, label: 'Success' },
        {
            color: '#ff3b3b',
            value: Math.max(0, 100 - nudgeSuccessRate),
            label: 'Failure',
        },
    ];

    const domainSegments = [
        { color: '#ff3b3b', value: domainUsage.unsafe, label: 'Unsafe' },
        { color: '#ff007f', value: domainUsage.unlisted, label: 'Unlisted' },
        { color: '#22c55e', value: domainUsage.safe, label: 'Safe' },
    ];

    return (
        <>
            <Head title="Dashboard" />
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-8 pt-12 pb-[22px]">
                {/* Page Header */}
                <header className="mb-2 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1
                            className="mb-3 text-[2.6rem] leading-none font-bold tracking-wide uppercase"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Security Overview
                        </h1>
                        <p className="max-w-[720px] text-base leading-relaxed text-muted-foreground">
                            Real-time monitoring of domain activity, data egress
                            attempts, and nudge effectiveness across the ABLE
                            extension network.
                        </p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="border-[rgba(34,197,94,0.7)] hover:bg-[rgba(34,197,94,0.1)] gap-2"
                            >
                                <Printer size={16} />
                                Print Report
                                <ChevronDown size={14} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                                <a href="/dashboard/report/pdf" className="gap-2 cursor-pointer">
                                    <FileText size={16} />
                                    Download PDF
                                </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <a href="/dashboard/report/excel" className="gap-2 cursor-pointer">
                                    <FileSpreadsheet size={16} />
                                    Download CSV
                                </a>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </header>

                {/* User Stats Row */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <UserStatCard
                        label="Active Users"
                        value={activeUsers}
                        icon={Users}
                        accent="text-able-green"
                        subtitle="Last 30 days"
                        pulseColor="#22c55e"
                    />
                    <UserStatCard
                        label="Inactive Users"
                        value={inactiveUsers}
                        icon={UserMinus}
                        accent="text-[#ff4d4d]"
                        subtitle="Uninstalled"
                        pulseColor="#ff4d4d"
                    />
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Domain Visits"
                        value={totalDomainVisits.toLocaleString()}
                        icon={Globe}
                        accent="text-blue-400"
                        underline="bg-blue-400"
                    />
                    <StatCard
                        label="Egress Attempts"
                        value={totalEgressAttempts.toLocaleString()}
                        icon={ShieldAlert}
                        accent="text-[#ff4d4d]"
                        underline="bg-[#ff4d4d]"
                    />
                    <StatCard
                        label="Nudge Success"
                        value={nudgeSuccessRate}
                        icon={Activity}
                        accent="text-[#f1c40f]"
                        underline="bg-[#f1c40f]"
                        suffix="%"
                    />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <PanelCard
                        title="Nudge Success"
                        subtitle="Share of nudges that prevented data loss"
                    >
                        <DonutGauge
                            segments={nudgeSegments}
                            centerLabel="Success Rate"
                            centerValue={`${nudgeSuccessRate}%`}
                        />
                    </PanelCard>
                    <PanelCard
                        title="Domain Usage"
                        subtitle="Classification of monitored domains"
                    >
                        <DonutGauge
                            segments={domainSegments}
                            centerLabel="Total Domains"
                            centerValue={totalDomains.toLocaleString()}
                        />
                    </PanelCard>
                </div>

                {/* Data Protection Panel */}
                <PanelCard
                    title="Data Protection"
                    subtitle="Bytes blocked vs. bytes that left the network"
                >
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                        <SegmentedBar
                            title="Blocked data"
                            segments={[
                                {
                                    color: '#22c55e',
                                    label: 'Data Saved',
                                    value: dataSaved,
                                    pct: savedPct,
                                },
                            ]}
                        />
                        <SegmentedBar
                            title="Exfiltrated data"
                            segments={[
                                {
                                    color: '#ff4d4d',
                                    label: 'Data Lost',
                                    value: dataLost,
                                    pct: lostPct,
                                },
                            ]}
                        />
                    </div>
                </PanelCard>

                {/* Recent Egress Events Table */}
                <PanelCard
                    title="Recent Egress Events"
                    action={
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="border-[rgba(34,197,94,0.7)] hover:bg-[rgba(34,197,94,0.1)]"
                        >
                            <Link href="/egress-logs">View All</Link>
                        </Button>
                    }
                >
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[0.85rem]">
                            <thead>
                                <tr className="text-muted-foreground">
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Date
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Time
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Domain Name
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Status
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        User ID
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        File Name
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-4 text-left font-medium">
                                        Action Taken
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentEgressEvents.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="py-10 text-center text-muted-foreground"
                                        >
                                            No egress events recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                recentEgressEvents.map((row, i) => {
                                    const { date, time } = formatTimestamp(row.occurred_at);

                                    return (
                                        <tr
                                            key={i}
                                            className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                        >
                                            <td className="py-3 pr-2.5">
                                                {date}
                                            </td>
                                            <td className="py-3 pr-2.5">
                                                {time}
                                            </td>
                                            <td className="py-3 pr-2.5">
                                                {row.domain}
                                            </td>
                                            <td className="py-3 pr-2.5">
                                                <Badge variant={row.status}>
                                                    {row.status
                                                        .replace('glass-', '')
                                                        .toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td className="py-3 pr-2.5">
                                                {row.user ?? '—'}
                                            </td>
                                            <td className="py-3 pr-2.5">
                                                {row.fileName ?? '—'}
                                            </td>
                                            <td className="py-3">
                                                {row.action}
                                            </td>
                                        </tr>
                                    );
                                })
                                )}
                            </tbody>
                        </table>
                    </div>
                </PanelCard>

                {/* Recent Domain Visits Table */}
                <PanelCard
                    title="Recent Domain Visits"
                    action={
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="border-[rgba(34,197,94,0.7)] hover:bg-[rgba(34,197,94,0.1)]"
                        >
                            <Link href="/domain-visits">View All</Link>
                        </Button>
                    }
                >
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[0.85rem]">
                            <thead>
                                <tr className="text-muted-foreground">
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Date
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Time
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        URL
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Domain Name
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Status
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        User ID
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-4 text-left font-medium">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentDomainVisits.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="py-10 text-center text-muted-foreground"
                                        >
                                            No domain visits recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                recentDomainVisits.map((row, i) => {
                                    const { date, time } = formatTimestamp(row.visited_at);

                                    return (
                                        <tr
                                            key={i}
                                            className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                        >
                                            <td className="py-3 pr-2.5">
                                                {date}
                                            </td>
                                            <td className="py-3 pr-2.5">
                                                {time}
                                            </td>
                                            <td className="py-3 pr-2.5">
                                                {row.url}
                                            </td>
                                            <td className="py-3 pr-2.5">
                                                {row.domain}
                                            </td>
                                            <td className="py-3 pr-2.5">
                                                <Badge variant={row.status}>
                                                    {row.status
                                                        .replace('glass-', '')
                                                        .toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td className="py-3 pr-2.5">
                                            {row.user ?? '—'}
                                        </td>
                                        <td className="py-3">
                                            {row.action}
                                        </td>
                                    </tr>
                                );
                                })
                                )}
                            </tbody>
                        </table>
                    </div>
                </PanelCard>
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
