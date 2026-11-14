export function GuideChapter() {
    return (
        <div className="doc-pane active" id="pane-guide">
            <div className="guide-cards-row">
                <div className="glass-subcard">
                    <div className="guide-card-header">
                        <h4>For Knowledge Workers & Browser Users</h4>
                        <span className="guide-badge-role">
                            CLIENT EXTENSION
                        </span>
                    </div>
                    <ul>
                        <li>
                            <strong>Live Toolbar Protection Status:</strong>{' '}
                            Click the pinned ABLE shield icon anytime to inspect
                            the current domain&apos;s safety classification
                            (Emerald <code>SAFE</code>, Amber{' '}
                            <code>UNLISTED</code>, Crimson{' '}
                            <code>RESTRICTED</code>) and confirm active DLP
                            monitoring.
                        </li>
                        <li>
                            <strong>Domain Safety & Educational Nudges:</strong>{' '}
                            Visiting an unvetted third-party website or new
                            cloud app triggers an unobtrusive educational alert
                            before you submit data, reinforced by smart
                            repeat-visit cooldowns that eliminate alert fatigue.
                        </li>
                        <li>
                            <strong>Evaluating Pre-Flight Upload Holds:</strong>{' '}
                            When an egress warning appears, review the flagged
                            sensitive categories (e.g. API keys or internal
                            documents) and verify whether external cloud sharing
                            complies with your organization&apos;s policy.
                        </li>
                        <li>
                            <strong>
                                Community Feedback & False-Positive Reporting:
                            </strong>{' '}
                            Encountering an over-sensitive detection? Use the
                            integrated Message Board to submit false-positive
                            reports and help researchers refine regex pattern
                            weighting.
                        </li>
                    </ul>
                </div>

                <div className="guide-card-header-col glass-subcard">
                    <div className="guide-card-header">
                        <h4>For Security Administrators & Researchers</h4>
                        <span className="guide-badge-role">
                            SERVER-ADMIN CONSOLE
                        </span>
                    </div>
                    <ul>
                        <li>
                            <strong>
                                Centralized Domain Policy Management:
                            </strong>{' '}
                            Configure, review, and categorize trusted enterprise
                            cloud endpoints versus unvetted Shadow IT domains
                            through the Laravel + React administrative research
                            dashboard.
                        </li>
                        <li>
                            <strong>
                                Cryptographic Pattern Distribution:
                            </strong>{' '}
                            Define and distribute enterprise risk pattern sets
                            signed with HMAC-SHA-256 keys, ensuring client
                            extensions only execute verified, tamper-proof
                            detection criteria.
                        </li>
                        <li>
                            <strong>
                                Fleet-Wide Shadow IT & Egress Analytics:
                            </strong>{' '}
                            Analyze aggregated domain visit trends, observe
                            which generative AI platforms are experiencing high
                            upload volume, and measure warning compliance rates
                            across user cohorts without invading user privacy.
                        </li>
                        <li>
                            <strong>
                                Executive Compliance & Audit Reporting:
                            </strong>{' '}
                            Generate structured, privacy-preserving incident
                            summaries demonstrating proactive browser-level DLP
                            enforcement for ISO 27001, SOC 2, and data
                            governance evaluations.
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
