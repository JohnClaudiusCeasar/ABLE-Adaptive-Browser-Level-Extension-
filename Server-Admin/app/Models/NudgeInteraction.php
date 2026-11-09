<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $egress_event_id
 * @property string $domain
 * @property string|null $user_id
 * @property string $user_action
 * @property Carbon|null $interacted_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class NudgeInteraction extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'egress_event_id',
        'domain',
        'user_id',
        'user_action',
        'interacted_at',
    ];

    protected $casts = [
        'interacted_at' => 'datetime',
    ];

    /**
     * Get the egress event that owns this interaction.
     *
     * @return BelongsTo<EgressEvent, $this>
     */
    public function egressEvent(): BelongsTo
    {
        return $this->belongsTo(EgressEvent::class);
    }

    /**
     * Compute risk-adjusted containment statistics across nudge interactions.
     *
     * Distinguishes high-risk vs. low-risk proceeded events by joining with
     * egress_events on risk_score.
     *
     * @param  Builder<self>|null  $query
     * @return array{
     *     cancelled: int,
     *     cancelled_high: int,
     *     cancelled_low: int,
     *     proceeded: int,
     *     proceeded_high: int,
     *     proceeded_low: int,
     *     total: int,
     *     success_rate: float,
     *     high_risk_success_rate: float|null,
     *     low_risk_success_rate: float|null
     * }
     */
    public static function containmentStats(
        ?Builder $query = null,
        int $riskThreshold = 85,
        float $lowRiskPenaltyWeight = 0.25
    ): array {
        $builder = $query ? (clone $query) : self::query();

        /** @var object{cancelled: int|string, cancelled_high: int|string, cancelled_low: int|string, proceeded_high: int|string, proceeded_low: int|string}|null $stats */
        $stats = $builder->leftJoin('egress_events', 'nudge_interactions.egress_event_id', '=', 'egress_events.id')
            ->selectRaw("
                COALESCE(SUM(CASE WHEN nudge_interactions.user_action = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled,
                COALESCE(SUM(CASE WHEN nudge_interactions.user_action = 'cancelled' AND egress_events.risk_score >= ? THEN 1 ELSE 0 END), 0) as cancelled_high,
                COALESCE(SUM(CASE WHEN nudge_interactions.user_action = 'cancelled' AND (egress_events.risk_score < ? OR egress_events.risk_score IS NULL) THEN 1 ELSE 0 END), 0) as cancelled_low,
                COALESCE(SUM(CASE WHEN nudge_interactions.user_action = 'proceeded' AND egress_events.risk_score >= ? THEN 1 ELSE 0 END), 0) as proceeded_high,
                COALESCE(SUM(CASE WHEN nudge_interactions.user_action = 'proceeded' AND (egress_events.risk_score < ? OR egress_events.risk_score IS NULL) THEN 1 ELSE 0 END), 0) as proceeded_low
            ", [$riskThreshold, $riskThreshold, $riskThreshold, $riskThreshold])
            ->first();

        $cancelled = (int) ($stats->cancelled ?? 0);
        $cancelledHigh = (int) ($stats->cancelled_high ?? 0);
        $cancelledLow = (int) ($stats->cancelled_low ?? 0);
        $proceededHigh = (int) ($stats->proceeded_high ?? 0);
        $proceededLow = (int) ($stats->proceeded_low ?? 0);

        $proceeded = $proceededHigh + $proceededLow;
        $total = $cancelled + $proceeded;

        // Risk-adjusted rate: low-risk proceeds incur only fractional penalty ($lowRiskPenaltyWeight)
        $successRate = $total > 0
            ? round((($cancelled + (1.0 - $lowRiskPenaltyWeight) * $proceededLow) / $total) * 100, 1)
            : 0.0;

        $highTotal = $cancelledHigh + $proceededHigh;
        $highRiskRate = $highTotal > 0
            ? round(($cancelledHigh / $highTotal) * 100, 1)
            : null;

        $lowTotal = $cancelledLow + $proceededLow;
        $lowRiskRate = $lowTotal > 0
            ? round(($cancelledLow / $lowTotal) * 100, 1)
            : null;

        return [
            'cancelled' => $cancelled,
            'cancelled_high' => $cancelledHigh,
            'cancelled_low' => $cancelledLow,
            'proceeded' => $proceeded,
            'proceeded_high' => $proceededHigh,
            'proceeded_low' => $proceededLow,
            'total' => $total,
            'success_rate' => $successRate,
            'high_risk_success_rate' => $highRiskRate,
            'low_risk_success_rate' => $lowRiskRate,
        ];
    }
}
