// Ported from noxone/regex-generator (MIT) — utils/HasRange.kt, recognizer/RecognizerMatch.kt

export interface CharRange {
    first: number;
    last: number;
}

export const EMPTY_RANGE: CharRange = { first: 1, last: 0 };

export const rangeIsEmpty = (range: CharRange): boolean => range.first > range.last;

export const rangesOverlap = (a: CharRange, b: CharRange): boolean =>
    a.first <= b.last && b.first <= a.last;

export interface RecognizerMatch {
    patterns: string[];
    ranges: CharRange[];
    recognizerName: string;
    title: string;
    priority: number;
}

export const matchFirst = (match: RecognizerMatch): number => match.ranges[0].first;

export const matchLast = (match: RecognizerMatch): number =>
    match.ranges[match.ranges.length - 1].last;

export const matchLength = (match: RecognizerMatch): number =>
    matchLast(match) - matchFirst(match) + 1;

export const matchesOverlap = (a: RecognizerMatch, b: RecognizerMatch): boolean =>
    a.ranges.some((r1) => b.ranges.some((r2) => rangesOverlap(r1, r2)));

export interface Recognizer {
    readonly name: string;
    findMatches(input: string): RecognizerMatch[];
}
