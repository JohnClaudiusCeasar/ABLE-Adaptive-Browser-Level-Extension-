import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TablePagination } from '@/components/pagination';

const glassCard =
    'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface NudgeEffectivenessRow {
    date: string;
    proceeded: number;
    cancelled: number;
}

interface NudgeEffectivenessProps {
    nudgeEffectiveness: NudgeEffectivenessRow[];
}

const ITEMS_PER_PAGE = 5;

export default function NudgeEffectiveness({
    nudgeEffectiveness,
}: NudgeEffectivenessProps) {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(nudgeEffectiveness.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentData = nudgeEffectiveness.slice(
        startIndex,
        startIndex + ITEMS_PER_PAGE,
    );

    return (
        <>
            <Head title="Nudge Effectiveness" />
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
                        className="mb-3 text-[2.6rem] font-bold tracking-wide"
                        style={{ fontFamily: "'Unbounded', sans-serif" }}
                    >
                        NUDGE EFFECTIVENESS
                    </h1>
                    <p className="max-w-[850px] text-base leading-relaxed text-muted-foreground">
                        Displays the full nudge effectiveness data with file
                        upload modal interactions.
                    </p>
                </header>

                {/* Nudge Effectiveness Table */}
                <div className={`${glassCard} p-6`}>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[0.9rem]">
                            <thead>
                                <tr>
                                    <th className="w-[35%] border-b border-[rgba(34,197,94,0.7)] pb-5 font-medium text-muted-foreground">
                                        Date
                                    </th>
                                    <th className="w-[20%] border-b border-[rgba(34,197,94,0.7)] pb-5 font-medium text-muted-foreground">
                                        Proceeded
                                    </th>
                                    <th className="w-[20%] border-b border-[rgba(34,197,94,0.7)] pb-5 font-medium text-muted-foreground">
                                        Cancelled
                                    </th>
                                    <th className="w-[25%] border-b border-[rgba(34,197,94,0.7)] pb-5 font-medium text-muted-foreground">
                                        Success
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentData.map((row, i) => {
                                    const total = row.proceeded + row.cancelled;
                                    const success =
                                        total > 0
                                            ? (
                                                  (row.proceeded / total) *
                                                  100
                                              ).toFixed(1) + '%'
                                            : '0%';

                                    return (
                                        <tr
                                            key={i}
                                            className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                        >
                                            <td className="py-3.5">
                                                {row.date}
                                            </td>
                                            <td className="py-3.5">
                                                {row.proceeded}
                                            </td>
                                            <td className="py-3.5">
                                                {row.cancelled}
                                            </td>
                                            <td className="py-3.5">
                                                <span
                                                    className={`inline-block rounded-[10px] px-2 py-0.5 text-[12px] font-bold ${
                                                        parseFloat(success) >=
                                                        50
                                                            ? 'bg-[#00ff66] text-[#15382e]'
                                                            : 'bg-[#f39c12] text-white'
                                                    }`}
                                                >
                                                    {success}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
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

NudgeEffectiveness.layout = {
    breadcrumbs: [
        { title: 'Security Analytics', href: '/security-analytics' },
        {
            title: 'Nudge Effectiveness',
            href: '/security-analytics/nudge-effectiveness',
        },
    ],
};
