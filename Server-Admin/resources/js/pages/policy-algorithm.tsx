import { Head, router, usePage } from '@inertiajs/react';
import {
    Search,
    ExternalLink,
    Pencil,
    Trash2,
    Plus,
    X,
    ArrowUpDown,
    Layers,
    Trash,
    Eye,
    Globe,
    Users,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState, useMemo } from 'react';
import DomainPolicyController from '@/actions/App/Http/Controllers/DomainPolicyController';
import { TablePagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface DomainPolicy {
    id: number;
    domain: string;
    domain_status: 'safe' | 'unsafe' | 'unlisted';
    policy: 'whitelisted' | 'blacklisted' | 'under_review';
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

interface PageProps {
    domainPolicies: DomainPolicy[];
    [key: string]: unknown;
}

interface FormData {
    domain: string;
    domain_status: 'safe' | 'unsafe' | 'unlisted';
    policy: 'whitelisted' | 'blacklisted' | 'under_review';
    category: string;
    classification_source: string;
    confidence: number | null;
    risk_score: number;
}

const emptyForm: FormData = {
    domain: '',
    domain_status: 'unlisted',
    policy: 'under_review',
    category: '',
    classification_source: '',
    confidence: null,
    risk_score: 60,
};

const ROWS_PER_PAGE = 5;

type SortField = 'domain' | 'domain_status' | 'policy' | 'risk_score';
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

const CATEGORY_OPTIONS: { name: string; detail: string }[] = [
    {
        name: 'Social Media',
        detail: 'Social networks, messaging, forums, and community platforms.',
    },
    {
        name: 'Search Engine',
        detail: 'Web search providers and metasearch portals.',
    },
    {
        name: 'News & Media',
        detail: 'News outlets, press, blogs, weather, and publishing.',
    },
    {
        name: 'E-commerce',
        detail: 'Online stores with carts, checkout, and product listings.',
    },
    {
        name: 'Finance',
        detail: 'Banks, payments, lending, trading, insurance, and billing.',
    },
    {
        name: 'Education',
        detail: 'Schools, universities, courses, LMS, and research.',
    },
    {
        name: 'Government',
        detail: 'Official government, municipal, and public-service sites.',
    },
    {
        name: 'Health',
        detail: 'Hospitals, clinics, pharmacies, and medical information.',
    },
    {
        name: 'Technology',
        detail: 'Software, hardware, gadgets, IT infrastructure, and tech news.',
    },
    {
        name: 'AI',
        detail: 'Artificial intelligence platforms, LLMs, AI assistants, and generative tools.',
    },
    {
        name: 'Entertainment',
        detail: 'Movies, music, celebrities, events, and fan content.',
    },
    {
        name: 'Gaming',
        detail: 'Video games, storefronts, esports, and walkthroughs.',
    },
    { name: 'Sports', detail: 'Leagues, teams, scores, and sports coverage.' },
    {
        name: 'Travel',
        detail: 'Flights, hotels, bookings, maps, and ride-hailing.',
    },
    {
        name: 'Food & Dining',
        detail: 'Restaurants, recipes, menus, and food delivery.',
    },
    {
        name: 'Real Estate',
        detail: 'Property listings, rentals, and brokerage sites.',
    },
    {
        name: 'Automotive',
        detail: 'Car makers, dealers, parts, and vehicle marketplaces.',
    },
    {
        name: 'Jobs & Careers',
        detail: 'Job boards, hiring, resumes, and freelance gigs.',
    },
    {
        name: 'Productivity',
        detail: 'Docs, calendars, notes, chat, meetings, and task tools.',
    },
    {
        name: 'Developer Tools',
        detail: 'Code hosting, docs, SDKs, packages, and cloud dev platforms.',
    },
    {
        name: 'Cloud & Hosting',
        detail: 'Hosting, domains, VPS, CDNs, and file hosting.',
    },
    { name: 'Email', detail: 'Webmail providers and hosted inbox services.' },
    {
        name: 'Streaming',
        detail: 'Video, music, and podcast streaming platforms.',
    },
    {
        name: 'Gambling',
        detail: 'Casinos, betting, poker, lottery, and wagering.',
    },
    { name: 'Adult', detail: 'Adult-only and explicit content sites.' },
    {
        name: 'Shopping',
        detail: 'Deals, coupons, marketplaces, and price comparison.',
    },
    {
        name: 'Reference',
        detail: 'Wikis, dictionaries, docs, manuals, and how-tos.',
    },
];

const statusLabels: Record<string, string> = {
    safe: 'Safe',
    unsafe: 'Unsafe',
    unlisted: 'Unlisted',
};

const sourceFilterLabels: Record<string, string> = {
    manual: 'Manual',
    brand: 'Brand map',
    heuristic: 'Auto',
    ut1: 'UT1 list',
    seed: 'Seed',
    pattern: 'Pattern',
    pending: 'Needs review',
};

const policyLabels: Record<string, string> = {
    whitelisted: 'Whitelisted',
    blacklisted: 'Blacklisted',
    under_review: 'Under Review',
};

function CategoryPicker({
    value,
    onChange,
}: {
    value: string;
    onChange: (category: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value);
    const [prevValue, setPrevValue] = useState(value);
    const rootRef = useRef<HTMLDivElement>(null);

    if (prevValue !== value) {
        setPrevValue(value);
        setDraft(value);
    }

    useEffect(() => {
        if (!open) {
            return;
        }

        function handleClickOutside(e: MouseEvent) {
            if (
                rootRef.current &&
                !rootRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [open]);

    function commitTyped() {
        const trimmed = draft.trim();

        if (trimmed && trimmed !== value) {
            onChange(trimmed);
        } else {
            setDraft(value);
        }
    }

    const query = draft.trim().toLowerCase();
    const filtered = query
        ? CATEGORY_OPTIONS.filter((c) => c.name.toLowerCase().includes(query))
        : CATEGORY_OPTIONS;
    const showCustom =
        query !== '' &&
        !CATEGORY_OPTIONS.some((c) => c.name.toLowerCase() === query);

    return (
        <div ref={rootRef} className="relative w-full">
            <div className="flex w-full items-center rounded-lg border border-black/10 bg-transparent transition-colors focus-within:border-able-green dark:border-white/10">
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitTyped}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commitTyped();
                            setOpen(false);
                        }
                    }}
                    placeholder="Type or pick a category…"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label="Open category list"
                    className="shrink-0 px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                    ▾
                </button>
            </div>
            {open && (
                <ul
                    role="listbox"
                    className="absolute z-10 mt-1 max-h-40 w-[480px] max-w-full overflow-y-auto rounded-lg border border-black/10 bg-[#1a2f2b] py-1 shadow-xl dark:border-white/10"
                >
                    {filtered.map((c) => (
                        <li key={c.name} title={c.detail}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={c.name === value}
                                title={c.detail}
                                onClick={() => {
                                    onChange(c.name);
                                    setDraft(c.name);
                                    setOpen(false);
                                }}
                                className={`block w-full px-3 py-1 text-left text-[0.8rem] transition-colors ${
                                    c.name === value
                                        ? 'bg-[rgba(34,197,94,0.35)] text-white'
                                        : 'text-slate-100 hover:bg-[rgba(34,197,94,0.15)]'
                                }`}
                            >
                                {c.name}
                            </button>
                        </li>
                    ))}
                    {showCustom && (
                        <li>
                            <button
                                type="button"
                                onClick={() => {
                                    commitTyped();
                                    setOpen(false);
                                }}
                                className="block w-full px-3 py-1 text-left text-[0.8rem] text-slate-100 hover:bg-[rgba(34,197,94,0.15)]"
                            >
                                Use “{draft.trim()}”
                            </button>
                        </li>
                    )}
                    {filtered.length === 0 && !showCustom && (
                        <li className="px-3 py-1 text-[0.8rem] text-slate-400">
                            No matches — press Enter to use your text.
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}

export default function PolicyAlgorithm() {
    const { domainPolicies } = usePage<PageProps>().props;

    const initialHighlight =
        typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('highlight')
            : null;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<FormData>(emptyForm);
    const [searchQuery, setSearchQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
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
    const [domainVisits, setDomainVisits] = useState<
        {
            id: number;
            domain_policy_id: number;
            domain: string;
            user_id: string | null;
            visited_at: string;
        }[]
    >([]);
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

        // Filter by classification source (pending = needs review queue)
        if (sourceFilter !== 'all') {
            items = items.filter(
                (p) => (p.classification_source || '') === sourceFilter,
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
    }, [domainPolicies, searchQuery, sourceFilter, sortField, sortDir]);

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

    async function fetchDomainVisits(
        domainPolicyId: number,
        page: number = 1,
    ) {
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
                    d.domain === highlightDomain
                        ? 'highlight-glow ring-2 ring-[rgba(34,197,94,0.9)]'
                        : ''
                }`}
            >
                <td className={`px-4 py-4 ${isGrouped ? 'w-[28%]' : ''}`}>
                    <a
                        href={formatDomainUrl(d.domain)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-foreground transition-colors hover:text-able-green"
                    >
                        <span className="truncate max-w-[200px]">{d.domain}</span>
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
                    <Badge variant={policyBadgeVariant[d.policy]}>
                        {policyLabels[d.policy]}
                    </Badge>
                </td>
                <td className={`px-4 py-4 text-muted-foreground ${isGrouped ? 'w-[16%] truncate' : ''}`}>
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
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green"
                            title="View Details"
                        >
                            <Eye size={16} />
                        </button>
                        <button
                            onClick={() => openEditModal(d)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green"
                            title="Edit"
                        >
                            <Pencil size={16} />
                        </button>
                        <button
                            onClick={() => setDeleteConfirmId(d.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[rgba(248,113,113,0.1)] hover:text-[#f87171]"
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
                                    {items.length} {items.length === 1 ? 'Domain' : 'Domains'}
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
                                        ? 'max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-[rgba(34,197,94,0.4)] scrollbar-track-transparent'
                                        : ''
                                }`}
                            >
                                <table className="w-full table-fixed border-collapse text-left text-[0.95rem]">
                                    <tbody>{renderTableRows(items, true)}</tbody>
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
@keyframes pulse-glow {
    0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
    70% { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); }
    100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}
.highlight-glow { animation: pulse-glow 2s ease-in-out infinite; }
`}</style>
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="mb-2 text-[2.8rem] font-bold tracking-wide uppercase text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Domain Policy
                    </h1>
                    <p className="mb-6 text-[1.05rem] text-muted-foreground">
                        Domain Management for website security checking.
                    </p>

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
                                    Sort: Domain (A-Z)
                                </option>
                                <option value="domain__desc">
                                    Sort: Domain (Z-A)
                                </option>
                                <option value="domain_status__asc">
                                    Sort: Status (A-Z)
                                </option>
                                <option value="domain_status__desc">
                                    Sort: Status (Z-A)
                                </option>
                                <option value="policy__asc">
                                    Sort: Policy (A-Z)
                                </option>
                                <option value="policy__desc">
                                    Sort: Policy (Z-A)
                                </option>
                                <option value="risk_score__asc">
                                    Sort: Risk (Low-High)
                                </option>
                                <option value="risk_score__desc">
                                    Sort: Risk (High-Low)
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

                        {/* Source Filter Dropdown */}
                        <div className="relative">
                            <select
                                value={sourceFilter}
                                onChange={(e) =>
                                    setSourceFilter(e.target.value)
                                }
                                className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-2.5 pr-8 pl-9 text-[0.85rem] text-foreground transition-all duration-200 outline-none hover:border-able-green/50 hover:bg-black/10 focus:border-able-green focus:ring-1 focus:ring-able-green/30 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-white/5"
                            >
                                <option value="all">Source: All</option>
                                {Object.entries(sourceFilterLabels).map(
                                    ([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ),
                                )}
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

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
                    <div className="mx-4 max-h-[75vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[rgba(34,197,94,0.3)] bg-white shadow-2xl dark:bg-[#0f172a]">
                        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
                            <h3
                                className="text-lg font-bold"
                                style={{
                                    fontFamily: "'Unbounded', sans-serif",
                                }}
                            >
                                {editingId
                                    ? 'Edit Domain Policy'
                                    : 'Add Domain Policy'}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form
                            onSubmit={handleSubmit}
                            className="space-y-4 px-6 py-5"
                        >
                            <div>
                                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                    Domain Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    readOnly={!!editingId}
                                    value={form.domain}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            domain: e.target.value,
                                        })
                                    }
                                    placeholder="e.g., example.com"
                                    className={`w-full rounded-lg border bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green ${formErrors.domain ? 'border-[#f87171]' : 'border-black/10 dark:border-white/10'} ${editingId ? 'cursor-not-allowed opacity-60' : ''}`}
                                />
                                {formErrors.domain && (
                                    <p className="mt-1 text-xs text-[#f87171]">
                                        {formErrors.domain}
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                        Domain Status
                                    </label>
                                    <select
                                        value={form.domain_status}
                                        disabled={
                                            form.policy === 'whitelisted' ||
                                            form.policy === 'blacklisted'
                                        }
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                domain_status: e.target
                                                    .value as FormData['domain_status'],
                                            })
                                        }
                                        className={`w-full rounded-lg border bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green ${
                                            form.policy === 'whitelisted' ||
                                            form.policy === 'blacklisted'
                                                ? 'cursor-not-allowed border-black/10 bg-black/5 opacity-60 dark:border-white/10 dark:bg-white/5'
                                                : 'border-black/10 dark:border-white/10'
                                        }`}
                                    >
                                        <option value="safe">Safe</option>
                                        <option value="unsafe">Unsafe</option>
                                        <option value="unlisted">
                                            Unlisted
                                        </option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                        Policy
                                    </label>
                                    <select
                                        value={form.policy}
                                        onChange={(e) => {
                                            const policy = e.target
                                                .value as FormData['policy'];
                                            const statusMap: Record<
                                                FormData['policy'],
                                                FormData['domain_status']
                                            > = {
                                                whitelisted: 'safe',
                                                blacklisted: 'unsafe',
                                                under_review: 'unlisted',
                                            };
                                            setForm({
                                                ...form,
                                                policy,
                                                domain_status:
                                                    statusMap[policy],
                                                risk_score:
                                                    policy === 'blacklisted'
                                                        ? 70
                                                        : policy ===
                                                            'whitelisted'
                                                          ? 0
                                                          : policy ===
                                                              'under_review'
                                                            ? 60
                                                            : form.risk_score,
                                            });
                                        }}
                                        className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                    >
                                        <option value="whitelisted">
                                            Whitelisted
                                        </option>
                                        <option value="blacklisted">
                                            Blacklisted
                                        </option>
                                        <option value="under_review">
                                            Under Review
                                        </option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                    Category
                                </label>
                                <CategoryPicker
                                    value={form.category}
                                    onChange={(category) =>
                                        setForm({
                                            ...form,
                                            category,
                                            classification_source: 'manual',
                                        })
                                    }
                                />
                                <input
                                    type="hidden"
                                    value={form.classification_source}
                                    readOnly
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                    Risk Score (0-100)
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    required
                                    value={form.risk_score}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            risk_score:
                                                parseInt(e.target.value) || 0,
                                        })
                                    }
                                    className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-lg border border-black/10 px-4 py-2 text-muted-foreground transition-colors hover:text-foreground dark:border-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="rounded-lg bg-able-green px-4 py-2 font-semibold text-white transition-colors hover:bg-[#1a9e4b] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmitting
                                        ? 'Saving...'
                                        : editingId
                                          ? 'Update'
                                          : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Single Confirmation Modal */}
            {deleteConfirmId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="mx-4 w-full max-w-sm rounded-xl border border-[rgba(248,113,113,0.3)] bg-white p-6 shadow-2xl dark:bg-[#0f172a]">
                        <h3
                            className="mb-2 text-lg font-semibold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Delete Domain Policy
                        </h3>
                        <p className="mb-6 text-muted-foreground">
                            Are you sure you want to delete this domain policy?
                            This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="rounded-lg border border-black/10 px-4 py-2 text-muted-foreground transition-colors hover:text-foreground dark:border-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirmId)}
                                className="rounded-lg bg-[#f87171] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#ef4444]"
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
                    <div className="mx-4 w-full max-w-sm rounded-xl border border-[rgba(248,113,113,0.3)] bg-white p-6 shadow-2xl dark:bg-[#0f172a]">
                        <h3
                            className="mb-2 text-lg font-semibold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Delete All Domain Policies
                        </h3>
                        <p className="mb-6 text-muted-foreground">
                            Are you sure you want to delete <strong>all</strong>{' '}
                            domain policies? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteAllConfirm(false)}
                                className="rounded-lg border border-black/10 px-4 py-2 text-muted-foreground transition-colors hover:text-foreground dark:border-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAll}
                                className="rounded-lg bg-[#f87171] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#ef4444]"
                            >
                                Delete All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Domain Detail Modal */}
            {showDetailModal && selectedDomain && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeDetailModal();
                        }
                    }}
                >
                    <div className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[rgba(34,197,94,0.3)] bg-white shadow-2xl dark:bg-[#0f172a]">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[rgba(34,197,94,0.1)]">
                                    <img
                                        src={`https://www.google.com/s2/favicons?domain=${selectedDomain.domain}&sz=32`}
                                        alt={selectedDomain.domain}
                                        className="h-8 w-8 rounded-md"
                                        onError={(e) => {
                                            e.currentTarget.style.display =
                                                'none';
                                        }}
                                    />
                                </div>
                                <div>
                                    <h3
                                        className="text-xl font-bold"
                                        style={{
                                            fontFamily:
                                                "'Unbounded', sans-serif",
                                        }}
                                    >
                                        {getDomainNameWithoutTLD(
                                            selectedDomain.domain,
                                        )}
                                    </h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {selectedDomain.domain}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={closeDetailModal}
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Stats */}
                        <div className="border-b border-black/10 px-6 py-4 dark:border-white/10">
                            <div className="flex gap-8">
                                <div>
                                    <span className="text-sm text-muted-foreground">
                                        User Opened
                                    </span>
                                    <p className="text-lg font-semibold">
                                        {domainVisits.length > 0 &&
                                        domainVisits[0].user_id
                                            ? domainVisits[0].user_id
                                            : '—'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted-foreground">
                                        Date Detected
                                    </span>
                                    <p className="text-lg font-semibold">
                                        {new Date(
                                            selectedDomain.created_at,
                                        ).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2x1 KPI Card Grid */}
                        <div className="border-b border-black/10 px-6 py-4 dark:border-white/10">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5 rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] p-4 dark:bg-white/5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            Visit Count
                                        </span>
                                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-able-green/10 text-able-green">
                                            <Globe size={15} />
                                        </div>
                                    </div>
                                    <p className="text-2xl font-bold tabular-nums text-foreground">
                                        {visitMetrics.visit_count.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Counts the number of times this domain has been visited.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-1.5 rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] p-4 dark:bg-white/5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            Active Users
                                        </span>
                                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                                            <Users size={15} />
                                        </div>
                                    </div>
                                    <p className="text-2xl font-bold tabular-nums text-foreground">
                                        {visitMetrics.active_users.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Counts users currently active on this domain (last 15m).
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Visits Table */}
                        <div className="flex-1 overflow-auto px-6 py-4">
                            {visitsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-able-green"></div>
                                </div>
                            ) : domainVisits.length === 0 ? (
                                <div className="py-8 text-center text-muted-foreground">
                                    No visit records found.
                                </div>
                            ) : (
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className="border-b border-[rgba(34,197,94,0.7)] px-3 py-2 text-left font-normal text-muted-foreground">
                                                Date
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.7)] px-3 py-2 text-left font-normal text-muted-foreground">
                                                Time
                                            </th>
                                            <th className="border-b border-[rgba(34,197,94,0.7)] px-3 py-2 text-left font-normal text-muted-foreground">
                                                User ID
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {domainVisits.map((visit: any) => (
                                            <tr
                                                key={visit.id}
                                                className="border-b border-black/5 dark:border-white/5"
                                            >
                                                <td className="px-3 py-3">
                                                    {new Date(
                                                        visit.visited_at,
                                                    ).toLocaleDateString()}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {new Date(
                                                        visit.visited_at,
                                                    ).toLocaleTimeString(
                                                        undefined,
                                                        {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            second: '2-digit',
                                                            hour12: true,
                                                        },
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {visit.user_id || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        {visitsPagination.last_page > 1 && (
                            <div className="border-t border-black/10 px-6 py-4 dark:border-white/10">
                                <TablePagination
                                    currentPage={visitsPagination.current_page}
                                    totalPages={visitsPagination.last_page}
                                    onPageChange={handleVisitsPageChange}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

PolicyAlgorithm.layout = {
    breadcrumbs: [{ title: 'Domain Policy', href: '/policy-algorithm' }],
};
