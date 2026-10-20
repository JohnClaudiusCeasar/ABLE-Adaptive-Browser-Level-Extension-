<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Reduces the forwarded-for header to the address the edge proxy recorded.
 *
 * The application runs behind a proxy that terminates TLS and appends the
 * address it saw to X-Forwarded-For. Laravel's Request::ip() returns the
 * leftmost value in that list, which is the one a client can set itself, so
 * every request would land in its own rate-limit bucket and the API's
 * throttles could be sidestepped by sending a different header each time.
 *
 * The address the proxy recorded is the last one in the list, so the header
 * is reduced to that value before anything reads the client address. The
 * request is only touched when it actually came from a trusted proxy.
 */
class NormalizeForwardedFor
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isFromTrustedProxy()) {
            $forwarded = $request->headers->get('X-Forwarded-For');

            if (is_string($forwarded) && $forwarded !== '') {
                $addresses = array_values(array_filter(
                    array_map('trim', explode(',', $forwarded)),
                    static fn (string $address): bool => $address !== '',
                ));

                if ($addresses !== []) {
                    $request->headers->set('X-Forwarded-For', end($addresses));
                }
            }
        }

        return $next($request);
    }
}
