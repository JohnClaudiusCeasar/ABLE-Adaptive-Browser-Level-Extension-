import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { RiskPattern, CriteriaPatternItem } from './criteria';

interface PatternItemsModalProps {
    pattern: RiskPattern;
    trigger: React.ReactNode;
}

export function PatternItemsModal({ pattern, trigger }: PatternItemsModalProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{pattern.title}</DialogTitle>
                </DialogHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[rgba(56,193,73,0.3)]">
                                <th className="px-4 py-2.5 text-left font-semibold text-foreground">
                                    Pattern Name
                                </th>
                                <th className="w-28 px-4 py-2.5 text-left font-semibold text-foreground">
                                    Risk Score
                                </th>
                                <th className="w-28 px-4 py-2.5 text-left font-semibold text-foreground">
                                    Risk Weight
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pattern.criteria_pattern_items.map((item) => (
                                <tr
                                    key={item.id}
                                    className="border-b border-[rgba(56,193,73,0.1)] transition-colors hover:bg-[rgba(56,193,73,0.05)]"
                                >
                                    <td className="max-w-[240px] truncate px-4 py-2.5 font-medium text-foreground">
                                        {item.title}
                                    </td>
                                    <td className="px-4 py-2.5 text-muted-foreground">
                                        {item.score}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                (item.risk_weight || 'medium') === 'high'
                                                    ? 'bg-[rgba(248,113,113,0.2)] text-[#f87171]'
                                                    : (item.risk_weight || 'medium') === 'medium'
                                                      ? 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]'
                                                      : 'bg-[rgba(34,197,94,0.2)] text-[#22c55e]'
                                            }`}
                                        >
                                            {(item.risk_weight || 'medium') === 'high'
                                                ? 'High'
                                                : (item.risk_weight || 'medium') === 'medium'
                                                  ? 'Medium'
                                                  : 'Low'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {pattern.criteria_pattern_items.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="py-6 text-center text-muted-foreground"
                                    >
                                        No pattern items found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
