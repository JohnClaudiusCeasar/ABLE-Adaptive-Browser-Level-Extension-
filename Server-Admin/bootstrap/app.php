<?php

use App\Http\Middleware\EnforceInactivityTimeout;
use App\Http\Middleware\EnsureModuleAccess;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\NormalizeForwardedFor;
use App\Http\Middleware\ResetPasswordConfirmationOnNavigation;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withBroadcasting(__DIR__.'/../routes/channels.php')
    ->withMiddleware(function (Middleware $middleware): void {
        // Render (and most PaaS hosts) terminate HTTPS at a load balancer and
        // forward plain HTTP to the container. Trusting the proxy makes Laravel
        // honour X-Forwarded-Proto so asset/route URLs are generated as https://.
        $middleware->trustProxies(at: '*');

        // The proxy appends the address it saw to X-Forwarded-For, and the
        // leftmost value in that list is the one a client controls. Reducing
        // the header to the address the proxy recorded keeps the client
        // address — and therefore the rate-limit buckets — honest.
        $middleware->append(NormalizeForwardedFor::class);

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->validateCsrfTokens(except: [
            'session/terminate-beacon',
            'community-messages',
        ]);

        $middleware->web(prepend: [
            SecurityHeaders::class,
        ]);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            ResetPasswordConfirmationOnNavigation::class,
            EnforceInactivityTimeout::class,
        ]);

        $middleware->alias([
            'module' => EnsureModuleAccess::class,
        ]);
    })
    ->withSchedule(function (Schedule $schedule): void {
        // Keep the research telemetry tables from growing without bound. The
        // window is the retention period published in PRIVACY.md.
        $schedule->command('able:prune-telemetry')->dailyAt('03:17');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
