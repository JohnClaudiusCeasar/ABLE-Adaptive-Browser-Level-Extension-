import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Search,
    Filter,
    ArrowUpDown,
    Users,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { TablePagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMetricNumber } from '@/lib/utils';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface ShadowCatalogItem {
    id: number;
    app: string;
    domain: string;
    category: string;
    risk_score: number;
    users: number;
    visit_count: number;
    status: string;
    policy: string;
    domain_status: string;
}

interface ShadowAppsProps {
    shadowCatalog: ShadowCatalogItem[];
}

function getRiskScoreBadgeClass(score: number): string {
    if (score >= 76) {
        return 'border border-[#ff4d4d] bg-[rgba(255,77,77,0.2)] text-[#ff4d4d]';
    }
    if (score >= 41) {
        return 'border border-[#f59e0b] bg-[rgba(245,158,11,0.2)] text-[#f59e0b]';
    }
    return 'border border-[#00ff66] bg-[rgba(0,255,102,0.2)] text-[#00ff66]';
}

function getPolicyBadgeVariant(
    status: string,
): 'glass-safe' | 'glass-unsafe' | 'glass-unlisted' {
    if (status === 'Sanctioned' || status === 'Approved') return 'glass-safe';
    if (status === 'Unapproved' || status === 'Blacklisted') return 'glass-unsafe';
    return 'glass-unlisted';
}

const ROWS_PER_PAGE = 10;

export default function ShadowApps({ shadowCatalog }: ShadowAppsProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortOption, setSortOption] = useState<'risk_desc' | 'risk_asc' | 'users_desc' | 'visits_desc'>('risk_desc');
    const [currentPage, setCurrentPage] = useState(1);

    const availableCategories = useMemo(() => {
        const set = new Set<string>();
        shadowCatalog.forEach((item) => {
            if (item.category) set.add(item.category);
        });
        return Array.from(set);
    }, [shadowCatalog]);

    const processedItems = useMemo(() => {
        let items = [...shadowCatalog];

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter(
                (item) =>
                    item.app.toLowerCase().includes(q) ||
                    item.domain.toLowerCase().includes(q) ||
                    item.category.toLowerCase().includes(q),
            );
        }

        if (selectedCategory !== 'all') {
            items = items.filter(
                (item) =>
                    item.category.toLowerCase() === selectedCategory.toLowerCase(),
            );
        }

        items.sort((a, b) => {
            switch (sortOption) {
                case 'risk_desc':
                    return b.risk_score - a.risk_score;
                case 'risk_asc':
                    return a.risk_score - b.risk_score;
                case 'users_desc':
                    return b.users - a.users;
                case 'visits_desc':
                    return b.visit_count - a.visit_count;
                default:
                    return 0;
            }
        });

        return items;
    }, [shadowCatalog, searchQuery, selectedCategory, sortOption]);

    const totalPages = Math.max(1, Math.ceil(processedItems.length / ROWS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedItems = useMemo(() => {
        const start = (safePage - 1) * ROWS_PER_PAGE;
        return processedItems.slice(start, start + ROWS_PER_PAGE);
    }, [processedItems, safePage]);

    return (
        <>
            <Head title="Shadow Catalog" />
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header>
                    <Link
                        href="/security-analytics"
                        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-able-green transition-colors hover:text-able-green-muted"
                    >
                        <ArrowLeft size={14} />
                        Back to Shadow Overview
                    </Link>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1
                                className="mb-2.5 text-[2.8rem] font-bold tracking-wide text-foreground uppercase"
                                style={{ fontFamily: "'Unbounded', sans-serif" }}
                            >
                                SHADOW CATALOG
                            </h1>
                            <p className="max-w-[760px] text-[1.05rem] leading-relaxed text-muted-foreground">
                                Complete catalog of unapproved, unlisted, and reviewed cloud applications
                                intercepted across your network.
                            </p>
                        </div>
                    </div>
                </header>

                {/* Main Table Card */}
                <div className={`${glassCard} p-6`}>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                                Total Monitored:
                            </span>
                            <span className="rounded-full bg-able-green/15 px-2.5 py-0.5 text-xs font-semibold text-able-green">
                                {formatMetricNumber(processedItems.length)} Applications
                            </span>
                        </div>

                        {/* Search & Filters */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-[220px]">
                                <Search
                                    size={14}
                                    className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                                />
                                <input
                                    type="text"
                                    placeholder="Search applications..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full rounded-full border border-black/10 bg-black/5 py-1.5 pr-3 pl-9 text-xs text-foreground outline-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                                />
                            </div>

                            <div className="relative">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-1.5 pr-7 pl-8 text-xs text-foreground outline-none hover:border-able-green/50 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                                >
                                    <option value="all">All Categories</option>
                                    {availableCategories.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                                <Filter
                                    size={13}
                                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                                />
                            </div>

                            <div className="relative">
                                <select
                                    value={sortOption}
                                    onChange={(e) => {
                                        setSortOption(e.target.value as typeof sortOption);
                                        setCurrentPage(1);
                                    }}
                                    className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-1.5 pr-7 pl-8 text-xs text-foreground outline-none hover:border-able-green/50 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)]"
                                >
                                    <option value="risk_desc">Sort: Risk (High-Low)</option>
                                    <option value="risk_asc">Sort: Risk (Low-High)</option>
                                    <option value="users_desc">Sort: Users (Most)</option>
                                    <option value="visits_desc">Sort: Visits (Most)</option>
                                </select>
                                <ArrowUpDown
                                    size={13}
                                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="mb-4 w-full border-collapse text-[0.85rem]">
                            <thead>
                                <tr className="text-muted-foreground">
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Application / Domain
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Category
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Risk Score
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Adopters
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Total Visits
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-4 text-left font-medium">
                                        Policy Status
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-4 text-left font-medium">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedItems.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="py-10 text-center text-muted-foreground"
                                        >
                                            No shadow applications match your search.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="border-b border-[rgba(34,197,94,0.3)] transition-colors hover:bg-black/5 last:border-b-0 dark:hover:bg-white/5"
                                        >
                                            <td className="py-3.5 pr-2.5">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-foreground">
                                                        {row.app}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground font-mono">
                                                        {row.domain}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 pr-2.5">
                                                <span className="inline-flex rounded-md bg-black/5 px-2.5 py-1 text-xs text-foreground dark:bg-white/10">
                                                    {row.category}
                                                </span>
                                            </td>
                                            <td className="py-3.5 pr-2.5">
                                                <span
                                                    className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-[10px] ${getRiskScoreBadgeClass(
                                                        row.risk_score,
                                                    )}`}
                                                >
                                                    {row.risk_score}%
                                                </span>
                                            </td>
                                            <td className="py-3.5 pr-2.5">
                                                <div className="flex items-center gap-1.5 text-foreground">
                                                    <Users
                                                        size={13}
                                                        className="text-muted-foreground"
                                                    />
                                                    <span
                                                        className="font-semibold tabular-nums"
                                                        title={row.users.toLocaleString()}
                                                    >
                                                        {formatMetricNumber(row.users)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td
                                                className="py-3.5 pr-2.5 tabular-nums text-foreground"
                                                title={row.visit_count.toLocaleString()}
                                            >
                                                {formatMetricNumber(row.visit_count)}
                                            </td>
                                            <td className="py-3.5 pr-2.5">
                                                <Badge
                                                    variant={getPolicyBadgeVariant(
                                                        row.status,
                                                    )}
                                                >
                                                    {row.status.toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td className="py-3.5">
                                                <Link href="/policy-algorithm">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2.5 text-xs border-[rgba(34,197,94,0.5)] hover:bg-[rgba(34,197,94,0.1)]"
                                                    >
                                                        Policy
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <TablePagination
                            currentPage={safePage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

ShadowApps.layout = {
    breadcrumbs: [
        {
            title: 'Shadow Analytics',
            href: '/security-analytics',
        },
        {
            title: 'Shadow Catalog',
            href: '/security-analytics/shadow-apps',
        },
    ],
};
