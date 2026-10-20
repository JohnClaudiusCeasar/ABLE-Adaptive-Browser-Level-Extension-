<?php

namespace App\Support;

/**
 * The placeholder file names the extension assigns when it cannot recover the
 * user's real file name — a nameless blob, a MIME-only upload, a non-Office
 * stream.
 *
 * Their extension is derived from the MIME type or the file's magic bytes,
 * never from the document the user actually chose. Nothing was uploaded behind
 * them, so they are not egress incidents: auditing one reports a file that
 * does not exist.
 *
 * This is the server-side counterpart of the extension's
 * Client-Extension/core/synthetic-names.js and must stay in sync with it.
 */
class SyntheticFileName
{
    /**
     * The base name (everything before the first dot) of every placeholder the
     * extension or the page may produce.
     *
     * @var list<string>
     */
    public const PLACEHOLDER_BASES = [
        'upload',
        'blob',
        'binary-upload',
        'websocket-upload',
        'stream-upload',
        'form-upload',
        'unknown',
    ];

    /**
     * The base name of a file name — everything before the first dot,
     * lowercased.
     */
    public static function base(?string $fileName): string
    {
        $name = mb_strtolower(trim((string) $fileName), 'UTF-8');

        if ($name === '') {
            return '';
        }

        return explode('.', $name)[0];
    }

    /**
     * True when the name is one of the extension's placeholders, e.g.
     * "blob.csv", "upload.xlsx" or "stream-upload.png".
     *
     * The base name must match a placeholder exactly, so a real file called
     * "upload-report.pdf" or "myblob.csv" is not mistaken for one.
     */
    public static function isPlaceholder(?string $fileName): bool
    {
        return in_array(self::base($fileName), self::PLACEHOLDER_BASES, true);
    }
}
