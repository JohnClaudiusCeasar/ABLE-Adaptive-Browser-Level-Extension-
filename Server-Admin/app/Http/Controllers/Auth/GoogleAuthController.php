<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\LoginAuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Contracts\User as SocialiteUser;

class GoogleAuthController extends Controller
{
    public function __construct(
        private readonly LoginAuditService $auditService,
    ) {}

    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')
            ->scopes(['openid', 'profile', 'email'])
            ->redirect();
    }

    public function callback(): RedirectResponse
    {
        try {
            /** @var SocialiteUser $googleUser */
            $googleUser = Socialite::driver('google')->user();
        } catch (\Exception $e) {
            return redirect()->route('login')->withErrors([
                'email' => 'Unable to authenticate with Google. Please try again.',
            ]);
        }

        if ($googleUser->getEmail() === null) {
            return redirect()->route('login')->withErrors([
                'email' => 'Unable to retrieve email from Google account.',
            ]);
        }

        if (! $googleUser->offsetExists('email_verified') && ! $googleUser->getEmailVerified()) {
            return redirect()->route('login')->withErrors([
                'email' => 'Your Google email address is not verified. Please verify it first.',
            ]);
        }

        $email = Str::lower($googleUser->getEmail());
        $oauthAction = session()->pull('oauth_action', 'login');

        if ($oauthAction === 'link') {
            /** @var \App\Models\User $user */
            $user = Auth::user();

            $user->update([
                'google_id' => $googleUser->getId(),
                'avatar_url' => $googleUser->getAvatar(),
            ]);

            return redirect()->route('security.edit');
        }

        $user = User::where('google_id', $googleUser->getId())->first();

        if ($user === null) {
            $user = User::where('email', $email)->first();

            if ($user !== null) {
                $user->update([
                    'google_id' => $googleUser->getId(),
                    'avatar_url' => $googleUser->getAvatar(),
                ]);
            } else {
                $user = User::create([
                    'name' => $googleUser->getName() ?? $googleUser->getNickname() ?? explode('@', $email)[0],
                    'email' => $email,
                    'email_verified_at' => now(),
                    'google_id' => $googleUser->getId(),
                    'avatar_url' => $googleUser->getAvatar(),
                    'password' => Str::password(32),
                ]);
            }
        }

        $this->auditService->log(
            email: $email,
            type: 'google_success',
            ipAddress: request()->ip() ?? 'unknown',
            userAgent: request()->userAgent(),
            userId: $user->id,
        );

        Auth::login($user, remember: true);

        return redirect()->intended(config('fortify.home', '/dashboard'));
    }

    public function link(): RedirectResponse
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        if ($user && $user->hasGoogleAccount()) {
            return redirect()->route('security.edit');
        }

        session()->put('oauth_action', 'link');

        return Socialite::driver('google')
            ->scopes(['openid', 'profile', 'email'])
            ->redirect();
    }

    public function unlink(): RedirectResponse
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        if (! $user->hasPassword()) {
            return redirect()->route('security.edit');
        }

        $user->update([
            'google_id' => null,
            'avatar_url' => null,
        ]);

        return redirect()->route('security.edit');
    }
}
