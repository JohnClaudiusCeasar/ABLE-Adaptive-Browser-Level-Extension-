import { Head, Link } from '@inertiajs/react';
import {
    Ghost,
    Users,
    ShieldAlert,
    ArrowUpFromLine,
    CheckCircle2,
} from 'lucide-react';
import { useMemo } from 'react';
import { DonutGauge } from '@/components/dashboard/donut-gauge';
import { GroupedBarChart } from '@/components/dashboard/grouped-bar-chart';
import { PanelCard } from '@/components/dashboard/panel-card';
import { StatCard } from '@/components/dashboard/stat-card';
import { Button } from '@/components/ui/button';
import { cn, formatMetricNumber } from '@/lib/utils';

interface KPIData {
    discoveredShadowApps: number;
    shadowAdopters: number;
    shadowEgressAttempts: number;
    criticalEgressAttempts: number;
    dataSaved: string;
    dataLost: string;
    shadowContainmentRate: number;
}

interface DailyVelocity {
    date: string;
    day: string;
    visits: number;
    egress: number;
}

interface CategoryDistItem {
    category: string;
    count: number;
    percentage: number;
    avgRisk: number;
}

interface PolicyStanceData {
    unapproved: number;
    underReview: number;
    sanctioned: number;
    total: number;
}

interface NudgeEfficacyData {
    cancelled: number;
    proceeded: number;
    total: number;
    rate: number;
}

interface ShadowAnalyticsProps {
    kpi: KPIData;
    velocityActivity: DailyVelocity[];
    categoryDistribution: CategoryDistItem[];
    policyStance: PolicyStanceData;
    nudgeEfficacy: NudgeEfficacyData;
}

function getRiskScoreBadgeClass(score: number): string {
    if (score >= 76) {
        return 'border border-[#ff4d4d] bg-[rgba(255,77,77,0.2)] text-[#ff4d4d]';
    }

    if (score >= 41) {
        return 'border border-[#f59e0b] bg-[rgba(245,158,11,0.2)] text-[#f59e0b]';
    }

    return 'border border-[#00ff66] bg-[rgba(0,255,102,0.2)] text-[#00ff66]';
}

export default function ShadowAnalytics({
    kpi,
    velocityActivity,
    categoryDistribution,
    policyStance,
    nudgeEfficacy,
}: ShadowAnalyticsProps) {
    // Donut Segments
    const policySegments = useMemo(
        () => [
            {
                color: '#ff3b3b',
                value: policyStance.unapproved,
                label: 'Unapproved',
            },
            {
                color: '#f59e0b',
                value: policyStance.underReview,
                label: 'Under Review',
            },
            {
                color: '#22c55e',
                value: policyStance.sanctioned,
                label: 'Sanctioned',
            },
        ],
        [policyStance],
    );

    const nudgeSegments = useMemo(
        () => [
            {
                color: '#22c55e',
                value: nudgeEfficacy.cancelled,
                label: 'Prevented (Cancelled)',
            },
            {
                color: '#ff3b3b',
                value: nudgeEfficacy.proceeded,
                label: 'Overridden (Proceeded)',
            },
        ],
        [nudgeEfficacy],
    );

    return (
        <>
            <Head title="Shadow Overview" />
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-8 pt-12 pb-[22px]">
                {/* Header Row */}
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1
                            className="mb-2.5 text-[2.8rem] font-bold tracking-wide text-foreground uppercase"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            SHADOW OVERVIEW
                        </h1>
                        <p className="max-w-[760px] text-[1.05rem] leading-relaxed text-muted-foreground">
                            Continuous discovery, telemetry classification, and
                            egress mitigation across unsanctioned applications
                            intercepted by the ABLE extension network.
                        </p>
                    </div>
                </header>

                {/* ========================================================================= */}
                {/* SECTION 1: KPI METRICS (5 Cards Row)                                      */}
                {/* ========================================================================= */}
                <section>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <StatCard
                            label="Shadow Apps"
                            value={kpi.discoveredShadowApps}
                            icon={Ghost}
                            accent="text-[#a855f7]"
                            underline="bg-[#a855f7]"
                            subtitle="Unapproved & unlisted"
                        />
                        <StatCard
                            label="Shadow Adopters"
                            value={kpi.shadowAdopters}
                            icon={Users}
                            accent="text-[#f59e0b]"
                            underline="bg-[#f59e0b]"
                            subtitle="Extension users"
                        />
                        <StatCard
                            label="Egress Attempts"
                            value={kpi.shadowEgressAttempts}
                            icon={ShieldAlert}
                            accent="text-[#ff4d4d]"
                            underline="bg-[#ff4d4d]"
                            subtitle={`${formatMetricNumber(kpi.criticalEgressAttempts)} high-risk`}
                        />
                        <StatCard
                            label="Data Protected"
                            value={kpi.dataSaved}
                            icon={ArrowUpFromLine}
                            accent="text-[#00ff66]"
                            underline="bg-[#00ff66]"
                            subtitle={`${kpi.dataLost} lost`}
                        />
                        <StatCard
                            label="Containment"
                            value={`${kpi.shadowContainmentRate}%`}
                            icon={CheckCircle2}
                            accent="text-able-green"
                            underline="bg-able-green"
                            subtitle="Nudge defense rate"
                        />
                    </div>
                </section>

                {/* Divider */}
                <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(34,197,94,0.4)] to-transparent" />
                    <div className="relative">
                        <div className="h-2 w-2 rounded-full bg-able-green" />
                        <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-able-green opacity-40" />
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(34,197,94,0.4)] to-transparent" />
                </div>

                {/* ========================================================================= */}
                {/* SECTION 2: CHART CARDS (2x2 Grid)                                         */}
                {/* ========================================================================= */}
                <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Chart 1: Shadow Activity Velocity */}
                    <PanelCard
                        title="Activity Velocity"
                        subtitle="Daily domain visits vs. egress upload attempts over the last 7 days"
                        action={
                            <Link href="/security-analytics/egress-incidents">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs border-[rgba(34,197,94,0.5)] hover:bg-[rgba(34,197,94,0.1)]"
                                >
                                    View Incidents
                                </Button>
                            </Link>
                        }
                    >
                        <GroupedBarChart data={velocityActivity} />
                    </PanelCard>

                    {/* Chart 2: Shadow Category Risk Distribution */}
                    <PanelCard
                        title="Category Breakdown"
                        subtitle="Discovered applications grouped by risk category & average threat weight"
                        action={
                            <Link href="/security-analytics/shadow-apps">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs border-[rgba(34,197,94,0.5)] hover:bg-[rgba(34,197,94,0.1)]"
                                >
                                    View Catalog
                                </Button>
                            </Link>
                        }
                    >
                        {categoryDistribution.length === 0 ? (
                            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground italic">
                                No categorized applications found yet.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3.5 py-1">
                                {categoryDistribution.map((item) => (
                                    <div
                                        key={item.category}
                                        className="flex flex-col gap-1.5 rounded-lg border border-black/5 bg-black/[0.02] p-2.5 dark:border-white/5 dark:bg-white/[0.02]"
                                    >
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-foreground">
                                                    {item.category}
                                                </span>
                                                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-muted-foreground dark:bg-white/10">
                                                    {item.count}{' '}
                                                    {item.count === 1
                                                        ? 'app'
                                                        : 'apps'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={cn(
                                                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                                        getRiskScoreBadgeClass(
                                                            item.avgRisk,
                                                        ),
                                                    )}
                                                >
                                                    Avg Risk: {item.avgRisk}%
                                                </span>
                                                <span className="font-medium text-muted-foreground tabular-nums">
                                                    {item.percentage}%
                                                </span>
                                            </div>
                                        </div>
                                        {/* Progress Bar Track */}
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${Math.max(item.percentage, 5)}%`,
                                                    backgroundColor:
                                                        item.avgRisk >= 76
                                                            ? '#ff4d4d'
                                                            : item.avgRisk >= 41
                                                              ? '#f59e0b'
                                                              : '#00ff66',
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </PanelCard>

                    {/* Chart 3: Policy Control */}
                    <PanelCard
                        title="Policy Control"
                        subtitle="Classification ratio of monitored shadow applications"
                        action={
                            <Link href="/policy-algorithm">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs border-[rgba(34,197,94,0.5)] hover:bg-[rgba(34,197,94,0.1)]"
                                >
                                    Policy Rules
                                </Button>
                            </Link>
                        }
                    >
                        <DonutGauge
                            segments={policySegments}
                            centerLabel="Total Monitored"
                            centerValue={policyStance.total.toLocaleString()}
                            noData={policyStance.total === 0}
                        />
                    </PanelCard>

                    {/* Chart 4: Nudge Containment */}
                    <PanelCard
                        title="Nudge Containment"
                        subtitle="Employee compliance responses when presented with upload warnings"
                        action={
                            <Link href="/security-analytics/nudge-effectiveness">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs border-[rgba(34,197,94,0.5)] hover:bg-[rgba(34,197,94,0.1)]"
                                >
                                    Full Telemetry
                                </Button>
                            </Link>
                        }
                    >
                        <DonutGauge
                            segments={nudgeSegments}
                            centerLabel="Containment Rate"
                            centerValue={`${nudgeEfficacy.rate}%`}
                            noData={nudgeEfficacy.total === 0}
                        />
                    </PanelCard>
                </section>
            </div>
        </>
    );
}

ShadowAnalytics.layout = {
    breadcrumbs: [
        {
            title: 'Shadow Analytics',
            href: '/security-analytics',
        },
    ],
};
