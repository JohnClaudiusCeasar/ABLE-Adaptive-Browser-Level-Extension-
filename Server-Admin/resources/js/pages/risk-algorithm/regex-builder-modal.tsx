import { X, Search, Check, AlertCircle, AlertTriangle, Sparkles, BookOpen, Wand2, TestTube2, Plus } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { PatternTemplate } from './regex-templates';
import { PATTERN_TEMPLATES } from './regex-templates';
import type { RegexMatchResult } from './regex-utils';
import { validateRegex, unifiedMaskToRegex, testRegexMatches } from './regex-utils';

interface RegexBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTitle?: string;
    initialRegex: string;
    initialScore?: number;
    onApply: (result: { regex: string; title?: string; score?: number }) => void;
}

type BuilderTab = 'templates' | 'builder' | 'tester';

const UNIFIED_EXAMPLES = [
    {
        label: 'Student ID with Year Mask',
        value: '20##-#####, 19##-#####, STU-####-#####',
    },
    {
        label: 'Document Classification Phrases',
        value: 'CONFIDENTIAL, RESTRICTED, TOP SECRET, CLASSIFIED',
    },
    {
        label: 'Label with Value Mask',
        value: 'Account No: ####-####, Card: ####-####-####-####',
    },
    {
        label: 'University Form Titles',
        value: 'Transcript of Records, Grading Sheet, Class Record, Student Clearance',
    },
];

export function RegexBuilderModal({
    isOpen,
    onClose,
    initialTitle = '',
    initialRegex = '',
    initialScore = 20,
    onApply,
}: RegexBuilderModalProps) {
    const [activeTab, setActiveTab] = useState<BuilderTab>(
        initialRegex ? 'tester' : 'templates',
    );

    // Working state
    const [title, setTitle] = useState(initialTitle);
    const [regex, setRegex] = useState(initialRegex);
    const [score, setScore] = useState<number>(initialScore);

    // Unified format mask state
    const [unifiedInput, setUnifiedInput] = useState('');
    const [wholeWord, setWholeWord] = useState(true);
    const [flexibleWhitespace, setFlexibleWhitespace] = useState(true);

    // Templates state
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [templateSearch, setTemplateSearch] = useState('');

    // Tester state
    const [sampleText, setSampleText] = useState(
        'Student ID: 2024-10345\nStatus: Enrolled in College of Computer Studies\nDocument: OFFICIAL TRANSCRIPT OF RECORDS\nAccount No: 1234-5678\nContact: student.support@university.edu.ph or 09171234567\nNotice: THIS RECORD IS CONFIDENTIAL',
    );

    // Live validation
    const validation = useMemo(() => validateRegex(regex), [regex]);

    // Live match testing
    const matches: RegexMatchResult[] = useMemo(() => {
        if (!validation.isValid || !regex.trim()) {
            return [];
        }

        return testRegexMatches(regex, sampleText);
    }, [regex, sampleText, validation.isValid]);

    function handleUnifiedInputChange(newInput: string, newWholeWord: boolean, newFlexibleWs: boolean) {
        setUnifiedInput(newInput);
        setWholeWord(newWholeWord);
        setFlexibleWhitespace(newFlexibleWs);

        if (newInput.trim()) {
            const compiled = unifiedMaskToRegex(newInput, {
                matchWholeWord: newWholeWord,
                flexibleWhitespace: newFlexibleWs,
            });

            setRegex(compiled);
        } else {
            setRegex('');
        }
    }

    function appendToken(token: string) {
        const nextInput = unifiedInput ? `${unifiedInput}${token}` : token;

        handleUnifiedInputChange(nextInput, wholeWord, flexibleWhitespace);
    }

    // Filter templates
    const filteredTemplates = useMemo(() => {
        const query = templateSearch.toLowerCase().trim();

        return PATTERN_TEMPLATES.filter((tpl) => {
            const matchesCat = selectedCategory === 'All' || tpl.category === selectedCategory;
            const matchesQuery =
                !query ||
                tpl.title.toLowerCase().includes(query) ||
                tpl.description.toLowerCase().includes(query) ||
                tpl.regex.toLowerCase().includes(query);

            return matchesCat && matchesQuery;
        });
    }, [selectedCategory, templateSearch]);

    function handleSelectTemplate(tpl: PatternTemplate) {
        setTitle(tpl.title);
        setRegex(tpl.regex);
        setScore(tpl.defaultScore);

        if (tpl.sampleMatch) {
            setSampleText(`${tpl.sampleMatch}\n${tpl.sampleNonMatch}`);
        }

        setActiveTab('tester');
    }

    function handleApply() {
        if (!validation.isValid) {
            return;
        }

        onApply({
            regex,
            title: title.trim() || undefined,
            score,
        });

        onClose();
    }

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="flex h-[42rem] max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[rgba(34,197,94,0.4)] bg-card text-card-foreground shadow-2xl dark:bg-[#0c141f]">
                {/* Modal Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-able-green/10 p-2 text-able-green">
                            <Wand2 size={20} />
                        </div>
                        <div>
                            <h2
                                className="text-lg font-bold tracking-tight text-foreground"
                                style={{ fontFamily: "'Unbounded', sans-serif" }}
                            >
                                Regex Pattern Assistant
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Build, test, and choose validated regex patterns for sensitive data detection.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex shrink-0 border-b border-border bg-muted/40 px-6">
                    <button
                        type="button"
                        onClick={() => setActiveTab('templates')}
                        className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                            activeTab === 'templates'
                                ? 'border-able-green text-able-green'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <BookOpen size={16} />
                        Template Catalog
                        <span className="rounded-full bg-able-green/10 px-2 py-0.5 text-xs text-able-green">
                            {PATTERN_TEMPLATES.length}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('builder')}
                        className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                            activeTab === 'builder'
                                ? 'border-able-green text-able-green'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Sparkles size={16} />
                        Add Pattern
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('tester')}
                        className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                            activeTab === 'tester'
                                ? 'border-able-green text-able-green'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <TestTube2 size={16} />
                        Test & Sandbox
                        {matches.length > 0 && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500 font-bold">
                                {matches.length} hits
                            </span>
                        )}
                    </button>
                </div>

                {/* Tab Content Body */}
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
                    {/* TAB 1: TEMPLATE CATALOG */}
                    {activeTab === 'templates' && (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="relative flex-1">
                                    <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search template name, description, or regex..."
                                        value={templateSearch}
                                        onChange={(e) => setTemplateSearch(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-sm text-foreground outline-none focus:border-able-green"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                    {['All', 'Academic & University', 'PII & Identity', 'Credentials & Secrets', 'Document Classification'].map(
                                        (cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setSelectedCategory(cat)}
                                                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                                                    selectedCategory === cat
                                                        ? 'bg-able-green text-white'
                                                        : 'bg-muted text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {filteredTemplates.map((tpl) => (
                                    <div
                                        key={tpl.id}
                                        onClick={() => handleSelectTemplate(tpl)}
                                        className="group flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-card p-4 transition-all hover:border-able-green/60 hover:shadow-md dark:bg-card/40"
                                    >
                                        <div>
                                            <div className="mb-1 flex items-start justify-between gap-2">
                                                <h4 className="font-semibold text-foreground group-hover:text-able-green">
                                                    {tpl.title}
                                                </h4>
                                                <span className="shrink-0 rounded-full bg-able-green/10 px-2 py-0.5 text-[11px] font-semibold text-able-green">
                                                    Score: {tpl.defaultScore}
                                                </span>
                                            </div>
                                            <p className="mb-2 text-xs text-muted-foreground line-clamp-2">
                                                {tpl.description}
                                            </p>
                                            <div className="rounded bg-muted/60 p-2 font-mono text-[11px] text-foreground/90 break-all select-all">
                                                {tpl.regex}
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                                            <span className="text-muted-foreground">
                                                Match example: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{tpl.sampleMatch}</span>
                                            </span>
                                            <span className="font-semibold text-able-green group-hover:underline">
                                                Select & Test →
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {filteredTemplates.length === 0 && (
                                    <div className="col-span-2 py-12 text-center text-sm text-muted-foreground">
                                        No templates found matching your search.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: ADD PATTERN (UNIFIED MASK & KEYWORD BUILDER) */}
                    {activeTab === 'builder' && (
                        <div className="flex flex-col gap-5">
                            <div>
                                <div className="mb-1 flex items-center justify-between">
                                    <label className="text-sm font-medium text-foreground">
                                        Add Pattern
                                    </label>
                                    <span className="text-xs text-muted-foreground">
                                        Combine keywords, literal labels, and mask placeholders
                                    </span>
                                </div>

                                {/* Quick-insert helper token chips */}
                                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                                    <span className="text-[11px] font-medium text-muted-foreground">
                                        Insert tokens:
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => appendToken('#')}
                                        className="flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 font-mono text-[11px] font-semibold text-foreground transition-colors hover:border-able-green hover:text-able-green"
                                        title="Match a single digit (0-9)"
                                    >
                                        <Plus size={11} /> # (Digit)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => appendToken('####')}
                                        className="flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 font-mono text-[11px] font-semibold text-foreground transition-colors hover:border-able-green hover:text-able-green"
                                        title="Match 4 digits (e.g. year or 4-digit code)"
                                    >
                                        <Plus size={11} /> #### (4 Digits)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => appendToken('@')}
                                        className="flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 font-mono text-[11px] font-semibold text-foreground transition-colors hover:border-able-green hover:text-able-green"
                                        title="Match an alphabet letter (A-Z)"
                                    >
                                        <Plus size={11} /> @ (Letter)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => appendToken('*')}
                                        className="flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 font-mono text-[11px] font-semibold text-foreground transition-colors hover:border-able-green hover:text-able-green"
                                        title="Match any alphanumeric character"
                                    >
                                        <Plus size={11} /> * (Alphanumeric)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => appendToken('(19|20)')}
                                        className="flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 font-mono text-[11px] font-semibold text-foreground transition-colors hover:border-able-green hover:text-able-green"
                                        title="Match either 19 or 20"
                                    >
                                        <Plus size={11} /> (A|B) Choices
                                    </button>
                                </div>

                                <textarea
                                    rows={4}
                                    value={unifiedInput}
                                    onChange={(e) =>
                                        handleUnifiedInputChange(
                                            e.target.value,
                                            wholeWord,
                                            flexibleWhitespace,
                                        )
                                    }
                                    placeholder="e.g. Student ID: 20##-#####, STU-####-#####, Transcript of Records, CONFIDENTIAL"
                                    className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm text-foreground outline-none focus:border-able-green"
                                />

                                {/* Legend Cards */}
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                                    <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                                        <div className="font-mono font-bold text-able-green">Words / Phrases</div>
                                        <div className="text-[11px] text-muted-foreground mt-0.5">
                                            Matches literal words (e.g. <span className="text-foreground">Transcript</span>)
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                                        <div className="font-mono font-bold text-cyan-600 dark:text-cyan-400"># = Digit (0-9)</div>
                                        <div className="text-[11px] text-muted-foreground mt-0.5">
                                            <span className="text-foreground">####</span> becomes <span className="font-mono text-foreground">\d&#123;4&#125;</span>
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                                        <div className="font-mono font-bold text-purple-600 dark:text-purple-400">@ = Letter (A-Z)</div>
                                        <div className="text-[11px] text-muted-foreground mt-0.5">
                                            <span className="text-foreground">@@@</span> becomes <span className="font-mono text-foreground">[A-Za-z]&#123;3&#125;</span>
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                                        <div className="font-mono font-bold text-amber-600 dark:text-amber-400">, (Comma)</div>
                                        <div className="text-[11px] text-muted-foreground mt-0.5">
                                            Separates alternatives (<span className="text-foreground">Option 1 OR Option 2</span>)
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Preset Example Quick Fillers */}
                            <div>
                                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Try Quick Presets:
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {UNIFIED_EXAMPLES.map((ex) => (
                                        <button
                                            key={ex.label}
                                            type="button"
                                            onClick={() =>
                                                handleUnifiedInputChange(
                                                    ex.value,
                                                    wholeWord,
                                                    flexibleWhitespace,
                                                )
                                            }
                                            className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-able-green hover:text-foreground"
                                        >
                                            {ex.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Options */}
                            <div className="flex flex-wrap items-center gap-6 border-t border-border pt-4">
                                <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                                    <input
                                        type="checkbox"
                                        checked={wholeWord}
                                        onChange={(e) =>
                                            handleUnifiedInputChange(
                                                unifiedInput,
                                                e.target.checked,
                                                flexibleWhitespace,
                                            )
                                        }
                                        className="rounded border-border accent-able-green"
                                    />
                                    <span>Match whole words only (\b) — prevents false matches inside longer text</span>
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                                    <input
                                        type="checkbox"
                                        checked={flexibleWhitespace}
                                        onChange={(e) =>
                                            handleUnifiedInputChange(
                                                unifiedInput,
                                                wholeWord,
                                                e.target.checked,
                                            )
                                        }
                                        className="rounded border-border accent-able-green"
                                    />
                                    <span>Flexible whitespace (\s+) — matches extra spaces or line breaks</span>
                                </label>
                            </div>

                            {/* Generated Regex Preview */}
                            <div className="rounded-xl border border-border bg-muted/30 p-4">
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                                        Compiled Regex Pattern
                                    </span>
                                    {regex && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('tester')}
                                            className="text-xs font-semibold text-able-green hover:underline"
                                        >
                                            Test this in sandbox →
                                        </button>
                                    )}
                                </div>
                                <div className="rounded-lg border border-border bg-background p-3 font-mono text-sm text-foreground break-all">
                                    {regex || (
                                        <span className="text-muted-foreground italic">
                                            Type in the input above to generate pattern...
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: TESTER & SANDBOX */}
                    {activeTab === 'tester' && (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            {/* Left Column: Pattern & Settings */}
                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-foreground">
                                        Pattern Title / Label
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Student ID - Year Sequence"
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-able-green"
                                    />
                                </div>

                                <div>
                                    <div className="mb-1 flex items-center justify-between">
                                        <label className="text-sm font-medium text-foreground">
                                            Regular Expression
                                        </label>
                                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                                            {validation.isValid ? (
                                                <span className="flex items-center gap-1 text-emerald-500">
                                                    <Check size={14} /> Valid Syntax
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-red-500">
                                                    <AlertCircle size={14} /> Syntax Error
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={regex}
                                        onChange={(e) => setRegex(e.target.value)}
                                        placeholder="Enter regex (e.g. \b\d{4}-\d{5}\b)"
                                        className={`w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none ${
                                            validation.isValid ? 'border-border focus:border-able-green' : 'border-red-500 focus:border-red-500'
                                        }`}
                                    />
                                    {validation.error && (
                                        <p className="mt-1 text-xs text-red-500 font-medium">
                                            {validation.error}
                                        </p>
                                    )}
                                    {validation.warning && (
                                        <p className="mt-1 flex items-center gap-1 text-xs text-amber-500 font-medium">
                                            <AlertTriangle size={12} className="shrink-0" />
                                            {validation.warning}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-foreground">
                                        Assigned Risk Score (0-100)
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={score}
                                        onChange={(e) => setScore(parseInt(e.target.value) || 0)}
                                        className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-able-green"
                                    />
                                </div>
                            </div>

                            {/* Right Column: Live Match Playground */}
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-foreground">
                                        Test Sample Text
                                    </label>
                                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                                        Matches: {matches.length}
                                    </span>
                                </div>
                                <textarea
                                    rows={7}
                                    value={sampleText}
                                    onChange={(e) => setSampleText(e.target.value)}
                                    placeholder="Type or paste sample text from a document to test..."
                                    className="w-full rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-foreground outline-none focus:border-able-green"
                                />

                                {/* Matched items pills */}
                                <div>
                                    <span className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">
                                        Captured Text Matches:
                                    </span>
                                    <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2 text-xs">
                                        {matches.map((m, idx) => (
                                            <span
                                                key={idx}
                                                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-emerald-600 dark:text-emerald-400"
                                            >
                                                &quot;{m.text}&quot;
                                            </span>
                                        ))}
                                        {matches.length === 0 && (
                                            <span className="text-muted-foreground italic">
                                                No matches found in sample text.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex shrink-0 items-center justify-between border-t border-border bg-muted/30 px-6 py-4">
                    <div className="flex items-center gap-2">
                        {regex && (
                            <div className="font-mono text-xs text-muted-foreground max-w-sm truncate" title={regex}>
                                Active: <span className="font-semibold text-foreground">{regex}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={!regex.trim() || !validation.isValid}
                            onClick={handleApply}
                            className="flex items-center gap-2 rounded-lg bg-able-green px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                        >
                            <Check size={16} />
                            Apply Pattern
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
