import { Head } from '@inertiajs/react';
import { ChevronDown, Pencil, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

const groupedPatterns = [
    { name: 'Student ID Format', regex: '^\\d{2}-\\d{4}-\\d{3}$', score: '95' },
    { name: 'University Email', regex: '^[a-zA-Z0-9._%+-]+@...', score: '72' },
    { name: 'Phone Number', regex: '^(\\+63|0)[0-9]{9,10}$', score: '85' },
    { name: 'Research Data', regex: '(proprietary|confidentia...', score: '85' },
];

const standardPatterns = [
    { name: 'Credit Card', regex: '^(?:4[0-9]{12}(?:[0-9...', score: '98' },
];

export default function RiskAlgorithm() {
    const [groupOpen, setGroupOpen] = useState(true);

    return (
        <>
            <Head title="Risk Algorithm" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">

                    {/* Header */}
                    <header className="mb-8">
                        <h1
                            className="text-[2.5rem] font-medium tracking-wide mb-3 text-foreground"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            RISK ALGORITHM
                        </h1>
                        <p className="text-[0.95rem] text-muted-foreground leading-relaxed max-w-[800px] mb-6">
                            Risk Score Algorithm Management for Javascript Regex Configuration. Helps ABLE determine and flag certain key words for DOM file scanning.
                        </p>
                        <div className="relative w-[300px]">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search"
                                className="w-full py-2 pl-10 pr-3 bg-black/5 border border-black/10 rounded-full text-foreground text-[0.9rem] outline-none placeholder:text-muted-foreground dark:bg-[rgba(20,32,38,0.4)] dark:border-white/10"
                            />
                        </div>
                    </header>

                    {/* Data Card */}
                    <div className={`${glassCard} p-6`}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-[1.5rem] font-medium" style={{ fontFamily: "'Unbounded', sans-serif" }}>Data Classification</h2>
                            <button className="bg-transparent border-2 border-able-green text-able-green px-4 py-1.5 rounded-md font-semibold text-[0.85rem] hover:bg-able-green hover:text-white transition-all">
                                + Add Pattern
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-separate border-spacing-0 text-left">
                                <thead>
                                    <tr>
                                        {['Pattern Name', 'Regex Pattern', 'Score', 'Status', 'Action'].map((h) => (
                                            <th key={h} className="text-muted-foreground font-normal text-[0.9rem] py-3 px-4 border-b border-[rgba(34,197,94,0.7)]">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Group Header */}
                                    <tr>
                                        <td colSpan={5} className="pt-3.5 pb-1.5 px-0">
                                            <div
                                                className="bg-[#38c149] flex justify-between items-center py-3 px-4 rounded-t-lg cursor-pointer"
                                                onClick={() => setGroupOpen(!groupOpen)}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-semibold">University Data</span>
                                                    <span className="text-[12px] opacity-90">+4 Items</span>
                                                </div>
                                                <ChevronDown size={16} className={`transition-transform ${groupOpen ? 'rotate-0' : '-rotate-90'}`} />
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Grouped Rows */}
                                    {groupOpen && groupedPatterns.map((p, i) => (
                                        <tr key={i} className="bg-[rgba(56,193,73,0.1)]">
                                            <td className="py-3.5 px-4 font-semibold border-t border-[rgba(56,193,73,0.2)] border-b border-b-[rgba(56,193,73,0.2)] border-l-2 border-l-[#38c149]">
                                                {p.name}
                                            </td>
                                            <td className="py-3.5 px-4 font-mono text-muted-foreground border-t border-[rgba(56,193,73,0.2)] border-b border-b-[rgba(56,193,73,0.2)]">
                                                {p.regex}
                                            </td>
                                            <td className="py-3.5 px-4 border-t border-[rgba(56,193,73,0.2)] border-b border-b-[rgba(56,193,73,0.2)]">
                                                {p.score}
                                            </td>
                                            <td className="py-3.5 px-4 border-t border-[rgba(56,193,73,0.2)] border-b border-b-[rgba(56,193,73,0.2)]">Active</td>
                                            <td className="py-3.5 px-4 border-t border-[rgba(56,193,73,0.2)] border-b border-b-[rgba(56,193,73,0.2)] border-r-2 border-r-[#38c149]">
                                                <div className="flex gap-3">
                                                    <button className="bg-transparent border-none cursor-pointer p-0"><Pencil size={18} className="text-[#52c41a]" /></button>
                                                    <button className="bg-transparent border-none cursor-pointer p-0"><Trash2 size={18} className="text-[#52c41a] opacity-70" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Last grouped row gets rounded bottom border */}
                                    {groupOpen && (
                                        <tr>
                                            <td colSpan={5} className="p-0">
                                                <div className="border-b-2 border-b-[#38c149] border-l-2 border-l-[#38c149] border-r-2 border-r-[#38c149] rounded-b-lg bg-transparent h-0" />
                                            </td>
                                        </tr>
                                    )}

                                    {/* Standard Rows */}
                                    {standardPatterns.map((p, i) => (
                                        <tr key={i}>
                                            <td className="py-5 px-4 font-semibold border-b border-black/10 dark:border-[#2e434d]">{p.name}</td>
                                            <td className="py-5 px-4 font-mono text-muted-foreground border-b border-black/10 dark:border-[#2e434d]">{p.regex}</td>
                                            <td className="py-5 px-4 border-b border-black/10 dark:border-[#2e434d]">{p.score}</td>
                                            <td className="py-5 px-4 border-b border-black/10 dark:border-[#2e434d]">Active</td>
                                            <td className="py-5 px-4 border-b border-black/10 dark:border-[#2e434d]">
                                                <div className="flex gap-3">
                                                    <button className="bg-transparent border-none cursor-pointer p-0"><Pencil size={18} className="text-[#36cfc9]" /></button>
                                                    <button className="bg-transparent border-none cursor-pointer p-0"><Trash2 size={18} className="text-muted-foreground" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-end mt-6 items-center gap-3 text-[0.9rem] text-muted-foreground">
                            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-able-green text-white font-semibold cursor-pointer">1</span>
                            <span className="w-6 h-6 flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:text-white">2</span>
                            <span className="w-6 h-6 flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:text-white">3</span>
                            <span className="w-6 h-6 flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:text-white">4</span>
                            <span className="cursor-default">...</span>
                            <span className="cursor-pointer font-semibold hover:bg-black/5 dark:hover:text-white">&gt;</span>
                        </div>
                    </div>

                </div>
        </>
    );
}

RiskAlgorithm.layout = {
    breadcrumbs: [{ title: 'Risk Algorithm', href: '/risk-algorithm' }],
};
