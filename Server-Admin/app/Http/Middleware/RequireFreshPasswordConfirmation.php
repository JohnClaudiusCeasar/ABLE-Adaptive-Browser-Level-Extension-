<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireFreshPasswordConfirmation
{
    /**
     * Ensure the user must confirm their password every time they visit
     * the security page after navigating away.
     *
     * On the first visit after login (or after a recent password confirmation
     * within the timeout window), the page loads without prompting. On every
     * subsequent visit, the user is redirected to the confirm-password page.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Return visit: the user already saw the security page since their
        // last confirmation. Force re-confirmation.
        if ($request->session()->get('security_page_confirmed')) {
            $request->session()->forget('security_page_confirmed');

            return redirect()->guest(route('password.confirm'));
        }

        // First visit (or fresh login): check whether the user's last
        // password confirmation is still within the allowed timeout.
        $confirmedAt = $request->session()->get('auth.password_confirmed_at', 0);
        $timeout = config('auth.password_timeout', 10800);

        if ((time() - $confirmedAt) > $timeout) {
            return redirect()->guest(route('password.confirm'));
        }

        $response = $next($request);

        // After the security page renders successfully, mark it as visited
        // so the next visit requires re-confirmation.
        if ($response->isSuccessful()) {
            $request->session()->put('security_page_confirmed', true);
        }

        return $response;
    }
}
