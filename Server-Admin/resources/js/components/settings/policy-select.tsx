export function PolicySelect({
    name,
    defaultValue,
    disabled,
}: {
    name: string;
    defaultValue?: string;
    disabled?: boolean;
}) {
    return (
        <select
            id={name}
            name={name}
            defaultValue={defaultValue ?? 'under_review'}
            disabled={disabled}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
            <option value="whitelisted">Allow (whitelisted)</option>
            <option value="under_review">Review (under review)</option>
            <option value="blacklisted">Block (blacklisted)</option>
        </select>
    );
}
