export function ArchChapter() {
    return (
        <div className="doc-pane active" id="pane-arch">
            <div className="arch-container">
                {/* Lead Intro Banner */}
                <div className="arch-lead-banner">
                    <div className="arch-badge-lead">
                        <svg
                            width={14}
                            height={14}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <polygon points="12 2 2 7 12 12 22 7 12 2" />
                            <polyline points="2 17 12 22 22 17" />
                            <polyline points="2 12 12 17 22 12" />
                        </svg>
                        <span>EXECUTION TOPOLOGY &amp; PROCESS ISOLATION</span>
                    </div>
                    <h3>
                        Tripartite Defense Architecture &amp; Process Isolation
                    </h3>
                    <p>
                        To ensure complete immunity against webpage script
                        tampering, Prototype Pollution, and adversarial DOM
                        manipulation, ABLE enforces a strict three-tier
                        execution hierarchy within the Chromium runtime. Each
                        tier operates under independent security contexts and
                        least-privilege boundaries, maintaining sub-millisecond
                        execution times without allowing unvetted web
                        applications to bypass or disable security hooks.
                    </p>
                </div>

                {/* 3 Tier Architecture Cards */}
                <div className="arch-tiers-list">
                    {/* Tier 1 Card */}
                    <div className="arch-tier-card">
                        <div className="arch-card-header">
                            <div className="arch-tier-badge">
                                <span className="tier-tag">TIER 01</span>
                                <h4>Page-World Transport Interceptors</h4>
                            </div>
                            <span className="arch-context-pill">
                                MAIN EXECUTION WORLD · INJECTED SCRIPTS
                            </span>
                        </div>
                        <p className="arch-card-desc">
                            Injected via dynamically generated{' '}
                            <code>&lt;script&gt;</code> elements with SHA-256
                            asset-integrity pinning. Operates directly in the
                            host page&apos;s execution world to hook native
                            dispatch channels before page scripts can serialize,
                            mutate, or obfuscate sensitive payloads.
                        </p>
                        <div className="arch-feature-group">
                            <span className="arch-feature-label">
                                INTERCEPTED CHANNELS &amp; BUFFERS
                            </span>
                            <div className="arch-chips-wrap">
                                <span className="arch-chip">
                                    <code>window.fetch</code>
                                </span>
                                <span className="arch-chip">
                                    <code>XMLHttpRequest.send</code>
                                </span>
                                <span className="arch-chip">
                                    <code>navigator.sendBeacon</code>
                                </span>
                                <span className="arch-chip">
                                    <code>WebSocket.send</code>
                                </span>
                                <span className="arch-chip">
                                    <code>input[type=&quot;file&quot;]</code>
                                </span>
                                <span className="arch-chip">
                                    Drag &amp; Drop Buffers
                                </span>
                                <span className="arch-chip">
                                    Clipboard Paste Events
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Tier 2 Card */}
                    <div className="arch-tier-card">
                        <div className="arch-card-header">
                            <div className="arch-tier-badge">
                                <span className="tier-tag">TIER 02</span>
                                <h4>Content Scripts &amp; Isolated Shadow DOM</h4>
                            </div>
                            <span className="arch-context-pill">
                                CHROMIUM ISOLATED WORLD · DOCUMENT END
                            </span>
                        </div>
                        <p className="arch-card-desc">
                            Operates strictly within Chromium&apos;s isolated
                            world context (<code>run_at: document_end</code>).
                            Houses an in-memory document parsing engine that
                            decompresses and extracts text streams with zero
                            temporary disk writes, while presenting a fully
                            sandboxed user-consent modal boundary.
                        </p>
                        <div className="arch-feature-group">
                            <span className="arch-feature-label">
                                CONTAINMENT &amp; CLIENT CAPABILITIES
                            </span>
                            <div className="arch-chips-wrap">
                                <span className="arch-chip">
                                    <code>#able-shadow-root</code> Boundary
                                </span>
                                <span className="arch-chip">
                                    Host Page CSS Isolation
                                </span>
                                <span className="arch-chip">
                                    Anti-Clickjacking Protection
                                </span>
                                <span className="arch-chip">
                                    In-Memory Text, CSV, JSON Parsing
                                </span>
                                <span className="arch-chip">
                                    Office Open XML Decompressor (
                                    <code>.docx</code>, <code>.xlsx</code>,{' '}
                                    <code>.pptx</code>)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Tier 3 Card */}
                    <div className="arch-tier-card">
                        <div className="arch-card-header">
                            <div className="arch-tier-badge">
                                <span className="tier-tag">TIER 03</span>
                                <h4>
                                    Manifest V3 Background Worker &amp; Server
                                    Sync
                                </h4>
                            </div>
                            <span className="arch-context-pill">
                                EXTENSION SERVICE WORKER · ENCRYPTED STORE
                            </span>
                        </div>
                        <p className="arch-card-desc">
                            An ephemeral background service worker coordinating
                            pre-flight navigation classification and
                            deterministic policy synchronization. Validates
                            cryptographic signatures from the self-hosted
                            Laravel research server and flushes anonymized audit
                            logs over pinned TLS.
                        </p>
                        <div className="arch-feature-group">
                            <span className="arch-feature-label">
                                SERVICES &amp; SECURITY PROTOCOLS
                            </span>
                            <div className="arch-chips-wrap">
                                <span className="arch-chip">
                                    <code>
                                        chrome.webNavigation.onCommitted
                                    </code>
                                </span>
                                <span className="arch-chip">
                                    <code>chrome.alarms</code> Sync Worker
                                </span>
                                <span className="arch-chip">
                                    HMAC-SHA-256 Ruleset Signatures
                                </span>
                                <span className="arch-chip">
                                    AES Encrypted Local Storage
                                </span>
                                <span className="arch-chip">
                                    Pinned TLS Telemetry Queue
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Implementation Pipeline Code Showcase */}
                <div className="arch-code-section">
                    <div className="arch-code-intro">
                        <div className="arch-badge-lead">
                            <svg
                                width={14}
                                height={14}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <polyline points="16 18 22 12 16 6" />
                                <polyline points="8 6 2 12 8 18" />
                            </svg>
                            <span>RUNTIME IMPLEMENTATION</span>
                        </div>
                        <h4>Pre-Flight Interception Pipeline</h4>
                        <p>
                            Outbound dispatch hooks intercept network calls in
                            real time, inspecting buffer contents against cached
                            policy criteria prior to transmission release.
                        </p>
                    </div>

                    <div className="code-preview-glass">
                        <div className="code-header code-header-row">
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}
                            >
                                <span className="code-dot" />
                                <span className="code-title">
                                    interceptor-pipeline.ts
                                </span>
                            </div>
                            <span className="code-lang-pill">
                                TypeScript / Chromium V3
                            </span>
                        </div>
                        <pre className="code-snippet">
                            <code>
                                <span className="c-comment">
                                    {
                                        '// Integrity-Verified Pre-Flight Transport Hook'
                                    }
                                </span>
                                {'\n'}
                                <span className="c-keyword">const</span>{' '}
                                dispatchHook = {'{'}
                                {'\n'}
                                {'  '}hook:{' '}
                                <span className="c-string">
                                    &quot;window.fetch&quot;
                                </span>
                                ,{'\n'}
                                {'  '}action:{' '}
                                <span className="c-keyword">async</span> (input:
                                RequestInfo, init?: RequestInit) =&gt; {'{'}
                                {'\n'}
                                {'    '}
                                <span className="c-comment">
                                    {
                                        '// 1. Extract outbound payload from memory buffer'
                                    }
                                </span>
                                {'\n'}
                                {'    '}
                                <span className="c-keyword">const</span> payload
                                = <span className="c-keyword">await</span>{' '}
                                extractBuffer(init?.body);
                                {'\n'}
                                {'\n'}
                                {'    '}
                                <span className="c-comment">
                                    {
                                        '// 2. Check site policy against signed offline cache'
                                    }
                                </span>
                                {'\n'}
                                {'    '}
                                <span className="c-keyword">const</span>{' '}
                                domainVerdict ={' '}
                                <span className="c-keyword">await</span>{' '}
                                classifyDomain(window.location.hostname);
                                {'\n'}
                                {'\n'}
                                {'    '}
                                <span className="c-comment">
                                    {
                                        '// 3. In-memory pattern evaluation & score generation'
                                    }
                                </span>
                                {'\n'}
                                {'    '}
                                <span className="c-keyword">const</span>{' '}
                                riskAssessment ={' '}
                                <span className="c-keyword">await</span>{' '}
                                scoreContent(payload, domainVerdict);
                                {'\n'}
                                {'\n'}
                                {'    '}
                                <span className="c-comment">
                                    {
                                        '// 4. Intervene if sensitive patterns exceed threshold'
                                    }
                                </span>
                                {'\n'}
                                {'    '}
                                <span className="c-keyword">if</span>{' '}
                                (riskAssessment.score &gt;{' '}
                                <span className="c-num">60</span>) {'{'}
                                {'\n'}
                                {'      '}
                                <span className="c-keyword">const</span>{' '}
                                userDecision ={' '}
                                <span className="c-keyword">await</span>{' '}
                                shadowPrompt.requestConsent(riskAssessment);
                                {'\n'}
                                {'      '}
                                <span className="c-keyword">if</span>{' '}
                                (userDecision ==={' '}
                                <span className="c-string">
                                    &quot;CANCEL&quot;
                                </span>
                                ) {'{'}
                                {'\n'}
                                {'        '}
                                cleanInputFields();
                                {'\n'}
                                {'        '}
                                <span className="c-keyword">
                                    throw new
                                </span>{' '}
                                DOMException(
                                <span className="c-string">
                                    &quot;Egress halted by user.&quot;
                                </span>
                                ,{' '}
                                <span className="c-string">
                                    &quot;AbortError&quot;
                                </span>
                                );{'\n'}
                                {'      '}
                                {'}'}
                                {'\n'}
                                {'    '}
                                {'}'}
                                {'\n'}
                                {'\n'}
                                {'    '}
                                <span className="c-comment">
                                    {
                                        '// 5. Clean release without transport mutation'
                                    }
                                </span>
                                {'\n'}
                                {'    '}
                                <span className="c-keyword">return</span>{' '}
                                nativeFetch(input, init);{'\n'}
                                {'  '}
                                {'}'}
                                {'\n'}
                                {'}'};
                            </code>
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}
