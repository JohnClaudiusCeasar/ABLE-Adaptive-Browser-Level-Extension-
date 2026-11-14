export function HowChapter() {
    return (
        <div className="doc-pane active" id="pane-how">
            <div className="timeline-intro">
                <h4>The Four-Phase Client-Side Interception Lifecycle</h4>
                <p>
                    ABLE functions as an autonomous, in-browser proxy that
                    monitors outbound data streams at the DOM boundary. The
                    diagram below illustrates the exact sequence of technical
                    events from the moment a user initiates an upload or text
                    submission until clean release or input cancellation.
                </p>
            </div>

            <div className="timeline-glass">
                <div className="timeline-item">
                    <div className="time-header-row">
                        <span className="time-marker">01</span>
                        <span className="time-phase-tag">INTERCEPTION</span>
                    </div>
                    <div className="time-content">
                        <h4>Pre-Flight Transport Trapping</h4>
                        <p>
                            When a user selects a file via file picker, drags an
                            archive into the browser, or pastes sensitive text
                            into a form input or web chat, ABLE’s page-world
                            interceptors pause the native asynchronous dispatch
                            chain (wrapping <code>fetch</code>, <code>XHR</code>
                            , <code>sendBeacon</code>, and{' '}
                            <code>WebSocket</code>) before any bytes depart the
                            client.
                        </p>
                    </div>
                </div>

                <div className="timeline-item">
                    <div className="time-header-row">
                        <span className="time-marker">02</span>
                        <span className="time-phase-tag">
                            PARSING & SCORING
                        </span>
                    </div>
                    <div className="time-content">
                        <h4>In-Memory Document Extraction</h4>
                        <p>
                            The content script deconstructs plain text, CSV,
                            JSON, and Office Open XML archives (
                            <code>.docx</code>, <code>.xlsx</code>,{' '}
                            <code>.pptx</code>) entirely in RAM. The extracted
                            text slice is evaluated against HMAC-SHA-256 signed
                            criteria for API tokens, secret keys, private
                            certificates, and enterprise PII to compute a
                            comprehensive risk score (0–100).
                        </p>
                    </div>
                </div>

                <div className="timeline-item">
                    <div className="time-header-row">
                        <span className="time-marker">03</span>
                        <span className="time-phase-tag">USER AGENCY</span>
                    </div>
                    <div className="time-content">
                        <h4>Shadow DOM Decision Prompt</h4>
                        <p>
                            If sensitive data is identified, ABLE freezes host
                            page interaction and projects a tamper-proof Shadow
                            DOM modal. The dialog presents the detected risk
                            score, flagged asset categories, and matched pattern
                            summaries—giving the user complete clarity and
                            conscious agency to either{' '}
                            <strong>Proceed Anyway</strong> or{' '}
                            <strong>Cancel Upload</strong>.
                        </p>
                    </div>
                </div>

                <div className="timeline-item">
                    <div className="time-header-row">
                        <span className="time-marker">04</span>
                        <span className="time-phase-tag">ENFORCEMENT</span>
                    </div>
                    <div className="time-content">
                        <h4>Sanitization or Clean Release</h4>
                        <p>
                            If cancelled, file inputs are safely cleared and DOM
                            state is sanitized to prevent accidental
                            re-submission. If authorized, the held network
                            promise is cleanly resolved, releasing the payload
                            without network latency or payload corruption, and
                            an anonymized egress record is queued for research
                            analysis.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
