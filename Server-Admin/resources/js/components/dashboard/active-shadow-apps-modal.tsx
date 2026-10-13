import { Ghost } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export interface ActiveShadowApp {
    id: number | null;
    domain: string;
    usage_count: number;
}

interface ActiveShadowAppsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    apps: ActiveShadowApp[];
}

export function ActiveShadowAppsModal({
    open,
    onOpenChange,
    apps,
}: ActiveShadowAppsModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl gap-6 border border-[rgba(34,197,94,0.4)] bg-background/95 backdrop-blur-xl sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Ghost size={18} className="text-[#a855f7]" />
                        Active Shadow Apps
                    </DialogTitle>
                    <DialogDescription>
                        Sites captured as Shadow Apps with more than 3
                        proceeded egress events.
                    </DialogDescription>
                </DialogHeader>

                {apps.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No active Shadow Apps recorded yet.
                    </p>
                ) : (
                    <div className="max-h-[55vh] overflow-y-auto">
                        <table className="w-full border-collapse text-[0.85rem]">
                            <thead>
                                <tr className="text-muted-foreground">
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-3 text-left font-medium">
                                        ID
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-3 text-left font-medium">
                                        Domain Name
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-3 text-right font-medium">
                                        Times Used
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {apps.map((app) => (
                                    <tr
                                        key={app.domain}
                                        className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                    >
                                        <td className="py-3 pr-2.5 tabular-nums text-muted-foreground">
                                            {app.id !== null ? `#${app.id}` : '—'}
                                        </td>
                                        <td className="py-3 pr-2.5 font-mono">
                                            {app.domain}
                                        </td>
                                        <td className="py-3 text-right tabular-nums">
                                            {app.usage_count.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <p className="text-xs text-muted-foreground">
                    {apps.length} active Shadow {apps.length === 1 ? 'App' : 'Apps'}
                </p>
            </DialogContent>
        </Dialog>
    );
}
