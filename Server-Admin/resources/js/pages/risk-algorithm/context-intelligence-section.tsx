import { ChevronDown, Info } from 'lucide-react';
import { useState } from 'react';

interface Props {
    negationRegex: string;
    amplifierRegex: string;
    negationWindow: number | null;
    onNegationChange: (v: string) => void;
    onAmplifierChange: (v: string) => void;
    onWindowChange: (v: number | null) => void;
}

const NEGATION_EXAMPLES = 'example|format|e\\.g\\.|dummy|redacted|template';
const AMPLIFIER_EXAMPLES = 'employee|patient|my ssn|social security';
const DEFAULT_WINDOW = 150;

/**
 * Reusable collapsible section that lets admins annotate a risk pattern with
 * contextual suppression and amplification cues. These fields are consumed by
 * `applySchemaContextModifier()` in the extension's risk-scoring.js:
 *
 *   negation_context_regex — if this matches within N chars of a hit → hit is excluded
 *   amplifier_context_regex — if this matches within N chars of a hit → hit counts double
 *   negation_window — character radius to inspect on each side of a match (default 150)
 */
export function ContextIntelligenceSection({
    negationRegex,
    amplifierRegex,
    negationWindow,
    onNegationChange,
    onAmplifierChange,
    onWindowChange,
}: Props) {
    const [open, setOpen] = useState(false);

    const hasAnyValue =
        negationRegex.trim() !== '' ||
        amplifierRegex.trim() !== '' ||
        negationWindow !== null;

    return (
        <div className="mt-[29px]">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg border border-black/10 bg-black/[0.02] px-4 py-3 text-left transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
            >
                <div className="flex items-center gap-2">
                    <Info
                        size={15}
                        className={
                            hasAnyValue
                                ? 'text-able-green'
                                : 'text-muted-foreground'
                        }
                    />
                    <span className="text-sm font-medium text-foreground">
                        Context Intelligence
                    </span>
                    {hasAnyValue && (
                        <span className="rounded-full bg-[rgba(34,197,94,0.15)] px-2 py-0.5 text-xs font-semibold text-able-green">
                            Configured
                        </span>
                    )}
                </div>
                <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div className="mt-3 space-y-4 rounded-lg border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]">
                    {/* Explainer */}
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        These optional fields let you guide the scoring engine beyond simple
                        pattern matching. When the engine finds a match for this pattern, it
                        inspects the surrounding text within the context window.{' '}
                        <span className="font-semibold text-foreground">
                            Negation context
                        </span>{' '}
                        cancels the score contribution if the match appears to be
                        descriptive (e.g. an example or template).{' '}
                        <span className="font-semibold text-foreground">
                            Amplifier context
                        </span>{' '}
                        doubles the contribution when the match appears alongside
                        real-data indicators (e.g. "employee", "patient").
                    </p>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Negation Context Regex */}
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                                Negation Context{' '}
                                <span className="text-xs font-normal opacity-60">
                                    (optional)
                                </span>
                            </label>
                            <input
                                type="text"
                                value={negationRegex}
                                onChange={(e) => onNegationChange(e.target.value)}
                                placeholder={`e.g. ${NEGATION_EXAMPLES}`}
                                className="w-full rounded-lg border border-black/10 bg-transparent px-4 py-2 font-mono text-sm text-foreground transition-colors outline-none focus:border-[#f87171] dark:border-white/10"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                If this regex matches near a hit, the hit is
                                excluded — it looks like sample/example content.
                            </p>
                        </div>

                        {/* Amplifier Context Regex */}
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                                Amplifier Context{' '}
                                <span className="text-xs font-normal opacity-60">
                                    (optional)
                                </span>
                            </label>
                            <input
                                type="text"
                                value={amplifierRegex}
                                onChange={(e) => onAmplifierChange(e.target.value)}
                                placeholder={`e.g. ${AMPLIFIER_EXAMPLES}`}
                                className="w-full rounded-lg border border-black/10 bg-transparent px-4 py-2 font-mono text-sm text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                If this regex matches near a hit, the hit counts
                                double — it looks like genuine real data.
                            </p>
                        </div>
                    </div>

                    {/* Context Window */}
                    <div className="max-w-xs">
                        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                            Context Window{' '}
                            <span className="text-xs font-normal opacity-60">
                                (chars, default {DEFAULT_WINDOW})
                            </span>
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={50}
                                max={500}
                                step={25}
                                value={negationWindow ?? DEFAULT_WINDOW}
                                onChange={(e) =>
                                    onWindowChange(parseInt(e.target.value))
                                }
                                className="flex-1 accent-able-green"
                            />
                            <span className="w-10 text-right text-sm font-semibold tabular-nums text-foreground">
                                {negationWindow ?? DEFAULT_WINDOW}
                            </span>
                            {negationWindow !== null && (
                                <button
                                    type="button"
                                    onClick={() => onWindowChange(null)}
                                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            How many characters on each side of a match to
                            inspect for context signals.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
