import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Ban,
    Check,
    KeyRound,
    Lock,
    Mail,
    Pencil,
    Shield,
    Unlock,
    UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { PanelCard } from '@/components/dashboard/panel-card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface TeamMember {
    id: number;
    name: string;
    email: string;
    role: string | null;
    is_blocked: boolean;
    created_at: string | null;
    email_verified_at: string | null;
    two_factor_enabled: boolean;
}

interface RoleOption {
    value: string;
    label: string;
    description: string;
    modules: string[];
}

interface TeamShowProps {
    member: TeamMember;
    roleOptions: RoleOption[];
    canManage: boolean;
}

const moduleLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    analytics: 'Shadow Analytics',
    policy: 'Policy Administration',
    clients: 'Client Users',
    team: 'Team Management',
    chat: 'Chat',
    feedback: 'Community Feedback',
    settings: 'Server & Extension Settings',
};

function formatTimestamp(ts: string | null): string {
    if (!ts) {
        return '—';
    }

    const d = new Date(ts);

    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

export default function TeamShowPage({
    member,
    roleOptions,
    canManage,
}: TeamShowProps) {
    const [selectedRole, setSelectedRole] = useState(
        member.role ?? roleOptions[0]?.value ?? '',
    );
    const [editOpen, setEditOpen] = useState(false);
    const [blockOpen, setBlockOpen] = useState(false);

    const editForm = useForm({
        name: member.name,
        email: member.email,
        role: member.role ?? roleOptions[0]?.value ?? '',
    });

    const submitRole = () => {
        router.patch(
            `/users/team/${member.id}`,
            { name: member.name, email: member.email, role: selectedRole },
            { preserveScroll: true },
        );
    };

    const saveProfile = () => {
        editForm.patch(`/users/team/${member.id}`, {
            preserveScroll: true,
            onSuccess: () => setEditOpen(false),
        });
    };

    const toggleBlock = () => {
        router.patch(
            `/users/team/${member.id}/toggle-block`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setBlockOpen(false),
            },
        );
    };

    const { errors } = usePage<{ errors?: Record<string, string> }>().props;

    const activeRoleOption =
        roleOptions.find((option) => option.value === selectedRole) ??
        roleOptions[0];
    const allModules = roleOptions.find(
        (option) => option.value === 'superadmin',
    )?.modules ?? [];
    const roleLabel =
        roleOptions.find((option) => option.value === member.role)?.label ??
        member.role ??
        'Unassigned';

    return (
        <>
            <Head title={`Team — ${member.name}`} />

            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                <Link
                    href="/users/team"
                    className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft size={15} />
                    Back to Able team
                </Link>

                <header className="mb-8 flex flex-wrap items-center gap-5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#a855f7]/15 text-2xl font-semibold text-[#a855f7]">
                        {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1
                            className="mb-1.5 text-[2.4rem] font-bold tracking-wide text-foreground uppercase"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            {member.name}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-sm text-muted-foreground">
                                {member.email}
                            </span>
                            <Badge className="bg-[#a855f7]/15 text-[#a855f7]">
                                {roleLabel}
                            </Badge>
                            <Badge
                                className={
                                    member.is_blocked
                                        ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400'
                                        : 'bg-able-green/15 text-able-green'
                                }
                            >
                                {member.is_blocked ? 'Blocked' : 'Active'}
                            </Badge>
                            <Badge
                                className={
                                    member.two_factor_enabled
                                        ? 'bg-able-green/15 text-able-green'
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                }
                            >
                                2FA{' '}
                                {member.two_factor_enabled
                                    ? 'Enabled'
                                    : 'Disabled'}
                            </Badge>
                            <Badge
                                className={
                                    member.email_verified_at
                                        ? 'bg-able-green/15 text-able-green'
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                }
                            >
                                {member.email_verified_at
                                    ? 'Verified'
                                    : 'Unverified'}
                            </Badge>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <PanelCard
                        title="Profile"
                        subtitle="Account details"
                        className="lg:col-span-1"
                    >
                        <dl className="flex flex-col gap-4 text-[0.9rem]">
                            <div className="flex items-center gap-2.5">
                                <UserRound
                                    size={16}
                                    className="text-muted-foreground"
                                />
                                <dt className="text-muted-foreground">Name</dt>
                                <dd className="ml-auto font-medium">
                                    {member.name}
                                </dd>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <Mail
                                    size={16}
                                    className="text-muted-foreground"
                                />
                                <dt className="text-muted-foreground">
                                    Email
                                </dt>
                                <dd className="ml-auto font-medium break-all">
                                    {member.email}
                                </dd>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <KeyRound
                                    size={16}
                                    className="text-muted-foreground"
                                />
                                <dt className="text-muted-foreground">
                                    Member ID
                                </dt>
                                <dd className="ml-auto font-medium tabular-nums">
                                    #{member.id}
                                </dd>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <Shield
                                    size={16}
                                    className="text-muted-foreground"
                                />
                                <dt className="text-muted-foreground">
                                    Joined
                                </dt>
                                <dd className="ml-auto font-medium tabular-nums">
                                    {formatTimestamp(member.created_at)}
                                </dd>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <Check
                                    size={16}
                                    className="text-muted-foreground"
                                />
                                <dt className="text-muted-foreground">
                                    Verified
                                </dt>
                                <dd className="ml-auto font-medium tabular-nums">
                                    {formatTimestamp(member.email_verified_at)}
                                </dd>
                            </div>
                        </dl>
                    </PanelCard>

                    <PanelCard
                        title="Role & Access"
                        subtitle="Module-level access granted by the assigned role"
                        className="lg:col-span-2"
                        action={
                            canManage ? (
                                <Button
                                    size="sm"
                                    onClick={submitRole}
                                    disabled={
                                        selectedRole === (member.role ?? '')
                                    }
                                >
                                    Save role
                                </Button>
                            ) : undefined
                        }
                    >
                        <div className="mb-5 max-w-sm">
                            <Label htmlFor="role" className="mb-2 block">
                                Role
                            </Label>
                            {canManage ? (
                                <Select
                                    value={selectedRole}
                                    onValueChange={setSelectedRole}
                                >
                                    <SelectTrigger id="role" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roleOptions.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="font-medium">{roleLabel}</p>
                            )}
                            {activeRoleOption && (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {activeRoleOption.description}
                                </p>
                            )}
                        </div>

                        <table className="w-full border-collapse text-[0.85rem]">
                            <thead>
                                <tr className="text-muted-foreground">
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-3 text-left font-medium">
                                        Module
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-3 text-right font-medium">
                                        Access
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {allModules.map((module) => {
                                    const allowed =
                                        activeRoleOption?.modules.includes(
                                            module,
                                        ) ?? false;

                                    return (
                                        <tr
                                            key={module}
                                            className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                        >
                                            <td className="py-2.5">
                                                {moduleLabels[module] ??
                                                    module}
                                            </td>
                                            <td className="py-2.5 text-right">
                                                {allowed ? (
                                                    <Check
                                                        size={16}
                                                        className="ml-auto text-able-green"
                                                    />
                                                ) : (
                                                    <Lock
                                                        size={16}
                                                        className="ml-auto text-muted-foreground/60"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </PanelCard>
                </div>

                {canManage && (
                    <div className="mt-5">
                        <PanelCard
                            title="Account Actions"
                            subtitle="Manage this member's profile and account status"
                        >
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setEditOpen(true)}
                                >
                                    <Pencil size={15} className="mr-2" />
                                    Edit profile
                                </Button>
                                <Button
                                    variant="outline"
                                    className={
                                        member.is_blocked
                                            ? 'border-able-green/70 text-able-green hover:bg-able-green/10'
                                            : 'border-rose-500/60 text-rose-500 hover:bg-rose-500/10 dark:text-rose-400'
                                    }
                                    onClick={() => setBlockOpen(true)}
                                >
                                    {member.is_blocked ? (
                                        <Unlock size={15} className="mr-2" />
                                    ) : (
                                        <Ban size={15} className="mr-2" />
                                    )}
                                    {member.is_blocked
                                        ? 'Unblock account'
                                        : 'Block account'}
                                </Button>
                            </div>
                        </PanelCard>
                    </div>
                )}
            </div>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="border border-[rgba(34,197,94,0.4)] bg-background/95 backdrop-blur-xl sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Team Member</DialogTitle>
                        <DialogDescription>
                            Update the profile details for {member.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={editForm.data.name}
                                onChange={(e) =>
                                    editForm.setData('name', e.target.value)
                                }
                            />
                            {editForm.errors.name && (
                                <p className="text-sm text-rose-500">
                                    {editForm.errors.name}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={editForm.data.email}
                                onChange={(e) =>
                                    editForm.setData('email', e.target.value)
                                }
                            />
                            {editForm.errors.email && (
                                <p className="text-sm text-rose-500">
                                    {editForm.errors.email}
                                </p>
                            )}
                        </div>
                        {errors?.role && (
                            <p className="text-sm text-rose-500">
                                {errors.role}
                            </p>
                        )}
                    </div>
                    <DialogFooter className="gap-2 pt-2">
                        <Button
                            variant="secondary"
                            onClick={() => setEditOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={saveProfile}
                            disabled={editForm.processing}
                        >
                            Save changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={blockOpen}
                onOpenChange={setBlockOpen}
                title={
                    member.is_blocked
                        ? 'Unblock User Account'
                        : 'Block User Account'
                }
                description={
                    member.is_blocked
                        ? `Unblock ${member.name}? They will be able to sign in again.`
                        : `Block ${member.name}? They will no longer be able to sign in.`
                }
                confirmLabel={member.is_blocked ? 'Unblock' : 'Block'}
                onConfirm={toggleBlock}
            />
        </>
    );
}

TeamShowPage.layout = {
    breadcrumbs: [
        { title: 'Users', href: '/users/client' },
        { title: 'Team', href: '/users/team' },
        { title: 'Team Member', href: '#' },
    ],
};
