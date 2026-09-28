import type { CSSProperties } from 'react';

export type PaperSize = 'a4' | 'letter';
export type Orientation = 'portrait' | 'landscape';

const PX_PER_MM = 96 / 25.4;

export const PAGE_MM: Record<PaperSize, { width: number; height: number }> = {
    a4: { width: 210, height: 297 },
    letter: { width: 215.9, height: 279.4 },
};

/** Page margin, expressed as the sheet's own padding so `@page` can use `margin: 0`. */
export const PAGE_MARGIN_MM = { x: 10, y: 8 };

export interface PageGeometry {
    widthMm: number;
    heightMm: number;
    widthPx: number;
    heightPx: number;
    cssVars: CSSProperties;
}

/**
 * Single source of truth for the document box. The preview sheet, the print
 * iframe and the html2canvas capture all read from here, so the three render
 * at identical dimensions instead of at 800px / 190mm / 1100px respectively.
 */
export function pageGeometry(
    paper: PaperSize,
    orientation: Orientation,
): PageGeometry {
    const page = PAGE_MM[paper];
    const widthMm = orientation === 'portrait' ? page.width : page.height;
    const heightMm = orientation === 'portrait' ? page.height : page.width;
    const widthPx = Math.round(widthMm * PX_PER_MM);
    const heightPx = Math.round(heightMm * PX_PER_MM);

    return {
        widthMm,
        heightMm,
        widthPx,
        heightPx,
        cssVars: {
            '--page-w': `${widthMm}mm`,
            '--page-h': `${heightMm}mm`,
            '--page-pad-x': `${PAGE_MARGIN_MM.x}mm`,
            '--page-pad-y': `${PAGE_MARGIN_MM.y}mm`,
        } as CSSProperties,
    };
}

const COLOR_PROPERTIES = [
    'color',
    'background-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'text-decoration-color',
    'caret-color',
    '-webkit-text-stroke-color',
] as const;

/** Values html2canvas 1.4.1 can parse on its own (rgb/rgba/hsl/hsla, hex, named). */
const SAFE_COLOR =
    /^(#|rgb\(|rgba\(|hsl\(|hsla\(|transparent$|none$|inherit$|initial$|unset$|currentcolor$)/i;

/** Values html2canvas rejects with "Attempting to parse an unsupported color function". */
const UNSUPPORTED_COLOR = /(oklch|oklab|lab\(|lch\(|color-mix|\bcolor\()/i;

const COMPLEX_PROPERTIES = ['box-shadow', 'background-image'] as const;

let probe: CanvasRenderingContext2D | null = null;

/**
 * Resolves any CSS color the browser understands (oklch, oklab, lab, lch,
 * color-mix, color()) down to rgb()/rgba() via canvas serialization, which
 * html2canvas does understand. Returns null when the value is already safe or
 * cannot be resolved, so the caller leaves it untouched.
 */
function toRgb(value: string): string | null {
    const raw = value.trim();

    if (!raw || SAFE_COLOR.test(raw)) {
        return null;
    }

    probe ??= document.createElement('canvas').getContext('2d');

    if (!probe) {
        return null;
    }

    // Two distinct sentinels: if the assignment is ignored the two readbacks
    // differ, which also lets a legitimate colour equal to a sentinel through.
    probe.fillStyle = '#010203';
    probe.fillStyle = raw;
    const first = probe.fillStyle;
    probe.fillStyle = '#040506';
    probe.fillStyle = raw;
    const second = probe.fillStyle;

    return first === second ? second : null;
}

/**
 * Rewrites every colour in the subtree html2canvas is about to parse into a
 * form its parser accepts. html2canvas throws (there is no try/catch on that
 * path) on the first OKLCH colour, which every Tailwind v4 palette token is.
 */
export function normalizeCaptureColors(root: Element): void {
    const elements = [
        root as HTMLElement,
        ...root.querySelectorAll<HTMLElement>('*'),
    ];

    for (const element of elements) {
        const computed =
            element.ownerDocument.defaultView?.getComputedStyle(element);

        if (!computed) {
            continue;
        }

        const inheritedColor = computed.getPropertyValue('color');

        for (const property of COLOR_PROPERTIES) {
            const current = computed.getPropertyValue(property);
            const normalized =
                toRgb(current) ??
                (current.trim() === 'currentcolor'
                    ? inheritedColor.trim()
                    : null);

            if (normalized && normalized !== current) {
                element.style.setProperty(property, normalized);
            }
        }

        for (const property of COMPLEX_PROPERTIES) {
            const current = computed.getPropertyValue(property);

            if (current && UNSUPPORTED_COLOR.test(current)) {
                element.style.setProperty(property, 'none');
            }
        }
    }
}

/**
 * html2pdf only removes its full-viewport, opacity-0 overlay on success. After
 * a rejected export it stays put at z-index 1000 and swallows every click on
 * the page, so always clear it ourselves.
 */
export function removeHtml2PdfOverlay(): void {
    document
        .querySelectorAll('.html2pdf__overlay, .html2pdf__container')
        .forEach((node) => node.remove());
}
