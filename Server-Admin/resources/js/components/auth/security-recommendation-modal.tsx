import { router } from '@inertiajs/react';
import { KeyRound, ShieldCheck } from 'lucide-react';
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
    onClose: () => void;
};

export function SecurityRecommendationModal({ isOpen, onClose }: Props) {
    const handleDismiss = () => {
        router.post(
            '/session/dismiss-recommendation',
            {},
            {
                preserveScroll: true,
                onFinish: () => onClose(),
            }
        );
    };

    const handleChangePassword = () => {
        router.post(
            '/session/dismiss-recommendation',
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    onClose();
                    router.visit('/security');
                },
            }
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
            <DialogContent className="border-amber-500/30 bg-[#0f172a] sm:max-w-md">
                <DialogHeader className="gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                        <KeyRound className="h-6 w-6" />
                    </div>
                    <DialogTitle className="text-xl font-bold text-white">
                        Security Recommendation
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-300">
                        Another active session was terminated when you authenticated. For your security, we strongly recommend updating your password now to prevent unauthorized access.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleDismiss}
                        className="border-white/10 hover:bg-white/5"
                    >
                        Skip & Proceed to Dashboard
                    </Button>
                    <Button
                        type="button"
                        onClick={handleChangePassword}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 font-medium text-white hover:from-amber-600 hover:to-amber-700"
                    >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Change Password
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
