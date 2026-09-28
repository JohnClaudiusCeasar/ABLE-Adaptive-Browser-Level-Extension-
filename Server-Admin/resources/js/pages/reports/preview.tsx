import { Head, Link, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    FileSpreadsheet,
    FileText,
    Flame,
    Ghost,
    Printer,
    RotateCcw,
    Shield,
    ShieldAlert,
    Sliders,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    normalizeCaptureColors,
    pageGeometry,
    removeHtml2PdfOverlay,
} from '@/lib/report-print';
import type { Orientation, PaperSize } from '@/lib/report-print';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface ActivityPoint {
    date: string;
    label: string;
    shortLabel: string;
    visits: number;
    egress: number;
}

interface CategoryBreakdown {
    category: string;
    count: number;
    percentage: number;
    avgRisk: number;
}

interface DomainTempData {
    timeframe: string;
    safe: number;
    unsafe: number;
    unlisted: number;
    safePct: number;
    unsafePct: number;
    unlistedPct: number;
    averageRisk: number;
    temperatureIndex: string;
    temperatureColor: string;
    categories: CategoryBreakdown[];
}

interface IncidentEvent {
    id: number;
    occurred_at: string;
    dateFormatted: string;
    domain: string;
    user: string;
    fileName: string;
    fileSize: string;
    risk_score: number;
    action: string;
    isCritical: boolean;
}

interface ContainmentData {
    timeframe: string;
    cancelled: number;
    proceeded: number;
    total: number;
    containmentRate: number;
    statusLabel: string;
    statusColor: string;
    dataSaved: string;
    dataLost: string;
}

interface HighRiskDomain {
    id: number;
    domain: string;
    category: string;
    risk_score: number;
    domain_status: string;
    policy: string;
    active_users: number;
    visit_count: number;
}

interface ReportPreviewProps {
    activeUsers: number;
    inactiveUsers: number;
    totalDomainVisits: number;
    totalEgressAttempts: number;
    criticalEgressCount: number;
    dataSaved: string;
    dataLost: string;
    nudgeSuccessRate: number;
    domainUsage: {
        safe: number;
        unsafe: number;
        unlisted: number;
    };
    shadowActivity: {
        daily: ActivityPoint[];
        weekly: ActivityPoint[];
        monthly: ActivityPoint[];
        yearly: ActivityPoint[];
    };
    domainTemperature: {
        daily: DomainTempData;
        weekly: DomainTempData;
        monthly: DomainTempData;
        yearly: DomainTempData;
    };
    shadowIncidents: {
        daily: IncidentEvent[];
        weekly: IncidentEvent[];
        monthly: IncidentEvent[];
        yearly: IncidentEvent[];
    };
    containmentTemperature: {
        daily: ContainmentData;
        weekly: ContainmentData;
        monthly: ContainmentData;
        yearly: ContainmentData;
    };
    highRiskDomains: HighRiskDomain[];
    reportMeta: {
        generatedAt: string;
        isoDate: string;
        version: string;
        classification: string;
    };
}

export default function ReportPreview({
    activeUsers,
    criticalEgressCount,
    nudgeSuccessRate,
    shadowActivity,
    domainTemperature,
    shadowIncidents,
    containmentTemperature,
    highRiskDomains,
    reportMeta,
}: ReportPreviewProps) {
    const { auth } = usePage<{
        auth?: { user?: { email?: string; name?: string } };
    }>().props;
    const adminEmail = auth?.user?.email || 'admin@able.local';

    // Admin Toggle Controls
    const [enableShadowActivity, setEnableShadowActivity] = useState(true);
    const [timeframeActivity, setTimeframeActivity] =
        useState<Timeframe>('weekly');

    const [enableDomainTemperature, setEnableDomainTemperature] =
        useState(true);
    const [timeframeDomainTemp, setTimeframeDomainTemp] =
        useState<Timeframe>('weekly');

    const [enableShadowIncidents, setEnableShadowIncidents] = useState(true);
    const [timeframeIncidents, setTimeframeIncidents] =
        useState<Timeframe>('weekly');

    const [enableContainmentTemp, setEnableContainmentTemp] = useState(true);
    const [timeframeContainment, setTimeframeContainment] =
        useState<Timeframe>('weekly');

    const [enableHighRiskDomains, setEnableHighRiskDomains] = useState(true);
    const [highRiskLimit, setHighRiskLimit] = useState<number>(10);
    const [minRiskScore, setMinRiskScore] = useState<number>(75);

    // Global document preferences
    const [includeExecutiveSummary, setIncludeExecutiveSummary] =
        useState(true);
    const [paperSize, setPaperSize] = useState<PaperSize>('a4');
    const [orientation, setOrientation] = useState<Orientation>('portrait');
    const [zoomLevel, setZoomLevel] = useState<number>(85);

    // One geometry for all three renderers (screen, print iframe, PDF capture).
    const geo = pageGeometry(paperSize, orientation);
    const zoomScale = zoomLevel / 100;

    const [pdfError, setPdfError] = useState(false);
    const [pageOverflow, setPageOverflow] = useState(false);
    const sheetsRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const node = sheetsRef.current;

        if (!node) {
            return;
        }

        const measure = () => {
            const sheets =
                node.querySelectorAll<HTMLElement>('.printable-sheet');
            setPageOverflow(
                Array.from(sheets).some(
                    (s) => s.scrollHeight > s.clientHeight + 1,
                ),
            );
        };

        measure();
        const resize = new ResizeObserver(measure);
        const mutations = new MutationObserver(measure);
        resize.observe(node);
        mutations.observe(node, {
            subtree: true,
            childList: true,
            characterData: true,
        });

        return () => {
            resize.disconnect();
            mutations.disconnect();
        };
    }, []);

    // Filtered data based on selected controls
    const activeActivityData =
        shadowActivity[timeframeActivity] || shadowActivity.weekly;
    const activeDomainTempData =
        domainTemperature[timeframeDomainTemp] || domainTemperature.weekly;
    const activeIncidentsData = (
        shadowIncidents[timeframeIncidents] || shadowIncidents.weekly
    ).slice(0, 15);
    const activeIncidentsTotal = (
        shadowIncidents[timeframeIncidents] || shadowIncidents.weekly
    ).length;
    const activeContainmentData =
        containmentTemperature[timeframeContainment] ||
        containmentTemperature.weekly;
    const filteredHighRiskDomains = useMemo(() => {
        return highRiskDomains
            .filter((d) => d.risk_score >= minRiskScore)
            .slice(0, highRiskLimit);
    }, [highRiskDomains, minRiskScore, highRiskLimit]);

    const activeSectionsCount = [
        enableShadowActivity,
        enableDomainTemperature,
        enableShadowIncidents,
        enableContainmentTemp,
        enableHighRiskDomains,
    ].filter(Boolean).length;

    function handleSelectAll() {
        setEnableShadowActivity(true);
        setEnableDomainTemperature(true);
        setEnableShadowIncidents(true);
        setEnableContainmentTemp(true);
        setEnableHighRiskDomains(true);
    }

    function handleDeselectAll() {
        setEnableShadowActivity(false);
        setEnableDomainTemperature(false);
        setEnableShadowIncidents(false);
        setEnableContainmentTemp(false);
        setEnableHighRiskDomains(false);
    }

    function handleResetDefaults() {
        setEnableShadowActivity(true);
        setTimeframeActivity('weekly');
        setEnableDomainTemperature(true);
        setTimeframeDomainTemp('weekly');
        setEnableShadowIncidents(true);
        setTimeframeIncidents('weekly');
        setEnableContainmentTemp(true);
        setTimeframeContainment('weekly');
        setEnableHighRiskDomains(true);
        setHighRiskLimit(10);
        setMinRiskScore(75);
        setIncludeExecutiveSummary(true);
        setPaperSize('a4');
        setOrientation('portrait');
        setZoomLevel(85);
    }

    const [isExportingPdf, setIsExportingPdf] = useState(false);

    function handleNativePrint() {
        const printableElement = document.getElementById(
            'printable-paper-sheet',
        );

        if (!printableElement) {
            window.print();

            return;
        }

        // Isolated hidden iframe: identical markup, identical stylesheet and
        // identical geometry to the preview — app.css owns the sheet box, so
        // nothing here has to rewrite layout rules.
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = `${geo.widthPx}px`;
        iframe.style.height = `${geo.heightPx}px`;
        iframe.style.border = 'none';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;

        if (!doc) {
            iframe.remove();
            window.print();

            return;
        }

        // Extract active stylesheets (Tailwind + fonts)
        const styles = Array.from(
            document.querySelectorAll('link[rel="stylesheet"], style'),
        )
            .map((node) => node.outerHTML)
            .join('\n');

        // Clone the sheets as-is: geometry comes from app.css plus the inline
        // --page-* variables, so only the preview-only zoom has to come off.
        const clone = printableElement.cloneNode(true) as HTMLElement;
        clone.style.transform = 'none';
        clone.style.margin = '0';
        clone.style.padding = '0';
        clone.style.width = '100%';
        clone.style.height = 'auto';
        clone.style.gap = '0';

        clone
            .querySelectorAll<HTMLElement>('.report-sheet-frame')
            .forEach((frame) => {
                frame.style.width = '100%';
                frame.style.height = 'auto';
            });
        clone
            .querySelectorAll<HTMLElement>('.printable-sheet')
            .forEach((sheet) => {
                sheet.style.transform = 'none';
            });

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <base href="${window.location.origin}">
                <meta charset="utf-8">
                <title>ABLE Security Analysis</title>
                ${styles}
                <style>
                    /* app.css already defines the sheet box, the page break and the
                       print resets — only the page box itself is set here. */
                    @page {
                        size: ${paperSize} ${orientation};
                        margin: 0;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                    }
                </style>
            </head>
            <body class="light bg-white text-slate-900" style="background: #ffffff !important; margin: 0; padding: 0;">
                ${clone.outerHTML}
            </body>
            </html>
        `);
        doc.close();

        const cleanup = () => {
            try {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            } catch {
                // Ignore cleanup if already unmounted
            } finally {
                // Safely restore focus to the host page window
                window.focus();

                if (typeof document.body.focus === 'function') {
                    document.body.focus();
                }
            }
        };

        if (iframe.contentWindow) {
            iframe.contentWindow.onafterprint = cleanup;
        }

        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            // Fallback safety cleanup after 60s
            setTimeout(cleanup, 60000);
        }, 350);
    }

    async function handleDownloadPdf() {
        const printableElement = document.getElementById(
            'printable-paper-sheet',
        );

        if (!printableElement) {
            return;
        }

        setIsExportingPdf(true);
        setPdfError(false);

        // html2pdf puts the source inside a container sized to the PDF page, so
        // the capture must use the same page box as the preview. It also stays
        // detached on purpose: html2pdf clones it into its own overlay, and an
        // off-screen `position: fixed` would be cloned along with it and collapse
        // the container to zero height.
        const pageHeightPx = geo.heightMm * (96 / 25.4);
        const captureSheetHeight = Math.floor(pageHeightPx);
        const captureGap = pageHeightPx - captureSheetHeight;

        let tempContainer: HTMLElement | null = null;

        try {
            // @ts-ignore
            const html2pdfModule = await import('html2pdf.js');
            const html2pdf = html2pdfModule.default || html2pdfModule;

            tempContainer = document.createElement('div');
            tempContainer.style.width = `${geo.widthMm}mm`;
            tempContainer.style.background = '#ffffff';

            const clone = printableElement.cloneNode(true) as HTMLElement;
            clone.style.transform = 'none';
            clone.style.margin = '0';
            clone.style.padding = '0';
            clone.style.width = '100%';
            clone.style.height = 'auto';
            clone.style.gap = `${captureGap}px`;

            clone
                .querySelectorAll<HTMLElement>('.report-sheet-frame')
                .forEach((frame) => {
                    frame.style.width = '100%';
                    frame.style.height = 'auto';
                });
            clone
                .querySelectorAll<HTMLElement>('.printable-sheet')
                .forEach((sheet) => {
                    sheet.style.transform = 'none';
                    sheet.style.height = `${captureSheetHeight}px`;
                });

            tempContainer.appendChild(clone);

            const opt = {
                // The page margin lives inside the sheet as padding, so the PDF page is full bleed.
                margin: [0, 0, 0, 0] as [number, number, number, number],
                filename: `able-security-analysis-${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    windowWidth: geo.widthPx,
                    imageTimeout: 5000,
                    // Tailwind v4 colours are OKLCH / colour-mix, which html2canvas
                    // 1.4.1 rejects outright; normalise them inside the clone first.
                    onclone: (
                        clonedDocument: Document,
                        referenceElement: Element,
                    ) => {
                        void clonedDocument;
                        normalizeCaptureColors(referenceElement);
                    },
                },
                jsPDF: {
                    unit: 'mm' as const,
                    format: paperSize,
                    orientation: orientation,
                },
                // html2pdf's break plugin pads against a page height it derives
                // differently from the one it slices with, which drops a blank page
                // whenever a sheet lands exactly on a boundary. Sheets are already
                // page-aligned, so leave the slicing to the exporter.
                pagebreak: { mode: [], before: [], after: [], avoid: [] },
            };

            await html2pdf().set(opt).from(tempContainer).save();
        } catch (err) {
            console.error('Client-side PDF export failed:', err);
            setPdfError(true);
        } finally {
            tempContainer?.remove();
            removeHtml2PdfOverlay();
            setIsExportingPdf(false);
            window.focus();
        }
    }

    // Maximum visits for proportional bar charts in Activity section
    const maxVisitsInSeries = useMemo(() => {
        const vals = activeActivityData.map((d) =>
            Math.max(d.visits, d.egress),
        );

        return Math.max(...vals, 10);
    }, [activeActivityData]);

    const pdfDownloadUrl = useMemo(() => {
        const params = new URLSearchParams();
        params.set(
            'sections[shadowActivity]',
            enableShadowActivity ? '1' : '0',
        );
        params.set(
            'sections[domainTemperature]',
            enableDomainTemperature ? '1' : '0',
        );
        params.set(
            'sections[shadowIncidents]',
            enableShadowIncidents ? '1' : '0',
        );
        params.set(
            'sections[containmentTemperature]',
            enableContainmentTemp ? '1' : '0',
        );
        params.set(
            'sections[highRiskDomains]',
            enableHighRiskDomains ? '1' : '0',
        );
        params.set('timeframes[shadowActivity]', timeframeActivity);
        params.set('timeframes[domainTemperature]', timeframeDomainTemp);
        params.set('timeframes[shadowIncidents]', timeframeIncidents);
        params.set('timeframes[containmentTemperature]', timeframeContainment);
        params.set('highRiskLimit', highRiskLimit.toString());
        params.set('minRiskScore', minRiskScore.toString());
        params.set(
            'includeExecutiveSummary',
            includeExecutiveSummary ? '1' : '0',
        );
        params.set('paperSize', paperSize);
        params.set('orientation', orientation);
        params.set(
            'timezone',
            Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila',
        );

        return `/dashboard/report/pdf?${params.toString()}`;
    }, [
        enableShadowActivity,
        enableDomainTemperature,
        enableShadowIncidents,
        enableContainmentTemp,
        enableHighRiskDomains,
        timeframeActivity,
        timeframeDomainTemp,
        timeframeIncidents,
        timeframeContainment,
        highRiskLimit,
        minRiskScore,
        includeExecutiveSummary,
        paperSize,
        orientation,
    ]);

    const showExec = includeExecutiveSummary;
    const showAct = enableShadowActivity;
    const showDt = enableDomainTemperature;
    const showInc = enableShadowIncidents;
    const showCnt = enableContainmentTemp;
    const showHr = enableHighRiskDomains;

    const hasGroup1 = showExec || showAct || showDt;
    const hasGroup2 = showInc || showCnt || showHr;
    const totalPages = hasGroup1 && hasGroup2 ? 2 : 1;

    return (
        <>
            <Head title="Report Preview — ABLE Security" />
            {/* Single owner of the page box; app.css must not declare @page as well. */}
            <style>{`@media print { @page { size: ${paperSize} ${orientation}; margin: 0; } }`}</style>

            <div className="report-preview-container mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
                {/* Top Action Bar (Hidden in Print) */}
                <div className="no-print flex flex-col justify-between gap-4 border-b border-border/50 pb-5 md:flex-row md:items-center">
                    <div className="flex items-center gap-3">
                        <Link
                            href={dashboard()}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/60 text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft size={18} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1
                                    className="text-xl font-bold tracking-wide text-foreground uppercase sm:text-2xl"
                                    style={{
                                        fontFamily: "'Unbounded', sans-serif",
                                    }}
                                >
                                    Report Preview &amp; Builder
                                </h1>
                                <Badge
                                    variant="outline"
                                    className="border-able-green/40 bg-able-green/10 text-able-green"
                                >
                                    {totalPages}{' '}
                                    {totalPages === 1 ? 'Page' : 'Pages'}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground sm:text-sm">
                                Configure the active telemetry modules on the
                                left to customize the live white paper document
                                preview.
                            </p>
                        </div>
                    </div>

                    {/* Export Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleResetDefaults}
                            className="gap-1.5 border-border/80 text-xs"
                            title="Reset all settings to default"
                        >
                            <RotateCcw size={14} />
                            <span>Reset</span>
                        </Button>

                        <a
                            href="/dashboard/report/excel"
                            download
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                        >
                            <FileSpreadsheet
                                size={15}
                                className="text-emerald-500"
                            />
                            <span>Export CSV</span>
                        </a>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleDownloadPdf}
                            disabled={isExportingPdf}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                        >
                            <FileText
                                size={15}
                                className={cn(
                                    'text-blue-400',
                                    isExportingPdf && 'animate-spin',
                                )}
                            />
                            <span>
                                {isExportingPdf
                                    ? 'Generating PDF...'
                                    : 'Download PDF'}
                            </span>
                        </Button>

                        <Button
                            type="button"
                            onClick={handleNativePrint}
                            className="gap-2 bg-gradient-to-r from-able-green to-emerald-600 font-semibold text-black shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:brightness-110 active:scale-95"
                        >
                            <Printer size={16} />
                            <span>Print Report</span>
                        </Button>
                    </div>
                </div>

                {pdfError && (
                    <div className="no-print flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                        <AlertTriangle
                            size={14}
                            className="shrink-0 text-amber-400"
                        />
                        <span>
                            Client-side PDF export failed. The server-rendered
                            alternative uses a simplified layout that differs
                            from this preview —
                        </span>
                        <a
                            href={pdfDownloadUrl}
                            className="font-semibold underline underline-offset-2"
                        >
                            download it anyway
                        </a>
                        <button
                            type="button"
                            onClick={() => setPdfError(false)}
                            className={cn(
                                'ml-auto rounded px-2 py-1 text-amber-300 transition-colors hover:bg-amber-500/20 hover:text-amber-100',
                            )}
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* 2x1 Grid Layout (Left Controls + Right Paper Preview) */}
                <div className="print-layout-reset grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
                    {/* ============================================================ */}
                    {/* 1) LEFT COLUMN: ADMIN CONTROLS (Col span 5)                  */}
                    {/* ============================================================ */}
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
                                        {activeSectionsCount} of 5 modules
                                        enabled in report ({totalPages}{' '}
                                        {totalPages === 1 ? 'Page' : 'Pages'})
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="rounded px-2 py-1 text-able-green transition-colors hover:bg-able-green/10"
                                >
                                    Select All
                                </button>
                                <span className="text-muted-foreground">|</span>
                                <button
                                    type="button"
                                    onClick={handleDeselectAll}
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
                            onToggle={(val) => setEnableShadowActivity(val)}
                            activeTimeframe={timeframeActivity}
                            onTimeframeChange={(tf) => setTimeframeActivity(tf)}
                        />

                        {/* Control 1.2: Domain Temperature */}
                        <ControlModuleCard
                            icon={Flame}
                            iconColor="text-amber-400"
                            title="1.2 Domain Temperature"
                            description="Safe vs Unsafe vs Unlisted distribution & category risk heat breakdown."
                            enabled={enableDomainTemperature}
                            onToggle={(val) => setEnableDomainTemperature(val)}
                            activeTimeframe={timeframeDomainTemp}
                            onTimeframeChange={(tf) =>
                                setTimeframeDomainTemp(tf)
                            }
                        />

                        {/* Control 1.3: Shadow Incidents */}
                        <ControlModuleCard
                            icon={ShieldAlert}
                            iconColor="text-[#ff4d4d]"
                            title="1.3 Shadow Incidents"
                            description="Critical egress policy violations and exfiltration attempts timeline."
                            enabled={enableShadowIncidents}
                            onToggle={(val) => setEnableShadowIncidents(val)}
                            activeTimeframe={timeframeIncidents}
                            onTimeframeChange={(tf) =>
                                setTimeframeIncidents(tf)
                            }
                        />

                        {/* Control 1.4: Containment Temperature */}
                        <ControlModuleCard
                            icon={CheckCircle2}
                            iconColor="text-able-green"
                            title="1.4 Containment Temperature"
                            description="Interception efficacy (% cancelled vs proceeded) and data volume protected."
                            enabled={enableContainmentTemp}
                            onToggle={(val) => setEnableContainmentTemp(val)}
                            activeTimeframe={timeframeContainment}
                            onTimeframeChange={(tf) =>
                                setTimeframeContainment(tf)
                            }
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
                                            Ranked table of high-risk shadow
                                            domains and adopter statistics.
                                        </p>
                                    </div>
                                </div>
                                <Checkbox
                                    checked={enableHighRiskDomains}
                                    onCheckedChange={(checked) =>
                                        setEnableHighRiskDomains(
                                            Boolean(checked),
                                        )
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
                                                    onClick={() =>
                                                        setHighRiskLimit(lim)
                                                    }
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
                                                    onClick={() =>
                                                        setMinRiskScore(score)
                                                    }
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
                                            onClick={() =>
                                                setPaperSize('letter')
                                            }
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
                                            onClick={() =>
                                                setOrientation('portrait')
                                            }
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
                                            onClick={() =>
                                                setOrientation('landscape')
                                            }
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

                    {/* ============================================================ */}
                    {/* 2) RIGHT COLUMN: WHITE PAPER RESOLUTION PREVIEW (Col span 7) */}
                    {/* ============================================================ */}
                    <div className="print-layout-reset sticky top-4 flex flex-col gap-3 self-start lg:col-span-7">
                        {/* Zoom & Viewport Toolbar (Hidden in print) */}
                        <div className="no-print flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-2 text-xs backdrop-blur-md">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="font-semibold text-foreground">
                                    Paper Document Preview:
                                </span>
                                <Badge
                                    variant="outline"
                                    className="border-border text-[11px] text-muted-foreground uppercase"
                                >
                                    {totalPages}{' '}
                                    {totalPages === 1 ? 'Page' : 'Pages'} •{' '}
                                    {paperSize.toUpperCase()} {orientation}
                                </Badge>
                                <span>•</span>
                                <span>
                                    {activeSectionsCount} Active Modules
                                </span>
                                {pageOverflow && (
                                    <Badge
                                        variant="outline"
                                        className="border-red-500/50 bg-red-500/10 text-red-400"
                                    >
                                        Content exceeds page — clipped in print
                                        &amp; PDF
                                    </Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setZoomLevel((z) =>
                                            Math.max(50, z - 10),
                                        )
                                    }
                                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                    title="Zoom Out"
                                >
                                    <ZoomOut size={15} />
                                </button>
                                <span className="min-w-[42px] text-center font-mono font-medium">
                                    {zoomLevel}%
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setZoomLevel((z) =>
                                            Math.min(130, z + 10),
                                        )
                                    }
                                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                    title="Zoom In"
                                >
                                    <ZoomIn size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setZoomLevel(85)}
                                    className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                    title="Scale to fit"
                                >
                                    Fit (85%)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setZoomLevel(100)}
                                    className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                    title="Reset 100%"
                                >
                                    100%
                                </button>
                            </div>
                        </div>

                        {/* Paper Sheet Viewport Container (Dark staging desk with pristine white paper sheets) */}
                        <div className="report-preview-desk flex max-h-[calc(100vh-140px)] flex-col items-center gap-8 overflow-auto rounded-2xl border border-border/80 bg-neutral-900/90 p-4 shadow-2xl sm:p-6 print:m-0 print:max-h-none print:overflow-visible print:border-none print:bg-transparent print:p-0 print:shadow-none">
                            <div
                                ref={sheetsRef}
                                id="printable-paper-sheet"
                                style={{
                                    width: geo.widthPx * zoomScale,
                                    gap: `${32 * zoomScale}px`,
                                }}
                                className="flex flex-col items-center print:m-0 print:p-0"
                            >
                                {/* ============================================================ */}
                                {/* SHEET 1 (PAGE 1)                                             */}
                                {/* ============================================================ */}
                                {(hasGroup1 || !hasGroup2) && (
                                    <div
                                        className="report-sheet-frame"
                                        style={{
                                            width: geo.widthPx * zoomScale,
                                            height: geo.heightPx * zoomScale,
                                        }}
                                    >
                                        <div
                                            className="printable-sheet flex flex-col justify-between rounded-md border border-slate-300 bg-white text-slate-900 shadow-[0_25px_60px_rgba(0,0,0,0.45)]"
                                            style={{
                                                ...geo.cssVars,
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
                                                                        ABLE
                                                                        SECURITY
                                                                        ANALYSIS
                                                                    </h2>
                                                                </div>
                                                                <p className="font-mono text-xs text-slate-600">
                                                                    Adaptive
                                                                    Browser-Level
                                                                    Extension •{' '}
                                                                    {adminEmail}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="text-right">
                                                            <span className="inline-block rounded border border-red-300 bg-red-50 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-red-700 uppercase">
                                                                {
                                                                    reportMeta.classification
                                                                }
                                                            </span>
                                                            <p className="mt-1 text-[11px] text-slate-600">
                                                                Generated:{' '}
                                                                {
                                                                    reportMeta.generatedAt
                                                                }
                                                            </p>
                                                            <p className="font-mono text-[10px] text-slate-500">
                                                                SYSTEM ID:
                                                                ABLE-SEC-
                                                                {new Date().getFullYear()}
                                                                -A4
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
                                                            No Telemetry Modules
                                                            Selected
                                                        </h3>
                                                        <p className="mt-1 max-w-md text-xs text-slate-500">
                                                            Please enable one or
                                                            more telemetry
                                                            sections on the left
                                                            Admin Controls panel
                                                            to preview and print
                                                            your custom report.
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
                                                                    1.1 Shadow
                                                                    Activity
                                                                    Breakdown
                                                                </h3>
                                                            </div>
                                                            <span className="rounded border border-cyan-200 bg-cyan-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-800 uppercase">
                                                                Granularity:{' '}
                                                                {
                                                                    timeframeActivity
                                                                }
                                                            </span>
                                                        </div>

                                                        {/* Chart Simulation */}
                                                        <div className="mb-4 flex h-36 items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 pt-6 shadow-xs">
                                                            {activeActivityData.map(
                                                                (pt, i) => {
                                                                    const visitHeight =
                                                                        Math.min(
                                                                            100,
                                                                            Math.max(
                                                                                8,
                                                                                (pt.visits /
                                                                                    maxVisitsInSeries) *
                                                                                    100,
                                                                            ),
                                                                        );
                                                                    const egressHeight =
                                                                        Math.min(
                                                                            100,
                                                                            Math.max(
                                                                                8,
                                                                                (pt.egress /
                                                                                    maxVisitsInSeries) *
                                                                                    100,
                                                                            ),
                                                                        );

                                                                    return (
                                                                        <div
                                                                            key={
                                                                                i
                                                                            }
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
                                                                                {
                                                                                    pt.shortLabel
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                },
                                                            )}
                                                        </div>

                                                        {/* Activity Legend & Data summary */}
                                                        <div className="grid grid-cols-3 gap-3 border-t border-slate-200 pt-3 text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className="h-2.5 w-2.5 rounded bg-cyan-600" />
                                                                <span className="text-slate-600">
                                                                    Total
                                                                    Visits:
                                                                </span>
                                                                <span className="font-bold text-slate-900">
                                                                    {activeActivityData
                                                                        .reduce(
                                                                            (
                                                                                acc,
                                                                                c,
                                                                            ) =>
                                                                                acc +
                                                                                c.visits,
                                                                            0,
                                                                        )
                                                                        .toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="h-2.5 w-2.5 rounded bg-amber-500" />
                                                                <span className="text-slate-600">
                                                                    Total
                                                                    Egress:
                                                                </span>
                                                                <span className="font-bold text-slate-900">
                                                                    {activeActivityData
                                                                        .reduce(
                                                                            (
                                                                                acc,
                                                                                c,
                                                                            ) =>
                                                                                acc +
                                                                                c.egress,
                                                                            0,
                                                                        )
                                                                        .toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <div className="text-right text-[11px] font-medium text-slate-500">
                                                                Range:{' '}
                                                                {activeActivityData[0]
                                                                    ?.label ||
                                                                    '—'}{' '}
                                                                –{' '}
                                                                {activeActivityData[
                                                                    activeActivityData.length -
                                                                        1
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
                                                                    1.2 Domain
                                                                    Temperature
                                                                    &amp; Risk
                                                                    Posture
                                                                </h3>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-800 uppercase">
                                                                    Status:{' '}
                                                                    {
                                                                        activeDomainTempData.temperatureIndex
                                                                    }{' '}
                                                                    Temperature
                                                                </span>
                                                                <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 uppercase">
                                                                    {
                                                                        timeframeDomainTemp
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="mb-4 grid grid-cols-3 gap-4">
                                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                                                                <span className="text-[10px] font-semibold text-emerald-800 uppercase">
                                                                    Safe Domains
                                                                </span>
                                                                <p className="mt-1 text-xl font-bold text-emerald-950">
                                                                    {
                                                                        activeDomainTempData.safe
                                                                    }
                                                                </p>
                                                                <p className="text-[10px] text-emerald-700">
                                                                    {
                                                                        activeDomainTempData.safePct
                                                                    }
                                                                    % of catalog
                                                                </p>
                                                            </div>
                                                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                                                                <span className="text-[10px] font-semibold text-amber-800 uppercase">
                                                                    Unlisted
                                                                    Domains
                                                                </span>
                                                                <p className="mt-1 text-xl font-bold text-amber-950">
                                                                    {
                                                                        activeDomainTempData.unlisted
                                                                    }
                                                                </p>
                                                                <p className="text-[10px] text-amber-700">
                                                                    {
                                                                        activeDomainTempData.unlistedPct
                                                                    }
                                                                    % of catalog
                                                                </p>
                                                            </div>
                                                            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center">
                                                                <span className="text-[10px] font-semibold text-rose-800 uppercase">
                                                                    Unsafe /
                                                                    Blacklisted
                                                                </span>
                                                                <p className="mt-1 text-xl font-bold text-rose-950">
                                                                    {
                                                                        activeDomainTempData.unsafe
                                                                    }
                                                                </p>
                                                                <p className="text-[10px] text-rose-700">
                                                                    {
                                                                        activeDomainTempData.unsafePct
                                                                    }
                                                                    % of catalog
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Top Categories Risk Distribution */}
                                                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                                                            <h4 className="mb-2 text-[11px] font-bold text-slate-700 uppercase">
                                                                Top Cloud
                                                                Categories Risk
                                                                Distribution
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {activeDomainTempData.categories.map(
                                                                    (
                                                                        cat,
                                                                        i,
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                i
                                                                            }
                                                                            className="flex items-center gap-3 text-xs"
                                                                        >
                                                                            <span className="w-32 truncate font-medium text-slate-800">
                                                                                {
                                                                                    cat.category
                                                                                }
                                                                            </span>
                                                                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                                                                <div
                                                                                    style={{
                                                                                        width: `${Math.max(5, cat.percentage)}%`,
                                                                                    }}
                                                                                    className={cn(
                                                                                        'h-full rounded-full',
                                                                                        cat.avgRisk >=
                                                                                            75
                                                                                            ? 'bg-rose-500'
                                                                                            : cat.avgRisk >=
                                                                                                45
                                                                                              ? 'bg-amber-500'
                                                                                              : 'bg-emerald-500',
                                                                                    )}
                                                                                />
                                                                            </div>
                                                                            <span className="w-16 text-right font-mono text-[11px] text-slate-600">
                                                                                {
                                                                                    cat.count
                                                                                }{' '}
                                                                                (
                                                                                {
                                                                                    cat.percentage
                                                                                }
                                                                                %)
                                                                            </span>
                                                                            <span
                                                                                className={cn(
                                                                                    'w-14 rounded px-1 text-center text-[10px] font-bold',
                                                                                    cat.avgRisk >=
                                                                                        75
                                                                                        ? 'border border-rose-200 bg-rose-100 text-rose-800'
                                                                                        : cat.avgRisk >=
                                                                                            45
                                                                                          ? 'border border-amber-200 bg-amber-100 text-amber-800'
                                                                                          : 'border border-emerald-200 bg-emerald-100 text-emerald-800',
                                                                                )}
                                                                            >
                                                                                Risk{' '}
                                                                                {
                                                                                    cat.avgRisk
                                                                                }
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
                                                    <Shield
                                                        size={14}
                                                        className="text-emerald-600"
                                                    />
                                                    <span className="font-mono text-[11px]">
                                                        ABLE Network Security •
                                                        Confidential Document
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-6">
                                                    {totalPages === 1 && (
                                                        <div className="text-right font-mono text-[10px] text-slate-500">
                                                            <span>
                                                                SIGN-OFF:
                                                                ___________________
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="font-mono text-[11px] text-slate-500">
                                                        PAGE 1 OF {totalPages}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ============================================================ */}
                                {/* SHEET 2 (PAGE 2)                                             */}
                                {/* ============================================================ */}
                                {hasGroup2 && (
                                    <div
                                        className="report-sheet-frame"
                                        style={{
                                            width: geo.widthPx * zoomScale,
                                            height: geo.heightPx * zoomScale,
                                        }}
                                    >
                                        <div
                                            className="printable-sheet flex flex-col justify-between rounded-md border border-slate-300 bg-white text-slate-900 shadow-[0_25px_60px_rgba(0,0,0,0.45)]"
                                            style={{
                                                ...geo.cssVars,
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
                                                                        ABLE
                                                                        SECURITY
                                                                        ANALYSIS
                                                                    </h2>
                                                                </div>
                                                                <p className="font-mono text-xs text-slate-600">
                                                                    Incident,
                                                                    Containment
                                                                    &amp; High
                                                                    Risk Domain
                                                                    Telemetry
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="text-right">
                                                            <span className="inline-block rounded border border-red-300 bg-red-50 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-red-700 uppercase">
                                                                {
                                                                    reportMeta.classification
                                                                }
                                                            </span>
                                                            <p className="mt-1 text-[11px] text-slate-600">
                                                                Generated:{' '}
                                                                {
                                                                    reportMeta.generatedAt
                                                                }
                                                            </p>
                                                            <p className="font-mono text-[10px] text-slate-500">
                                                                PAGE{' '}
                                                                {totalPages ===
                                                                2
                                                                    ? '2 OF 2'
                                                                    : '1 OF 1'}
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
                                                                    1.3 Shadow
                                                                    Incidents
                                                                    &amp; Egress
                                                                    Violations
                                                                </h3>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="rounded border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase">
                                                                    {
                                                                        activeIncidentsTotal
                                                                    }{' '}
                                                                    Recent
                                                                    Incidents
                                                                </span>
                                                                <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 uppercase">
                                                                    {
                                                                        timeframeIncidents
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                                            <table className="w-full border-collapse text-left text-xs">
                                                                <thead>
                                                                    <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] tracking-wider text-slate-600 uppercase">
                                                                        <th className="px-3 py-2.5">
                                                                            Date
                                                                            /
                                                                            Time
                                                                        </th>
                                                                        <th className="px-3 py-2.5">
                                                                            Target
                                                                            Domain
                                                                        </th>
                                                                        <th className="px-3 py-2.5">
                                                                            User
                                                                            ID
                                                                        </th>
                                                                        <th className="px-3 py-2.5">
                                                                            File
                                                                            /
                                                                            Payload
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
                                                                    {activeIncidentsData.length ===
                                                                    0 ? (
                                                                        <tr>
                                                                            <td
                                                                                colSpan={
                                                                                    6
                                                                                }
                                                                                className="py-4 text-center text-slate-500 italic"
                                                                            >
                                                                                No
                                                                                critical
                                                                                egress
                                                                                incidents
                                                                                recorded
                                                                                in
                                                                                this
                                                                                timeframe.
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        activeIncidentsData
                                                                            .slice(
                                                                                0,
                                                                                8,
                                                                            )
                                                                            .map(
                                                                                (
                                                                                    inc,
                                                                                ) => (
                                                                                    <tr
                                                                                        key={
                                                                                            inc.id
                                                                                        }
                                                                                        className="hover:bg-slate-50"
                                                                                    >
                                                                                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                                                                                            {
                                                                                                inc.dateFormatted
                                                                                            }
                                                                                        </td>
                                                                                        <td className="max-w-[150px] truncate px-3 py-2 font-medium text-slate-900">
                                                                                            {
                                                                                                inc.domain
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                                                                                            {inc.user ||
                                                                                                '—'}
                                                                                        </td>
                                                                                        <td
                                                                                            className="max-w-[140px] truncate px-3 py-2 text-slate-700"
                                                                                            title={
                                                                                                inc.fileName
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                inc.fileName
                                                                                            }{' '}
                                                                                            (
                                                                                            {
                                                                                                inc.fileSize
                                                                                            }

                                                                                            )
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
                                                                                                {
                                                                                                    inc.risk_score
                                                                                                }
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
                                                                                                {
                                                                                                    inc.action
                                                                                                }
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
                                                                    1.4
                                                                    Containment
                                                                    Temperature
                                                                    &amp; Data
                                                                    Safeguards
                                                                </h3>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                                                                    {
                                                                        activeContainmentData.statusLabel
                                                                    }
                                                                </span>
                                                                <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 uppercase">
                                                                    {
                                                                        timeframeContainment
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4">
                                                            {/* Containment Rate Progress */}
                                                            <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                                                                <div>
                                                                    <div className="mb-1.5 flex items-center justify-between text-xs">
                                                                        <span className="font-semibold text-slate-800">
                                                                            Interception
                                                                            Containment
                                                                            Rate
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
                                                                            Nudges
                                                                            Cancelled:
                                                                        </span>
                                                                        <span className="font-mono font-bold text-emerald-700">
                                                                            {activeContainmentData.cancelled.toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-slate-500">
                                                                            User
                                                                            Proceeded:
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
                                                                        Exfiltration
                                                                        Data
                                                                        Protection
                                                                        Volume
                                                                    </span>
                                                                    <div className="mt-1 grid grid-cols-2 gap-3">
                                                                        <div className="rounded border border-emerald-200 bg-emerald-50 p-2.5 text-center">
                                                                            <span className="text-[10px] font-bold text-emerald-800 uppercase">
                                                                                Data
                                                                                Saved
                                                                            </span>
                                                                            <p className="mt-0.5 font-mono text-base font-bold text-emerald-700">
                                                                                {
                                                                                    activeContainmentData.dataSaved
                                                                                }
                                                                            </p>
                                                                        </div>
                                                                        <div className="rounded border border-rose-200 bg-rose-50 p-2.5 text-center">
                                                                            <span className="text-[10px] font-bold text-rose-800 uppercase">
                                                                                Data
                                                                                Lost
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
                                                                    Telemetry
                                                                    calculated
                                                                    from browser
                                                                    file upload
                                                                    intercept
                                                                    actions.
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
                                                                    1.5 High
                                                                    Risk Shadow
                                                                    Domains
                                                                    Catalog
                                                                </h3>
                                                            </div>
                                                            <span className="rounded border border-purple-200 bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 uppercase">
                                                                Showing Top{' '}
                                                                {
                                                                    filteredHighRiskDomains.length
                                                                }{' '}
                                                                Domains (Score ≥{' '}
                                                                {minRiskScore})
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
                                                                            Risk
                                                                            Score
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-200">
                                                                    {filteredHighRiskDomains.length ===
                                                                    0 ? (
                                                                        <tr>
                                                                            <td
                                                                                colSpan={
                                                                                    6
                                                                                }
                                                                                className="py-4 text-center text-slate-500 italic"
                                                                            >
                                                                                No
                                                                                domains
                                                                                match
                                                                                risk
                                                                                score
                                                                                threshold
                                                                                ≥{' '}
                                                                                {
                                                                                    minRiskScore
                                                                                }

                                                                                .
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        filteredHighRiskDomains.map(
                                                                            (
                                                                                item,
                                                                            ) => (
                                                                                <tr
                                                                                    key={
                                                                                        item.id
                                                                                    }
                                                                                    className="hover:bg-slate-50"
                                                                                >
                                                                                    <td className="px-3 py-2 font-mono font-medium text-slate-900">
                                                                                        {
                                                                                            item.domain
                                                                                        }
                                                                                    </td>
                                                                                    <td className="px-3 py-2 text-slate-600">
                                                                                        {
                                                                                            item.category
                                                                                        }
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
                                                                                        {
                                                                                            item.active_users
                                                                                        }
                                                                                    </td>
                                                                                    <td className="px-3 py-2 font-mono text-slate-700">
                                                                                        {
                                                                                            item.visit_count
                                                                                        }
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
                                                                                            /
                                                                                            100
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
                                                    <Shield
                                                        size={14}
                                                        className="text-emerald-600"
                                                    />
                                                    <span className="font-mono text-[11px]">
                                                        ABLE Network Security •
                                                        Confidential Document
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-6">
                                                    <div className="text-right font-mono text-[10px] text-slate-500">
                                                        <span>
                                                            SIGN-OFF:
                                                            ___________________
                                                        </span>
                                                    </div>
                                                    <div className="font-mono text-[11px] text-slate-500">
                                                        PAGE{' '}
                                                        {totalPages === 2
                                                            ? '2 OF 2'
                                                            : '1 OF 1'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function ControlModuleCard({
    icon: Icon,
    iconColor,
    title,
    description,
    enabled,
    onToggle,
    activeTimeframe,
    onTimeframeChange,
}: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    iconColor: string;
    title: string;
    description: string;
    enabled: boolean;
    onToggle: (val: boolean) => void;
    activeTimeframe: Timeframe;
    onTimeframeChange: (tf: Timeframe) => void;
}) {
    const timeframes: { key: Timeframe; label: string }[] = [
        { key: 'daily', label: 'Daily' },
        { key: 'weekly', label: 'Weekly' },
        { key: 'monthly', label: 'Monthly' },
        { key: 'yearly', label: 'Yearly' },
    ];

    return (
        <div
            className={cn(
                'flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200',
                enabled
                    ? 'border-able-green/40 bg-card shadow-[0_0_15px_rgba(34,197,94,0.08)]'
                    : 'border-border/60 bg-card/40 opacity-70',
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div
                        className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg bg-white/5',
                            iconColor,
                        )}
                    >
                        <Icon size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                                {title}
                            </span>
                            {enabled && (
                                <Badge
                                    variant="outline"
                                    className="border-able-green/30 text-[10px] text-able-green uppercase"
                                >
                                    {activeTimeframe}
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {description}
                        </p>
                    </div>
                </div>

                <Checkbox
                    checked={enabled}
                    onCheckedChange={(checked) => onToggle(Boolean(checked))}
                    className="data-[state=checked]:bg-able-green data-[state=checked]:text-black"
                />
            </div>

            {/* Timeframe selector pill buttons */}
            {enabled && (
                <div className="mt-1 flex rounded-lg border border-border/70 bg-background/60 p-1">
                    {timeframes.map((tf) => {
                        const isActive = activeTimeframe === tf.key;

                        return (
                            <button
                                key={tf.key}
                                type="button"
                                onClick={() => onTimeframeChange(tf.key)}
                                className={cn(
                                    'flex-1 rounded-md py-1 text-center text-xs font-medium transition-all',
                                    isActive
                                        ? 'bg-able-green/20 font-semibold text-able-green shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {tf.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function PaperMetricCard({
    label,
    value,
    sub,
    accent,
}: {
    label: string;
    value: string;
    sub: string;
    accent: string;
}) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-xs">
            <span className="block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                {label}
            </span>
            <p
                style={{ color: accent }}
                className="mt-0.5 font-mono text-xl font-bold"
            >
                {value}
            </p>
            <span className="block text-[9px] text-slate-500">{sub}</span>
        </div>
    );
}

ReportPreview.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
        {
            title: 'Report Preview',
            href: '/reports/preview',
        },
    ],
};
