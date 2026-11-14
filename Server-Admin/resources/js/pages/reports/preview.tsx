import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    FileSpreadsheet,
    FileText,
    Printer,
    RotateCcw,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ReportControlsSidebar } from '@/components/reports/ReportControlsSidebar';
import { ReportSheetOne } from '@/components/reports/ReportSheetOne';
import { ReportSheetTwo } from '@/components/reports/ReportSheetTwo';
import type {
    ReportPreviewProps,
    Timeframe,
} from '@/components/reports/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    normalizeCaptureColors,
    pageGeometry,
    removeHtml2PdfOverlay,
} from '@/lib/report-print';
import type { Orientation, PaperSize } from '@/lib/report-print';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';

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
                    <ReportControlsSidebar
                        activeSectionsCount={activeSectionsCount}
                        totalPages={totalPages}
                        onSelectAll={handleSelectAll}
                        onDeselectAll={handleDeselectAll}
                        enableShadowActivity={enableShadowActivity}
                        setEnableShadowActivity={setEnableShadowActivity}
                        timeframeActivity={timeframeActivity}
                        setTimeframeActivity={setTimeframeActivity}
                        enableDomainTemperature={enableDomainTemperature}
                        setEnableDomainTemperature={setEnableDomainTemperature}
                        timeframeDomainTemp={timeframeDomainTemp}
                        setTimeframeDomainTemp={setTimeframeDomainTemp}
                        enableShadowIncidents={enableShadowIncidents}
                        setEnableShadowIncidents={setEnableShadowIncidents}
                        timeframeIncidents={timeframeIncidents}
                        setTimeframeIncidents={setTimeframeIncidents}
                        enableContainmentTemp={enableContainmentTemp}
                        setEnableContainmentTemp={setEnableContainmentTemp}
                        timeframeContainment={timeframeContainment}
                        setTimeframeContainment={setTimeframeContainment}
                        enableHighRiskDomains={enableHighRiskDomains}
                        setEnableHighRiskDomains={setEnableHighRiskDomains}
                        highRiskLimit={highRiskLimit}
                        setHighRiskLimit={setHighRiskLimit}
                        minRiskScore={minRiskScore}
                        setMinRiskScore={setMinRiskScore}
                        paperSize={paperSize}
                        setPaperSize={setPaperSize}
                        orientation={orientation}
                        setOrientation={setOrientation}
                        includeExecutiveSummary={includeExecutiveSummary}
                        setIncludeExecutiveSummary={setIncludeExecutiveSummary}
                    />

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
                                {(hasGroup1 || !hasGroup2) && (
                                    <ReportSheetOne
                                        widthPx={geo.widthPx}
                                        heightPx={geo.heightPx}
                                        zoomScale={zoomScale}
                                        cssVars={geo.cssVars}
                                        adminEmail={adminEmail}
                                        reportMeta={reportMeta}
                                        showExec={showExec}
                                        activeUsers={activeUsers}
                                        highRiskDomains={highRiskDomains}
                                        criticalEgressCount={
                                            criticalEgressCount
                                        }
                                        nudgeSuccessRate={nudgeSuccessRate}
                                        activeSectionsCount={
                                            activeSectionsCount
                                        }
                                        showAct={showAct}
                                        timeframeActivity={timeframeActivity}
                                        activeActivityData={activeActivityData}
                                        maxVisitsInSeries={maxVisitsInSeries}
                                        showDt={showDt}
                                        timeframeDomainTemp={
                                            timeframeDomainTemp
                                        }
                                        activeDomainTempData={
                                            activeDomainTempData
                                        }
                                        totalPages={totalPages}
                                    />
                                )}

                                {hasGroup2 && (
                                    <ReportSheetTwo
                                        widthPx={geo.widthPx}
                                        heightPx={geo.heightPx}
                                        zoomScale={zoomScale}
                                        cssVars={geo.cssVars}
                                        reportMeta={reportMeta}
                                        totalPages={totalPages}
                                        showInc={showInc}
                                        timeframeIncidents={timeframeIncidents}
                                        activeIncidentsTotal={
                                            activeIncidentsTotal
                                        }
                                        activeIncidentsData={
                                            activeIncidentsData
                                        }
                                        showCnt={showCnt}
                                        timeframeContainment={
                                            timeframeContainment
                                        }
                                        activeContainmentData={
                                            activeContainmentData
                                        }
                                        showHr={showHr}
                                        filteredHighRiskDomains={
                                            filteredHighRiskDomains
                                        }
                                        minRiskScore={minRiskScore}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
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
