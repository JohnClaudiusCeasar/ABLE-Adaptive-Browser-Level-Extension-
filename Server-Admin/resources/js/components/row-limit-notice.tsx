/**
 * Shown when the server could not send every row of a listing.
 *
 * The admin pages filter, sort and paginate their rows in the browser, so
 * the server sends the newest rows up to a limit rather than paginating them
 * on its side. When there are more rows than that, the page says so instead
 * of silently showing a truncated list.
 */
export function RowLimitNotice({
    truncated,
    limit,
}: {
    truncated?: boolean;
    limit?: number;
}) {
    if (!truncated) {
        return null;
    }

    return (
        <p className="text-xs text-muted-foreground">
            {limit
                ? `Showing the most recent ${limit.toLocaleString()} rows. `
                : 'Showing the most recent rows. '}
            Older rows are not listed here — use the reports for the full
            history.
        </p>
    );
}
