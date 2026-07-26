import { Head } from '@inertiajs/react';
import { Search } from 'lucide-react';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

const domains = [
    { name: 'lms.msu.edu.ph', type: 'Whitelisted', category: '95', risk: '0', status: 'safe' },
    { name: 'msu.edu.ph', type: 'Whitelisted', category: '72', risk: '0', status: 'safe' },
    { name: 'ChatGPT', type: 'Blacklisted', category: '85', risk: '85', status: 'blocked' },
    { name: 'Mega', type: 'Blacklisted', category: '85', risk: '70', status: 'blocked' },
    { name: 'notion.so', type: 'Under Review', category: '98', risk: '35', status: 'review' },
];

const statusStyles: Record<string, string> = {
    safe: 'text-[#4ade80] font-semibold',
    blocked: 'text-[#f87171] font-semibold',
    review: 'text-[#fbbf24] font-semibold',
};

const statusLabels: Record<string, string> = {
    safe: 'Safe',
    blocked: 'Blocked',
    review: 'Review',
};

export default function PolicyAlgorithm() {
    return (
        <>
            <Head title="Policy Algorithm" />
            <div className="mx-auto w-full max-w-[1100px] px-8 pt-12 pb-[22px]">

                    {/* Header */}
                    <header className="mb-8">
                        <h1
                            className="text-[2.5rem] font-medium tracking-wide mb-2 text-foreground"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            POLICY ALGORITHM
                        </h1>
                        <p className="text-base text-muted-foreground mb-6">
                            Domain Management for website security checking.
                        </p>
                        <div className="relative w-[300px]">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search"
                                className="w-full py-2.5 pl-11 pr-3.5 bg-black/5 border border-black/10 rounded-full text-foreground text-[0.9rem] outline-none placeholder:text-muted-foreground dark:bg-[rgba(15,23,42,0.4)] dark:border-white/10"
                            />
                        </div>
                    </header>

                    {/* Data Card */}
                    <div className={`${glassCard} px-8 py-7`}>
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-[1.6rem] font-medium" style={{ fontFamily: "'Unbounded', sans-serif" }}>Domain Policy</h2>
                            <button className="bg-able-green text-white px-5 py-2 rounded-lg font-semibold text-[0.9rem] border-none hover:bg-[#1a9e4b] transition-colors active:scale-[0.98]">
                                + Add Domain
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-[0.95rem]">
                                <thead>
                                    <tr>
                                        {['Domain Name', 'Type', 'Category', 'Risk Weight', 'Status'].map((h) => (
                                            <th key={h} className="text-muted-foreground font-normal py-3 px-4 border-b border-[rgba(34,197,94,0.7)]">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {domains.map((d, i) => (
                                        <tr key={i} className="border-b border-black/10 last:border-b-0 dark:border-white/10">
                                            <td className="py-5 px-4 font-semibold">{d.name}</td>
                                            <td className="py-5 px-4 text-muted-foreground">{d.type}</td>
                                            <td className="py-5 px-4">{d.category}</td>
                                            <td className={`py-5 px-4 ${parseInt(d.risk) > 0 ? 'text-[#f87171] font-semibold' : 'text-muted-foreground'}`}>{d.risk}</td>
                                            <td className={`py-5 px-4 text-[0.85rem] ${statusStyles[d.status]}`}>{statusLabels[d.status]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-end mt-8 items-center gap-3 text-[0.95rem] text-muted-foreground">
                            <span className="w-[26px] h-[26px] flex items-center justify-center rounded-full bg-able-green text-white font-semibold cursor-pointer">1</span>
                            <span className="w-[26px] h-[26px] flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:text-white">2</span>
                            <span className="w-[26px] h-[26px] flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:text-white">3</span>
                            <span className="w-[26px] h-[26px] flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:text-white">4</span>
                            <span className="cursor-default">...</span>
                            <span className="cursor-pointer font-bold hover:bg-black/5 dark:hover:text-white">&gt;</span>
                        </div>
                    </div>

                </div>
        </>
    );
}

PolicyAlgorithm.layout = {
    breadcrumbs: [{ title: 'Policy Algorithm', href: '/policy-algorithm' }],
};
