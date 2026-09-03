<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ABLE Security Overview Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Helvetica', sans-serif;
            font-size: 12px;
            color: #1a1a1a;
            line-height: 1.5;
        }

        .header {
            background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
            color: white;
            padding: 30px;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 5px;
        }

        .header .subtitle {
            font-size: 14px;
            opacity: 0.9;
        }

        .header .date {
            font-size: 12px;
            opacity: 0.8;
            margin-top: 10px;
        }

        .section {
            margin-bottom: 25px;
            page-break-inside: avoid;
        }

        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #16a34a;
            border-bottom: 2px solid #16a34a;
            padding-bottom: 5px;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .metrics-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 20px;
        }

        .metric-card {
            flex: 1;
            min-width: 120px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }

        .metric-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #16a34a;
        }

        .metric-card .label {
            font-size: 11px;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .metric-card.danger .value {
            color: #dc3545;
        }

        .metric-card.warning .value {
            color: #ffc107;
        }

        .metric-card.info .value {
            color: #0d6efd;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 11px;
        }

        th {
            background: #16a34a;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        td {
            padding: 8px;
            border-bottom: 1px solid #e9ecef;
        }

        tr:nth-child(even) {
            background: #f8f9fa;
        }

        .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-safe {
            background: #d1fae5;
            color: #065f46;
        }

        .status-unsafe {
            background: #fee2e2;
            color: #991b1b;
        }

        .status-unlisted {
            background: #fef3c7;
            color: #92400e;
        }

        .footer {
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid #e9ecef;
            font-size: 10px;
            color: #6c757d;
            text-align: center;
        }

        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>ABLE Security Overview</h1>
        <div class="subtitle">Extension Network Activity Report</div>
        <div class="date">Generated: {{ now()->format('F j, Y \a\t g:i A') }}</div>
    </div>

    <div class="section">
        <div class="section-title">Summary Metrics</div>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="value">{{ $activeUsers }}</div>
                <div class="label">Active Users</div>
            </div>
            <div class="metric-card danger">
                <div class="value">{{ $inactiveUsers }}</div>
                <div class="label">Inactive Users</div>
            </div>
            <div class="metric-card info">
                <div class="value">{{ number_format($totalDomainVisits) }}</div>
                <div class="label">Domain Visits</div>
            </div>
            <div class="metric-card warning">
                <div class="value">{{ number_format($totalEgressAttempts) }}</div>
                <div class="label">Egress Attempts</div>
            </div>
            <div class="metric-card">
                <div class="value">{{ $nudgeSuccessRate }}%</div>
                <div class="label">Nudge Success</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Domain Usage</div>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="value">{{ number_format($domainUsage['safe']) }}</div>
                <div class="label">Safe Domains</div>
            </div>
            <div class="metric-card danger">
                <div class="value">{{ number_format($domainUsage['unsafe']) }}</div>
                <div class="label">Unsafe Domains</div>
            </div>
            <div class="metric-card warning">
                <div class="value">{{ number_format($domainUsage['unlisted']) }}</div>
                <div class="label">Unlisted Domains</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Data Protection</div>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="value">{{ $dataSaved }}</div>
                <div class="label">Data Saved</div>
            </div>
            <div class="metric-card danger">
                <div class="value">{{ $dataLost }}</div>
                <div class="label">Data Lost</div>
            </div>
        </div>
    </div>

    <div class="section page-break">
        <div class="section-title">Recent Egress Events</div>
        @if(count($recentEgressEvents) > 0)
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>User ID</th>
                    <th>File Name</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                @foreach($recentEgressEvents as $event)
                <tr>
                    <td>{{ \Carbon\Carbon::parse($event['occurred_at'])->format('M j, Y g:i A') }}</td>
                    <td>{{ $event['domain'] }}</td>
                    <td>
                        <span class="status-badge status-{{ str_replace('glass-', '', $event['status']) }}">
                            {{ strtoupper(str_replace('glass-', '', $event['status'])) }}
                        </span>
                    </td>
                    <td>{{ $event['user'] ?? '—' }}</td>
                    <td>{{ $event['fileName'] ?? '—' }}</td>
                    <td>{{ $event['action'] }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
        @else
        <p style="color: #6c757d; font-style: italic;">No egress events recorded.</p>
        @endif
    </div>

    <div class="section">
        <div class="section-title">Recent Domain Visits</div>
        @if(count($recentDomainVisits) > 0)
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>URL</th>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>User ID</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                @foreach($recentDomainVisits as $visit)
                <tr>
                    <td>{{ \Carbon\Carbon::parse($visit['visited_at'])->format('M j, Y g:i A') }}</td>
                    <td>{{ Str::limit($visit['url'], 30) }}</td>
                    <td>{{ $visit['domain'] }}</td>
                    <td>
                        <span class="status-badge status-{{ str_replace('glass-', '', $visit['status']) }}">
                            {{ strtoupper(str_replace('glass-', '', $visit['status'])) }}
                        </span>
                    </td>
                    <td>{{ $visit['user'] ?? '—' }}</td>
                    <td>{{ $visit['action'] }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
        @else
        <p style="color: #6c757d; font-style: italic;">No domain visits recorded.</p>
        @endif
    </div>

    <div class="footer">
        ABLE - Adaptive Browser Level Extension &copy; {{ date('Y') }} | This report is confidential and intended for authorized personnel only.
    </div>
</body>
</html>
