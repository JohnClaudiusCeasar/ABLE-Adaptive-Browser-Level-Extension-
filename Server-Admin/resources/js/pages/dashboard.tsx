import { Head, Link, usePage } from '@inertiajs/react';
import {
    Users,
    UserMinus,
    Globe,
    ShieldAlert,
    Ghost,
    ArrowUpFromLine,
    ChevronRight,
    Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { ActiveShadowAppsModal } from '@/components/dashboard/active-shadow-apps-modal';
import type { ActiveShadowApp } from '@/components/dashboard/active-shadow-apps-modal';
import { DonutGauge } from '@/components/dashboard/donut-gauge';
import { GroupedBarChart } from '@/components/dashboard/grouped-bar-chart';
import { PanelCard } from '@/components/dashboard/panel-card';
import { SegmentedBar } from '@/components/dashboard/segmented-bar';
import { StatCard } from '@/components/dashboard/stat-card';
import { UserStatCard } from '@/components/dashboard/user-stat-card';
import { LiveTelemetryStatus } from '@/components/live-telemetry-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, truncateFileName, formatMetricNumber } from '@/lib/utils';
import { dashboard } from '@/routes';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

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
    egressHigh?: number;
    egressLow?: number;
}

interface DashboardProps {
    activeUsers: number;
    inactiveUsers: number;
    totalDomainVisits: number;
    activeShadowApps: number;
    activeShadowAppsList: ActiveShadowApp[];
    totalEgressCount: number;
    criticalEgressCount: number;
    dataSaved: string;
    dataLost: string;
    nudgeSuccessRate: number;
    nudgeCancelled?: number;
    nudgeProceeded?: number;
    nudgeProceededHigh?: number;
    nudgeProceededLow?: number;
    nudgeHighRiskSuccessRate?: number | null;
    nudgeLowRiskSuccessRate?: number | null;
    domainUsage: {
        safe: number;
        unsafe: number;
        unlisted: number;
    };
    recentEgressEvents: RecentEgressEvent[];
    recentDomainVisits: RecentDomainVisit[];
    shadowActivity: DailyActivity[];
    recommendationCount: number;
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
    activeShadowAppsList = [],
    totalEgressCount,
    criticalEgressCount,
    dataSaved,
    dataLost,
    nudgeSuccessRate,
    nudgeCancelled = 0,
    nudgeProceeded = 0,
    nudgeProceededHigh = 0,
    nudgeProceededLow = 0,
    nudgeHighRiskSuccessRate = null,
    nudgeLowRiskSuccessRate = null,
    domainUsage,
    recentEgressEvents,
    recentDomainVisits,
    shadowActivity,
    recommendationCount,
}: DashboardProps) {
    const [shadowAppsOpen, setShadowAppsOpen] = useState(false);
    const { auth } = usePage<{ auth: { modules: string[] } }>().props;
    const canManagePolicy = auth?.modules?.includes('policy') ?? false;

    const totalDomains =
        domainUsage.safe + domainUsage.unsafe + domainUsage.unlisted;

    // Data protection shares (client-computed from the formatted bytes strings).
    const savedBytes = parseFloat(dataSaved) || 0;
    const lostBytes = parseFloat(dataLost) || 0;
    const totalBytes = savedBytes + lostBytes;
    const savedPct = totalBytes > 0 ? (savedBytes / totalBytes) * 100 : 0;
    const lostPct = totalBytes > 0 ? (lostBytes / totalBytes) * 100 : 0;

    const totalProceeded =
        nudgeProceededHigh + nudgeProceededLow > 0
            ? nudgeProceededHigh + nudgeProceededLow
            : nudgeProceeded;
    const totalNudgeInteractions = nudgeCancelled + totalProceeded;

    const hasRiskSplit = nudgeProceededHigh > 0 || nudgeProceededLow > 0;

    const nudgeSegments = hasRiskSplit
        ? [
              { color: '#22c55e', value: nudgeCancelled, label: 'Cancelled' },
              {
                  color: '#f59e0b',
                  value: nudgeProceededLow,
                  label: 'Proceeded (Low Risk)',
              },
              {
                  color: '#ff3b3b',
                  value: nudgeProceededHigh,
                  label: 'Proceeded (High Risk)',
              },
          ]
        : [
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
                    <LiveTelemetryStatus
                        watched={['visits', 'egress']}
                        className="mt-3"
                    />
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

                {canManagePolicy && (
                    <Link
                        href="/recommendation-policy"
                        className={`${glassCard} group flex items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-[rgba(34,197,94,0.14)]`}
                    >
                        <span className="flex items-center gap-4">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(34,197,94,0.4)] bg-[rgba(34,197,94,0.12)] text-able-green">
                                <Sparkles size={22} />
                            </span>
                            <span>
                                <span className="block text-[0.7rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                                    ABLE Recommends
                                </span>
                                <span className="block text-sm text-muted-foreground">
                                    {recommendationCount > 0
                                        ? `${recommendationCount} sanctioned ${
                                              recommendationCount === 1
                                                  ? 'alternative'
                                                  : 'alternatives'
                                          } configured`
                                        : 'Assign sanctioned alternatives for each app category.'}
                                </span>
                            </span>
                        </span>
                        <ChevronRight className="text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </Link>
                )}

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
                        onClick={() => setShadowAppsOpen(true)}
                    />
                </div>

                <ActiveShadowAppsModal
                    open={shadowAppsOpen}
                    onOpenChange={setShadowAppsOpen}
                    apps={activeShadowAppsList}
                />

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
                                                    title={
                                                        row.fileName ??
                                                        undefined
                                                    }
                                                >
                                                    {row.fileName
                                                        ? truncateFileName(
                                                              row.fileName,
                                                          )
                                                        : '—'}
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
