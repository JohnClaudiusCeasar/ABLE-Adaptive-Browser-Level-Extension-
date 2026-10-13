import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowUpDown,
    Ban,
    Eye,
    Layers,
    Pencil,
    Search,
    Unlock,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import InputError from '@/components/input-error';
import { TablePagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

const ROLE_OPTIONS = [
    { value: 'superadmin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
] as const;

const roleLabel = (role: string | null): string =>
    ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role ?? '—';

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
type GroupField = 'none' | 'role' | 'status';

export default function TeamUsersPage({ team = [] }: TeamPageProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<SortField>('id');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [groupField, setGroupField] = useState<GroupField>('none');

    // Modals
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
            role: user.role ?? 'admin',
        });
        editForm.clearErrors();
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingUser) {
            return;
        }

        editForm.patch(`/users/team/${editingUser.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingUser(null);
            },
        });
    };

    const handleToggleBlock = (user: TeamUser) => {
        router.patch(
            `/users/team/${user.id}/toggle-block`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setBlockingUser(null);
                },
            },
        );
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

    // Grouping
    const groupedTeam = useMemo(() => {
        if (groupField === 'none') {
            return null;
        }

        const groups: Record<string, TeamUser[]> = {};

        for (const item of processedTeam) {
            const key =
                groupField === 'status'
                    ? item.is_blocked
                        ? 'BLOCKED'
                        : 'ACTIVE'
                    : item.role
                      ? roleLabel(item.role).toUpperCase()
                      : 'NO ROLE';

            if (!groups[key]) {
                groups[key] = [];
            }

            groups[key].push(item);
        }

        return groups;
    }, [processedTeam, groupField]);

    const totalPages = Math.max(
        1,
        Math.ceil(processedTeam.length / ROWS_PER_PAGE),
    );
    const safePage = Math.min(currentPage, totalPages);
    const paginatedTeam = useMemo(() => {
        const start = (safePage - 1) * ROWS_PER_PAGE;

        return processedTeam.slice(start, start + ROWS_PER_PAGE);
    }, [processedTeam, safePage]);

    function renderTableRows(items: TeamUser[], isGrouped = false) {
        return items.map((member) => (
            <tr
                key={member.id}
                className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
            >
                {/* ID Auto increment */}
                <td
                    className={`py-3 pr-2.5 font-semibold text-muted-foreground tabular-nums ${
                        isGrouped ? 'w-[15%] pl-4' : ''
                    }`}
                >
                    #{member.id}
                </td>

                {/* Name */}
                <td
                    className={`py-3 pr-2.5 font-medium text-foreground ${
                        isGrouped ? 'w-[28%]' : ''
                    }`}
                >
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
                <td
                    className={`py-3 pr-2.5 font-mono text-muted-foreground ${
                        isGrouped ? 'w-[28%]' : ''
                    }`}
                >
                    {member.email}
                </td>

                {/* Role */}
                <td className={`py-3 pr-2.5 ${isGrouped ? 'w-[15%]' : ''}`}>
                    {member.role ? (
                        <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-500 dark:bg-sky-500/20 dark:text-sky-400">
                            {roleLabel(member.role)}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground/60 italic">
                            —
                        </span>
                    )}
                </td>

                {/* Action Buttons */}
                <td
                    className={`py-3 text-right ${
                        isGrouped ? 'w-[14%] pr-4' : ''
                    }`}
                >
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                router.visit(`/users/team/${member.id}`)
                            }
                            title="View Details"
                            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green"
                        >
                            <Eye size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            title="Edit Member"
                            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green"
                        >
                            <Pencil size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setBlockingUser(member)}
                            title={member.is_blocked ? 'Unblock' : 'Block User'}
                            className={`cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors ${
                                member.is_blocked
                                    ? 'hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green'
                                    : 'hover:bg-[rgba(248,113,113,0.1)] hover:text-[#f87171]'
                            }`}
                        >
                            {member.is_blocked ? (
                                <Unlock size={16} />
                            ) : (
                                <Ban size={16} />
                            )}
                        </button>
                    </div>
                </td>
            </tr>
        ));
    }

    function renderGroupedContent() {
        if (!groupedTeam) {
            return null;
        }

        const groupKeys = Object.keys(groupedTeam);

        if (groupKeys.length === 0) {
            return (
                <div className="py-10 text-center text-muted-foreground">
                    {searchQuery
                        ? 'No team members match your search.'
                        : 'No team users found.'}
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-6">
                {groupKeys.map((groupKey) => {
                    const items = groupedTeam[groupKey];
                    const isScrollable = items.length > 5;

                    return (
                        <div
                            key={groupKey}
                            className="overflow-hidden rounded-lg border border-[rgba(34,197,94,0.3)] bg-black/[0.02] shadow-xs dark:bg-white/[0.02]"
                        >
                            {/* Group Header Banner */}
                            <div className="flex items-center justify-between border-b border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] px-5 py-3">
                                <span className="text-sm font-bold tracking-wider text-able-green uppercase">
                                    {groupKey}
                                </span>
                                <span className="rounded-full bg-able-green/15 px-2.5 py-0.5 text-xs font-semibold text-able-green">
                                    {items.length}{' '}
                                    {items.length === 1 ? 'Member' : 'Members'}
                                </span>
                            </div>

                            {/* Static Column Headers (Blends with Card Gradient Background) */}
                            <div className="border-b border-[rgba(34,197,94,0.3)] bg-transparent">
                                <table className="w-full table-fixed border-collapse text-[0.85rem]">
                                    <thead>
                                        <tr className="text-muted-foreground">
                                            <th className="w-[15%] py-3 pr-2.5 pl-4 text-left font-medium">
                                                ID
                                            </th>
                                            <th className="w-[28%] py-3 pr-2.5 text-left font-medium">
                                                Name
                                            </th>
                                            <th className="w-[28%] py-3 pr-2.5 text-left font-medium">
                                                Email
                                            </th>
                                            <th className="w-[15%] py-3 pr-2.5 text-left font-medium">
                                                Role
                                            </th>
                                            <th className="w-[14%] py-3 pr-4 text-right font-medium">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                </table>
                            </div>

                            {/* Scrollable Body Rows (Scrollbar starts below column header area) */}
                            <div
                                className={`overflow-x-auto ${
                                    isScrollable
                                        ? 'max-h-[300px] scrollbar-thin scrollbar-thumb-[rgba(34,197,94,0.4)] scrollbar-track-transparent overflow-y-auto'
                                        : ''
                                }`}
                            >
                                <table className="w-full table-fixed border-collapse text-[0.85rem]">
                                    <tbody>
                                        {renderTableRows(items, true)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    function renderUngroupedContent() {
        if (paginatedTeam.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td
                            colSpan={5}
                            className="py-10 text-center text-muted-foreground"
                        >
                            {searchQuery
                                ? 'No team members match your search.'
                                : 'No team users found.'}
                        </td>
                    </tr>
                </tbody>
            );
        }

        return <tbody>{renderTableRows(paginatedTeam)}</tbody>;
    }

    return (
        <>
            <Head title="Able Teams" />

            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="mb-2.5 text-[2.8rem] font-bold tracking-wide text-foreground uppercase"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Able Teams
                    </h1>
                    <p className="mb-6 text-[1.05rem] text-muted-foreground">
                        All registered administrative accounts and staff members
                        of the server website.
                    </p>

                    {/* Search + Sort + Group row */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative w-[260px]">
                            <Search
                                size={16}
                                className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full rounded-full border border-black/10 bg-black/5 py-2.5 pr-3.5 pl-11 text-[0.9rem] text-foreground outline-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                            />
                        </div>

                        {/* Sort Dropdown */}
                        <div className="relative">
                            <select
                                value={`${sortField}__${sortDir}`}
                                onChange={(e) => {
                                    const parts = e.target.value.split('__');
                                    setSortField(parts[0] as SortField);
                                    setSortDir(parts[1] as SortDir);
                                    setCurrentPage(1);
                                }}
                                className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-2.5 pr-8 pl-9 text-[0.85rem] text-foreground transition-all duration-200 outline-none hover:border-able-green/50 hover:bg-black/10 focus:border-able-green focus:ring-1 focus:ring-able-green/30 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-white/5"
                            >
                                <option value="id__asc">
                                    Sort: ID (Ascending)
                                </option>
                                <option value="id__desc">
                                    Sort: ID (Descending)
                                </option>
                                <option value="name__asc">
                                    Sort: Name (A-Z)
                                </option>
                                <option value="name__desc">
                                    Sort: Name (Z-A)
                                </option>
                                <option value="email__asc">
                                    Sort: Email (A-Z)
                                </option>
                                <option value="email__desc">
                                    Sort: Email (Z-A)
                                </option>
                                <option value="role__asc">
                                    Sort: Role (A-Z)
                                </option>
                                <option value="role__desc">
                                    Sort: Role (Z-A)
                                </option>
                                <option value="status__asc">
                                    Sort: Status (Active First)
                                </option>
                                <option value="status__desc">
                                    Sort: Status (Blocked First)
                                </option>
                            </select>
                            <ArrowUpDown
                                size={16}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                            />
                        </div>

                        {/* Group Dropdown */}
                        <div className="relative">
                            <select
                                value={groupField}
                                onChange={(e) =>
                                    setGroupField(e.target.value as GroupField)
                                }
                                className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-2.5 pr-8 pl-9 text-[0.85rem] text-foreground transition-all duration-200 outline-none hover:border-able-green/50 hover:bg-black/10 focus:border-able-green focus:ring-1 focus:ring-able-green/30 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-white/5"
                            >
                                <option value="none">Group: None</option>
                                <option value="role">Group: Role</option>
                                <option value="status">Group: Status</option>
                            </select>
                            <Layers
                                size={16}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                            />
                        </div>
                    </div>
                </header>

                {/* Data Table */}
                <div className={`${glassCard} p-6`}>
                    {groupField !== 'none' ? (
                        renderGroupedContent()
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="mb-5 w-full border-collapse text-[0.85rem]">
                                <thead>
                                    <tr className="text-muted-foreground">
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                            ID
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                            Name
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                            Email
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                            Role
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pb-5 text-right font-medium">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                {renderUngroupedContent()}
                            </table>
                        </div>
                    )}

                    {/* Pagination (only when not grouped) */}
                    {groupField === 'none' && totalPages > 1 && (
                        <TablePagination
                            currentPage={safePage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            <Dialog
                open={editingUser !== null}
                onOpenChange={(open) => !open && setEditingUser(null)}
            >
                <DialogContent className="max-w-md border border-[rgba(34,197,94,0.4)] bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle
                            className="text-xl font-bold tracking-wide uppercase"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Edit Team Member
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Update user account details and assigned role.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={handleEditSubmit}
                        className="space-y-4 pt-2"
                    >
                        <div className="space-y-1.5">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                value={editForm.data.name}
                                onChange={(e) =>
                                    editForm.setData('name', e.target.value)
                                }
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
                                onChange={(e) =>
                                    editForm.setData('email', e.target.value)
                                }
                                required
                            />
                            <InputError message={editForm.errors.email} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="role">Role</Label>
                            <Select
                                value={editForm.data.role}
                                onValueChange={(value) =>
                                    editForm.setData('role', value)
                                }
                            >
                                <SelectTrigger id="role" className="w-full">
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLE_OPTIONS.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                            className="text-xl font-bold tracking-wide uppercase"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            {blockingUser?.is_blocked
                                ? 'Unblock User'
                                : 'Block User Account'}
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
                            variant={
                                blockingUser?.is_blocked
                                    ? 'default'
                                    : 'destructive'
                            }
                            onClick={() =>
                                blockingUser && handleToggleBlock(blockingUser)
                            }
                            className={
                                blockingUser?.is_blocked
                                    ? 'bg-able-green text-white hover:bg-able-green-muted'
                                    : undefined
                            }
                        >
                            {blockingUser?.is_blocked
                                ? 'Confirm Unblock'
                                : 'Confirm Block'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

TeamUsersPage.layout = {
    breadcrumbs: [
        { title: 'Users', href: '/users/client' },
        { title: 'Team', href: '/users/team' },
    ],
};
