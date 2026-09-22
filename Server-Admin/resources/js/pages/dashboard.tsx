import { Head, Link } from '@inertiajs/react';
import {
    Users,
    UserMinus,
    Globe,
    ShieldAlert,
    Ghost,
    ArrowUpFromLine,
    Printer,
    FileSpreadsheet,
    FileText,
} from 'lucide-react';
import { DonutGauge } from '@/components/dashboard/donut-gauge';
import { GroupedBarChart } from '@/components/dashboard/grouped-bar-chart';
import { PanelCard } from '@/components/dashboard/panel-card';
import { SegmentedBar } from '@/components/dashboard/segmented-bar';
import { StatCard } from '@/components/dashboard/stat-card';
import { UserStatCard } from '@/components/dashboard/user-stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { truncateFileName, formatMetricNumber } from '@/lib/utils';
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

interface DailyActivity {
    date: string;
    day: string;
    visits: number;
    egress: number;
}

interface DashboardProps {
    activeUsers: number;
    inactiveUsers: number;
    totalDomainVisits: number;
    activeShadowApps: number;
    totalEgressCount: number;
    criticalEgressCount: number;
    dataSaved: string;
    dataLost: string;
    nudgeSuccessRate: number;
    nudgeCancelled?: number;
    nudgeProceeded?: number;
    domainUsage: {
        safe: number;
        unsafe: number;
        unlisted: number;
    };
    recentEgressEvents: RecentEgressEvent[];
    recentDomainVisits: RecentDomainVisit[];
    shadowActivity: DailyActivity[];
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
            second: '2-digit',
            hour12: true,
        }),
    };
}

export default function Dashboard({
    activeUsers,
    inactiveUsers,
    totalDomainVisits,
    activeShadowApps,
    totalEgressCount,
    criticalEgressCount,
    dataSaved,
    dataLost,
    nudgeSuccessRate,
    nudgeCancelled = 0,
    nudgeProceeded = 0,
    domainUsage,
    recentEgressEvents,
    recentDomainVisits,
    shadowActivity,
}: DashboardProps) {
    const totalDomains =
        domainUsage.safe + domainUsage.unsafe + domainUsage.unlisted;

    // Data protection shares (client-computed from the formatted bytes strings).
    const savedBytes = parseFloat(dataSaved) || 0;
    const lostBytes = parseFloat(dataLost) || 0;
    const totalBytes = savedBytes + lostBytes;
    const savedPct = totalBytes > 0 ? (savedBytes / totalBytes) * 100 : 0;
    const lostPct = totalBytes > 0 ? (lostBytes / totalBytes) * 100 : 0;

    const totalNudgeInteractions = nudgeCancelled + nudgeProceeded;

    const nudgeSegments = [
        { color: '#22c55e', value: nudgeCancelled, label: 'Cancelled' },
        { color: '#ff3b3b', value: nudgeProceeded, label: 'Proceeded' },
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
                <header className="mb-2">
                    <h1
                        className="mb-2.5 text-[2.8rem] font-bold tracking-wide text-foreground uppercase"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Security Overview
                    </h1>
                    <p className="max-w-[720px] text-[1.05rem] leading-relaxed text-muted-foreground">
                        Real-time monitoring of domain activity, data egress
                        attempts, and nudge effectiveness across the ABLE
                        extension network.
                    </p>
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

                {/* Data Protection Panel */}
                <PanelCard
                    title="Data Protection"
                    subtitle="File upload outcomes from user-intercepted nudges — blocked uploads vs. uploads the user chose to proceed with"
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

                {/* Divider */}
                <div className="flex items-center gap-3 py-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(34,197,94,0.4)] to-transparent" />
                    <div className="relative">
                        <div className="h-2 w-2 rounded-full bg-able-green" />
                        <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-able-green opacity-40" />
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(34,197,94,0.4)] to-transparent" />
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Total Egress Count"
                        value={totalEgressCount}
                        icon={ArrowUpFromLine}
                        accent="text-blue-400"
                        underline="bg-blue-400"
                    />
                    <StatCard
                        label="Critical Egress Count"
                        value={criticalEgressCount}
                        icon={ShieldAlert}
                        accent="text-[#ff4d4d]"
                        underline="bg-[#ff4d4d]"
                    />
                    <StatCard
                        label="Domain Visits"
                        value={totalDomainVisits}
                        icon={Globe}
                        accent="text-blue-400"
                        underline="bg-blue-400"
                    />
                    <StatCard
                        label="Active Shadow Apps"
                        value={activeShadowApps}
                        icon={Ghost}
                        accent="text-[#a855f7]"
                        underline="bg-[#a855f7]"
                    />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <PanelCard
                        title="Nudge Containment"
                        subtitle="Share of nudges that prevented data loss"
                    >
                        <DonutGauge
                            segments={nudgeSegments}
                            centerLabel="Success Rate"
                            centerValue={`${nudgeSuccessRate}%`}
                            noData={totalNudgeInteractions === 0}
                        />
                    </PanelCard>
                    <PanelCard
                        title="Policy Control"
                        subtitle="Classification of monitored domains"
                    >
                        <DonutGauge
                            segments={domainSegments}
                            centerLabel="Total Domains"
                            centerValue={formatMetricNumber(totalDomains)}
                            noData={totalDomains === 0}
                        />
                    </PanelCard>
                </div>

                {/* Shadow Activity Timeline */}
                <PanelCard
                    title="Shadow Activity Timeline"
                    subtitle="Domain visits and egress attempts over the last 7 days"
                >
                    <GroupedBarChart data={shadowActivity} />
                </PanelCard>

                {/* Divider */}
                <div className="flex items-center gap-3 py-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(34,197,94,0.4)] to-transparent" />
                    <div className="relative">
                        <div className="h-2 w-2 rounded-full bg-able-green" />
                        <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-able-green opacity-40" />
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(34,197,94,0.4)] to-transparent" />
                </div>

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
                                        Domain Status
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
                                        const { date, time } = formatTimestamp(
                                            row.occurred_at,
                                        );

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
                                                            .replace(
                                                                'glass-',
                                                                '',
                                                            )
                                                            .toUpperCase()}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 pr-2.5">
                                                    {row.user ?? '—'}
                                                </td>
                                                <td
                                                    className="py-3 pr-2.5"
                                                    title={row.fileName ?? undefined}
                                                >
                                                    {row.fileName ? truncateFileName(row.fileName) : '—'}
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
                                        Domain Name
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Domain Status
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        User ID
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-4 text-left font-medium">
                                        Action Taken
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentDomainVisits.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="py-10 text-center text-muted-foreground"
                                        >
                                            No domain visits recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    recentDomainVisits.map((row, i) => {
                                        const { date, time } = formatTimestamp(
                                            row.visited_at,
                                        );

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
                                                            .replace(
                                                                'glass-',
                                                                '',
                                                            )
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

            {/* Subtly glowing blue chip 'Print Report' floating on top of the quick message widget */}
            <div className="fixed right-6 bottom-[92px] z-40">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label="Print Dashboard Report"
                            title="Print Dashboard Report"
                            className="group relative flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/50 bg-[#0a1f33]/90 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)] backdrop-blur-xl transition-all duration-200 hover:scale-105 hover:border-blue-400 hover:bg-[#0d2a45] hover:text-blue-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.65)] active:scale-95"
                        >
                            <Printer size={22} className="transition-transform group-hover:rotate-6" />
                            {/* Ambient subtle blue pulse glow */}
                            <span className="absolute inset-0 -z-10 rounded-2xl bg-blue-500/20 blur-md transition-opacity group-hover:opacity-100" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        side="left"
                        sideOffset={12}
                        className="z-50 min-w-[170px] rounded-xl border border-blue-500/40 bg-[#081b2d]/95 p-1 text-foreground shadow-2xl backdrop-blur-xl"
                    >
                        <DropdownMenuItem asChild>
                            <a
                                href="/dashboard/report/pdf"
                                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-blue-500/20 hover:text-white"
                            >
                                <FileText size={15} className="text-blue-400" />
                                <span>Download PDF</span>
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <a
                                href="/dashboard/report/excel"
                                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-blue-500/20 hover:text-white"
                            >
                                <FileSpreadsheet size={15} className="text-blue-400" />
                                <span>Download CSV</span>
                            </a>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
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
