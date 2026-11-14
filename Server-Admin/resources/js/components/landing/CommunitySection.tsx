import React, { useState } from 'react';

export interface StreamMessage {
    id: number;
    author: string;
    category: 'suggestion' | 'comment' | 'complaint' | 'false-positive';
    domain: string;
    time: string;
    body: string;
    status?: string;
}

interface CommunitySectionProps {
    initialMessages?: StreamMessage[];
    requestDomain?: string | null;
}

const defaultMessages: StreamMessage[] = [
    {
        id: 1,
        author: 'SecurityResearch_01',
        category: 'suggestion',
        domain: 'chat.openai.com',
        time: '15m ago',
        body: 'Holding the request at the DOM event level completely prevents token exfiltration into AI chat contexts. Would love to see an automated preset for GCP service accounts.',
    },
    {
        id: 2,
        author: 'AuditAnalyst_PH',
        category: 'comment',
        domain: 'claude.ai',
        time: '1h ago',
        body: 'The pseudonymous device IDs (ABLE-XXXXXXXX) make this much easier to evaluate internally without worrying about employee tracking or surveillance friction.',
    },
    {
        id: 3,
        author: 'DevLead_K',
        category: 'false-positive',
        domain: 'github.com',
        time: '4h ago',
        body: 'A 40-character git commit hash triggered a high-entropy secret detection alert. Adding domain-level heuristic weights would prevent this edge case.',
    },
    {
        id: 4,
        author: 'EnterpriseAdmin',
        category: 'complaint',
        domain: 'internal.corp',
        time: '1d ago',
        body: 'Would appreciate an instant one-click bypass for internal staging URLs without needing to configure the policy table on the research server.',
    },
];

const categoryLabels: Record<string, string> = {
    suggestion: 'Suggestion',
    comment: 'Comment',
    complaint: 'Complaint',
    'false-positive': 'False Positive',
};

export function CommunitySection({
    initialMessages = [],
    requestDomain = null,
}: CommunitySectionProps) {
    const [selectedCat, setSelectedCat] = useState<
        'suggestion' | 'comment' | 'complaint' | 'false-positive'
    >('suggestion');
    const [authorName, setAuthorName] = useState('');
    const [targetDomain, setTargetDomain] = useState(() =>
        requestDomain ? requestDomain.slice(0, 100) : '',
    );
    const [messageBody, setMessageBody] = useState('');
    const [activeFeedFilter, setActiveFeedFilter] = useState<
        'all' | 'suggestion' | 'comment' | 'complaint'
    >('all');
    const [postedSuccess, setPostedSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [moderationNotice, setModerationNotice] = useState<string | null>(
        null,
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [streamMessages] = useState<StreamMessage[]>(() =>
        initialMessages && initialMessages.length > 0
            ? initialMessages
            : defaultMessages,
    );

    const handleRandomAlias = () => {
        const suffix = Math.floor(1000 + Math.random() * 9000);
        setAuthorName(`ABLE-User-${suffix}`);
    };

    const handlePostSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedBody = messageBody.trim();

        if (!trimmedBody || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);
        setModerationNotice(null);

        const csrfToken =
            document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
                ?.content || '';

        try {
            const response = await fetch('/community-messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    author: authorName.trim() || 'Anonymous',
                    category: selectedCat,
                    domain: targetDomain.trim(),
                    message: trimmedBody,
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setModerationNotice(
                    data.message ||
                        '✓ Submitted for review. Your message will appear publicly once approved by our research team.',
                );
                setMessageBody('');
                setTargetDomain('');
                setAuthorName('');
                setSelectedCat('suggestion');

                setPostedSuccess(true);
                setTimeout(() => setPostedSuccess(false), 2500);
            } else if (response.status === 429) {
                setErrorMessage(
                    'Too many messages submitted. Please wait a moment before trying again.',
                );
            } else if (data.errors) {
                const firstErr = Object.values(data.errors)[0] as string[];
                setErrorMessage(
                    firstErr?.[0] || 'Please review your inputs.',
                );
            } else {
                setErrorMessage(
                    data.message ||
                        'Unable to submit your message. Please try again.',
                );
            }
        } catch {
            setErrorMessage('Network connection error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredMessages =
        activeFeedFilter === 'all'
            ? streamMessages
            : streamMessages.filter((m) => m.category === activeFeedFilter);

    return (
        <section
            className="bleed-panel in-view no-scrollbar"
            id="contact"
            data-section="contact"
        >
            <div className="panel-inner contact-inner">
                <div className="section-lead">
                    <span className="minimal-badge">
                        FEEDBACK & RESEARCH FORUM
                    </span>
                    <h2 className="section-heading">Message Board</h2>
                    <p className="section-subtext">
                        Submit comments, feature suggestions, false-positive
                        reports, or complaints to help us improve in-browser
                        detection accuracy.
                    </p>
                </div>

                <div className="contact-grid">
                    {/* Message Submission Form */}
                    <div className="glass-card form-card">
                        <div className="card-head">
                            <h3>Post a Message</h3>
                            <p>
                                Your submission will be immediately shared to
                                the research board below.
                            </p>
                        </div>

                        <form
                            onSubmit={handlePostSubmit}
                            className="minimal-form"
                        >
                            <div className="form-row-category">
                                <span className="field-label">Category</span>
                                <div
                                    className="category-toggle"
                                    id="cat-toggles"
                                >
                                    {(
                                        [
                                            'suggestion',
                                            'comment',
                                            'complaint',
                                            'false-positive',
                                        ] as const
                                    ).map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            className={`cat-chip ${selectedCat === cat ? 'active' : ''}`}
                                            onClick={() => setSelectedCat(cat)}
                                        >
                                            {categoryLabels[cat]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-dual-fields">
                                <div className="form-field">
                                    <label
                                        htmlFor="post-author"
                                        className="field-label"
                                    >
                                        Name / Alias
                                    </label>
                                    <div className="input-inline">
                                        <input
                                            type="text"
                                            id="post-author"
                                            value={authorName}
                                            onChange={(e) =>
                                                setAuthorName(e.target.value)
                                            }
                                            placeholder="e.g. Auditor7"
                                            required
                                            maxLength={32}
                                        />
                                        <button
                                            type="button"
                                            className="btn-rand-alias"
                                            onClick={handleRandomAlias}
                                            title="Random Alias"
                                        >
                                            🎲
                                        </button>
                                    </div>
                                </div>

                                <div className="form-field">
                                    <label
                                        htmlFor="post-domain"
                                        className="field-label"
                                    >
                                        Target Domain (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        id="post-domain"
                                        value={targetDomain}
                                        onChange={(e) =>
                                            setTargetDomain(e.target.value)
                                        }
                                        placeholder="e.g. chat.openai.com"
                                    />
                                </div>
                            </div>

                            <div className="form-field">
                                <label
                                    htmlFor="post-message"
                                    className="field-label"
                                >
                                    Message Details
                                </label>
                                <textarea
                                    id="post-message"
                                    rows={3}
                                    value={messageBody}
                                    onChange={(e) =>
                                        setMessageBody(e.target.value)
                                    }
                                    placeholder="Share your feedback, bug report, or detection observation..."
                                    required
                                    maxLength={800}
                                />
                                <div className="char-notice">
                                    <span>
                                        {800 - messageBody.length} chars
                                        remaining
                                    </span>
                                </div>
                            </div>

                            {moderationNotice && (
                                <div className="moderation-alert-banner">
                                    <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line
                                            x1="12"
                                            y1="8"
                                            x2="12.01"
                                            y2="8"
                                        />
                                    </svg>
                                    <span>{moderationNotice}</span>
                                </div>
                            )}

                            {errorMessage && (
                                <div className="moderation-alert-banner error">
                                    <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line
                                            x1="12"
                                            y1="16"
                                            x2="12.01"
                                            y2="16"
                                        />
                                    </svg>
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="btn-solid btn-full"
                                id="submit-post-btn"
                                style={
                                    postedSuccess
                                        ? {
                                              background:
                                                  'rgba(52, 211, 153, 0.2)',
                                              color: '#34D399',
                                          }
                                        : undefined
                                }
                            >
                                {isSubmitting ? (
                                    <span>Submitting...</span>
                                ) : postedSuccess ? (
                                    <span>✓ Submitted for Review</span>
                                ) : (
                                    <>
                                        <span>Post Message</span>
                                        <svg
                                            width={14}
                                            height={14}
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                        >
                                            <line
                                                x1={22}
                                                y1={2}
                                                x2={11}
                                                y2={13}
                                            />
                                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Live Community Feed */}
                    <div className="glass-card stream-card">
                        <div className="stream-header">
                            <div className="stream-title">
                                <h3>Community Feedback</h3>
                                <span className="live-dot-tag">
                                    ● Live Feed
                                </span>
                            </div>
                            <div
                                className="stream-filter-pills"
                                id="feed-filters"
                            >
                                {(
                                    [
                                        'all',
                                        'suggestion',
                                        'comment',
                                        'complaint',
                                    ] as const
                                ).map((filterKey) => (
                                    <button
                                        key={filterKey}
                                        type="button"
                                        className={`f-pill ${activeFeedFilter === filterKey ? 'active' : ''}`}
                                        onClick={() =>
                                            setActiveFeedFilter(filterKey)
                                        }
                                    >
                                        {filterKey === 'all'
                                            ? 'All'
                                            : filterKey === 'suggestion'
                                              ? 'Suggestions'
                                              : filterKey === 'comment'
                                                ? 'Comments'
                                                : 'Complaints'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Feed List */}
                        <div
                            className="stream-list no-scrollbar"
                            id="stream-list"
                        >
                            {filteredMessages.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: '28px',
                                        color: 'var(--text-tertiary)',
                                        fontSize: '0.82rem',
                                    }}
                                >
                                    No posts found for this category.
                                </div>
                            ) : (
                                filteredMessages.map((item) => (
                                    <div key={item.id} className="stream-item">
                                        <div className="item-top">
                                            <span className="item-author">
                                                {item.author}
                                            </span>
                                            <span className="item-time">
                                                {item.time}
                                            </span>
                                        </div>
                                        <div className="item-badge-row">
                                            <span className="item-cat">
                                                {categoryLabels[
                                                    item.category
                                                ] || item.category}
                                            </span>
                                            {item.domain && (
                                                <span className="item-domain">
                                                    🌐 {item.domain}
                                                </span>
                                            )}
                                        </div>
                                        <p className="item-body">{item.body}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="operator-line">
                            <span>
                                Project Researcher:{' '}
                                <strong>John Claude Bacarro</strong> &bull;{' '}
                                <a
                                    href="mailto:bacarro.johnclaude@gmail.com"
                                    className="muted-link"
                                >
                                    bacarro.johnclaude@gmail.com
                                </a>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
