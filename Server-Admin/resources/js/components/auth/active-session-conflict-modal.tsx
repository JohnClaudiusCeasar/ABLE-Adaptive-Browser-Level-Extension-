import { useForm } from '@inertiajs/react';
import { ShieldAlert } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    email: string;
    token?: string;
    errorMessage?: string;
};

export function ActiveSessionConflictModal({
    isOpen,
    onClose,
    email,
    token,
    errorMessage,
}: Props) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: email || '',
        password: '',
        token: token || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/login/break-glass', {
            preserveScroll: true,
            onError: () => {
                reset('password');
            },
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="border-red-500/30 bg-[#0f172a] sm:max-w-md">
                <DialogHeader className="gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <DialogTitle className="text-xl font-bold text-white">
                        Active Session Detected
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-300">
                        Your account is actively being used by another device. If this is your account, please confirm if this is you by entering your password.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <PasswordInput
                            id="break-glass-password"
                            name="password"
                            required
                            autoFocus
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="Enter your password to confirm"
                            className="border-white/10 bg-white/5"
                        />
                        <InputError
                            message={
                                errors.break_glass_password ||
                                errors.password ||
                                errorMessage
                            }
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={processing}
                            className="border-white/10 hover:bg-white/5"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={processing || !data.password}
                            className="bg-red-600 font-medium text-white hover:bg-red-500"
                        >
                            {processing && <Spinner className="mr-2" />}
                            Confirm
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
