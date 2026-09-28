<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ABLE Security Analysis</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400..700&family=Unbounded:wght@600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400..700&family=Unbounded:wght@600;700;800;900&display=swap');

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        @page {
            margin: 10mm 12mm;
        }

        body {
            font-family: 'Archivo', 'Helvetica', 'Arial', sans-serif;
            font-size: 8.5px;
            color: #0f172a;
            background-color: #ffffff;
            line-height: 1.35;
        }

        /* Container Sheet */
        .sheet {
            background-color: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 16px 20px;
            border-radius: 4px;
            position: relative;
        }

        /* Document Header */
        .doc-header-table {
            width: 100%;
            border-bottom: 2px solid #059669;
            padding-bottom: 12px;
            margin-bottom: 14px;
        }

        .logo-box {
            width: 36px;
            height: 36px;
            background-color: #16a34a;
            color: #ffffff;
            font-size: 20px;
            font-weight: 900;
            text-align: center;
            line-height: 36px;
            border-radius: 6px;
        }

        .doc-title {
            font-family: 'Unbounded', 'Helvetica', 'Arial', sans-serif;
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        .doc-subtitle {
            font-size: 8px;
            color: #64748b;
            font-family: monospace;
            margin-top: 2px;
        }

        .badge-classification {
            background-color: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 7px;
            font-weight: bold;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            display: inline-block;
        }

        .meta-text {
            font-size: 7.5px;
            color: #64748b;
            margin-top: 2px;
        }

        .meta-mono {
            font-family: monospace;
            font-size: 7px;
            color: #64748b;
        }

        /* Metric Cards Grid */
        .metrics-table {
            width: 100%;
            margin-bottom: 14px;
            border-spacing: 6px 0;
            margin-left: -6px;
            margin-right: -6px;
        }

        .metric-cell {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 7px 9px;
            vertical-align: top;
        }

        .metric-label {
            font-size: 7px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: bold;
        }

        .metric-value {
            font-size: 15px;
            font-weight: 900;
            margin: 2px 0 1px 0;
        }

        .metric-sub {
            font-size: 6.5px;
            color: #94a3b8;
        }

        /* Sections */
        .section-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 12px;
            margin-bottom: 14px;
            page-break-inside: avoid;
        }

        .section-header-table {
            width: 100%;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 5px;
            margin-bottom: 8px;
        }

        .section-title {
            font-size: 9.5px;
            font-weight: bold;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .pill-badge {
            background-color: #e0f2fe;
            color: #0369a1;
            border: 1px solid #bae6fd;
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 6.5px;
            font-weight: bold;
            text-transform: uppercase;
            font-family: monospace;
            display: inline-block;
        }

        .pill-badge-amber {
            background-color: #fef3c7;
            color: #92400e;
            border: 1px solid #fde68a;
        }

        .pill-badge-red {
            background-color: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
        }

        .pill-badge-green {
            background-color: #dcfce7;
            color: #166534;
            border: 1px solid #bbf7d0;
        }

        .pill-badge-purple {
            background-color: #f3e8ff;
            color: #6b21a8;
            border: 1px solid #e9d5ff;
        }

        /* Chart Simulation in Blade */
        .chart-box {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 5px;
            padding: 8px 10px 4px 10px;
            margin-bottom: 8px;
        }

        .chart-table {
            width: 100%;
            border-collapse: collapse;
        }

        .chart-col {
            text-align: center;
            vertical-align: bottom;
            padding: 0 2px;
        }

        .bar-visit {
            display: inline-block;
            width: 8px;
            background-color: #0891b2;
            border-radius: 2px 2px 0 0;
            vertical-align: bottom;
            margin-right: 2px;
        }

        .bar-egress {
            display: inline-block;
            width: 8px;
            background-color: #f59e0b;
            border-radius: 2px 2px 0 0;
            vertical-align: bottom;
        }

        .chart-label {
            font-size: 6.5px;
            font-family: monospace;
            color: #475569;
            margin-top: 4px;
            text-align: center;
        }

        /* Tables */
        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7.5px;
            margin-top: 3px;
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
        }

        .data-table th {
            background-color: #f1f5f9;
            color: #475569;
            font-size: 7px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 4px 6px;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
        }

        .data-table td {
            padding: 4px 6px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
        }

        .data-table tr:last-child td {
            border-bottom: none;
        }

        .data-table tr:nth-child(even) {
            background-color: #fafafa;
        }

        /* Badges in tables */
        .status-pill {
            display: inline-block;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 6.5px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .status-pill-safe {
            background-color: #dcfce7;
            color: #15803d;
            border: 1px solid #bbf7d0;
        }

        .status-pill-unsafe {
            background-color: #fee2e2;
            color: #b91c1c;
            border: 1px solid #fecaca;
        }

        .status-pill-unlisted {
            background-color: #fef3c7;
            color: #b45309;
            border: 1px solid #fde68a;
        }

        /* Footer */
        .doc-footer-table {
            width: 100%;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            margin-top: 12px;
            font-size: 7px;
            color: #64748b;
        }

        .page-break {
            page-break-after: always;
            break-after: page;
        }
    </style>
</head>
<body>
    @php
        $showExec = !isset($includeExecutiveSummary) || $includeExecutiveSummary;
        $showAct = !isset($selectedSections['shadowActivity']) || $selectedSections['shadowActivity'];
        $showDt = !isset($selectedSections['domainTemperature']) || $selectedSections['domainTemperature'];
        $showInc = !isset($selectedSections['shadowIncidents']) || $selectedSections['shadowIncidents'];
        $showCnt = !isset($selectedSections['containmentTemperature']) || $selectedSections['containmentTemperature'];
        $showHr = !isset($selectedSections['highRiskDomains']) || $selectedSections['highRiskDomains'];

        $hasGroup1 = $showExec || $showAct || $showDt;
        $hasGroup2 = $showInc || $showCnt || $showHr;

        $totalPages = ($hasGroup1 && $hasGroup2) ? 2 : 1;
    @endphp

    @if($hasGroup1 || !$hasGroup2)
    <!-- ============================================================ -->
    <!-- SHEET 1 (PAGE 1)                                             -->
    <!-- ============================================================ -->
    <div class="sheet">
        <!-- Document Header -->
        <table class="doc-header-table">
            <tr>
                <td style="width: 42px; vertical-align: middle;">
                    <img src="{{ public_path('apple-touch-icon.png') }}" style="width: 38px; height: 38px; border-radius: 8px;" alt="ABLE Logo" />
                </td>
                <td style="vertical-align: middle; padding-left: 8px;">
                    <div class="doc-title">ABLE SECURITY ANALYSIS</div>
                    <div class="doc-subtitle">Adaptive Browser-Level Extension • {{ auth()->user()->email ?? 'admin@able.local' }}</div>
                </td>
                <td style="text-align: right; vertical-align: middle;">
                    <div class="badge-classification">{{ $reportMeta['classification'] ?? 'RESTRICTED / SECURITY TELEMETRY' }}</div>
                    <div class="meta-text">Generated: {{ $reportMeta['generatedAt'] ?? now()->format('F j, Y \a\t g:i A') }}</div>
                    <div class="meta-mono">SYSTEM ID: ABLE-SEC-{{ date('Y') }}-A4</div>
                </td>
            </tr>
        </table>

        <!-- Executive Summary Cards -->
        @if($showExec)
        <table class="metrics-table">
            <tr>
                <td class="metric-cell" style="width: 25%;">
                    <div class="metric-label">Active Users</div>
                    <div class="metric-value" style="color: #16a34a;">{{ $activeUsers }}</div>
                    <div class="metric-sub">Last 30 Days</div>
                </td>
                <td class="metric-cell" style="width: 25%;">
                    <div class="metric-label">Discovered Apps</div>
                    <div class="metric-value" style="color: #9333ea;">{{ count($highRiskDomains ?? []) }}</div>
                    <div class="metric-sub">Shadow Catalog</div>
                </td>
                <td class="metric-cell" style="width: 25%;">
                    <div class="metric-label">Critical Egress</div>
                    <div class="metric-value" style="color: #dc2626;">{{ $criticalEgressCount ?? 0 }}</div>
                    <div class="metric-sub">Risk Score &ge; 76</div>
                </td>
                <td class="metric-cell" style="width: 25%;">
                    <div class="metric-label">Containment Rate</div>
                    <div class="metric-value" style="color: #0284c7;">{{ $nudgeSuccessRate }}%</div>
                    <div class="metric-sub">Nudge Efficacy</div>
                </td>
            </tr>
        </table>
        @endif

        <!-- Empty State if all modules are disabled -->
        @if(!$hasGroup1 && !$hasGroup2)
        <div style="padding: 40px; text-align: center; color: #64748b; font-style: italic;">
            No telemetry modules selected.
        </div>
        @endif

        <!-- SECTION 1.1: SHADOW ACTIVITY -->
        @if($showAct)
        @php
            $actTf = $timeframes['shadowActivity'] ?? 'weekly';
            $actData = $shadowActivity[$actTf] ?? $shadowActivity['weekly'] ?? [];
            $totalVisits = array_sum(array_column($actData, 'visits'));
            $totalEgress = array_sum(array_column($actData, 'egress'));
            $dateRange = (count($actData) > 0) ? ($actData[0]['label'] . ' – ' . $actData[count($actData) - 1]['label']) : '—';
            $maxVisits = 10;
            foreach ($actData as $pt) {
                $maxVisits = max($maxVisits, $pt['visits'], $pt['egress']);
            }
        @endphp
        <div class="section-box">
            <table class="section-header-table">
                <tr>
                    <td class="section-title">1.1 Shadow Activity Breakdown</td>
                    <td style="text-align: right;">
                        <span class="pill-badge">Granularity: {{ strtoupper($actTf) }}</span>
                    </td>
                </tr>
            </table>

            <!-- Simulated Visual Chart -->
            <div class="chart-box">
                <table class="chart-table">
                    <tr>
                        @foreach($actData as $pt)
                        @php
                            $vH = max(4, round(($pt['visits'] / $maxVisits) * 48));
                            $eH = max(4, round(($pt['egress'] / $maxVisits) * 48));
                        @endphp
                        <td class="chart-col" style="height: 52px;">
                            <div class="bar-visit" style="height: {{ $vH }}px;"></div>
                            <div class="bar-egress" style="height: {{ $eH }}px;"></div>
                        </td>
                        @endforeach
                    </tr>
                    <tr>
                        @foreach($actData as $pt)
                        <td class="chart-label">{{ $pt['shortLabel'] }}</td>
                        @endforeach
                    </tr>
                </table>
            </div>

            <!-- Legend & Data Summary -->
            <table style="width: 100%; border-top: 1px solid #e2e8f0; padding-top: 4px; font-size: 7px; color: #64748b;">
                <tr>
                    <td style="width: 32%;">
                        <span style="display:inline-block; width:6px; height:6px; background-color:#0891b2; border-radius:1px; margin-right:2px; vertical-align:middle;"></span>
                        Total Visits: <strong style="color: #0f172a;">{{ number_format($totalVisits) }}</strong>
                    </td>
                    <td style="width: 32%;">
                        <span style="display:inline-block; width:6px; height:6px; background-color:#f59e0b; border-radius:1px; margin-right:2px; vertical-align:middle;"></span>
                        Total Egress: <strong style="color: #0f172a;">{{ number_format($totalEgress) }}</strong>
                    </td>
                    <td style="text-align: right; width: 36%;">
                        Range: {{ $dateRange }}
                    </td>
                </tr>
            </table>
        </div>
        @endif

        <!-- SECTION 1.2: DOMAIN TEMPERATURE -->
        @if($showDt)
        @php
            $dtTf = $timeframes['domainTemperature'] ?? 'weekly';
            $dtData = $domainTemperature[$dtTf] ?? $domainTemperature['weekly'] ?? [];
        @endphp
        <div class="section-box">
            <table class="section-header-table">
                <tr>
                    <td class="section-title">1.2 Domain Temperature &amp; Risk Posture</td>
                    <td style="text-align: right;">
                        <span class="pill-badge pill-badge-amber">Status: {{ $dtData['temperatureIndex'] ?? 'Nominal' }} Temperature</span>
                        <span class="pill-badge" style="margin-left: 4px;">{{ strtoupper($dtTf) }}</span>
                    </td>
                </tr>
            </table>

            <!-- Posture Breakdown 3 Columns -->
            <table style="width: 100%; border-spacing: 5px 0; margin-left: -5px; margin-right: -5px; margin-bottom: 8px;">
                <tr>
                    <td style="width: 33.33%; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; padding: 6px; text-align: center;">
                        <div style="font-size: 6.5px; color: #047857; font-weight: bold; text-transform: uppercase;">Safe Domains</div>
                        <div style="font-size: 13px; font-weight: bold; color: #064e3b; margin: 1px 0;">{{ $dtData['safe'] ?? $domainUsage['safe'] }}</div>
                        <div style="font-size: 6.5px; color: #059669;">{{ $dtData['safePct'] ?? 0 }}% of catalog</div>
                    </td>
                    <td style="width: 33.33%; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 6px; text-align: center;">
                        <div style="font-size: 6.5px; color: #b45309; font-weight: bold; text-transform: uppercase;">Unlisted Domains</div>
                        <div style="font-size: 13px; font-weight: bold; color: #78350f; margin: 1px 0;">{{ $dtData['unlisted'] ?? $domainUsage['unlisted'] }}</div>
                        <div style="font-size: 6.5px; color: #d97706;">{{ $dtData['unlistedPct'] ?? 0 }}% of catalog</div>
                    </td>
                    <td style="width: 33.33%; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; padding: 6px; text-align: center;">
                        <div style="font-size: 6.5px; color: #be123c; font-weight: bold; text-transform: uppercase;">Unsafe / Blacklisted</div>
                        <div style="font-size: 13px; font-weight: bold; color: #881337; margin: 1px 0;">{{ $dtData['unsafe'] ?? $domainUsage['unsafe'] }}</div>
                        <div style="font-size: 6.5px; color: #e11d48;">{{ $dtData['unsafePct'] ?? 0 }}% of catalog</div>
                    </td>
                </tr>
            </table>

            <!-- Categories Distribution with Visual Progress Bars -->
            @if(isset($dtData['categories']) && count($dtData['categories']) > 0)
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px;">
                <div style="font-size: 7px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 4px;">Top Cloud Categories Risk Distribution</div>
                <table style="width: 100%; border-collapse: collapse; font-size: 7px;">
                    @foreach($dtData['categories'] as $cat)
                    @php
                        $barColor = ($cat['avgRisk'] >= 75) ? '#ef4444' : (($cat['avgRisk'] >= 45) ? '#f59e0b' : '#10b981');
                    @endphp
                    <tr>
                        <td style="width: 28%; padding: 2.5px 0; font-weight: bold; color: #1e293b;">{{ $cat['category'] }}</td>
                        <td style="width: 44%; padding: 2.5px 4px;">
                            <div style="background-color: #f1f5f9; height: 5px; border-radius: 3px; overflow: hidden; width: 100%;">
                                <div style="background-color: {{ $barColor }}; width: {{ max(4, $cat['percentage']) }}%; height: 5px; border-radius: 3px;"></div>
                            </div>
                        </td>
                        <td style="width: 16%; padding: 2.5px 4px; font-family: monospace; color: #475569; text-align: right;">
                            {{ $cat['count'] }} ({{ $cat['percentage'] }}%)
                        </td>
                        <td style="width: 12%; padding: 2.5px 0; text-align: right;">
                            <span class="status-pill {{ ($cat['avgRisk'] >= 75) ? 'status-pill-unsafe' : (($cat['avgRisk'] >= 45) ? 'status-pill-unlisted' : 'status-pill-safe') }}">
                                Risk {{ $cat['avgRisk'] }}
                            </span>
                        </td>
                    </tr>
                    @endforeach
                </table>
            </div>
            @endif
        </div>
        @endif

        <!-- Document Footer for Page 1 -->
        <table class="doc-footer-table">
            <tr>
                <td style="width: 50%;">
                    ABLE Network Security • Confidential Document
                </td>
                <td style="width: 30%; text-align: right;">
                    {{ $totalPages === 1 ? 'SIGN-OFF: ___________________' : '' }}
                </td>
                <td style="width: 20%; text-align: right; font-family: monospace;">
                    PAGE 1 OF {{ $totalPages }}
                </td>
            </tr>
        </table>
    </div>
    @endif

    @if($hasGroup2)
        @if($hasGroup1)
        <div class="page-break"></div>
        @endif

        <!-- ============================================================ -->
        <!-- SHEET 2 (PAGE 2)                                             -->
        <!-- ============================================================ -->
        <div class="sheet">
            <!-- Document Continuation Header -->
            <table class="doc-header-table">
                <tr>
                    <td style="width: 42px; vertical-align: middle;">
                        <img src="{{ public_path('apple-touch-icon.png') }}" style="width: 38px; height: 38px; border-radius: 8px;" alt="ABLE Logo" />
                    </td>
                    <td style="vertical-align: middle; padding-left: 8px;">
                        <div class="doc-title">ABLE SECURITY ANALYSIS</div>
                        <div class="doc-subtitle">Incident, Containment &amp; High Risk Domain Telemetry</div>
                    </td>
                    <td style="text-align: right; vertical-align: middle;">
                        <div class="badge-classification">{{ $reportMeta['classification'] ?? 'RESTRICTED / SECURITY TELEMETRY' }}</div>
                        <div class="meta-text">Generated: {{ $reportMeta['generatedAt'] ?? now()->format('F j, Y \a\t g:i A') }}</div>
                        <div class="meta-mono">PAGE {{ $totalPages === 2 ? '2 OF 2' : '1 OF 1' }}</div>
                    </td>
                </tr>
            </table>

            <!-- SECTION 1.3: SHADOW INCIDENTS -->
            @if($showInc)
            @php
                $incTf = $timeframes['shadowIncidents'] ?? 'weekly';
                $incData = $shadowIncidents[$incTf] ?? $shadowIncidents['weekly'] ?? [];
            @endphp
            <div class="section-box">
                <table class="section-header-table">
                    <tr>
                        <td class="section-title">1.3 Shadow Incidents &amp; Egress Violations</td>
                        <td style="text-align: right;">
                            <span class="pill-badge pill-badge-red">{{ count($incData) }} Recent Incidents</span>
                            <span class="pill-badge" style="margin-left: 4px;">{{ strtoupper($incTf) }}</span>
                        </td>
                    </tr>
                </table>

                @if(count($incData) > 0)
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 20%;">Date / Time</th>
                            <th style="width: 22%;">Target Domain</th>
                            <th style="width: 14%;">User ID</th>
                            <th style="width: 24%;">File / Payload</th>
                            <th style="width: 10%;">Risk</th>
                            <th style="width: 10%;">Outcome</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach(array_slice($incData, 0, 8) as $event)
                        <tr>
                            <td style="font-family: monospace;">{{ $event['dateFormatted'] ?? (isset($event['occurred_at']) ? \Carbon\Carbon::parse($event['occurred_at'])->format('M j, Y g:i A') : '—') }}</td>
                            <td><strong>{{ $event['domain'] ?? '—' }}</strong></td>
                            <td style="font-family: monospace;">{{ $event['user'] ?? '—' }}</td>
                            <td>{{ $event['fileName'] ?? '—' }} ({{ $event['fileSize'] ?? '0 B' }})</td>
                            <td>
                                <span class="status-pill {{ ($event['risk_score'] >= 76) ? 'status-pill-unsafe' : 'status-pill-unlisted' }}">
                                    {{ $event['risk_score'] ?? '—' }}
                                </span>
                            </td>
                            <td>
                                <span class="status-pill {{ strtolower($event['action'] ?? '') === 'denied' ? 'status-pill-safe' : 'status-pill-unsafe' }}">
                                    {{ $event['action'] ?? '—' }}
                                </span>
                            </td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
                @else
                <p style="color: #64748b; font-style: italic; padding: 6px 0;">No critical egress incidents recorded in this timeframe.</p>
                @endif
            </div>
            @endif

            <!-- SECTION 1.4: CONTAINMENT TEMPERATURE -->
            @if($showCnt)
            @php
                $cntTf = $timeframes['containmentTemperature'] ?? 'weekly';
                $cntData = $containmentTemperature[$cntTf] ?? $containmentTemperature['weekly'] ?? [];
                $cntRate = (float) ($cntData['containmentRate'] ?? $nudgeSuccessRate ?? 0);
            @endphp
            <div class="section-box">
                <table class="section-header-table">
                    <tr>
                        <td class="section-title">1.4 Containment Temperature &amp; Data Safeguards</td>
                        <td style="text-align: right;">
                            <span class="pill-badge pill-badge-green">{{ $cntData['statusLabel'] ?? 'Optimal Containment' }}</span>
                            <span class="pill-badge" style="margin-left: 4px;">{{ strtoupper($cntTf) }}</span>
                        </td>
                    </tr>
                </table>

                <table style="width: 100%; border-spacing: 6px 0; margin-left: -6px; margin-right: -6px;">
                    <tr>
                        <!-- Containment Rate Card with Visual Bar -->
                        <td style="width: 50%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 7px 9px; vertical-align: top;">
                            <table style="width: 100%;">
                                <tr>
                                    <td style="font-size: 7.5px; color: #1e293b; font-weight: bold;">Interception Containment Rate</td>
                                    <td style="text-align: right; font-size: 13px; font-weight: bold; color: #15803d; font-family: monospace;">
                                        {{ $cntRate }}%
                                    </td>
                                </tr>
                            </table>

                            <!-- Dual-colored Progress Bar -->
                            <table style="width: 100%; border-collapse: collapse; margin: 4px 0;">
                                <tr>
                                    <td style="background-color: #10b981; width: {{ max(1, $cntRate) }}%; height: 6px; border-radius: 3px 0 0 3px;"></td>
                                    <td style="background-color: #ef4444; width: {{ max(1, 100 - $cntRate) }}%; height: 6px; border-radius: 0 3px 3px 0;"></td>
                                </tr>
                            </table>

                            <table style="width: 100%; font-size: 6.5px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 3px; margin-top: 3px;">
                                <tr>
                                    <td>Nudges Cancelled: <strong style="color: #15803d; font-family: monospace;">{{ number_format($cntData['cancelled'] ?? 0) }}</strong></td>
                                    <td style="text-align: right;">User Proceeded: <strong style="color: #b91c1c; font-family: monospace;">{{ number_format($cntData['proceeded'] ?? 0) }}</strong></td>
                                </tr>
                            </table>
                        </td>

                        <!-- Data Protection Volume Card -->
                        <td style="width: 50%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 7px 9px; vertical-align: top;">
                            <div style="font-size: 7.5px; color: #1e293b; font-weight: bold;">Exfiltration Data Protection Volume</div>
                            <table style="width: 100%; margin-top: 3px; border-spacing: 4px 0;">
                                <tr>
                                    <td style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; padding: 4px; text-align: center; width: 50%;">
                                        <div style="font-size: 6px; color: #047857; font-weight: bold; text-transform: uppercase;">DATA SAVED</div>
                                        <div style="font-size: 11px; font-weight: bold; color: #065f46; font-family: monospace; margin-top: 1px;">{{ $cntData['dataSaved'] ?? $dataSaved }}</div>
                                    </td>
                                    <td style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; padding: 4px; text-align: center; width: 50%;">
                                        <div style="font-size: 6px; color: #be123c; font-weight: bold; text-transform: uppercase;">DATA LOST</div>
                                        <div style="font-size: 11px; font-weight: bold; color: #881337; font-family: monospace; margin-top: 1px;">{{ $cntData['dataLost'] ?? $dataLost }}</div>
                                    </td>
                                </tr>
                            </table>
                            <div style="font-size: 6px; color: #94a3b8; text-align: center; margin-top: 3px;">
                                Telemetry calculated from browser file upload intercept actions.
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
            @endif

            <!-- SECTION 1.5: HIGH RISK DOMAINS -->
            @if($showHr)
            @php
                $highRiskList = $filteredHighRiskDomains ?? $highRiskDomains ?? [];
            @endphp
            @if(count($highRiskList) > 0)
            <div class="section-box">
                <table class="section-header-table">
                    <tr>
                        <td class="section-title">1.5 High Risk Shadow Domains Catalog</td>
                        <td style="text-align: right;">
                            <span class="pill-badge pill-badge-purple">Showing Top {{ count($highRiskList) }} Domains (Score &ge; {{ $minRiskScore ?? 75 }})</span>
                        </td>
                    </tr>
                </table>

                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 28%;">Domain</th>
                            <th style="width: 20%;">Category</th>
                            <th style="width: 18%;">Policy</th>
                            <th style="width: 10%;">Adopters</th>
                            <th style="width: 10%;">Visits</th>
                            <th style="width: 14%; text-align: right;">Risk Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach(array_slice($highRiskList, 0, 10) as $dom)
                        <tr>
                            <td><strong>{{ $dom['domain'] }}</strong></td>
                            <td>{{ $dom['category'] }}</td>
                            <td>
                                <span class="status-pill {{ ($dom['policy'] === 'whitelisted') ? 'status-pill-safe' : (($dom['policy'] === 'blacklisted') ? 'status-pill-unsafe' : 'status-pill-unlisted') }}">
                                    {{ strtoupper(str_replace('_', ' ', $dom['policy'])) }}
                                </span>
                            </td>
                            <td>{{ $dom['active_users'] }}</td>
                            <td>{{ $dom['visit_count'] }}</td>
                            <td style="text-align: right;">
                                <span class="status-pill status-pill-unsafe">
                                    {{ $dom['risk_score'] }} / 100
                                </span>
                            </td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
            @endif
            @endif

            <!-- Document Footer for Page 2 -->
            <table class="doc-footer-table">
                <tr>
                    <td style="width: 50%;">
                        ABLE Network Security • Confidential Document
                    </td>
                    <td style="width: 30%; text-align: right;">
                        SIGN-OFF: ___________________
                    </td>
                    <td style="width: 20%; text-align: right; font-family: monospace;">
                        PAGE {{ $totalPages === 2 ? '2 OF 2' : '1 OF 1' }}
                    </td>
                </tr>
            </table>
        </div>
    @endif
</body>
</html>
