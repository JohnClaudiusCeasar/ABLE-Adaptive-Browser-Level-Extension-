<?php

namespace App\Http\Requests\Settings;

use App\Concerns\PasswordValidationRules;
use App\Services\RecordPurgeService;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ClearRecordsRequest extends FormRequest
{
    use PasswordValidationRules;

    /**
     * The phrase the operator has to type to confirm a full wipe.
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
            'confirmation' => ['required', 'string'],
            'targets' => ['sometimes', 'array', 'min:1'],
            'targets.*' => ['string', Rule::in(RecordPurgeService::telemetryKeys())],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ];
    }

    /**
     * Require the confirmation appropriate to the scope of the purge.
     *
     * A full wipe keeps the fixed phrase. A scoped purge instead requires the
     * exact record count shown in the preview, so the operator has to read the
     * impact before deleting.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $targets = $this->input('targets');
            $confirmation = trim((string) $this->input('confirmation'));

            if (blank($targets)) {
                if ($confirmation !== self::CONFIRMATION_PHRASE) {
                    $validator->errors()->add(
                        'confirmation',
                        __('Type :phrase to confirm.', ['phrase' => self::CONFIRMATION_PHRASE]),
                    );
                }

                return;
            }

            if (! ctype_digit($confirmation) || (int) $confirmation < 1) {
                $validator->errors()->add(
                    'confirmation',
                    __('Type the number of records shown in the preview to confirm.'),
                );
            }

            if ($this->filled('date_from') !== $this->filled('date_to')) {
                $validator->errors()->add(
                    'date_from',
                    __('Choose both a start and an end date, or neither.'),
                );
            }
        });
    }
}
