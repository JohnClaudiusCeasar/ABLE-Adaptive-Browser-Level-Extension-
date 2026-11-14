import { Head, router, usePage } from '@inertiajs/react';
import {
    Search,
    ExternalLink,
    Pencil,
    Trash2,
    Plus,
    ArrowUpDown,
    Layers,
    Trash,
    Eye,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState, useMemo } from 'react';
import DomainPolicyController from '@/actions/App/Http/Controllers/DomainPolicyController';
import { TablePagination } from '@/components/pagination';
import { DeletePolicyModals } from '@/components/policy-algorithm/DeletePolicyModals';
import { DomainDetailModal } from '@/components/policy-algorithm/DomainDetailModal';
import { DomainPolicyFormModal } from '@/components/policy-algorithm/DomainPolicyFormModal';
import type {
    CategoryOption,
    DomainPolicy,
    DomainPolicyFormData,
    DomainVisitRecord,
} from '@/components/policy-algorithm/types';
import { RowLimitNotice } from '@/components/row-limit-notice';
import { Badge } from '@/components/ui/badge';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface PageProps {
    domainPolicies: DomainPolicy[];
    truncated?: boolean;
    rowLimit?: number;
    categories: CategoryOption[];
    [key: string]: unknown;
}

const emptyForm: DomainPolicyFormData = {
    domain: '',
    domain_status: 'unlisted',
    policy: 'under_review',
    block_access: false,
    category: '',
    classification_source: '',
    confidence: null,
    risk_score: 60,
};

const ROWS_PER_PAGE = 5;

type SortField = 'domain' | 'date' | 'risk_score';
type SortDir = 'asc' | 'desc';
type GroupField = 'none' | 'domain_status' | 'policy';

const statusBadgeVariant: Record<
    string,
    'glass-safe' | 'glass-unsafe' | 'glass-unlisted'
> = {
    safe: 'glass-safe',
    unsafe: 'glass-unsafe',
    unlisted: 'glass-unlisted',
};

const policyBadgeVariant: Record<
    string,
    'glass-safe' | 'glass-unsafe' | 'glass-unlisted'
> = {
    whitelisted: 'glass-safe',
    blacklisted: 'glass-unsafe',
    under_review: 'glass-unlisted',
};

const statusLabels: Record<string, string> = {
    safe: 'Safe',
    unsafe: 'Unsafe',
    unlisted: 'Unlisted',
};

const policyLabels: Record<string, string> = {
    whitelisted: 'Whitelisted',
    blacklisted: 'Blacklisted',
    under_review: 'Under Review',
};

export default function PolicyAlgorithm() {
    const { domainPolicies, truncated, rowLimit, categories } =
        usePage<PageProps>().props;

    const initialHighlight =
        typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('highlight')
            : null;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<DomainPolicyFormData>(emptyForm);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [currentPage, setCurrentPage] = useState(() => {
        if (!initialHighlight || !domainPolicies.length) {
            return 1;
        }

        const sorted = [...domainPolicies].sort((a, b) =>
            a.domain.localeCompare(b.domain),
        );
        const index = sorted.findIndex((p) => p.domain === initialHighlight);

        if (index === -1) {
            return 1;
        }

        return Math.floor(index / ROWS_PER_PAGE) + 1;
    });
    const [sortField, setSortField] = useState<SortField>('domain');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [groupField, setGroupField] = useState<GroupField>('none');
    const [highlightDomain, setHighlightDomain] = useState<string | null>(
        initialHighlight,
    );

    // Form state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Domain detail modal state
    const [selectedDomain, setSelectedDomain] = useState<DomainPolicy | null>(
        null,
    );
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [domainVisits, setDomainVisits] = useState<DomainVisitRecord[]>([]);
    const [visitsLoading, setVisitsLoading] = useState(false);
    const [visitsPagination, setVisitsPagination] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
    });
    const [visitMetrics, setVisitMetrics] = useState({
        visit_count: 0,
        active_users: 0,
    });

    // Scroll to the highlighted row and remove the glow after a few seconds.
    useEffect(() => {
        if (!highlightDomain) {
            return;
        }

        const timer = setTimeout(() => {
            const row = document.querySelector('tr[data-highlight="true"]');

            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 50);

        const cleanup = setTimeout(() => {
            setHighlightDomain(null);
        }, 8000);

        return () => {
            clearTimeout(timer);
            clearTimeout(cleanup);
        };
    }, [highlightDomain]);

    // Filter, sort, group logic
    const processedPolicies = useMemo(() => {
        let items = [...domainPolicies];

        // Filter by search
        if (searchQuery) {
            items = items.filter((p) =>
                p.domain.toLowerCase().includes(searchQuery.toLowerCase()),
            );
        }

        // Sort
        items.sort((a, b) => {
            let cmp = 0;

            switch (sortField) {
                case 'domain':
                    cmp = a.domain.localeCompare(b.domain);
                    break;
                case 'date':
                    cmp =
                        new Date(a.last_visited_at ?? 0).getTime() -
                        new Date(b.last_visited_at ?? 0).getTime();
                    break;
                case 'risk_score':
                    cmp = a.risk_score - b.risk_score;
                    break;
            }

            return sortDir === 'asc' ? cmp : -cmp;
        });

        return items;
    }, [domainPolicies, searchQuery, sortField, sortDir]);

    // Group the processed items
    const groupedPolicies = useMemo(() => {
        if (groupField === 'none') {
            return null;
        }

        const groups: Record<string, DomainPolicy[]> = {};

        for (const item of processedPolicies) {
            const key =
                groupField === 'domain_status'
                    ? statusLabels[item.domain_status]
                    : policyLabels[item.policy];

            if (!groups[key]) {
                groups[key] = [];
            }

            groups[key].push(item);
        }

        return groups;
    }, [processedPolicies, groupField]);

    // Pagination
    const totalPages = Math.max(
        1,
        Math.ceil(processedPolicies.length / ROWS_PER_PAGE),
    );
    // Clamp to a valid page when filters change, so the current page
    // naturally resets if it falls past the last page.
    const safePage = Math.min(currentPage, totalPages);
    const paginatedItems = useMemo(() => {
        if (groupField !== 'none') {
            return processedPolicies;
        } // No pagination when grouped

        const start = (safePage - 1) * ROWS_PER_PAGE;

        return processedPolicies.slice(start, start + ROWS_PER_PAGE);
    }, [processedPolicies, safePage, groupField]);

    function openAddModal() {
        setEditingId(null);
        setForm(emptyForm);
        setShowModal(true);
    }

    function openEditModal(policy: DomainPolicy) {
        setEditingId(policy.id);
        setForm({
            domain: policy.domain,
            domain_status: policy.domain_status,
            policy: policy.policy,
            block_access:
                policy.policy === 'blacklisted' && !!policy.block_access,
            category: policy.category || '',
            classification_source: policy.classification_source || '',
            confidence: policy.confidence,
            risk_score: policy.risk_score,
        });
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingId(null);
        setForm(emptyForm);
        setFormErrors({});
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        setFormErrors({});

        const options = {
            onSuccess: () => closeModal(),
            onError: (errors: Record<string, string>) => {
                setFormErrors(errors);
                setIsSubmitting(false);
            },
            onFinish: () => setIsSubmitting(false),
        };

        if (editingId) {
            router.patch(
                DomainPolicyController.update.url(editingId),
                form as any,
                options,
            );
        } else {
            router.post(
                DomainPolicyController.store.url(),
                form as any,
                options,
            );
        }
    }

    function handleDelete(id: number) {
        router.delete(DomainPolicyController.destroy.url(id), {
            onSuccess: () => setDeleteConfirmId(null),
        });
    }

    function handleDeleteAll() {
        router.delete(DomainPolicyController.destroyAll.url(), {
            onSuccess: () => setDeleteAllConfirm(false),
        });
    }

    function formatDomainUrl(domain: string): string {
        return `https://${domain}`;
    }

    function getDomainNameWithoutTLD(domain: string): string {
        const parts = domain.split('.');

        if (parts.length > 1) {
            return parts[0];
        }

        return domain;
    }

    async function fetchDomainVisits(domainPolicyId: number, page: number = 1) {
        setVisitsLoading(true);

        try {
            const url = DomainPolicyController.getDomainVisits.url(
                domainPolicyId,
                {
                    query: {
                        page: page.toString(),
                        per_page: visitsPagination.per_page.toString(),
                    },
                },
            );

            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                setDomainVisits(data.visits);
                setVisitsPagination({
                    current_page: data.current_page,
                    last_page: data.last_page,
                    per_page: data.per_page,
                    total: data.total,
                });
                setVisitMetrics({
                    visit_count:
                        data.visit_count ??
                        selectedDomain?.visit_count ??
                        data.total ??
                        0,
                    active_users: data.active_users ?? 0,
                });
            }
        } catch (error) {
            console.error('Failed to fetch domain visits:', error);
        } finally {
            setVisitsLoading(false);
        }
    }

    function openDetailModal(domain: DomainPolicy) {
        setSelectedDomain(domain);
        setShowDetailModal(true);
        setVisitMetrics({
            visit_count: domain.visit_count || 0,
            active_users: 0,
        });
        fetchDomainVisits(domain.id, 1);
    }

    function closeDetailModal() {
        setShowDetailModal(false);
        setSelectedDomain(null);
        setDomainVisits([]);
        setVisitMetrics({
            visit_count: 0,
            active_users: 0,
        });
    }

    function handleVisitsPageChange(page: number) {
        if (selectedDomain) {
            fetchDomainVisits(selectedDomain.id, page);
        }
    }

    function renderTableRows(items: DomainPolicy[], isGrouped = false) {
        return items.map((d) => (
            <tr
                key={d.id}
                data-highlight={d.domain === highlightDomain ? 'true' : 'false'}
                className={`border-b border-black/10 transition-all last:border-b-0 dark:border-white/10 ${
                    d.domain === highlightDomain ? 'highlight-glow' : ''
                }`}
            >
                <td className={`px-4 py-4 ${isGrouped ? 'w-[28%]' : ''}`}>
                    <a
                        href={formatDomainUrl(d.domain)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-able-green"
                    >
                        <span className="max-w-[200px] truncate">
                            {d.domain}
                        </span>
                        <ExternalLink
                            size={14}
                            className="shrink-0 text-muted-foreground"
                        />
                    </a>
                </td>
                <td className={`px-4 py-4 ${isGrouped ? 'w-[16%]' : ''}`}>
                    <Badge variant={statusBadgeVariant[d.domain_status]}>
                        {statusLabels[d.domain_status]}
                    </Badge>
                </td>
                <td className={`px-4 py-4 ${isGrouped ? 'w-[16%]' : ''}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={policyBadgeVariant[d.policy]}>
                            {policyLabels[d.policy]}
                        </Badge>
                        {d.block_access && (
                            <Badge
                                variant="outline"
                                className="border-red-500/50 bg-red-500/10 text-red-400"
                            >
                                Blocked
                            </Badge>
                        )}
                    </div>
                </td>
                <td
                    className={`px-4 py-4 text-muted-foreground ${isGrouped ? 'w-[16%] truncate' : ''}`}
                >
                    {d.category || '—'}
                </td>
                <td
                    className={`px-4 py-4 ${isGrouped ? 'w-[12%]' : ''} ${d.risk_score > 0 ? 'font-semibold text-[#f87171]' : 'text-muted-foreground'}`}
                >
                    {d.risk_score}
                </td>
                <td className={`px-4 py-4 ${isGrouped ? 'w-[12%]' : ''}`}>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => openDetailModal(d)}
                            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green"
                            title="View Details"
                        >
                            <Eye size={16} />
                        </button>
                        <button
                            onClick={() => openEditModal(d)}
                            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green"
                            title="Edit"
                        >
                            <Pencil size={16} />
                        </button>
                        <button
                            onClick={() => setDeleteConfirmId(d.id)}
                            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[rgba(248,113,113,0.1)] hover:text-[#f87171]"
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </td>
            </tr>
        ));
    }

    function renderGroupedContent() {
        if (!groupedPolicies) {
            return null;
        }

        const groupKeys = Object.keys(groupedPolicies);

        if (groupKeys.length === 0) {
            return (
                <div className="py-10 text-center text-muted-foreground">
                    {searchQuery
                        ? 'No domains match your search.'
                        : 'No domain policies yet. Click "Add Domain" to create one.'}
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-6">
                {groupKeys.map((groupKey) => {
                    const items = groupedPolicies[groupKey];
                    const isScrollable = items.length > 5;

                    return (
                        <div
                            key={groupKey}
                            className="overflow-hidden rounded-lg border border-[rgba(34,197,94,0.3)] bg-black/[0.02] shadow-xs dark:bg-white/[0.02]"
                        >
                            {/* Group Header Banner */}
                            <div className="flex items-center justify-between border-b border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] px-5 py-3">
                                <span className="text-sm font-bold tracking-wider text-able-green uppercase">
                                    {groupKey}
                                </span>
                                <span className="rounded-full bg-able-green/15 px-2.5 py-0.5 text-xs font-semibold text-able-green">
                                    {items.length}{' '}
                                    {items.length === 1 ? 'Domain' : 'Domains'}
                                </span>
                            </div>

                            {/* Static Column Headers (Blends with Card Gradient Background) */}
                            <div className="border-b border-[rgba(34,197,94,0.3)] bg-transparent">
                                <table className="w-full table-fixed border-collapse text-left text-[0.95rem]">
                                    <thead>
                                        <tr>
                                            <th className="w-[28%] px-4 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                                Domain Name
                                            </th>
                                            <th className="w-[16%] px-4 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                                Domain Status
                                            </th>
                                            <th className="w-[16%] px-4 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                                Policy
                                            </th>
                                            <th className="w-[16%] px-4 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                                Category
                                            </th>
                                            <th className="w-[12%] px-4 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                                Risk Score
                                            </th>
                                            <th className="w-[12%] px-4 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                </table>
                            </div>

                            {/* Scrollable Body Rows (Scrollbar starts below column header area) */}
                            <div
                                className={`overflow-x-auto ${
                                    isScrollable
                                        ? 'max-h-[300px] scrollbar-thin scrollbar-thumb-[rgba(34,197,94,0.4)] scrollbar-track-transparent overflow-y-auto'
                                        : ''
                                }`}
                            >
                                <table className="w-full table-fixed border-collapse text-left text-[0.95rem]">
                                    <tbody>
                                        {renderTableRows(items, true)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    function renderUngroupedContent() {
        if (paginatedItems.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td
                            colSpan={6}
                            className="py-10 text-center text-muted-foreground"
                        >
                            {searchQuery
                                ? 'No domains match your search.'
                                : 'No domain policies yet. Click "Add Domain" to create one.'}
                        </td>
                    </tr>
                </tbody>
            );
        }

        return <tbody>{renderTableRows(paginatedItems)}</tbody>;
    }

    return (
        <>
            <Head title="Domain Policy" />
            <style>{`
@keyframes highlight-pulse {
    0%,
    100% {
        background-color: rgba(34, 197, 94, 0.04);
    }
    50% {
        background-color: rgba(34, 197, 94, 0.14);
    }
}

@keyframes highlight-sweep {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -100% 0;
    }
}

@keyframes highlight-edge-glow {
    0%,
    100% {
        box-shadow:
            inset 0 2px 0 rgba(34, 197, 94, 0.35),
            inset 0 -2px 0 rgba(34, 197, 94, 0.35);
    }
    50% {
        box-shadow:
            inset 0 2px 0 rgba(34, 197, 94, 0.95),
            inset 0 -2px 0 rgba(34, 197, 94, 0.95),
            inset 0 9px 16px -10px rgba(34, 197, 94, 0.85),
            inset 0 -9px 16px -10px rgba(34, 197, 94, 0.85);
    }
}

/* The row wrapper is the <tr>; browsers do not paint box-shadow on table
   rows, so the glow is painted on its cells instead. */
.highlight-glow {
    background-image: linear-gradient(
        100deg,
        transparent 20%,
        rgba(34, 197, 94, 0.08) 35%,
        rgba(34, 197, 94, 0.32) 50%,
        rgba(34, 197, 94, 0.08) 65%,
        transparent 80%
    );
    background-repeat: no-repeat;
    background-size: 200% 100%;
    animation:
        highlight-pulse 2.6s ease-in-out infinite,
        highlight-sweep 2.6s linear infinite;
}

.highlight-glow > td {
    animation: highlight-edge-glow 2.6s ease-in-out infinite;
}

.highlight-glow > td:first-child {
    border-left: 2px solid rgba(34, 197, 94, 0.8);
}

.highlight-glow > td:last-child {
    border-right: 2px solid rgba(34, 197, 94, 0.8);
}

@media (prefers-reduced-motion: reduce) {
    .highlight-glow,
    .highlight-glow > td {
        animation: none;
    }

    .highlight-glow {
        background-image: none;
        background-color: rgba(34, 197, 94, 0.12);
    }

    .highlight-glow > td {
        box-shadow:
            inset 0 2px 0 rgba(34, 197, 94, 0.8),
            inset 0 -2px 0 rgba(34, 197, 94, 0.8);
    }
}
`}</style>
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="mb-2 text-[2.8rem] font-bold tracking-wide text-foreground uppercase"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Domain Policy
                    </h1>
                    <p className="mb-6 text-[1.05rem] text-muted-foreground">
                        Domain Management for website security checking.
                    </p>

                    <RowLimitNotice truncated={truncated} limit={rowLimit} />

                    {/* Search + Sort + Group row */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative w-[260px]">
                            <Search
                                size={16}
                                className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-full border border-black/10 bg-black/5 py-2.5 pr-3.5 pl-11 text-[0.9rem] text-foreground outline-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                            />
                        </div>

                        {/* Sort Dropdown */}
                        <div className="relative">
                            <select
                                value={`${sortField}__${sortDir}`}
                                onChange={(e) => {
                                    const parts = e.target.value.split('__');
                                    setSortField(parts[0] as SortField);
                                    setSortDir(parts[1] as SortDir);
                                }}
                                className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-2.5 pr-8 pl-9 text-[0.85rem] text-foreground transition-all duration-200 outline-none hover:border-able-green/50 hover:bg-black/10 focus:border-able-green focus:ring-1 focus:ring-able-green/30 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-white/5"
                            >
                                <option value="domain__asc">
                                    Sort by: Name
                                </option>
                                <option value="date__desc">
                                    Sort by: Date
                                </option>
                                <option value="risk_score__desc">
                                    Sort by: Risk
                                </option>
                            </select>
                            <ArrowUpDown
                                size={16}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                            />
                        </div>

                        {/* Group Dropdown */}
                        <div className="relative">
                            <select
                                value={groupField}
                                onChange={(e) =>
                                    setGroupField(e.target.value as GroupField)
                                }
                                className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-2.5 pr-8 pl-9 text-[0.85rem] text-foreground transition-all duration-200 outline-none hover:border-able-green/50 hover:bg-black/10 focus:border-able-green focus:ring-1 focus:ring-able-green/30 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-white/5"
                            >
                                <option value="none">Group: None</option>
                                <option value="domain_status">
                                    Group: Domain Status
                                </option>
                                <option value="policy">Group: Policy</option>
                            </select>
                            <Layers
                                size={16}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                            />
                        </div>
                    </div>
                </header>

                {/* Data Card */}
                <div className={`${glassCard} px-8 py-7`}>
                    <div className="mb-8 flex items-center justify-between">
                        <h2
                            className="text-[1.6rem] font-bold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Domain Classification
                        </h2>
                        <div className="flex items-center gap-3">
                            {domainPolicies.length > 0 && (
                                <button
                                    onClick={() => setDeleteAllConfirm(true)}
                                    className="flex items-center gap-2 rounded-lg border border-[rgba(248,113,113,0.4)] px-4 py-2 text-[0.9rem] font-semibold text-[#f87171] transition-colors hover:bg-[rgba(248,113,113,0.1)] active:scale-[0.98]"
                                >
                                    <Trash size={16} />
                                    Delete All
                                </button>
                            )}
                            <button
                                onClick={openAddModal}
                                className="flex items-center gap-2 rounded-lg border-none bg-able-green px-5 py-2 text-[0.9rem] font-semibold text-white transition-colors hover:bg-[#1a9e4b] active:scale-[0.98]"
                            >
                                <Plus size={18} />
                                Add Domain
                            </button>
                        </div>
                    </div>

                    {groupField !== 'none' ? (
                        renderGroupedContent()
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-[0.95rem]">
                                    <thead>
                                        <tr>
                                            {[
                                                'Domain Name',
                                                'Domain Status',
                                                'Policy',
                                                'Category',
                                                'Risk Score',
                                                'Actions',
                                            ].map((h) => (
                                                <th
                                                    key={h}
                                                    className="border-b border-[rgba(34,197,94,0.7)] px-4 py-3 font-normal text-muted-foreground"
                                                >
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    {renderUngroupedContent()}
                                </table>
                            </div>

                            {/* Pagination (only when not grouped) */}
                            {totalPages > 1 && (
                                <TablePagination
                                    currentPage={safePage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            <DomainPolicyFormModal
                open={showModal}
                editingId={editingId}
                form={form}
                setForm={setForm}
                formErrors={formErrors}
                isSubmitting={isSubmitting}
                categories={categories}
                onClose={closeModal}
                onSubmit={handleSubmit}
            />

            <DeletePolicyModals
                deleteConfirmId={deleteConfirmId}
                deleteAllConfirm={deleteAllConfirm}
                onCancelSingle={() => setDeleteConfirmId(null)}
                onConfirmSingle={handleDelete}
                onCancelAll={() => setDeleteAllConfirm(false)}
                onConfirmAll={handleDeleteAll}
            />

            <DomainDetailModal
                open={showDetailModal}
                selectedDomain={selectedDomain}
                domainVisits={domainVisits}
                visitsLoading={visitsLoading}
                visitMetrics={visitMetrics}
                visitsPagination={visitsPagination}
                getDomainNameWithoutTLD={getDomainNameWithoutTLD}
                onClose={closeDetailModal}
                onPageChange={handleVisitsPageChange}
            />
        </>
    );
}

PolicyAlgorithm.layout = {
    breadcrumbs: [
        { title: 'Policy Administration', href: '/risk-algorithm/criteria' },
        { title: 'Domain Policy', href: '/policy-algorithm' },
    ],
};
