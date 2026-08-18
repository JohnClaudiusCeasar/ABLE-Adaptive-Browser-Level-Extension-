import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

interface NudgeEffectivenessRow {
    date: string;
    proceeded: number;
    cancelled: number;
}

interface NudgeEffectivenessProps {
    nudgeEffectiveness: NudgeEffectivenessRow[];
}

const ITEMS_PER_PAGE = 5;

export default function NudgeEffectiveness({ nudgeEffectiveness }: NudgeEffectivenessProps) {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(nudgeEffectiveness.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentData = nudgeEffectiveness.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <>
            <Head title="Nudge Effectiveness" />
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
                        NUDGE EFFECTIVENESS
                    </h1>
                    <p className="text-base text-muted-foreground max-w-[850px] leading-relaxed">
                        Displays the full nudge effectiveness data with file upload modal interactions.
                    </p>
                </header>

                {/* Nudge Effectiveness Table */}
                <div className={`${glassCard} p-6`}>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[0.9rem] text-left">
                            <thead>
                                <tr>
                                    <th className="pb-5 text-muted-foreground font-medium border-b border-[rgba(34,197,94,0.7)] w-[35%]">Date</th>
                                    <th className="pb-5 text-muted-foreground font-medium border-b border-[rgba(34,197,94,0.7)] w-[20%]">Proceeded</th>
                                    <th className="pb-5 text-muted-foreground font-medium border-b border-[rgba(34,197,94,0.7)] w-[20%]">Cancelled</th>
                                    <th className="pb-5 text-muted-foreground font-medium border-b border-[rgba(34,197,94,0.7)] w-[25%]">Success</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentData.map((row, i) => {
                                    const total = row.proceeded + row.cancelled;
                                    const success = total > 0 ? ((row.proceeded / total) * 100).toFixed(1) + '%' : '0%';

                                    return (
                                        <tr key={i} className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0">
                                            <td className="py-3.5">{row.date}</td>
                                            <td className="py-3.5">{row.proceeded}</td>
                                            <td className="py-3.5">{row.cancelled}</td>
                                            <td className="py-3.5">
                                                <span className={`px-2 py-0.5 rounded-[10px] text-[12px] font-bold inline-block ${
                                                    parseFloat(success) >= 50 ? 'bg-[#00ff66] text-[#15382e]' : 'bg-[#f39c12] text-white'
                                                }`}>{success}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
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
                </div>

            </div>
        </>
    );
}

NudgeEffectiveness.layout = {
    breadcrumbs: [
        { title: 'Security Analytics', href: '/security-analytics' },
        { title: 'Nudge Effectiveness', href: '/security-analytics/nudge-effectiveness' },
    ],
};
