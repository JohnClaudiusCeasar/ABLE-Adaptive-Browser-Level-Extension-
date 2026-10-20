<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $author
 * @property string $category
 * @property string|null $domain
 * @property string $message
 * @property string|null $ip_address
 * @property string $status
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 *
 * @method static Builder|CommunityMessage approved()
 * @method static Builder|CommunityMessage pending()
 * @method static Builder|CommunityMessage rejected()
 */
class CommunityMessage extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'author',
        'category',
        'domain',
        'message',
        'ip_address',
        'status',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Scope query to only approved messages.
     *
     * @param  Builder<CommunityMessage>  $query
     * @return Builder<CommunityMessage>
     */
    public function scopeApproved(Builder $query): Builder
    {
        return $query->where('status', 'approved');
    }

    /**
     * Scope query to only pending messages awaiting moderation.
     *
     * @param  Builder<CommunityMessage>  $query
     * @return Builder<CommunityMessage>
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope query to only rejected messages.
     *
     * @param  Builder<CommunityMessage>  $query
     * @return Builder<CommunityMessage>
     */
    public function scopeRejected(Builder $query): Builder
    {
        return $query->where('status', 'rejected');
    }

    /**
     * Scope query to the messages published on the public landing feed.
     *
     * Access requests are governance records about a specific blocked site,
     * so they are never published publicly.
     *
     * @param  Builder<CommunityMessage>  $query
     * @return Builder<CommunityMessage>
     */
    public function scopePublicFeed(Builder $query): Builder
    {
        return $query->where('status', 'approved')
            ->where('category', '!=', 'access-request');
    }
}
