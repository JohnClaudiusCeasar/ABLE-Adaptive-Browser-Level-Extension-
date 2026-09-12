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
import type { FormEvent } from 'react';
import { useState, Fragment, useMemo } from 'react';
import AlertError from '@/components/alert-error';
import { PatternItemsModal } from './pattern-items-modal';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface CriteriaPatternItem {
    id: number;
    title: string;
    regex: string;
    score: number;
    operator?: 'and' | 'or';
    risk_weight?: 'low' | 'medium' | 'high';
    sub_items?: CriteriaPatternItem[];
}

interface RiskPattern {
    id: number;
    title: string;
    type: 'single' | 'criteria';
    regex: string | null;
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

interface CriteriaFormData {
    title: string;
    score: number;
    priority: 'low' | 'medium' | 'high';
    criteria_pattern_items: CriteriaPatternItem[];
}

type ExistingSort = 'newest' | 'oldest' | 'name' | 'priority' | 'score';

const emptyCriteriaForm: CriteriaFormData = {
    title: '',
    score: 0,
    priority: 'medium',
    criteria_pattern_items: [],
};

// Recursive helper: sum all item scores (top-level + all nested sub-items).
function sumAllItemScores(items: CriteriaPatternItem[]): number {
    return items.reduce((total, item) => {
        const subScore = item.sub_items ? sumAllItemScores(item.sub_items) : 0;

        return total + (item.score || 0) + subScore;
    }, 0);
}

// Temporary client-side ids for unsaved criteria items, used only as React
// keys until the server assigns real ids on save.
let tempIdCounter = 0;
function nextTempId(): number {
    tempIdCounter += 1;

    return tempIdCounter;
}

export default function CriteriaPatternConfiguration() {
    const { riskPatterns, existingPatterns } = usePage<PageProps>().props;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [criteriaForm, setCriteriaForm] =
        useState<CriteriaFormData>(emptyCriteriaForm);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [compositeScoreManual, setCompositeScoreManual] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [showExistingPicker, setShowExistingPicker] = useState<number | null>(
        null,
    );
    const [existingSearch, setExistingSearch] = useState('');
    const [existingSort, setExistingSort] =
        useState<ExistingSort>('newest');

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

    // Available patterns for existing picker
    const availablePatterns = useMemo(() => {
        const search = existingSearch.toLowerCase();

        return existingPatterns.filter(
            (p) =>
                p.title.toLowerCase().includes(search) ||
                (p.regex && p.regex.toLowerCase().includes(search)),
        );
    }, [existingPatterns, existingSearch]);

    const sortedPatterns = useMemo(() => {
        const priorityRank: Record<string, number> = {
            high: 0,
            medium: 1,
            low: 2,
        };
        const list = [...availablePatterns];

        switch (existingSort) {
            case 'oldest':
                return list.reverse();
            case 'name':
                return list.sort((a, b) => a.title.localeCompare(b.title));
            case 'priority':
                return list.sort(
                    (a, b) =>
                        (priorityRank[a.priority] ?? 3) -
                        (priorityRank[b.priority] ?? 3),
                );
            case 'score':
                return list.sort((a, b) => b.score - a.score);
            default:
                return list;
        }
    }, [availablePatterns, existingSort]);

    // --- Composite score auto-sum ---
    // When the user hasn't manually set the composite score, auto-compute
    // it as the sum of all item scores (top-level + nested sub-items).
    const autoCompositeScore = useMemo(
        () => sumAllItemScores(criteriaForm.criteria_pattern_items),
        [criteriaForm.criteria_pattern_items],
    );

    // Keep the visible composite score in sync with the auto-sum unless the
    // user has manually overridden it. This is computed during render from
    // the authoritative `compositeScoreManual` flag and the item list, so no
    // effect is needed and the form always submits the current effective value.
    const effectiveScore = compositeScoreManual
        ? criteriaForm.score
        : autoCompositeScore;

    function openAddModal() {
        setEditingId(null);
        setCriteriaForm(emptyCriteriaForm);
        setFormErrors({});
        setCompositeScoreManual(false);
        setShowModal(true);
    }

    function openEditModal(pattern: RiskPattern) {
        setEditingId(pattern.id);
        setCriteriaForm({
            title: pattern.title,
            score: pattern.score,
            priority: pattern.priority,
            criteria_pattern_items: pattern.criteria_pattern_items || [],
        });
        setFormErrors({});
        // Existing patterns carry their saved composite score — treat it as
        // manually set unless it's zero (in which case fall through to auto).
        setCompositeScoreManual(pattern.score !== 0);
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingId(null);
        setCriteriaForm(emptyCriteriaForm);
        setFormErrors({});
        setCompositeScoreManual(false);
        setShowExistingPicker(null);
        setExistingSearch('');
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();

        const data = {
            ...criteriaForm,
            score: effectiveScore,
            type: 'criteria' as const,
        };

        const options = {
            onSuccess: () => closeModal(),
            onError: (errors: Record<string, string>) => {
                setFormErrors(errors);
            },
        };

        if (editingId) {
            router.patch(`/risk-algorithm/${editingId}`, data as any, options);
        } else {
            router.post('/risk-algorithm', data as any, options);
        }
    }

    function handleDelete(id: number) {
        router.delete(`/risk-algorithm/${id}`);
        setDeleteConfirmId(null);
    }

    function handleDeleteAll() {
        router.delete('/risk-algorithm-all');
        setDeleteAllConfirm(false);
    }

    function addCriteriaItem() {
        setCriteriaForm({
            ...criteriaForm,
            criteria_pattern_items: [
                ...criteriaForm.criteria_pattern_items,
                {
                    id: nextTempId(),
                    title: '',
                    regex: '',
                    score: 0,
                    operator: 'and',
                    risk_weight: 'medium',
                    sub_items: [],
                },
            ],
        });
    }

    function addSubCriteriaItem(parentIndex: number) {
        const updatedItems = [...criteriaForm.criteria_pattern_items];
        const parentItem = { ...updatedItems[parentIndex] };

        if (!parentItem.sub_items) {
            parentItem.sub_items = [];
        }

        parentItem.sub_items = [
            ...parentItem.sub_items,
            {
                id: nextTempId(),
                title: '',
                regex: '',
                score: 0,
                operator: 'and',
                risk_weight: 'medium',
            },
        ];
        updatedItems[parentIndex] = parentItem;
        setCriteriaForm({
            ...criteriaForm,
            criteria_pattern_items: updatedItems,
        });
    }

    function removeCriteriaItem(index: number) {
        const updatedItems = [...criteriaForm.criteria_pattern_items];
        updatedItems.splice(index, 1);
        setCriteriaForm({
            ...criteriaForm,
            criteria_pattern_items: updatedItems,
        });
    }

    function removeSubCriteriaItem(parentIndex: number, subIndex: number) {
        const updatedItems = [...criteriaForm.criteria_pattern_items];
        const parentItem = { ...updatedItems[parentIndex] };

        if (parentItem.sub_items) {
            parentItem.sub_items = [...parentItem.sub_items];
            parentItem.sub_items.splice(subIndex, 1);
            updatedItems[parentIndex] = parentItem;
            setCriteriaForm({
                ...criteriaForm,
                criteria_pattern_items: updatedItems,
            });
        }
    }

    function updateCriteriaItem(
        index: number,
        field: keyof CriteriaPatternItem,
        value: string | number,
    ) {
        const updatedItems = [...criteriaForm.criteria_pattern_items];
        updatedItems[index] = {
            ...updatedItems[index],
            [field]: value,
        };
        setCriteriaForm({
            ...criteriaForm,
            criteria_pattern_items: updatedItems,
        });
    }

    function updateSubCriteriaItem(
        parentIndex: number,
        subIndex: number,
        field: keyof CriteriaPatternItem,
        value: string | number,
    ) {
        const updatedItems = [...criteriaForm.criteria_pattern_items];
        const parentItem = { ...updatedItems[parentIndex] };

        if (parentItem.sub_items) {
            const updatedSubItems = [...parentItem.sub_items];
            updatedSubItems[subIndex] = {
                ...updatedSubItems[subIndex],
                [field]: value,
            };
            parentItem.sub_items = updatedSubItems;
            updatedItems[parentIndex] = parentItem;
            setCriteriaForm({
                ...criteriaForm,
                criteria_pattern_items: updatedItems,
            });
        }
    }

    function addExistingPattern(pattern: RiskPattern) {
        const newItem: CriteriaPatternItem = {
            id: nextTempId(),
            title: pattern.title,
            regex: pattern.regex || '',
            score: pattern.score,
            operator: 'and',
            risk_weight: pattern.priority,
            sub_items: pattern.criteria_pattern_items || [],
        };

        setCriteriaForm({
            ...criteriaForm,
            criteria_pattern_items: [
                ...criteriaForm.criteria_pattern_items,
                newItem,
            ],
        });

        setShowExistingPicker(null);
        setExistingSearch('');
    }

    return (
        <>
            <Head title="Pattern Settings" />
            <div className="mx-auto w-full max-w-[1200px] px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="mb-3 text-[2.6rem] font-bold tracking-wide text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        CRITERIA PATTERN CONFIGURATION
                    </h1>
                    <p className="mb-6 max-w-[800px] text-[0.95rem] leading-relaxed text-muted-foreground">
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
                                            <div className="mt-2 flex items-center gap-2">
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                        pattern.priority === 'high'
                                                            ? 'bg-[rgba(248,113,113,0.2)] text-[#f87171]'
                                                            : pattern.priority === 'medium'
                                                              ? 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]'
                                                              : 'bg-[rgba(34,197,94,0.2)] text-[#22c55e]'
                                                    }`}
                                                >
                                                    {pattern.priority === 'high'
                                                        ? 'High'
                                                        : pattern.priority === 'medium'
                                                          ? 'Medium'
                                                          : 'Low'}
                                                </span>
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
                                                            openEditModal(
                                                                pattern,
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

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="mx-4 w-full max-w-3xl rounded-xl border border-[rgba(34,197,94,0.3)] bg-white shadow-2xl dark:bg-[#0f172a]">
                        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
                            <h3
                                className="text-lg font-bold"
                                style={{
                                    fontFamily: "'Unbounded', sans-serif",
                                }}
                            >
                                {editingId
                                    ? 'Edit Criteria Pattern'
                                    : 'Add Criteria Pattern'}
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
                            {Object.keys(formErrors).length > 0 && (
                                <AlertError
                                    errors={Object.values(formErrors)}
                                    title="Unable to save criteria pattern"
                                />
                            )}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                    Criteria Title
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={criteriaForm.title}
                                    onChange={(e) =>
                                        setCriteriaForm({
                                            ...criteriaForm,
                                            title: e.target.value,
                                        })
                                    }
                                    placeholder="e.g., University Data"
                                    className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                    Composite Score
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        required
                                        value={effectiveScore}
                                        onChange={(e) => {
                                            setCompositeScoreManual(true);
                                            setCriteriaForm({
                                                ...criteriaForm,
                                                score:
                                                    parseInt(e.target.value) ||
                                                    0,
                                            });
                                        }}
                                        className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                    />
                                    {!compositeScoreManual && (
                                        <span className="rounded-full bg-[rgba(34,197,94,0.15)] px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground">
                                            Auto
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                    Priority
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCriteriaForm({
                                                ...criteriaForm,
                                                priority: 'low',
                                            })
                                        }
                                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                                            criteriaForm.priority === 'low'
                                                ? 'border-able-green bg-able-green text-white'
                                                : 'border-black/10 text-muted-foreground hover:text-foreground dark:border-white/10'
                                        }`}
                                    >
                                        Low
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCriteriaForm({
                                                ...criteriaForm,
                                                priority: 'medium',
                                            })
                                        }
                                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                                            criteriaForm.priority === 'medium'
                                                ? 'border-[#f59e0b] bg-[#f59e0b] text-white'
                                                : 'border-black/10 text-muted-foreground hover:text-foreground dark:border-white/10'
                                        }`}
                                    >
                                        Medium
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCriteriaForm({
                                                ...criteriaForm,
                                                priority: 'high',
                                            })
                                        }
                                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                                            criteriaForm.priority === 'high'
                                                ? 'border-[#f87171] bg-[#f87171] text-white'
                                                : 'border-black/10 text-muted-foreground hover:text-foreground dark:border-white/10'
                                        }`}
                                    >
                                        High
                                    </button>
                                </div>
                            </div>

                            {/* Pattern Items Table */}
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <label className="block text-sm font-medium text-muted-foreground">
                                        Pattern Items
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowExistingPicker(
                                                    showExistingPicker
                                                        ? null
                                                        : -1,
                                                )
                                            }
                                            className="flex items-center gap-1 rounded-md border border-[#36cfc9] px-3 py-1 text-sm font-semibold text-[#36cfc9] transition-colors hover:bg-[#36cfc9] hover:text-white"
                                        >
                                            <Copy size={14} />
                                            Add Existing
                                        </button>
                                        <button
                                            type="button"
                                            onClick={addCriteriaItem}
                                            className="rounded-md border border-able-green px-3 py-1 text-sm font-semibold text-able-green transition-colors hover:bg-able-green hover:text-white"
                                        >
                                            + Add Item
                                        </button>
                                    </div>
                                </div>

                                {/* Existing Pattern Picker Modal */}
                                {showExistingPicker !== null && (
                                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                                        <div className="mx-4 w-full max-w-2xl rounded-xl border border-[rgba(34,197,94,0.3)] bg-white shadow-2xl dark:bg-[#0f172a]">
                                            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
                                                <h3
                                                    className="text-lg font-bold"
                                                    style={{
                                                        fontFamily:
                                                            "'Unbounded', sans-serif",
                                                    }}
                                                >
                                                    Add Existing Pattern
                                                </h3>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowExistingPicker(null);
                                                        setExistingSearch('');
                                                    }}
                                                    className="cursor-pointer rounded-md border-none bg-transparent p-1 text-muted-foreground transition-colors hover:text-foreground"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                            <div className="space-y-3 px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative flex-1">
                                                        <Search
                                                            size={14}
                                                            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Search patterns..."
                                                            value={existingSearch}
                                                            onChange={(e) =>
                                                                setExistingSearch(
                                                                    e.target.value,
                                                                )
                                                            }
                                                            className="w-full rounded-lg border border-black/10 bg-black/5 py-2.5 pr-3 pl-9 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus:border-[#36cfc9] dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                                                        />
                                                    </div>
                                                    <select
                                                        value={existingSort}
                                                        onChange={(e) =>
                                                            setExistingSort(
                                                                e.target
                                                                    .value as ExistingSort,
                                                            )
                                                        }
                                                        className="rounded-lg border border-black/10 bg-black/5 px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#36cfc9] dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                                                    >
                                                        <option value="newest">
                                                            Newest
                                                        </option>
                                                        <option value="oldest">
                                                            Oldest
                                                        </option>
                                                        <option value="name">
                                                            Name (A-Z)
                                                        </option>
                                                        <option value="priority">
                                                            Priority (High-Low)
                                                        </option>
                                                        <option value="score">
                                                            Score (High-Low)
                                                        </option>
                                                    </select>
                                                </div>

                                                <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-black/5 dark:bg-white/5">
                                                                <th className="px-4 py-2.5 text-left font-normal text-muted-foreground">
                                                                    Pattern Name
                                                                </th>
                                                                <th className="w-28 px-4 py-2.5 text-left font-normal text-muted-foreground">
                                                                    Pattern Type
                                                                </th>
                                                                <th className="w-28 px-4 py-2.5 text-left font-normal text-muted-foreground">
                                                                    Priority Level
                                                                </th>
                                                                <th className="w-20 px-4 py-2.5 text-left font-normal text-muted-foreground">
                                                                    Score
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {sortedPatterns.map(
                                                                (pattern) => (
                                                                    <tr
                                                                        key={pattern.id}
                                                                        onClick={() =>
                                                                            addExistingPattern(
                                                                                pattern,
                                                                            )
                                                                        }
                                                                        className="cursor-pointer transition-colors hover:bg-[rgba(54,207,201,0.08)]"
                                                                    >
                                                                        <td
                                                                            className="max-w-[240px] truncate px-4 py-2.5 font-semibold text-foreground"
                                                                            title={
                                                                                pattern.title
                                                                            }
                                                                        >
                                                                            {
                                                                                pattern.title
                                                                            }
                                                                        </td>
                                                                        <td className="px-4 py-2.5">
                                                                            <span
                                                                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                                                    pattern.type ===
                                                                                    'criteria'
                                                                                        ? 'bg-[rgba(54,207,201,0.15)] text-[#36cfc9]'
                                                                                        : 'bg-black/5 text-muted-foreground dark:bg-white/10'
                                                                                }`}
                                                                            >
                                                                                {pattern.type ===
                                                                                'criteria'
                                                                                    ? 'Criteria'
                                                                                    : 'Single'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-2.5">
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
                                                                                {pattern.priority ===
                                                                                'high'
                                                                                    ? 'High'
                                                                                    : pattern.priority ===
                                                                                          'medium'
                                                                                        ? 'Medium'
                                                                                        : 'Low'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-muted-foreground">
                                                                            {
                                                                                pattern.score
                                                                            }
                                                                        </td>
                                                                    </tr>
                                                                ),
                                                            )}
                                                            {sortedPatterns.length ===
                                                                0 && (
                                                                <tr>
                                                                    <td
                                                                        colSpan={4}
                                                                        className="py-6 text-center text-muted-foreground"
                                                                    >
                                                                        No patterns
                                                                        found.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowExistingPicker(null);
                                                        setExistingSearch('');
                                                    }}
                                                    className="w-full cursor-pointer rounded-md border border-black/10 bg-transparent py-2 text-sm text-muted-foreground transition-colors hover:text-foreground dark:border-white/10"
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {criteriaForm.criteria_pattern_items.length >
                                0 ? (
                                    <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-black/5 dark:bg-white/5">
                                                    <th className="px-3 py-2 text-left font-normal text-muted-foreground">
                                                        Title
                                                    </th>
                                                    <th className="w-16 px-3 py-2 text-left font-normal text-muted-foreground">
                                                        Logic
                                                    </th>
                                                    <th className="px-3 py-2 text-left font-normal text-muted-foreground">
                                                        Regex
                                                    </th>
                                                   <th className="w-20 px-3 py-2 text-left font-normal text-muted-foreground">
                                                        Score
                                                    </th>
                                                    <th className="w-28 px-3 py-2 text-left font-normal text-muted-foreground">
                                                        Risk Weight
                                                    </th>
                                                    <th className="w-20 px-3 py-2"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {criteriaForm.criteria_pattern_items.map(
                                                    (item, idx) => (
                                                        <Fragment key={item.id}>
                                                            <tr className="border-t border-black/5 dark:border-white/5">
                                                                <td className="px-2 py-2">
                                                                    <input
                                                                        type="text"
                                                                        required
                                                                        value={
                                                                            item.title
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateCriteriaItem(
                                                                                idx,
                                                                                'title',
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                            )
                                                                        }
                                                                        placeholder="Title"
                                                                        className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                                                    />
                                                                </td>
                                                                <td className="px-2 py-2">
                                                                    <div className="flex overflow-hidden rounded-md border border-black/10 dark:border-white/10">
                                                                        {(
                                                                            [
                                                                                'and',
                                                                                'or',
                                                                            ] as const
                                                                        ).map(
                                                                            (
                                                                                op,
                                                                            ) => (
                                                                                <button
                                                                                    key={
                                                                                        op
                                                                                    }
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        updateCriteriaItem(
                                                                                            idx,
                                                                                            'operator',
                                                                                            op,
                                                                                        )
                                                                                    }
                                                                                    title={`Require ${op === 'and' ? 'all' : 'any'} sibling item to match`}
                                                                                    className={`px-2 py-1 text-xs font-semibold uppercase transition-colors ${
                                                                                        (item.operator ||
                                                                                            'and') ===
                                                                                        op
                                                                                            ? 'bg-able-green text-white'
                                                                                            : 'text-muted-foreground hover:text-foreground'
                                                                                    }`}
                                                                                >
                                                                                    {
                                                                                        op
                                                                                    }
                                                                                </button>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-2 py-2">
                                                                    <input
                                                                        type="text"
                                                                        required={
                                                                            item.sub_items ===
                                                                                undefined ||
                                                                            item.sub_items.length ===
                                                                                0
                                                                        }
                                                                        value={
                                                                            item.regex
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateCriteriaItem(
                                                                                idx,
                                                                                'regex',
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                            )
                                                                        }
                                                                        placeholder={
                                                                            item.sub_items &&
                                                                            item.sub_items.length >
                                                                                0 &&
                                                                            item.regex ===
                                                                                ''
                                                                                ? 'Group — matches via sub-items'
                                                                                : 'Regex'
                                                                        }
                                                                        className="w-full rounded border border-black/10 bg-transparent px-2 py-1 font-mono text-sm text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                                                    />
                                                                </td>
                                                                <td className="px-2 py-2">
                                                                    <input
                                                                        type="text"
                                                                        inputMode="numeric"
                                                                        required
                                                                        value={
                                                                            item.score
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateCriteriaItem(
                                                                                idx,
                                                                                'score',
                                                                                parseInt(
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                ) ||
                                                                                    0,
                                                                            )
                                                                        }
                                                                        className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                                                    />
                                                                </td>
                                                                <td className="px-2 py-2">
                                                                    <span
                                                                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                                            (item.risk_weight || 'medium') === 'high'
                                                                                ? 'bg-[rgba(248,113,113,0.2)] text-[#f87171]'
                                                                                : (item.risk_weight || 'medium') === 'medium'
                                                                                  ? 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]'
                                                                                  : 'bg-[rgba(34,197,94,0.2)] text-[#22c55e]'
                                                                        }`}
                                                                    >
                                                                        {(item.risk_weight || 'medium') === 'high' ? 'High' : (item.risk_weight || 'medium') === 'medium' ? 'Medium' : 'Low'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-2">
                                                                    <div className="flex gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                addSubCriteriaItem(
                                                                                    idx,
                                                                                )
                                                                            }
                                                                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green"
                                                                            title="Add Sub-Item"
                                                                        >
                                                                            <Plus
                                                                                size={
                                                                                    14
                                                                                }
                                                                            />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                removeCriteriaItem(
                                                                                    idx,
                                                                                )
                                                                            }
                                                                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-[rgba(248,113,113,0.1)] hover:text-[#f87171]"
                                                                        >
                                                                            <X
                                                                                size={
                                                                                    14
                                                                                }
                                                                            />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {/* Sub-items */}
                                                            {item.sub_items &&
                                                                item.sub_items.map(
                                                                    (
                                                                        subItem,
                                                                        subIdx,
                                                                    ) => (
                                                                        <tr
                                                                            key={
                                                                                subItem.id
                                                                            }
                                                                            className="border-t border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]"
                                                                        >
                                                                            <td className="px-2 py-2 pl-6">
                                                                                <input
                                                                                    type="text"
                                                                                    required
                                                                                    value={
                                                                                        subItem.title
                                                                                    }
                                                                                    onChange={(
                                                                                        e,
                                                                                    ) =>
                                                                                        updateSubCriteriaItem(
                                                                                            idx,
                                                                                            subIdx,
                                                                                            'title',
                                                                                            e
                                                                                                .target
                                                                                                .value,
                                                                                        )
                                                                                    }
                                                                                    placeholder="Sub-item title"
                                                                                    className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                                                                />
                                                                            </td>
                                                                            <td className="px-2 py-2">
                                                                                <div className="flex overflow-hidden rounded-md border border-black/10 dark:border-white/10">
                                                                                    {(
                                                                                        [
                                                                                            'and',
                                                                                            'or',
                                                                                        ] as const
                                                                                    ).map(
                                                                                        (
                                                                                            op,
                                                                                        ) => (
                                                                                            <button
                                                                                                key={
                                                                                                    op
                                                                                                }
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    updateSubCriteriaItem(
                                                                                                        idx,
                                                                                                        subIdx,
                                                                                                        'operator',
                                                                                                        op,
                                                                                                    )
                                                                                                }
                                                                                                title={`Require ${op === 'and' ? 'all' : 'any'} sibling sub-item to match`}
                                                                                                className={`px-2 py-1 text-xs font-semibold uppercase transition-colors ${
                                                                                                    (subItem.operator ||
                                                                                                        'and') ===
                                                                                                    op
                                                                                                        ? 'bg-able-green text-white'
                                                                                                        : 'text-muted-foreground hover:text-foreground'
                                                                                                }`}
                                                                                            >
                                                                                                {
                                                                                                    op
                                                                                                }
                                                                                            </button>
                                                                                        ),
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-2 py-2">
                                                                                <input
                                                                                    type="text"
                                                                                    required
                                                                                    value={
                                                                                        subItem.regex
                                                                                    }
                                                                                    onChange={(
                                                                                        e,
                                                                                    ) =>
                                                                                        updateSubCriteriaItem(
                                                                                            idx,
                                                                                            subIdx,
                                                                                            'regex',
                                                                                            e
                                                                                                .target
                                                                                                .value,
                                                                                        )
                                                                                    }
                                                                                    placeholder="Sub-item regex"
                                                                                    className="w-full rounded border border-black/10 bg-transparent px-2 py-1 font-mono text-sm text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                                                                />
                                                                            </td>
                                                                            <td className="px-2 py-2">
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="numeric"
                                                                                    required
                                                                                    value={
                                                                                        subItem.score
                                                                                    }
                                                                                    onChange={(
                                                                                        e,
                                                                                    ) =>
                                                                                        updateSubCriteriaItem(
                                                                                            idx,
                                                                                            subIdx,
                                                                                            'score',
                                                                                            parseInt(
                                                                                                e
                                                                                                    .target
                                                                                                    .value,
                                                                                            ) ||
                                                                                                0,
                                                                                        )
                                                                                    }
                                                                                    className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-sm text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                                                                />
                                                                            </td>
                                                                            <td className="px-2 py-2">
                                                                                <span
                                                                                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                                                        (subItem.risk_weight || 'medium') === 'high'
                                                                                            ? 'bg-[rgba(248,113,113,0.2)] text-[#f87171]'
                                                                                            : (subItem.risk_weight || 'medium') === 'medium'
                                                                                              ? 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]'
                                                                                              : 'bg-[rgba(34,197,94,0.2)] text-[#22c55e]'
                                                                                    }`}
                                                                                >
                                                                                    {(subItem.risk_weight || 'medium') === 'high' ? 'High' : (subItem.risk_weight || 'medium') === 'medium' ? 'Medium' : 'Low'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-2 py-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        removeSubCriteriaItem(
                                                                                            idx,
                                                                                            subIdx,
                                                                                        )
                                                                                    }
                                                                                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-[rgba(248,113,113,0.1)] hover:text-[#f87171]"
                                                                                >
                                                                                    <X
                                                                                        size={
                                                                                            14
                                                                                        }
                                                                                    />
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ),
                                                                )}
                                                        </Fragment>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-black/10 py-4 text-center text-sm text-muted-foreground dark:border-white/10">
                                        No pattern items added. Click "Add Item"
                                        or "Add Existing" to add patterns.
                                    </div>
                                )}
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
                                    className="rounded-lg bg-able-green px-4 py-2 font-semibold text-white transition-colors hover:bg-[#1a9e4b]"
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
        { title: 'Risk Algorithm', href: '/risk-algorithm/criteria' },
        {
            title: 'Pattern Settings',
            href: '/risk-algorithm/criteria',
        },
    ],
};
