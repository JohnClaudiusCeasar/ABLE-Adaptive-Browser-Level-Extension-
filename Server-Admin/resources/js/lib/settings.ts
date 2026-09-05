export type SettingValue =
    string | number | boolean | string[] | Record<string, string[]>;

export type SettingsValues = Record<string, SettingValue>;

export function isStringArray(value: SettingValue): value is string[] {
    return (
        Array.isArray(value) && value.every((item) => typeof item === 'string')
    );
}

export function isStringRecord(
    value: SettingValue,
): value is Record<string, string[]> {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.values(value).every(
            (item) =>
                Array.isArray(item) && item.every((v) => typeof v === 'string'),
        )
    );
}

export function parseStringArray(value: string): string[] {
    return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

export function formatStringArray(value: string[]): string {
    return value.join('\n');
}

export function parseKeyValue(value: string): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    for (const line of value.split('\n')) {
        const trimmed = line.trim();

        if (!trimmed) {
            continue;
        }

        const separatorIndex = trimmed.indexOf(':');

        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const raw = trimmed.slice(separatorIndex + 1).trim();
        const values = raw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        if (key) {
            result[key] = values;
        }
    }

    return result;
}

export function formatKeyValue(value: Record<string, string[]>): string {
    return Object.entries(value)
        .map(([key, pins]) => `${key}: ${pins.join(', ')}`)
        .join('\n');
}
