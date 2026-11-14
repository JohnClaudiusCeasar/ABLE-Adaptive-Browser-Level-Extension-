import { useState } from 'react';

interface DownloadSectionProps {
    extensionVersion?: string;
}

export function DownloadSection({ extensionVersion }: DownloadSectionProps) {
    const [csCopied, setCsCopied] = useState(false);

    const handleCopyId = () => {
        navigator.clipboard
            .writeText('fladkbcbllgnfekjkfochbjknebammbi')
            .then(() => {
                setCsCopied(true);
                setTimeout(() => setCsCopied(false), 2000);
            });
    };

    return (
        <section
            className="bleed-panel in-view no-scrollbar"
            id="download"
            data-section="download"
        >
            <div className="panel-inner download-inner no-scrollbar">
                <div className="section-lead">
                    <span className="minimal-badge">EXTENSION PACKAGE</span>
                    <h2 className="section-heading">Download ABLE</h2>
                    <p className="section-subtext">
                        Install the research extension directly into Google
                        Chrome, Brave, Microsoft Edge, or any Chromium browser.
                    </p>
                </div>

                <div className="download-grid">
                    {/* Download Hero Card */}
                    <div className="glass-card dl-hero-card">
                        <div className="dl-card-header">
                            <div className="dl-app-icon">
                                <img
                                    src="/assets/ABLE-LOGO.svg"
                                    alt="ABLE"
                                    className="dl-img"
                                    onError={(e) => {
                                        (
                                            e.currentTarget as HTMLImageElement
                                        ).src = '/assets/icon-128.png';
                                    }}
                                />
                            </div>
                            <div className="dl-app-info">
                                <h3>
                                    ABLE - Adaptive Browser-Level Extension
                                </h3>
                                <div className="meta-tags">
                                    <span className="tag tag-highlight">
                                        Chrome Web Store
                                    </span>
                                    <span className="tag">
                                        {extensionVersion
                                            ? `v${extensionVersion}`
                                            : 'v0.1.58'}
                                    </span>
                                    <span className="tag">Manifest V3</span>
                                    <span className="tag">
                                        Official Release
                                    </span>
                                </div>
                            </div>
                        </div>

                        <p className="dl-description">
                            Official published release for Google Chrome and
                            Chromium browsers. Operates in real-time at the
                            browser boundary to intercept unvetted file uploads,
                            classify domain risks, and protect sensitive
                            credentials, API keys, and enterprise data.
                        </p>

                        <div className="dl-cta-row">
                            <a
                                href="https://chromewebstore.google.com/detail/able-adaptive-browser-lev/fladkbcbllgnfekjkfochbjknebammbi?authuser=0&hl=en"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-solid btn-large"
                                id="main-download-btn"
                            >
                                <svg
                                    width={18}
                                    height={18}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    <path d="m9 12 2 2 4-4" />
                                </svg>
                                <span>Add to Chrome (Web Store)</span>
                                <svg
                                    width={13}
                                    height={13}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1={10} y1={14} x2={21} y2={3} />
                                </svg>
                            </a>
                        </div>

                        {/* Extension ID Checksum Box */}
                        <div className="checksum-glass-box">
                            <span className="cs-label">CHROME STORE ID</span>
                            <code className="cs-value" id="cs-hash">
                                fladkbcbllgnfekjkfochbjknebammbi
                            </code>
                            <button
                                type="button"
                                className="btn-copy-cs"
                                id="cs-copy-btn"
                                onClick={handleCopyId}
                                title="Copy Extension ID"
                            >
                                <svg
                                    width={13}
                                    height={13}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <rect
                                        x={9}
                                        y={9}
                                        width={13}
                                        height={13}
                                        rx={2}
                                        ry={2}
                                    />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                                <span>{csCopied ? 'Copied!' : 'Copy'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Installation Walkthrough Card */}
                    <div className="glass-card install-walkthrough-card">
                        <h3>Installation Walkthrough</h3>

                        <div className="steps-list">
                            <div className="step-card">
                                <span className="step-badge">1</span>
                                <div>
                                    <h4>Open Web Store Listing</h4>
                                    <p>
                                        Click <strong>Add to Chrome</strong>{' '}
                                        above to visit the verified extension
                                        page on the Chrome Web Store.
                                    </p>
                                </div>
                            </div>

                            <div className="step-card">
                                <span className="step-badge">2</span>
                                <div>
                                    <h4>Confirm Installation</h4>
                                    <p>
                                        Click the blue{' '}
                                        <strong>Add to Chrome</strong> button on
                                        the store, then confirm by selecting{' '}
                                        <strong>Add extension</strong>.
                                    </p>
                                </div>
                            </div>

                            <div className="step-card">
                                <span className="step-badge">3</span>
                                <div>
                                    <h4>Pin & Activate Protection</h4>
                                    <p>
                                        Click the puzzle icon in your browser
                                        toolbar and pin the{' '}
                                        <strong>ABLE shield</strong> icon for
                                        real-time visibility.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="compat-footer">
                            <span>
                                Compatible with Google Chrome, Brave, Microsoft
                                Edge, Opera, and Vivaldi.
                            </span>
                        </div>
                    </div>
                </div>

                {/* What to Expect Card */}
                <div className="glass-card expectations-card no-scrollbar">
                    <div className="expectations-header">
                        <span className="sub-badge-minimal">
                            USER EXPERIENCE OVERVIEW
                        </span>
                        <h3>What to Expect Once Installed on Your Device</h3>
                        <p>
                            Immediately after adding ABLE to your browser, here
                            is how the extension safeguards your daily browsing
                            workflow:
                        </p>
                    </div>

                    <div className="expectations-grid">
                        <div className="expect-item">
                            <div
                                className="expect-icon-wrap"
                                style={{ color: 'var(--color-able-green)' }}
                            >
                                <svg
                                    width={18}
                                    height={18}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </div>
                            <div>
                                <h4>Live Toolbar Status</h4>
                                <p>
                                    Click the pinned ABLE shield anytime to
                                    inspect the current domain&apos;s safety
                                    classification (Safe, Unlisted, or
                                    Restricted) and view your active protection
                                    status.
                                </p>
                            </div>
                        </div>

                        <div className="expect-item">
                            <div
                                className="expect-icon-wrap"
                                style={{ color: 'var(--accent-amber)' }}
                            >
                                <svg
                                    width={18}
                                    height={18}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <circle cx={12} cy={12} r={10} />
                                    <line x1={12} y1={8} x2={12} y2={12} />
                                    <line x1={12} y1={16} x2={12.01} y2={16} />
                                </svg>
                            </div>
                            <div>
                                <h4>Smart Domain Safety Nudges</h4>
                                <p>
                                    When you visit an unlisted or newly
                                    encountered third-party website, an
                                    unobtrusive educational alert informs you
                                    before you submit data or interact.
                                </p>
                            </div>
                        </div>

                        <div className="expect-item">
                            <div
                                className="expect-icon-wrap"
                                style={{ color: 'var(--accent-cyan)' }}
                            >
                                <svg
                                    width={18}
                                    height={18}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1={16} y1={13} x2={8} y2={13} />
                                    <line x1={16} y1={17} x2={8} y2={17} />
                                </svg>
                            </div>
                            <div>
                                <h4>Pre-Flight Upload Hold</h4>
                                <p>
                                    Outbound documents (.pdf, .docx, .xlsx) and
                                    text inputs are parsed locally in memory
                                    before network transmission to screen for
                                    sensitive data.
                                </p>
                            </div>
                        </div>

                        <div className="expect-item">
                            <div
                                className="expect-icon-wrap"
                                style={{ color: 'var(--accent-purple)' }}
                            >
                                <svg
                                    width={18}
                                    height={18}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                    <line x1={12} y1={9} x2={12} y2={13} />
                                    <line x1={12} y1={17} x2={12.01} y2={17} />
                                </svg>
                            </div>
                            <div>
                                <h4>Shadow DOM Decision Prompt</h4>
                                <p>
                                    If sensitive credentials or API keys are
                                    detected, an isolated modal reveals the risk
                                    score and detected patterns, giving you
                                    agency to Proceed or Cancel.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
