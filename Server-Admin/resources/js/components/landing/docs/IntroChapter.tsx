export function IntroChapter() {
    return (
        <div className="doc-pane active" id="pane-intro">
            <div className="intro-container">
                <div className="intro-lead-box">
                    <div className="intro-badge-lead">
                        <svg
                            width={14}
                            height={14}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <circle cx={12} cy={12} r={10} />
                            <line x1={12} y1={16} x2={12} y2={12} />
                            <line x1={12} y1={8} x2={12.01} y2={8} />
                        </svg>
                        <span>PROJECT OVERVIEW & RESEARCH RATIONALE</span>
                    </div>
                    <h3>The ABLE Research Initiative</h3>
                    <p>
                        <strong>
                            ABLE (Adaptive Browser-Level Extension)
                        </strong>{' '}
                        is a Data Loss Prevention (DLP) and web-based security
                        tool engineered to prevent the critical blind spot of
                        Shadow IT by offering a secondary level of protection
                        against decentralized web browsing. Modern network
                        perimeter firewalls and security gateways are
                        structurally blind to end-to-end encrypted TLS traffic
                        and WebSocket streams; consequently, sensitive corporate
                        credentials, source code, and enterprise documents are
                        routinely exfiltrated into unsanctioned AI chat
                        platforms, generative assistants, and untrusted cloud web
                        applications before IT governance can intervene.
                    </p>
                    <p>
                        Rather than attempting to inspect packets after they
                        depart the device or deploying intrusive kernel-level
                        surveillance agents, ABLE investigates a paradigm shift:{' '}
                        <strong>
                            enforcing pre-flight data governance directly within
                            the browser runtime itself
                        </strong>
                        . By holding outbound payloads in memory and scoring
                        risk patterns before network dispatch, ABLE provides
                        knowledge workers with real-time situational awareness
                        and conscious decision agency.
                    </p>
                </div>

                <div className="intro-section-title">
                    <svg
                        width={18}
                        height={18}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <circle cx={12} cy={12} r={10} />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1={12} y1={17} x2={12.01} y2={17} />
                    </svg>
                    <span>Three Core Research Inquiries</span>
                </div>

                <div className="inquiry-grid">
                    <div className="inquiry-card">
                        <div className="inquiry-badge-row">
                            <span className="inquiry-num">01</span>
                            <span className="inquiry-tag">
                                PRE-FLIGHT DEFENSE
                            </span>
                        </div>
                        <h4>
                            Can in-browser interception serve as a reliable last
                            line of defense?
                        </h4>
                        <p>
                            Traditional DLP evaluates data after it departs the
                            endpoint. ABLE studies whether intercepting DOM
                            transfer events and holding payloads in memory can
                            systematically prevent accidental data leakage
                            before a single byte touches the wire.
                        </p>
                    </div>

                    <div className="inquiry-card">
                        <div className="inquiry-badge-row">
                            <span className="inquiry-num">02</span>
                            <span className="inquiry-tag">HUMAN FACTORS</span>
                        </div>
                        <h4>
                            How do knowledge workers respond to in-the-moment
                            warnings?
                        </h4>
                        <p>
                            Security prompts frequently induce alert fatigue. By
                            measuring proceed, cancel, and repeat-visit
                            interaction rates across diverse workflows, ABLE
                            evaluates what makes an in-browser warning
                            cognitively persuasive rather than merely
                            disruptive.
                        </p>
                    </div>

                    <div className="inquiry-card">
                        <div className="inquiry-badge-row">
                            <span className="inquiry-num">03</span>
                            <span className="inquiry-tag">
                                HEURISTIC ACCURACY
                            </span>
                        </div>
                        <h4>
                            How accurately can client-side pattern scoring
                            perform in real time?
                        </h4>
                        <p>
                            Investigating the trade-offs between client-side
                            regex heuristics and server-assisted scoring against
                            real-world Generative AI and cloud paste workflows,
                            measuring false-positive friction against
                            high-entropy detection efficacy.
                        </p>
                    </div>
                </div>

                <div className="intro-axioms-row">
                    <div className="axiom-card">
                        <span className="axiom-label">AXIOM I</span>
                        <strong>User Agency First</strong>
                        <p>
                            Decisions are never made invisibly. Flagged
                            transfers provide explicit, contextual choices
                            (Proceed, Cancel, or Hold) rather than opaque silent
                            blocks.
                        </p>
                    </div>

                    <div className="axiom-card">
                        <span className="axiom-label">AXIOM II</span>
                        <strong>Fail-Closed Security Posture</strong>
                        <p>
                            If the scoring server is unreachable or offline,
                            outbound sensitive transfers fail safe—held securely
                            in local memory rather than sent uninspected.
                        </p>
                    </div>

                    <div className="axiom-card">
                        <span className="axiom-label">AXIOM III</span>
                        <strong>Zero-Surveillance Standard</strong>
                        <p>
                            Strictly no advertising, no third-party telemetry,
                            no browsing history logging, and no keystroke
                            tracking. Local pseudonymous IDs protect user
                            privacy.
                        </p>
                    </div>
                </div>

                <div className="intro-metrics-strip">
                    <div className="metric-strip-card">
                        <span className="metric-strip-val">&lt; 1.2ms</span>
                        <span className="metric-strip-lbl">
                            Synchronous DOM Hook Overhead
                        </span>
                    </div>
                    <div className="metric-strip-card">
                        <span className="metric-strip-val">100%</span>
                        <span className="metric-strip-lbl">
                            In-Memory Pre-Flight Inspection
                        </span>
                    </div>
                    <div className="metric-strip-card">
                        <span className="metric-strip-val">HMAC-SHA-256</span>
                        <span className="metric-strip-lbl">
                            Cryptographically Signed Policies
                        </span>
                    </div>
                    <div className="metric-strip-card">
                        <span className="metric-strip-val">0 Bytes</span>
                        <span className="metric-strip-lbl">
                            File Content Retained in Server Logs
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
