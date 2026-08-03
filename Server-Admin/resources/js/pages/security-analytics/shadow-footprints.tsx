import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Eye, Search, ArrowUpDown, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

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

const groupLabels: Record<string, string> = {
    high: 'HIGH RISK',
    low: 'LOW RISK',
    Approved: 'APPROVED',
    Unapproved: 'UNAPPROVED',
    Pending: 'PENDING',
};

export default function ShadowFootprints({ shadowFootprints }: ShadowFootprintsProps) {
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
                    item.status.toLowerCase().includes(query)
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
        if (groupField === 'none') return null;

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
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        }
        return groups;
    }, [processedData, groupField]);

    // Pagination
    const totalPages = groupField === 'none' ? Math.ceil(processedData.length / ITEMS_PER_PAGE) : 1;
    const currentData = useMemo(() => {
        if (groupField !== 'none') return processedData;
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return processedData.slice(start, start + ITEMS_PER_PAGE);
    }, [processedData, currentPage, groupField]);

    function toggleSort(field: SortField) {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    }

    function renderTableRows(items: ShadowFootprint[]) {
        return items.map((row) => (
            <tr key={row.id} className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0">
                <td className="py-3.5">{row.app}</td>
                <td className="py-3.5">{row.domain}</td>
                <td className="py-3.5">{row.category}</td>
                <td className="py-3.5">
                    <span className={`px-2.5 py-0.5 rounded text-[12px] font-bold ${
                        row.risk === 'high'
                            ? 'bg-[rgba(255,77,77,0.2)] text-[#ff4d4d] border border-[#ff4d4d]'
                            : 'bg-[rgba(0,255,102,0.2)] text-[#00ff66] border border-[#00ff66]'
                    }`}>{row.risk.toUpperCase()}</span>
                </td>
                <td className="py-3.5">{row.users}</td>
                <td className="py-3.5">{row.status}</td>
                <td className="py-3.5 text-center">
                    <Link href={`/policy-algorithm`}>
                        <button className="text-muted-foreground hover:text-able-green transition-colors bg-transparent border-none cursor-pointer">
                            <Eye size={16} />
                        </button>
                    </Link>
                </td>
            </tr>
        ));
    }

    function renderGroupedContent() {
        if (!groupedData) return null;

        const groupKeys = Object.keys(groupedData);
        if (groupKeys.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                            {searchQuery ? 'No shadow footprints match your search.' : 'No shadow footprints detected yet.'}
                        </td>
                    </tr>
                </tbody>
            );
        }

        return groupKeys.map((groupKey) => (
            <tbody key={groupKey}>
                <tr className="bg-[rgba(34,197,94,0.05)]">
                    <td colSpan={7} className="py-2 px-4 text-sm font-semibold text-able-green uppercase tracking-wider">
                        {groupKey} ({groupedData[groupKey].length})
                    </td>
                </tr>
                {renderTableRows(groupedData[groupKey])}
            </tbody>
        ));
    }

    function renderUngroupedContent() {
        if (currentData.length === 0) {
            return (
                <tbody>
                    <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                            {searchQuery ? 'No shadow footprints match your search.' : 'No shadow footprints detected yet.'}
                        </td>
                    </tr>
                </tbody>
            );
        }

        return (
            <tbody>
                {renderTableRows(currentData)}
            </tbody>
        );
    }

    return (
        <>
            <Head title="Shadow Footprint Catalog" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px] flex flex-col gap-6">

                {/* Header */}
                <header>
                    <Link href="/security-analytics">
                        <Button variant="ghost" className="mb-4 gap-2">
                            <ArrowLeft size={16} />
                            Back to Security Analytics
                        </Button>
                    </Link>
                    <h1
                        className="text-[2.6rem] font-bold tracking-wide mb-3"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        SHADOW FOOTPRINT CATALOG
                    </h1>
                    <p className="text-base text-muted-foreground max-w-[850px] leading-relaxed">
                        Monitors and displays shadow application footprints detected across the organization.
                    </p>
                </header>

                {/* Search + Sort + Group */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative w-[260px]">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full py-2.5 pl-11 pr-3.5 bg-black/5 border border-black/10 rounded-full text-foreground text-[0.9rem] outline-none placeholder:text-muted-foreground dark:bg-[rgba(15,23,42,0.4)] dark:border-white/10"
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
                            className="appearance-none py-2.5 pl-9 pr-8 bg-black/5 border border-black/10 rounded-full text-foreground text-[0.85rem] outline-none cursor-pointer dark:bg-[rgba(15,23,42,0.4)] dark:border-white/10 hover:border-able-green/50 hover:bg-black/10 dark:hover:bg-white/5 focus:border-able-green focus:ring-1 focus:ring-able-green/30 transition-all duration-200"
                        >
                            <option value="app__asc">Sort: App Name (A-Z)</option>
                            <option value="app__desc">Sort: App Name (Z-A)</option>
                            <option value="domain__asc">Sort: Domain (A-Z)</option>
                            <option value="domain__desc">Sort: Domain (Z-A)</option>
                            <option value="category__asc">Sort: Category (A-Z)</option>
                            <option value="category__desc">Sort: Category (Z-A)</option>
                            <option value="risk__asc">Sort: Risk (Low-High)</option>
                            <option value="risk__desc">Sort: Risk (High-Low)</option>
                            <option value="users__asc">Sort: Users (Low-High)</option>
                            <option value="users__desc">Sort: Users (High-Low)</option>
                            <option value="status__asc">Sort: Status (A-Z)</option>
                            <option value="status__desc">Sort: Status (Z-A)</option>
                        </select>
                        <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Group Dropdown */}
                    <div className="relative">
                        <select
                            value={groupField}
                            onChange={(e) => {
                                setGroupField(e.target.value as GroupField);
                                setCurrentPage(1);
                            }}
                            className="appearance-none py-2.5 pl-9 pr-8 bg-black/5 border border-black/10 rounded-full text-foreground text-[0.85rem] outline-none cursor-pointer dark:bg-[rgba(15,23,42,0.4)] dark:border-white/10 hover:border-able-green/50 hover:bg-black/10 dark:hover:bg-white/5 focus:border-able-green focus:ring-1 focus:ring-able-green/30 transition-all duration-200"
                        >
                            <option value="none">Group: None</option>
                            <option value="risk">Group: Risk Weight</option>
                            <option value="status">Group: Status</option>
                            <option value="category">Group: Category</option>
                        </select>
                        <Layers size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                </div>

                {/* Shadow Footprint Table */}
                <div className={`${glassCard} p-6`}>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[0.9rem] text-left">
                            <thead>
                                <tr>
                                    {['App Name', 'Domain URL', 'Category', 'Risk Weight', 'Active Users', 'Status', 'Action'].map((h) => (
                                        <th key={h} className={`pb-5 text-muted-foreground font-medium ${h === 'Action' ? 'text-center' : ''} border-b border-[rgba(34,197,94,0.7)]`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            {groupField !== 'none' ? renderGroupedContent() : renderUngroupedContent()}
                        </table>
                    </div>

                    {/* Pagination (only when not grouped) */}
                    {groupField === 'none' && totalPages > 1 && (
                        <div className="flex justify-end items-center gap-3 mt-6 text-[0.95rem]">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="text-muted-foreground font-bold px-2 disabled:opacity-50 cursor-pointer"
                            >
                                &lt;
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-7 h-7 flex items-center justify-center rounded-full font-bold cursor-pointer ${
                                        currentPage === page
                                            ? 'bg-able-green text-white'
                                            : 'hover:bg-black/5 dark:hover:bg-white/10'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="text-muted-foreground font-bold px-2 disabled:opacity-50 cursor-pointer"
                            >
                                &gt;
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}

ShadowFootprints.layout = {
    breadcrumbs: [
        { title: 'Security Analytics', href: '/security-analytics' },
        { title: 'Shadow Footprint Catalog', href: '/security-analytics/shadow-footprints' },
    ],
};
