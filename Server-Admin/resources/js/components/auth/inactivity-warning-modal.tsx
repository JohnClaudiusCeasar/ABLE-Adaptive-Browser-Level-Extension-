import { Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type Props = {
    isOpen: boolean;
    secondsRemaining: number;
    onStayLoggedIn: () => void;
};

export function InactivityWarningModal({
    isOpen,
    secondsRemaining,
    onStayLoggedIn,
}: Props) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onStayLoggedIn()}>
            <DialogContent className="border-amber-500/30 bg-[#0f172a] sm:max-w-md">
                <DialogHeader className="gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                        <Clock className="h-6 w-6 animate-pulse" />
                    </div>
                    <DialogTitle className="text-xl font-bold text-white">
                        Session Inactivity Warning
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-300">
                        You have been inactive. For your security, your session will automatically log out in{' '}
                        <span className="font-semibold text-amber-400">
                            {secondsRemaining} second{secondsRemaining !== 1 ? 's' : ''}
                        </span>
                        .
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="mt-4 flex justify-end">
                    <Button
                        type="button"
                        onClick={onStayLoggedIn}
                        className="bg-gradient-to-r from-able-green to-emerald-600 font-medium text-white hover:opacity-90"
                    >
                        Stay Logged In
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
