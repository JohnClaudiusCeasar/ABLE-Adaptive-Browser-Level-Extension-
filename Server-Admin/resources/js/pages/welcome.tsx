import { Head, router } from '@inertiajs/react';
import React, { useState, useEffect, useRef } from 'react';
import '../../css/landing.css';

interface StreamMessage {
    id: number;
    author: string;
    category: 'suggestion' | 'comment' | 'complaint' | 'false-positive';
    domain: string;
    time: string;
    body: string;
    status?: string;
}

interface WelcomeProps {
    initialMessages?: StreamMessage[];
    requestCategory?: string | null;
    requestDomain?: string | null;
}

export default function Welcome({
    initialMessages = [],
    requestCategory = null,
    requestDomain = null,
}: WelcomeProps) {
    // -------------------------------------------------------------
    // State Management
    // -------------------------------------------------------------
    const [activeSection, setActiveSection] = useState<
        'home' | 'docs' | 'download' | 'contact'
    >('home');
    const [activeDocTab, setActiveDocTab] = useState<
        'intro' | 'arch' | 'data' | 'how' | 'guide'
    >('intro');
    const [csCopied, setCsCopied] = useState(false);

    // Message Board State (pre-filled when redirected by the extension's
    // "Request Access" button: /?category=access-request&domain=...#contact)
    const [selectedCat, setSelectedCat] = useState<
        | 'suggestion'
        | 'comment'
        | 'complaint'
        | 'false-positive'
        | 'access-request'
    >(() =>
        requestCategory === 'access-request' ? 'access-request' : 'suggestion',
    );
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

    const [streamMessages] = useState<StreamMessage[]>(() => {
        if (initialMessages && initialMessages.length > 0) {
            return initialMessages;
        }

        return [
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
    });

    // Refs
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportRef = useRef<HTMLElement | null>(null);
    const navTrackRef = useRef<HTMLElement | null>(null);
    const navPillRef = useRef<HTMLDivElement | null>(null);
    const homeLinkRef = useRef<HTMLAnchorElement | null>(null);
    const docsLinkRef = useRef<HTMLAnchorElement | null>(null);
    const downloadLinkRef = useRef<HTMLAnchorElement | null>(null);
    const contactLinkRef = useRef<HTMLAnchorElement | null>(null);

    const isTransitioningRef = useRef(false);

    // -------------------------------------------------------------
    // Body class for isolated landing layout
    // -------------------------------------------------------------
    useEffect(() => {
        document.body.classList.add('landing-body');

        return () => {
            document.body.classList.remove('landing-body');
        };
    }, []);

    // -------------------------------------------------------------
    // Sliding Nav Indicator Pill Alignment
    // -------------------------------------------------------------
    const updateNavPill = (section: string) => {
        if (!navPillRef.current || !navTrackRef.current) {
            return;
        }

        const linkMap: Record<string, HTMLAnchorElement | null> = {
            home: homeLinkRef.current,
            docs: docsLinkRef.current,
            download: downloadLinkRef.current,
            contact: contactLinkRef.current,
        };
        const activeLink = linkMap[section];

        if (activeLink) {
            const trackRect = navTrackRef.current.getBoundingClientRect();
            const linkRect = activeLink.getBoundingClientRect();
            const left = linkRect.left - trackRect.left;
            navPillRef.current.style.transform = `translateX(${left}px)`;
            navPillRef.current.style.width = `${linkRect.width}px`;
        }
    };

    useEffect(() => {
        updateNavPill(activeSection);
        const handleResize = () => updateNavPill(activeSection);
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, [activeSection]);

    // -------------------------------------------------------------
    // Smooth Section Navigation
    // -------------------------------------------------------------
    const scrollToSection = (
        targetId: 'home' | 'docs' | 'download' | 'contact',
    ) => {
        const targetEl = document.getElementById(targetId);

        if (!targetEl || !viewportRef.current) {
            return;
        }

        isTransitioningRef.current = true;
        viewportRef.current.scrollTo({
            top: targetEl.offsetTop,
            behavior: 'smooth',
        });
        setActiveSection(targetId);

        setTimeout(() => {
            isTransitioningRef.current = false;
        }, 700);
    };

    // -------------------------------------------------------------
    // On "Request Access" redirect (?category=access-request), scroll
    // to the message board and focus the reasons textarea
    // -------------------------------------------------------------
    useEffect(() => {
        if (requestCategory !== 'access-request') {
            return;
        }

        scrollToSection('contact');

        const focusTimer = setTimeout(() => {
            document.getElementById('post-message')?.focus();
        }, 750);

        return () => clearTimeout(focusTimer);
    }, [requestCategory]);

    // -------------------------------------------------------------
    // Canvas Glowing Cursor Trail Effect
    // -------------------------------------------------------------
    useEffect(() => {
        const canvas = canvasRef.current;

        if (
            !canvas ||
            !window.matchMedia('(hover: hover) and (pointer: fine)').matches
        ) {
            return;
        }

        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return;
        }

        let animationFrameId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const onResize = () => {
            if (!canvas) {
                return;
            }

            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', onResize);

        interface Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            radius: number;
            color: string;
            alpha: number;
            decay: number;
        }

        const particles: Particle[] = [];
        const colors = [
            'rgba(34, 197, 94, ', // ABLE Emerald
            'rgba(74, 222, 128, ', // Mint
            'rgba(56, 189, 248, ', // Ice Cyan
        ];
        const mouse = { x: -100, y: -100, px: -100, py: -100, moved: false };

        const onMouseMove = (e: MouseEvent) => {
            mouse.px = mouse.x;
            mouse.py = mouse.y;
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            mouse.moved = true;

            const dx = mouse.x - mouse.px;
            const dy = mouse.y - mouse.py;
            const speed = Math.sqrt(dx * dx + dy * dy);
            const count = Math.min(Math.floor(speed / 5) + 1, 4);

            for (let i = 0; i < count; i++) {
                particles.push({
                    x: mouse.x + (Math.random() - 0.5) * 6,
                    y: mouse.y + (Math.random() - 0.5) * 6,
                    vx: (Math.random() - 0.5) * 1.2 - dx * 0.08,
                    vy: (Math.random() - 0.5) * 1.2 - dy * 0.08,
                    radius: Math.random() * 2.5 + 1.8,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    alpha: 0.8,
                    decay: Math.random() * 0.02 + 0.018,
                });
            }
        };
        window.addEventListener('mousemove', onMouseMove);

        const renderTrail = () => {
            ctx.clearRect(0, 0, width, height);

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= p.decay;
                p.radius *= 0.97;

                if (p.alpha <= 0.01 || p.radius <= 0.2) {
                    particles.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color + p.alpha + ')';
                ctx.shadowBlur = 12;
                ctx.shadowColor = p.color + '0.6)';
                ctx.fill();
                ctx.restore();
            }

            if (mouse.moved && mouse.x > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = '#22C55E';
                ctx.shadowBlur = 14;
                ctx.shadowColor = 'rgba(34, 197, 94, 0.95)';
                ctx.fill();
                ctx.restore();
            }

            animationFrameId = requestAnimationFrame(renderTrail);
        };
        renderTrail();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousemove', onMouseMove);
        };
    }, []);

    // -------------------------------------------------------------
    // Boundary-Aware Wheel Transition & Scroll Observation
    // -------------------------------------------------------------
    useEffect(() => {
        const viewport = viewportRef.current;

        if (!viewport) {
            return;
        }

        const sections: Array<'home' | 'docs' | 'download' | 'contact'> = [
            'home',
            'docs',
            'download',
            'contact',
        ];

        const getCurrentIndex = () => {
            const scrollPos = viewport.scrollTop;
            const panels = sections.map((id) => document.getElementById(id));

            for (let i = panels.length - 1; i >= 0; i--) {
                const p = panels[i];

                if (p && scrollPos >= p.offsetTop - 120) {
                    return i;
                }
            }

            return 0;
        };

        const handleWheel = (e: WheelEvent) => {
            const activeIdx = getCurrentIndex();
            const currentPanelId = sections[activeIdx];
            const currentPanel = document.getElementById(currentPanelId);

            const target = e.target as HTMLElement | null;
            let scrollableParent: HTMLElement | null = target
                ? (target.closest(
                      '.stream-list, textarea, [data-scrollable], .scrollable-content',
                  ) as HTMLElement | null)
                : null;

            if (
                !scrollableParent &&
                currentPanel &&
                currentPanel.scrollHeight > currentPanel.clientHeight + 4
            ) {
                scrollableParent = currentPanel;
            }

            if (scrollableParent) {
                const atTop = scrollableParent.scrollTop <= 2;
                const atBottom =
                    scrollableParent.scrollHeight -
                        scrollableParent.scrollTop <=
                    scrollableParent.clientHeight + 4;

                if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) {
                    return; // Allow natural scrolling inside internal scroll area
                }
            }

            if (isTransitioningRef.current) {
                e.preventDefault();

                return;
            }

            if (!currentPanel) {
                return;
            }

            const panelTop = currentPanel.offsetTop;
            const panelBottom = panelTop + currentPanel.offsetHeight;
            const currentScrollBottom =
                viewport.scrollTop + viewport.clientHeight;

            // Down
            if (e.deltaY > 25) {
                if (currentScrollBottom < panelBottom - 40) {
                    return; // natural scroll inside tall section
                }

                if (activeIdx < sections.length - 1) {
                    e.preventDefault();
                    scrollToSection(sections[activeIdx + 1]);
                }
            } else if (e.deltaY < -25) {
                // Up
                if (viewport.scrollTop > panelTop + 40) {
                    return; // natural scroll inside tall section
                }

                if (activeIdx > 0) {
                    e.preventDefault();
                    scrollToSection(sections[activeIdx - 1]);
                }
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const activeTag = document.activeElement
                ? document.activeElement.tagName.toLowerCase()
                : '';

            if (['input', 'textarea'].includes(activeTag)) {
                return;
            }

            const activeIdx = getCurrentIndex();
            const currentPanel = document.getElementById(sections[activeIdx]);

            if (!currentPanel) {
                return;
            }

            const hasInternalScroll =
                currentPanel.scrollHeight > currentPanel.clientHeight + 4;
            const panelAtTop = hasInternalScroll
                ? currentPanel.scrollTop <= 2
                : true;
            const panelAtBottom = hasInternalScroll
                ? currentPanel.scrollHeight - currentPanel.scrollTop <=
                  currentPanel.clientHeight + 4
                : true;

            if (
                e.key === 'ArrowDown' ||
                e.key === 'PageDown' ||
                (e.key === ' ' && !e.shiftKey)
            ) {
                if (hasInternalScroll && !panelAtBottom) {
                    return;
                }

                if (activeIdx < sections.length - 1) {
                    e.preventDefault();
                    scrollToSection(sections[activeIdx + 1]);
                }
            } else if (
                e.key === 'ArrowUp' ||
                e.key === 'PageUp' ||
                (e.key === ' ' && e.shiftKey)
            ) {
                if (hasInternalScroll && !panelAtTop) {
                    return;
                }

                if (activeIdx > 0) {
                    e.preventDefault();
                    scrollToSection(sections[activeIdx - 1]);
                }
            }
        };

        // Scroll listener to update active section in header
        const handleScroll = () => {
            const activeIdx = getCurrentIndex();
            const activeId = sections[activeIdx];
            setActiveSection(activeId);
        };

        viewport.addEventListener('wheel', handleWheel, { passive: false });
        viewport.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            viewport.removeEventListener('wheel', handleWheel);
            viewport.removeEventListener('scroll', handleScroll);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // -------------------------------------------------------------
    // Copy Extension Store ID
    // -------------------------------------------------------------
    const handleCopyId = () => {
        navigator.clipboard
            .writeText('fladkbcbllgnfekjkfochbjknebammbi')
            .then(() => {
                setCsCopied(true);
                setTimeout(() => setCsCopied(false), 2000);
            });
    };

    // -------------------------------------------------------------
    // Message Board Actions
    // -------------------------------------------------------------
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
            } else {
                if (response.status === 429) {
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

    const categoryLabels: Record<string, string> = {
        suggestion: 'Suggestion',
        comment: 'Comment',
        complaint: 'Complaint',
        'false-positive': 'False Positive',
        'access-request': 'Access Request',
    };

    return (
        <>
            <Head>
                <title>ABLE — Adaptive Browser-Level Extension</title>
                <link rel="icon" type="image/png" href="/assets/icon-48.png" />
            </Head>

            <div className="landing-page-wrapper">
                {/* Interactive Cursor Trail Canvas */}
                <canvas
                    id="cursor-canvas"
                    ref={canvasRef}
                    className="cursor-canvas"
                />

                {/* Ambient Minimal Glass Lighting Gradients & World Map */}
                <div className="ambient-mesh">
                    <div className="ambient-world-map" />
                    <div className="ambient-orb orb-1" />
                    <div className="ambient-orb orb-2" />
                    <div className="ambient-orb orb-3" />
                </div>

                {/* Floating Glassmorphic Header Navigation */}
                <header className="floating-header">
                    <div className="glass-nav-pill">
                        {/* Discrete Admin Trigger: Double-Click the ABLE Brand Logo */}
                        <div
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection('home');
                            }}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                router.visit('/login');
                            }}
                            className="nav-brand cursor-pointer select-none"
                            title="ABLE (Double-click for administrative sign-in)"
                        >
                            <div className="brand-glyph">
                                <img
                                    src="/assets/ABLE-LOGO.svg"
                                    alt="ABLE"
                                    className="brand-icon"
                                    onError={(e) => {
                                        (
                                            e.currentTarget as HTMLImageElement
                                        ).src = '/assets/icon-48.png';
                                    }}
                                />
                            </div>
                            <span className="brand-title">ABLE</span>
                        </div>

                        {/* Navigation Links with Animated Sliding Indicator */}
                        <nav
                            className="nav-links-track"
                            id="nav-track"
                            ref={navTrackRef}
                        >
                            <div
                                className="nav-indicator-pill"
                                id="nav-pill"
                                ref={navPillRef}
                            />
                            <a
                                href="#home"
                                ref={homeLinkRef}
                                className={`glass-link ${activeSection === 'home' ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    scrollToSection('home');
                                }}
                            >
                                <span>Home</span>
                            </a>
                            <a
                                href="#docs"
                                ref={docsLinkRef}
                                className={`glass-link ${activeSection === 'docs' ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    scrollToSection('docs');
                                }}
                            >
                                <span>Documentation</span>
                            </a>
                            <a
                                href="#download"
                                ref={downloadLinkRef}
                                className={`glass-link ${activeSection === 'download' ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    scrollToSection('download');
                                }}
                            >
                                <span>Download</span>
                            </a>
                            <a
                                href="#contact"
                                ref={contactLinkRef}
                                className={`glass-link ${activeSection === 'contact' ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    scrollToSection('contact');
                                }}
                            >
                                <span>Contact Us</span>
                            </a>
                        </nav>

                        {/* Quick Action CTA */}
                        <div className="nav-cta-wrapper">
                            <a
                                href="#download"
                                className="btn-glass-cta"
                                onClick={(e) => {
                                    e.preventDefault();
                                    scrollToSection('download');
                                }}
                            >
                                <span>Get Extension</span>
                                <svg
                                    width={13}
                                    height={13}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </header>

                {/* Vertical Slide Navigator Dots */}
                <aside
                    className="slide-nav-dots"
                    id="slide-dots"
                    aria-label="Slide Navigation"
                >
                    <button
                        type="button"
                        className={`slide-dot ${activeSection === 'home' ? 'active' : ''}`}
                        onClick={() => scrollToSection('home')}
                        aria-label="Slide 1: Home"
                    >
                        <span className="dot-bubble" />
                        <span className="dot-tooltip">Home</span>
                    </button>
                    <button
                        type="button"
                        className={`slide-dot ${activeSection === 'docs' ? 'active' : ''}`}
                        onClick={() => scrollToSection('docs')}
                        aria-label="Slide 2: Documentation"
                    >
                        <span className="dot-bubble" />
                        <span className="dot-tooltip">Documentation</span>
                    </button>
                    <button
                        type="button"
                        className={`slide-dot ${activeSection === 'download' ? 'active' : ''}`}
                        onClick={() => scrollToSection('download')}
                        aria-label="Slide 3: Download"
                    >
                        <span className="dot-bubble" />
                        <span className="dot-tooltip">Download</span>
                    </button>
                    <button
                        type="button"
                        className={`slide-dot ${activeSection === 'contact' ? 'active' : ''}`}
                        onClick={() => scrollToSection('contact')}
                        aria-label="Slide 4: Contact Us"
                    >
                        <span className="dot-bubble" />
                        <span className="dot-tooltip">Contact Us</span>
                    </button>
                </aside>

                {/* Full-Bleed Content Container with Hidden Scrollbar */}
                <main
                    className="fullbleed-viewport no-scrollbar"
                    id="fullbleed-viewport"
                    ref={viewportRef}
                >
                    {/* ========================================================
                        SECTION 1: HOME
                        ======================================================== */}
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
                                        SHADOW IT PREVENTION & DATA EGRESS
                                        MONITORING
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
                                    <strong>ABLE</strong> is a lightweight web
                                    security tool that monitors user web
                                    activity across any network, and prevents
                                    accidental file uploads before they enter
                                    the cloud. Operating seamlessly in the
                                    background, it classifies domain risks and
                                    safeguards sensitive credentials, API keys,
                                    and enterprise data with real-time
                                    in-browser interception.
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
                                            <line
                                                x1={12}
                                                y1={15}
                                                x2={12}
                                                y2={3}
                                            />
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
                                    <div
                                        className="card-icon-wrap"
                                        style={{
                                            color: 'var(--accent-amber)',
                                            background:
                                                'rgba(251, 191, 36, 0.1)',
                                            borderColor:
                                                'rgba(251, 191, 36, 0.25)',
                                        }}
                                    >
                                        <svg
                                            width={20}
                                            height={20}
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={1.8}
                                        >
                                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                            <line
                                                x1={12}
                                                y1={9}
                                                x2={12}
                                                y2={13}
                                            />
                                            <line
                                                x1={12}
                                                y1={17}
                                                x2={12.01}
                                                y2={17}
                                            />
                                        </svg>
                                    </div>
                                    <h3>The Problem</h3>
                                    <p>
                                        Modern web platforms and generative AI
                                        tools offer unprecedented convenience.
                                        However, this accessibility often leads
                                        to unmonitored data exposure:
                                        individuals routinely submit proprietary
                                        source code, internal documents, API
                                        keys, and customer data into external
                                        services that operate completely outside
                                        organizational security governance.
                                    </p>
                                </div>

                                {/* Card 2: Solution */}
                                <div className="glass-card bento-card">
                                    <div className="card-icon-wrap">
                                        <svg
                                            width={20}
                                            height={20}
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={1.8}
                                        >
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                            <path d="m9 12 2 2 4-4" />
                                        </svg>
                                    </div>
                                    <h3>The Solution</h3>
                                    <p>
                                        ABLE establishes proactive, client-side
                                        protection directly at the browser
                                        boundary. Before outbound files or text
                                        submissions depart the device, ABLE
                                        inspects the content, evaluates
                                        potential exposure against verified risk
                                        patterns, and prompts the user for
                                        informed confirmation—stopping
                                        inadvertent leaks before data ever
                                        reaches external servers.
                                    </p>
                                </div>

                                {/* Card 3: Mission */}
                                <div className="glass-card bento-card">
                                    <div
                                        className="card-icon-wrap"
                                        style={{
                                            color: 'var(--accent-cyan)',
                                            background:
                                                'rgba(56, 189, 248, 0.1)',
                                            borderColor:
                                                'rgba(56, 189, 248, 0.25)',
                                        }}
                                    >
                                        <svg
                                            width={20}
                                            height={20}
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={1.8}
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
                                    <h3>The Mission</h3>
                                    <p>
                                        Security should never come at the
                                        expense of user privacy. ABLE is
                                        engineered to prevent data egress
                                        without invasive surveillance—operating
                                        free of identity tracking, cross-site
                                        profiling, or personal browsing audits.
                                        We believe the most resilient defense is
                                        one that genuinely empowers users with
                                        transparent, client-side agency.
                                    </p>
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
                                    <h2 className="cardless-title">
                                        Why Shadow IT?
                                    </h2>
                                    <p className="cardless-intro">
                                        Shadow IT emerges whenever individuals
                                        adopt web applications, browser tools,
                                        or generative AI assistants for daily
                                        work without formal evaluation by IT and
                                        security teams. Driven by productivity
                                        rather than malicious intent, users
                                        leverage these platforms to streamline
                                        urgent workflows—yet this unmanaged
                                        adoption creates one of the most
                                        pervasive, overlooked security
                                        vulnerabilities facing modern
                                        organizations.
                                    </p>
                                </div>

                                <div className="cardless-grid">
                                    <div className="cardless-block">
                                        <div className="cardless-block-tag">
                                            <span className="tag-bullet amber" />
                                            <h4>The Silent Security Risk</h4>
                                        </div>
                                        <p>
                                            When confidential files, financial
                                            spreadsheets, or proprietary prompts
                                            are submitted to unvetted cloud
                                            tools, that data immediately departs
                                            organizational custody. External
                                            services frequently log user
                                            submissions indefinitely, repurpose
                                            inputs for third-party AI model
                                            training, or lack verified data
                                            retention policies. Because these
                                            transactions occur seamlessly over
                                            standard HTTPS browser traffic,
                                            security teams remain blind to
                                            critical assets leaving the
                                            perimeter until a potential exposure
                                            has already transpired.
                                        </p>
                                    </div>

                                    <div className="cardless-block">
                                        <div className="cardless-block-tag">
                                            <span className="tag-bullet green" />
                                            <h4>Why It Must Be Addressed</h4>
                                        </div>
                                        <p>
                                            As workplaces decentralize across
                                            remote locations, home networks, and
                                            personal devices, traditional
                                            perimeter firewalls can no longer
                                            provide adequate visibility.
                                            Imposing rigid, blanket website
                                            blocks only disrupts legitimate
                                            productivity and inevitably drives
                                            teams toward even less visible
                                            workarounds. Effectively addressing
                                            Shadow IT requires engaging users at
                                            the point of action: directly within
                                            the browser, providing real-time,
                                            non-disruptive guidance that
                                            prevents sensitive information from
                                            escaping into unvetted cloud
                                            environments.
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
                                        Next-Generation Firewalls (NGFWs),
                                        on-premise proxies, and perimeter
                                        gateways—was engineered for a
                                        centralized era when all corporate data
                                        moved through hardwired office cables.
                                        In today's decentralized web landscape,
                                        these traditional appliances face
                                        fundamental blind spots that make
                                        detecting and preventing Shadow IT
                                        virtually impossible.
                                    </p>
                                </div>

                                <div className="cardless-grid">
                                    <div className="cardless-block">
                                        <div className="cardless-block-tag">
                                            <span className="tag-bullet cyan" />
                                            <h4>
                                                Modern Web Architectures &
                                                End-to-End Encryption
                                            </h4>
                                        </div>
                                        <p>
                                            Nearly all modern web traffic is
                                            protected by end-to-end TLS 1.3
                                            encryption. For a firewall to
                                            inspect what a user is pasting or
                                            uploading, it must perform
                                            aggressive SSL/TLS decryption—a
                                            process that introduces severe
                                            network latency, privacy
                                            liabilities, and frequently breaks
                                            modern web standards like
                                            WebSockets, HTTP/2 multiplexing, and
                                            certificate pinning. Furthermore,
                                            cloud-native SaaS and generative AI
                                            tools operate over the same standard
                                            HTTPS port (443) hosted on
                                            ubiquitous cloud CDNs. To a
                                            perimeter firewall, an employee
                                            uploading confidential intellectual
                                            property looks completely
                                            indistinguishable from benign web
                                            browsing.
                                        </p>
                                    </div>

                                    <div className="cardless-block">
                                        <div className="cardless-block-tag">
                                            <span className="tag-bullet red" />
                                            <h4>
                                                Wireless Decentralization &
                                                Off-Perimeter Work
                                            </h4>
                                        </div>
                                        <p>
                                            As workplaces shift across home
                                            wireless routers, remote hotspots,
                                            and mobile connections, user traffic
                                            frequently bypasses physical
                                            corporate gateways altogether. Even
                                            when enterprise VPNs are deployed,
                                            organizations routinely implement
                                            split-tunneling to prevent bandwidth
                                            bottlenecks during video calls,
                                            routing general web activity
                                            directly over local wireless
                                            internet. Firewalls cannot defend a
                                            perimeter that users have already
                                            left. Without client-level
                                            inspection inside the browser,
                                            network security remains powerless
                                            against unmanaged wireless
                                            endpoints.
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
                                        Effective web security governance cannot
                                        succeed through clandestine monitoring;
                                        it requires radical transparency and
                                        mutual trust. ABLE operates on a strict
                                        principle of client-side data
                                        minimization—processing sensitive
                                        content directly on your local device
                                        and collecting only the aggregate policy
                                        telemetry required to evaluate domain
                                        risks, maintain compliance, and prevent
                                        accidental data egress.
                                    </p>
                                </div>

                                <div className="cardless-grid">
                                    <div className="cardless-block">
                                        <div className="cardless-block-tag">
                                            <span className="tag-bullet green" />
                                            <h4>
                                                What We Inspect & How It
                                                Operates (Local-First
                                                Processing)
                                            </h4>
                                        </div>
                                        <p>
                                            ABLE conducts pre-flight data
                                            inspections entirely in-memory at
                                            the browser level before any
                                            outbound network transmission can
                                            occur. When files are uploaded or
                                            form inputs are submitted, text
                                            payloads are parsed locally and
                                            evaluated against HMAC-signed risk
                                            patterns. The moment risk scoring
                                            concludes, the temporary in-memory
                                            representation is purged
                                            immediately. Raw documents, source
                                            code, prompt texts, and personal
                                            keystrokes are never transmitted to
                                            our servers or saved to persistent
                                            disk—guaranteeing that confidential
                                            assets never escape client custody
                                            during evaluation.
                                        </p>
                                    </div>

                                    <div className="cardless-block">
                                        <div className="cardless-block-tag">
                                            <span className="tag-bullet purple" />
                                            <h4>
                                                Why Data Is Collected &
                                                Governance Boundaries
                                            </h4>
                                        </div>
                                        <p>
                                            To provide organizational oversight
                                            without compromising individual
                                            privacy, ABLE synchronizes
                                            anonymized governance telemetry:
                                            domain safety classifications (such
                                            as safe, unlisted, or restricted),
                                            policy rule IDs triggered, and
                                            whether an egress warning was
                                            acknowledged or cancelled by the
                                            user. This data allows security
                                            administrators to measure Shadow IT
                                            adoption trends, detect emerging
                                            cloud exposures, and tune
                                            false-positive accuracy. Crucially,
                                            ABLE enforces a zero-surveillance
                                            baseline: we never collect browsing
                                            histories, user credentials, session
                                            cookies, search queries, or
                                            persistent hardware identifiers.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ========================================================
                        SECTION 2: DOCUMENTATION
                        ======================================================== */}
                    <section
                        className="bleed-panel in-view no-scrollbar"
                        id="docs"
                        data-section="docs"
                    >
                        <div className="panel-inner docs-inner">
                            <div className="section-lead">
                                <span className="minimal-badge">
                                    TECHNICAL SPECIFICATION
                                </span>
                                <h2 className="section-heading">
                                    How ABLE Operates
                                </h2>
                                <p className="section-subtext">
                                    A look into the client-side interception
                                    mechanisms, data collection boundaries, and
                                    operational guides.
                                </p>
                            </div>

                            {/* Glassmorphic Tabs */}
                            <div className="docs-glass-container glass-card">
                                <div className="docs-nav-bar">
                                    <button
                                        type="button"
                                        className={`doc-pill ${activeDocTab === 'intro' ? 'active' : ''}`}
                                        onClick={() => setActiveDocTab('intro')}
                                    >
                                        Introduction
                                    </button>
                                    <button
                                        type="button"
                                        className={`doc-pill ${activeDocTab === 'arch' ? 'active' : ''}`}
                                        onClick={() => setActiveDocTab('arch')}
                                    >
                                        Core Architecture
                                    </button>
                                    <button
                                        type="button"
                                        className={`doc-pill ${activeDocTab === 'data' ? 'active' : ''}`}
                                        onClick={() => setActiveDocTab('data')}
                                    >
                                        Data Collection & Privacy
                                    </button>
                                    <button
                                        type="button"
                                        className={`doc-pill ${activeDocTab === 'how' ? 'active' : ''}`}
                                        onClick={() => setActiveDocTab('how')}
                                    >
                                        How ABLE Operates
                                    </button>
                                    <button
                                        type="button"
                                        className={`doc-pill ${activeDocTab === 'guide' ? 'active' : ''}`}
                                        onClick={() => setActiveDocTab('guide')}
                                    >
                                        Usage & Administration
                                    </button>
                                </div>

                                <div className="docs-content-area">
                                    {/* Subpage 1: Introduction */}
                                    {activeDocTab === 'intro' && (
                                        <div
                                            className="doc-pane active"
                                            id="pane-intro"
                                        >
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
                                                            <circle
                                                                cx={12}
                                                                cy={12}
                                                                r={10}
                                                            />
                                                            <line
                                                                x1={12}
                                                                y1={16}
                                                                x2={12}
                                                                y2={12}
                                                            />
                                                            <line
                                                                x1={12}
                                                                y1={8}
                                                                x2={12.01}
                                                                y2={8}
                                                            />
                                                        </svg>
                                                        <span>
                                                            PROJECT OVERVIEW &
                                                            RESEARCH RATIONALE
                                                        </span>
                                                    </div>
                                                    <h3>
                                                        The ABLE Research
                                                        Initiative
                                                    </h3>
                                                    <p>
                                                        <strong>
                                                            ABLE (Adaptive
                                                            Browser-Level
                                                            Extension)
                                                        </strong>{' '}
                                                        is a Data Loss
                                                        Prevention (DLP) and
                                                        web-based security tool
                                                        engineered to prevent
                                                        the critical blind spot
                                                        of Shadow IT by offering
                                                        a secondary level of
                                                        protection against
                                                        decentralized web
                                                        browsing. Modern network
                                                        perimeter firewalls and
                                                        security gateways are
                                                        structurally blind to
                                                        end-to-end encrypted TLS
                                                        traffic and WebSocket
                                                        streams; consequently,
                                                        sensitive corporate
                                                        credentials, source
                                                        code, and enterprise
                                                        documents are routinely
                                                        exfiltrated into
                                                        unsanctioned AI chat
                                                        platforms, generative
                                                        assistants, and
                                                        untrusted cloud web
                                                        applications before IT
                                                        governance can
                                                        intervene.
                                                    </p>
                                                    <p>
                                                        Rather than attempting
                                                        to inspect packets after
                                                        they depart the device
                                                        or deploying intrusive
                                                        kernel-level
                                                        surveillance agents,
                                                        ABLE investigates a
                                                        paradigm shift:{' '}
                                                        <strong>
                                                            enforcing pre-flight
                                                            data governance
                                                            directly within the
                                                            browser runtime
                                                            itself
                                                        </strong>
                                                        . By holding outbound
                                                        payloads in memory and
                                                        scoring risk patterns
                                                        before network dispatch,
                                                        ABLE provides knowledge
                                                        workers with real-time
                                                        situational awareness
                                                        and conscious decision
                                                        agency.
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
                                                        <circle
                                                            cx={12}
                                                            cy={12}
                                                            r={10}
                                                        />
                                                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                                        <line
                                                            x1={12}
                                                            y1={17}
                                                            x2={12.01}
                                                            y2={17}
                                                        />
                                                    </svg>
                                                    <span>
                                                        Three Core Research
                                                        Inquiries
                                                    </span>
                                                </div>

                                                <div className="inquiry-grid">
                                                    <div className="inquiry-card">
                                                        <div className="inquiry-badge-row">
                                                            <span className="inquiry-num">
                                                                01
                                                            </span>
                                                            <span className="inquiry-tag">
                                                                PRE-FLIGHT
                                                                DEFENSE
                                                            </span>
                                                        </div>
                                                        <h4>
                                                            Can in-browser
                                                            interception serve
                                                            as a reliable last
                                                            line of defense?
                                                        </h4>
                                                        <p>
                                                            Traditional DLP
                                                            evaluates data after
                                                            it departs the
                                                            endpoint. ABLE
                                                            studies whether
                                                            intercepting DOM
                                                            transfer events and
                                                            holding payloads in
                                                            memory can
                                                            systematically
                                                            prevent accidental
                                                            data leakage before
                                                            a single byte
                                                            touches the wire.
                                                        </p>
                                                    </div>

                                                    <div className="inquiry-card">
                                                        <div className="inquiry-badge-row">
                                                            <span className="inquiry-num">
                                                                02
                                                            </span>
                                                            <span className="inquiry-tag">
                                                                HUMAN FACTORS
                                                            </span>
                                                        </div>
                                                        <h4>
                                                            How do knowledge
                                                            workers respond to
                                                            in-the-moment
                                                            warnings?
                                                        </h4>
                                                        <p>
                                                            Security prompts
                                                            frequently induce
                                                            alert fatigue. By
                                                            measuring proceed,
                                                            cancel, and
                                                            repeat-visit
                                                            interaction rates
                                                            across diverse
                                                            workflows, ABLE
                                                            evaluates what makes
                                                            an in-browser
                                                            warning cognitively
                                                            persuasive rather
                                                            than merely
                                                            disruptive.
                                                        </p>
                                                    </div>

                                                    <div className="inquiry-card">
                                                        <div className="inquiry-badge-row">
                                                            <span className="inquiry-num">
                                                                03
                                                            </span>
                                                            <span className="inquiry-tag">
                                                                HEURISTIC
                                                                ACCURACY
                                                            </span>
                                                        </div>
                                                        <h4>
                                                            How accurately can
                                                            client-side pattern
                                                            scoring perform in
                                                            real time?
                                                        </h4>
                                                        <p>
                                                            Investigating the
                                                            trade-offs between
                                                            client-side regex
                                                            heuristics and
                                                            server-assisted
                                                            scoring against
                                                            real-world
                                                            Generative AI and
                                                            cloud paste
                                                            workflows, measuring
                                                            false-positive
                                                            friction against
                                                            high-entropy
                                                            detection efficacy.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="intro-axioms-row">
                                                    <div className="axiom-card">
                                                        <span className="axiom-label">
                                                            AXIOM I
                                                        </span>
                                                        <strong>
                                                            User Agency First
                                                        </strong>
                                                        <p>
                                                            Decisions are never
                                                            made invisibly.
                                                            Flagged transfers
                                                            provide explicit,
                                                            contextual choices
                                                            (Proceed, Cancel, or
                                                            Hold) rather than
                                                            opaque silent
                                                            blocks.
                                                        </p>
                                                    </div>

                                                    <div className="axiom-card">
                                                        <span className="axiom-label">
                                                            AXIOM II
                                                        </span>
                                                        <strong>
                                                            Fail-Closed Security
                                                            Posture
                                                        </strong>
                                                        <p>
                                                            If the scoring
                                                            server is
                                                            unreachable or
                                                            offline, outbound
                                                            sensitive transfers
                                                            fail safe—held
                                                            securely in local
                                                            memory rather than
                                                            sent uninspected.
                                                        </p>
                                                    </div>

                                                    <div className="axiom-card">
                                                        <span className="axiom-label">
                                                            AXIOM III
                                                        </span>
                                                        <strong>
                                                            Zero-Surveillance
                                                            Standard
                                                        </strong>
                                                        <p>
                                                            Strictly no
                                                            advertising, no
                                                            third-party
                                                            telemetry, no
                                                            browsing history
                                                            logging, and no
                                                            keystroke tracking.
                                                            Local pseudonymous
                                                            IDs protect user
                                                            privacy.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="intro-metrics-strip">
                                                    <div className="metric-strip-card">
                                                        <span className="metric-strip-val">
                                                            &lt; 1.2ms
                                                        </span>
                                                        <span className="metric-strip-lbl">
                                                            Synchronous DOM Hook
                                                            Overhead
                                                        </span>
                                                    </div>
                                                    <div className="metric-strip-card">
                                                        <span className="metric-strip-val">
                                                            100%
                                                        </span>
                                                        <span className="metric-strip-lbl">
                                                            In-Memory Pre-Flight
                                                            Inspection
                                                        </span>
                                                    </div>
                                                    <div className="metric-strip-card">
                                                        <span className="metric-strip-val">
                                                            HMAC-SHA-256
                                                        </span>
                                                        <span className="metric-strip-lbl">
                                                            Cryptographically
                                                            Signed Policies
                                                        </span>
                                                    </div>
                                                    <div className="metric-strip-card">
                                                        <span className="metric-strip-val">
                                                            0 Bytes
                                                        </span>
                                                        <span className="metric-strip-lbl">
                                                            File Content
                                                            Retained in Server
                                                            Logs
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Subpage 2: Core Architecture */}
                                    {activeDocTab === 'arch' && (
                                        <div
                                            className="doc-pane active"
                                            id="pane-arch"
                                        >
                                            <div className="split-columns">
                                                <div className="doc-text-col">
                                                    <h3>
                                                        Tripartite Defense
                                                        Architecture & Process
                                                        Isolation
                                                    </h3>
                                                    <p>
                                                        To ensure complete
                                                        immunity against webpage
                                                        script tampering,
                                                        Prototype Pollution, and
                                                        adversarial DOM
                                                        manipulation, ABLE
                                                        enforces a strict
                                                        three-tier execution
                                                        hierarchy within the
                                                        Chromium runtime. Each
                                                        tier operates under
                                                        independent security
                                                        contexts and
                                                        least-privilege
                                                        constraints, maintaining
                                                        sub-millisecond
                                                        execution times while
                                                        guaranteeing unvetted
                                                        web applications cannot
                                                        bypass or disable safety
                                                        hooks.
                                                    </p>

                                                    <div className="spec-points">
                                                        <div className="spec-point">
                                                            <span className="spec-num">
                                                                01
                                                            </span>
                                                            <div>
                                                                <strong>
                                                                    Tier 1:
                                                                    Page-World
                                                                    Transport
                                                                    Interceptors
                                                                    (Injected
                                                                    Scripts)
                                                                </strong>
                                                                <p>
                                                                    Injected via
                                                                    dynamically
                                                                    generated{' '}
                                                                    <code>
                                                                        &lt;script&gt;
                                                                    </code>{' '}
                                                                    elements
                                                                    with SHA-256
                                                                    asset-integrity
                                                                    pinning.
                                                                    Runs in the
                                                                    page's
                                                                    execution
                                                                    world to
                                                                    hook native
                                                                    dispatch
                                                                    channels:{' '}
                                                                    <code>
                                                                        window.fetch
                                                                    </code>
                                                                    ,{' '}
                                                                    <code>
                                                                        XMLHttpRequest.prototype.send
                                                                    </code>
                                                                    ,{' '}
                                                                    <code>
                                                                        navigator.sendBeacon
                                                                    </code>
                                                                    , and{' '}
                                                                    <code>
                                                                        WebSocket.prototype.send
                                                                    </code>
                                                                    . Actively
                                                                    tracks{' '}
                                                                    <code>
                                                                        input[type="file"]
                                                                    </code>
                                                                    ,
                                                                    drag-and-drop
                                                                    buffers, and
                                                                    clipboard
                                                                    paste
                                                                    events,
                                                                    extracting
                                                                    raw MIME
                                                                    types and
                                                                    file
                                                                    metadata
                                                                    before page
                                                                    scripts can
                                                                    serialize or
                                                                    obfuscate
                                                                    them.
                                                                    Transparently
                                                                    bypasses
                                                                    internal
                                                                    telemetry
                                                                    and static
                                                                    asset CDNs.
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="spec-point">
                                                            <span className="spec-num">
                                                                02
                                                            </span>
                                                            <div>
                                                                <strong>
                                                                    Tier 2:
                                                                    Content
                                                                    Scripts &
                                                                    Isolated
                                                                    Shadow DOM
                                                                    Containers
                                                                </strong>
                                                                <p>
                                                                    Operates
                                                                    strictly
                                                                    within
                                                                    Chromium's
                                                                    isolated
                                                                    world
                                                                    context (
                                                                    <code>
                                                                        run_at:
                                                                        document_end
                                                                    </code>
                                                                    ). Contains
                                                                    an in-memory
                                                                    document
                                                                    parsing
                                                                    engine that
                                                                    decompresses
                                                                    and extracts
                                                                    UTF-8
                                                                    streams from
                                                                    plain text,
                                                                    CSV, JSON,
                                                                    and Office
                                                                    Open XML
                                                                    archives (
                                                                    <code>
                                                                        .docx
                                                                    </code>
                                                                    ,{' '}
                                                                    <code>
                                                                        .xlsx
                                                                    </code>
                                                                    ,{' '}
                                                                    <code>
                                                                        .pptx
                                                                    </code>
                                                                    ) without
                                                                    temporary
                                                                    disk writes.
                                                                    Renders the{' '}
                                                                    <code>
                                                                        #able-shadow-root
                                                                    </code>{' '}
                                                                    modal
                                                                    boundary—an
                                                                    isolated
                                                                    Shadow DOM
                                                                    tree immune
                                                                    to host page
                                                                    CSS style
                                                                    leakage,
                                                                    script
                                                                    tampering,
                                                                    or
                                                                    clickjacking
                                                                    attacks.
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="spec-point">
                                                            <span className="spec-num">
                                                                03
                                                            </span>
                                                            <div>
                                                                <strong>
                                                                    Tier 3:
                                                                    Manifest V3
                                                                    Background
                                                                    Worker &
                                                                    Research
                                                                    Server
                                                                </strong>
                                                                <p>
                                                                    An ephemeral
                                                                    background
                                                                    service
                                                                    worker
                                                                    utilizing{' '}
                                                                    <code>
                                                                        chrome.webNavigation.onCommitted
                                                                    </code>{' '}
                                                                    to classify
                                                                    top-frame
                                                                    domain
                                                                    visits
                                                                    before page
                                                                    resources
                                                                    execute.
                                                                    Uses{' '}
                                                                    <code>
                                                                        chrome.alarms
                                                                    </code>{' '}
                                                                    for
                                                                    deterministic
                                                                    policy
                                                                    synchronization,
                                                                    validating
                                                                    HMAC-SHA-256
                                                                    signatures
                                                                    on all
                                                                    incoming
                                                                    regex
                                                                    criteria
                                                                    from the
                                                                    self-hosted
                                                                    Laravel
                                                                    research
                                                                    server
                                                                    before
                                                                    caching them
                                                                    into
                                                                    encrypted
                                                                    local
                                                                    extension
                                                                    storage.
                                                                    Flushes
                                                                    anonymized
                                                                    offline
                                                                    event queues
                                                                    periodically
                                                                    over pinned
                                                                    TLS.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="doc-visual-col">
                                                    <div className="code-preview-glass">
                                                        <div className="code-header">
                                                            <span className="code-dot" />
                                                            <span className="code-title">
                                                                interceptor-pipeline.ts
                                                            </span>
                                                        </div>
                                                        <pre className="code-snippet">
                                                            <code>
                                                                {`// Integrity-Verified Pre-Flight Transport Hook
const dispatchHook = {
  hook: "window.fetch",
  action: async (input: RequestInfo, init?: RequestInit) => {
    // 1. Extract outbound payload from memory buffer
    const payload = await extractBuffer(init?.body);
    
    // 2. Check site policy against signed offline cache
    const domainVerdict = await classifyDomain(window.location.hostname);
    
    // 3. In-memory pattern evaluation & score generation
    const riskAssessment = await scoreContent(payload, domainVerdict);
    
    // 4. Intervene if sensitive patterns exceed threshold
    if (riskAssessment.score > 60) {
      const userDecision = await shadowPrompt.requestConsent(riskAssessment);
      if (userDecision === "CANCEL") {
        cleanInputFields();
        throw new DOMException("Egress halted by user.", "AbortError");
      }
    }
    
    // 5. Clean release without transport mutation
    return nativeFetch(input, init);
  }
};`}
                                                            </code>
                                                        </pre>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Subpage 3: Data Collection & Privacy */}
                                    {activeDocTab === 'data' && (
                                        <div
                                            className="doc-pane active"
                                            id="pane-data"
                                        >
                                            <div className="data-intro-banner">
                                                <h4>
                                                    Data Minimization &
                                                    Zero-Surveillance
                                                    Architecture
                                                </h4>
                                                <p>
                                                    ABLE was founded on the
                                                    fundamental principle that
                                                    client-side security must
                                                    never become an instrument
                                                    for workforce surveillance.
                                                    Unlike legacy Endpoint
                                                    Detection and Response (EDR)
                                                    or Commercial DLP agents
                                                    that monitor all browsing
                                                    activities and record full
                                                    URL histories, ABLE
                                                    processes only the minimal
                                                    metadata required to compute
                                                    risk verdicts and evaluate
                                                    research detection accuracy.
                                                    Every byte transmitted is
                                                    protected by cryptographic
                                                    SPKI certificate pinning and
                                                    sent exclusively to our
                                                    self-hosted research server.
                                                </p>
                                            </div>

                                            <div className="data-table-glass">
                                                <table className="minimal-table">
                                                    <thead>
                                                        <tr>
                                                            <th
                                                                style={{
                                                                    width: '18%',
                                                                }}
                                                            >
                                                                Data Category
                                                            </th>
                                                            <th
                                                                style={{
                                                                    width: '32%',
                                                                }}
                                                            >
                                                                Processed
                                                                Information
                                                            </th>
                                                            <th
                                                                style={{
                                                                    width: '30%',
                                                                }}
                                                            >
                                                                Purpose &
                                                                Governance
                                                            </th>
                                                            <th
                                                                style={{
                                                                    width: '20%',
                                                                }}
                                                            >
                                                                Retention Policy
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            <td>
                                                                <span className="dot-tag dot-green">
                                                                    Domain
                                                                    Telemetry
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <strong>
                                                                    Top-Frame
                                                                    Hostname:
                                                                </strong>{' '}
                                                                Visited domain
                                                                (e.g.,{' '}
                                                                <code>
                                                                    claude.ai
                                                                </code>
                                                                ), safety
                                                                classification (
                                                                <code>
                                                                    SAFE
                                                                </code>
                                                                ,{' '}
                                                                <code>
                                                                    UNLISTED
                                                                </code>
                                                                ,{' '}
                                                                <code>
                                                                    RESTRICTED
                                                                </code>
                                                                ), millisecond
                                                                timestamp, event
                                                                UUID, and random
                                                                device ID.
                                                            </td>
                                                            <td>
                                                                Evaluates domain
                                                                categorization
                                                                coverage and
                                                                nudge
                                                                effectiveness.
                                                                Search engine
                                                                queries, full
                                                                path parameters,
                                                                and intranet
                                                                endpoints are
                                                                explicitly
                                                                scrubbed.
                                                            </td>
                                                            <td>
                                                                Aggregated
                                                                research logs
                                                                only; searchable
                                                                and purgeable by
                                                                pseudonymous ID
                                                                upon request.
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>
                                                                <span className="dot-tag dot-amber">
                                                                    Pre-Flight
                                                                    Scans
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <strong>
                                                                    Extracted
                                                                    Text Slice:
                                                                </strong>{' '}
                                                                Text content (up
                                                                to 200,000 chars
                                                                for documents,
                                                                50,000 for
                                                                inputs), file
                                                                name, file size,
                                                                SHA-256 digest,
                                                                and contextual
                                                                page metadata.
                                                            </td>
                                                            <td>
                                                                Evaluates
                                                                high-entropy
                                                                patterns (AWS
                                                                keys, OpenAI
                                                                tokens, database
                                                                URIs, PII) to
                                                                compute risk
                                                                score (0–100)
                                                                and present
                                                                informed
                                                                choices.
                                                            </td>
                                                            <td>
                                                                Held strictly in
                                                                transient server
                                                                RAM; never
                                                                written to disk
                                                                or database.
                                                                Discarded
                                                                immediately upon
                                                                verdict
                                                                delivery.
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>
                                                                <span className="dot-tag dot-blue">
                                                                    Egress
                                                                    Decision
                                                                    Logs
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <strong>
                                                                    Audit Record
                                                                    Metadata:
                                                                </strong>{' '}
                                                                Domain name,
                                                                action taken (
                                                                <em>Proceed</em>
                                                                ,{' '}
                                                                <em>Cancel</em>,
                                                                or{' '}
                                                                <em>Blocked</em>
                                                                ), file name,
                                                                size, SHA-256
                                                                hash, computed
                                                                score, and
                                                                matched rule
                                                                categories.
                                                            </td>
                                                            <td>
                                                                Measures whether
                                                                in-browser
                                                                interventions
                                                                successfully
                                                                prevent data
                                                                leaks and
                                                                quantifies
                                                                Shadow IT
                                                                adoption trends
                                                                across teams.
                                                            </td>
                                                            <td>
                                                                Metadata only;{' '}
                                                                <strong>
                                                                    raw file
                                                                    contents and
                                                                    confidential
                                                                    texts are
                                                                    strictly
                                                                    never logged
                                                                </strong>
                                                                .
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>
                                                                <span className="dot-tag dot-red">
                                                                    Excluded
                                                                    Data
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <strong>
                                                                    Zero
                                                                    Collection:
                                                                </strong>{' '}
                                                                No keystroke
                                                                logging, no
                                                                browsing
                                                                history, no
                                                                authentication
                                                                cookies, no
                                                                saved passwords,
                                                                no screen
                                                                captures, and no
                                                                hardware
                                                                serials.
                                                            </td>
                                                            <td>
                                                                Guarantees
                                                                technical
                                                                impossibility of
                                                                employee
                                                                surveillance,
                                                                credential
                                                                theft, or
                                                                commercial
                                                                profiling.
                                                            </td>
                                                            <td>
                                                                Never collected,
                                                                never
                                                                transmitted, and
                                                                never stored.
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="data-privacy-pillars">
                                                <div className="data-pillar-card">
                                                    <strong>
                                                        Pseudonymous Identity
                                                    </strong>
                                                    <p>
                                                        Devices generate a local
                                                        randomized identifier (
                                                        <code>
                                                            ABLE-XXXXXXXX
                                                        </code>
                                                        ) that is never tied to
                                                        names, corporate emails,
                                                        or hardware MAC
                                                        addresses.
                                                    </p>
                                                </div>
                                                <div className="data-pillar-card">
                                                    <strong>
                                                        TLS Certificate Pinning
                                                    </strong>
                                                    <p>
                                                        All network traffic is
                                                        locked to the research
                                                        server origin with SPKI
                                                        certificate pinning;
                                                        credentials and cookies
                                                        are omitted entirely (
                                                        <code>
                                                            credentials: 'omit'
                                                        </code>
                                                        ).
                                                    </p>
                                                </div>
                                                <div className="data-pillar-card">
                                                    <strong>
                                                        Right to Erasure
                                                    </strong>
                                                    <p>
                                                        Users can uninstall at
                                                        any time to immediately
                                                        cease collection, or
                                                        contact the research
                                                        operator to purge all
                                                        telemetry linked to
                                                        their pseudonymous
                                                        identifier.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Subpage 4: How ABLE Operates */}
                                    {activeDocTab === 'how' && (
                                        <div
                                            className="doc-pane active"
                                            id="pane-how"
                                        >
                                            <div className="timeline-intro">
                                                <h4>
                                                    The Four-Phase Client-Side
                                                    Interception Lifecycle
                                                </h4>
                                                <p>
                                                    ABLE functions as an
                                                    autonomous, in-browser proxy
                                                    that monitors outbound data
                                                    streams at the DOM boundary.
                                                    The diagram below
                                                    illustrates the exact
                                                    sequence of technical events
                                                    from the moment a user
                                                    initiates an upload or text
                                                    submission until clean
                                                    release or input
                                                    cancellation.
                                                </p>
                                            </div>

                                            <div className="timeline-glass">
                                                <div className="timeline-item">
                                                    <div className="time-header-row">
                                                        <span className="time-marker">
                                                            01
                                                        </span>
                                                        <span className="time-phase-tag">
                                                            INTERCEPTION
                                                        </span>
                                                    </div>
                                                    <div className="time-content">
                                                        <h4>
                                                            Pre-Flight Transport
                                                            Trapping
                                                        </h4>
                                                        <p>
                                                            When a user selects
                                                            a file via file
                                                            picker, drags an
                                                            archive into the
                                                            browser, or pastes
                                                            sensitive text into
                                                            a form input or web
                                                            chat, ABLE’s
                                                            page-world
                                                            interceptors pause
                                                            the native
                                                            asynchronous
                                                            dispatch chain
                                                            (wrapping{' '}
                                                            <code>fetch</code>,{' '}
                                                            <code>XHR</code>,{' '}
                                                            <code>
                                                                sendBeacon
                                                            </code>
                                                            , and{' '}
                                                            <code>
                                                                WebSocket
                                                            </code>
                                                            ) before any bytes
                                                            depart the client.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="timeline-item">
                                                    <div className="time-header-row">
                                                        <span className="time-marker">
                                                            02
                                                        </span>
                                                        <span className="time-phase-tag">
                                                            PARSING & SCORING
                                                        </span>
                                                    </div>
                                                    <div className="time-content">
                                                        <h4>
                                                            In-Memory Document
                                                            Extraction
                                                        </h4>
                                                        <p>
                                                            The content script
                                                            deconstructs plain
                                                            text, CSV, JSON, and
                                                            Office Open XML
                                                            archives (
                                                            <code>.docx</code>,{' '}
                                                            <code>.xlsx</code>,{' '}
                                                            <code>.pptx</code>)
                                                            entirely in RAM. The
                                                            extracted text slice
                                                            is evaluated against
                                                            HMAC-SHA-256 signed
                                                            criteria for API
                                                            tokens, secret keys,
                                                            private
                                                            certificates, and
                                                            enterprise PII to
                                                            compute a
                                                            comprehensive risk
                                                            score (0–100).
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="timeline-item">
                                                    <div className="time-header-row">
                                                        <span className="time-marker">
                                                            03
                                                        </span>
                                                        <span className="time-phase-tag">
                                                            USER AGENCY
                                                        </span>
                                                    </div>
                                                    <div className="time-content">
                                                        <h4>
                                                            Shadow DOM Decision
                                                            Prompt
                                                        </h4>
                                                        <p>
                                                            If sensitive data is
                                                            identified, ABLE
                                                            freezes host page
                                                            interaction and
                                                            projects a
                                                            tamper-proof Shadow
                                                            DOM modal. The
                                                            dialog presents the
                                                            detected risk score,
                                                            flagged asset
                                                            categories, and
                                                            matched pattern
                                                            summaries—giving the
                                                            user complete
                                                            clarity and
                                                            conscious agency to
                                                            either{' '}
                                                            <strong>
                                                                Proceed Anyway
                                                            </strong>{' '}
                                                            or{' '}
                                                            <strong>
                                                                Cancel Upload
                                                            </strong>
                                                            .
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="timeline-item">
                                                    <div className="time-header-row">
                                                        <span className="time-marker">
                                                            04
                                                        </span>
                                                        <span className="time-phase-tag">
                                                            ENFORCEMENT
                                                        </span>
                                                    </div>
                                                    <div className="time-content">
                                                        <h4>
                                                            Sanitization or
                                                            Clean Release
                                                        </h4>
                                                        <p>
                                                            If cancelled, file
                                                            inputs are safely
                                                            cleared and DOM
                                                            state is sanitized
                                                            to prevent
                                                            accidental
                                                            re-submission. If
                                                            authorized, the held
                                                            network promise is
                                                            cleanly resolved,
                                                            releasing the
                                                            payload without
                                                            network latency or
                                                            payload corruption,
                                                            and an anonymized
                                                            egress record is
                                                            queued for research
                                                            analysis.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Subpage 5: Usage & Administration */}
                                    {activeDocTab === 'guide' && (
                                        <div
                                            className="doc-pane active"
                                            id="pane-guide"
                                        >
                                            <div className="guide-cards-row">
                                                <div className="glass-subcard">
                                                    <div className="guide-card-header">
                                                        <h4>
                                                            For Knowledge
                                                            Workers & Browser
                                                            Users
                                                        </h4>
                                                        <span className="guide-badge-role">
                                                            CLIENT EXTENSION
                                                        </span>
                                                    </div>
                                                    <ul>
                                                        <li>
                                                            <strong>
                                                                Live Toolbar
                                                                Protection
                                                                Status:
                                                            </strong>{' '}
                                                            Click the pinned
                                                            ABLE shield icon
                                                            anytime to inspect
                                                            the current domain's
                                                            safety
                                                            classification
                                                            (Emerald{' '}
                                                            <code>SAFE</code>,
                                                            Amber{' '}
                                                            <code>
                                                                UNLISTED
                                                            </code>
                                                            , Crimson{' '}
                                                            <code>
                                                                RESTRICTED
                                                            </code>
                                                            ) and confirm active
                                                            DLP monitoring.
                                                        </li>
                                                        <li>
                                                            <strong>
                                                                Domain Safety &
                                                                Educational
                                                                Nudges:
                                                            </strong>{' '}
                                                            Visiting an unvetted
                                                            third-party website
                                                            or new cloud app
                                                            triggers an
                                                            unobtrusive
                                                            educational alert
                                                            before you submit
                                                            data, reinforced by
                                                            smart repeat-visit
                                                            cooldowns that
                                                            eliminate alert
                                                            fatigue.
                                                        </li>
                                                        <li>
                                                            <strong>
                                                                Evaluating
                                                                Pre-Flight
                                                                Upload Holds:
                                                            </strong>{' '}
                                                            When an egress
                                                            warning appears,
                                                            review the flagged
                                                            sensitive categories
                                                            (e.g. API keys or
                                                            internal documents)
                                                            and verify whether
                                                            external cloud
                                                            sharing complies
                                                            with your
                                                            organization's
                                                            policy.
                                                        </li>
                                                        <li>
                                                            <strong>
                                                                Community
                                                                Feedback &
                                                                False-Positive
                                                                Reporting:
                                                            </strong>{' '}
                                                            Encountering an
                                                            over-sensitive
                                                            detection? Use the
                                                            integrated Message
                                                            Board to submit
                                                            false-positive
                                                            reports and help
                                                            researchers refine
                                                            regex pattern
                                                            weighting.
                                                        </li>
                                                    </ul>
                                                </div>

                                                <div className="guide-card-header-col glass-subcard">
                                                    <div className="guide-card-header">
                                                        <h4>
                                                            For Security
                                                            Administrators &
                                                            Researchers
                                                        </h4>
                                                        <span className="guide-badge-role">
                                                            SERVER-ADMIN CONSOLE
                                                        </span>
                                                    </div>
                                                    <ul>
                                                        <li>
                                                            <strong>
                                                                Centralized
                                                                Domain Policy
                                                                Management:
                                                            </strong>{' '}
                                                            Configure, review,
                                                            and categorize
                                                            trusted enterprise
                                                            cloud endpoints
                                                            versus unvetted
                                                            Shadow IT domains
                                                            through the Laravel
                                                            + React
                                                            administrative
                                                            research dashboard.
                                                        </li>
                                                        <li>
                                                            <strong>
                                                                Cryptographic
                                                                Pattern
                                                                Distribution:
                                                            </strong>{' '}
                                                            Define and
                                                            distribute
                                                            enterprise risk
                                                            pattern sets signed
                                                            with HMAC-SHA-256
                                                            keys, ensuring
                                                            client extensions
                                                            only execute
                                                            verified,
                                                            tamper-proof
                                                            detection criteria.
                                                        </li>
                                                        <li>
                                                            <strong>
                                                                Fleet-Wide
                                                                Shadow IT &
                                                                Egress
                                                                Analytics:
                                                            </strong>{' '}
                                                            Analyze aggregated
                                                            domain visit trends,
                                                            observe which
                                                            generative AI
                                                            platforms are
                                                            experiencing high
                                                            upload volume, and
                                                            measure warning
                                                            compliance rates
                                                            across user cohorts
                                                            without invading
                                                            user privacy.
                                                        </li>
                                                        <li>
                                                            <strong>
                                                                Executive
                                                                Compliance &
                                                                Audit Reporting:
                                                            </strong>{' '}
                                                            Generate structured,
                                                            privacy-preserving
                                                            incident summaries
                                                            demonstrating
                                                            proactive
                                                            browser-level DLP
                                                            enforcement for ISO
                                                            27001, SOC 2, and
                                                            data governance
                                                            evaluations.
                                                        </li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ========================================================
                        SECTION 3: DOWNLOAD
                        ======================================================== */}
                    <section
                        className="bleed-panel in-view no-scrollbar"
                        id="download"
                        data-section="download"
                    >
                        <div className="panel-inner download-inner no-scrollbar">
                            <div className="section-lead">
                                <span className="minimal-badge">
                                    EXTENSION PACKAGE
                                </span>
                                <h2 className="section-heading">
                                    Download ABLE
                                </h2>
                                <p className="section-subtext">
                                    Install the research extension directly into
                                    Google Chrome, Brave, Microsoft Edge, or any
                                    Chromium browser.
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
                                                    ).src =
                                                        '/assets/icon-128.png';
                                                }}
                                            />
                                        </div>
                                        <div className="dl-app-info">
                                            <h3>ABLE Extension</h3>
                                            <div className="meta-tags">
                                                <span className="tag tag-highlight">
                                                    Chrome Web Store
                                                </span>
                                                <span className="tag">
                                                    v0.1.0
                                                </span>
                                                <span className="tag">
                                                    Manifest V3
                                                </span>
                                                <span className="tag">
                                                    Official Release
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="dl-description">
                                        Official published release for Google
                                        Chrome and Chromium browsers. Operates
                                        in real-time at the browser boundary to
                                        intercept unvetted file uploads,
                                        classify domain risks, and protect
                                        sensitive credentials, API keys, and
                                        enterprise data.
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
                                            <span>
                                                Add to Chrome (Web Store)
                                            </span>
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
                                                <line
                                                    x1={10}
                                                    y1={14}
                                                    x2={21}
                                                    y2={3}
                                                />
                                            </svg>
                                        </a>
                                    </div>

                                    {/* Extension ID Checksum Box */}
                                    <div className="checksum-glass-box">
                                        <span className="cs-label">
                                            CHROME STORE ID
                                        </span>
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
                                            <span>
                                                {csCopied ? 'Copied!' : 'Copy'}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Installation Walkthrough Card */}
                                <div className="glass-card install-walkthrough-card">
                                    <h3>Installation Walkthrough</h3>

                                    <div className="steps-list">
                                        <div className="step-card">
                                            <span className="step-badge">
                                                1
                                            </span>
                                            <div>
                                                <h4>Open Web Store Listing</h4>
                                                <p>
                                                    Click{' '}
                                                    <strong>
                                                        Add to Chrome
                                                    </strong>{' '}
                                                    above to visit the verified
                                                    extension page on the Chrome
                                                    Web Store.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="step-card">
                                            <span className="step-badge">
                                                2
                                            </span>
                                            <div>
                                                <h4>Confirm Installation</h4>
                                                <p>
                                                    Click the blue{' '}
                                                    <strong>
                                                        Add to Chrome
                                                    </strong>{' '}
                                                    button on the store, then
                                                    confirm by selecting{' '}
                                                    <strong>
                                                        Add extension
                                                    </strong>
                                                    .
                                                </p>
                                            </div>
                                        </div>

                                        <div className="step-card">
                                            <span className="step-badge">
                                                3
                                            </span>
                                            <div>
                                                <h4>
                                                    Pin & Activate Protection
                                                </h4>
                                                <p>
                                                    Click the puzzle icon in
                                                    your browser toolbar and pin
                                                    the{' '}
                                                    <strong>ABLE shield</strong>{' '}
                                                    icon for real-time
                                                    visibility.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="compat-footer">
                                        <span>
                                            Compatible with Google Chrome,
                                            Brave, Microsoft Edge, Opera, and
                                            Vivaldi.
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
                                    <h3>
                                        What to Expect Once Installed on Your
                                        Device
                                    </h3>
                                    <p>
                                        Immediately after adding ABLE to your
                                        browser, here is how the extension
                                        safeguards your daily browsing workflow:
                                    </p>
                                </div>

                                <div className="expectations-grid">
                                    <div className="expect-item">
                                        <div
                                            className="expect-icon-wrap"
                                            style={{
                                                color: 'var(--color-able-green)',
                                            }}
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
                                                Click the pinned ABLE shield
                                                anytime to inspect the current
                                                domain's safety classification
                                                (Safe, Unlisted, or Restricted)
                                                and view your active protection
                                                status.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="expect-item">
                                        <div
                                            className="expect-icon-wrap"
                                            style={{
                                                color: 'var(--accent-amber)',
                                            }}
                                        >
                                            <svg
                                                width={18}
                                                height={18}
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <circle
                                                    cx={12}
                                                    cy={12}
                                                    r={10}
                                                />
                                                <line
                                                    x1={12}
                                                    y1={8}
                                                    x2={12}
                                                    y2={12}
                                                />
                                                <line
                                                    x1={12}
                                                    y1={16}
                                                    x2={12.01}
                                                    y2={16}
                                                />
                                            </svg>
                                        </div>
                                        <div>
                                            <h4>Smart Domain Safety Nudges</h4>
                                            <p>
                                                When you visit an unlisted or
                                                newly encountered third-party
                                                website, an unobtrusive
                                                educational alert informs you
                                                before you submit data or
                                                interact.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="expect-item">
                                        <div
                                            className="expect-icon-wrap"
                                            style={{
                                                color: 'var(--accent-cyan)',
                                            }}
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
                                                <line
                                                    x1={16}
                                                    y1={13}
                                                    x2={8}
                                                    y2={13}
                                                />
                                                <line
                                                    x1={16}
                                                    y1={17}
                                                    x2={8}
                                                    y2={17}
                                                />
                                            </svg>
                                        </div>
                                        <div>
                                            <h4>Pre-Flight Upload Hold</h4>
                                            <p>
                                                Outbound documents (.pdf, .docx,
                                                .xlsx) and text inputs are
                                                parsed locally in memory before
                                                network transmission to screen
                                                for sensitive data.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="expect-item">
                                        <div
                                            className="expect-icon-wrap"
                                            style={{
                                                color: 'var(--accent-purple)',
                                            }}
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
                                                <line
                                                    x1={12}
                                                    y1={9}
                                                    x2={12}
                                                    y2={13}
                                                />
                                                <line
                                                    x1={12}
                                                    y1={17}
                                                    x2={12.01}
                                                    y2={17}
                                                />
                                            </svg>
                                        </div>
                                        <div>
                                            <h4>Shadow DOM Decision Prompt</h4>
                                            <p>
                                                If sensitive credentials or API
                                                keys are detected, an isolated
                                                modal reveals the risk score and
                                                detected patterns, giving you
                                                agency to Proceed or Cancel.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ========================================================
                        SECTION 4: CONTACT US & MESSAGE BOARD
                        ======================================================== */}
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
                                <h2 className="section-heading">
                                    Message Board
                                </h2>
                                <p className="section-subtext">
                                    Submit comments, feature suggestions,
                                    false-positive reports, or complaints to
                                    help us improve in-browser detection
                                    accuracy.
                                </p>
                            </div>

                            <div className="contact-grid">
                                {/* Message Submission Form */}
                                <div className="glass-card form-card">
                                    <div className="card-head">
                                        <h3>Post a Message</h3>
                                        <p>
                                            Your submission will be immediately
                                            shared to the research board below.
                                        </p>
                                    </div>

                                    <form
                                        onSubmit={handlePostSubmit}
                                        className="minimal-form"
                                    >
                                        <div className="form-row-category">
                                            <span className="field-label">
                                                Category
                                            </span>
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
                                                        'access-request',
                                                    ] as const
                                                ).map((cat) => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        className={`cat-chip ${selectedCat === cat ? 'active' : ''}`}
                                                        onClick={() =>
                                                            setSelectedCat(cat)
                                                        }
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
                                                            setAuthorName(
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="e.g. Auditor7"
                                                        required
                                                        maxLength={32}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn-rand-alias"
                                                        onClick={
                                                            handleRandomAlias
                                                        }
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
                                                        setTargetDomain(
                                                            e.target.value,
                                                        )
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
                                                    setMessageBody(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Share your feedback, bug report, or detection observation..."
                                                required
                                                maxLength={800}
                                            />
                                            <div className="char-notice">
                                                <span>
                                                    {800 - messageBody.length}{' '}
                                                    chars remaining
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
                                                    <circle
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                    />
                                                    <line
                                                        x1="12"
                                                        y1="16"
                                                        x2="12"
                                                        y2="12"
                                                    />
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
                                                    <line
                                                        x1="12"
                                                        y1="8"
                                                        x2="12"
                                                        y2="12"
                                                    />
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
                                                <span>
                                                    ✓ Submitted for Review
                                                </span>
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
                                                        setActiveFeedFilter(
                                                            filterKey,
                                                        )
                                                    }
                                                >
                                                    {filterKey === 'all'
                                                        ? 'All'
                                                        : filterKey ===
                                                            'suggestion'
                                                          ? 'Suggestions'
                                                          : filterKey ===
                                                              'comment'
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
                                                No posts found for this
                                                category.
                                            </div>
                                        ) : (
                                            filteredMessages.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="stream-item"
                                                >
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
                                                    <p className="item-body">
                                                        {item.body}
                                                    </p>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="operator-line">
                                        <span>
                                            Project Researcher:{' '}
                                            <strong>John Claude Bacarro</strong>{' '}
                                            &bull;{' '}
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
                </main>
            </div>
        </>
    );
}
