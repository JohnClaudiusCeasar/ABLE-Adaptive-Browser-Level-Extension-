<?php

namespace App\Http\Controllers;

use App\Exports\DashboardExport;
use App\Services\DashboardReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DashboardReportController extends Controller
{
    public function __construct(private readonly DashboardReportService $reportService) {}

    /**
     * Render the interactive 2x1 Report Preview page with live datasets.
     */
    public function preview(Request $request): Response
    {
        $timezone = $request->input('timezone') ?: config('app.timezone', 'Asia/Manila');
        $previewData = $this->reportService->getComprehensiveReportData($timezone);

        return Inertia::render('reports/preview', $previewData);
    }

    /**
     * Export custom PDF based on selected options or defaults.
     */
    public function pdf(Request $request): HttpResponse
    {
        $timezone = $request->input('timezone') ?: config('app.timezone', 'Asia/Manila');
        $data = $this->reportService->getComprehensiveReportData($timezone);

        // Optional request filters to pass to blade view
        $sectionsInput = $request->input('sections', []);
        $data['selectedSections'] = [
            'shadowActivity' => filter_var($sectionsInput['shadowActivity'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'domainTemperature' => filter_var($sectionsInput['domainTemperature'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'shadowIncidents' => filter_var($sectionsInput['shadowIncidents'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'containmentTemperature' => filter_var($sectionsInput['containmentTemperature'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'highRiskDomains' => filter_var($sectionsInput['highRiskDomains'] ?? true, FILTER_VALIDATE_BOOLEAN),
        ];

        $timeframesInput = $request->input('timeframes', []);
        $data['timeframes'] = [
            'shadowActivity' => $timeframesInput['shadowActivity'] ?? 'weekly',
            'domainTemperature' => $timeframesInput['domainTemperature'] ?? 'weekly',
            'shadowIncidents' => $timeframesInput['shadowIncidents'] ?? 'weekly',
            'containmentTemperature' => $timeframesInput['containmentTemperature'] ?? 'weekly',
        ];

        $data['highRiskLimit'] = max(1, (int) $request->input('highRiskLimit', 10));
        $data['minRiskScore'] = (int) $request->input('minRiskScore', 75);
        $data['includeExecutiveSummary'] = filter_var($request->input('includeExecutiveSummary', true), FILTER_VALIDATE_BOOLEAN);

        // Filter high risk domains according to minRiskScore and highRiskLimit
        $data['filteredHighRiskDomains'] = array_slice(
            array_values(array_filter($data['highRiskDomains'], fn ($d) => ($d['risk_score'] ?? 0) >= $data['minRiskScore'])),
            0,
            $data['highRiskLimit']
        );

        $paperSize = $request->input('paperSize', 'a4');
        $orientation = $request->input('orientation', 'portrait');

        // The options are merged with the configured ones, so the published
        // config/dompdf.php settings (no remote resources, font subsetting)
        // still apply. Replacing them outright would put dompdf back into
        // fetching remote fonts and embedding them whole.
        $pdf = Pdf::loadView('reports.dashboard', $data)
            ->setPaper($paperSize, $orientation)
            ->setOptions([
                'defaultFont' => 'Helvetica',
                'isRemoteEnabled' => false,
                'isHtml5ParserEnabled' => true,
            ], mergeWithDefaults: true);

        return $pdf->download('able-security-report-'.now($timezone)->format('Y-m-d').'.pdf');
    }

    /**
     * Export CSV report.
     */
    public function excel(): StreamedResponse
    {
        $data = $this->reportService->getReportData();

        $export = new DashboardExport(
            $data['summary'],
            $data['recentEgressEvents'],
            $data['recentDomainVisits']
        );

        return $export->download();
    }
}
