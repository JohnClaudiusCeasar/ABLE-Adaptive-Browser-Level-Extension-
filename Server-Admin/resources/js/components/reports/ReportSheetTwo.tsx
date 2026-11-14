import { CheckCircle2, Ghost, Shield, ShieldAlert } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type {
    ContainmentData,
    HighRiskDomain,
    IncidentEvent,
    ReportMeta,
    Timeframe,
} from './types';

interface ReportSheetTwoProps {
    widthPx: number;
    heightPx: number;
    zoomScale: number;
    cssVars: CSSProperties;
    reportMeta: ReportMeta;
    totalPages: number;
    showInc: boolean;
    timeframeIncidents: Timeframe;
    activeIncidentsTotal: number;
    activeIncidentsData: IncidentEvent[];
    showCnt: boolean;
    timeframeContainment: Timeframe;
    activeContainmentData: ContainmentData;
    showHr: boolean;
    filteredHighRiskDomains: HighRiskDomain[];
    minRiskScore: number;
}

export function ReportSheetTwo({
    widthPx,
    heightPx,
    zoomScale,
    cssVars,
    reportMeta,
    totalPages,
    showInc,
    timeframeIncidents,
    activeIncidentsTotal,
    activeIncidentsData,
    showCnt,
    timeframeContainment,
    activeContainmentData,
    showHr,
    filteredHighRiskDomains,
    minRiskScore,
}: ReportSheetTwoProps) {
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
                    {/* Continuation Header */}
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
                                        Incident, Containment &amp; High Risk
                                        Domain Telemetry
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
                                    PAGE {totalPages === 2 ? '2 OF 2' : '1 OF 1'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 1.3: SHADOW INCIDENTS */}
                    {showInc && (
                        <div className="paper-section mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-5 shadow-xs">
                            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert
                                        size={16}
                                        className="text-rose-600"
                                    />
                                    <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">
                                        1.3 Shadow Incidents &amp; Egress
                                        Violations
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase">
                                        {activeIncidentsTotal} Recent Incidents
                                    </span>
                                    <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 uppercase">
                                        {timeframeIncidents}
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] tracking-wider text-slate-600 uppercase">
                                            <th className="px-3 py-2.5">
                                                Date / Time
                                            </th>
                                            <th className="px-3 py-2.5">
                                                Target Domain
                                            </th>
                                            <th className="px-3 py-2.5">
                                                User ID
                                            </th>
                                            <th className="px-3 py-2.5">
                                                File / Payload
                                            </th>
                                            <th className="px-3 py-2.5">
                                                Risk
                                            </th>
                                            <th className="px-3 py-2.5">
                                                Outcome
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {activeIncidentsData.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    className="py-4 text-center text-slate-500 italic"
                                                >
                                                    No critical egress incidents
                                                    recorded in this timeframe.
                                                </td>
                                            </tr>
                                        ) : (
                                            activeIncidentsData
                                                .slice(0, 8)
                                                .map((inc) => (
                                                    <tr
                                                        key={inc.id}
                                                        className="hover:bg-slate-50"
                                                    >
                                                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                                                            {inc.dateFormatted}
                                                        </td>
                                                        <td className="max-w-[150px] truncate px-3 py-2 font-medium text-slate-900">
                                                            {inc.domain}
                                                        </td>
                                                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                                                            {inc.user || '—'}
                                                        </td>
                                                        <td
                                                            className="max-w-[140px] truncate px-3 py-2 text-slate-700"
                                                            title={inc.fileName}
                                                        >
                                                            {inc.fileName} (
                                                            {inc.fileSize})
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span
                                                                className={cn(
                                                                    'rounded px-1.5 py-0.5 text-[10px] font-bold',
                                                                    inc.risk_score >=
                                                                        76
                                                                        ? 'border border-rose-200 bg-rose-100 text-rose-800'
                                                                        : 'border border-amber-200 bg-amber-100 text-amber-800',
                                                                )}
                                                            >
                                                                {inc.risk_score}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span
                                                                className={cn(
                                                                    'rounded px-2 py-0.5 text-[10px] font-semibold uppercase',
                                                                    inc.action.toLowerCase() ===
                                                                        'denied'
                                                                        ? 'border border-emerald-200 bg-emerald-100 text-emerald-800'
                                                                        : 'border border-rose-200 bg-rose-100 text-rose-800',
                                                                )}
                                                            >
                                                                {inc.action}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* SECTION 1.4: CONTAINMENT TEMPERATURE */}
                    {showCnt && (
                        <div className="paper-section mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-5 shadow-xs">
                            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2
                                        size={16}
                                        className="text-emerald-600"
                                    />
                                    <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">
                                        1.4 Containment Temperature &amp; Data
                                        Safeguards
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                                        {activeContainmentData.statusLabel}
                                    </span>
                                    <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 uppercase">
                                        {timeframeContainment}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Containment Rate Progress */}
                                <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                                    <div>
                                        <div className="mb-1.5 flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-800">
                                                Interception Containment Rate
                                            </span>
                                            <span className="font-mono text-lg font-bold text-emerald-700">
                                                {
                                                    activeContainmentData.containmentRate
                                                }
                                                %
                                            </span>
                                        </div>
                                        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                                            <div
                                                style={{
                                                    width: `${activeContainmentData.containmentRate}%`,
                                                }}
                                                className="h-full bg-emerald-500 shadow-sm"
                                            />
                                            <div
                                                style={{
                                                    width: `${100 - activeContainmentData.containmentRate}%`,
                                                }}
                                                className="h-full bg-rose-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[11px]">
                                        <div>
                                            <span className="block text-slate-500">
                                                Nudges Cancelled:
                                            </span>
                                            <span className="font-mono font-bold text-emerald-700">
                                                {activeContainmentData.cancelled.toLocaleString()}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500">
                                                User Proceeded:
                                            </span>
                                            <span className="font-mono font-bold text-rose-700">
                                                {activeContainmentData.proceeded.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Data Protection Volume */}
                                <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                                    <div>
                                        <span className="mb-2 block text-xs font-semibold text-slate-800">
                                            Exfiltration Data Protection Volume
                                        </span>
                                        <div className="mt-1 grid grid-cols-2 gap-3">
                                            <div className="rounded border border-emerald-200 bg-emerald-50 p-2.5 text-center">
                                                <span className="text-[10px] font-bold text-emerald-800 uppercase">
                                                    Data Saved
                                                </span>
                                                <p className="mt-0.5 font-mono text-base font-bold text-emerald-700">
                                                    {
                                                        activeContainmentData.dataSaved
                                                    }
                                                </p>
                                            </div>
                                            <div className="rounded border border-rose-200 bg-rose-50 p-2.5 text-center">
                                                <span className="text-[10px] font-bold text-rose-800 uppercase">
                                                    Data Lost
                                                </span>
                                                <p className="mt-0.5 font-mono text-base font-bold text-rose-700">
                                                    {
                                                        activeContainmentData.dataLost
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-center text-[10px] text-slate-500">
                                        Telemetry calculated from browser file
                                        upload intercept actions.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 1.5: HIGH RISK DOMAINS */}
                    {showHr && (
                        <div className="paper-section mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-5 shadow-xs">
                            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                                <div className="flex items-center gap-2">
                                    <Ghost
                                        size={16}
                                        className="text-purple-700"
                                    />
                                    <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">
                                        1.5 High Risk Shadow Domains Catalog
                                    </h3>
                                </div>
                                <span className="rounded border border-purple-200 bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 uppercase">
                                    Showing Top {filteredHighRiskDomains.length}{' '}
                                    Domains (Score ≥ {minRiskScore})
                                </span>
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] tracking-wider text-slate-600 uppercase">
                                            <th className="px-3 py-2.5">
                                                Domain
                                            </th>
                                            <th className="px-3 py-2.5">
                                                Category
                                            </th>
                                            <th className="px-3 py-2.5">
                                                Policy
                                            </th>
                                            <th className="px-3 py-2.5">
                                                Adopters
                                            </th>
                                            <th className="px-3 py-2.5">
                                                Visits
                                            </th>
                                            <th className="px-3 py-2.5 text-right">
                                                Risk Score
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {filteredHighRiskDomains.length ===
                                        0 ? (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    className="py-4 text-center text-slate-500 italic"
                                                >
                                                    No domains match risk score
                                                    threshold ≥ {minRiskScore}.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredHighRiskDomains.map(
                                                (item) => (
                                                    <tr
                                                        key={item.id}
                                                        className="hover:bg-slate-50"
                                                    >
                                                        <td className="px-3 py-2 font-mono font-medium text-slate-900">
                                                            {item.domain}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-600">
                                                            {item.category}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span
                                                                className={cn(
                                                                    'rounded px-2 py-0.5 text-[10px] font-semibold uppercase',
                                                                    item.policy ===
                                                                        'whitelisted'
                                                                        ? 'border border-emerald-200 bg-emerald-100 text-emerald-800'
                                                                        : item.policy ===
                                                                            'blacklisted'
                                                                          ? 'border border-rose-200 bg-rose-100 text-rose-800'
                                                                          : 'border border-amber-200 bg-amber-100 text-amber-800',
                                                                )}
                                                            >
                                                                {item.policy.replace(
                                                                    '_',
                                                                    ' ',
                                                                )}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 font-mono text-slate-700">
                                                            {item.active_users}
                                                        </td>
                                                        <td className="px-3 py-2 font-mono text-slate-700">
                                                            {item.visit_count}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <span
                                                                className={cn(
                                                                    'rounded px-2 py-0.5 font-mono text-[11px] font-bold',
                                                                    item.risk_score >=
                                                                        76
                                                                        ? 'border border-rose-300 bg-rose-100 text-rose-800'
                                                                        : 'border border-amber-300 bg-amber-100 text-amber-800',
                                                                )}
                                                            >
                                                                {
                                                                    item.risk_score
                                                                }{' '}
                                                                / 100
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ),
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Paper Document Footer for Sheet 2 */}
                <div className="mt-8 flex flex-row items-center justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                        <Shield size={14} className="text-emerald-600" />
                        <span className="font-mono text-[11px]">
                            ABLE Network Security • Confidential Document
                        </span>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right font-mono text-[10px] text-slate-500">
                            <span>SIGN-OFF: ___________________</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                            PAGE {totalPages === 2 ? '2 OF 2' : '1 OF 1'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
