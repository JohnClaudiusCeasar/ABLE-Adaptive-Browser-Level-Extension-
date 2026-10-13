import { Head, router } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock,
    Edit2,
    Globe,
    Layers,
    MessageSquare,
    Plus,
    Search,
    Trash2,
    XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { subscribeToNotifications } from '@/lib/echo';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface CommunityMessageItem {
    id: number;
    author: string;
    category: 'suggestion' | 'comment' | 'complaint' | 'false-positive';
    domain: string | null;
    message: string;
    ip_address: string | null;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

interface PageProps {
    messages: {
        data: CommunityMessageItem[];
        current_page: number;
        last_page: number;
        total: number;
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    counts: {
        all: number;
        pending: number;
        approved: number;
        rejected: number;
    };
    currentFilter: 'all' | 'pending' | 'approved' | 'rejected';
}

const statusFilters = ['all', 'pending', 'approved', 'rejected'] as const;

const statusLabels: Record<(typeof statusFilters)[number], string> = {
    all: 'All Feedback',
    pending: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
};

const statusIcons: Record<(typeof statusFilters)[number], React.ElementType> = {
    all: Layers,
    pending: Clock,
    approved: CheckCircle2,
    rejected: XCircle,
};

const statusColors: Record<(typeof statusFilters)[number], string> = {
    all: 'text-able-green',
    pending: 'text-amber-400',
    approved: 'text-emerald-400',
    rejected: 'text-red-400',
};

const statusBadgeClasses: Record<(typeof statusFilters)[number], string> = {
    all: 'bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.4)] text-able-green dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-300',
    pending:
        'bg-amber-500/10 border border-amber-500/30 text-amber-300 dark:bg-amber-950/40 dark:border-amber-800/40 dark:text-amber-300',
    approved:
        'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-300',
    rejected:
        'bg-red-500/10 border border-red-500/30 text-red-300 dark:bg-red-950/40 dark:border-red-800/40 dark:text-red-300',
};

const statusBorderColors: Record<CommunityMessageItem['status'], string> = {
    pending: 'border-l-amber-500/80',
    approved: 'border-l-emerald-500/80',
    rejected: 'border-l-red-500/80',
};

const categoryLabels: Record<string, string> = {
    suggestion: 'Suggestion',
    comment: 'Comment',
    complaint: 'Complaint',
    'false-positive': 'False Positive',
};

const categoryBadgeVariants: Record<string, string> = {
    suggestion: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
    comment: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400',
    complaint: 'border-red-500/50 bg-red-500/10 text-red-400',
    'false-positive': 'border-amber-500/50 bg-amber-500/10 text-amber-400',
};

export default function CommunityMessagesPage({
    messages,
    counts,
    currentFilter,
}: PageProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    // Create Feedback state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        author: '',
        category: 'suggestion' as CommunityMessageItem['category'],
        domain: '',
        message: '',
    });
    const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

    // Edit Feedback state
    const [editTarget, setEditTarget] = useState<CommunityMessageItem | null>(null);
    const [editForm, setEditForm] = useState({
        author: '',
        category: 'suggestion' as CommunityMessageItem['category'],
        domain: '',
        message: '',
        status: 'pending' as CommunityMessageItem['status'],
    });
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

    // Auto-update feedback list when changes occur
    useEffect(() => {
        const unsubscribe = subscribeToNotifications(() => {
            router.reload({
                only: ['messages', 'counts'],
            });
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        if (editTarget) {
            setEditForm({
                author: editTarget.author,
                category: editTarget.category,
                domain: editTarget.domain ?? '',
                message: editTarget.message,
                status: editTarget.status,
            });
        }
    }, [editTarget]);

    const filteredMessages = useMemo(() => {
        if (!searchQuery.trim()) {
            return messages.data;
        }

        const q = searchQuery.toLowerCase();

        return messages.data.filter(
            (m) =>
                m.author.toLowerCase().includes(q) ||
                m.message.toLowerCase().includes(q) ||
                (m.domain ?? '').toLowerCase().includes(q) ||
                m.category.toLowerCase().includes(q),
        );
    }, [messages.data, searchQuery]);

    const handleFilterChange = (filter: string) => {
        router.get(
            '/community-messages',
            { status: filter },
            { preserveState: true },
        );
    };

    const handleApprove = (id: number) => {
        router.patch(
            `/community-messages/${id}/approve`,
            {},
            { preserveScroll: true },
        );
    };

    const handleReject = (id: number) => {
        router.patch(
            `/community-messages/${id}/reject`,
            {},
            { preserveScroll: true },
        );
    };

    const handleDeleteConfirm = () => {
        if (!deleteTargetId) {
            return;
        }

        router.delete(`/community-messages/${deleteTargetId}`, {
            preserveScroll: true,
            onFinish: () => setDeleteTargetId(null),
        });
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!createForm.message.trim()) return;

        setIsSubmittingCreate(true);
        router.post('/community-messages', createForm, {
            preserveScroll: true,
            onSuccess: () => {
                setIsCreateOpen(false);
                setCreateForm({
                    author: '',
                    category: 'suggestion',
                    domain: '',
                    message: '',
                });
            },
            onFinish: () => setIsSubmittingCreate(false),
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget || !editForm.message.trim()) return;

        setIsSubmittingEdit(true);
        router.patch(`/community-messages/${editTarget.id}`, editForm, {
            preserveScroll: true,
            onSuccess: () => {
                setEditTarget(null);
            },
            onFinish: () => setIsSubmittingEdit(false),
        });
    };


    return (
        <>
            <Head title="Community Feedback" />

            {/* Consistent Page Container Margins Aligned to Dashboard & Analytics */}
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                {/* Page Header */}
                <header className="mb-8">
                    {/* Unbounded Font Style and Size for Content Title */}
                    <h1
                        className="mb-2.5 text-[2.8rem] font-bold tracking-wide text-foreground uppercase"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        COMMUNITY FEEDBACK
                    </h1>
                    {/* Archivo Font Style for Content Subtext */}
                    <p
                        className="mb-6 text-[1.05rem] text-muted-foreground"
                        style={{ fontFamily: "'Archivo', sans-serif" }}
                    >
                        Review visitor submissions from the landing page.
                        Approve verified posts to make them publicly visible in
                        the live feed.
                    </p>

                    {/* Colored Icon + Text Sorting Pills (Identical to Notifications Page) */}
                    <div className="mb-4 flex flex-wrap items-center gap-2.5">
                        {statusFilters.map((status) => {
                            const Icon = statusIcons[status];
                            const isActive = currentFilter === status;
                            const count = counts[status] ?? 0;

                            return (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => handleFilterChange(status)}
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-medium transition-all duration-150 ${
                                        isActive
                                            ? `${statusBadgeClasses[status]} scale-105 ring-1 ring-[rgba(34,197,94,0.3)]`
                                            : 'bg-white/3 text-muted-foreground opacity-50 hover:bg-white/5 hover:text-foreground hover:opacity-75'
                                    }`}
                                >
                                    <Icon
                                        size={14}
                                        className={
                                            isActive ? statusColors[status] : ''
                                        }
                                    />
                                    <span>{statusLabels[status]}</span>
                                    {count > 0 && (
                                        <span
                                            className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[0.65rem] leading-none font-semibold ${
                                                isActive
                                                    ? 'bg-white/15'
                                                    : 'bg-white/8'
                                            }`}
                                        >
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Standardized Search Bar Layout & Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-[260px]">
                                <Search
                                    size={16}
                                    className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                                />
                                <input
                                    type="text"
                                    placeholder="Search feedback..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded-full border border-black/10 bg-black/5 py-2.5 pr-3.5 pl-11 text-[0.9rem] text-foreground outline-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                                    style={{ fontFamily: "'Archivo', sans-serif" }}
                                />
                            </div>

                            <Button
                                size="sm"
                                onClick={() => setIsCreateOpen(true)}
                                className="cursor-pointer gap-1.5 rounded-full bg-able-green px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400"
                                style={{ fontFamily: "'Archivo', sans-serif" }}
                            >
                                <Plus size={14} />
                                <span>Add Feedback</span>
                            </Button>
                        </div>

                        {counts.pending > 0 && (
                            <span
                                className="text-sm font-medium text-amber-400/90"
                                style={{ fontFamily: "'Archivo', sans-serif" }}
                            >
                                {counts.pending} pending review
                            </span>
                        )}
                    </div>
                </header>

                {/* Feedback Messages List */}
                {filteredMessages.length === 0 ? (
                    <div
                        className="py-12 text-center text-muted-foreground"
                        style={{ fontFamily: "'Archivo', sans-serif" }}
                    >
                        <MessageSquare
                            className="mx-auto mb-3 opacity-40"
                            size={36}
                        />
                        <p className="text-base font-medium">
                            No feedback messages found
                        </p>
                        <p className="text-sm opacity-70">
                            {searchQuery
                                ? 'No results match your search query.'
                                : 'Visitor messages will appear here once submitted.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredMessages.map((item) => (
                            <div
                                key={item.id}
                                className={`relative flex flex-col justify-between gap-4 border-l-4 ${statusBorderColors[item.status]} ${glassCard} px-6 py-5 transition-colors hover:bg-white/5 md:flex-row md:items-start`}
                            >
                                {/* Message Content & Meta */}
                                <div className="flex-1 space-y-2.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {/* Author Name in Unbounded Font */}
                                        <span
                                            className="text-[0.92rem] font-bold tracking-wide text-foreground"
                                            style={{
                                                fontFamily:
                                                    "'Unbounded', sans-serif",
                                            }}
                                        >
                                            {item.author}
                                        </span>

                                        <Badge
                                            variant="outline"
                                            className={
                                                categoryBadgeVariants[
                                                    item.category
                                                ] || ''
                                            }
                                            style={{
                                                fontFamily:
                                                    "'Archivo', sans-serif",
                                            }}
                                        >
                                            {categoryLabels[item.category] ||
                                                item.category}
                                        </Badge>

                                        {item.status === 'pending' && (
                                            <Badge
                                                className="border-amber-500/50 bg-amber-500/15 text-amber-300"
                                                style={{
                                                    fontFamily:
                                                        "'Archivo', sans-serif",
                                                }}
                                            >
                                                <Clock
                                                    className="mr-1 inline-block"
                                                    size={12}
                                                />
                                                Pending Review
                                            </Badge>
                                        )}
                                        {item.status === 'approved' && (
                                            <Badge
                                                className="border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                                                style={{
                                                    fontFamily:
                                                        "'Archivo', sans-serif",
                                                }}
                                            >
                                                <CheckCircle2
                                                    className="mr-1 inline-block"
                                                    size={12}
                                                />
                                                Live on Board
                                            </Badge>
                                        )}
                                        {item.status === 'rejected' && (
                                            <Badge
                                                className="border-red-500/50 bg-red-500/15 text-red-300"
                                                style={{
                                                    fontFamily:
                                                        "'Archivo', sans-serif",
                                                }}
                                            >
                                                <XCircle
                                                    className="mr-1 inline-block"
                                                    size={12}
                                                />
                                                Rejected
                                            </Badge>
                                        )}

                                        <span
                                            className="text-xs text-muted-foreground"
                                            style={{
                                                fontFamily:
                                                    "'Archivo', sans-serif",
                                            }}
                                        >
                                            {new Date(
                                                item.created_at,
                                            ).toLocaleString()}
                                        </span>
                                    </div>

                                    {item.domain && (
                                        <div className="flex items-center gap-1.5 font-mono text-xs text-cyan-400">
                                            <Globe size={13} />
                                            <span>{item.domain}</span>
                                        </div>
                                    )}

                                    {/* Content Body in Archivo Font */}
                                    <p
                                        className="text-[0.95rem] leading-relaxed text-zinc-200 dark:text-zinc-300"
                                        style={{
                                            fontFamily: "'Archivo', sans-serif",
                                        }}
                                    >
                                        {item.message}
                                    </p>

                                    {item.ip_address && (
                                        <div
                                            className="text-[11px] text-muted-foreground opacity-60"
                                            style={{
                                                fontFamily:
                                                    "'Archivo', sans-serif",
                                            }}
                                        >
                                            Origin IP: {item.ip_address}
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex shrink-0 items-center gap-2 self-end pt-1 md:self-center">
                                    {item.status !== 'approved' && (
                                        <Button
                                            size="sm"
                                            onClick={() =>
                                                handleApprove(item.id)
                                            }
                                            className="cursor-pointer gap-1.5 rounded-full bg-emerald-600 px-3.5 text-xs text-white hover:bg-emerald-500"
                                            style={{
                                                fontFamily:
                                                    "'Archivo', sans-serif",
                                            }}
                                        >
                                            <CheckCircle2 size={13} />
                                            <span>Approve</span>
                                        </Button>
                                    )}

                                    {item.status !== 'rejected' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                handleReject(item.id)
                                            }
                                            className="cursor-pointer gap-1.5 rounded-full border-amber-500/40 text-xs text-amber-300 hover:bg-amber-500/10"
                                            style={{
                                                fontFamily:
                                                    "'Archivo', sans-serif",
                                            }}
                                        >
                                            <XCircle size={13} />
                                            <span>Reject</span>
                                        </Button>
                                    )}

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditTarget(item)}
                                        className="cursor-pointer gap-1.5 rounded-full border-cyan-500/30 text-xs text-cyan-400 hover:bg-cyan-500/10"
                                        style={{
                                            fontFamily:
                                                "'Archivo', sans-serif",
                                        }}
                                    >
                                        <Edit2 size={13} />
                                        <span>Edit</span>
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            setDeleteTargetId(item.id)
                                        }
                                        className="cursor-pointer gap-1.5 rounded-full border-red-500/30 text-xs text-red-400 hover:bg-red-500/10"
                                        style={{
                                            fontFamily: "'Archivo', sans-serif",
                                        }}
                                    >
                                        <Trash2 size={13} />
                                        <span>Delete</span>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Feedback Modal */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle style={{ fontFamily: "'Unbounded', sans-serif" }}>
                            Create Feedback
                        </DialogTitle>
                        <DialogDescription style={{ fontFamily: "'Archivo', sans-serif" }}>
                            Add a new community feedback submission directly to the moderation feed.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Author Name
                            </label>
                            <input
                                type="text"
                                placeholder="Anonymous"
                                value={createForm.author}
                                onChange={(e) =>
                                    setCreateForm((prev) => ({ ...prev, author: e.target.value }))
                                }
                                className="w-full rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-foreground outline-none focus:border-able-green dark:border-white/10 dark:bg-black/30"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Category
                            </label>
                            <select
                                value={createForm.category}
                                onChange={(e) =>
                                    setCreateForm((prev) => ({
                                        ...prev,
                                        category: e.target.value as CommunityMessageItem['category'],
                                    }))
                                }
                                className="w-full rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-foreground outline-none focus:border-able-green dark:border-white/10 dark:bg-black/30"
                            >
                                <option value="suggestion">Suggestion</option>
                                <option value="comment">Comment</option>
                                <option value="complaint">Complaint</option>
                                <option value="false-positive">False Positive</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Domain (optional)
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. example.com"
                                value={createForm.domain}
                                onChange={(e) =>
                                    setCreateForm((prev) => ({ ...prev, domain: e.target.value }))
                                }
                                className="w-full rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-foreground outline-none focus:border-able-green dark:border-white/10 dark:bg-black/30"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Message Body *
                            </label>
                            <textarea
                                required
                                rows={4}
                                placeholder="Write feedback details..."
                                value={createForm.message}
                                onChange={(e) =>
                                    setCreateForm((prev) => ({ ...prev, message: e.target.value }))
                                }
                                className="w-full rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-foreground outline-none focus:border-able-green dark:border-white/10 dark:bg-black/30"
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsCreateOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmittingCreate || !createForm.message.trim()}
                                className="bg-able-green text-black hover:bg-emerald-400"
                            >
                                {isSubmittingCreate ? 'Saving...' : 'Submit Feedback'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Feedback Modal */}
            <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle style={{ fontFamily: "'Unbounded', sans-serif" }}>
                            Edit Feedback
                        </DialogTitle>
                        <DialogDescription style={{ fontFamily: "'Archivo', sans-serif" }}>
                            Update feedback details and moderation status.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleEditSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Author Name
                            </label>
                            <input
                                type="text"
                                value={editForm.author}
                                onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, author: e.target.value }))
                                }
                                className="w-full rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-foreground outline-none focus:border-able-green dark:border-white/10 dark:bg-black/30"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                    Category
                                </label>
                                <select
                                    value={editForm.category}
                                    onChange={(e) =>
                                        setEditForm((prev) => ({
                                            ...prev,
                                            category: e.target.value as CommunityMessageItem['category'],
                                        }))
                                    }
                                    className="w-full rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-foreground outline-none focus:border-able-green dark:border-white/10 dark:bg-black/30"
                                >
                                    <option value="suggestion">Suggestion</option>
                                    <option value="comment">Comment</option>
                                    <option value="complaint">Complaint</option>
                                    <option value="false-positive">False Positive</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                    Status
                                </label>
                                <select
                                    value={editForm.status}
                                    onChange={(e) =>
                                        setEditForm((prev) => ({
                                            ...prev,
                                            status: e.target.value as CommunityMessageItem['status'],
                                        }))
                                    }
                                    className="w-full rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-foreground outline-none focus:border-able-green dark:border-white/10 dark:bg-black/30"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Domain (optional)
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. example.com"
                                value={editForm.domain}
                                onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, domain: e.target.value }))
                                }
                                className="w-full rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-foreground outline-none focus:border-able-green dark:border-white/10 dark:bg-black/30"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Message Body *
                            </label>
                            <textarea
                                required
                                rows={4}
                                value={editForm.message}
                                onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, message: e.target.value }))
                                }
                                className="w-full rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-foreground outline-none focus:border-able-green dark:border-white/10 dark:bg-black/30"
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditTarget(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmittingEdit || !editForm.message.trim()}
                                className="bg-able-green text-black hover:bg-emerald-400"
                            >
                                {isSubmittingEdit ? 'Saving...' : 'Update Feedback'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <ConfirmDialog
                open={deleteTargetId !== null}
                onOpenChange={(open) => !open && setDeleteTargetId(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Community Message"
                description="Are you sure you want to permanently delete this message? This action cannot be undone."
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="destructive"
            />
        </>
    );
}

CommunityMessagesPage.layout = {
    breadcrumbs: [
        {
            title: 'Community Feedback',
            href: '/community-messages',
        },
    ],
};
