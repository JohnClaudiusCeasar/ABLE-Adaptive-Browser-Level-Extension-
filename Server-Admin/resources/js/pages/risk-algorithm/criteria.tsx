import { Head, router, usePage } from '@inertiajs/react';
import { ChevronDown, Pencil, Search, Trash2, Plus, X, Trash, Copy } from 'lucide-react';
import type { FormEvent} from 'react';
import { useState, Fragment, useMemo } from 'react';
import AlertError from '@/components/alert-error';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

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
    status: 'active' | 'inactive';
    score: number;
    criteria_pattern_items: CriteriaPatternItem[];
    created_at: string;
    updated_at: string;
}

interface PageProps {
    riskPatterns: RiskPattern[];
    singlePatterns: RiskPattern[];
    [key: string]: unknown;
}

interface CriteriaFormData {
    title: string;
    score: number;
    status: 'active' | 'inactive';
    criteria_pattern_items: CriteriaPatternItem[];
}

const emptyCriteriaForm: CriteriaFormData = {
    title: '',
    score: 0,
    status: 'active',
    criteria_pattern_items: [],
};

export default function CriteriaPatternConfiguration() {
    const { riskPatterns, singlePatterns } = usePage<PageProps>().props;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [criteriaForm, setCriteriaForm] = useState<CriteriaFormData>(emptyCriteriaForm);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
    const [showExistingPicker, setShowExistingPicker] = useState<number | null>(null);
    const [existingSearch, setExistingSearch] = useState('');

    // Filter patterns
    const filteredPatterns = useMemo(() => {
        if (!searchQuery) {
return riskPatterns;
}

        return riskPatterns.filter((p) =>
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.regex && p.regex.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [riskPatterns, searchQuery]);

    // Available patterns for existing picker
    const availablePatterns = useMemo(() => {
        const search = existingSearch.toLowerCase();

        return singlePatterns.filter((p) =>
            p.title.toLowerCase().includes(search) ||
            (p.regex && p.regex.toLowerCase().includes(search))
        );
    }, [singlePatterns, existingSearch]);

    function openAddModal() {
        setEditingId(null);
        setCriteriaForm(emptyCriteriaForm);
        setFormErrors({});
        setShowModal(true);
    }

    function openEditModal(pattern: RiskPattern) {
        setEditingId(pattern.id);
        setCriteriaForm({
            title: pattern.title,
            score: pattern.score,
            status: pattern.status,
            criteria_pattern_items: pattern.criteria_pattern_items || [],
        });
        setFormErrors({});
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingId(null);
        setCriteriaForm(emptyCriteriaForm);
        setFormErrors({});
        setShowExistingPicker(null);
        setExistingSearch('');
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();

        const data = {
            ...criteriaForm,
            type: 'criteria' as const,
        };

        const options = {
            onError: (errors: Record<string, string>) => {
                setFormErrors(errors);
            },
        };

        if (editingId) {
            router.patch(`/risk-algorithm/${editingId}`, data as any, options);
        } else {
            router.post('/risk-algorithm', data as any, options);
        }

        closeModal();
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
                { id: Date.now(), title: '', regex: '', score: 0, operator: 'and', sub_items: [] },
            ],
        });
    }

    function addSubCriteriaItem(parentIndex: number) {
        const updatedItems = [...criteriaForm.criteria_pattern_items];
        const parentItem = { ...updatedItems[parentIndex] };

        if (!parentItem.sub_items) {
parentItem.sub_items = [];
}

        parentItem.sub_items = [...parentItem.sub_items, { id: Date.now(), title: '', regex: '', score: 0, operator: 'and' }];
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

    function updateCriteriaItem(index: number, field: keyof CriteriaPatternItem, value: string | number) {
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

    function updateSubCriteriaItem(parentIndex: number, subIndex: number, field: keyof CriteriaPatternItem, value: string | number) {
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
            id: Date.now(),
            title: pattern.title,
            regex: pattern.regex || '',
            score: pattern.score,
            operator: 'and',
            sub_items: pattern.criteria_pattern_items || [],
        };

        setCriteriaForm({
            ...criteriaForm,
            criteria_pattern_items: [...criteriaForm.criteria_pattern_items, newItem],
        });

        setShowExistingPicker(null);
        setExistingSearch('');
    }

    function toggleCard(cardId: number) {
        setExpandedCards((prev) => ({
            ...prev,
            [cardId]: !prev[cardId],
        }));
    }

    function renderCriteriaItem(item: CriteriaPatternItem, isSubItem: boolean = false) {
        return (
            <div
                key={item.id}
                className={`${isSubItem ? 'ml-4' : ''}`}
            >
                <div
                    className="bg-[rgba(56,193,73,0.1)] grid grid-cols-[160px_1fr_56px] items-center py-2.5 px-3 border-b border-[rgba(56,193,73,0.2)]"
                    style={{
                        borderLeft: '2px solid #38c149',
                        borderRight: '2px solid #38c149',
                    }}
                >
                    <span className="font-semibold text-[0.85rem] truncate">{item.title}</span>
                    <span className="font-mono text-muted-foreground text-[0.8rem] truncate px-2">{item.regex}</span>
                    <span className="text-center text-[0.85rem]">{item.score}</span>
                </div>
                {item.sub_items && item.sub_items.map((subItem) => (
                    <div key={subItem.id} className="ml-4">
                        {renderCriteriaItem(subItem, true)}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <>
            <Head title="Criteria Pattern Configuration" />
            <div className="mx-auto w-full max-w-[1200px] px-8 pt-12 pb-[22px]">

                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="text-[2.6rem] font-bold tracking-wide mb-3 text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        CRITERIA PATTERN CONFIGURATION
                    </h1>
                    <p className="text-[0.95rem] text-muted-foreground leading-relaxed max-w-[800px] mb-6">
                        Manage criteria-based risk patterns. Each criteria pattern combines multiple regex items that ABLE evaluates together when scanning DOM files.
                    </p>
                    <div className="relative w-[300px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full py-2 pl-10 pr-3 bg-black/5 border border-black/10 rounded-full text-foreground text-[0.9rem] outline-none placeholder:text-muted-foreground dark:bg-[rgba(20,32,38,0.4)] dark:border-white/10"
                        />
                    </div>
                </header>

                {/* Header Actions */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-[1.6rem] font-bold" style={{ fontFamily: "'Unbounded', sans-serif" }}>
                        Criteria Classification
                    </h2>
                    <div className="flex items-center gap-3">
                        {riskPatterns.length > 0 && (
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
                            Add Pattern
                        </button>
                    </div>
                </div>

                {/* Criteria Card Grid */}
                {filteredPatterns.length > 0 ? (
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredPatterns.map((pattern) => {
                            const isExpanded = !!expandedCards[pattern.id];

                            return (
                                <div key={pattern.id} className={`${glassCard} p-5 flex flex-col`}>
                                    {/* Card header */}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="min-w-0">
                                            <h3
                                                className="text-[1.1rem] font-medium truncate text-foreground"
                                                style={{ fontFamily: "'Unbounded', sans-serif" }}
                                            >
                                                {pattern.title}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                    pattern.status === 'active'
                                                        ? 'bg-[rgba(34,197,94,0.2)] text-[#22c55e]'
                                                        : 'bg-[rgba(248,113,113,0.2)] text-[#f87171]'
                                                }`}>
                                                    {pattern.status === 'active' ? 'Active' : 'Inactive'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {pattern.criteria_pattern_items.length} Items
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => openEditModal(pattern)}
                                                className="bg-transparent border-none cursor-pointer p-1 hover:opacity-80"
                                            >
                                                <Pencil size={16} className="text-[#36cfc9]" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirmId(pattern.id)}
                                                className="bg-transparent border-none cursor-pointer p-1 hover:opacity-80"
                                            >
                                                <Trash2 size={16} className="text-muted-foreground" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Composite score */}
                                    <div className="mb-4">
                                        <div className="flex justify-between items-center text-[0.85rem] mb-1">
                                            <span className="text-muted-foreground">Composite Score</span>
                                            <span className="font-semibold text-foreground">{pattern.score}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-able-green transition-all"
                                                style={{ width: `${Math.min(100, pattern.score)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Expandable items */}
                                    <div className="flex-1">
                                        {pattern.criteria_pattern_items.length > 0 ? (
                                            <>
                                                <button
                                                    onClick={() => toggleCard(pattern.id)}
                                                    className="w-full flex items-center justify-between py-2 text-[0.85rem] font-semibold text-able-green hover:opacity-80 transition-opacity"
                                                >
                                                    <span>Pattern Items</span>
                                                    <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                                </button>
                                                {isExpanded && (
                                                    <div className="rounded-lg overflow-hidden border border-[rgba(56,193,73,0.3)]">
                                                        {pattern.criteria_pattern_items.map((item) => renderCriteriaItem(item))}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-black/10 dark:border-white/10 rounded-lg">
                                                No pattern items.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className={`${glassCard} py-12 text-center text-muted-foreground`}>
                        {searchQuery
                            ? 'No criteria patterns match your search.'
                            : 'No criteria patterns yet. Click "Add Pattern" to create one.'}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#0f172a] rounded-xl shadow-2xl w-full max-w-lg mx-4 border border-[rgba(34,197,94,0.3)]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
                            <h3 className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif" }}>
                                {editingId ? 'Edit Criteria Pattern' : 'Add Criteria Pattern'}
                            </h3>
                            <button onClick={closeModal} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                            {Object.keys(formErrors).length > 0 && (
                                <AlertError errors={Object.values(formErrors)} title="Unable to save criteria pattern" />
                            )}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Criteria Title</label>
                                <input
                                    type="text"
                                    required
                                    value={criteriaForm.title}
                                    onChange={(e) => setCriteriaForm({ ...criteriaForm, title: e.target.value })}
                                    placeholder="e.g., University Data"
                                    className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Composite Score</label>
                                <input
                                    type="number"
                                    required
                                    min={0}
                                    max={100}
                                    value={criteriaForm.score}
                                    onChange={(e) => setCriteriaForm({ ...criteriaForm, score: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCriteriaForm({ ...criteriaForm, status: 'active' })}
                                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                                            criteriaForm.status === 'active'
                                                ? 'border-able-green bg-able-green text-white'
                                                : 'border-black/10 dark:border-white/10 text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Active
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCriteriaForm({ ...criteriaForm, status: 'inactive' })}
                                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                                            criteriaForm.status === 'inactive'
                                                ? 'border-[#f87171] bg-[#f87171] text-white'
                                                : 'border-black/10 dark:border-white/10 text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Inactive
                                    </button>
                                </div>
                            </div>

                            {/* Pattern Items Table */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-muted-foreground">Pattern Items</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowExistingPicker(showExistingPicker ? null : -1)}
                                            className="px-3 py-1 rounded-md border border-[#36cfc9] text-[#36cfc9] text-sm font-semibold hover:bg-[#36cfc9] hover:text-white transition-colors flex items-center gap-1"
                                        >
                                            <Copy size={14} />
                                            Add Existing
                                        </button>
                                        <button
                                            type="button"
                                            onClick={addCriteriaItem}
                                            className="px-3 py-1 rounded-md border border-able-green text-able-green text-sm font-semibold hover:bg-able-green hover:text-white transition-colors"
                                        >
                                            + Add Item
                                        </button>
                                    </div>
                                </div>

                                {/* Existing Pattern Picker */}
                                {showExistingPicker !== null && (
                                    <div className="mb-3 p-3 border border-[#36cfc9]/30 rounded-lg bg-[rgba(54,207,201,0.05)]">
                                        <div className="relative mb-2">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Search patterns..."
                                                value={existingSearch}
                                                onChange={(e) => setExistingSearch(e.target.value)}
                                                className="w-full py-2 pl-9 pr-3 bg-black/5 border border-black/10 rounded-lg text-foreground text-sm outline-none placeholder:text-muted-foreground dark:bg-[rgba(15,23,42,0.4)] dark:border-white/10 focus:border-[#36cfc9] transition-colors"
                                            />
                                        </div>
                                        <div className="max-h-40 overflow-y-auto space-y-1">
                                            {availablePatterns.map((pattern) => (
                                                <button
                                                    key={pattern.id}
                                                    type="button"
                                                    onClick={() => addExistingPattern(pattern)}
                                                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-[rgba(54,207,201,0.1)] transition-colors flex items-center justify-between"
                                                >
                                                    <div>
                                                        <span className="font-semibold">{pattern.title}</span>
                                                        {pattern.regex && (
                                                            <span className="ml-2 font-mono text-xs text-muted-foreground">{pattern.regex}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        Single • {pattern.score}
                                                    </span>
                                                </button>
                                            ))}
                                            {availablePatterns.length === 0 && (
                                                <div className="text-center py-3 text-muted-foreground text-sm">
                                                    No single patterns found.
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
 setShowExistingPicker(null); setExistingSearch(''); 
}}
                                            className="mt-2 w-full py-1.5 rounded-md border border-black/10 dark:border-white/10 text-muted-foreground text-sm hover:text-foreground transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>
                                )}

                                {criteriaForm.criteria_pattern_items.length > 0 ? (
                                    <div className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-black/5 dark:bg-white/5">
                                                    <th className="py-2 px-3 text-left text-muted-foreground font-normal">Title</th>
                                                    <th className="py-2 px-3 text-left text-muted-foreground font-normal w-16">Logic</th>
                                                    <th className="py-2 px-3 text-left text-muted-foreground font-normal">Regex</th>
                                                    <th className="py-2 px-3 text-left text-muted-foreground font-normal w-20">Score</th>
                                                    <th className="py-2 px-3 w-20"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {criteriaForm.criteria_pattern_items.map((item, idx) => (
                                                    <Fragment key={item.id}>
                                                        <tr className="border-t border-black/5 dark:border-white/5">
                                                            <td className="py-2 px-2">
                                                                <input
                                                                    type="text"
                                                                    required
                                                                    value={item.title}
                                                                    onChange={(e) => updateCriteriaItem(idx, 'title', e.target.value)}
                                                                    placeholder="Title"
                                                                    className="w-full px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors text-sm"
                                                                />
                                                            </td>
                                                            <td className="py-2 px-2">
                                                                <div className="flex rounded-md border border-black/10 dark:border-white/10 overflow-hidden">
                                                                    {(['and', 'or'] as const).map((op) => (
                                                                        <button
                                                                            key={op}
                                                                            type="button"
                                                                            onClick={() => updateCriteriaItem(idx, 'operator', op)}
                                                                            title={`Require ${op === 'and' ? 'all' : 'any'} sibling item to match`}
                                                                            className={`px-2 py-1 text-xs font-semibold uppercase transition-colors ${
                                                                                (item.operator || 'and') === op
                                                                                    ? 'bg-able-green text-white'
                                                                                    : 'text-muted-foreground hover:text-foreground'
                                                                            }`}
                                                                        >
                                                                            {op}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-2">
                                                                <input
                                                                    type="text"
                                                                    required
                                                                    value={item.regex}
                                                                    onChange={(e) => updateCriteriaItem(idx, 'regex', e.target.value)}
                                                                    placeholder="Regex"
                                                                    className="w-full px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors text-sm font-mono"
                                                                />
                                                            </td>
                                                            <td className="py-2 px-2">
                                                                <input
                                                                    type="number"
                                                                    required
                                                                    min={0}
                                                                    max={100}
                                                                    value={item.score}
                                                                    onChange={(e) => updateCriteriaItem(idx, 'score', parseInt(e.target.value) || 0)}
                                                                    className="w-full px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors text-sm"
                                                                />
                                                            </td>
                                                            <td className="py-2 px-2">
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addSubCriteriaItem(idx)}
                                                                        className="p-1 rounded-md text-muted-foreground hover:text-able-green hover:bg-[rgba(34,197,94,0.1)] transition-colors"
                                                                        title="Add Sub-Item"
                                                                    >
                                                                        <Plus size={14} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeCriteriaItem(idx)}
                                                                        className="p-1 rounded-md text-muted-foreground hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {/* Sub-items */}
                                                        {item.sub_items && item.sub_items.map((subItem, subIdx) => (
                                                            <tr key={subItem.id} className="border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                                                                <td className="py-2 px-2 pl-6">
                                                                    <input
                                                                        type="text"
                                                                        required
                                                                        value={subItem.title}
                                                                        onChange={(e) => updateSubCriteriaItem(idx, subIdx, 'title', e.target.value)}
                                                                        placeholder="Sub-item title"
                                                                        className="w-full px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors text-sm"
                                                                    />
                                                                </td>
                                                                <td className="py-2 px-2">
                                                                    <div className="flex rounded-md border border-black/10 dark:border-white/10 overflow-hidden">
                                                                        {(['and', 'or'] as const).map((op) => (
                                                                            <button
                                                                                key={op}
                                                                                type="button"
                                                                                onClick={() => updateSubCriteriaItem(idx, subIdx, 'operator', op)}
                                                                                title={`Require ${op === 'and' ? 'all' : 'any'} sibling sub-item to match`}
                                                                                className={`px-2 py-1 text-xs font-semibold uppercase transition-colors ${
                                                                                    (subItem.operator || 'and') === op
                                                                                        ? 'bg-able-green text-white'
                                                                                        : 'text-muted-foreground hover:text-foreground'
                                                                                }`}
                                                                            >
                                                                                {op}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                                <td className="py-2 px-2">
                                                                    <input
                                                                        type="text"
                                                                        required
                                                                        value={subItem.regex}
                                                                        onChange={(e) => updateSubCriteriaItem(idx, subIdx, 'regex', e.target.value)}
                                                                        placeholder="Sub-item regex"
                                                                        className="w-full px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors text-sm font-mono"
                                                                    />
                                                                </td>
                                                                <td className="py-2 px-2">
                                                                    <input
                                                                        type="number"
                                                                        required
                                                                        min={0}
                                                                        max={100}
                                                                        value={subItem.score}
                                                                        onChange={(e) => updateSubCriteriaItem(idx, subIdx, 'score', parseInt(e.target.value) || 0)}
                                                                        className="w-full px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors text-sm"
                                                                    />
                                                                </td>
                                                                <td className="py-2 px-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeSubCriteriaItem(idx, subIdx)}
                                                                        className="p-1 rounded-md text-muted-foreground hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-muted-foreground text-sm border border-dashed border-black/10 dark:border-white/10 rounded-lg">
                                        No pattern items added. Click "Add Item" or "Add Existing" to add patterns.
                                    </div>
                                )}
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
                            Delete Criteria Pattern
                        </h3>
                        <p className="text-muted-foreground mb-6">
                            Are you sure you want to delete this criteria pattern? This action cannot be undone.
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
                            Delete All Criteria Patterns
                        </h3>
                        <p className="text-muted-foreground mb-6">
                            Are you sure you want to delete <strong>all</strong> criteria patterns? This action cannot be undone.
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
        </>
    );
}

CriteriaPatternConfiguration.layout = {
    breadcrumbs: [
        { title: 'Risk Algorithm', href: '/risk-algorithm' },
        { title: 'Criteria Pattern Configuration', href: '/risk-algorithm/criteria' },
    ],
};
