import { Activity, Flame, Shield, Sliders } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { PaperMetricCard } from './PaperMetricCard';
import type {
    ActivityPoint,
    DomainTempData,
    HighRiskDomain,
    ReportMeta,
    Timeframe,
} from './types';

interface ReportSheetOneProps {
    widthPx: number;
    heightPx: number;
    zoomScale: number;
    cssVars: CSSProperties;
    adminEmail: string;
    reportMeta: ReportMeta;
    showExec: boolean;
    activeUsers: number;
    highRiskDomains: HighRiskDomain[];
    criticalEgressCount: number;
    nudgeSuccessRate: number;
    activeSectionsCount: number;
    showAct: boolean;
    timeframeActivity: Timeframe;
    activeActivityData: ActivityPoint[];
    maxVisitsInSeries: number;
    showDt: boolean;
    timeframeDomainTemp: Timeframe;
    activeDomainTempData: DomainTempData;
    totalPages: number;
}

export function ReportSheetOne({
    widthPx,
    heightPx,
    zoomScale,
    cssVars,
    adminEmail,
    reportMeta,
    showExec,
    activeUsers,
    highRiskDomains,
    criticalEgressCount,
    nudgeSuccessRate,
    activeSectionsCount,
    showAct,
    timeframeActivity,
    activeActivityData,
    maxVisitsInSeries,
    showDt,
    timeframeDomainTemp,
    activeDomainTempData,
    totalPages,
}: ReportSheetOneProps) {
    return (
        <div
            className="report-sheet-frame"
            style={{
                width: widthPx * zoomScale,
                height: heightPx * zoomScale,
            }}
        >
            <div
                className="printable-sheet flex flex-col justify-between rounded-md border border-slate-300 bg-white text-slate-900 shadow-[0_25px_60px_rgba(0,0,0,0.45)]"
                style={{
                    ...cssVars,
                    transform: `scale(${zoomScale})`,
                    transformOrigin: 'top left',
                }}
            >
                <div>
                    {/* Paper Header */}
                    <div className="mb-6 border-b-2 border-emerald-600 pb-6">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <img
                                    src="/apple-touch-icon.png"
                                    alt="ABLE Logo"
                                    className="h-12 w-12 rounded-xl object-contain shadow-md"
                                />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2
                                            className="text-2xl font-bold tracking-wider text-slate-900 uppercase"
                                            style={{
                                                fontFamily:
                                                    "'Unbounded', sans-serif",
                                            }}
                                        >
                                            ABLE SECURITY ANALYSIS
                                        </h2>
                                    </div>
                                    <p className="font-mono text-xs text-slate-600">
                                        Adaptive Browser-Level Extension •{' '}
                                        {adminEmail}
                                    </p>
                                </div>
                            </div>

                            <div className="text-right">
                                <span className="inline-block rounded border border-red-300 bg-red-50 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-red-700 uppercase">
                                    {reportMeta.classification}
                                </span>
                                <p className="mt-1 text-[11px] text-slate-600">
                                    Generated: {reportMeta.generatedAt}
                                </p>
                                <p className="font-mono text-[10px] text-slate-500">
                                    SYSTEM ID: ABLE-SEC-
                                    {new Date().getFullYear()}-A4
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Executive Summary Cards */}
                    {showExec && (
                        <div className="mb-6 grid grid-cols-4 gap-3">
                            <PaperMetricCard
                                label="Active Users"
                                value={activeUsers.toString()}
                                sub="Last 30 Days"
                                accent="#16a34a"
                            />
                            <PaperMetricCard
                                label="Discovered Apps"
                                value={highRiskDomains.length.toString()}
                                sub="Shadow Catalog"
                                accent="#9333ea"
                            />
                            <PaperMetricCard
                                label="Critical Egress"
                                value={criticalEgressCount.toString()}
                                sub="Risk Score ≥ 76"
                                accent="#dc2626"
                            />
                            <PaperMetricCard
                                label="Containment Rate"
                                value={`${nudgeSuccessRate}%`}
                                sub="Nudge Efficacy"
                                accent="#0284c7"
                            />
                        </div>
                    )}

                    {/* Empty State if all modules are disabled */}
                    {activeSectionsCount === 0 && (
                        <div className="my-16 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
                            <Sliders
                                size={36}
                                className="mb-3 text-slate-400"
                            />
                            <h3 className="text-sm font-bold text-slate-800">
                                No Telemetry Modules Selected
                            </h3>
                            <p className="mt-1 max-w-md text-xs text-slate-500">
                                Please enable one or more telemetry sections on
                                the left Admin Controls panel to preview and
                                print your custom report.
                            </p>
                        </div>
                    )}

                    {/* SECTION 1.1: SHADOW ACTIVITY */}
                    {showAct && (
                        <div className="paper-section mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-5 shadow-xs">
                            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                                <div className="flex items-center gap-2">
                                    <Activity
                                        size={16}
                                        className="text-cyan-700"
                                    />
                                    <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">
                                        1.1 Shadow Activity Breakdown
                                    </h3>
                                </div>
                                <span className="rounded border border-cyan-200 bg-cyan-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-800 uppercase">
                                    Granularity: {timeframeActivity}
                                </span>
                            </div>

                            {/* Chart Simulation */}
                            <div className="mb-4 flex h-36 items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 pt-6 shadow-xs">
                                {activeActivityData.map((pt, i) => {
                                    const visitHeight = Math.min(
                                        100,
                                        Math.max(
                                            8,
                                            (pt.visits / maxVisitsInSeries) *
                                                100,
                                        ),
                                    );
                                    const egressHeight = Math.min(
                                        100,
                                        Math.max(
                                            8,
                                            (pt.egress / maxVisitsInSeries) *
                                                100,
                                        ),
                                    );

                                    return (
                                        <div
                                            key={i}
                                            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                                        >
                                            <div className="flex h-full w-full items-end justify-center gap-1.5">
                                                <div
                                                    style={{
                                                        height: `${visitHeight}%`,
                                                    }}
                                                    className="w-3 rounded-t bg-cyan-600 shadow-sm transition-all"
                                                    title={`Visits: ${pt.visits}`}
                                                />
                                                <div
                                                    style={{
                                                        height: `${egressHeight}%`,
                                                    }}
                                                    className="w-3 rounded-t bg-amber-500 shadow-sm transition-all"
                                                    title={`Egress: ${pt.egress}`}
                                                />
                                            </div>
                                            <span className="max-w-full truncate font-mono text-[9px] font-medium text-slate-600">
                                                {pt.shortLabel}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Activity Legend & Data summary */}
                            <div className="grid grid-cols-3 gap-3 border-t border-slate-200 pt-3 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded bg-cyan-600" />
                                    <span className="text-slate-600">
                                        Total Visits:
                                    </span>
                                    <span className="font-bold text-slate-900">
                                        {activeActivityData
                                            .reduce(
                                                (acc, c) => acc + c.visits,
                                                0,
                                            )
                                            .toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded bg-amber-500" />
                                    <span className="text-slate-600">
                                        Total Egress:
                                    </span>
                                    <span className="font-bold text-slate-900">
                                        {activeActivityData
                                            .reduce(
                                                (acc, c) => acc + c.egress,
                                                0,
                                            )
                                            .toLocaleString()}
                                    </span>
                                </div>
                                <div className="text-right text-[11px] font-medium text-slate-500">
                                    Range:{' '}
                                    {activeActivityData[0]?.label || '—'} –{' '}
                                    {activeActivityData[
                                        activeActivityData.length - 1
                                    ]?.label || '—'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 1.2: DOMAIN TEMPERATURE */}
                    {showDt && (
                        <div className="paper-section mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-5 shadow-xs">
                            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                                <div className="flex items-center gap-2">
                                    <Flame
                                        size={16}
                                        className="text-amber-600"
                                    />
                                    <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">
                                        1.2 Domain Temperature &amp; Risk
                                        Posture
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-800 uppercase">
                                        Status:{' '}
                                        {activeDomainTempData.temperatureIndex}{' '}
                                        Temperature
                                    </span>
                                    <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 uppercase">
                                        {timeframeDomainTemp}
                                    </span>
                                </div>
                            </div>

                            <div className="mb-4 grid grid-cols-3 gap-4">
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                                    <span className="text-[10px] font-semibold text-emerald-800 uppercase">
                                        Safe Domains
                                    </span>
                                    <p className="mt-1 text-xl font-bold text-emerald-950">
                                        {activeDomainTempData.safe}
                                    </p>
                                    <p className="text-[10px] text-emerald-700">
                                        {activeDomainTempData.safePct}% of
                                        catalog
                                    </p>
                                </div>
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                                    <span className="text-[10px] font-semibold text-amber-800 uppercase">
                                        Unlisted Domains
                                    </span>
                                    <p className="mt-1 text-xl font-bold text-amber-950">
                                        {activeDomainTempData.unlisted}
                                    </p>
                                    <p className="text-[10px] text-amber-700">
                                        {activeDomainTempData.unlistedPct}% of
                                        catalog
                                    </p>
                                </div>
                                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center">
                                    <span className="text-[10px] font-semibold text-rose-800 uppercase">
                                        Unsafe / Blacklisted
                                    </span>
                                    <p className="mt-1 text-xl font-bold text-rose-950">
                                        {activeDomainTempData.unsafe}
                                    </p>
                                    <p className="text-[10px] text-rose-700">
                                        {activeDomainTempData.unsafePct}% of
                                        catalog
                                    </p>
                                </div>
                            </div>

                            {/* Top Categories Risk Distribution */}
                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                                <h4 className="mb-2 text-[11px] font-bold text-slate-700 uppercase">
                                    Top Cloud Categories Risk Distribution
                                </h4>
                                <div className="space-y-2">
                                    {activeDomainTempData.categories.map(
                                        (cat, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-3 text-xs"
                                            >
                                                <span className="w-32 truncate font-medium text-slate-800">
                                                    {cat.category}
                                                </span>
                                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        style={{
                                                            width: `${Math.max(5, cat.percentage)}%`,
                                                        }}
                                                        className={cn(
                                                            'h-full rounded-full',
                                                            cat.avgRisk >= 75
                                                                ? 'bg-rose-500'
                                                                : cat.avgRisk >=
                                                                    45
                                                                  ? 'bg-amber-500'
                                                                  : 'bg-emerald-500',
                                                        )}
                                                    />
                                                </div>
                                                <span className="w-16 text-right font-mono text-[11px] text-slate-600">
                                                    {cat.count} (
                                                    {cat.percentage}%)
                                                </span>
                                                <span
                                                    className={cn(
                                                        'w-14 rounded px-1 text-center text-[10px] font-bold',
                                                        cat.avgRisk >= 75
                                                            ? 'border border-rose-200 bg-rose-100 text-rose-800'
                                                            : cat.avgRisk >= 45
                                                              ? 'border border-amber-200 bg-amber-100 text-amber-800'
                                                              : 'border border-emerald-200 bg-emerald-100 text-emerald-800',
                                                    )}
                                                >
                                                    Risk {cat.avgRisk}
                                                </span>
                                            </div>
                                        ),
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Paper Document Footer for Sheet 1 */}
                <div className="mt-8 flex flex-row items-center justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                        <Shield size={14} className="text-emerald-600" />
                        <span className="font-mono text-[11px]">
                            ABLE Network Security • Confidential Document
                        </span>
                    </div>

                    <div className="flex items-center gap-6">
                        {totalPages === 1 && (
                            <div className="text-right font-mono text-[10px] text-slate-500">
                                <span>SIGN-OFF: ___________________</span>
                            </div>
                        )}
                        <div className="font-mono text-[11px] text-slate-500">
                            PAGE 1 OF {totalPages}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
