<?php

namespace App\Rules;

use App\Support\JsRegex;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Translation\PotentiallyTranslatedString;

/**
 * Validates that a string is a compilable regular expression.
 *
 * Uses the exact compile path of the server scoring engine
 * (App\Support\JsRegex — \uXXXX normalization + `iu` flags), so a pattern
 * that saves here is guaranteed to run in RiskScoringService. This is a
 * lenient check that rejects only hard syntax errors (e.g. unbalanced
 * delimiters/groups).
 */
class CompilableRegex implements ValidationRule
{
    /**
     * Run the validation rule.
     *
     * @param  Closure(string): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || $value === '') {
            return;
        }

        if (JsRegex::compile($value) === null) {
            $fail('The :attribute must be a valid regular expression.');
        }
    }
}
