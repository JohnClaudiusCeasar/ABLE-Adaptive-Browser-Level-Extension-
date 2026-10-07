<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Models\User;
use App\Services\ActiveSessionService;
use App\Services\LoginAuditService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureActions();
        $this->configureViews();
        $this->configureRateLimiting();
        $this->configureAuthentication();
    }

    /**
     * Configure Fortify actions.
     */
    private function configureActions(): void
    {
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        Fortify::createUsersUsing(CreateNewUser::class);
    }

    /**
     * Configure Fortify views.
     */
    private function configureViews(): void
    {
        Fortify::loginView(fn (Request $request) => Inertia::render('auth/login', [
            'canResetPassword' => Features::enabled(Features::resetPasswords()),
            'status' => $request->session()->get('status'),
            'activeConflict' => (bool) $request->session()->get('active_conflict_required', false),
            'activeConflictEmail' => $request->session()->get('active_conflict_email'),
            'breakGlassToken' => $request->session()->get('break_glass_token'),
        ]));

        Fortify::resetPasswordView(fn (Request $request) => Inertia::render('auth/reset-password', [
            'email' => $request->email,
            'token' => $request->route('token'),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]));

        Fortify::requestPasswordResetLinkView(fn (Request $request) => Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::verifyEmailView(fn (Request $request) => Inertia::render('auth/verify-email', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::registerView(fn () => Inertia::render('auth/register', [
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]));

        Fortify::twoFactorChallengeView(fn () => Inertia::render('auth/two-factor-challenge'));

        Fortify::confirmPasswordView(fn () => Inertia::render('auth/confirm-password'));
    }

    /**
     * Configure rate limiting.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('two-factor', function (Request $request) {
            return Limit::perMinute(5)->by($request->session()->get('login.id'));
        });

        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });

        RateLimiter::for('login-account', function (Request $request) {
            return Limit::perMinutes(15, 10)->by(
                Str::transliterate(Str::lower($request->input(Fortify::username()))),
            );
        });

        RateLimiter::for('passkeys', function (Request $request) {
            return Limit::perMinute(10)->by(
                ($request->input('credential.id') ?: $request->session()->getId()).'|'.$request->ip(),
            );
        });
    }

    /**
     * Configure authentication callbacks and active session restrictions.
     */
    private function configureAuthentication(): void
    {
        Fortify::authenticateUsing(function (Request $request) {
            $user = User::where('email', $request->email)->first();

            if ($user && Hash::check($request->password, $user->password)) {
                if ($user->is_blocked) {
                    throw ValidationException::withMessages([
                        Fortify::username() => [__('This account has been blocked.')],
                    ]);
                }

                /** @var ActiveSessionService $activeSessionService */
                $activeSessionService = app(ActiveSessionService::class);

                if ($activeSessionService->isActivelyOperating($user->id, $request->session()->getId())) {
                    $token = $activeSessionService->createBreakGlassToken($user->id);
                    $request->session()->put('active_conflict_required', true);
                    $request->session()->put('active_conflict_email', $user->email);
                    $request->session()->put('break_glass_token', $token);

                    /** @var LoginAuditService $auditService */
                    $auditService = app(LoginAuditService::class);
                    $auditService->log(
                        email: $user->email,
                        type: 'concurrent_active_session_blocked',
                        ipAddress: $request->ip() ?? 'unknown',
                        userAgent: $request->userAgent(),
                        userId: $user->id,
                    );

                    throw ValidationException::withMessages([
                        'active_conflict' => [__('Your account is actively being used by another device. If this is your account, please confirm if this is you by entering your password.')],
                    ]);
                }

                // Initialize active session tracking for the authenticated user
                $activeSessionService->recordActivity(
                    $user->id,
                    $request->session()->getId(),
                    $request->ip() ?? 'unknown',
                    $request->userAgent()
                );
                $request->session()->put('able_last_activity_time', now()->timestamp);

                return $user;
            }

            return null;
        });
    }
}
