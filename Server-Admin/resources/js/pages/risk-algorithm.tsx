import { Head, router, usePage } from '@inertiajs/react';
import { ChevronDown, Pencil, Search, Trash2, Plus, X, Trash, Copy } from 'lucide-react';
import { useState, FormEvent, useMemo } from 'react';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface CriteriaPatternItem {
    id: number;
    title: string;
    regex: string;
    score: number;
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
    [key: string]: unknown;
}

interface SingleFormData {
    title: string;
    regex: string;
    score: number;
}

interface CriteriaFormData {
    title: string;
    score: number;
    criteria_pattern_items: CriteriaPatternItem[];
}

const emptySingleForm: SingleFormData = {
    title: '',
    regex: '',
    score: 0,
};

const emptyCriteriaForm: CriteriaFormData = {
    title: '',
    score: 0,
    criteria_pattern_items: [],
};

const ROWS_PER_PAGE = 5;

type PatternType = 'single' | 'criteria';

export default function RiskAlgorithm() {
    const { riskPatterns } = usePage<PageProps>().props;

    const [showModal, setShowModal] = useState(false);
    const [modalStep, setModalStep] = useState<'type' | 'form'>('type');
    const [selectedType, setSelectedType] = useState<PatternType>('single');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [singleForm, setSingleForm] = useState<SingleFormData>(emptySingleForm);
    const [criteriaForm, setCriteriaForm] = useState<CriteriaFormData>(emptyCriteriaForm);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
    const [showExistingPicker, setShowExistingPicker] = useState<number | null>(null);
    const [existingSearch, setExistingSearch] = useState('');

    // Filter patterns
    const filteredPatterns = useMemo(() => {
        if (!searchQuery) return riskPatterns;
        return riskPatterns.filter((p) =>
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.regex && p.regex.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [riskPatterns, searchQuery]);

    // Separate single and criteria patterns
    const singlePatterns = useMemo(() =>
        filteredPatterns.filter((p) => p.type === 'single'),
        [filteredPatterns]
    );

    const criteriaPatterns = useMemo(() =>
        filteredPatterns.filter((p) => p.type === 'criteria'),
        [filteredPatterns]
    );

    // Pagination for single patterns
    const totalPages = Math.max(1, Math.ceil(singlePatterns.length / ROWS_PER_PAGE));
    const paginatedSinglePatterns = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return singlePatterns.slice(start, start + ROWS_PER_PAGE);
    }, [singlePatterns, currentPage]);

    // Available patterns for existing picker
    const availablePatterns = useMemo(() => {
        const search = existingSearch.toLowerCase();
        return riskPatterns.filter((p) =>
            p.title.toLowerCase().includes(search) ||
            (p.regex && p.regex.toLowerCase().includes(search))
        );
    }, [riskPatterns, existingSearch]);

    function openAddModal() {
        setEditingId(null);
        setSingleForm(emptySingleForm);
        setCriteriaForm(emptyCriteriaForm);
        setModalStep('type');
        setSelectedType('single');
        setShowModal(true);
    }

    function openEditModal(pattern: RiskPattern) {
        setEditingId(pattern.id);
        setSelectedType(pattern.type);

        if (pattern.type === 'single') {
            setSingleForm({
                title: pattern.title,
                regex: pattern.regex || '',
                score: pattern.score,
            });
        } else {
            setCriteriaForm({
                title: pattern.title,
                score: pattern.score,
                criteria_pattern_items: pattern.criteria_pattern_items || [],
            });
        }

        setModalStep('form');
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingId(null);
        setSingleForm(emptySingleForm);
        setCriteriaForm(emptyCriteriaForm);
        setModalStep('type');
        setShowExistingPicker(null);
        setExistingSearch('');
    }

    function handleTypeSelect(type: PatternType) {
        setSelectedType(type);
        setModalStep('form');
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();

        if (selectedType === 'single') {
            const data = {
                ...singleForm,
                type: 'single' as const,
            };

            if (editingId) {
                router.patch(`/risk-algorithm/${editingId}`, data as any);
            } else {
                router.post('/risk-algorithm', data as any);
            }
        } else {
            const data = {
                ...criteriaForm,
                type: 'criteria' as const,
            };

            if (editingId) {
                router.patch(`/risk-algorithm/${editingId}`, data as any);
            } else {
                router.post('/risk-algorithm', data as any);
            }
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
                { id: Date.now(), title: '', regex: '', score: 0, sub_items: [] },
            ],
        });
    }

    function addSubCriteriaItem(parentIndex: number) {
        const updatedItems = [...criteriaForm.criteria_pattern_items];
        const parentItem = { ...updatedItems[parentIndex] };
        if (!parentItem.sub_items) parentItem.sub_items = [];
        parentItem.sub_items = [...parentItem.sub_items, { id: Date.now(), title: '', regex: '', score: 0 }];
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
            sub_items: pattern.criteria_pattern_items || [],
        };

        setCriteriaForm({
            ...criteriaForm,
            criteria_pattern_items: [...criteriaForm.criteria_pattern_items, newItem],
        });

        setShowExistingPicker(null);
        setExistingSearch('');
    }

    function toggleGroup(groupId: number) {
        setExpandedGroups((prev) => ({
            ...prev,
            [groupId]: !prev[groupId],
        }));
    }

    function renderCriteriaItem(item: CriteriaPatternItem, index: number, isSubItem: boolean = false) {
        return (
            <div
                key={item.id}
                className={`${isSubItem ? 'ml-6' : ''}`}
            >
                <div
                    className="bg-[rgba(56,193,73,0.1)] grid grid-cols-[200px_1fr_80px_40px] items-center py-3 px-4 border-b border-[rgba(56,193,73,0.2)]"
                    style={{
                        borderLeft: '2px solid #38c149',
                        borderRight: '2px solid #38c149',
                    }}
                >
                    <span className="font-semibold truncate">{item.title}</span>
                    <span className="font-mono text-muted-foreground truncate px-2">{item.regex}</span>
                    <span className="text-center">{item.score}</span>
                    <span className="text-center">
                        {!isSubItem && item.sub_items && item.sub_items.length > 0 && (
                            <span className="text-xs text-muted-foreground">+{item.sub_items.length}</span>
                        )}
                    </span>
                </div>
                {item.sub_items && item.sub_items.map((subItem, subIdx) => (
                    <div key={subItem.id} className="ml-6">
                        {renderCriteriaItem(subItem, subIdx, true)}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <>
            <Head title="Risk Algorithm" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">

                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="text-[2.5rem] font-medium tracking-wide mb-3 text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        RISK ALGORITHM
                    </h1>
                    <p className="text-[0.95rem] text-muted-foreground leading-relaxed max-w-[800px] mb-6">
                        Risk Score Algorithm Management for Javascript Regex Configuration. Helps ABLE determine and flag certain key words for DOM file scanning.
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

                {/* Data Card */}
                <div className={`${glassCard} p-6`}>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-[1.5rem] font-medium" style={{ fontFamily: "'Unbounded', sans-serif" }}>Data Classification</h2>
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

                    <div className="overflow-x-auto">
                        <table className="w-full border-separate border-spacing-0 text-left">
                            <thead>
                                <tr>
                                    {['Pattern Name', 'Regex Pattern', 'Score', 'Status', 'Action'].map((h) => (
                                        <th key={h} className="text-muted-foreground font-normal text-[0.9rem] py-3 px-4 border-b border-[rgba(34,197,94,0.7)]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Criteria Patterns */}
                                {criteriaPatterns.map((pattern) => (
                                    <tr key={pattern.id}>
                                        <td colSpan={5} className="pt-3.5 pb-1.5 px-0">
                                            <div
                                                className="bg-[#38c149] flex justify-between items-center py-3 px-4 rounded-t-lg cursor-pointer"
                                                onClick={() => toggleGroup(pattern.id)}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-semibold">{pattern.title}</span>
                                                    <span className="text-[12px] opacity-90">+{pattern.criteria_pattern_items.length} Items</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openEditModal(pattern);
                                                        }}
                                                        className="bg-transparent border-none cursor-pointer p-0 hover:opacity-80"
                                                    >
                                                        <Pencil size={16} className="text-white" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteConfirmId(pattern.id);
                                                        }}
                                                        className="bg-transparent border-none cursor-pointer p-0 hover:opacity-80"
                                                    >
                                                        <Trash2 size={16} className="text-white opacity-70" />
                                                    </button>
                                                    <ChevronDown size={16} className={`transition-transform ${expandedGroups[pattern.id] ? 'rotate-0' : '-rotate-90'}`} />
                                                </div>
                                            </div>
                                            {expandedGroups[pattern.id] && (
                                                <>
                                                    {pattern.criteria_pattern_items.map((item, idx) => renderCriteriaItem(item, idx))}
                                                    <div
                                                        className="border-b-2 border-b-[#38c149] border-l-2 border-l-[#38c149] border-r-2 border-r-[#38c149] rounded-b-lg bg-transparent h-0"
                                                    />
                                                </>
                                            )}
                                            {!expandedGroups[pattern.id] && (
                                                <div
                                                    className="border-b-2 border-b-[#38c149] border-l-2 border-l-[#38c149] border-r-2 border-r-[#38c149] rounded-b-lg bg-transparent h-0"
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ))}

                                {/* Single Patterns */}
                                {paginatedSinglePatterns.map((pattern) => (
                                    <tr key={pattern.id}>
                                        <td className="py-5 px-4 font-semibold border-b border-black/10 dark:border-[#2e434d]">{pattern.title}</td>
                                        <td className="py-5 px-4 font-mono text-muted-foreground border-b border-black/10 dark:border-[#2e434d]">{pattern.regex}</td>
                                        <td className="py-5 px-4 border-b border-black/10 dark:border-[#2e434d]">{pattern.score}</td>
                                        <td className="py-5 px-4 border-b border-black/10 dark:border-[#2e434d]">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                pattern.status === 'active'
                                                    ? 'bg-[rgba(34,197,94,0.2)] text-[#22c55e]'
                                                    : 'bg-[rgba(248,113,113,0.2)] text-[#f87171]'
                                            }`}>
                                                {pattern.status === 'active' ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="py-5 px-4 border-b border-black/10 dark:border-[#2e434d]">
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => openEditModal(pattern)}
                                                    className="bg-transparent border-none cursor-pointer p-0 hover:opacity-80"
                                                >
                                                    <Pencil size={18} className="text-[#36cfc9]" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmId(pattern.id)}
                                                    className="bg-transparent border-none cursor-pointer p-0 hover:opacity-80"
                                                >
                                                    <Trash2 size={18} className="text-muted-foreground" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {/* Empty State */}
                                {riskPatterns.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center text-muted-foreground">
                                            {searchQuery ? 'No patterns match your search.' : 'No risk patterns yet. Click "Add Pattern" to create one.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {singlePatterns.length > ROWS_PER_PAGE && (
                        <div className="flex justify-end mt-6 items-center gap-3 text-[0.9rem] text-muted-foreground">
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
                                {editingId ? 'Edit Pattern' : 'Add Pattern'}
                            </h3>
                            <button onClick={closeModal} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Step 1: Type Selection */}
                        {modalStep === 'type' && (
                            <div className="px-6 py-5 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Select Pattern Type</label>
                                    <select
                                        value={selectedType}
                                        onChange={(e) => setSelectedType(e.target.value as PatternType)}
                                        className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors"
                                    >
                                        <option value="single">Single Pattern</option>
                                        <option value="criteria">Criteria Pattern</option>
                                    </select>
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
                                        type="button"
                                        onClick={() => handleTypeSelect(selectedType)}
                                        className="px-4 py-2 rounded-lg bg-able-green text-white font-semibold hover:bg-[#1a9e4b] transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Form */}
                        {modalStep === 'form' && (
                            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                                {/* Single Pattern Form */}
                                {selectedType === 'single' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-muted-foreground mb-1">Pattern Title</label>
                                            <input
                                                type="text"
                                                required
                                                value={singleForm.title}
                                                onChange={(e) => setSingleForm({ ...singleForm, title: e.target.value })}
                                                placeholder="e.g., Student ID Format"
                                                className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-muted-foreground mb-1">Regex Pattern</label>
                                            <input
                                                type="text"
                                                required
                                                value={singleForm.regex}
                                                onChange={(e) => setSingleForm({ ...singleForm, regex: e.target.value })}
                                                placeholder="e.g., ^\d{2}-\d{4}-\d{3}$"
                                                className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-muted-foreground mb-1">Risk Score (0-100)</label>
                                            <input
                                                type="number"
                                                required
                                                min={0}
                                                max={100}
                                                value={singleForm.score}
                                                onChange={(e) => setSingleForm({ ...singleForm, score: parseInt(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent text-foreground outline-none focus:border-able-green transition-colors"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Criteria Pattern Form */}
                                {selectedType === 'criteria' && (
                                    <>
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
                                                                    {pattern.type === 'criteria' ? 'Criteria' : 'Single'} • {pattern.score}
                                                                </span>
                                                            </button>
                                                        ))}
                                                        {availablePatterns.length === 0 && (
                                                            <div className="text-center py-3 text-muted-foreground text-sm">
                                                                No patterns found.
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setShowExistingPicker(null); setExistingSearch(''); }}
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
                                                                <th className="py-2 px-3 text-left text-muted-foreground font-normal">Regex</th>
                                                                <th className="py-2 px-3 text-left text-muted-foreground font-normal w-20">Score</th>
                                                                <th className="py-2 px-3 w-20"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {criteriaForm.criteria_pattern_items.map((item, idx) => (
                                                                <>
                                                                    <tr key={item.id} className="border-t border-black/5 dark:border-white/5">
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
                                                                </>
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
                                    </>
                                )}

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setModalStep('type')}
                                        className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 rounded-lg bg-able-green text-white font-semibold hover:bg-[#1a9e4b] transition-colors"
                                    >
                                        {editingId ? 'Update' : 'Create'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Single Confirmation Modal */}
            {deleteConfirmId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#0f172a] rounded-xl shadow-2xl w-full max-w-sm mx-4 border border-[rgba(248,113,113,0.3)] p-6">
                        <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Unbounded', sans-serif" }}>
                            Delete Risk Pattern
                        </h3>
                        <p className="text-muted-foreground mb-6">
                            Are you sure you want to delete this risk pattern? This action cannot be undone.
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
                            Delete All Risk Patterns
                        </h3>
                        <p className="text-muted-foreground mb-6">
                            Are you sure you want to delete <strong>all</strong> risk patterns? This action cannot be undone.
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

RiskAlgorithm.layout = {
    breadcrumbs: [{ title: 'Risk Algorithm', href: '/risk-algorithm' }],
};
