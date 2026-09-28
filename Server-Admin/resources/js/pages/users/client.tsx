import { Head } from '@inertiajs/react';
import {
    Activity,
    ArrowUpDown,
    Check,
    Copy,
    Eye,
    Globe,
    Laptop,
    Layers,
    Search,
    ShieldAlert,
    X,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { TablePagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface ClientUser {
    id: number;
    user_id: string;
    client_name: string;
    registered_at: string | null;
    last_active_at: string | null;
    status: 'active' | 'inactive' | 'uninstalled';
    version: string;
    total_visits: number;
    total_egress: number;
}

interface ClientPageProps {
    clients: ClientUser[];
}

const ROWS_PER_PAGE = 8;
type SortField = 'id' | 'client_name' | 'registered_at' | 'status';
type SortDir = 'asc' | 'desc';
type GroupField = 'none' | 'status' | 'version';

function formatTimestamp(ts: string | null): string {
    if (!ts) {
return '—';
}

    const d = new Date(ts);

    if (isNaN(d.getTime())) {
return ts;
}

    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

export default function ClientUsersPage({ clients = [] }: ClientPageProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<SortField>('id');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [groupField, setGroupField] = useState<GroupField>('none');
    const [selectedClient, setSelectedClient] = useState<ClientUser | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Search and sort logic
    const processedClients = useMemo(() => {
        let items = [...clients];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(
                (c) =>
                    c.client_name.toLowerCase().includes(q) ||
                    c.user_id.toLowerCase().includes(q) ||
                    c.version.toLowerCase().includes(q),
            );
        }

        items.sort((a, b) => {
            let cmp = 0;

            switch (sortField) {
                case 'id':
                    cmp = a.id - b.id;
                    break;
                case 'client_name':
                    cmp = a.client_name.localeCompare(b.client_name);
                    break;
                case 'registered_at':
                    cmp = (a.registered_at ?? '').localeCompare(b.registered_at ?? '');
                    break;
                case 'status':
                    cmp = a.status.localeCompare(b.status);
                    break;
            }

            return sortDir === 'asc' ? cmp : -cmp;
        });

        return items;
    }, [clients, searchQuery, sortField, sortDir]);

    // Grouping logic
    const groupedClients = useMemo(() => {
        if (groupField === 'none') {
            return null;
        }

        const groups: Record<string, ClientUser[]> = {};

        for (const item of processedClients) {
            const key =
                groupField === 'status'
                    ? item.status.toUpperCase()
                    : `Version ${item.version || 'Unknown'}`;

            if (!groups[key]) {
                groups[key] = [];
            }

            groups[key].push(item);
        }

        return groups;
    }, [processedClients, groupField]);

    const totalPages = Math.max(1, Math.ceil(processedClients.length / ROWS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedClients = useMemo(() => {
        const start = (safePage - 1) * ROWS_PER_PAGE;

        return processedClients.slice(start, start + ROWS_PER_PAGE);
    }, [processedClients, safePage]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(text);
        setTimeout(() => setCopiedId(null), 2000);
    };

    function renderTableRows(items: ClientUser[], isGrouped = false) {
        return items.map((client) => (
            <tr
                key={client.user_id}
                className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
            >
                {/* ID Auto Increment */}
                <td
                    className={`py-3 pr-2.5 font-semibold text-muted-foreground tabular-nums ${
                        isGrouped ? 'w-[15%] pl-4' : ''
                    }`}
                >
                    #{client.id}
                </td>

                {/* Client Name (Sanitized ID) */}
                <td
                    className={`py-3 pr-2.5 font-mono text-foreground ${
                        isGrouped ? 'w-[45%]' : ''
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <span className="truncate max-w-[280px]">
                            {client.client_name}
                        </span>
                        <button
                            onClick={() => copyToClipboard(client.user_id)}
                            title="Copy sanitized ID"
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                            {copiedId === client.user_id ? (
                                <Check size={14} className="text-able-green" />
                            ) : (
                                <Copy size={14} />
                            )}
                        </button>
                    </div>
                </td>

                {/* ID Registered Timestamp */}
                <td
                    className={`py-3 pr-2.5 tabular-nums text-muted-foreground ${
                        isGrouped ? 'w-[25%]' : ''
                    }`}
                >
                    {formatTimestamp(client.registered_at)}
                </td>

                {/* Action (View) */}
                <td
                    className={`py-3 text-right ${
                        isGrouped ? 'w-[15%] pr-4' : ''
                    }`}
                >
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedClient(client)}
                        className="gap-1.5 border-[rgba(34,197,94,0.7)] hover:bg-[rgba(34,197,94,0.1)] text-xs h-8"
                    >
                        <Eye size={14} />
                        View
                    </Button>
                </td>
            </tr>
        ));
    }

    function renderGroupedContent() {
        if (!groupedClients) {
return null;
}

        const groupKeys = Object.keys(groupedClients);

        if (groupKeys.length === 0) {
            return (
                <div className="py-10 text-center text-muted-foreground">
                    {searchQuery
                        ? 'No client users match your search.'
                        : 'No client users found.'}
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-6">
                {groupKeys.map((groupKey) => {
                    const items = groupedClients[groupKey];
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
                                    {items.length} {items.length === 1 ? 'Client' : 'Clients'}
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
                                            <th className="w-[45%] py-3 pr-2.5 text-left font-medium">
                                                Client Name
                                            </th>
                                            <th className="w-[25%] py-3 pr-2.5 text-left font-medium">
                                                ID Registered
                                            </th>
                                            <th className="w-[15%] py-3 pr-4 text-right font-medium">
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
                                        ? 'max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-[rgba(34,197,94,0.4)] scrollbar-track-transparent'
                                        : ''
                                }`}
                            >
                                <table className="w-full table-fixed border-collapse text-[0.85rem]">
                                    <tbody>{renderTableRows(items, true)}</tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    function renderUngroupedContent() {
        if (paginatedClients.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td
                            colSpan={4}
                            className="py-10 text-center text-muted-foreground"
                        >
                            {searchQuery
                                ? 'No client users match your search.'
                                : 'No client users found.'}
                        </td>
                    </tr>
                </tbody>
            );
        }

        return <tbody>{renderTableRows(paginatedClients)}</tbody>;
    }

    return (
        <>
            <Head title="Able clients" />

            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="mb-2.5 text-[2.8rem] font-bold tracking-wide uppercase text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Able clients
                    </h1>
                    <p className="mb-6 text-[1.05rem] text-muted-foreground">
                        All sanitized User IDs registered via the ABLE browser extension.
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
                                <option value="id__asc">Sort: ID (Ascending)</option>
                                <option value="id__desc">Sort: ID (Descending)</option>
                                <option value="client_name__asc">Sort: Client Name (A-Z)</option>
                                <option value="client_name__desc">Sort: Client Name (Z-A)</option>
                                <option value="registered_at__desc">Sort: Date (Newest)</option>
                                <option value="registered_at__asc">Sort: Date (Oldest)</option>
                                <option value="status__asc">Sort: Status (A-Z)</option>
                                <option value="status__desc">Sort: Status (Z-A)</option>
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
                                <option value="status">Group: Status</option>
                                <option value="version">Group: Version</option>
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
                                            Client Name
                                        </th>
                                        <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-5 text-left font-medium">
                                            ID Registered
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

            {/* View Details Modal */}
            <Dialog
                open={selectedClient !== null}
                onOpenChange={(open) => !open && setSelectedClient(null)}
            >
                <DialogContent className="max-w-lg border border-[rgba(34,197,94,0.4)] bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle
                            className="text-xl font-bold uppercase tracking-wide"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Client Telemetry Profile
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Telemetry overview for this sanitized extension client.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedClient && (
                        <div className="flex flex-col gap-5 pt-2">
                            {/* User ID block */}
                            <div className="rounded-lg border border-black/10 bg-black/5 p-3.5 dark:border-white/10 dark:bg-white/5">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Sanitized Extension User ID
                                </span>
                                <div className="mt-1 flex items-center justify-between gap-2">
                                    <code className="text-sm font-mono text-foreground font-semibold break-all">
                                        {selectedClient.user_id}
                                    </code>
                                    <button
                                        onClick={() => copyToClipboard(selectedClient.user_id)}
                                        className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                        {copiedId === selectedClient.user_id ? (
                                            <Check size={16} className="text-able-green" />
                                        ) : (
                                            <Copy size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Stat cards grid */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-lg border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Globe size={14} className="text-sky-400" />
                                        <span>Total Domain Visits</span>
                                    </div>
                                    <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                                        {selectedClient.total_visits.toLocaleString()}
                                    </p>
                                </div>

                                <div className="rounded-lg border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <ShieldAlert size={14} className="text-rose-400" />
                                        <span>Egress Events</span>
                                    </div>
                                    <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                                        {selectedClient.total_egress.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Timestamps & details */}
                            <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-black/5 p-3.5 text-xs dark:border-white/10 dark:bg-white/5">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">ID Registered:</span>
                                    <span className="font-semibold text-foreground tabular-nums">
                                        {formatTimestamp(selectedClient.registered_at)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Last Active Telemetry:</span>
                                    <span className="font-semibold text-foreground tabular-nums">
                                        {formatTimestamp(selectedClient.last_active_at)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Client Version:</span>
                                    <span className="font-semibold font-mono text-foreground">
                                        {selectedClient.version}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedClient(null)}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
