import { ChevronDown, Info, Check, AlertCircle, Plus } from 'lucide-react';
import { useState, useMemo } from 'react';
import { validateRegex } from './regex-utils';

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

const NEGATION_PRESETS = [
    { label: 'Sample / Template', value: 'example|sample|dummy|redacted|placeholder|template' },
    { label: 'Academic Guide / Policy', value: 'syllabus|curriculum|handbook|guidelines?|course\\s*outline' },
    { label: 'Mock / Test Data', value: 'mock|test|demo|hypothetical|fictitious' },
];

const AMPLIFIER_PRESETS = [
    { label: 'Official / Sealed', value: 'official|registrar|certified|sealed|approved' },
    { label: 'Student / Employee', value: 'student|employee|patient|faculty|applicant' },
    { label: 'Payroll / Financial', value: 'salary|payroll|compensation|tuition|account' },
];

/**
 * Reusable collapsible section that lets admins annotate a risk pattern with
 * contextual suppression and amplification cues.
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

    const negationValidation = useMemo(
        () => validateRegex(negationRegex),
        [negationRegex],
    );

    const amplifierValidation = useMemo(
        () => validateRegex(amplifierRegex),
        [amplifierRegex],
    );

    function addPreset(
        current: string,
        presetVal: string,
        onChange: (v: string) => void,
    ) {
        if (!current.trim()) {
            onChange(presetVal);

            return;
        }

        // Avoid duplicate appends
        if (current.includes(presetVal)) {
return;
}

        onChange(`${current}|${presetVal}`);
    }

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
                        These optional fields guide the scoring engine beyond simple keyword matching.
                        When a match is found, the engine scans the surrounding context window.{' '}
                        <span className="font-semibold text-foreground">
                            Negation context
                        </span>{' '}
                        cancels the match score if the text appears to be descriptive (e.g. templates, outlines).{' '}
                        <span className="font-semibold text-foreground">
                            Amplifier context
                        </span>{' '}
                        doubles the score when the match appears alongside genuine operational records.
                    </p>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {/* Negation Context Regex */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-muted-foreground">
                                    Negation Context{' '}
                                    <span className="text-xs font-normal opacity-60">
                                        (optional)
                                    </span>
                                </label>
                                {negationRegex.trim() && (
                                    <span
                                        className={`flex items-center gap-1 text-xs ${
                                            negationValidation.isValid
                                                ? 'text-emerald-500'
                                                : 'text-red-500'
                                        }`}
                                    >
                                        {negationValidation.isValid ? (
                                            <>
                                                <Check size={12} /> Valid
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle size={12} /> Syntax Error
                                            </>
                                        )}
                                    </span>
                                )}
                            </div>
                            <input
                                type="text"
                                value={negationRegex}
                                onChange={(e) =>
                                    onNegationChange(e.target.value)
                                }
                                placeholder={`e.g. ${NEGATION_EXAMPLES}`}
                                className={`w-full rounded-lg border bg-transparent px-4 py-2 font-mono text-sm text-foreground transition-colors outline-none ${
                                    negationValidation.isValid
                                        ? 'border-black/10 focus:border-[#f87171] dark:border-white/10'
                                        : 'border-red-500 focus:border-red-500'
                                }`}
                            />
                            {/* Preset chips */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[11px] font-medium text-muted-foreground">
                                    Quick presets:
                                </span>
                                {NEGATION_PRESETS.map((p) => (
                                    <button
                                        key={p.label}
                                        type="button"
                                        onClick={() =>
                                            addPreset(
                                                negationRegex,
                                                p.value,
                                                onNegationChange,
                                            )
                                        }
                                        className="flex items-center gap-1 rounded-md border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-[#f87171] hover:text-[#f87171] dark:border-white/10 dark:bg-white/5"
                                    >
                                        <Plus size={10} />
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                If this regex matches near a hit, the hit is excluded (e.g. template/sample marker).
                            </p>
                        </div>

                        {/* Amplifier Context Regex */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-muted-foreground">
                                    Amplifier Context{' '}
                                    <span className="text-xs font-normal opacity-60">
                                        (optional)
                                    </span>
                                </label>
                                {amplifierRegex.trim() && (
                                    <span
                                        className={`flex items-center gap-1 text-xs ${
                                            amplifierValidation.isValid
                                                ? 'text-emerald-500'
                                                : 'text-red-500'
                                        }`}
                                    >
                                        {amplifierValidation.isValid ? (
                                            <>
                                                <Check size={12} /> Valid
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle size={12} /> Syntax Error
                                            </>
                                        )}
                                    </span>
                                )}
                            </div>
                            <input
                                type="text"
                                value={amplifierRegex}
                                onChange={(e) =>
                                    onAmplifierChange(e.target.value)
                                }
                                placeholder={`e.g. ${AMPLIFIER_EXAMPLES}`}
                                className={`w-full rounded-lg border bg-transparent px-4 py-2 font-mono text-sm text-foreground transition-colors outline-none ${
                                    amplifierValidation.isValid
                                        ? 'border-black/10 focus:border-able-green dark:border-white/10'
                                        : 'border-red-500 focus:border-red-500'
                                }`}
                            />
                            {/* Preset chips */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[11px] font-medium text-muted-foreground">
                                    Quick presets:
                                </span>
                                {AMPLIFIER_PRESETS.map((p) => (
                                    <button
                                        key={p.label}
                                        type="button"
                                        onClick={() =>
                                            addPreset(
                                                amplifierRegex,
                                                p.value,
                                                onAmplifierChange,
                                            )
                                        }
                                        className="flex items-center gap-1 rounded-md border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-able-green hover:text-able-green dark:border-white/10 dark:bg-white/5"
                                    >
                                        <Plus size={10} />
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                If this regex matches near a hit, the hit score doubles (confirms live data).
                            </p>
                        </div>
                    </div>

                    {/* Context Window */}
                    <div className="max-w-xs pt-2">
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
                                max={1000}
                                step={25}
                                value={negationWindow ?? DEFAULT_WINDOW}
                                onChange={(e) =>
                                    onWindowChange(parseInt(e.target.value))
                                }
                                className="flex-1 accent-able-green"
                            />
                            <span className="w-10 text-right text-sm font-semibold text-foreground tabular-nums">
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
                            Character radius on each side of a match to inspect for context signals.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
