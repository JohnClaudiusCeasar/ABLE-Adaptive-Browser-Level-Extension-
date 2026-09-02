<?php

namespace App\Http\Requests\Settings;

use App\Concerns\ProfileValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ProfileUpdateRequest extends FormRequest
{
    use ProfileValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return $this->profileRules($this->user()->id);
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $user = $this->user();

            if (! $user->profile_last_updated_at) {
                return;
            }

            $cooldownExpiresAt = $user->profile_last_updated_at->addWeek();

            if ($cooldownExpiresAt->isFuture()
                && ($this->input('name') !== $user->name || $this->input('email') !== $user->email)
            ) {
                $validator->errors()->add(
                    'profile',
                    'You can only update your name or email once every 7 days. Cooldown expires '.$cooldownExpiresAt->diffForHumans().'.'
                );
            }
        });
    }
}
