import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

const glassCard = 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.4)] rounded-lg backdrop-blur-[10px] shadow-sm dark:bg-white/5 dark:border-[rgba(34,197,94,0.7)] dark:shadow-none';

export default function ShadowFootprints() {
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

                {/* Shadow Footprint Table */}
                <div className={`${glassCard} p-6`}>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[0.9rem] text-left">
                            <thead>
                                <tr>
                                    {['App Name', 'Domain URL', 'Category', 'Risk Weight', 'Active Users', 'Status', 'Action'].map((h) => (
                                        <th key={h} className={`pb-3 text-muted-foreground font-medium ${h === 'Action' ? 'text-center' : ''} border-b border-[rgba(34,197,94,0.7)]`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { app: 'ChatGPT', domain: 'chat.open.ai', cat: 'Gen AI', risk: 'high', users: 149, status: 'Unapproved' },
                                    { app: 'Notion', domain: 'notion.so', cat: 'Productivity', risk: 'low', users: 89, status: 'Pending' },
                                    { app: 'Github', domain: 'github.com', cat: 'Develop...', risk: 'low', users: 110, status: 'Approved' },
                                    { app: 'Quillbot', domain: 'quillbot.com', cat: 'Productivity', risk: 'low', users: 98, status: 'Approved' },
                                ].map((row, i) => (
                                    <tr key={i} className="border-b border-black/10 last:border-b-0 dark:border-white/10">
                                        <td className="py-3.5">{row.app}</td>
                                        <td className="py-3.5">{row.domain}</td>
                                        <td className="py-3.5">{row.cat}</td>
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
                                            <button className="text-muted-foreground hover:text-able-green transition-colors bg-transparent border-none cursor-pointer">
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end items-center gap-2.5 mt-5 text-[0.85rem]">
                        <span className="w-[22px] h-[22px] flex items-center justify-center rounded-full bg-able-green text-white font-bold">1</span>
                        <span className="w-[22px] h-[22px] flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">2</span>
                        <span className="w-[22px] h-[22px] flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">3</span>
                        <span className="w-[22px] h-[22px] flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">4</span>
                        <span className="text-muted-foreground">...</span>
                        <span className="text-muted-foreground cursor-pointer font-bold">&gt;</span>
                    </div>
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
