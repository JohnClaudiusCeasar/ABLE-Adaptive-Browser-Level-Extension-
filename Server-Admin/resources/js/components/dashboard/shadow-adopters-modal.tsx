import { Users } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export interface ShadowAdopter {
    id: number;
    client_name: string;
}

interface ShadowAdoptersModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    adopters: ShadowAdopter[];
}

export function ShadowAdoptersModal({
    open,
    onOpenChange,
    adopters,
}: ShadowAdoptersModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl gap-[1.875rem] border border-[rgba(34,197,94,0.4)] bg-background/95 backdrop-blur-xl sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users size={18} className="text-[#f59e0b]" />
                        Shadow Adopters
                    </DialogTitle>
                    <DialogDescription>
                        Extension users with more than 5 at-risk egress attempts
                        against unlisted or unsafe domains.
                    </DialogDescription>
                </DialogHeader>

                {adopters.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No Shadow Adopters recorded yet.
                    </p>
                ) : (
                    <div className="max-h-[55vh] overflow-y-auto">
                        <table className="w-full border-collapse text-[0.85rem]">
                            <thead>
                                <tr className="text-muted-foreground">
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pr-2.5 pb-3 text-left font-medium">
                                        ID
                                    </th>
                                    <th className="border-b border-[rgba(34,197,94,0.7)] pb-3 text-left font-medium">
                                        Client Name
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {adopters.map((adopter) => (
                                    <tr
                                        key={adopter.id}
                                        className="border-b border-[rgba(34,197,94,0.3)] last:border-b-0"
                                    >
                                        <td className="py-3 pr-2.5 text-muted-foreground tabular-nums">
                                            {adopter.id}
                                        </td>
                                        <td className="py-3 font-mono">
                                            {adopter.client_name}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <p className="text-xs text-muted-foreground">
                    {adopters.length} Shadow{' '}
                    {adopters.length === 1 ? 'Adopter' : 'Adopters'}
                </p>
            </DialogContent>
        </Dialog>
    );
}
