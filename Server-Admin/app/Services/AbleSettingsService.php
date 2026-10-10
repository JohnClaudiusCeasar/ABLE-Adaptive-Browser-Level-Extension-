<?php

namespace App\Services;

use App\Models\AbleSetting;
use App\Models\User;
use App\Support\AbleSettingsSchema;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AbleSettingsService
{
    public const GROUP_EXTENSION = AbleSettingsSchema::GROUP_EXTENSION;

    public const GROUP_SERVER = AbleSettingsSchema::GROUP_SERVER;

    private string $cachePrefix = 'able-settings:';

    /**
     * Return the effective settings for a group: schema defaults overlaid
     * with any values persisted in the database.
     *
     * @return array<string, mixed>
     */
    public function get(string $group): array
    {
        return Cache::rememberForever($this->cachePrefix.$group, function () use ($group) {
            $defaults = AbleSettingsSchema::defaults($group);
            $persisted = AbleSetting::where('group', $group)->pluck('value', 'key');

            foreach ($persisted as $key => $value) {
                if (array_key_exists($key, $defaults)) {
                    $defaults[$key] = $value;
                }
            }

            return $defaults;
        });
    }

    /**
     * Validate and persist settings for a group.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function update(string $group, array $input, User $user): array
    {
        $schema = AbleSettingsSchema::group($group);

        // Keep literal dotted keys (e.g. "behavior.risk_threshold") while
        // array/object leaves use their bare schema key.
        $flatInput = [];
        foreach (array_keys($schema) as $key) {
            if (array_key_exists($key, $input)) {
                $flatInput[$key] = $input[$key];
            }
        }

        // Laravel's validator treats dots as nested paths, so nest the flat
        // keys before validating and read the validated values back by path.
        $nested = [];
        foreach ($flatInput as $key => $value) {
            Arr::set($nested, $key, $value);
        }

        $rules = collect($schema)
            ->only(array_keys($flatInput))
            ->mapWithKeys(fn (array $field, string $key) => [$key => $field['rule']])
            ->all();

        $validated = Validator::make($nested, $rules)->validate();

        DB::transaction(function () use ($flatInput, $group, $validated, $user) {
            foreach (array_keys($flatInput) as $key) {
                AbleSetting::updateOrCreate(
                    ['group' => $group, 'key' => $key],
                    ['value' => Arr::get($validated, $key), 'updated_by' => $user->id],
                );
            }
        });

        Cache::forget($this->cachePrefix.$group);

        return $this->get($group);
    }

    /**
     * Build the signed-envelope payload exposed to the extension. Only the
     * non-sensitive extension group is included; the server group and signing
     * secrets are never returned.
     *
     * @return array<string, mixed>
     */
    public function runtimePayload(): array
    {
        $fields = AbleSettingsSchema::runtimeFields();
        $values = $this->get(self::GROUP_EXTENSION);

        return collect($fields)
            ->keys()
            ->mapWithKeys(fn (string $key) => [$key => $values[$key] ?? null])
            ->all();
    }

    /**
     * Convenience accessor for a single group/key used by runtime consumers.
     */
    public function value(string $group, string $key, mixed $default = null): mixed
    {
        $values = $this->get($group);

        return $values[$key] ?? $default;
    }
}
