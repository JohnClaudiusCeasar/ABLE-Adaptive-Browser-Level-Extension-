<?php

namespace App\Exports;

use Illuminate\Support\Facades\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DashboardExport
{
    /**
     * @param  array<string, mixed>  $summary
     * @param  array<int, array<string, mixed>>  $recentEgressEvents
     * @param  array<int, array<string, mixed>>  $recentDomainVisits
     */
    public function __construct(
        protected array $summary,
        protected array $recentEgressEvents,
        protected array $recentDomainVisits,
    ) {}

    public function download(): StreamedResponse
    {
        $filename = 'able-security-report-'.now()->format('Y-m-d').'.csv';

        return Response::streamDownload(function () {
            $handle = fopen('php://output', 'w');

            if ($handle === false) {
                return;
            }

            // Summary Section
            fputcsv($handle, ['ABLE Security Overview Report']);
            fputcsv($handle, ['Generated', now()->format('F j, Y \a\t g:i A')]);
            fputcsv($handle, []);

            fputcsv($handle, ['SUMMARY METRICS']);
            fputcsv($handle, ['Metric', 'Value']);
            fputcsv($handle, ['Active Users', $this->summary['activeUsers']]);
            fputcsv($handle, ['Inactive Users', $this->summary['inactiveUsers']]);
            fputcsv($handle, ['Domain Visits', $this->summary['totalDomainVisits']]);
            fputcsv($handle, ['Egress Attempts', $this->summary['totalEgressAttempts']]);
            fputcsv($handle, ['Nudge Success Rate', $this->summary['nudgeSuccessRate'].'%']);
            fputcsv($handle, ['Data Saved', $this->summary['dataSaved']]);
            fputcsv($handle, ['Data Lost', $this->summary['dataLost']]);
            fputcsv($handle, ['Safe Domains', $this->summary['domainUsage']['safe']]);
            fputcsv($handle, ['Unsafe Domains', $this->summary['domainUsage']['unsafe']]);
            fputcsv($handle, ['Unlisted Domains', $this->summary['domainUsage']['unlisted']]);
            fputcsv($handle, []);

            // Egress Events Section
            fputcsv($handle, ['RECENT EGRESS EVENTS']);
            fputcsv($handle, ['Date', 'Domain', 'Domain Status', 'User ID', 'File Name', 'Action Taken']);
            foreach ($this->recentEgressEvents as $event) {
                fputcsv($handle, [
                    $event['occurred_at'],
                    $event['domain'],
                    strtoupper(str_replace('glass-', '', $event['status'])),
                    $event['user'] ?? '—',
                    $event['fileName'] ?? '—',
                    $event['action'],
                ]);
            }
            fputcsv($handle, []);

            // Domain Visits Section
            fputcsv($handle, ['RECENT DOMAIN VISITS']);
            fputcsv($handle, ['Date', 'Domain', 'Domain Status', 'User ID', 'Action Taken']);
            foreach ($this->recentDomainVisits as $visit) {
                fputcsv($handle, [
                    $visit['visited_at'],
                    $visit['domain'],
                    strtoupper(str_replace('glass-', '', $visit['status'])),
                    $visit['user'] ?? '—',
                    $visit['action'],
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }
}
