<?php

namespace App\Support;

/**
 * Decides whether an egress event is worth auditing.
 *
 * A file upload is audited unconditionally: an upload is an egress incident
 * whether or not it turned out to be risky. Typed text is not a file — it is
 * something the user typed into a field — so it is audited only when the text
 * itself carried a risk score. The target domain's own score is deliberately
 * not part of that decision: a page that is merely unlisted is not an
 * incident, and auditing every text input on such a domain buries the real
 * findings.
 *
 * The proof that the text was risky is the scan token: an HMAC-signed verdict
 * the server issued for that domain when it scored the text. It is the only
 * place where the pattern score (the text's own risk) and the domain score
 * are separable, and because it is signed, an unauthenticated POST to
 * /api/log-egress cannot invent one.
 */
class EgressAuditPolicy
{
    /**
     * The source the extension reports for a typed-text event.
     */
    public const TEXT_SOURCE = 'text-intercept';

    /**
     * The placeholder file name the extension passes for typed text.
     */
    public const TEXT_FILE_NAME = '[text-input]';

    /**
     * True when the event describes typed text rather than a file upload.
     *
     * All three markers are checked: the source is what a current client
     * sends, the user action is what the text path always reports, and the
     * placeholder name catches legacy clients that send neither.
     */
    public static function isTextIntercept(?string $source, ?string $fileName, ?string $userAction): bool
    {
        return $source === self::TEXT_SOURCE
            || $userAction === 'typing'
            || $fileName === self::TEXT_FILE_NAME;
    }

    /**
     * True when the typed text itself carried a risk score.
     *
     * The pattern score is the score the scoring service computed from the
     * patterns matched in the text alone. The domain's own risk score is
     * deliberately not consulted: only a pattern found in the text makes the
     * text an incident.
     *
     * @param  array<string, mixed>  $claims  Verified scan-token claims.
     */
    public static function isHighRisk(array $claims): bool
    {
        return ((int) ($claims['pattern_score'] ?? 0)) > 0;
    }
}
