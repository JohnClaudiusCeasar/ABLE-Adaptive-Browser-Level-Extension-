import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowUpFromLine,
    CalendarDays,
    Check,
    Copy,
    Gauge,
    Globe,
    ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import {
    index,
    telemetry,
} from '@/actions/App/Http/Controllers/Users/ClientUserController';
import { ActivityTrendChart } from '@/components/dashboard/activity-trend-chart';
import { PanelCard } from '@/components/dashboard/panel-card';
import { StatCard } from '@/components/dashboard/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface Profile {
    user_id: string;
    client_name: string;
    registered_at: string | null;
    last_active_at: string | null;
    status: 'active' | 'inactive' | 'uninstalled';
    version: string;
    total_visits: number;
    total_egress: number;
}

interface DailyRow {
    date: string;
    day: string;
    label: string;
    visits: number;
    visits_safe: number;
    visits_unsafe: number;
    visits_unlisted: number;
    distinct_domains: number;
    egress: number;
    egress_denied: number;
    egress_proceeded: number;
    egress_allowed: number;
    egress_blocked: number;
    avg_risk: number | null;
    max_risk: number | null;
    nudges_cancelled: number;
    nudges_proceeded: number;
}

interface TopDomain {
    domain: string;
    visits: number;
    egress: number;
    avg_risk: number | null;
}

interface RecentVisit {
    domain: string;
    visited_at: string;
    status: string | null;
}

interface RecentEgress {
    domain: string;
    file_name: string | null;
    action: string;
    risk_score: number;
    occurred_at: string;
}

interface CategoryDistItem {
    category: string;
    count: number;
    percentage: number;
    avgRisk: number;
}

interface ClientShowProps {
    profile: Profile;
    summary: {
        visits: number;
        distinct_domains: number;
        egress: number;
        active_days: number;
    };
    daily_series: DailyRow[];
    top_domains: TopDomain[];
    risk_breakdown: {
        avg_risk: number | null;
        max_risk: number | null;
        high_risk_egress_count: number;
    };
    recent_visits: RecentVisit[];
    recent_egress: RecentEgress[];
    category_distribution: CategoryDistItem[];
    date_from: string;
    date_to: string;
}

function formatTimestamp(ts: string | null): string {
    if (!ts) {
        return '—';
    }

    const d = new Date(ts);

    if (isNaN(d.getTime())) {
        return ts;
    }

    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function formatShortDate(ts: string): string {
    const d = new Date(ts);

    if (isNaN(d.getTime())) {
        return ts;
    }

    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function blockedCount(d: DailyRow): number {
    return d.egress_denied + d.egress_blocked;
}

function riskTone(risk: number | null): string {
    if (risk === null) {
        return 'bg-black/5 text-muted-foreground dark:bg-white/5';
    }

    if (risk >= 70) {
        return 'bg-rose-500/10 text-rose-500 dark:text-rose-400';
    }

    if (risk >= 31) {
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    }

    return 'bg-able-green/15 text-able-green';
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

function applyRange(userId: string, from: string, to: string) {
    router.get(
        telemetry.url(userId),
        { date_from: from, date_to: to },
        { preserveState: true },
    );
}

export default function ClientTelemetryPage({
    profile,
    summary,
    daily_series = [],
    top_domains = [],
    risk_breakdown,
    recent_visits = [],
    recent_egress = [],
    category_distribution = [],
    date_from,
    date_to,
}: ClientShowProps) {
    const [copied, setCopied] = useState(false);
    const [from, setFrom] = useState(date_from);
    const [to, setTo] = useState(date_to);

    const copyId = () => {
        navigator.clipboard.writeText(profile.user_id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const setPreset = (days: number) => {
        const end = new Date(date_to);
        const start = new Date(end);
        start.setDate(start.getDate() - (days - 1));
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        setFrom(fmt(start));
        setTo(fmt(end));
        applyRange(profile.user_id, fmt(start), fmt(end));
    };

    const rangeDays = Math.max(
        1,
        Math.round(
            (new Date(date_to).getTime() - new Date(date_from).getTime()) /
                86400000,
        ) + 1,
    );

    const statusColor =
        profile.status === 'active'
            ? 'bg-able-green/15 text-able-green'
            : profile.status === 'uninstalled'
              ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400';

    const totals = daily_series.reduce(
        (acc, d) => ({
            visits: acc.visits + d.visits,
            unsafe: acc.unsafe + d.visits_unsafe,
            egress: acc.egress + d.egress,
            blocked: acc.blocked + blockedCount(d),
            prevented: acc.prevented + d.nudges_cancelled,
        }),
        { visits: 0, unsafe: 0, egress: 0, blocked: 0, prevented: 0 },
    );
    const overallBlockedRate =
        totals.egress > 0
            ? Math.round((totals.blocked / totals.egress) * 100)
            : null;

    return (
        <>
            <Head title={`Telemetry — ${profile.user_id}`} />

            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                <Link
                    href={index.url()}
                    className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft size={15} />
                    Back to Able clients
                </Link>

                <header className="mb-8">
                    <h1
                        className="mb-2.5 text-[2.8rem] font-bold tracking-wide text-foreground uppercase"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Client Telemetry
                    </h1>
                    <div className="flex flex-wrap items-center gap-3">
                        <code className="font-mono text-sm font-semibold break-all text-foreground">
                            {profile.user_id}
                        </code>
                        <button
                            onClick={copyId}
                            title="Copy sanitized ID"
                            className="rounded p-1.5 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                        >
                            {copied ? (
                                <Check size={16} className="text-able-green" />
                            ) : (
                                <Copy size={16} />
                            )}
                        </button>
                        <Badge className={statusColor}>{profile.status}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                            {profile.version}
                        </span>
                    </div>
                    <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-[0.9rem]">
                        <div className="flex gap-2">
                            <dt className="text-muted-foreground">
                                Registered
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {formatTimestamp(profile.registered_at)}
                            </dd>
                        </div>
                        <div className="flex gap-2">
                            <dt className="text-muted-foreground">
                                Last active
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {formatTimestamp(profile.last_active_at)}
                            </dd>
                        </div>
                        <div className="flex gap-2">
                            <dt className="text-muted-foreground">Lifetime</dt>
                            <dd className="font-medium tabular-nums">
                                {profile.total_visits.toLocaleString()} visits ·{' '}
                                {profile.total_egress.toLocaleString()} egress
                            </dd>
                        </div>
                    </dl>
                </header>

                <div className={`${glassCard} mb-5 p-5`}>
                    <div className="mb-4">
                        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground uppercase">
                            <CalendarDays
                                size={15}
                                className="text-muted-foreground"
                            />
                            Activity time range
                        </h2>
                        <p className="mt-1 text-[0.85rem] text-muted-foreground">
                            Pick the dates you want to review — everything
                            below updates to match the window you choose.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <input
                            type="date"
                            value={from}
                            max={to}
                            onChange={(e) => setFrom(e.target.value)}
                            className="rounded-full border border-black/10 bg-black/5 px-3.5 py-2 text-[0.85rem] outline-none dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                        />
                        <span className="text-sm text-muted-foreground">to</span>
                        <input
                            type="date"
                            value={to}
                            min={from}
                            onChange={(e) => setTo(e.target.value)}
                            className="rounded-full border border-black/10 bg-black/5 px-3.5 py-2 text-[0.85rem] outline-none dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                        />
                        <Button
                            size="sm"
                            onClick={() => applyRange(profile.user_id, from, to)}
                        >
                            Apply
                        </Button>
                        <div className="flex items-center gap-2">
                            {[7, 30, 90].map((days) => (
                                <button
                                    key={days}
                                    onClick={() => setPreset(days)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                        rangeDays === days
                                            ? 'bg-able-green/20 text-able-green'
                                            : 'bg-black/5 text-muted-foreground hover:bg-black/10 dark:bg-white/5'
                                    }`}
                                >
                                    {days}d
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Domain visits"
                        value={summary.visits}
                        icon={Globe}
                        accent="text-sky-400"
                        underline="bg-sky-400"
                        subtitle={`${summary.distinct_domains.toLocaleString()} domains · ${summary.active_days} active days`}
                    />
                    <StatCard
                        label="Egress attempts"
                        value={summary.egress}
                        icon={ArrowUpFromLine}
                        accent="text-rose-400"
                        underline="bg-rose-400"
                        subtitle={
                            overallBlockedRate === null
                                ? 'No egress in range'
                                : `${totals.blocked.toLocaleString()} blocked · ${overallBlockedRate}% stop rate`
                        }
                    />
                    <StatCard
                        label="Nudges prevented loss"
                        value={totals.prevented}
                        icon={ShieldCheck}
                        accent="text-able-green"
                        underline="bg-able-green"
                        subtitle={
                            totals.egress > 0
                                ? `${totals.prevented.toLocaleString()} cancellations in range`
                                : 'No nudges in range'
                        }
                    />
                    <StatCard
                        label="Average risk"
                        value={risk_breakdown.avg_risk ?? '—'}
                        icon={Gauge}
                        accent="text-amber-400"
                        underline="bg-amber-400"
                        subtitle={
                            risk_breakdown.max_risk === null
                                ? 'No scored egress in range'
                                : `Peak ${risk_breakdown.max_risk} · ${risk_breakdown.high_risk_egress_count} high-risk`
                        }
                    />
                </div>

                <PanelCard
                    title="Shadow Activity Timeline"
                    subtitle={`Domain visits and egress attempts, ${date_from} → ${date_to}`}
                    className="mb-5"
                >
                    <ActivityTrendChart data={daily_series} />
                </PanelCard>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <PanelCard
                        title="Top Domains"
                        subtitle="Most visited in range"
                        className="flex h-[500px] flex-col"
                    >
                        {top_domains.length === 0 ? (
                            <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                                No activity in this range.
                            </p>
                        ) : (
                            <div className="min-h-0 flex-1 overflow-auto">
                                <table className="w-full border-collapse text-[0.85rem]">
                                    <thead>
                                        <tr className="text-muted-foreground">
                                            <th className="w-8 border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                                #
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                                Domain
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                                Visits
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                                Egress
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.7)] pb-4 text-right font-medium">
                                                Risk
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {top_domains.map((t, rank) => (
                                            <tr
                                                key={t.domain}
                                                className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                            >
                                                <td className="py-2.5 pr-2.5 text-muted-foreground tabular-nums">
                                                    {rank + 1}
                                                </td>
                                                <td className="max-w-[200px] py-2.5 pr-2.5">
                                                    <span className="block truncate font-mono">
                                                        {t.domain}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 pr-2.5 tabular-nums">
                                                    {t.visits.toLocaleString()}
                                                </td>
                                                <td className="py-2.5 pr-2.5 tabular-nums">
                                                    {t.egress.toLocaleString()}
                                                </td>
                                                <td className="py-2.5 text-right">
                                                    <Badge
                                                        className={riskTone(
                                                            t.avg_risk,
                                                        )}
                                                    >
                                                        {t.avg_risk === null
                                                            ? 'unscored'
                                                            : `avg ${t.avg_risk}`}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </PanelCard>

                    <PanelCard
                        title="Category Breakdown"
                        subtitle="Discovered applications grouped by risk category & average threat weight"
                        className="flex h-[500px] flex-col"
                        action={
                            <Link
                                href={`/security-analytics/shadow-apps?user_id=${encodeURIComponent(profile.user_id)}`}
                            >
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-[rgba(34,197,94,0.5)] px-2.5 text-xs hover:bg-[rgba(34,197,94,0.1)]"
                                >
                                    View Catalog
                                </Button>
                            </Link>
                        }
                    >
                        {category_distribution.length === 0 ? (
                            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground italic">
                                No categorized applications found yet.
                            </div>
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto py-1">
                                {category_distribution.map((item) => (
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
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <PanelCard
                        title="Recent Visits"
                        subtitle={`Latest ${recent_visits.length} in range`}
                    >
                        {recent_visits.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                No activity in this range.
                            </p>
                        ) : (
                            <table className="w-full border-collapse text-[0.85rem]">
                                <thead>
                                    <tr className="text-muted-foreground">
                                        <th className="w-8 border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                            #
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                            Date and Time
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                            Domain Name
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pb-4 text-right font-medium">
                                            Policy
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recent_visits.map((v, i) => (
                                        <tr
                                            key={`${v.domain}-${v.visited_at}-${i}`}
                                            className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                        >
                                            <td className="py-2.5 pr-2.5 text-muted-foreground tabular-nums">
                                                {i + 1}
                                            </td>
                                            <td className="py-2.5 pr-2.5 whitespace-nowrap text-muted-foreground tabular-nums">
                                                {formatShortDate(v.visited_at)}
                                            </td>
                                            <td className="max-w-[200px] py-2.5 pr-2.5">
                                                <span className="block truncate font-mono">
                                                    {v.domain}
                                                </span>
                                            </td>
                                            <td className="py-2.5 text-right">
                                                <Badge
                                                    className={
                                                        v.status === 'safe'
                                                            ? 'bg-able-green/15 text-able-green'
                                                            : v.status ===
                                                                'unsafe'
                                                              ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400'
                                                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                    }
                                                >
                                                    {v.status === 'safe'
                                                        ? 'safe'
                                                        : v.status === 'unsafe'
                                                          ? 'unsafe'
                                                          : 'new domain'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </PanelCard>

                    <PanelCard
                        title="Recent Egress"
                        subtitle={`Latest ${recent_egress.length} in range`}
                    >
                        {recent_egress.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                No activity in this range.
                            </p>
                        ) : (
                            <div className="max-h-[320px] overflow-auto">
                                <table className="w-full border-collapse text-[0.85rem]">
                                    <thead>
                                        <tr className="text-muted-foreground">
                                            <th className="w-8 border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                                #
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                                Domain
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                                Outcome
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.7)] pb-4 text-right font-medium">
                                                Risk
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recent_egress.map((e, i) => (
                                            <tr
                                                key={`${e.domain}-${e.occurred_at}-${i}`}
                                                className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                            >
                                                <td className="py-2.5 pr-2.5 text-muted-foreground tabular-nums">
                                                    {i + 1}
                                                </td>
                                                <td className="max-w-[200px] py-2.5 pr-2.5">
                                                    <span className="block truncate font-mono">
                                                        {e.domain}
                                                    </span>
                                                    <span className="block max-w-[200px] truncate text-[11px] text-muted-foreground">
                                                        {e.file_name ?? '—'} ·{' '}
                                                        {formatShortDate(
                                                            e.occurred_at,
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 pr-2.5">
                                                    <Badge
                                                        className={
                                                            e.action ===
                                                                'denied' ||
                                                            e.action ===
                                                                'blocked'
                                                                ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400'
                                                                : 'bg-able-green/15 text-able-green'
                                                        }
                                                    >
                                                        {e.action ===
                                                            'denied' ||
                                                        e.action === 'blocked'
                                                            ? 'blocked'
                                                            : 'released'}
                                                    </Badge>
                                                </td>
                                                <td className="py-2.5 text-right">
                                                    <Badge
                                                        className={riskTone(
                                                            e.risk_score,
                                                        )}
                                                    >
                                                        {e.risk_score}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </PanelCard>
                </div>
            </div>
        </>
    );
}

ClientTelemetryPage.layout = {
    breadcrumbs: [
        { title: 'Users', href: '/users/client' },
        { title: 'Client', href: '/users/client' },
        { title: 'Client Telemetry', href: '#' },
    ],
};
