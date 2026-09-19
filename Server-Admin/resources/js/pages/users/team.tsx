import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowUpDown,
    Ban,
    Check,
    CheckCircle2,
    Edit3,
    Eye,
    KeyRound,
    Mail,
    MoreVertical,
    Search,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Unlock,
    User as UserIcon,
    XCircle,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import InputError from '@/components/input-error';
import { TablePagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface TeamUser {
    id: number;
    name: string;
    email: string;
    role: string | null;
    is_blocked: boolean;
    created_at: string | null;
    email_verified_at: string | null;
    two_factor_enabled: boolean;
}

interface TeamPageProps {
    team: TeamUser[];
}

const ROWS_PER_PAGE = 8;
type SortField = 'id' | 'name' | 'email' | 'role' | 'status';
type SortDir = 'asc' | 'desc';

function formatTimestamp(ts: string | null): string {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;

    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

export default function TeamUsersPage({ team = [] }: TeamPageProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<SortField>('id');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // Modals
    const [viewingUser, setViewingUser] = useState<TeamUser | null>(null);
    const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
    const [blockingUser, setBlockingUser] = useState<TeamUser | null>(null);

    // Edit form state
    const editForm = useForm({
        name: '',
        email: '',
        role: '',
    });

    const openEditModal = (user: TeamUser) => {
        setEditingUser(user);
        editForm.setData({
            name: user.name,
            email: user.email,
            role: user.role ?? '',
        });
        editForm.clearErrors();
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        editForm.patch(`/users/team/${editingUser.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingUser(null);
            },
        });
    };

    const handleToggleBlock = (user: TeamUser) => {
        router.patch(`/users/team/${user.id}/toggle-block`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                setBlockingUser(null);
            },
        });
    };

    // Filter and sort
    const processedTeam = useMemo(() => {
        let items = [...team];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(
                (u) =>
                    u.name.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    (u.role && u.role.toLowerCase().includes(q)),
            );
        }

        items.sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'id':
                    cmp = a.id - b.id;
                    break;
                case 'name':
                    cmp = a.name.localeCompare(b.name);
                    break;
                case 'email':
                    cmp = a.email.localeCompare(b.email);
                    break;
                case 'role':
                    cmp = (a.role ?? '').localeCompare(b.role ?? '');
                    break;
                case 'status':
                    cmp = Number(a.is_blocked) - Number(b.is_blocked);
                    break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return items;
    }, [team, searchQuery, sortField, sortDir]);

    const totalPages = Math.max(1, Math.ceil(processedTeam.length / ROWS_PER_PAGE));
    const paginatedTeam = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return processedTeam.slice(start, start + ROWS_PER_PAGE);
    }, [processedTeam, currentPage]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    return (
        <>
            <Head title="Team Users" />

            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header className="mb-2">
                    <h1
                        className="mb-2.5 text-[2.8rem] font-bold tracking-wide uppercase text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Team Users
                    </h1>
                    <p className="max-w-[720px] text-[1.05rem] leading-relaxed text-muted-foreground">
                        All registered administrative accounts and staff members of the server website.
                    </p>
                </header>

                {/* Table Card */}
                <div className={glassCard}>
                    {/* Search and summary */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-6 pb-4">
                        <div className="relative w-full max-w-sm">
                            <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                type="text"
                                placeholder="Search name, email, or role..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full rounded-md border border-[rgba(34,197,94,0.4)] bg-black/5 py-1.5 pr-3 pl-9 text-sm placeholder:text-muted-foreground focus:border-able-green focus:outline-none dark:bg-white/5"
                            />
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Showing <strong className="text-foreground">{processedTeam.length}</strong> team members
                        </div>
                    </div>

                    {/* Live Table */}
                    <div className="overflow-x-auto px-6 pb-4">
                        <table className="w-full border-collapse text-[0.85rem]">
                            <thead>
                                <tr className="text-muted-foreground border-b border-[rgba(34,197,94,0.4)]">
                                    <th
                                        onClick={() => handleSort('id')}
                                        className="cursor-pointer py-3 pr-4 text-left font-medium hover:text-foreground select-none"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>ID</span>
                                            <ArrowUpDown size={13} />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('name')}
                                        className="cursor-pointer py-3 pr-4 text-left font-medium hover:text-foreground select-none"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Name</span>
                                            <ArrowUpDown size={13} />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('email')}
                                        className="cursor-pointer py-3 pr-4 text-left font-medium hover:text-foreground select-none"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Email</span>
                                            <ArrowUpDown size={13} />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('role')}
                                        className="cursor-pointer py-3 pr-4 text-left font-medium hover:text-foreground select-none"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Role</span>
                                            <ArrowUpDown size={13} />
                                        </div>
                                    </th>
                                    <th className="py-3 text-right font-medium">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedTeam.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="py-12 text-center text-sm font-medium italic text-muted-foreground"
                                        >
                                            No team users found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedTeam.map((member) => (
                                        <tr
                                            key={member.id}
                                            className="border-b border-black/5 transition-colors hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.02]"
                                        >
                                            {/* ID Auto increment */}
                                            <td className="py-3.5 pr-4 font-semibold text-muted-foreground tabular-nums">
                                                #{member.id}
                                            </td>

                                            {/* Name */}
                                            <td className="py-3.5 pr-4 font-medium text-foreground">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-able-green/15 text-xs font-bold text-able-green">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span>{member.name}</span>
                                                    {member.is_blocked && (
                                                        <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-500">
                                                            Blocked
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Email */}
                                            <td className="py-3.5 pr-4 font-mono text-sm text-muted-foreground">
                                                {member.email}
                                            </td>

                                            {/* Role (Nullable) */}
                                            <td className="py-3.5 pr-4">
                                                {member.role ? (
                                                    <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-500 dark:bg-sky-500/20 dark:text-sky-400">
                                                        {member.role}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/60 italic">
                                                        —
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action Dropdown / Buttons (View/Edit/Block) */}
                                            <td className="py-3.5 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40">
                                                        <DropdownMenuItem
                                                            onClick={() => setViewingUser(member)}
                                                            className="cursor-pointer gap-2"
                                                        >
                                                            <Eye size={14} />
                                                            <span>View Details</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => openEditModal(member)}
                                                            className="cursor-pointer gap-2"
                                                        >
                                                            <Edit3 size={14} />
                                                            <span>Edit Member</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => setBlockingUser(member)}
                                                            className={
                                                                member.is_blocked
                                                                    ? 'cursor-pointer gap-2 text-able-green focus:text-able-green'
                                                                    : 'cursor-pointer gap-2 text-rose-500 focus:text-rose-500'
                                                            }
                                                        >
                                                            {member.is_blocked ? (
                                                                <>
                                                                    <Unlock size={14} />
                                                                    <span>Unblock</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Ban size={14} />
                                                                    <span>Block User</span>
                                                                </>
                                                            )}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="border-t border-black/5 p-4 dark:border-white/5">
                            <TablePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* View Modal */}
            <Dialog
                open={viewingUser !== null}
                onOpenChange={(open) => !open && setViewingUser(null)}
            >
                <DialogContent className="max-w-md border border-[rgba(34,197,94,0.4)] bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle
                            className="text-xl font-bold uppercase tracking-wide"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Team Member Profile
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Account information and security status.
                        </DialogDescription>
                    </DialogHeader>

                    {viewingUser && (
                        <div className="flex flex-col gap-4 pt-2 text-sm">
                            <div className="flex items-center gap-3 rounded-lg border border-black/10 bg-black/5 p-3.5 dark:border-white/10 dark:bg-white/5">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-able-green/15 text-lg font-bold text-able-green">
                                    {viewingUser.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-foreground text-base">
                                        {viewingUser.name}
                                    </span>
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {viewingUser.email}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-black/5 p-3.5 text-xs dark:border-white/10 dark:bg-white/5">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Account Role:</span>
                                    <span className="font-semibold text-foreground">
                                        {viewingUser.role ?? 'Unassigned (None)'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Account Status:</span>
                                    <span
                                        className={
                                            viewingUser.is_blocked
                                                ? 'font-semibold text-rose-500'
                                                : 'font-semibold text-able-green'
                                        }
                                    >
                                        {viewingUser.is_blocked ? 'Blocked' : 'Active'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Two-Factor Auth:</span>
                                    <span className="font-semibold text-foreground">
                                        {viewingUser.two_factor_enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Created Date:</span>
                                    <span className="font-semibold text-foreground tabular-nums">
                                        {formatTimestamp(viewingUser.created_at)}
                                    </span>
                                </div>
                            </div>

                            <DialogFooter className="pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setViewingUser(null)}
                                >
                                    Close
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog
                open={editingUser !== null}
                onOpenChange={(open) => !open && setEditingUser(null)}
            >
                <DialogContent className="max-w-md border border-[rgba(34,197,94,0.4)] bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle
                            className="text-xl font-bold uppercase tracking-wide"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Edit Team Member
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Update user account details and assigned role.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                value={editForm.data.name}
                                onChange={(e) => editForm.setData('name', e.target.value)}
                                required
                            />
                            <InputError message={editForm.errors.name} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                value={editForm.data.email}
                                onChange={(e) => editForm.setData('email', e.target.value)}
                                required
                            />
                            <InputError message={editForm.errors.email} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="role">Role (Optional)</Label>
                            <Input
                                id="role"
                                placeholder="e.g. Admin, Analyst, Auditor"
                                value={editForm.data.role}
                                onChange={(e) => editForm.setData('role', e.target.value)}
                            />
                            <InputError message={editForm.errors.role} />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditingUser(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={editForm.processing}
                                className="bg-able-green text-white hover:bg-able-green-muted"
                            >
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Block / Unblock Confirmation Modal */}
            <Dialog
                open={blockingUser !== null}
                onOpenChange={(open) => !open && setBlockingUser(null)}
            >
                <DialogContent className="max-w-md border border-[rgba(34,197,94,0.4)] bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle
                            className="text-xl font-bold uppercase tracking-wide"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            {blockingUser?.is_blocked ? 'Unblock User' : 'Block User Account'}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            {blockingUser?.is_blocked
                                ? `Are you sure you want to restore access for ${blockingUser.name}?`
                                : `Are you sure you want to block ${blockingUser?.name}? They will be prevented from performing actions on the platform.`}
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setBlockingUser(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant={blockingUser?.is_blocked ? 'default' : 'destructive'}
                            onClick={() => blockingUser && handleToggleBlock(blockingUser)}
                            className={
                                blockingUser?.is_blocked
                                    ? 'bg-able-green text-white hover:bg-able-green-muted'
                                    : undefined
                            }
                        >
                            {blockingUser?.is_blocked ? 'Confirm Unblock' : 'Confirm Block'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
