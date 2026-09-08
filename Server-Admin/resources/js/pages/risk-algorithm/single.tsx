import { Head, router, usePage } from '@inertiajs/react';
import { Search, Trash2, Plus, X, Trash } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState, useMemo } from 'react';
import AlertError from '@/components/alert-error';
import { TablePagination } from '@/components/pagination';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

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
    priority: 'low' | 'medium' | 'high';
    score: number;
    criteria_pattern_items: CriteriaPatternItem[];
    created_at: string;
    updated_at: string;
}

interface PageProps {
    riskPatterns: RiskPattern[];
    criteriaPatterns: RiskPattern[];
    flagCounts: Record<string, number>;
    [key: string]: unknown;
}

interface SingleFormData {
    title: string;
    regex: string;
    score: number;
    priority: 'low' | 'medium' | 'high';
}

const emptySingleForm: SingleFormData = {
    title: '',
    regex: '',
    score: 0,
    priority: 'medium',
};

const ROWS_PER_PAGE = 5;

// Word-capped display text so long values don't inflate table cells; the
// full text stays available via the cell's title tooltip.
function truncateWords(text: string | null, maxWords: number): string {
    if (!text) {
        return '';
    }

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) {
        return text;
    }

    return `${words.slice(0, maxWords).join(' ')}…`;
}

export default function SinglePatternConfiguration() {
    const { riskPatterns, flagCounts } = usePage<PageProps>().props;

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [singleForm, setSingleForm] =
        useState<SingleFormData>(emptySingleForm);
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

        return riskPatterns.filter(
            (p) =>
                p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.regex &&
                    p.regex.toLowerCase().includes(searchQuery.toLowerCase())),
        );
    }, [riskPatterns, searchQuery]);

    // Pagination for single patterns
    const totalPages = Math.max(
        1,
        Math.ceil(filteredPatterns.length / ROWS_PER_PAGE),
    );
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
            priority: pattern.priority,
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
        setShowModal(false);
        setEditingId(null);
    }

    function handleDeleteAll() {
        router.delete('/risk-algorithm-all');
        setDeleteAllConfirm(false);
    }

    return (
        <>
            <Head title="All Patterns" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="mb-3 text-[2.6rem] font-bold tracking-wide text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        SINGLE PATTERN CONFIGURATION
                    </h1>
                    <p className="mb-6 max-w-[800px] text-[0.95rem] leading-relaxed text-muted-foreground">
                        Risk Score Algorithm Management for Javascript Regex
                        Configuration. Helps ABLE determine and flag certain key
                        words for DOM file scanning.
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

                {/* Data Card */}
                <div className={`${glassCard} p-6`}>
                    <div className="mb-6 flex items-center justify-between">
                        <h2
                            className="text-[1.6rem] font-bold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Data Classification
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
                            <button
                                onClick={openAddModal}
                                className="flex items-center gap-2 rounded-lg border-none bg-able-green px-5 py-2 text-[0.9rem] font-semibold text-white transition-colors hover:bg-[#1a9e4b] active:scale-[0.98]"
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
                                    {[
                                        'Pattern Name',
                                        'Regex Pattern',
                                        'Score',
                                        'Priority',
                                        'Flagged',
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            className="border-b border-[rgba(34,197,94,0.7)] px-4 py-3 text-[0.9rem] font-normal text-muted-foreground"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedPatterns.map((pattern) => (
                                    <tr
                                        key={pattern.id}
                                        onClick={() => openEditModal(pattern)}
                                        className="cursor-pointer transition-colors hover:bg-[rgba(34,197,94,0.04)] dark:hover:bg-[rgba(34,197,94,0.08)]"
                                    >
                                        <td
                                            className="max-w-[220px] truncate border-b border-black/10 px-4 py-5 font-semibold dark:border-[#2e434d]"
                                            title={pattern.title}
                                        >
                                            {truncateWords(pattern.title, 15)}
                                        </td>
                                        <td
                                            className="max-w-[280px] truncate border-b border-black/10 px-4 py-5 font-mono text-muted-foreground dark:border-[#2e434d]"
                                            title={pattern.regex ?? ''}
                                        >
                                            {truncateWords(pattern.regex, 30)}
                                        </td>
                                        <td className="border-b border-black/10 px-4 py-5 dark:border-[#2e434d]">
                                            {pattern.score}
                                        </td>
                                        <td className="border-b border-black/10 px-4 py-5 dark:border-[#2e434d]">
                                            <span
                                                className={`rounded-full px-2 py-1 text-xs font-semibold ${
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
                                        </td>
                                        <td className="border-b border-black/10 px-4 py-5 text-sm text-muted-foreground dark:border-[#2e434d]">
                                            {flagCounts[pattern.title] ?? 0}
                                        </td>
                                    </tr>
                                ))}

                                {/* Empty State */}
                                {riskPatterns.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="py-10 text-center text-muted-foreground"
                                        >
                                            {searchQuery
                                                ? 'No patterns match your search.'
                                                : 'No risk patterns yet. Click "Add Pattern" to create one.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filteredPatterns.length > ROWS_PER_PAGE && (
                        <TablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="mx-4 w-full max-w-lg rounded-xl border border-[rgba(34,197,94,0.3)] bg-white shadow-2xl dark:bg-[#0f172a]">
                        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
                            <h3
                                className="text-lg font-bold"
                                style={{
                                    fontFamily: "'Unbounded', sans-serif",
                                }}
                            >
                                {editingId ? 'Edit Pattern' : 'Add Pattern'}
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
                                    title="Unable to save pattern"
                                />
                            )}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                    Pattern Title
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={singleForm.title}
                                    onChange={(e) =>
                                        setSingleForm({
                                            ...singleForm,
                                            title: e.target.value,
                                        })
                                    }
                                    placeholder="e.g., Student ID Format"
                                    className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                    Regex Pattern
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={singleForm.regex}
                                    onChange={(e) =>
                                        setSingleForm({
                                            ...singleForm,
                                            regex: e.target.value,
                                        })
                                    }
                                    placeholder="e.g., ^\d{2}-\d{4}-\d{3}$"
                                    className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 font-mono text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
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
                                    value={singleForm.score}
                                    onChange={(e) =>
                                        setSingleForm({
                                            ...singleForm,
                                            score:
                                                parseInt(e.target.value) || 0,
                                        })
                                    }
                                    className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                    Priority
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSingleForm({
                                                ...singleForm,
                                                priority: 'low',
                                            })
                                        }
                                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                                            singleForm.priority === 'low'
                                                ? 'border-able-green bg-able-green text-white'
                                                : 'border-black/10 text-muted-foreground hover:text-foreground dark:border-white/10'
                                        }`}
                                    >
                                        Low
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSingleForm({
                                                ...singleForm,
                                                priority: 'medium',
                                            })
                                        }
                                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                                            singleForm.priority === 'medium'
                                                ? 'border-[#f59e0b] bg-[#f59e0b] text-white'
                                                : 'border-black/10 text-muted-foreground hover:text-foreground dark:border-white/10'
                                        }`}
                                    >
                                        Medium
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSingleForm({
                                                ...singleForm,
                                                priority: 'high',
                                            })
                                        }
                                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                                            singleForm.priority === 'high'
                                                ? 'border-[#f87171] bg-[#f87171] text-white'
                                                : 'border-black/10 text-muted-foreground hover:text-foreground dark:border-white/10'
                                        }`}
                                    >
                                        High
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                {editingId !== null && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setDeleteConfirmId(editingId)
                                        }
                                        className="flex items-center gap-2 rounded-lg border border-[rgba(248,113,113,0.4)] px-4 py-2 text-muted-foreground transition-colors hover:bg-[rgba(248,113,113,0.1)] hover:text-[#f87171]"
                                    >
                                        <Trash2 size={16} />
                                        Delete
                                    </button>
                                )}
                                <div className="flex-1" />
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
                            Delete Risk Pattern
                        </h3>
                        <p className="mb-6 text-muted-foreground">
                            Are you sure you want to delete this risk pattern?
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
                            Delete All Risk Patterns
                        </h3>
                        <p className="mb-6 text-muted-foreground">
                            Are you sure you want to delete <strong>all</strong>{' '}
                            risk patterns? This action cannot be undone.
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

SinglePatternConfiguration.layout = {
    breadcrumbs: [
        { title: 'Risk Algorithm', href: '/risk-algorithm/single' },
        {
            title: 'All Patterns',
            href: '/risk-algorithm/single',
        },
    ],
};
