import { Head } from '@inertiajs/react';
import {
    Activity,
    ArrowUpDown,
    Check,
    Copy,
    Eye,
    Globe,
    Laptop,
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

export default function ClientUsersPage({ clients = [] }: ClientPageProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<SortField>('id');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
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

    const totalPages = Math.max(1, Math.ceil(processedClients.length / ROWS_PER_PAGE));
    const paginatedClients = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return processedClients.slice(start, start + ROWS_PER_PAGE);
    }, [processedClients, currentPage]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(text);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <>
            <Head title="Client Users" />

            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header className="mb-2">
                    <h1
                        className="mb-3 text-[2.6rem] leading-none font-bold tracking-wide uppercase text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        Client Users
                    </h1>
                    <p className="max-w-[720px] text-base leading-relaxed text-muted-foreground">
                        All sanitized User IDs registered via the ABLE browser extension.
                    </p>
                </header>

                {/* Table Card */}
                <div className={glassCard}>
                    {/* Filter and Search Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-6 pb-4">
                        <div className="relative w-full max-w-sm">
                            <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                type="text"
                                placeholder="Search sanitized user ID or version..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full rounded-md border border-[rgba(34,197,94,0.4)] bg-black/5 py-1.5 pr-3 pl-9 text-sm placeholder:text-muted-foreground focus:border-able-green focus:outline-none dark:bg-white/5"
                            />
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Showing <strong className="text-foreground">{processedClients.length}</strong> registered clients
                        </div>
                    </div>

                    {/* Live Data Table */}
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
                                        onClick={() => handleSort('client_name')}
                                        className="cursor-pointer py-3 pr-4 text-left font-medium hover:text-foreground select-none"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Client Name</span>
                                            <ArrowUpDown size={13} />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('registered_at')}
                                        className="cursor-pointer py-3 pr-4 text-left font-medium hover:text-foreground select-none"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>ID Registered</span>
                                            <ArrowUpDown size={13} />
                                        </div>
                                    </th>
                                    <th className="py-3 text-right font-medium">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedClients.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="py-12 text-center text-sm font-medium italic text-muted-foreground"
                                        >
                                            No client users found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedClients.map((client) => (
                                        <tr
                                            key={client.user_id}
                                            className="border-b border-black/5 transition-colors hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.02]"
                                        >
                                            {/* ID Auto Increment */}
                                            <td className="py-3.5 pr-4 font-semibold text-muted-foreground tabular-nums">
                                                #{client.id}
                                            </td>

                                            {/* Client Name (Sanitized ID) */}
                                            <td className="py-3.5 pr-4 font-mono text-sm text-foreground">
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
                                            <td className="py-3.5 pr-4 tabular-nums text-muted-foreground">
                                                {formatTimestamp(client.registered_at)}
                                            </td>

                                            {/* Action (View) */}
                                            <td className="py-3.5 text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSelectedClient(client)}
                                                    className="gap-1.5 border-[rgba(34,197,94,0.5)] hover:bg-[rgba(34,197,94,0.1)] text-xs h-8"
                                                >
                                                    <Eye size={14} />
                                                    View
                                                </Button>
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
