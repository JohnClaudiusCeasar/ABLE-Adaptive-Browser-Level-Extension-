export type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ActivityPoint {
    date: string;
    label: string;
    shortLabel: string;
    visits: number;
    egress: number;
}

export interface CategoryBreakdown {
    category: string;
    count: number;
    percentage: number;
    avgRisk: number;
}

export interface DomainTempData {
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

export interface IncidentEvent {
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

export interface ContainmentData {
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

export interface HighRiskDomain {
    id: number;
    domain: string;
    category: string;
    risk_score: number;
    domain_status: string;
    policy: string;
    active_users: number;
    visit_count: number;
}

export interface ReportMeta {
    generatedAt: string;
    isoDate: string;
    version: string;
    classification: string;
}

export interface ReportPreviewProps {
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
    shadowActivity: Record<Timeframe, ActivityPoint[]>;
    domainTemperature: Record<Timeframe, DomainTempData>;
    shadowIncidents: Record<Timeframe, IncidentEvent[]>;
    containmentTemperature: Record<Timeframe, ContainmentData>;
    highRiskDomains: HighRiskDomain[];
    reportMeta: ReportMeta;
}
