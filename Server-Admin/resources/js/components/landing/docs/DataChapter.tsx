export function DataChapter() {
    return (
        <div className="doc-pane active" id="pane-data">
            <div className="data-intro-banner">
                <h4>Data Minimization & Zero-Surveillance Architecture</h4>
                <p>
                    ABLE was founded on the fundamental principle that
                    client-side security must never become an instrument for
                    workforce surveillance. Unlike legacy Endpoint Detection and
                    Response (EDR) or Commercial DLP agents that monitor all
                    browsing activities and record full URL histories, ABLE
                    processes only the minimal metadata required to compute risk
                    verdicts and evaluate research detection accuracy. Every
                    byte transmitted is protected by cryptographic SPKI
                    certificate pinning and sent exclusively to our self-hosted
                    research server.
                </p>
            </div>

            <div className="data-table-glass">
                <table className="minimal-table">
                    <thead>
                        <tr>
                            <th style={{ width: '18%' }}>Data Category</th>
                            <th style={{ width: '32%' }}>
                                Processed Information
                            </th>
                            <th style={{ width: '30%' }}>
                                Purpose & Governance
                            </th>
                            <th style={{ width: '20%' }}>Retention Policy</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <span className="dot-tag dot-green">
                                    Domain Telemetry
                                </span>
                            </td>
                            <td>
                                <strong>Top-Frame Hostname:</strong> Visited
                                domain (e.g., <code>claude.ai</code>), safety
                                classification (<code>SAFE</code>,{' '}
                                <code>UNLISTED</code>, <code>RESTRICTED</code>),
                                millisecond timestamp, event UUID, and random
                                device ID.
                            </td>
                            <td>
                                Evaluates domain categorization coverage and
                                nudge effectiveness. Search engine queries, full
                                path parameters, and intranet endpoints are
                                explicitly scrubbed.
                            </td>
                            <td>
                                Aggregated research logs only; searchable and
                                purgeable by pseudonymous ID upon request.
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <span className="dot-tag dot-amber">
                                    Pre-Flight Scans
                                </span>
                            </td>
                            <td>
                                <strong>Extracted Text Slice:</strong> Text
                                content (up to 200,000 chars for documents,
                                50,000 for inputs), file name, file size,
                                SHA-256 digest, and contextual page metadata.
                            </td>
                            <td>
                                Evaluates high-entropy patterns (AWS keys,
                                OpenAI tokens, database URIs, PII) to compute
                                risk score (0–100) and present informed choices.
                            </td>
                            <td>
                                Held strictly in transient server RAM; never
                                written to disk or database. Discarded
                                immediately upon verdict delivery.
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <span className="dot-tag dot-blue">
                                    Egress Decision Logs
                                </span>
                            </td>
                            <td>
                                <strong>Audit Record Metadata:</strong> Domain
                                name, action taken (<em>Proceed</em>,{' '}
                                <em>Cancel</em>, or <em>Blocked</em>), file
                                name, size, SHA-256 hash, computed score, and
                                matched rule categories.
                            </td>
                            <td>
                                Measures whether in-browser interventions
                                successfully prevent data leaks and quantifies
                                Shadow IT adoption trends across teams.
                            </td>
                            <td>
                                Metadata only;{' '}
                                <strong>
                                    raw file contents and confidential texts are
                                    strictly never logged
                                </strong>
                                .
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <span className="dot-tag dot-red">
                                    Excluded Data
                                </span>
                            </td>
                            <td>
                                <strong>Zero Collection:</strong> No keystroke
                                logging, no browsing history, no authentication
                                cookies, no saved passwords, no screen captures,
                                and no hardware serials.
                            </td>
                            <td>
                                Guarantees technical impossibility of employee
                                surveillance, credential theft, or commercial
                                profiling.
                            </td>
                            <td>
                                Never collected, never transmitted, and never
                                stored.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="data-privacy-pillars">
                <div className="data-pillar-card">
                    <strong>Pseudonymous Identity</strong>
                    <p>
                        Devices generate a local randomized identifier (
                        <code>ABLE-XXXXXXXX</code>) that is never tied to names,
                        corporate emails, or hardware MAC addresses.
                    </p>
                </div>
                <div className="data-pillar-card">
                    <strong>TLS Certificate Pinning</strong>
                    <p>
                        All network traffic is locked to the research server
                        origin with SPKI certificate pinning; credentials and
                        cookies are omitted entirely (
                        <code>credentials: &apos;omit&apos;</code>).
                    </p>
                </div>
                <div className="data-pillar-card">
                    <strong>Right to Erasure</strong>
                    <p>
                        Users can uninstall at any time to immediately cease
                        collection, or contact the research operator to purge
                        all telemetry linked to their pseudonymous identifier.
                    </p>
                </div>
            </div>
        </div>
    );
}
