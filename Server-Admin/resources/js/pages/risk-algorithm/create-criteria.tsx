import { Head, router, usePage } from '@inertiajs/react';
import { Search, Plus, X, Copy, ArrowLeft, Info } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState, Fragment, useMemo } from 'react';
import AlertError from '@/components/alert-error';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface CriteriaPatternItem {
    id: number;
    title: string;
    regex: string;
    score: number;
    operator?: 'and' | 'or';
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
    existingPatterns: RiskPattern[];
    [key: string]: unknown;
}

interface CriteriaFormData {
    title: string;
    score: string;
    priority: 'low' | 'medium' | 'high';
    criteria_pattern_items: CriteriaPatternItem[];
}

type ExistingSort = 'newest' | 'oldest' | 'name' | 'priority' | 'score';

const emptyCriteriaForm: CriteriaFormData = {
    title: '',
    score: '',
    priority: 'medium',
    criteria_pattern_items: [],
};

function sumSubItemsScore(subItems?: CriteriaPatternItem[]): number {
    if (!subItems || subItems.length === 0) return 0;

    return subItems.reduce(
        (total, sub) => total + (Number(sub.score) || 0),
        0,
    );
}

// Recursive helper: sum all item scores (top-level + all nested sub-items).
function sumAllItemScores(items: CriteriaPatternItem[]): number {
    return items.reduce((total, item) => {
        if (item.sub_items && item.sub_items.length > 0) {
            return total + sumSubItemsScore(item.sub_items);
        }

        return total + (Number(item.score) || 0);
    }, 0);
}

// Temporary client-side ids for unsaved criteria items, used only as React
// keys until the server assigns real ids on save.
let tempIdCounter = 0;
function nextTempId(): number {
    tempIdCounter += 1;

    return tempIdCounter;
}

export default function CreateCriteriaPattern() {
    const { existingPatterns } = usePage<PageProps>().props;

    const [criteriaForm, setCriteriaForm] =
        useState<CriteriaFormData>(emptyCriteriaForm);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [compositeScoreManual, setCompositeScoreManual] = useState(false);
    const [showExistingPicker, setShowExistingPicker] = useState(false);
    const [existingSearch, setExistingSearch] = useState('');
    const [existingSort, setExistingSort] = useState<ExistingSort>('newest');
    const [confirmCreate, setConfirmCreate] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);

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
    const autoCompositeScore = useMemo(
        () => sumAllItemScores(criteriaForm.criteria_pattern_items),
        [criteriaForm.criteria_pattern_items],
    );

    const effectiveScore = compositeScoreManual
        ? criteriaForm.score
        : String(autoCompositeScore);

    const isDirty =
        criteriaForm.title !== '' ||
        criteriaForm.score !== '' ||
        criteriaForm.priority !== emptyCriteriaForm.priority ||
        criteriaForm.criteria_pattern_items.length > 0;

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setConfirmCreate(true);
    }

    function submitForm() {
        const data = {
            title: criteriaForm.title,
            score: compositeScoreManual
                ? parseInt(criteriaForm.score) || 0
                : autoCompositeScore,
            priority: criteriaForm.priority,
            criteria_pattern_items: criteriaForm.criteria_pattern_items,
            type: 'criteria' as const,
        };

        router.post('/risk-algorithm', data as any, {
            onSuccess: () => {
                router.visit('/risk-algorithm/criteria');
            },
            onError: (errors: Record<string, string>) => {
                setFormErrors(errors);
            },
        });
    }

    function leaveCreatePage() {
        if (isDirty) {
            setConfirmCancel(true);
        } else {
            router.visit('/risk-algorithm/criteria');
        }
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
            },
        ];
        parentItem.score = sumSubItemsScore(parentItem.sub_items);
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
            if (parentItem.sub_items.length > 0) {
                parentItem.score = sumSubItemsScore(parentItem.sub_items);
            }
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
            if (field === 'score') {
                parentItem.score = sumSubItemsScore(updatedSubItems);
            }
            updatedItems[parentIndex] = parentItem;
            setCriteriaForm({
                ...criteriaForm,
                criteria_pattern_items: updatedItems,
            });
        }
    }

    function addExistingPattern(pattern: RiskPattern) {
        const subItems = pattern.criteria_pattern_items || [];
        const hasSub = subItems.length > 0;
        const newItem: CriteriaPatternItem = {
            id: nextTempId(),
            title: pattern.title,
            regex: pattern.regex || '',
            score: hasSub ? sumSubItemsScore(subItems) : pattern.score,
            operator: 'and',
            sub_items: subItems,
        };

        setCriteriaForm({
            ...criteriaForm,
            criteria_pattern_items: [
                ...criteriaForm.criteria_pattern_items,
                newItem,
            ],
        });
        setShowExistingPicker(false);
        setExistingSearch('');
    }

    return (
        <>
            <Head title="Create Criteria Pattern" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                {/* Back link */}
                <button
                    type="button"
                    onClick={leaveCreatePage}
                    className="mb-6 inline-flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft size={16} />
                    Back to Pattern Settings
                </button>

                {/* Page Header */}
                <header className="mb-8">
                    <h1
                        className="mb-3 text-[2.8rem] font-bold tracking-wide text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        CREATE CRITERIA PATTERN
                    </h1>
                    <p className="mb-6 max-w-[700px] text-[1.05rem] text-muted-foreground">
                        Define a new criteria pattern that groups multiple regex
                        rules together. ABLE evaluates these as a set when
                        scanning files for sensitive content.
                    </p>
                </header>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    {Object.keys(formErrors).length > 0 && (
                        <AlertError
                            errors={Object.values(formErrors)}
                            title="Unable to create criteria pattern"
                        />
                    )}

                    {/* Title & Score row */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
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
                                className="w-full rounded-lg border border-black/10 bg-transparent px-4 py-2.5 text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                                Composite Score
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    required
                                    value={effectiveScore}
                                    onChange={(e) => {
                                        setCompositeScoreManual(true);
                                        setCriteriaForm({
                                            ...criteriaForm,
                                            score: e.target.value,
                                        });
                                    }}
                                    placeholder="Auto-calculated from items"
                                    className="w-full rounded-lg border border-black/10 bg-transparent px-4 py-2.5 text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                />
                                {!compositeScoreManual && (
                                    <span className="shrink-0 rounded-full bg-[rgba(34,197,94,0.15)] px-2.5 py-1 text-xs whitespace-nowrap text-muted-foreground">
                                        Auto
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Sum of all item scores. Type a value to
                                override.
                            </p>
                        </div>
                    </div>

                    {/* Priority (spaced +20% from the title/score row) */}
                    <div className="mt-[29px]">
                        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
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
                                className={`rounded-lg border px-5 py-2 text-sm font-semibold transition-colors ${
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
                                className={`rounded-lg border px-5 py-2 text-sm font-semibold transition-colors ${
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
                                className={`rounded-lg border px-5 py-2 text-sm font-semibold transition-colors ${
                                    criteriaForm.priority === 'high'
                                        ? 'border-[#f87171] bg-[#f87171] text-white'
                                        : 'border-black/10 text-muted-foreground hover:text-foreground dark:border-white/10'
                                }`}
                            >
                                High
                            </button>
                        </div>
                    </div>

                    {/* Pattern Items Section */}
                    <div className="mt-[34px]">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <label className="block text-sm font-medium text-foreground">
                                    Pattern Items
                                </label>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Define the detection patterns and regular expressions for this criteria.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowExistingPicker(
                                            !showExistingPicker,
                                        )
                                    }
                                    className="flex items-center gap-1 rounded-md border border-[#36cfc9] px-3 py-1.5 text-sm font-semibold text-[#36cfc9] transition-colors hover:bg-[#36cfc9] hover:text-white"
                                >
                                    <Copy size={14} />
                                    Add Existing
                                </button>
                                <button
                                    type="button"
                                    onClick={addCriteriaItem}
                                    className="rounded-md border border-able-green px-3 py-1.5 text-sm font-semibold text-able-green transition-colors hover:bg-able-green hover:text-white"
                                >
                                    + Add Item
                                </button>
                            </div>
                        </div>

                        {/* Option 2: Pattern Classification Guide */}
                        <div className="mb-4 rounded-xl border border-black/10 bg-black/[0.02] p-4 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.02]">
                            <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                                <Info size={15} className="shrink-0 text-able-green" />
                                <span>Pattern Classification Guide</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="flex items-start gap-2 rounded-lg border border-black/5 bg-white/50 p-2.5 dark:border-white/5 dark:bg-white/5">
                                    <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-able-green" />
                                    <div>
                                        <span className="font-semibold text-foreground">Required (Strict — AND)</span>
                                        <p className="mt-0.5 text-muted-foreground">All required patterns must be detected together in the content.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 rounded-lg border border-black/5 bg-white/50 p-2.5 dark:border-white/5 dark:bg-white/5">
                                    <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#36cfc9]" />
                                    <div>
                                        <span className="font-semibold text-foreground">Flexible (Alternative — OR)</span>
                                        <p className="mt-0.5 text-muted-foreground">Any one or more flexible patterns will trigger this criteria rule.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Existing Pattern Picker Modal */}
                        {showExistingPicker && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
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
                                                setShowExistingPicker(false);
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
                                                                                ? 'bg-[rgba(168,85,247,0.2)] text-[#a855f7]'
                                                                                : 'bg-[rgba(54,207,201,0.2)] text-[#36cfc9]'
                                                                        }`}
                                                                    >
                                                                        {pattern.type ===
                                                                        'criteria'
                                                                            ? 'Criteria'
                                                                            : 'Regex'}
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
                                                                <td className="px-4 py-2.5 text-foreground">
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
                                                setShowExistingPicker(false);
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
                        {criteriaForm.criteria_pattern_items.length > 0 ? (
                            <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-black/5 dark:bg-white/5">
                                            <th className="px-4 py-2.5 text-left font-normal text-muted-foreground">
                                                Title
                                            </th>
                                            <th className="w-44 px-4 py-2.5 text-left font-normal text-muted-foreground">
                                                Requirement
                                            </th>
                                            <th className="px-4 py-2.5 text-left font-normal text-muted-foreground">
                                                Regex Pattern
                                            </th>
                                            <th className="w-24 px-4 py-2.5 text-left font-normal text-muted-foreground">
                                                Score
                                            </th>
                                            <th className="w-20 px-4 py-2.5"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {criteriaForm.criteria_pattern_items.map(
                                            (item, idx) => {
                                                const hasSubItems = Boolean(
                                                    item.sub_items &&
                                                        item.sub_items.length >
                                                            0,
                                                );

                                                return (
                                                    <Fragment key={item.id}>
                                                        <tr className="border-t border-black/5 dark:border-white/5">
                                                            <td className="px-3 py-2.5">
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
                                                                    className="w-full rounded-md border border-black/10 bg-transparent px-3 py-1.5 text-sm text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                <div className="flex w-full overflow-hidden rounded-md border border-black/10 text-xs font-semibold dark:border-white/10">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            updateCriteriaItem(
                                                                                idx,
                                                                                'operator',
                                                                                'and',
                                                                            )
                                                                        }
                                                                        title="Required: Must be detected along with all other required patterns (AND)"
                                                                        className={`flex-1 cursor-pointer py-1.5 text-center transition-colors ${
                                                                            (item.operator ||
                                                                                'and') ===
                                                                            'and'
                                                                                ? 'bg-able-green text-white'
                                                                                : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5'
                                                                        }`}
                                                                    >
                                                                        Required
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            updateCriteriaItem(
                                                                                idx,
                                                                                'operator',
                                                                                'or',
                                                                            )
                                                                        }
                                                                        title="Flexible: Any one or more flexible patterns will trigger (OR)"
                                                                        className={`flex-1 cursor-pointer py-1.5 text-center transition-colors ${
                                                                            item.operator ===
                                                                            'or'
                                                                                ? 'bg-[#36cfc9] text-white'
                                                                                : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5'
                                                                        }`}
                                                                    >
                                                                        Flexible
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                <input
                                                                    type="text"
                                                                    required={
                                                                        !hasSubItems
                                                                    }
                                                                    readOnly={
                                                                        hasSubItems
                                                                    }
                                                                    disabled={
                                                                        hasSubItems
                                                                    }
                                                                    value={
                                                                        hasSubItems
                                                                            ? ''
                                                                            : item.regex
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
                                                                        hasSubItems
                                                                            ? 'Group — evaluated via sub-patterns'
                                                                            : 'Regex pattern'
                                                                    }
                                                                    className={`w-full rounded-md border px-3 py-1.5 font-mono text-sm transition-colors outline-none ${
                                                                        hasSubItems
                                                                            ? 'cursor-not-allowed border-black/5 bg-black/5 text-muted-foreground placeholder:italic dark:border-white/5 dark:bg-white/5'
                                                                            : 'border-black/10 bg-transparent text-foreground focus:border-able-green dark:border-white/10'
                                                                    }`}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    required
                                                                    readOnly={
                                                                        hasSubItems
                                                                    }
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
                                                                    title={
                                                                        hasSubItems
                                                                            ? 'Summed automatically from sub-patterns'
                                                                            : undefined
                                                                    }
                                                                    className={`w-full rounded-md border px-3 py-1.5 text-sm transition-colors outline-none ${
                                                                        hasSubItems
                                                                            ? 'cursor-not-allowed border-black/5 bg-black/5 font-semibold text-foreground dark:border-white/5 dark:bg-white/5'
                                                                            : 'border-black/10 bg-transparent text-foreground focus:border-able-green dark:border-white/10'
                                                                    }`}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2.5">
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            addSubCriteriaItem(
                                                                                idx,
                                                                            )
                                                                        }
                                                                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green"
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
                                                                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[rgba(248,113,113,0.1)] hover:text-[#f87171]"
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
                                                                        <td className="px-3 py-2.5 pl-8">
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
                                                                                className="w-full rounded-md border border-black/10 bg-transparent px-3 py-1.5 text-sm text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                                                            />
                                                                        </td>
                                                                        <td className="px-3 py-2.5">
                                                                            <div className="flex w-full overflow-hidden rounded-md border border-black/10 text-xs font-semibold dark:border-white/10">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        updateSubCriteriaItem(
                                                                                            idx,
                                                                                            subIdx,
                                                                                            'operator',
                                                                                            'and',
                                                                                        )
                                                                                    }
                                                                                    title="Required: Must be detected along with other sub-patterns (AND)"
                                                                                    className={`flex-1 cursor-pointer py-1.5 text-center transition-colors ${
                                                                                        (subItem.operator ||
                                                                                            'and') ===
                                                                                        'and'
                                                                                            ? 'bg-able-green text-white'
                                                                                            : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5'
                                                                                    }`}
                                                                                >
                                                                                    Required
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        updateSubCriteriaItem(
                                                                                            idx,
                                                                                            subIdx,
                                                                                            'operator',
                                                                                            'or',
                                                                                        )
                                                                                    }
                                                                                    title="Flexible: Any flexible sub-pattern will trigger (OR)"
                                                                                    className={`flex-1 cursor-pointer py-1.5 text-center transition-colors ${
                                                                                        subItem.operator ===
                                                                                        'or'
                                                                                            ? 'bg-[#36cfc9] text-white'
                                                                                            : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5'
                                                                                    }`}
                                                                                >
                                                                                    Flexible
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-2.5">
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
                                                                                className="w-full rounded-md border border-black/10 bg-transparent px-3 py-1.5 font-mono text-sm text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                                                            />
                                                                        </td>
                                                                        <td className="px-3 py-2.5">
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
                                                                                className="w-full rounded-md border border-black/10 bg-transparent px-3 py-1.5 text-sm text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                                                            />
                                                                        </td>
                                                                        <td className="px-3 py-2.5">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    removeSubCriteriaItem(
                                                                                        idx,
                                                                                        subIdx,
                                                                                    )
                                                                                }
                                                                                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[rgba(248,113,113,0.1)] hover:text-[#f87171]"
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
                                                );
                                            },
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-black/10 py-8 text-center text-sm text-muted-foreground dark:border-white/10">
                                No pattern items yet. Click &quot;Add Item&quot;
                                or &quot;Add Existing&quot; to get started.
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="mt-6 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={leaveCreatePage}
                            className="cursor-pointer rounded-lg border border-black/10 bg-transparent px-5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground dark:border-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="cursor-pointer rounded-lg bg-able-green px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1a9e4b]"
                        >
                            Create Criteria Pattern
                        </button>
                    </div>
                </form>
            </div>

            {/* Confirm before creating */}
            <ConfirmDialog
                open={confirmCreate}
                onOpenChange={setConfirmCreate}
                title="Create criteria pattern?"
                description={`"${criteriaForm.title || 'Untitled pattern'}" will be created with ${criteriaForm.criteria_pattern_items.length} pattern item(s) and a composite score of ${effectiveScore}.`}
                confirmLabel="Create Pattern"
                cancelLabel="Keep Editing"
                variant="default"
                onConfirm={submitForm}
            />

            {/* Confirm before discarding */}
            <ConfirmDialog
                open={confirmCancel}
                onOpenChange={setConfirmCancel}
                title="Discard changes?"
                description="Any pattern items and details you entered on this page will be lost."
                confirmLabel="Discard"
                cancelLabel="Keep Editing"
                onConfirm={() => router.visit('/risk-algorithm/criteria')}
            />
        </>
    );
}

CreateCriteriaPattern.layout = {
    breadcrumbs: [
        { title: 'Policy Administration', href: '/risk-algorithm/criteria' },
        { title: 'Risk Policy', href: '/risk-algorithm/criteria' },
        {
            title: 'Create Criteria Pattern',
            href: '/risk-algorithm/criteria/create',
        },
    ],
};
