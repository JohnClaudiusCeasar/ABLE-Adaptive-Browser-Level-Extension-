<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Validates that a string is a compilable regular expression.
 *
 * Uses PCRE to check for compile errors. Patterns are evaluated in the
 * browser extension with JavaScript's RegExp, so this is a lenient check
 * that rejects only hard syntax errors (e.g. unbalanced delimiters/groups).
 */
class CompilableRegex implements ValidationRule
{
    /**
     * Run the validation rule.
     *
     * @param  \Closure(string): \Illuminate\Translation\PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (!is_string($value) || $value === '') {
            return;
        }

        set_error_handler(static fn (): bool => true); // swallow PCRE warnings
        try {
            $compiled = @preg_match('~' . $value . '~', '') !== false;
        } finally {
            restore_error_handler();
        }

        if (!$compiled) {
            $fail('The :attribute must be a valid regular expression.');
        }
    }
}
