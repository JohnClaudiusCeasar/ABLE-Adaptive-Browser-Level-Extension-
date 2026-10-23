<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised when a scoped purge would remove a different number of records than
 * the operator previewed and confirmed.
 */
class RecordCountChangedException extends RuntimeException
{
    public function __construct(public readonly int $expected, public readonly int $actual)
    {
        parent::__construct("Expected {$expected} matching records, found {$actual}.");
    }
}
