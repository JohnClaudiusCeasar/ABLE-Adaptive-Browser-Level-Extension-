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

export type RecordCount = {
    key: string;
    label: string;
    count: number;
    description?: string;
    group?: string;
    date_column?: string | null;
    implied_by?: string[];
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    counts: RecordCount[];
    total: number;
    phrase: string;
    confirmLabel: string;
    data?: Record<string, unknown>;
    onCompleted?: () => void;
    onFailed?: () => void;
};

export default function RecordsPurgeDialog({
    open,
    onOpenChange,
    title,
    description,
    counts,
    total,
    phrase,
    confirmLabel,
    data = {},
    onCompleted,
    onFailed,
}: Props) {
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    // The server trims incoming strings before validating, so a stray space
    // around the phrase is accepted there too. Compare the same way here so
    // the button does not stay disabled over a trailing space.
    const canConfirm =
        password.length > 0 &&
        confirmation.trim() === phrase &&
        total > 0 &&
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
            data: {
                ...data,
                password,
                confirmation: confirmation.trim(),
            },
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onOpenChange(false);
                onCompleted?.();
            },
            onError: (validationErrors: Record<string, string>) => {
                setErrors(validationErrors);

                if (validationErrors.confirmation) {
                    setConfirmation('');
                    onFailed?.();
                }

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
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
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
                    <Label htmlFor="records-purge-password">
                        Your password
                    </Label>
                    <PasswordInput
                        id="records-purge-password"
                        name="password"
                        autoComplete="current-password"
                        placeholder="Password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                    <InputError message={errors.password} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="records-purge-confirmation">
                        Type{' '}
                        <span className="font-mono font-semibold text-foreground">
                            {phrase}
                        </span>{' '}
                        to confirm
                    </Label>
                    <Input
                        id="records-purge-confirmation"
                        name="confirmation"
                        autoComplete="off"
                        placeholder={phrase}
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
                        {processing ? 'Deleting…' : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
