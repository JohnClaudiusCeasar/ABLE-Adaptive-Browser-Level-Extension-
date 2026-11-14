import { Globe, Users, X } from 'lucide-react';
import { TablePagination } from '@/components/pagination';
import type { DomainPolicy, DomainVisitRecord } from './types';

interface DomainDetailModalProps {
    open: boolean;
    selectedDomain: DomainPolicy | null;
    domainVisits: DomainVisitRecord[];
    visitsLoading: boolean;
    visitMetrics: { visit_count: number; active_users: number };
    visitsPagination: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    getDomainNameWithoutTLD: (domain: string) => string;
    onClose: () => void;
    onPageChange: (page: number) => void;
}

export function DomainDetailModal({
    open,
    selectedDomain,
    domainVisits,
    visitsLoading,
    visitMetrics,
    visitsPagination,
    getDomainNameWithoutTLD,
    onClose,
    onPageChange,
}: DomainDetailModalProps) {
    if (!open || !selectedDomain) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[rgba(34,197,94,0.3)] bg-white shadow-2xl dark:bg-[#0f172a]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[rgba(34,197,94,0.1)]">
                            <img
                                src={`https://www.google.com/s2/favicons?domain=${selectedDomain.domain}&sz=32`}
                                alt={selectedDomain.domain}
                                className="h-8 w-8 rounded-md"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </div>
                        <div>
                            <h3
                                className="text-xl font-bold"
                                style={{
                                    fontFamily: "'Unbounded', sans-serif",
                                }}
                            >
                                {getDomainNameWithoutTLD(selectedDomain.domain)}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {selectedDomain.domain}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Stats */}
                <div className="border-b border-black/10 px-6 py-4 dark:border-white/10">
                    <div className="flex gap-8">
                        <div>
                            <span className="text-sm text-muted-foreground">
                                User Opened
                            </span>
                            <p className="text-lg font-semibold">
                                {domainVisits.length > 0 &&
                                domainVisits[0].user_id
                                    ? domainVisits[0].user_id
                                    : '—'}
                            </p>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">
                                Date Detected
                            </span>
                            <p className="text-lg font-semibold">
                                {new Date(
                                    selectedDomain.created_at,
                                ).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2x1 KPI Card Grid */}
                <div className="border-b border-black/10 px-6 py-4 dark:border-white/10">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5 rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] p-4 dark:bg-white/5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                    Visit Count
                                </span>
                                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-able-green/10 text-able-green">
                                    <Globe size={15} />
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-foreground tabular-nums">
                                {visitMetrics.visit_count.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Counts the number of times this domain has been
                                visited.
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5 rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] p-4 dark:bg-white/5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                    Active Users
                                </span>
                                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                                    <Users size={15} />
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-foreground tabular-nums">
                                {visitMetrics.active_users.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Counts users currently active on this domain
                                (last 15m).
                            </p>
                        </div>
                    </div>
                </div>

                {/* Visits Table */}
                <div className="flex-1 overflow-auto px-6 py-4">
                    {visitsLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-able-green"></div>
                        </div>
                    ) : domainVisits.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                            No visit records found.
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] px-3 py-2 text-left font-normal text-muted-foreground">
                                        Date
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] px-3 py-2 text-left font-normal text-muted-foreground">
                                        Time
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] px-3 py-2 text-left font-normal text-muted-foreground">
                                        User ID
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {domainVisits.map((visit) => (
                                    <tr
                                        key={visit.id}
                                        className="border-b border-black/5 dark:border-white/5"
                                    >
                                        <td className="px-3 py-3">
                                            {new Date(
                                                visit.visited_at,
                                            ).toLocaleDateString()}
                                        </td>
                                        <td className="px-3 py-3">
                                            {new Date(
                                                visit.visited_at,
                                            ).toLocaleTimeString(undefined, {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit',
                                                hour12: true,
                                            })}
                                        </td>
                                        <td className="px-3 py-3">
                                            {visit.user_id || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {visitsPagination.last_page > 1 && (
                    <div className="border-t border-black/10 px-6 py-4 dark:border-white/10">
                        <TablePagination
                            currentPage={visitsPagination.current_page}
                            totalPages={visitsPagination.last_page}
                            onPageChange={onPageChange}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
