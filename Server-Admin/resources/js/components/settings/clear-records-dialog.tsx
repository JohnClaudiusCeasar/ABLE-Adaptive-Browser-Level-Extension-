import { router } from '@inertiajs/react';
import { useState } from 'react';
import ServerSettingsController from '@/actions/App/Http/Controllers/Settings/ServerSettingsController';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CONFIRMATION_PHRASE = 'DELETE ALL';

export type RecordCount = {
    key: string;
    label: string;
    count: number;
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    counts: RecordCount[];
};

export default function ClearRecordsDialog({
    open,
    onOpenChange,
    counts,
}: Props) {
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    const total = counts.reduce((sum, item) => sum + item.count, 0);
    // The server trims incoming strings before validating, so a stray space
    // around the phrase is accepted there too. Compare the same way here so
    // the button does not stay disabled over a trailing space.
    const canConfirm =
        password.length > 0 &&
        confirmation.trim() === CONFIRMATION_PHRASE &&
        !processing;

    function reset() {
        setPassword('');
        setConfirmation('');
        setErrors({});
        setProcessing(false);
    }

    function close() {
        if (processing) {
            return;
        }

        reset();
        onOpenChange(false);
    }

    function handleConfirm() {
        setProcessing(true);
        setErrors({});

        router.delete(ServerSettingsController.clearRecords.url(), {
            data: { password, confirmation: confirmation.trim() },
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onOpenChange(false);
            },
            onError: (validationErrors: Record<string, string>) => {
                setErrors(validationErrors);
                setProcessing(false);
            },
            onFinish: () => setProcessing(false),
        });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    close();
                }
            }}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Clear all records</DialogTitle>
                    <DialogDescription>
                        This permanently deletes every record in the app and
                        cannot be undone. Accounts, settings and the server
                        configuration are kept.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-red-100 bg-red-50/60 p-4 dark:border-red-200/10 dark:bg-red-700/10">
                    <p className="text-sm font-medium text-red-600 dark:text-red-100">
                        {total.toLocaleString()} record
                        {total === 1 ? '' : 's'} will be deleted
                    </p>
                    <ul className="space-y-1">
                        {counts.map((item) => (
                            <li
                                key={item.key}
                                className="flex items-center justify-between gap-4 text-xs"
                            >
                                <span className="text-muted-foreground">
                                    {item.label}
                                </span>
                                <span className="tabular-nums">
                                    {item.count.toLocaleString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="clear-records-password">
                        Your password
                    </Label>
                    <PasswordInput
                        id="clear-records-password"
                        name="password"
                        autoComplete="current-password"
                        placeholder="Password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                    <InputError message={errors.password} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="clear-records-confirmation">
                        Type{' '}
                        <span className="font-mono font-semibold text-foreground">
                            {CONFIRMATION_PHRASE}
                        </span>{' '}
                        to confirm
                    </Label>
                    <Input
                        id="clear-records-confirmation"
                        name="confirmation"
                        autoComplete="off"
                        placeholder={CONFIRMATION_PHRASE}
                        value={confirmation}
                        onChange={(event) =>
                            setConfirmation(event.target.value)
                        }
                    />
                    <InputError message={errors.confirmation} />
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="secondary"
                        onClick={close}
                        disabled={processing}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        data-test="confirm-clear-records-button"
                    >
                        {processing ? 'Clearing…' : 'Clear all records'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
