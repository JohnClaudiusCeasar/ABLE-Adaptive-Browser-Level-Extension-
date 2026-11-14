interface HomeSectionProps {
    scrollToSection: (
        section: 'home' | 'docs' | 'download' | 'contact',
    ) => void;
}

export function HomeSection({ scrollToSection }: HomeSectionProps) {
    return (
        <section
            className="bleed-panel in-view no-scrollbar"
            id="home"
            data-section="home"
        >
            <div className="panel-inner hero-inner">
                <div className="hero-intro">
                    <div className="minimal-badge">
                        <span className="badge-dot" />
                        <span>
                            SHADOW IT PREVENTION & DATA EGRESS MONITORING
                        </span>
                    </div>

                    <h1 className="hero-headline">
                        Defend Every Click.
                        <br />
                        <span className="text-sheen">
                            Stop Leaks Before They Reach The Cloud.
                        </span>
                    </h1>

                    <p className="hero-description">
                        <strong>ABLE</strong> is a lightweight web security tool
                        that monitors user web activity across any network, and
                        prevents accidental file uploads before they enter the
                        cloud. Operating seamlessly in the background, it
                        classifies domain risks and safeguards sensitive
                        credentials, API keys, and enterprise data with
                        real-time in-browser interception.
                    </p>

                    <div className="hero-actions">
                        <a
                            href="#download"
                            className="btn-solid"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection('download');
                            }}
                        >
                            <span>Download Extension</span>
                            <svg
                                width={15}
                                height={15}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1={12} y1={15} x2={12} y2={3} />
                            </svg>
                        </a>
                        <a
                            href="#docs"
                            className="btn-ghost"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection('docs');
                            }}
                        >
                            <span>Read Architecture</span>
                        </a>
                    </div>
                </div>

                {/* Bento Cards */}
                <div className="bento-grid">
                    {/* Card 1: Problem */}
                    <div className="glass-card bento-card">
                        <div className="bento-inner-highlight" />

                        {/* Oversized Background Logo (mockup ui design) */}
                        <div className="bento-overlapping-logo problem">
                            <div className="bento-logo-icon-container">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.25}
                                >
                                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                    <line x1={12} y1={9} x2={12} y2={13} />
                                    <line x1={12} y1={17} x2={12.01} y2={17} />
                                </svg>
                            </div>
                        </div>

                        <div className="bento-card-body">
                            <h3>The Problem</h3>
                            <p>
                                Modern web platforms and generative AI tools
                                offer unprecedented convenience. However, this
                                accessibility often leads to unmonitored data
                                exposure: individuals routinely submit
                                proprietary source code, internal documents, API
                                keys, and customer data into external services
                                that operate completely outside organizational
                                security governance.
                            </p>
                        </div>
                    </div>

                    {/* Card 2: Solution */}
                    <div className="glass-card bento-card">
                        <div className="bento-inner-highlight" />

                        {/* Oversized Background Logo (mockup ui design) */}
                        <div className="bento-overlapping-logo solution">
                            <div className="bento-logo-icon-container">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.25}
                                >
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    <path d="m9 12 2 2 4-4" />
                                </svg>
                            </div>
                        </div>

                        <div className="bento-card-body">
                            <h3>The Solution</h3>
                            <p>
                                ABLE establishes proactive, client-side
                                protection directly at the browser boundary.
                                Before outbound files or text submissions depart
                                the device, ABLE inspects the content, evaluates
                                potential exposure against verified risk
                                patterns, and prompts the user for informed
                                confirmation—stopping inadvertent leaks before
                                data ever reaches external servers.
                            </p>
                        </div>
                    </div>

                    {/* Card 3: Mission */}
                    <div className="glass-card bento-card">
                        <div className="bento-inner-highlight" />

                        {/* Oversized Background Logo (mockup ui design) */}
                        <div className="bento-overlapping-logo mission">
                            <div className="bento-logo-icon-container">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.25}
                                >
                                    <rect
                                        width={18}
                                        height={11}
                                        x={3}
                                        y={11}
                                        rx={2}
                                        ry={2}
                                    />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            </div>
                        </div>

                        <div className="bento-card-body">
                            <h3>The Mission</h3>
                            <p>
                                Security should never come at the expense of
                                user privacy. ABLE is engineered to prevent data
                                egress without invasive surveillance—operating
                                free of identity tracking, cross-site profiling,
                                or personal browsing audits. We believe the most
                                resilient defense is one that genuinely empowers
                                users with transparent, client-side agency.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Divider Below Cards */}
                <div className="glass-divider" />

                {/* Cardless Info Section: Why Shadow IT? */}
                <div className="cardless-info-section">
                    <div className="cardless-header">
                        <span className="sub-badge-minimal">
                            SECURITY RISK SPOTLIGHT
                        </span>
                        <h2 className="cardless-title">Why Shadow IT?</h2>
                        <p className="cardless-intro">
                            Shadow IT emerges whenever individuals adopt web
                            applications, browser tools, or generative AI
                            assistants for daily work without formal evaluation
                            by IT and security teams. Driven by productivity
                            rather than malicious intent, users leverage these
                            platforms to streamline urgent workflows—yet this
                            unmanaged adoption creates one of the most
                            pervasive, overlooked security vulnerabilities
                            facing modern organizations.
                        </p>
                    </div>

                    <div className="cardless-grid">
                        <div className="cardless-block">
                            <div className="cardless-block-tag">
                                <span className="tag-bullet amber" />
                                <h4>The Silent Security Risk</h4>
                            </div>
                            <p>
                                When confidential files, financial spreadsheets,
                                or proprietary prompts are submitted to unvetted
                                cloud tools, that data immediately departs
                                organizational custody. External services
                                frequently log user submissions indefinitely,
                                repurpose inputs for third-party AI model
                                training, or lack verified data retention
                                policies. Because these transactions occur
                                seamlessly over standard HTTPS browser traffic,
                                security teams remain blind to critical assets
                                leaving the perimeter until a potential exposure
                                has already transpired.
                            </p>
                        </div>

                        <div className="cardless-block">
                            <div className="cardless-block-tag">
                                <span className="tag-bullet green" />
                                <h4>Why It Must Be Addressed</h4>
                            </div>
                            <p>
                                As workplaces decentralize across remote
                                locations, home networks, and personal devices,
                                traditional perimeter firewalls can no longer
                                provide adequate visibility. Imposing rigid,
                                blanket website blocks only disrupts legitimate
                                productivity and inevitably drives teams toward
                                even less visible workarounds. Effectively
                                addressing Shadow IT requires engaging users at
                                the point of action: directly within the
                                browser, providing real-time, non-disruptive
                                guidance that prevents sensitive information
                                from escaping into unvetted cloud environments.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Divider Below Why Shadow IT */}
                <div className="glass-divider" />

                {/* Cardless Info Section: Why Traditional Networks Fail */}
                <div className="cardless-info-section">
                    <div className="cardless-header">
                        <span className="sub-badge-minimal">
                            PERIMETER DEFENSE LIMITATIONS
                        </span>
                        <h2 className="cardless-title">
                            Why Traditional Networks Fail?
                        </h2>
                        <p className="cardless-intro">
                            Conventional network security—such as
                            Next-Generation Firewalls (NGFWs), on-premise
                            proxies, and perimeter gateways—was engineered for a
                            centralized era when all corporate data moved
                            through hardwired office cables. In today&apos;s
                            decentralized web landscape, these traditional
                            appliances face fundamental blind spots that make
                            detecting and preventing Shadow IT virtually
                            impossible.
                        </p>
                    </div>

                    <div className="cardless-grid">
                        <div className="cardless-block">
                            <div className="cardless-block-tag">
                                <span className="tag-bullet cyan" />
                                <h4>
                                    Modern Web Architectures & End-to-End
                                    Encryption
                                </h4>
                            </div>
                            <p>
                                Nearly all modern web traffic is protected by
                                end-to-end TLS 1.3 encryption. For a firewall to
                                inspect what a user is pasting or uploading, it
                                must perform aggressive SSL/TLS decryption—a
                                process that introduces severe network latency,
                                privacy liabilities, and frequently breaks
                                modern web standards like WebSockets, HTTP/2
                                multiplexing, and certificate pinning.
                                Furthermore, cloud-native SaaS and generative AI
                                tools operate over the same standard HTTPS port
                                (443) hosted on ubiquitous cloud CDNs. To a
                                perimeter firewall, an employee uploading
                                confidential intellectual property looks
                                completely indistinguishable from benign web
                                browsing.
                            </p>
                        </div>

                        <div className="cardless-block">
                            <div className="cardless-block-tag">
                                <span className="tag-bullet red" />
                                <h4>
                                    Wireless Decentralization & Off-Perimeter
                                    Work
                                </h4>
                            </div>
                            <p>
                                As workplaces shift across home wireless
                                routers, remote hotspots, and mobile
                                connections, user traffic frequently bypasses
                                physical corporate gateways altogether. Even
                                when enterprise VPNs are deployed, organizations
                                routinely implement split-tunneling to prevent
                                bandwidth bottlenecks during video calls,
                                routing general web activity directly over local
                                wireless internet. Firewalls cannot defend a
                                perimeter that users have already left. Without
                                client-level inspection inside the browser,
                                network security remains powerless against
                                unmanaged wireless endpoints.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Divider Below Why Traditional Networks Fail */}
                <div className="glass-divider" />

                {/* Cardless Info Section: How and Why We Collect Your Data? */}
                <div className="cardless-info-section">
                    <div className="cardless-header">
                        <span className="sub-badge-minimal">
                            DATA GOVERNANCE & PRIVACY TRANSPARENCY
                        </span>
                        <h2 className="cardless-title">
                            How and Why We Collect Your Data?
                        </h2>
                        <p className="cardless-intro">
                            Effective web security governance cannot succeed
                            through clandestine monitoring; it requires radical
                            transparency and mutual trust. ABLE operates on a
                            strict principle of client-side data
                            minimization—processing sensitive content directly
                            on your local device and collecting only the
                            aggregate policy telemetry required to evaluate
                            domain risks, maintain compliance, and prevent
                            accidental data egress.
                        </p>
                    </div>

                    <div className="cardless-grid">
                        <div className="cardless-block">
                            <div className="cardless-block-tag">
                                <span className="tag-bullet green" />
                                <h4>
                                    What We Inspect & How It Operates
                                    (Local-First Processing)
                                </h4>
                            </div>
                            <p>
                                ABLE conducts pre-flight data inspections
                                entirely in-memory at the browser level before
                                any outbound network transmission can occur.
                                When files are uploaded or form inputs are
                                submitted, text payloads are parsed locally and
                                evaluated against HMAC-signed risk patterns. The
                                moment risk scoring concludes, the temporary
                                in-memory representation is purged immediately.
                                Raw documents, source code, prompt texts, and
                                personal keystrokes are never transmitted to our
                                servers or saved to persistent disk—guaranteeing
                                that confidential assets never escape client
                                custody during evaluation.
                            </p>
                        </div>

                        <div className="cardless-block">
                            <div className="cardless-block-tag">
                                <span className="tag-bullet purple" />
                                <h4>
                                    Why Data Is Collected & Governance
                                    Boundaries
                                </h4>
                            </div>
                            <p>
                                To provide organizational oversight without
                                compromising individual privacy, ABLE
                                synchronizes anonymized governance telemetry:
                                domain safety classifications (such as safe,
                                unlisted, or restricted), policy rule IDs
                                triggered, and whether an egress warning was
                                acknowledged or cancelled by the user. This data
                                allows security administrators to measure Shadow
                                IT adoption trends, detect emerging cloud
                                exposures, and tune false-positive accuracy.
                                Crucially, ABLE enforces a zero-surveillance
                                baseline: we never collect browsing histories,
                                user credentials, session cookies, search
                                queries, or persistent hardware identifiers.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
