import {
    Activity,
    CheckCircle2,
    Flame,
    Ghost,
    ShieldAlert,
    Sliders,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Orientation, PaperSize } from '@/lib/report-print';
import { cn } from '@/lib/utils';
import { ControlModuleCard } from './ControlModuleCard';
import type { Timeframe } from './types';

interface ReportControlsSidebarProps {
    activeSectionsCount: number;
    totalPages: number;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    enableShadowActivity: boolean;
    setEnableShadowActivity: (v: boolean) => void;
    timeframeActivity: Timeframe;
    setTimeframeActivity: (tf: Timeframe) => void;
    enableDomainTemperature: boolean;
    setEnableDomainTemperature: (v: boolean) => void;
    timeframeDomainTemp: Timeframe;
    setTimeframeDomainTemp: (tf: Timeframe) => void;
    enableShadowIncidents: boolean;
    setEnableShadowIncidents: (v: boolean) => void;
    timeframeIncidents: Timeframe;
    setTimeframeIncidents: (tf: Timeframe) => void;
    enableContainmentTemp: boolean;
    setEnableContainmentTemp: (v: boolean) => void;
    timeframeContainment: Timeframe;
    setTimeframeContainment: (tf: Timeframe) => void;
    enableHighRiskDomains: boolean;
    setEnableHighRiskDomains: (v: boolean) => void;
    highRiskLimit: number;
    setHighRiskLimit: (lim: number) => void;
    minRiskScore: number;
    setMinRiskScore: (score: number) => void;
    paperSize: PaperSize;
    setPaperSize: (size: PaperSize) => void;
    orientation: Orientation;
    setOrientation: (o: Orientation) => void;
    includeExecutiveSummary: boolean;
    setIncludeExecutiveSummary: (v: boolean) => void;
}

export function ReportControlsSidebar({
    activeSectionsCount,
    totalPages,
    onSelectAll,
    onDeselectAll,
    enableShadowActivity,
    setEnableShadowActivity,
    timeframeActivity,
    setTimeframeActivity,
    enableDomainTemperature,
    setEnableDomainTemperature,
    timeframeDomainTemp,
    setTimeframeDomainTemp,
    enableShadowIncidents,
    setEnableShadowIncidents,
    timeframeIncidents,
    setTimeframeIncidents,
    enableContainmentTemp,
    setEnableContainmentTemp,
    timeframeContainment,
    setTimeframeContainment,
    enableHighRiskDomains,
    setEnableHighRiskDomains,
    highRiskLimit,
    setHighRiskLimit,
    minRiskScore,
    setMinRiskScore,
    paperSize,
    setPaperSize,
    orientation,
    setOrientation,
    includeExecutiveSummary,
    setIncludeExecutiveSummary,
}: ReportControlsSidebarProps) {
    return (
        <div className="no-print flex flex-col gap-4 lg:col-span-5">
            {/* Section Header */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-able-green/10 text-able-green">
                        <Sliders size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-foreground">
                            Admin Telemetry Controls
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {activeSectionsCount} of 5 modules enabled in report
                            ({totalPages} {totalPages === 1 ? 'Page' : 'Pages'})
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                    <button
                        type="button"
                        onClick={onSelectAll}
                        className="rounded px-2 py-1 text-able-green transition-colors hover:bg-able-green/10"
                    >
                        Select All
                    </button>
                    <span className="text-muted-foreground">|</span>
                    <button
                        type="button"
                        onClick={onDeselectAll}
                        className="rounded px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Control 1.1: Shadow Activity */}
            <ControlModuleCard
                icon={Activity}
                iconColor="text-cyan-400"
                title="1.1 Shadow Activity"
                description="Telemetry trends of discovered shadow app visits and network egress events."
                enabled={enableShadowActivity}
                onToggle={setEnableShadowActivity}
                activeTimeframe={timeframeActivity}
                onTimeframeChange={setTimeframeActivity}
            />

            {/* Control 1.2: Domain Temperature */}
            <ControlModuleCard
                icon={Flame}
                iconColor="text-amber-400"
                title="1.2 Domain Temperature"
                description="Safe vs Unsafe vs Unlisted distribution & category risk heat breakdown."
                enabled={enableDomainTemperature}
                onToggle={setEnableDomainTemperature}
                activeTimeframe={timeframeDomainTemp}
                onTimeframeChange={setTimeframeDomainTemp}
            />

            {/* Control 1.3: Shadow Incidents */}
            <ControlModuleCard
                icon={ShieldAlert}
                iconColor="text-[#ff4d4d]"
                title="1.3 Shadow Incidents"
                description="Critical egress policy violations and exfiltration attempts timeline."
                enabled={enableShadowIncidents}
                onToggle={setEnableShadowIncidents}
                activeTimeframe={timeframeIncidents}
                onTimeframeChange={setTimeframeIncidents}
            />

            {/* Control 1.4: Containment Temperature */}
            <ControlModuleCard
                icon={CheckCircle2}
                iconColor="text-able-green"
                title="1.4 Containment Temperature"
                description="Interception efficacy (% cancelled vs proceeded) and data volume protected."
                enabled={enableContainmentTemp}
                onToggle={setEnableContainmentTemp}
                activeTimeframe={timeframeContainment}
                onTimeframeChange={setTimeframeContainment}
            />

            {/* Control 1.5: High Risk Domains */}
            <div
                className={cn(
                    'flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200',
                    enableHighRiskDomains
                        ? 'border-able-green/40 bg-card shadow-[0_0_15px_rgba(34,197,94,0.08)]'
                        : 'border-border/60 bg-card/40 opacity-70',
                )}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                            <Ghost size={16} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                    1.5 High Risk Domains
                                </span>
                                {enableHighRiskDomains && (
                                    <Badge
                                        variant="outline"
                                        className="border-purple-500/30 text-[10px] text-purple-400"
                                    >
                                        Top {highRiskLimit}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Ranked table of high-risk shadow domains and
                                adopter statistics.
                            </p>
                        </div>
                    </div>
                    <Checkbox
                        checked={enableHighRiskDomains}
                        onCheckedChange={(checked) =>
                            setEnableHighRiskDomains(Boolean(checked))
                        }
                        className="data-[state=checked]:bg-able-green data-[state=checked]:text-black"
                    />
                </div>

                {enableHighRiskDomains && (
                    <div className="mt-2 flex flex-wrap items-center gap-4 rounded-lg bg-background/60 p-3 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                                Row Limit:
                            </span>
                            <div className="flex rounded-md border border-border/70 p-0.5">
                                {[5, 10, 15].map((lim) => (
                                    <button
                                        key={lim}
                                        type="button"
                                        onClick={() => setHighRiskLimit(lim)}
                                        className={cn(
                                            'rounded px-2.5 py-1 text-xs font-medium transition-all',
                                            highRiskLimit === lim
                                                ? 'bg-purple-500/20 font-semibold text-purple-300'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {lim}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                                Min Risk:
                            </span>
                            <div className="flex rounded-md border border-border/70 p-0.5">
                                {[50, 75, 90].map((score) => (
                                    <button
                                        key={score}
                                        type="button"
                                        onClick={() => setMinRiskScore(score)}
                                        className={cn(
                                            'rounded px-2 py-1 text-xs font-medium transition-all',
                                            minRiskScore === score
                                                ? 'bg-[#ff4d4d]/20 font-semibold text-[#ff4d4d]'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        ≥{score}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Document Display Preferences */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4">
                <h3 className="text-xs font-bold tracking-wider text-foreground uppercase">
                    Paper Layout &amp; Options
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <label className="text-muted-foreground">
                            Paper Format
                        </label>
                        <div className="mt-1 flex rounded-lg border border-border p-1">
                            <button
                                type="button"
                                onClick={() => setPaperSize('a4')}
                                className={cn(
                                    'flex-1 rounded py-1 text-center font-medium transition-colors',
                                    paperSize === 'a4'
                                        ? 'bg-accent font-semibold text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            >
                                A4 Standard
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaperSize('letter')}
                                className={cn(
                                    'flex-1 rounded py-1 text-center font-medium transition-colors',
                                    paperSize === 'letter'
                                        ? 'bg-accent font-semibold text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            >
                                US Letter
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-muted-foreground">
                            Orientation
                        </label>
                        <div className="mt-1 flex rounded-lg border border-border p-1">
                            <button
                                type="button"
                                onClick={() => setOrientation('portrait')}
                                className={cn(
                                    'flex-1 rounded py-1 text-center font-medium transition-colors',
                                    orientation === 'portrait'
                                        ? 'bg-accent font-semibold text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            >
                                Portrait
                            </button>
                            <button
                                type="button"
                                onClick={() => setOrientation('landscape')}
                                className={cn(
                                    'flex-1 rounded py-1 text-center font-medium transition-colors',
                                    orientation === 'landscape'
                                        ? 'bg-accent font-semibold text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            >
                                Landscape
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                    <Label
                        htmlFor="exec-summary"
                        className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                        Include Executive Summary Cards
                    </Label>
                    <Checkbox
                        id="exec-summary"
                        checked={includeExecutiveSummary}
                        onCheckedChange={(c) =>
                            setIncludeExecutiveSummary(Boolean(c))
                        }
                        className="data-[state=checked]:bg-able-green data-[state=checked]:text-black"
                    />
                </div>
            </div>
        </div>
    );
}
