import { useEffect, useRef, useState } from 'react';
import { ArchChapter } from './docs/ArchChapter';
import { DataChapter } from './docs/DataChapter';
import { GuideChapter } from './docs/GuideChapter';
import { HowChapter } from './docs/HowChapter';
import { IntroChapter } from './docs/IntroChapter';

const docChapters = [
    {
        id: 'intro' as const,
        chapter: '01',
        title: 'Introduction',
        subtitle: 'System Overview & Objectives',
    },
    {
        id: 'arch' as const,
        chapter: '02',
        title: 'Core Architecture',
        subtitle: 'Topology & Pipeline Flow',
    },
    {
        id: 'data' as const,
        chapter: '03',
        title: 'Data Collection & Privacy',
        subtitle: 'Telemetry Boundaries & Ethics',
    },
    {
        id: 'how' as const,
        chapter: '04',
        title: 'How ABLE Operates',
        subtitle: 'DOM Interception & Evaluation',
    },
    {
        id: 'guide' as const,
        chapter: '05',
        title: 'Usage & Administration',
        subtitle: 'Deployment & Audit Procedures',
    },
];

type DocTab = (typeof docChapters)[number]['id'];

export function DocsSection() {
    const [activeDocTab, setActiveDocTab] = useState<DocTab>('intro');
    const docsContentRef = useRef<HTMLDivElement | null>(null);

    // Reset documentation content scroll to top when chapter changes
    useEffect(() => {
        if (docsContentRef.current) {
            docsContentRef.current.scrollTop = 0;
        }
    }, [activeDocTab]);

    return (
        <section
            className="bleed-panel in-view no-scrollbar"
            id="docs"
            data-section="docs"
        >
            <div className="panel-inner docs-inner">
                <div className="section-lead">
                    <span className="minimal-badge">TECHNICAL SPECIFICATION</span>
                    <h2 className="section-heading">How ABLE Operates</h2>
                    <p className="section-subtext">
                        A look into the client-side interception mechanisms,
                        data collection boundaries, and operational guides.
                    </p>
                </div>

                {/* Glassmorphic Documentation Wrapper */}
                <div className="docs-glass-container glass-card">
                    {/* Left Component: Chapter-based Navigation */}
                    <aside
                        className="docs-chapter-nav no-scrollbar"
                        aria-label="Documentation Chapters"
                        data-scrollable="true"
                    >
                        <div className="docs-chapter-header">
                            <h3 className="docs-chapter-main-title">
                                CHAPTERS
                            </h3>
                        </div>
                        <nav className="docs-chapter-list">
                            {docChapters.map((ch) => {
                                const isActive = activeDocTab === ch.id;

                                return (
                                    <button
                                        key={ch.id}
                                        type="button"
                                        className={`chapter-nav-card ${isActive ? 'active' : ''}`}
                                        onClick={() => setActiveDocTab(ch.id)}
                                        aria-current={
                                            isActive ? 'page' : undefined
                                        }
                                    >
                                        <div className="chapter-nav-top">
                                            <span className="chapter-tag">
                                                CHAPTER {ch.chapter}
                                            </span>
                                            <span className="chapter-indicator-dot" />
                                        </div>
                                        <div className="chapter-title">
                                            {ch.title}
                                        </div>
                                        <div className="chapter-subtitle">
                                            {ch.subtitle}
                                        </div>
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Embedded Green Divider in-between these two components */}
                    <div
                        className="docs-vertical-divider"
                        role="separator"
                        aria-orientation="vertical"
                    />

                    {/* Right Component: Section Description & Content Area */}
                    <div
                        ref={docsContentRef}
                        className="docs-content-area no-scrollbar"
                        data-scrollable="true"
                    >
                        {activeDocTab === 'intro' && <IntroChapter />}
                        {activeDocTab === 'arch' && <ArchChapter />}
                        {activeDocTab === 'data' && <DataChapter />}
                        {activeDocTab === 'how' && <HowChapter />}
                        {activeDocTab === 'guide' && <GuideChapter />}
                    </div>
                </div>
            </div>
        </section>
    );
}
