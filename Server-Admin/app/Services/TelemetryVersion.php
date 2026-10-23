<?php

namespace App\Services;

use App\Models\DomainVisit;
use App\Models\EgressEvent;

/**
 * A cheap fingerprint of the live telemetry tables.
 *
 * The admin panel polls this to learn whether the telemetry it is showing has
 * moved, so a page is only re-rendered when something actually arrived. The
 * fingerprint is therefore built from indexed aggregates only: it must stay
 * cheap on the small deployment, which serves the extension and the panel from
 * the same box.
 */
class TelemetryVersion
{
    /**
     * The domain visit log.
     */
    public const SOURCE_VISITS = 'visits';

    /**
     * The egress (data transfer) log.
     */
    public const SOURCE_EGRESS = 'egress';

    /**
     * The current fingerprint of every telemetry source.
     *
     * @return array<string, string>
     */
    public function snapshot(): array
    {
        return [
            self::SOURCE_VISITS => $this->visitsVersion(),
            self::SOURCE_EGRESS => $this->egressVersion(),
        ];
    }

    /**
     * The live refresh payload shared with the panel and served by the probe.
     *
     * The fingerprint is only computed when the panel may actually poll for
     * it. Visitors who are not signed in get an empty fingerprint, because the
     * amount of telemetry the research network produces is not public
     * information.
     *
     * @param  bool  $permitted  Whether the request may see telemetry at all.
     * @return array{version: array<string, string>, pollIntervalMs: int, enabled: bool}
     */
    public function payload(bool $permitted): array
    {
        $enabled = $permitted && (bool) config('able.telemetry_auto_refresh_enabled', true);

        return [
            'version' => $enabled ? $this->snapshot() : [],
            'pollIntervalMs' => (int) config('able.telemetry_poll_interval_ms', 5000),
            'enabled' => $enabled,
        ];
    }

    /**
     * The fingerprint of the visit log.
     *
     * A visit row is written once and never updated — its status is captured
     * when the visit is recorded — so the newest id is an exact detector for
     * "a visit arrived" and costs a single primary key index scan.
     */
    private function visitsVersion(): string
    {
        return (string) (DomainVisit::max('id') ?? 0);
    }

    /**
     * The fingerprint of the egress log.
     *
     * An egress event is normally a new row, but it can also be completed in
     * place: the same upload reported again with a scan verdict fills in the
     * risk score and the flagged patterns of the row that already exists. The
     * newest update time therefore has to be part of the fingerprint, or that
     * enrichment would never reach the screen.
     */
    private function egressVersion(): string
    {
        $maxId = EgressEvent::max('id');
        $maxUpdatedAt = EgressEvent::max('updated_at');

        return sprintf('%s|%s', (string) ($maxId ?? 0), (string) ($maxUpdatedAt ?? ''));
    }
}
