<?php

namespace App\Http\Requests\Settings;

use App\Concerns\PasswordValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ClearRecordsRequest extends FormRequest
{
    use PasswordValidationRules;

    /**
     * The phrase the operator has to type to confirm the purge.
     */
    public const CONFIRMATION_PHRASE = 'DELETE ALL';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'password' => $this->currentPasswordRules(),
            'confirmation' => ['required', 'string', Rule::in([self::CONFIRMATION_PHRASE])],
        ];
    }
}
