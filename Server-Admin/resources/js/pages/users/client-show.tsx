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

interface Lifecycle {
    event: string;
    version: string | null;
    occurred_at: string;
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
    lifecycles: Lifecycle[];
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

function blockedRate(d: DailyRow): number | null {
    if (d.egress === 0) {
        return null;
    }

    return Math.round((blockedCount(d) / d.egress) * 100);
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

function RateBar({ rate }: { rate: number | null }) {
    if (rate === null) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <span className="inline-flex min-w-[110px] items-center gap-2">
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <span
                    className="block h-full rounded-full bg-able-green"
                    style={{ width: `${rate}%` }}
                />
            </span>
            <span className="tabular-nums">{rate}%</span>
        </span>
    );
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
    lifecycles = [],
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
    const maxVisits = Math.max(...top_domains.map((t) => t.visits), 1);

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

                <div
                    className={`${glassCard} mb-5 flex flex-wrap items-center gap-3 p-5`}
                >
                    <CalendarDays size={16} className="text-muted-foreground" />
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
                    title="Daily Web Activity"
                    subtitle={`Domain visits and egress attempts, ${date_from} → ${date_to}`}
                    className="mb-5"
                >
                    <ActivityTrendChart data={daily_series} />
                </PanelCard>

                <PanelCard
                    title="Daily Breakdown"
                    subtitle="Visits by classification, egress outcomes, and nudges per day"
                    className="mb-5"
                >
                    {daily_series.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No activity in this range.
                        </p>
                    ) : (
                        <div className="max-h-[400px] overflow-auto">
                            <table className="w-full border-collapse text-[0.85rem]">
                                <thead className="sticky top-0 bg-background">
                                    <tr className="text-muted-foreground">
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                            Date
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                            Visits
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                            Classification
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                            Egress
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                            Stop rate
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                            Avg risk
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pb-4 text-right font-medium">
                                            Nudges
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {daily_series.map((d) => (
                                        <tr
                                            key={d.date}
                                            className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                        >
                                            <td className="py-2.5 pr-2.5 font-medium whitespace-nowrap tabular-nums">
                                                {d.label}
                                            </td>
                                            <td className="py-2.5 pr-2.5 font-semibold tabular-nums">
                                                {d.visits.toLocaleString()}
                                                <span className="ml-1.5 font-normal text-muted-foreground">
                                                    {d.distinct_domains} sites
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-2.5">
                                                <span className="inline-flex flex-wrap gap-1 text-[11px] tabular-nums">
                                                    <span className="rounded-full bg-able-green/15 px-2 py-0.5 text-able-green">
                                                        {d.visits_safe} safe
                                                    </span>
                                                    {d.visits_unsafe > 0 && (
                                                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-500 dark:text-rose-400">
                                                            {d.visits_unsafe}{' '}
                                                            unsafe
                                                        </span>
                                                    )}
                                                    {d.visits_unlisted > 0 && (
                                                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-400">
                                                            {d.visits_unlisted}{' '}
                                                            new
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-2.5 tabular-nums">
                                                <span className="font-semibold">
                                                    {d.egress.toLocaleString()}
                                                </span>{' '}
                                                <span className="text-[11px] text-muted-foreground">
                                                    {blockedCount(d)} blocked ·{' '}
                                                    {d.egress_proceeded}{' '}
                                                    released
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-2.5 tabular-nums">
                                                <RateBar
                                                    rate={blockedRate(d)}
                                                />
                                            </td>
                                            <td className="py-2.5 pr-2.5 tabular-nums">
                                                {d.avg_risk === null ? (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                ) : (
                                                    <>
                                                        <span className="font-semibold">
                                                            {d.avg_risk}
                                                        </span>
                                                        {d.max_risk !==
                                                            null && (
                                                            <span className="ml-1 text-[11px] text-muted-foreground">
                                                                peak{' '}
                                                                {d.max_risk}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                            <td className="py-2.5 text-right tabular-nums">
                                                {d.nudges_cancelled === 0 &&
                                                d.nudges_proceeded === 0 ? (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                ) : (
                                                    <>
                                                        <span className="font-semibold text-able-green">
                                                            {d.nudges_cancelled}{' '}
                                                            prevented
                                                        </span>{' '}
                                                        {d.nudges_proceeded >
                                                            0 && (
                                                            <span className="text-[11px] text-muted-foreground">
                                                                {
                                                                    d.nudges_proceeded
                                                                }{' '}
                                                                released
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </PanelCard>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <PanelCard
                        title="Top Domains"
                        subtitle="Most visited in range"
                    >
                        {top_domains.length === 0 ? (
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
                                            Domain
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                            Visits
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
                                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                                    {t.egress.toLocaleString()}{' '}
                                                    egress
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-2.5">
                                                <span className="flex items-center gap-2 tabular-nums">
                                                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                                                        <span
                                                            className="block h-full rounded-full bg-sky-400"
                                                            style={{
                                                                width: `${Math.round((t.visits / maxVisits) * 100)}%`,
                                                            }}
                                                        />
                                                    </span>
                                                    {t.visits.toLocaleString()}
                                                </span>
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
                        )}
                    </PanelCard>

                    <PanelCard
                        title="Lifecycle"
                        subtitle="Extension install and update history"
                    >
                        {lifecycles.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                No lifecycle events recorded.
                            </p>
                        ) : (
                            <ul className="flex max-h-[320px] flex-col gap-2.5 overflow-auto">
                                {lifecycles.map((l, i) => (
                                    <li
                                        key={`${l.event}-${l.occurred_at}-${i}`}
                                        className="flex items-center justify-between gap-2 text-[0.85rem]"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Badge
                                                className={
                                                    l.event === 'uninstalled'
                                                        ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400'
                                                        : l.event ===
                                                            'installed'
                                                          ? 'bg-able-green/15 text-able-green'
                                                          : 'bg-sky-500/10 text-sky-500 dark:text-sky-400'
                                                }
                                            >
                                                {l.event}
                                            </Badge>
                                            <span className="font-mono text-xs text-muted-foreground">
                                                {l.version ?? '—'}
                                            </span>
                                        </span>
                                        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                                            {formatTimestamp(l.occurred_at)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
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
                            <div className="max-h-[320px] overflow-auto">
                                <table className="w-full border-collapse text-[0.85rem]">
                                    <thead className="sticky top-0 bg-background">
                                        <tr className="text-muted-foreground">
                                            <th className="border-b border-[rgba(34,197,94,0.3)] pr-2.5 pb-2.5 text-left text-xs font-medium">
                                                Domain
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.3)] pr-2.5 pb-2.5 text-left text-xs font-medium">
                                                Verdict
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.3)] pb-2.5 text-right text-xs font-medium">
                                                Time
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recent_visits.map((v, i) => (
                                            <tr
                                                key={`${v.domain}-${v.visited_at}-${i}`}
                                                className="border-b border-[rgba(34,197,94,0.15)] last:border-b-0"
                                            >
                                                <td className="max-w-[200px] truncate py-2 pr-2.5 font-mono">
                                                    {v.domain}
                                                </td>
                                                <td className="py-2 pr-2.5">
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
                                                            : v.status ===
                                                                'unsafe'
                                                              ? 'unsafe'
                                                              : 'new domain'}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                                                    {formatShortDate(
                                                        v.visited_at,
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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
                                    <thead className="sticky top-0 bg-background">
                                        <tr className="text-muted-foreground">
                                            <th className="border-b border-[rgba(34,197,94,0.3)] pr-2.5 pb-2.5 text-left text-xs font-medium">
                                                Domain
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.3)] pr-2.5 pb-2.5 text-left text-xs font-medium">
                                                Outcome
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.3)] pb-2.5 text-right text-xs font-medium">
                                                Risk
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recent_egress.map((e, i) => (
                                            <tr
                                                key={`${e.domain}-${e.occurred_at}-${i}`}
                                                className="border-b border-[rgba(34,197,94,0.15)] last:border-b-0"
                                            >
                                                <td className="max-w-[180px] py-2 pr-2.5">
                                                    <span className="block truncate font-mono">
                                                        {e.domain}
                                                    </span>
                                                    <span className="block max-w-[180px] truncate text-[11px] text-muted-foreground">
                                                        {e.file_name ?? '—'} ·{' '}
                                                        {formatShortDate(
                                                            e.occurred_at,
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-2.5">
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
                                                <td className="py-2 text-right">
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
