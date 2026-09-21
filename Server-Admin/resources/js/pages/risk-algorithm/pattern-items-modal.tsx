import { Fragment } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import type { RiskPattern } from './criteria';

interface PatternItemsModalProps {
    pattern: RiskPattern;
    trigger: React.ReactNode;
}

export function PatternItemsModal({
    pattern,
    trigger,
}: PatternItemsModalProps) {
    const hasRequired = pattern.criteria_pattern_items?.some(
        (item) => (item.operator || 'and') === 'and',
    );
    const hasFlexible = pattern.criteria_pattern_items?.some(
        (item) => item.operator === 'or',
    );

    const badgeLabel =
        hasRequired && hasFlexible
            ? 'Mixed Rules'
            : hasFlexible
              ? 'All Flexible (OR)'
              : 'All Required (AND)';

    const badgeClass =
        hasRequired && hasFlexible
            ? 'border border-[#a855f7]/30 bg-[rgba(168,85,247,0.15)] text-[#a855f7]'
            : hasFlexible
              ? 'border border-[#36cfc9]/30 bg-[rgba(54,207,201,0.15)] text-[#36cfc9]'
              : 'border border-able-green/30 bg-[rgba(34,197,94,0.15)] text-able-green';

    return (
        <Dialog>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="flex flex-col gap-1 pr-6 sm:flex-row sm:items-center sm:justify-between">
                        <DialogTitle>{pattern.title}</DialogTitle>
                        <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
                        >
                            {badgeLabel}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Required items must all be present. Flexible items trigger if any one or more match.
                    </p>
                </DialogHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[rgba(56,193,73,0.3)]">
                                <th className="px-4 py-2.5 text-left font-semibold text-foreground">
                                    Pattern Name
                                </th>
                                <th className="w-28 px-4 py-2.5 text-left font-semibold text-foreground">
                                    Requirement
                                </th>
                                <th className="w-24 px-4 py-2.5 text-left font-semibold text-foreground">
                                    Risk Score
                                </th>
                                <th className="w-28 px-4 py-2.5 text-left font-semibold text-foreground">
                                    Risk Weight
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pattern.criteria_pattern_items.map((item) => (
                                <Fragment key={item.id}>
                                    <tr className="border-b border-[rgba(56,193,73,0.1)] transition-colors hover:bg-[rgba(56,193,73,0.05)]">
                                        <td className="max-w-[240px] truncate px-4 py-2.5 font-medium text-foreground">
                                            {item.title}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                    (item.operator || 'and') === 'and'
                                                        ? 'bg-[rgba(34,197,94,0.15)] text-able-green'
                                                        : 'bg-[rgba(54,207,201,0.15)] text-[#36cfc9]'
                                                }`}
                                            >
                                                {(item.operator || 'and') === 'and'
                                                    ? 'Required'
                                                    : 'Flexible'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-muted-foreground">
                                            {item.score}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                    (item.risk_weight ||
                                                        'medium') === 'high'
                                                        ? 'bg-[rgba(248,113,113,0.2)] text-[#f87171]'
                                                        : (item.risk_weight ||
                                                                'medium') ===
                                                            'medium'
                                                          ? 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]'
                                                          : 'bg-[rgba(34,197,94,0.2)] text-[#22c55e]'
                                                }`}
                                            >
                                                {(item.risk_weight ||
                                                    'medium') === 'high'
                                                    ? 'High'
                                                    : (item.risk_weight ||
                                                            'medium') ===
                                                        'medium'
                                                      ? 'Medium'
                                                      : 'Low'}
                                            </span>
                                        </td>
                                    </tr>
                                    {/* Nested Sub-items if any */}
                                    {item.sub_items &&
                                        item.sub_items.map((subItem) => (
                                            <tr
                                                key={subItem.id}
                                                className="border-b border-[rgba(56,193,73,0.05)] bg-black/[0.02] transition-colors hover:bg-[rgba(56,193,73,0.05)] dark:bg-white/[0.02]"
                                            >
                                                <td className="max-w-[240px] truncate px-4 py-2 pl-8 text-xs font-medium text-foreground">
                                                    ↳ {subItem.title}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                            (subItem.operator || 'and') === 'and'
                                                                ? 'bg-[rgba(34,197,94,0.15)] text-able-green'
                                                                : 'bg-[rgba(54,207,201,0.15)] text-[#36cfc9]'
                                                        }`}
                                                    >
                                                        {(subItem.operator || 'and') === 'and'
                                                            ? 'Required'
                                                            : 'Flexible'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-xs text-muted-foreground">
                                                    {subItem.score}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                            (subItem.risk_weight ||
                                                                'medium') ===
                                                            'high'
                                                                ? 'bg-[rgba(248,113,113,0.2)] text-[#f87171]'
                                                                : (subItem.risk_weight ||
                                                                        'medium') ===
                                                                    'medium'
                                                                  ? 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]'
                                                                  : 'bg-[rgba(34,197,94,0.2)] text-[#22c55e]'
                                                        }`}
                                                    >
                                                        {(subItem.risk_weight ||
                                                            'medium') === 'high'
                                                            ? 'High'
                                                            : (subItem.risk_weight ||
                                                                    'medium') ===
                                                                'medium'
                                                              ? 'Medium'
                                                              : 'Low'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                </Fragment>
                            ))}
                            {pattern.criteria_pattern_items.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
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
