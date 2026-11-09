/**
 * ABLE Admin - Regex Utilities
 *
 * Provides real-time syntax checking, safe execution sandbox,
 * keyword-to-regex compilation, and mask translation for pattern creation.
 */

export interface RegexValidationResult {
    isValid: boolean;
    error: string | null;
    warning: string | null;
}

export interface RegexMatchResult {
    index: number;
    length: number;
    text: string;
}

// Check for nested quantifiers that cause exponential backtracking (ReDoS)
const DANGEROUS_QUANTIFIERS = /(\([^)]*[+*][^)]*\)[+*{])|(\[[^\]]*\][+*][+*])/;

/**
 * Validates whether a regex string compiles cleanly in JavaScript
 * (mirroring App\Support\JsRegex and RiskScoringService's 'iu' flags).
 */
export function validateRegex(pattern: string): RegexValidationResult {
    if (!pattern || pattern.trim() === '') {
        return { isValid: true, error: null, warning: null };
    }

    try {
        // Test compilation with the same flags ABLE uses in scoring ('i' and 'u')
        // We use a fallback try if 'u' flag fails due to custom non-unicode escapes
        try {
            new RegExp(pattern, 'iu');
        } catch {
            new RegExp(pattern, 'i');
        }
    } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Invalid regular expression';

        return {
            isValid: false,
            error: errorMsg.replace(/^Invalid regular expression:\s*/i, ''),
            warning: null,
        };
    }

    // Check potential ReDoS
    if (DANGEROUS_QUANTIFIERS.test(pattern)) {
        return {
            isValid: true,
            error: null,
            warning: 'Caution: Nested quantifiers detected. This pattern may cause slow scans or high CPU on large files.',
        };
    }

    // Check for unescaped dots that likely meant literal dots
    if (/(?<!\\)\.(?=[a-z0-9]{2,4}\b)/i.test(pattern)) {
        return {
            isValid: true,
            error: null,
            warning: 'Note: Unescaped "." matches any character. Use "\\." if you meant a literal dot.',
        };
    }

    return { isValid: true, error: null, warning: null };
}

/**
 * Escapes characters that have special meaning in regular expressions.
 */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles a list of keywords or phrases into a clean, word-bounded,
 * non-capturing group regular expression.
 *
 * Example: ["Transcript of Records", "Grade Sheet"]
 * -> \b(?:Transcript\s+of\s+Records|Grade\s+Sheet)\b
 */
export function keywordsToRegex(
    keywords: string[],
    options: {
        matchWholeWord?: boolean;
        flexibleWhitespace?: boolean;
    } = {},
): string {
    const { matchWholeWord = true, flexibleWhitespace = true } = options;

    const cleaned = keywords
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

    if (cleaned.length === 0) {
        return '';
    }

    const escapedPatterns = cleaned.map((kw) => {
        let escaped = escapeRegex(kw);

        if (flexibleWhitespace) {
            // Replace literal spaces with \s+ so "Grade  Sheet" or newlines still match
            escaped = escaped.replace(/\\\s+/g, '\\s+').replace(/\s+/g, '\\s+');
        }

        return escaped;
    });

    const body = escapedPatterns.length === 1 ? escapedPatterns[0] : `(?:${escapedPatterns.join('|')})`;

    return matchWholeWord ? `\\b${body}\\b` : body;
}

/**
 * Converts a friendly mask format into regular expression syntax.
 *
 * Rules:
 *   # -> \d (Digit 0-9)
 *   @ -> [A-Za-z] (Letter)
 *   * -> [A-Za-z0-9] (Alphanumeric)
 *   Other characters (-, /, :, space) are preserved and escaped if needed.
 *
 * Example: "####-#####" -> "\b\d{4}-\d{5}\b"
 */
export function maskToRegex(mask: string, matchWholeWord: boolean = true): string {
    if (!mask || mask.trim() === '') {
        return '';
    }

    let regex = '';
    let i = 0;

    while (i < mask.length) {
        const char = mask[i];

        if (char === '#') {
            let count = 0;

            while (i < mask.length && mask[i] === '#') {
                count++;
                i++;
            }

            regex += count === 1 ? '\\d' : `\\d{${count}}`;
        } else if (char === '@') {
            let count = 0;

            while (i < mask.length && mask[i] === '@') {
                count++;
                i++;
            }

            regex += count === 1 ? '[A-Za-z]' : `[A-Za-z]{${count}}`;
        } else if (char === '*') {
            let count = 0;

            while (i < mask.length && mask[i] === '*') {
                count++;
                i++;
            }

            regex += count === 1 ? '[A-Za-z0-9]' : `[A-Za-z0-9]{${count}}`;
        } else {
            regex += escapeRegex(char);
            i++;
        }
    }

    return matchWholeWord ? `\\b${regex}\\b` : regex;
}

export interface UnifiedMaskOptions {
    matchWholeWord?: boolean;
    flexibleWhitespace?: boolean;
}

/**
 * Compiles a single mask item that can combine literal keywords,
 * placeholders (# for digit, @ for letter, * for alphanumeric), and choices.
 */
function compileSingleMaskItem(item: string, flexibleWhitespace: boolean = true): string {
    let result = '';
    let i = 0;

    while (i < item.length) {
        const char = item[i];

        // Escaped placeholder literal: \#, \@, or \*
        if (char === '\\' && i + 1 < item.length && ['#', '@', '*'].includes(item[i + 1])) {
            result += escapeRegex(item[i + 1]);
            i += 2;
            continue;
        }

        // Choice group like (option1|option2)
        if (char === '(') {
            const closeParen = item.indexOf(')', i);

            if (closeParen !== -1 && item.slice(i, closeParen).includes('|')) {
                const choices = item
                    .slice(i + 1, closeParen)
                    .split('|')
                    .map((c) => escapeRegex(c.trim()));
                result += `(?:${choices.join('|')})`;
                i = closeParen + 1;
                continue;
            }
        }

        // Digits placeholder #
        if (char === '#') {
            let count = 0;

            while (i < item.length && item[i] === '#') {
                count++;
                i++;
            }

            result += count === 1 ? '\\d' : `\\d{${count}}`;
            continue;
        }

        // Letters placeholder @
        if (char === '@') {
            let count = 0;

            while (i < item.length && item[i] === '@') {
                count++;
                i++;
            }

            result += count === 1 ? '[A-Za-z]' : `[A-Za-z]{${count}}`;
            continue;
        }

        // Alphanumeric placeholder *
        if (char === '*') {
            let count = 0;

            while (i < item.length && item[i] === '*') {
                count++;
                i++;
            }

            result += count === 1 ? '[A-Za-z0-9]' : `[A-Za-z0-9]{${count}}`;
            continue;
        }

        // Whitespace handling
        if (/\s/.test(char)) {
            while (i < item.length && /\s/.test(item[i])) {
                i++;
            }

            result += flexibleWhitespace ? '\\s+' : ' ';
            continue;
        }

        // Colon or equals followed by optional space (e.g. "ID: ####")
        if ((char === ':' || char === '=') && flexibleWhitespace) {
            result += escapeRegex(char);
            i++;

            while (i < item.length && /\s/.test(item[i])) {
                i++;
            }

            result += '\\s*';
            continue;
        }

        // Regular character: escape if special in regex
        result += escapeRegex(char);
        i++;
    }

    return result;
}

/**
 * Unified Format Mask & Keyword to Regex Compiler.
 *
 * Combines keyword lists, phrases, and format masks in a single unified input.
 * Supports:
 *   - Plain words: "Transcript of Records, Grading Sheet"
 *   - Masks: "####-#####"
 *   - Combined words & masks: "Student ID: 20##-#####, STU-####-#####"
 *   - Alternation choices: "(19|20)##-#####"
 */
export function unifiedMaskToRegex(
    input: string,
    options: UnifiedMaskOptions = {},
): string {
    const { matchWholeWord = true, flexibleWhitespace = true } = options;

    if (!input || input.trim() === '') {
        return '';
    }

    const rawItems = input
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

    if (rawItems.length === 0) {
        return '';
    }

    const compiledItems = rawItems.map((item) => compileSingleMaskItem(item, flexibleWhitespace));

    const body = compiledItems.length === 1 ? compiledItems[0] : `(?:${compiledItems.join('|')})`;

    return matchWholeWord ? `\\b${body}\\b` : body;
}

/**
 * Safely tests a regex against sample text, returning all match positions.
 */
export function testRegexMatches(pattern: string, sampleText: string): RegexMatchResult[] {
    if (!pattern || !sampleText) {
        return [];
    }

    try {
        let regex: RegExp;

        try {
            regex = new RegExp(pattern, 'giu');
        } catch {
            regex = new RegExp(pattern, 'gi');
        }

        const results: RegexMatchResult[] = [];
        let match: RegExpExecArray | null;
        let iterations = 0;
        const maxMatches = 50;

        // Truncate sampleText if ridiculously large to protect the browser
        const textToTest = sampleText.slice(0, 10000);

        while ((match = regex.exec(textToTest)) !== null && iterations < maxMatches) {
            iterations++;
            results.push({
                index: match.index,
                length: match[0].length,
                text: match[0],
            });

            // Prevent infinite loop on 0-length matches
            if (match[0].length === 0) {
                regex.lastIndex++;
            }
        }

        return results;
    } catch {
        return [];
    }
}
