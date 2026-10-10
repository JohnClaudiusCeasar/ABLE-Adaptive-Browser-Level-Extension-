<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResetPasswordConfirmationOnNavigation
{
    /**
     * Handle an incoming request.
     *
     * Invalidate password confirmation when the authenticated user navigates
     * away from security-related pages, ensuring strict re-confirmation upon return.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() && ! $this->isSecurityRequest($request)) {
            $request->session()->forget('auth.password_confirmed_at');
        }

        return $next($request);
    }

    /**
     * Determine if the request is for a security-related endpoint.
     */
    protected function isSecurityRequest(Request $request): bool
    {
        return $request->is([
            'security',
            'security/*',
            'session/*',
            'chat',
            'chat/*',
            'user/confirm-password',
            'user/confirmed-password-status',
            'user/two-factor*',
            'user/confirmed-two-factor-authentication',
            'user/passkeys',
            'user/passkeys/*',
            'passkeys/*',
            '.well-known/passkey-endpoints',
            'broadcasting/*',
            'up',
        ]);
    }
}
