import { Head, router, usePage } from '@inertiajs/react';
import { Pencil, Search, Trash2, Plus, X, Trash } from 'lucide-react';
import type { FormEvent} from 'react';
import { useState, useMemo } from 'react';
import AlertError from '@/components/alert-error';

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
    criteriaPatterns: RiskPattern[];
    [key: string]: unknown;
}

interface SingleFormData {
    title: string;
    regex: string;
    score: number;
    status: 'active' | 'inactive';
}

const emptySingleForm: SingleFormData = {
    title: '',
    regex: '',
    score: 0,
    status: 'active',
};

const ROWS_PER_PAGE = 5;

export default function SinglePatternConfiguration() {
    const { riskPatterns } = usePage<PageProps>().props;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [singleForm, setSingleForm] = useState<SingleFormData>(emptySingleForm);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

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

    // Pagination for single patterns
    const totalPages = Math.max(1, Math.ceil(filteredPatterns.length / ROWS_PER_PAGE));
    const paginatedPatterns = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;

        return filteredPatterns.slice(start, start + ROWS_PER_PAGE);
    }, [filteredPatterns, currentPage]);

    function openAddModal() {
        setEditingId(null);
        setSingleForm(emptySingleForm);
        setFormErrors({});
        setShowModal(true);
    }

    function openEditModal(pattern: RiskPattern) {
        setEditingId(pattern.id);
        setSingleForm({
            title: pattern.title,
            regex: pattern.regex || '',
            score: pattern.score,
            status: pattern.status,
        });
        setFormErrors({});
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingId(null);
        setSingleForm(emptySingleForm);
        setFormErrors({});
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();

        const data = {
            ...singleForm,
            type: 'single' as const,
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

    return (
        <>
            <Head title="Single Pattern Configuration" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">

                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="text-[2.6rem] font-bold tracking-wide mb-3 text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        SINGLE PATTERN CONFIGURATION
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
                        <h2 className="text-[1.6rem] font-bold" style={{ fontFamily: "'Unbounded', sans-serif" }}>Data Classification</h2>
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
                                {paginatedPatterns.map((pattern) => (
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
                    {filteredPatterns.length > ROWS_PER_PAGE && (
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
                            <h3 className="text-lg font-bold" style={{ fontFamily: "'Unbounded', sans-serif" }}>
                                {editingId ? 'Edit Pattern' : 'Add Pattern'}
                            </h3>
                            <button onClick={closeModal} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                            {Object.keys(formErrors).length > 0 && (
                                <AlertError errors={Object.values(formErrors)} title="Unable to save pattern" />
                            )}
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

                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSingleForm({ ...singleForm, status: 'active' })}
                                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                                            singleForm.status === 'active'
                                                ? 'border-able-green bg-able-green text-white'
                                                : 'border-black/10 dark:border-white/10 text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Active
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSingleForm({ ...singleForm, status: 'inactive' })}
                                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                                            singleForm.status === 'inactive'
                                                ? 'border-[#f87171] bg-[#f87171] text-white'
                                                : 'border-black/10 dark:border-white/10 text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Inactive
                                    </button>
                                </div>
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

SinglePatternConfiguration.layout = {
    breadcrumbs: [
        { title: 'Risk Algorithm', href: '/risk-algorithm/single' },
        { title: 'Single Pattern Configuration', href: '/risk-algorithm/single' },
    ],
};
