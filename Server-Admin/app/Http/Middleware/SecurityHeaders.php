<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    /**
     * The computed CSP, keyed by environment, so it is built once per process
     * instead of once per request. Config may differ between console and web
     * contexts, hence the key.
     *
     * @var array<string, string>
     */
    private static array $cachedCsp = [];

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('X-XSS-Protection', '0');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        if (str_starts_with(config('app.url', ''), 'https://')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        $response->headers->set('Content-Security-Policy', self::buildContentSecurityPolicy());

        return $response;
    }

    private static function buildContentSecurityPolicy(): string
    {
        $key = (string) config('app.env');

        if (isset(self::$cachedCsp[$key])) {
            return self::$cachedCsp[$key];
        }

        $appUrl = config('app.url', 'http://localhost');
        $isDev = config('app.debug', false);

        $scriptSrc = ["'self'"];
        $styleSrc = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'];
        $fontSrc = ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
        $connectSrc = ["'self'"];
        $imgSrc = ["'self'", 'data:'];

        // Allow the Reverb websocket connection for real-time chat.
        if (config('broadcasting.default') === 'reverb') {
            $reverbHost = str_replace(['[', ']'], '', (string) config('reverb.servers.reverb.hostname', '127.0.0.1'));
            $reverbPort = (int) config('reverb.servers.reverb.port', 8080);
            $connectSrc[] = "ws://{$reverbHost}:{$reverbPort}";
            $connectSrc[] = "wss://{$reverbHost}:{$reverbPort}";
        }

        if ($isDev) {
            // Vite injects inline module scripts (react refresh preamble) in dev.
            $scriptSrc[] = "'unsafe-inline'";

            $hotFile = base_path('public/hot');
            if (file_exists($hotFile)) {
                $devUrl = trim((string) file_get_contents($hotFile));
                $parsed = parse_url($devUrl);
                // CSP source expressions do not accept bracketed IPv6 literals like [::1];
                // use the hostname so the browser accepts the source.
                $devHost = str_replace(['[', ']'], '', $parsed['host'] ?? 'localhost');
                if ($devHost === '::1') {
                    $devHost = 'localhost';
                }
                $devPort = $parsed['port'] ?? 5173;
                $devScheme = $parsed['scheme'] ?? 'http';
            } else {
                $devHost = str_replace(['http://', 'https://'], '', $appUrl);
                $devPort = env('VITE_DEV_SERVER_PORT', '5173');
                $devScheme = 'http';
            }
            $devBase = "{$devScheme}://{$devHost}:{$devPort}";
            $scriptSrc[] = $devBase;
            $styleSrc[] = $devBase;
            $connectSrc[] = $devBase;
            $connectSrc[] = "ws://{$devHost}:{$devPort}";
        }

        $directives = [
            "default-src 'self'",
            'script-src '.implode(' ', $scriptSrc),
            'style-src '.implode(' ', $styleSrc),
            'font-src '.implode(' ', $fontSrc),
            'connect-src '.implode(' ', $connectSrc),
            'img-src '.implode(' ', $imgSrc),
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ];

        return self::$cachedCsp[$key] = implode('; ', $directives);
    }
}
