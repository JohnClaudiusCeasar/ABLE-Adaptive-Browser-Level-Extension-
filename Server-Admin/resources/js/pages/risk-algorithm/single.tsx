import { Head, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { TablePagination } from '@/components/pagination';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface CriteriaPatternItem {
    id: number;
    title: string;
    regex: string;
    score: number;
    sub_items?: CriteriaPatternItem[];
}

interface RiskPattern {
    id: number;
    title: string;
    type: 'single' | 'criteria';
    regex: string | null;
    priority: 'low' | 'medium' | 'high';
    score: number;
    criteria_pattern_items: CriteriaPatternItem[];
    created_at: string;
    updated_at: string;
}

interface PageProps {
    riskPatterns: RiskPattern[];
    criteriaPatterns: RiskPattern[];
    flagCounts: Record<string, number>;
    [key: string]: unknown;
}

const ROWS_PER_PAGE = 5;

// Word-capped display text so long values don't inflate table cells; the
// full text stays available via the cell's title tooltip.
function truncateWords(text: string | null, maxWords: number): string {
    if (!text) {
        return '';
    }

    const words = text.split(/\s+/).filter(Boolean);

    if (words.length <= maxWords) {
        return text;
    }

    return `${words.slice(0, maxWords).join(' ')}…`;
}

export default function SinglePatternConfiguration() {
    const { riskPatterns, flagCounts } = usePage<PageProps>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // Filter patterns
    const filteredPatterns = useMemo(() => {
        if (!searchQuery) {
            return riskPatterns;
        }

        return riskPatterns.filter(
            (p) =>
                p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.regex &&
                    p.regex.toLowerCase().includes(searchQuery.toLowerCase())),
        );
    }, [riskPatterns, searchQuery]);

    // Pagination for single patterns
    const totalPages = Math.max(
        1,
        Math.ceil(filteredPatterns.length / ROWS_PER_PAGE),
    );
    const paginatedPatterns = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;

        return filteredPatterns.slice(start, start + ROWS_PER_PAGE);
    }, [filteredPatterns, currentPage]);

    return (
        <>
            <Head title="All Patterns" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">
                {/* Header */}
                <header className="mb-8">
                    <h1
                        className="mb-3 text-[2.6rem] font-bold tracking-wide text-foreground"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        SINGLE PATTERN CONFIGURATION
                    </h1>
                    <p className="mb-6 max-w-[800px] text-[0.95rem] leading-relaxed text-muted-foreground">
                        Risk Score Algorithm Management for Javascript Regex
                        Configuration. Helps ABLE determine and flag certain key
                        words for DOM file scanning.
                    </p>
                    <div className="relative w-[300px]">
                        <Search
                            size={16}
                            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                        />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-full border border-black/10 bg-black/5 py-2 pr-3 pl-10 text-[0.9rem] text-foreground outline-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-[rgba(20,32,38,0.4)]"
                        />
                    </div>
                </header>

                {/* Data Card */}
                <div className={`${glassCard} p-6`}>
                    <div className="mb-6">
                        <h2
                            className="text-[1.6rem] font-bold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Data Classification
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-separate border-spacing-0 text-left">
                            <thead>
                                <tr>
                                    {[
                                        'Pattern Name',
                                        'Regex Pattern',
                                        'Score',
                                        'Priority',
                                        'Flagged',
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            className="border-b border-[rgba(34,197,94,0.7)] px-4 py-3 text-[0.9rem] font-normal text-muted-foreground"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedPatterns.map((pattern) => (
                                    <tr
                                        key={pattern.id}
                                        className="transition-colors hover:bg-[rgba(34,197,94,0.04)] dark:hover:bg-[rgba(34,197,94,0.08)]"
                                    >
                                        <td
                                            className="max-w-[220px] truncate border-b border-black/10 px-4 py-5 font-semibold dark:border-[#2e434d]"
                                            title={pattern.title}
                                        >
                                            {truncateWords(pattern.title, 15)}
                                        </td>
                                        <td
                                            className="max-w-[280px] truncate border-b border-black/10 px-4 py-5 font-mono text-muted-foreground dark:border-[#2e434d]"
                                            title={pattern.regex ?? ''}
                                        >
                                            {truncateWords(pattern.regex, 30)}
                                        </td>
                                        <td className="border-b border-black/10 px-4 py-5 dark:border-[#2e434d]">
                                            {pattern.score}
                                        </td>
                                        <td className="border-b border-black/10 px-4 py-5 dark:border-[#2e434d]">
                                            <span
                                                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                                    pattern.priority === 'high'
                                                        ? 'bg-[rgba(248,113,113,0.2)] text-[#f87171]'
                                                        : pattern.priority ===
                                                            'medium'
                                                          ? 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]'
                                                          : 'bg-[rgba(34,197,94,0.2)] text-[#22c55e]'
                                                }`}
                                            >
                                                {pattern.priority === 'high'
                                                    ? 'High'
                                                    : pattern.priority ===
                                                        'medium'
                                                      ? 'Medium'
                                                      : 'Low'}
                                            </span>
                                        </td>
                                        <td className="border-b border-black/10 px-4 py-5 text-sm text-muted-foreground dark:border-[#2e434d]">
                                            {flagCounts[pattern.title] ?? 0}
                                        </td>
                                    </tr>
                                ))}

                                {/* Empty State */}
                                {riskPatterns.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="py-10 text-center text-muted-foreground"
                                        >
                                            {searchQuery
                                                ? 'No patterns match your search.'
                                                : 'No risk patterns found.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>


                    {/* Pagination */}
                    {filteredPatterns.length > ROWS_PER_PAGE && (
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

SinglePatternConfiguration.layout = {
    breadcrumbs: [
        { title: 'Risk Algorithm', href: '/risk-algorithm/criteria' },
        {
            title: 'All Patterns',
            href: '/risk-algorithm/single',
        },
    ],
};
