import { Form, Head, usePage } from '@inertiajs/react';
import { Link } from '@inertiajs/react';
import { useState } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';
import type { Auth } from '@/types';

type PageProps = {
    auth: Auth;
};

export default function Profile(
    {
        mustVerifyEmail,
        status,
        profileLastUpdatedAt,
    }: {
        mustVerifyEmail: boolean;
        status?: string;
        profileLastUpdatedAt: string | null;
    },
) {
    const { auth } = usePage<PageProps>().props;
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null);

    const cooldownExpiresAt = profileLastUpdatedAt
        ? new Date(new Date(profileLastUpdatedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
        : null;
    const isOnCooldown = cooldownExpiresAt ? cooldownExpiresAt > new Date() : false;
    const cooldownDaysRemaining = isOnCooldown
        ? Math.ceil((cooldownExpiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : 0;
    const cooldownExpiresFormatted = cooldownExpiresAt
        ? cooldownExpiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : null;

    return (
        <>
            <Head title="Profile settings" />

            <h1 className="sr-only">Profile settings</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Profile"
                    description="Update your name and email address"
                />

                {isOnCooldown && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                        To prevent misuse, changes to your name and email are limited to once every 7 days.
                        You can next update these fields on {cooldownExpiresFormatted} (in{' '}
                        {cooldownDaysRemaining} {cooldownDaysRemaining === 1 ? 'day' : 'days'}).
                    </div>
                )}

                <Form
                    {...ProfileController.update.form()}
                    options={{
                        preserveScroll: true,
                    }}
                    className="space-y-6"
                >
                    {({ processing, errors, submit }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>

                                <Input
                                    id="name"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.name}
                                    name="name"
                                    required
                                    autoComplete="name"
                                    placeholder="Full name"
                                    disabled={isOnCooldown}
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.name}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">Email address</Label>

                                <Input
                                    id="email"
                                    type="email"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.email}
                                    name="email"
                                    required
                                    autoComplete="username"
                                    placeholder="Email address"
                                    disabled={isOnCooldown}
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.email}
                                />
                            </div>

                            {mustVerifyEmail &&
                                auth.user.email_verified_at === null && (
                                    <div>
                                        <p className="-mt-4 text-sm text-muted-foreground">
                                            Your email address is unverified.{' '}
                                            <Link
                                                href={send()}
                                                as="button"
                                                className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                            >
                                                Click here to re-send the
                                                verification email.
                                            </Link>
                                        </p>

                                        {status ===
                                            'verification-link-sent' && (
                                            <div className="mt-2 text-sm font-medium text-green-600">
                                                A new verification link has been
                                                sent to your email address.
                                            </div>
                                        )}
                                    </div>
                                )}

                            <div className="flex items-center gap-4">
                                <Button
                                    type="button"
                                    disabled={processing || isOnCooldown}
                                    data-test="update-profile-button"
                                    onClick={() => {
                                        setPendingSubmit(() => submit);
                                        setShowConfirmDialog(true);
                                    }}
                                >
                                    Save
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>

            <DeleteUser />

            <ConfirmDialog
                open={showConfirmDialog}
                onOpenChange={setShowConfirmDialog}
                title="Confirm profile changes"
                description="Updating your profile will apply the following: your name and email will be changed to the new values provided. If your email address is changed, you will be required to re-verify it. A 7-day cooldown will be enforced before you can edit your name or email again."
                confirmLabel="Save changes"
                cancelLabel="Cancel"
                variant="default"
                onConfirm={() => {
                    pendingSubmit?.();
                    setPendingSubmit(null);
                }}
            />
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'Profile settings',
            href: edit(),
        },
    ],
};
