import { Head, router, usePage } from '@inertiajs/react';
import { ListPlus, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

const policyLabels: Record<string, string> = {
    whitelisted: 'Whitelisted',
    blacklisted: 'Blacklisted',
    under_review: 'Under Review',
};

const policyBadgeVariant: Record<
    string,
    'glass-safe' | 'glass-unsafe' | 'glass-unlisted'
> = {
    whitelisted: 'glass-safe',
    blacklisted: 'glass-unsafe',
    under_review: 'glass-unlisted',
};

interface DomainRecommendation {
    id: number;
    category: string;
    domain: string;
}

interface ExistingDomain {
    domain: string;
    policy: string;
    domain_status: string;
    category: string | null;
}

interface PageProps {
    recommendations: Record<string, DomainRecommendation[]>;
    categories: { name: string; detail: string }[];
    existingDomains: ExistingDomain[];
    limit: number;
    [key: string]: unknown;
}

export default function RecommendationPolicy() {
    const { recommendations, categories, existingDomains, limit } =
        usePage<PageProps>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [existingCategory, setExistingCategory] = useState<string | null>(
        null,
    );
    const [existingSearch, setExistingSearch] = useState('');
    const [addingDomain, setAddingDomain] = useState<string | null>(null);
    const [openedCategories, setOpenedCategories] = useState<Set<string>>(
        () => new Set(),
    );
    const [deleteCategory, setDeleteCategory] = useState<string | null>(null);

    const visibleCategories = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return categories.filter((category) => {
            const configured =
                (recommendations[category.name] || []).length > 0;
            const opened = openedCategories.has(category.name);

            return (
                (configured || opened) &&
                (!query || category.name.toLowerCase().includes(query))
            );
        });
    }, [categories, openedCategories, recommendations, searchQuery]);

    const availableCategories = useMemo(
        () =>
            categories.filter(
                (category) =>
                    !openedCategories.has(category.name) &&
                    (recommendations[category.name] || []).length === 0,
            ),
        [categories, openedCategories, recommendations],
    );

    const existingAssignedDomains = useMemo(
        () =>
            new Set(
                existingCategory
                    ? (recommendations[existingCategory] || []).map(
                          (recommendation) => recommendation.domain,
                      )
                    : [],
            ),
        [existingCategory, recommendations],
    );

    const availableExistingDomains = useMemo(() => {
        const query = existingSearch.trim().toLowerCase();
        const category = existingCategory
            ? existingCategory.trim().toLowerCase()
            : '';

        return existingDomains.filter((domain) => {
            if (existingAssignedDomains.has(domain.domain)) {
                return false;
            }

            if (query && !domain.domain.toLowerCase().includes(query)) {
                return false;
            }

            // A domain already assigned to a category only belongs to that
            // category's picker. Uncategorized domains are available anywhere.
            if (!domain.category) {
                return true;
            }

            return (
                category !== '' &&
                domain.category.trim().toLowerCase() === category
            );
        });
    }, [
        existingAssignedDomains,
        existingCategory,
        existingDomains,
        existingSearch,
    ]);

    const deleteCategoryCount = deleteCategory
        ? (recommendations[deleteCategory] || []).length
        : 0;

    function addRecommendation(category: string) {
        const domain = (drafts[category] || '').trim();

        if (!domain) {
            return;
        }

        setSubmitting(category);
        setErrors((previous) => {
            const next = { ...previous };

            delete next[category];

            return next;
        });

        router.post(
            '/recommendation-policy',
            { category, domain },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () =>
                    setDrafts((previous) => ({ ...previous, [category]: '' })),
                onError: (validationErrors) =>
                    setErrors((previous) => ({
                        ...previous,
                        [category]:
                            validationErrors.domain ||
                            validationErrors.category ||
                            'Could not add that domain.',
                    })),
                onFinish: () => setSubmitting(null),
            },
        );
    }

    function removeRecommendation(id: number) {
        setRemovingId(id);

        router.delete(`/recommendation-policy/${id}`, {
            preserveScroll: true,
            onFinish: () => setRemovingId(null),
        });
    }

    function openExistingPicker(category: string) {
        setExistingSearch('');
        setExistingCategory(category);
    }

    function closeExistingPicker() {
        setExistingCategory(null);
        setExistingSearch('');
    }

    function addExistingRecommendation(domain: string) {
        if (!existingCategory) {
            return;
        }

        setAddingDomain(domain);

        router.post(
            '/recommendation-policy',
            { category: existingCategory, domain },
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => setAddingDomain(null),
            },
        );
    }

    function openCategory(category: string) {
        if (!category) {
            return;
        }

        setOpenedCategories((previous) => {
            if (previous.has(category)) {
                return previous;
            }

            const next = new Set(previous);
            next.add(category);

            return next;
        });
    }

    function closeCategoryCard(category: string) {
        if ((recommendations[category] || []).length === 0) {
            setOpenedCategories((previous) => {
                const next = new Set(previous);
                next.delete(category);

                return next;
            });

            return;
        }

        setDeleteCategory(category);
    }

    function deleteCategoryCard(category: string) {
        setOpenedCategories((previous) => {
            const next = new Set(previous);
            next.delete(category);

            return next;
        });

        router.delete(
            `/recommendation-policy/category/${encodeURIComponent(category)}`,
            {
                preserveScroll: true,
                preserveState: true,
            },
        );
    }

    return (
        <>
            <Head title="Recommendation Policy" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                <header className="mb-8">
                    <h1
                        className="mb-2 text-[2.8rem] font-bold tracking-wide text-foreground uppercase"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Recommendation Policy
                    </h1>
                    <p className="mb-6 max-w-[720px] text-[1.05rem] text-muted-foreground">
                        Choose the sanctioned alternatives ABLE recommends for
                        each app category. These domains appear under ABLE
                        Recommends when a user enters an unsafe or unlisted site
                        in that category.
                    </p>

                    <div className="relative w-[300px]">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search configured categories…"
                            className="w-full rounded-full border border-black/10 bg-black/5 py-2.5 pr-4 pl-9 text-[0.85rem] text-foreground transition-all duration-200 outline-none hover:border-able-green/50 hover:bg-black/10 focus:border-able-green focus:ring-1 focus:ring-able-green/30 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-white/5"
                        />
                        <Search
                            size={16}
                            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                        />
                    </div>
                </header>

                <div className="mb-6 rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] px-4 py-3 text-sm text-muted-foreground">
                    <strong className="font-semibold text-foreground">
                        Cards appear only for categories you configure.
                    </strong>{' '}
                    Up to <span className="font-semibold">{limit}</span>{' '}
                    recommendations per category. Adding one does not change the
                    domain&apos;s Domain Policy — whitelisting stays on the{' '}
                    <a
                        href="/policy-algorithm"
                        className="font-medium text-able-green underline"
                    >
                        Domain Policy
                    </a>{' '}
                    page. Categories without manual entries fall back to
                    whitelisted domains; Gambling and Adult are excluded.
                </div>

                <div
                    className={`${glassCard} mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4`}
                >
                    <div>
                        <p className="text-sm font-semibold text-foreground">
                            Add a category
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Select a category to open its recommendation card.
                        </p>
                    </div>
                    <select
                        value=""
                        onChange={(e) => openCategory(e.target.value)}
                        disabled={availableCategories.length === 0}
                        className="w-[280px] rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-able-green disabled:opacity-60 dark:border-white/10"
                    >
                        <option value="">
                            {availableCategories.length === 0
                                ? 'All categories are open'
                                : 'Select a category…'}
                        </option>
                        {availableCategories.map((category) => (
                            <option key={category.name} value={category.name}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                </div>

                {searchQuery.trim() !== '' &&
                    visibleCategories.length === 0 && (
                        <p className="mb-4 text-sm text-muted-foreground">
                            No configured categories match that search.
                        </p>
                    )}

                <div className="grid gap-6 xl:grid-cols-2">
                    {visibleCategories.map((category) => {
                        const assigned = recommendations[category.name] || [];
                        const atLimit = assigned.length >= limit;
                        const isSubmitting = submitting === category.name;
                        const error = errors[category.name];

                        return (
                            <section
                                key={category.name}
                                className={`${glassCard} flex flex-col p-5`}
                            >
                                <div className="mb-1 flex items-start justify-between gap-3">
                                    <h2
                                        className="text-[1.05rem] font-bold"
                                        style={{
                                            fontFamily:
                                                "'Unbounded', sans-serif",
                                        }}
                                    >
                                        {category.name}
                                    </h2>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <span className="rounded-full border border-[rgba(34,197,94,0.4)] px-2 py-0.5 text-xs text-muted-foreground">
                                            {assigned.length} / {limit}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                closeCategoryCard(category.name)
                                            }
                                            title={
                                                assigned.length > 0
                                                    ? `Delete ${category.name} card`
                                                    : `Close ${category.name} card`
                                            }
                                            aria-label={
                                                assigned.length > 0
                                                    ? `Delete ${category.name} card`
                                                    : `Close ${category.name} card`
                                            }
                                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-[rgba(248,113,113,0.12)] hover:text-[#f87171]"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                </div>
                                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                                    {category.detail}
                                </p>

                                <div className="mb-3 flex flex-1 flex-col gap-2">
                                    {assigned.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">
                                            No domains added yet. Use the field
                                            below or Add Existing.
                                        </p>
                                    ) : (
                                        assigned.map((recommendation) => (
                                            <div
                                                key={recommendation.id}
                                                className="flex items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-1.5 dark:border-white/10"
                                            >
                                                <span className="truncate text-sm">
                                                    {recommendation.domain}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeRecommendation(
                                                            recommendation.id,
                                                        )
                                                    }
                                                    disabled={
                                                        removingId ===
                                                        recommendation.id
                                                    }
                                                    title={`Remove ${recommendation.domain}`}
                                                    aria-label={`Remove ${recommendation.domain}`}
                                                    className="shrink-0 text-muted-foreground transition-colors hover:text-[#f87171] disabled:opacity-50"
                                                >
                                                    {removingId ===
                                                    recommendation.id ? (
                                                        <Loader2
                                                            size={14}
                                                            className="animate-spin"
                                                        />
                                                    ) : (
                                                        <Trash2 size={14} />
                                                    )}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            addRecommendation(category.name);
                                        }}
                                        className="flex min-w-[200px] flex-1 items-center gap-2"
                                    >
                                        <input
                                            type="text"
                                            value={drafts[category.name] || ''}
                                            onChange={(e) =>
                                                setDrafts((previous) => ({
                                                    ...previous,
                                                    [category.name]:
                                                        e.target.value,
                                                }))
                                            }
                                            placeholder="e.g. notion.so"
                                            disabled={atLimit || isSubmitting}
                                            className="min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-able-green disabled:opacity-60 dark:border-white/10"
                                        />
                                        <button
                                            type="submit"
                                            disabled={
                                                atLimit ||
                                                isSubmitting ||
                                                !(
                                                    drafts[category.name] || ''
                                                ).trim()
                                            }
                                            className="flex shrink-0 items-center gap-1.5 rounded-lg border-none bg-able-green px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1a9e4b] active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {isSubmitting ? (
                                                <Loader2
                                                    size={14}
                                                    className="animate-spin"
                                                />
                                            ) : (
                                                <Plus size={14} />
                                            )}
                                            Add
                                        </button>
                                    </form>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            openExistingPicker(category.name)
                                        }
                                        disabled={atLimit}
                                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[rgba(34,197,94,0.5)] px-3 py-2 text-sm font-semibold text-able-green transition-colors hover:bg-[rgba(34,197,94,0.1)] active:scale-[0.98] disabled:opacity-50"
                                    >
                                        <ListPlus size={14} />
                                        Add Existing
                                    </button>
                                </div>

                                {atLimit && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Maximum reached for this category.
                                    </p>
                                )}
                                {error && (
                                    <p className="mt-2 text-xs text-[#f87171]">
                                        {error}
                                    </p>
                                )}
                            </section>
                        );
                    })}
                </div>

                <ConfirmDialog
                    open={deleteCategory !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setDeleteCategory(null);
                        }
                    }}
                    title={`Delete ${deleteCategory ?? ''} card?`}
                    description={`This removes all ${deleteCategoryCount} recommendation(s) in this category. The domain policies themselves are not changed.`}
                    confirmLabel="Delete card"
                    onConfirm={() => {
                        if (deleteCategory) {
                            deleteCategoryCard(deleteCategory);
                        }
                    }}
                />

                <Dialog
                    open={existingCategory !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            closeExistingPicker();
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Add Existing Domain</DialogTitle>
                            <DialogDescription>
                                {existingCategory
                                    ? `Choose a domain from Domain Policy to recommend for "${existingCategory}".`
                                    : ''}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="relative">
                            <input
                                type="text"
                                value={existingSearch}
                                onChange={(e) =>
                                    setExistingSearch(e.target.value)
                                }
                                placeholder="Search existing domains…"
                                className="w-full rounded-lg border border-black/10 bg-transparent py-2 pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-able-green dark:border-white/10"
                            />
                            <Search
                                size={15}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                            />
                        </div>

                        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-black/10 dark:border-white/10">
                            {availableExistingDomains.length === 0 ? (
                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                    {existingDomains.length === 0
                                        ? 'No domains exist in Domain Policy yet.'
                                        : 'No available domains match. Domains already recommended here, or assigned to a different category, are hidden.'}
                                </p>
                            ) : (
                                availableExistingDomains.map((domain) => (
                                    <button
                                        key={domain.domain}
                                        type="button"
                                        onClick={() =>
                                            addExistingRecommendation(
                                                domain.domain,
                                            )
                                        }
                                        disabled={addingDomain !== null}
                                        className="flex w-full items-center justify-between gap-3 border-b border-black/5 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[rgba(34,197,94,0.08)] disabled:opacity-60 dark:border-white/5"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm text-foreground">
                                                {domain.domain}
                                            </span>
                                            {domain.category && (
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {domain.category}
                                                </span>
                                            )}
                                        </span>
                                        <span className="flex shrink-0 items-center gap-2">
                                            <Badge
                                                variant={
                                                    policyBadgeVariant[
                                                        domain.policy
                                                    ] ?? 'glass-unlisted'
                                                }
                                            >
                                                {policyLabels[domain.policy] ??
                                                    domain.policy}
                                            </Badge>
                                            {addingDomain === domain.domain ? (
                                                <Loader2
                                                    size={14}
                                                    className="animate-spin text-able-green"
                                                />
                                            ) : (
                                                <Plus
                                                    size={14}
                                                    className="text-muted-foreground"
                                                />
                                            )}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}

RecommendationPolicy.layout = {
    breadcrumbs: [
        { title: 'Policy Administration', href: '/risk-algorithm/criteria' },
        { title: 'Recommendation Policy', href: '/recommendation-policy' },
    ],
};
