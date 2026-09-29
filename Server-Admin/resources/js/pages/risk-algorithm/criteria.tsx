import { Head, router, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    Pencil,
    Search,
    Trash2,
    Plus,
    X,
    Trash,
    Copy,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PatternItemsModal } from './pattern-items-modal';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

export interface CriteriaPatternItem {
    id: number;
    title: string;
    regex: string;
    score: number;
    operator?: 'and' | 'or';
    risk_weight?: 'low' | 'medium' | 'high';
    sub_items?: CriteriaPatternItem[];
}

export interface RiskPattern {
    id: number;
    title: string;
    type: 'single' | 'criteria';
    regex: string | null;
    negation_context_regex: string | null;
    amplifier_context_regex: string | null;
    negation_window: number | null;
    priority: 'low' | 'medium' | 'high';
    score: number;
    criteria_pattern_items: CriteriaPatternItem[];
    created_at: string;
    updated_at: string;
}

interface PageProps {
    riskPatterns: RiskPattern[];
    existingPatterns: RiskPattern[];
    [key: string]: unknown;
}

export default function CriteriaPatternConfiguration() {
    const { riskPatterns } = usePage<PageProps>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

    // Filter patterns
    const filteredPatterns = useMemo(() => {
        if (!searchQuery) {
            return riskPatterns;
        }

        return riskPatterns.filter(
            (p) =>
                p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.regex &&
                    p.regex.toLowerCase().includes(searchQuery.toLowerCase())),
        );
    }, [riskPatterns, searchQuery]);

    function handleDelete(id: number) {
        router.delete(`/risk-algorithm/${id}`);
        setDeleteConfirmId(null);
    }

    function handleDeleteAll() {
        router.delete('/risk-algorithm-all');
        setDeleteAllConfirm(false);
    }

    return (
        <>
            <Head title="Pattern Settings" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="mb-3 text-[2.8rem] font-bold tracking-wide uppercase text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Risk Policy
                    </h1>
                    <p className="mb-6 max-w-[800px] text-[1.05rem] leading-relaxed text-muted-foreground">
                        Manage criteria-based risk patterns. Each criteria
                        pattern combines multiple regex items that ABLE
                        evaluates together when scanning DOM files.
                    </p>
                    <div className="relative w-[300px]">
                        <Search
                            size={16}
                            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                        />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-full border border-black/10 bg-black/5 py-2 pr-3 pl-10 text-[0.9rem] text-foreground outline-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-[rgba(20,32,38,0.4)]"
                        />
                    </div>
                </header>

                {/* Header Actions */}
                <div className="mb-6 flex items-center justify-between">
                    <h2
                        className="text-[1.6rem] font-bold"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Criteria Classification
                    </h2>
                    <div className="flex items-center gap-3">
                        {riskPatterns.length > 0 && (
                            <button
                                onClick={() => setDeleteAllConfirm(true)}
                                className="flex items-center gap-2 rounded-lg border border-[rgba(248,113,113,0.4)] px-4 py-2 text-[0.9rem] font-semibold text-[#f87171] transition-colors hover:bg-[rgba(248,113,113,0.1)] active:scale-[0.98]"
                            >
                                <Trash size={16} />
                                Delete All
                            </button>
                        )}
                        <a
                            href="/risk-algorithm/criteria/create"
                            className="flex items-center gap-2 rounded-lg border-none bg-able-green px-5 py-2 text-[0.9rem] font-semibold text-white transition-colors hover:bg-[#1a9e4b] active:scale-[0.98]"
                        >
                            <Plus size={18} />
                            Add Pattern
                        </a>
                    </div>
                </div>


                {/* Criteria Card Grid */}
                {filteredPatterns.length > 0 ? (
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredPatterns.map((pattern) => {
                            return (
                                <div
                                    key={pattern.id}
                                    className={`${glassCard} flex flex-col p-5`}
                                >
                                    {/* Card header */}
                                    <div className="mb-4 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3
                                                className="truncate text-[1.1rem] font-medium text-foreground"
                                                style={{
                                                    fontFamily:
                                                        "'Unbounded', sans-serif",
                                                }}
                                            >
                                                {pattern.title}
                                            </h3>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                        pattern.priority ===
                                                        'high'
                                                            ? 'bg-[rgba(248,113,113,0.2)] text-[#f87171]'
                                                            : pattern.priority ===
                                                                'medium'
                                                              ? 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]'
                                                              : 'bg-[rgba(34,197,94,0.2)] text-[#22c55e]'
                                                    }`}
                                                >
                                                    {pattern.priority === 'high'
                                                        ? 'High'
                                                        : pattern.priority ===
                                                            'medium'
                                                          ? 'Medium'
                                                          : 'Low'}
                                                </span>
                                                {(() => {
                                                    const hasReq =
                                                        pattern.criteria_pattern_items?.some(
                                                            (i) =>
                                                                (i.operator ||
                                                                    'and') ===
                                                                'and',
                                                        );
                                                    const hasFlex =
                                                        pattern.criteria_pattern_items?.some(
                                                            (i) =>
                                                                i.operator ===
                                                                'or',
                                                        );

                                                    if (hasReq && hasFlex) {
                                                        return (
                                                            <span className="rounded-full border border-[#a855f7]/30 bg-[rgba(168,85,247,0.15)] px-2 py-0.5 text-xs font-semibold text-[#a855f7]">
                                                                Mixed Rules
                                                            </span>
                                                        );
                                                    }

                                                    if (hasFlex) {
                                                        return (
                                                            <span className="rounded-full border border-[#36cfc9]/30 bg-[rgba(54,207,201,0.15)] px-2 py-0.5 text-xs font-semibold text-[#36cfc9]">
                                                                All Flexible (OR)
                                                            </span>
                                                        );
                                                    }

                                                    return (
                                                        <span className="rounded-full border border-able-green/30 bg-[rgba(34,197,94,0.15)] px-2 py-0.5 text-xs font-semibold text-able-green">
                                                            All Required (AND)
                                                        </span>
                                                    );
                                                })()}
                                                <span className="text-xs text-muted-foreground">
                                                    {
                                                        pattern
                                                            .criteria_pattern_items
                                                            .length
                                                    }{' '}
                                                    Items
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Composite score */}
                                    <div className="mb-4">
                                        <div className="mb-1 flex items-center justify-between text-[0.85rem]">
                                            <span className="text-muted-foreground">
                                                Composite Score
                                            </span>
                                            <span className="font-semibold text-foreground">
                                                {pattern.score}
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                                            <div
                                                className="h-full rounded-full bg-able-green transition-all"
                                                style={{
                                                    width: `${Math.min(100, pattern.score)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Pattern Items with table modal */}
                                    <div className="flex-1">
                                        {pattern.criteria_pattern_items.length >
                                        0 ? (
                                            <div className="flex items-center">
                                                <PatternItemsModal
                                                    pattern={pattern}
                                                    trigger={
                                                        <button className="flex items-center gap-1 py-2 text-[0.85rem] font-semibold text-able-green transition-opacity hover:opacity-80">
                                                            <span>
                                                                Pattern Items
                                                            </span>
                                                            <ChevronDown
                                                                size={16}
                                                            />
                                                        </button>
                                                    }
                                                />
                                                <div className="ml-auto flex items-center gap-2">
                                                    <button
                                                        onClick={() =>
                                                            router.visit(
                                                                `/risk-algorithm/criteria/${pattern.id}/edit`,
                                                            )
                                                        }
                                                        className="cursor-pointer rounded-md p-1 transition-opacity hover:opacity-80"
                                                        title="Edit pattern"
                                                    >
                                                        <Pencil
                                                            size={18}
                                                            className="text-[#36cfc9]"
                                                        />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setDeleteConfirmId(
                                                                pattern.id,
                                                            )
                                                        }
                                                        className="cursor-pointer rounded-md p-1 transition-opacity hover:opacity-80"
                                                        title="Delete pattern"
                                                    >
                                                        <Trash2
                                                            size={18}
                                                            className="text-muted-foreground"
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="rounded-lg border border-dashed border-black/10 py-4 text-center text-sm text-muted-foreground dark:border-white/10">
                                                No pattern items.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div
                        className={`${glassCard} py-12 text-center text-muted-foreground`}
                    >
                        {searchQuery
                            ? 'No criteria patterns match your search.'
                            : 'No criteria patterns yet. Click "Add Pattern" above to create one.'}
                    </div>
                )}
            </div>

            {/* Delete Single Confirmation Modal */}
            {deleteConfirmId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="mx-4 w-full max-w-sm rounded-xl border border-[rgba(248,113,113,0.3)] bg-white p-6 shadow-2xl dark:bg-[#0f172a]">
                        <h3
                            className="mb-2 text-lg font-semibold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Delete Criteria Pattern
                        </h3>
                        <p className="mb-6 text-muted-foreground">
                            Are you sure you want to delete this criteria
                            pattern? This action cannot be undone.
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
                            Delete All Criteria Patterns
                        </h3>
                        <p className="mb-6 text-muted-foreground">
                            Are you sure you want to delete <strong>all</strong>{' '}
                            criteria patterns? This action cannot be undone.
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
        </>
    );
}

CriteriaPatternConfiguration.layout = {
    breadcrumbs: [
        { title: 'Policy Administration', href: '/risk-algorithm/criteria' },
        {
            title: 'Risk Policy',
            href: '/risk-algorithm/criteria',
        },
    ],
};
