import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Eye, Search, ArrowUpDown, Layers } from 'lucide-react';
import { useState, useMemo } from 'react';
import { TablePagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface ShadowFootprint {
    id: number;
    app: string;
    domain: string;
    category: string;
    risk: 'high' | 'low';
    users: number;
    status: string;
}

interface ShadowFootprintsProps {
    shadowFootprints: ShadowFootprint[];
}

const ITEMS_PER_PAGE = 5;

type SortField = 'app' | 'domain' | 'category' | 'risk' | 'users' | 'status';
type SortDir = 'asc' | 'desc';
type GroupField = 'none' | 'risk' | 'status' | 'category';

export default function ShadowFootprints({
    shadowFootprints,
}: ShadowFootprintsProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('app');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [groupField, setGroupField] = useState<GroupField>('none');

    // Filter, sort, group logic
    const processedData = useMemo(() => {
        let items = [...shadowFootprints];

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            items = items.filter(
                (item) =>
                    item.app.toLowerCase().includes(query) ||
                    item.domain.toLowerCase().includes(query) ||
                    item.category.toLowerCase().includes(query) ||
                    item.status.toLowerCase().includes(query),
            );
        }

        // Sort
        items.sort((a, b) => {
            let cmp = 0;

            switch (sortField) {
                case 'app':
                    cmp = a.app.localeCompare(b.app);
                    break;
                case 'domain':
                    cmp = a.domain.localeCompare(b.domain);
                    break;
                case 'category':
                    cmp = a.category.localeCompare(b.category);
                    break;
                case 'risk':
                    cmp = a.risk.localeCompare(b.risk);
                    break;
                case 'users':
                    cmp = a.users - b.users;
                    break;
                case 'status':
                    cmp = a.status.localeCompare(b.status);
                    break;
            }

            return sortDir === 'asc' ? cmp : -cmp;
        });

        return items;
    }, [shadowFootprints, searchQuery, sortField, sortDir]);

    // Group the processed items
    const groupedData = useMemo(() => {
        if (groupField === 'none') {
            return null;
        }

        const groups: Record<string, ShadowFootprint[]> = {};

        for (const item of processedData) {
            let key: string;

            switch (groupField) {
                case 'risk':
                    key = item.risk === 'high' ? 'HIGH RISK' : 'LOW RISK';
                    break;
                case 'status':
                    key = item.status;
                    break;
                case 'category':
                    key = item.category;
                    break;
                default:
                    key = 'Other';
            }

            if (!groups[key]) {
                groups[key] = [];
            }

            groups[key].push(item);
        }

        return groups;
    }, [processedData, groupField]);

    // Pagination
    const totalPages =
        groupField === 'none'
            ? Math.ceil(processedData.length / ITEMS_PER_PAGE)
            : 1;
    const currentData = useMemo(() => {
        if (groupField !== 'none') {
            return processedData;
        }

        const start = (currentPage - 1) * ITEMS_PER_PAGE;

        return processedData.slice(start, start + ITEMS_PER_PAGE);
    }, [processedData, currentPage, groupField]);

    function renderTableRows(items: ShadowFootprint[], isGrouped = false) {
        return items.map((row) => (
            <tr
                key={row.id}
                className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
            >
                <td className={`py-3.5 ${isGrouped ? 'w-[18%] pl-4' : ''}`}>
                    {row.app}
                </td>
                <td
                    className={`py-3.5 ${isGrouped ? 'w-[22%] truncate' : ''}`}
                >
                    {row.domain}
                </td>
                <td className={`py-3.5 ${isGrouped ? 'w-[16%]' : ''}`}>
                    {row.category}
                </td>
                <td className={`py-3.5 ${isGrouped ? 'w-[14%]' : ''}`}>
                    <span
                        className={`rounded px-2.5 py-0.5 text-[12px] font-bold ${
                            row.risk === 'high'
                                ? 'border border-[#ff4d4d] bg-[rgba(255,77,77,0.2)] text-[#ff4d4d]'
                                : 'border border-[#00ff66] bg-[rgba(0,255,102,0.2)] text-[#00ff66]'
                        }`}
                    >
                        {row.risk.toUpperCase()}
                    </span>
                </td>
                <td className={`py-3.5 ${isGrouped ? 'w-[12%]' : ''}`}>
                    {row.users}
                </td>
                <td className={`py-3.5 ${isGrouped ? 'w-[10%]' : ''}`}>
                    {row.status}
                </td>
                <td
                    className={`py-3.5 text-center ${isGrouped ? 'w-[8%] pr-4' : ''}`}
                >
                    <Link
                        href={`/policy-algorithm?highlight=${encodeURIComponent(row.domain)}`}
                    >
                        <button
                            className="cursor-pointer border-none bg-transparent text-muted-foreground transition-colors hover:text-able-green"
                            title="View in Policy"
                        >
                            <Eye size={16} />
                        </button>
                    </Link>
                </td>
            </tr>
        ));
    }

    function renderGroupedContent() {
        if (!groupedData) {
            return null;
        }

        const groupKeys = Object.keys(groupedData);

        if (groupKeys.length === 0) {
            return (
                <div className="py-10 text-center text-muted-foreground">
                    {searchQuery
                        ? 'No shadow footprints match your search.'
                        : 'No shadow footprints detected yet.'}
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-6">
                {groupKeys.map((groupKey) => {
                    const items = groupedData[groupKey];
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
                                    {items.length} {items.length === 1 ? 'Footprint' : 'Footprints'}
                                </span>
                            </div>

                            {/* Static Column Headers (Blends with Card Gradient Background) */}
                            <div className="border-b border-[rgba(34,197,94,0.3)] bg-transparent">
                                <table className="w-full table-fixed border-collapse text-left text-[0.9rem]">
                                    <thead>
                                        <tr className="text-muted-foreground">
                                            <th className="w-[18%] py-3 pl-4 font-medium">
                                                App Name
                                            </th>
                                            <th className="w-[22%] py-3 font-medium">
                                                Domain URL
                                            </th>
                                            <th className="w-[16%] py-3 font-medium">
                                                Category
                                            </th>
                                            <th className="w-[14%] py-3 font-medium">
                                                Risk Weight
                                            </th>
                                            <th className="w-[12%] py-3 font-medium">
                                                Active Users
                                            </th>
                                            <th className="w-[10%] py-3 font-medium">
                                                Status
                                            </th>
                                            <th className="w-[8%] py-3 pr-4 text-center font-medium">
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
                                <table className="w-full table-fixed border-collapse text-left text-[0.9rem]">
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
        if (currentData.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td
                            colSpan={7}
                            className="py-10 text-center text-muted-foreground"
                        >
                            {searchQuery
                                ? 'No shadow footprints match your search.'
                                : 'No shadow footprints detected yet.'}
                        </td>
                    </tr>
                </tbody>
            );
        }

        return <tbody>{renderTableRows(currentData)}</tbody>;
    }

    return (
        <>
            <Head title="Shadow Footprint Catalog" />
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header>
                    <Link href="/security-analytics">
                        <Button variant="ghost" className="mb-4 gap-2">
                            <ArrowLeft size={16} />
                            Back to Security Analytics
                        </Button>
                    </Link>
                    <h1
                        className="mb-3 text-[2.8rem] font-bold tracking-wide"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        SHADOW FOOTPRINT CATALOG
                    </h1>
                    <p className="max-w-[850px] text-[1.05rem] leading-relaxed text-muted-foreground">
                        Monitors and displays shadow application footprints
                        detected across the organization.
                    </p>
                </header>

                {/* Search + Sort + Group */}
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
                            <option value="app__asc">
                                Sort: App Name (A-Z)
                            </option>
                            <option value="app__desc">
                                Sort: App Name (Z-A)
                            </option>
                            <option value="domain__asc">
                                Sort: Domain (A-Z)
                            </option>
                            <option value="domain__desc">
                                Sort: Domain (Z-A)
                            </option>
                            <option value="category__asc">
                                Sort: Category (A-Z)
                            </option>
                            <option value="category__desc">
                                Sort: Category (Z-A)
                            </option>
                            <option value="risk__asc">
                                Sort: Risk (Low-High)
                            </option>
                            <option value="risk__desc">
                                Sort: Risk (High-Low)
                            </option>
                            <option value="users__asc">
                                Sort: Users (Low-High)
                            </option>
                            <option value="users__desc">
                                Sort: Users (High-Low)
                            </option>
                            <option value="status__asc">
                                Sort: Status (A-Z)
                            </option>
                            <option value="status__desc">
                                Sort: Status (Z-A)
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
                            onChange={(e) => {
                                setGroupField(e.target.value as GroupField);
                                setCurrentPage(1);
                            }}
                            className="cursor-pointer appearance-none rounded-full border border-black/10 bg-black/5 py-2.5 pr-8 pl-9 text-[0.85rem] text-foreground transition-all duration-200 outline-none hover:border-able-green/50 hover:bg-black/10 focus:border-able-green focus:ring-1 focus:ring-able-green/30 dark:border-white/10 dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-white/5"
                        >
                            <option value="none">Group: None</option>
                            <option value="risk">Group: Risk Weight</option>
                            <option value="status">Group: Status</option>
                            <option value="category">Group: Category</option>
                        </select>
                        <Layers
                            size={16}
                            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                        />
                    </div>
                </div>

                {/* Shadow Footprint Table */}
                <div className={`${glassCard} p-6`}>
                    {groupField !== 'none' ? (
                        renderGroupedContent()
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-[0.9rem]">
                                <thead>
                                    <tr>
                                        {[
                                            'App Name',
                                            'Domain URL',
                                            'Category',
                                            'Risk Weight',
                                            'Active Users',
                                            'Status',
                                            'Action',
                                        ].map((h) => (
                                            <th
                                                key={h}
                                                className={`pb-5 font-medium text-muted-foreground ${h === 'Action' ? 'text-center' : ''} border-b border-[rgba(34,197,94,0.7)]`}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                {renderUngroupedContent()}
                            </table>
                        </div>
                    )}

                    {/* Pagination (only when not grouped) */}
                    {groupField === 'none' && totalPages > 1 && (
                        <TablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

ShadowFootprints.layout = {
    breadcrumbs: [
        { title: 'Security Analytics', href: '/security-analytics' },
        {
            title: 'Shadow Footprint Catalog',
            href: '/security-analytics/shadow-footprints',
        },
    ],
};
