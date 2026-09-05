export function BooleanField({
    name,
    defaultValue,
    disabled,
}: {
    name: string;
    defaultValue?: boolean;
    disabled?: boolean;
}) {
    return (
        <div className="mt-1 flex items-center gap-3">
            <input type="hidden" name={name} value="0" />
            <input
                id={name}
                type="checkbox"
                name={name}
                value="1"
                defaultChecked={defaultValue === true}
                disabled={disabled}
                className="h-4 w-4 rounded border-input accent-able-green"
            />
            <label htmlFor={name} className="text-sm text-muted-foreground">
                Enabled
            </label>
        </div>
    );
}
