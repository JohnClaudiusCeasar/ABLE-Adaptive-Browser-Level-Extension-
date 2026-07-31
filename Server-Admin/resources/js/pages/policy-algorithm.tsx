import { Head, router, usePage } from '@inertiajs/react';
import { Search, ExternalLink, Pencil, Trash2, Plus, X, ArrowUpDown, Layers, Trash, Eye } from 'lucide-react';
import { useState, FormEvent, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface DomainPolicy {
    id: number;
    domain: string;
    domain_status: 'safe' | 'unsafe' | 'unlisted';
    policy: 'whitelisted' | 'blacklisted' | 'under_review';
    category: string | null;
    risk_score: number;
    visit_count: number;
    last_visited_at: string | null;
    last_source: string | null;
    created_at: string;
    updated_at: string;
}

interface PageProps {
    domainPolicies: DomainPolicy[];
    [key: string]: unknown;
}

interface FormData {
    domain: string;
    domain_status: 'safe' | 'unsafe' | 'unlisted';
    policy: 'whitelisted' | 'blacklisted' | 'under_review';
    category: string;
    risk_score: number;
}

const emptyForm: FormData = {
    domain: '',
    domain_status: 'unlisted',
    policy: 'under_review',
    category: '',
    risk_score: 0,
};

const ROWS_PER_PAGE = 5;

type SortField = 'domain' | 'domain_status' | 'policy' | 'risk_score';
type SortDir = 'asc' | 'desc';
type GroupField = 'none' | 'domain_status' | 'policy';

const statusBadgeVariant: Record<string, 'glass-safe' | 'glass-unsafe' | 'glass-unlisted'> = {
    safe: 'glass-safe',
    unsafe: 'glass-unsafe',
    unlisted: 'glass-unlisted',
};

const policyBadgeVariant: Record<string, 'glass-safe' | 'glass-unsafe' | 'glass-unlisted'> = {
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
    const { domainPolicies } = usePage<PageProps>().props;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<SortField>('domain');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [groupField, setGroupField] = useState<GroupField>('none');

    // Domain detail modal state
    const [selectedDomain, setSelectedDomain] = useState<DomainPolicy | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [domainVisits, setDomainVisits] = useState<any[]>([]);
    const [visitsLoading, setVisitsLoading] = useState(false);
    const [visitsPagination, setVisitsPagination] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
    });
    const [visitsSearch, setVisitsSearch] = useState('');

    // Filter, sort, group logic
    const processedPolicies = useMemo(() => {
        let items = [...domainPolicies];

        // Filter by search
        if (searchQuery) {
            items = items.filter((p) =>
                p.domain.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Sort
        items.sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'domain':
                    cmp = a.domain.localeCompare(b.domain);
                    break;
                case 'domain_status':
                    cmp = a.domain_status.localeCompare(b.domain_status);
                    break;
                case 'policy':
                    cmp = a.policy.localeCompare(b.policy);
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
            const key = groupField === 'domain_status'
                ? statusLabels[item.domain_status]
                : policyLabels[item.policy];
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        }
        return groups;
    }, [processedPolicies, groupField]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(processedPolicies.length / ROWS_PER_PAGE));
    const paginatedItems = useMemo(() => {
        if (groupField !== 'none') return processedPolicies; // No pagination when grouped
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return processedPolicies.slice(start, start + ROWS_PER_PAGE);
    }, [processedPolicies, currentPage, groupField]);

    // Reset page when search/sort changes
    useMemo(() => {
        setCurrentPage(1);
    }, [searchQuery, sortField, sortDir, groupField]);

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
            category: policy.category || '',
            risk_score: policy.risk_score,
        });
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingId(null);
        setForm(emptyForm);
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();

        if (editingId) {
            router.patch(`/policy-algorithm/${editingId}`, form as any);
        } else {
            router.post('/policy-algorithm', form as any);
        }

        closeModal();
    }

    function handleDelete(id: number) {
        router.delete(`/policy-algorithm/${id}`);
        setDeleteConfirmId(null);
    }

    function handleDeleteAll() {
        router.delete('/policy-algorithm-all');
        setDeleteAllConfirm(false);
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

    async function fetchDomainVisits(domainPolicyId: number, page: number = 1, search: string = '') {
        setVisitsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: visitsPagination.per_page.toString(),
            });
            if (search) {
                params.append('search', search);
            }

            const response = await fetch(`/api/domain-policies/${domainPolicyId}/visits?${params}`);
            if (response.ok) {
                const data = await response.json();
                setDomainVisits(data.visits);
                setVisitsPagination({
                    current_page: data.current_page,
                    last_page: data.last_page,
                    per_page: data.per_page,
                    total: data.total,
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
        setVisitsSearch('');
        fetchDomainVisits(domain.id, 1, '');
    }

    function closeDetailModal() {
        setShowDetailModal(false);
        setSelectedDomain(null);
        setDomainVisits([]);
    }

    function handleVisitsSearch(search: string) {
        setVisitsSearch(search);
        if (selectedDomain) {
            fetchDomainVisits(selectedDomain.id, 1, search);
        }
    }

    function handleVisitsPageChange(page: number) {
        if (selectedDomain) {
            fetchDomainVisits(selectedDomain.id, page, visitsSearch);
        }
    }

    function toggleSort(field: SortField) {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    }

    function renderTableRows(items: DomainPolicy[]) {
        return items.map((d) => (
            <tr key={d.id} className="border-b border-black/10 last:border-b-0 dark:border-white/10">
                <td className="py-5 px-4">
                    <a
                        href={formatDomainUrl(d.domain)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-foreground hover:text-able-green transition-colors inline-flex items-center gap-1.5"
                    >
                        {d.domain}
                        <ExternalLink size={14} className="text-muted-foreground" />
                    </a>
                </td>
                <td className="py-5 px-4">
                    <Badge variant={statusBadgeVariant[d.domain_status]}>
                        {statusLabels[d.domain_status]}
                    </Badge>
                </td>
                <td className="py-5 px-4">
                    <Badge variant={policyBadgeVariant[d.policy]}>
                        {policyLabels[d.policy]}
                    </Badge>
                </td>
                <td className="py-5 px-4 text-muted-foreground">
                    {d.category || '—'}
                </td>
                <td className={`py-5 px-4 ${d.risk_score > 0 ? 'text-[#f87171] font-semibold' : 'text-muted-foreground'}`}>
                    {d.risk_score}
                </td>
                <td className="py-5 px-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => openDetailModal(d)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-able-green hover:bg-[rgba(34,197,94,0.1)] transition-colors"
                            title="View Details"
                        >
                            <Eye size={16} />
                        </button>
                        <button
                            onClick={() => openEditModal(d)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-able-green hover:bg-[rgba(34,197,94,0.1)] transition-colors"
                            title="Edit"
                        >
                            <Pencil size={16} />
                        </button>
                        <button
                            onClick={() => setDeleteConfirmId(d.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors"
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
        if (!groupedPolicies) return null;

        const groupKeys = Object.keys(groupedPolicies);
        if (groupKeys.length === 0) {
            return (
                <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        {searchQuery ? 'No domains match your search.' : 'No domain policies yet. Click "Add Domain" to create one.'}
                    </td>
                </tr>
            );
        }

        return groupKeys.map((groupKey) => (
            <tbody key={groupKey}>
                <tr className="bg-[rgba(34,197,94,0.05)]">
                    <td colSpan={6} className="py-2 px-4 text-sm font-semibold text-able-green uppercase tracking-wider">
                        {groupKey} ({groupedPolicies[groupKey].length})
                    </td>
                </tr>
                {renderTableRows(groupedPolicies[groupKey])}
            </tbody>
        ));
    }

    function renderUngroupedContent() {
        if (paginatedItems.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td colSpan={6} className="py-10 text-center text-muted-foreground">
                            {searchQuery ? 'No domains match your search.' : 'No domain policies yet. Click "Add Domain" to create one.'}
                        </td>
                    </tr>
                </tbody>
            );
        }

        return (
            <tbody>
                {renderTableRows(paginatedItems)}
            </tbody>
        );
    }

    return (
        <>
            <Head title="Policy Algorithm" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">

                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="text-[2.5rem] font-medium tracking-wide mb-2 text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        POLICY ALGORITHM
                    </h1>
                    <p className="text-base text-muted-foreground mb-6">
                        Domain Management for website security checking.
                    </p>

                    {/* Search + Sort + Group row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative w-[260px]">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full py-2.5 pl-11 pr-3.5 bg-black/5 border border-black/10 rounded-full text-foreground text-[0.9rem] outline-none placeholder:text-muted-foreground dark:bg-[rgba(15,23,42,0.4)] dark:border-white/10"
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
                                className="appearance-none py-2.5 pl-9 pr-8 bg-black/5 border border-black/10 rounded-full text-foreground text-[0.85rem] outline-none cursor-pointer dark:bg-[rgba(15,23,42,0.4)] dark:border-white/10 hover:border-able-green/50 hover:bg-black/10 dark:hover:bg-white/5 focus:border-able-green focus:ring-1 focus:ring-able-green/30 transition-all duration-200"
                            >
                                <option value="domain__asc">Sort: Domain (A-Z)</option>
                                <option value="domain__desc">Sort: Domain (Z-A)</option>
                                <option value="domain_status__asc">Sort: Status (A-Z)</option>
                                <option value="domain_status__desc">Sort: Status (Z-A)</option>
                                <option value="policy__asc">Sort: Policy (A-Z)</option>
                                <option value="policy__desc">Sort: Policy (Z-A)</option>
                                <option value="risk_score__asc">Sort: Risk (Low-High)</option>
                                <option value="risk_score__desc">Sort: Risk (High-Low)</option>
                            </select>
                            <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>

                        {/* Group Dropdown */}
                        <div className="relative">
                            <select
                                value={groupField}
                                onChange={(e) => setGroupField(e.target.value as GroupField)}
                                className="appearance-none py-2.5 pl-9 pr-8 bg-black/5 border border-black/10 rounded-full text-foreground text-[0.85rem] outline-none cursor-pointer dark:bg-[rgba(15,23,42,0.4)] dark:border-white/10 hover:border-able-green/50 hover:bg-black/10 dark:hover:bg-white/5 focus:border-able-green focus:ring-1 focus:ring-able-green/30 transition-all duration-200"
                            >
                                <option value="none">Group: None</option>
                                <option value="domain_status">Group: Domain Status</option>
                                <option value="policy">Group: Policy</option>
                            </select>
                            <Layers size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                    </div>
                </header>

                {/* Data Card */}
                <div className={`${glassCard} px-8 py-7`}>
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-[1.6rem] font-medium" style={{ fontFamily: "'Unbounded', sans-serif" }}>Domain Policy</h2>
                        <div className="flex items-center gap-3">
                            {domainPolicies.length > 0 && (
                                <button
                                    onClick={() => setDeleteAllConfirm(true)}
                                    className="px-4 py-2 rounded-lg border border-[rgba(248,113,113,0.4)] text-[#f87171] font-semibold text-[0.9rem] hover:bg-[rgba(248,113,113,0.1)] transition-colors active:scale-[0.98] flex items-center gap-2"
                                >
                                    <Trash size={16} />
                                    Delete All
                                </button>
                            )}
                            <button
                                onClick={openAddModal}
                                className="bg-able-green text-white px-5 py-2 rounded-lg font-semibold text-[0.9rem] border-none hover:bg-[#1a9e4b] transition-colors active:scale-[0.98] flex items-center gap-2"
                            >
                                <Plus size={18} />
                                Add Domain
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[0.95rem]">
                            <thead>
                                <tr>
                                    {['Domain Name', 'Domain Status', 'Policy', 'Category', 'Risk Score', 'Actions'].map((h) => (
                                        <th key={h} className="text-muted-foreground font-normal py-3 px-4 border-b border-[rgba(34,197,94,0.7)]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            {groupField !== 'none' ? renderGroupedContent() : renderUngroupedContent()}
                        </table>
                    </div>

                    {/* Pagination (only when not grouped) */}
                    {groupField === 'none' && totalPages > 1 && (
                        <div className="flex justify-end mt-8 items-center gap-3 text-[0.95rem] text-muted-foreground">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <span
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-[26px] h-[26px] flex items-center justify-center rounded-full cursor-pointer ${
                                        page === currentPage
                                            ? 'bg-able-green text-white font-semibold'
                                            : 'hover:bg-black/5 dark:hover:text-white'
                                    }`}
                                >
                                    {page}
                                </span>
                            ))}
                            {totalPages > 5 && (
                                <>
                                    <span className="cursor-default">...</span>
                                    <span
                                        onClick={() => setCurrentPage(totalPages)}
                                        className="cursor-pointer font-bold hover:bg-black/5 dark:hover:text-white"
                                    >
                                        {totalPages}
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </div>

            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#0f172a] rounded-xl shadow-2xl w-full max-w-lg mx-4 border border-[rgba(34,197,94,0.3)]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
                            <h3 className="text-lg font-semibold" style={{ fontFamily: "'Unbounded', sans-serif" }}>
                                {editingId ? 'Edit Domain Policy' : 'Add Domain Policy'}
                            </h3>
                            <button onClick={closeModal} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Domain Name</label>
                                <input
                                    type="text"
                                    required
                                    value={form.domain}
                                    onChange={(e) => setForm({ ...form, domain: e.target.value })}
                                    placeholder="e.g., example.com"
                                    className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Domain Status</label>
                                    <select
                                        value={form.domain_status}
                                        onChange={(e) => setForm({ ...form, domain_status: e.target.value as FormData['domain_status'] })}
                                        className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors"
                                    >
                                        <option value="safe">Safe</option>
                                        <option value="unsafe">Unsafe</option>
                                        <option value="unlisted">Unlisted</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Policy</label>
                                    <select
                                        value={form.policy}
                                        onChange={(e) => setForm({ ...form, policy: e.target.value as FormData['policy'] })}
                                        className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors"
                                    >
                                        <option value="whitelisted">Whitelisted</option>
                                        <option value="blacklisted">Blacklisted</option>
                                        <option value="under_review">Under Review</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Category</label>
                                <input
                                    type="text"
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    placeholder="e.g., Major Tech Companies"
                                    className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Risk Score (0-100)</label>
                                <input
                                    type="number"
                                    required
                                    min={0}
                                    max={100}
                                    value={form.risk_score}
                                    onChange={(e) => setForm({ ...form, risk_score: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg bg-able-green text-white font-semibold hover:bg-[#1a9e4b] transition-colors"
                                >
                                    {editingId ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Single Confirmation Modal */}
            {deleteConfirmId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#0f172a] rounded-xl shadow-2xl w-full max-w-sm mx-4 border border-[rgba(248,113,113,0.3)] p-6">
                        <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Unbounded', sans-serif" }}>
                            Delete Domain Policy
                        </h3>
                        <p className="text-muted-foreground mb-6">
                            Are you sure you want to delete this domain policy? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirmId)}
                                className="px-4 py-2 rounded-lg bg-[#f87171] text-white font-semibold hover:bg-[#ef4444] transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete All Confirmation Modal */}
            {deleteAllConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#0f172a] rounded-xl shadow-2xl w-full max-w-sm mx-4 border border-[rgba(248,113,113,0.3)] p-6">
                        <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Unbounded', sans-serif" }}>
                            Delete All Domain Policies
                        </h3>
                        <p className="text-muted-foreground mb-6">
                            Are you sure you want to delete <strong>all</strong> domain policies? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteAllConfirm(false)}
                                className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAll}
                                className="px-4 py-2 rounded-lg bg-[#f87171] text-white font-semibold hover:bg-[#ef4444] transition-colors"
                            >
                                Delete All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Domain Detail Modal */}
            {showDetailModal && selectedDomain && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) closeDetailModal(); }}>
                    <div className="bg-white dark:bg-[#0f172a] rounded-xl shadow-2xl w-full max-w-2xl mx-4 border border-[rgba(34,197,94,0.3)] max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
                            <div className="flex items-center gap-3">
                                <img
                                    src={`https://www.google.com/s2/favicons?domain=${selectedDomain.domain}&sz=32`}
                                    alt={selectedDomain.domain}
                                    className="w-8 h-8 rounded-md"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                                <div>
                                    <h3 className="text-xl font-semibold" style={{ fontFamily: "'Unbounded', sans-serif" }}>
                                        {getDomainNameWithoutTLD(selectedDomain.domain)}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {selectedDomain.domain}
                                    </p>
                                </div>
                            </div>
                            <button onClick={closeDetailModal} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Stats */}
                        <div className="px-6 py-4 border-b border-black/10 dark:border-white/10">
                            <div className="flex gap-8">
                                <div>
                                    <span className="text-sm text-muted-foreground">User Opened</span>
                                    <p className="text-lg font-semibold">
                                        {domainVisits.length > 0 && domainVisits[0].user_id 
                                            ? domainVisits[0].user_id 
                                            : '—'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted-foreground">Date Detected</span>
                                    <p className="text-lg font-semibold">
                                        {new Date(selectedDomain.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Search and Filters */}
                        <div className="px-6 py-4 border-b border-black/10 dark:border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search by User ID..."
                                        value={visitsSearch}
                                        onChange={(e) => handleVisitsSearch(e.target.value)}
                                        className="w-full py-2 pl-10 pr-3 bg-black/5 border border-black/10 rounded-lg text-foreground text-sm outline-none placeholder:text-muted-foreground dark:bg-[rgba(15,23,42,0.4)] dark:border-white/10 focus:border-able-green transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Visits Table */}
                        <div className="flex-1 overflow-auto px-6 py-4">
                            {visitsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-able-green"></div>
                                </div>
                            ) : domainVisits.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No visit records found.
                                </div>
                            ) : (
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className="text-left py-2 px-3 text-muted-foreground font-normal border-b border-[rgba(34,197,94,0.7)]">Date</th>
                                            <th className="text-left py-2 px-3 text-muted-foreground font-normal border-b border-[rgba(34,197,94,0.7)]">Time</th>
                                            <th className="text-left py-2 px-3 text-muted-foreground font-normal border-b border-[rgba(34,197,94,0.7)]">User ID</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {domainVisits.map((visit: any) => (
                                            <tr key={visit.id} className="border-b border-black/5 dark:border-white/5">
                                                <td className="py-3 px-3">{new Date(visit.visited_at).toLocaleDateString()}</td>
                                                <td className="py-3 px-3">{new Date(visit.visited_at).toLocaleTimeString()}</td>
                                                <td className="py-3 px-3">{visit.user_id || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        {visitsPagination.last_page > 1 && (
                            <div className="px-6 py-4 border-t border-black/10 dark:border-white/10">
                                <div className="flex justify-center items-center gap-2">
                                    {Array.from({ length: visitsPagination.last_page }, (_, i) => i + 1).map((page) => (
                                        <button
                                            key={page}
                                            onClick={() => handleVisitsPageChange(page)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-full text-sm ${
                                                page === visitsPagination.current_page
                                                    ? 'bg-able-green text-white font-semibold'
                                                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

PolicyAlgorithm.layout = {
    breadcrumbs: [{ title: 'Policy Algorithm', href: '/policy-algorithm' }],
};