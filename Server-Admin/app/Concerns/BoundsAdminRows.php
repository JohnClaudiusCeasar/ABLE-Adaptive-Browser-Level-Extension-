<?php

namespace App\Concerns;

trait BoundsAdminRows
{
    /**
     * How many rows an admin page may hold in memory at once.
     *
     * The admin pages filter, sort and paginate their rows in the browser,
     * so the server sends the newest rows rather than paginating them. The
     * limit stops a telemetry table that grew for a year from being read in
     * full on every page view, which is what exhausted the server's memory.
     */
    protected function rowLimit(): int
    {
        return max(1, (int) config('able.admin_page_limit', 500));
    }
}
