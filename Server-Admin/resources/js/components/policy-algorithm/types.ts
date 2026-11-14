export interface DomainPolicy {
    id: number;
    domain: string;
    domain_status: 'safe' | 'unsafe' | 'unlisted';
    policy: 'whitelisted' | 'blacklisted' | 'under_review';
    block_access: boolean;
    category: string | null;
    classification_source: string | null;
    confidence: number | null;
    risk_score: number;
    visit_count: number;
    last_visited_at: string | null;
    last_source: string | null;
    created_at: string;
    updated_at: string;
}

export interface DomainPolicyFormData {
    domain: string;
    domain_status: 'safe' | 'unsafe' | 'unlisted';
    policy: 'whitelisted' | 'blacklisted' | 'under_review';
    block_access: boolean;
    category: string;
    classification_source: string;
    confidence: number | null;
    risk_score: number;
}

export interface DomainVisitRecord {
    id: number;
    domain_policy_id: number;
    domain: string;
    user_id: string | null;
    visited_at: string;
}

export interface CategoryOption {
    name: string;
    detail: string;
}
