import { Form, Head, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ActiveSessionConflictModal } from '@/components/auth/active-session-conflict-modal';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
    activeConflict?: boolean;
    activeConflictEmail?: string;
    breakGlassToken?: string;
};

export default function Login({
    status,
    canResetPassword,
    activeConflict = false,
    activeConflictEmail = '',
    breakGlassToken = '',
}: Props) {
    const { errors: pageErrors } = usePage().props;
    const [typedEmail, setTypedEmail] = useState('');
    const [isConflictModalOpen, setIsConflictModalOpen] = useState(
        Boolean(activeConflict || pageErrors?.active_conflict)
    );

    useEffect(() => {
        if (activeConflict || pageErrors?.active_conflict) {
            setIsConflictModalOpen(true);
        }
    }, [activeConflict, pageErrors?.active_conflict]);
    return (
        <>
            <Head title="Log in" />

            <PasskeyVerify />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="-mt-3 flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label
                                    htmlFor="email"
                                    className="text-[0.85rem] font-medium text-muted-foreground"
                                >
                                    Email Address
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="admin@able.security"
                                    value={typedEmail}
                                    onChange={(e) => setTypedEmail(e.target.value)}
                                    className="border-white/12 bg-white/8 focus:border-[rgba(34,197,94,0.6)] focus:shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label
                                        htmlFor="password"
                                        className="text-[0.85rem] font-medium text-muted-foreground"
                                    >
                                        Password
                                    </Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="ml-auto text-sm text-able-green hover:underline"
                                            tabIndex={5}
                                        >
                                            Forgot your password?
                                        </TextLink>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="Password"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={3}
                                />
                                <Label htmlFor="remember">Remember me</Label>
                            </div>

                            <Button
                                type="submit"
                                className="mt-4 w-full border-none bg-gradient-to-r from-[#22c55e] to-[#16a34a] font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-[0_4px_20px_rgba(34,197,94,0.4)] active:scale-[0.98]"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Log in
                            </Button>
                        </div>

                        <div className="flex flex-col items-center gap-4 pt-2">
                            <div className="text-center text-sm text-muted-foreground">
                                Don't have an account?{' '}
                                <TextLink
                                    href={register()}
                                    tabIndex={5}
                                    className="text-able-green"
                                >
                                    Request Access
                                </TextLink>
                            </div>
                        </div>
                    </>
                )}
            </Form>

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}

            <ActiveSessionConflictModal
                isOpen={isConflictModalOpen}
                onClose={() => setIsConflictModalOpen(false)}
                email={activeConflictEmail || typedEmail}
                token={breakGlassToken}
                errorMessage={
                    (pageErrors?.active_conflict as string) ||
                    (pageErrors?.break_glass_password as string)
                }
            />
        </>
    );
}

Login.layout = {
    title: 'Log in to your account',
    description: 'Enter your email and password below to log in',
};
