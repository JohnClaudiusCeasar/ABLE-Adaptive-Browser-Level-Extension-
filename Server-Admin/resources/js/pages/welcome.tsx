import { Head, router, usePage } from '@inertiajs/react';
import {
    useState,
    useEffect,
    useLayoutEffect,
    useCallback,
    useRef,
} from 'react';
import { CommunitySection } from '@/components/landing/CommunitySection';
import type { StreamMessage } from '@/components/landing/CommunitySection';
import { DocsSection } from '@/components/landing/DocsSection';
import { DownloadSection } from '@/components/landing/DownloadSection';
import { HomeSection } from '@/components/landing/HomeSection';
import { clearSignedOut } from '@/lib/back-navigation-guard';
import '../../css/landing.css';

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
    const { extension_version } = usePage<{ extension_version?: string }>()
        .props;
    // -------------------------------------------------------------
    // State Management
    // -------------------------------------------------------------
    const [activeSection, setActiveSection] = useState<
        'home' | 'docs' | 'download' | 'contact'
    >('home');

    // Refs
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportRef = useRef<HTMLElement | null>(null);
    const navTrackRef = useRef<HTMLElement | null>(null);
    const navPillRef = useRef<HTMLDivElement | null>(null);
    const navPillPlacedRef = useRef(false);
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
    const updateNavPill = useCallback((section: string) => {
        const track = navTrackRef.current;
        const pill = navPillRef.current;

        if (!track || !pill) {
            return;
        }

        const linkMap: Record<string, HTMLAnchorElement | null> = {
            home: homeLinkRef.current,
            docs: docsLinkRef.current,
            download: downloadLinkRef.current,
            contact: contactLinkRef.current,
        };
        const activeLink = linkMap[section];

        if (!activeLink) {
            return;
        }

        const trackRect = track.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        const trackStyle = window.getComputedStyle(track);

        /*
         * Rect measurements come back in scaled pixels, while the values
         * written back to the style are plain CSS pixels. They only agree
         * at a scale of 1, so the ratio between both is used to normalise
         * the numbers. Without it the pill is oversized on pages that zoom
         * the root element (accessibility zoom tools do exactly that).
         */
        const scale = track.offsetWidth
            ? trackRect.width / track.offsetWidth
            : 1;

        /*
         * The pill is absolutely positioned inside the track, so its origin
         * is the track's padding box (its inner border edge) rather than its
         * outer border box. Measuring against the correct origin is what
         * keeps the pill flush with the active label.
         */
        const originX =
            trackRect.left +
            (parseFloat(trackStyle.borderLeftWidth) || 0) * scale;
        const originY =
            trackRect.top +
            (parseFloat(trackStyle.borderTopWidth) || 0) * scale;

        pill.style.width = `${linkRect.width / scale}px`;
        pill.style.height = `${linkRect.height / scale}px`;
        pill.style.transform = `translate(${
            (linkRect.left - originX) / scale
        }px, ${(linkRect.top - originY) / scale}px)`;
    }, []);

    useLayoutEffect(() => {
        const track = navTrackRef.current;
        const pill = navPillRef.current;

        if (!track || !pill) {
            return;
        }

        // The very first placement must not slide in from a collapsed pill.
        if (!navPillPlacedRef.current) {
            navPillPlacedRef.current = true;
            pill.style.transition = 'none';
        }

        updateNavPill(activeSection);

        let cancelled = false;

        /*
         * Web fonts resolve after the first paint and change the label
         * metrics, so the pill has to be re-measured once they land.
         */
        const fontsReady: Promise<unknown> = document.fonts
            ? document.fonts.ready
            : Promise.resolve();

        fontsReady.then(() => {
            if (cancelled) {
                return;
            }

            updateNavPill(activeSection);
            pill.style.transition = '';
        });

        const handleResize = () => updateNavPill(activeSection);
        window.addEventListener('resize', handleResize);

        /*
         * Catches metric changes that leave the viewport size untouched
         * (font swap, responsive breakpoints) but move the labels.
         */
        const observer = new ResizeObserver(() => updateNavPill(activeSection));
        observer.observe(track);

        return () => {
            cancelled = true;
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, [activeSection, updateNavPill]);

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

            // Documentation Wrapper Condition:
            // If the mouse pointer is inside the documentation wrapper (.docs-glass-container),
            // scrolling on either scrollable component (.docs-chapter-nav or .docs-content-area)
            // scrolls that component, and reaching the end of the container will NOT
            // cause the page to slide down to the next page content.
            const docsWrapper = target
                ? (target.closest(
                      '.docs-glass-container',
                  ) as HTMLElement | null)
                : null;

            if (docsWrapper) {
                const docsScrollable = target
                    ? (target.closest(
                          '.docs-chapter-nav, .docs-content-area',
                      ) as HTMLElement | null)
                    : null;

                if (docsScrollable) {
                    docsScrollable.scrollTop += e.deltaY;
                } else {
                    const fallbackContent = docsWrapper.querySelector(
                        '.docs-content-area',
                    ) as HTMLElement | null;

                    if (fallbackContent) {
                        fallbackContent.scrollTop += e.deltaY;
                    }
                }

                e.preventDefault();

                return;
            }

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
                    scrollableParent.scrollTop += e.deltaY;
                    e.preventDefault();

                    return; // Smoothly scroll component via mouse wheel without viewport jump
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
                                // Deliberately opening the sign-in screen, so
                                // history navigation to it is allowed again.
                                clearSignedOut();
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
                            <span className="brand-title">
                                ABL<span className="brand-title-accent">E</span>
                            </span>
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
                    <HomeSection scrollToSection={scrollToSection} />
                    <DocsSection />
                    <DownloadSection extensionVersion={extension_version} />
                    <CommunitySection
                        initialMessages={initialMessages}
                        requestDomain={requestDomain}
                    />
                </main>
            </div>
        </>
    );
}
