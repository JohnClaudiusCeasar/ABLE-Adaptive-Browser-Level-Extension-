/**
 * ABLE Extension - Risk Scoring
 *
 * Pattern matching and risk score calculation for content scanning.
 * Includes contextual intelligence layers:
 *   ① Contextual window analysis  — dampens/amplifies based on surrounding text intent
 *   ② Document section segmentation — weights matches by their section's sensitivity
 *   ③ Density + co-occurrence scoring — rewards clustered and combined PII signals
 *   ④ Page context injection — uses destination page signals as a risk multiplier
 *   ⑤ Schema-level negation — supports per-pattern negation/amplifier context fields
 */

const RE_DANGEROUS_PATTERN = /(\(\s*[^)]*[+*][^)]*\)\s*[+*{])|(\[\s*[^]]*\]\s*[+*]\s*[+*])/;
const RE_RESOD = /(\(\s*[^)]*\)\s*\+\s*\+\s*\)|(\.{*}\s*\+\s*)+\)|(\[\^.*\]\s*\+\s*)+\))/;
const MAX_PATTERN_LENGTH = 500;
const MAX_TEXT_SLICE = 10000;

// ─── ① Contextual Window Constants ──────────────────────────────────────────

const CONTEXT_WINDOW_SIZE = 120; // chars to inspect before and after a match

/**
 * Signals that suggest a match is being *described* rather than *presented*.
 * Presence near a match dampens the risk score contribution.
 */
const NEGATION_SIGNALS = [
  /\b(example[s]?|sample[s]?|dummy|redacted|placeholder|fictitious|hypothetical|sanitized|template[s]?|lorem|fake)\b/i,
  /\b(do\s+not|don'?t|never|avoid|prohibited|restricted|not\s+allowed|must\s+not|should\s+not)\b/i,
  /\b(format|pattern|like|such\s+as|e\.?g\.?|for\s+instance|i\.?e\.?|illustration|demonstration)\b/i,
  /[*#xX]{3,}/,                   // masking characters: ***, ###, xxx, XXX
  /0{3,}[-\s]0{2,}[-\s]0{4}/,    // 000-00-0000 placeholder SSN
];

/**
 * Signals that suggest a match is real data being actively presented.
 * Presence near a match amplifies the risk score contribution.
 */
const AMPLIFIER_SIGNALS = [
  /\b(my|our|his|her|their|employee|patient|customer|client|user|staff|member|applicant)\b/i,
  /\b(ssn|social\s+security|account\s+no\.?|account\s+number|id\s+no\.?|passport|dob|date\s+of\s+birth|tin|ein)\b/i,
  /\b(attached|enclosed|see\s+below|as\s+follows|listed\s+(here|below|above)|herewith|submitted|included)\b/i,
  /\b(record|entry|row|field|column|cell|data\s+export|export)\b/i,
];

// ─── ② Section Segmentation Constants ───────────────────────────────────────

/**
 * Maps section heading patterns to score multipliers.
 * A lower multiplier means matches in that section are less likely to be real data.
 * A higher multiplier means matches there carry heightened risk.
 */
const SECTION_WEIGHT_MAP = [
  [/\b(disclaimer[s]?|legal\s+notice|warning|about|faq|help|example[s]?|sample[s]?|template[s]?|how[-\s]to)\b/i, 0.15],
  [/\b(reference[s]?|bibliography|appendix|appendices|footnote[s]?|exhibit[s]?|note[s]?)\b/i, 0.20],
  [/\b(introduction|overview|executive\s+summary|background|purpose|scope|abstract)\b/i, 0.70],
  [/\b(payroll|salary|compensation|benefit[s]?|medical|diagnosis|treatment|financial|banking|insurance)\b/i, 1.60],
  [/\b(export|submit|upload|send|transmit|transfer|dispatch)\b/i, 1.40],
  [/\b(patient|employee|staff|personnel|customer|client)\s+(data|record[s]?|info(rmation)?|list|detail[s]?|roster|profile[s]?)\b/i, 1.80],
  [/\b(confidential|internal\s+use\s+only|restricted|classified|sensitive|proprietary|top\s+secret)\b/i, 2.00],
];

// ─── ③ Co-occurrence Groups ───────────────────────────────────────────────────

/**
 * If flagged items from the same group reach the minimum category count,
 * a bonus score is added. Real-world PII records cluster these together;
 * training documents and templates almost never do.
 */
const CO_OCCURRENCE_GROUPS = [
  {
    name: 'PII Trifecta',
    keywords: ['ssn', 'social security', 'full name', 'name', 'date of birth', 'dob', 'birth date'],
    minMatches: 3,
    bonus: 20,
  },
  {
    name: 'Financial Trifecta',
    keywords: ['account number', 'routing', 'cvv', 'credit card', 'card number', 'bank'],
    minMatches: 2,
    bonus: 25,
  },
  {
    name: 'Medical Pair',
    keywords: ['patient', 'diagnosis', 'medical record', 'prescription', 'health'],
    minMatches: 2,
    bonus: 15,
  },
  {
    name: 'Identity Combo',
    keywords: ['passport', 'driver', 'license', 'id number', 'national id', 'address', 'phone'],
    minMatches: 2,
    bonus: 10,
  },
];

// ─── ReDoS Safety ────────────────────────────────────────────────────────────

function isPatternSafe(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0) return true;
  if (pattern.length > MAX_PATTERN_LENGTH) return false;
  if (RE_DANGEROUS_PATTERN.test(pattern)) return false;
  return true;
}

function safeTestPattern(pattern, text) {
  if (typeof pattern !== 'string' || pattern.length === 0) return 0;
  if (!isPatternSafe(pattern)) {
    console.warn('ABLE: Potentially unsafe regex skipped:', pattern);
    return 0;
  }
  try {
    var re = new RegExp(pattern, 'g');
    // Chunked matching to avoid ReDoS on large texts
    if (text.length > MAX_TEXT_SLICE) {
      var count = 0;
      for (var i = 0; i < text.length; i += MAX_TEXT_SLICE) {
        var slice = text.slice(i, i + MAX_TEXT_SLICE);
        var matches = slice.match(re);
        if (matches) count += matches.length;
      }
      return count;
    }
    var matches = text.match(re);
    return matches ? matches.length : 0;
  } catch (error) {
    console.warn('ABLE: Invalid regex pattern:', pattern, error);
    return 0;
  }
}

// ─── ① Contextual Window Analysis ────────────────────────────────────────────

/**
 * Extracts a fixed-width window of text centered around a match position.
 */
function extractMatchContext(text, matchIndex, matchLength) {
  var start = Math.max(0, matchIndex - CONTEXT_WINDOW_SIZE);
  var end = Math.min(text.length, matchIndex + matchLength + CONTEXT_WINDOW_SIZE);
  return text.slice(start, end);
}

/**
 * Evaluates the contextual intent of a match's surrounding text.
 * Returns a floating-point multiplier:
 *   < 1.0  → context suggests this is descriptive/example content (dampen)
 *   = 1.0  → neutral context
 *   > 1.0  → context suggests this is real data being presented (amplify)
 */
function scoreContextualIntent(matchContext) {
  var modifier = 1.0;
  var ctx = matchContext.toLowerCase();

  for (var i = 0; i < NEGATION_SIGNALS.length; i++) {
    if (NEGATION_SIGNALS[i].test(ctx)) {
      modifier *= 0.25; // strong dampening — one negation signal is conclusive
      break;
    }
  }

  // Only apply amplification if not already negated
  if (modifier >= 1.0) {
    for (var j = 0; j < AMPLIFIER_SIGNALS.length; j++) {
      if (AMPLIFIER_SIGNALS[j].test(ctx)) {
        modifier = Math.min(modifier * 1.5, 3.0); // cap amplification at 3×
        break;
      }
    }
  }

  return modifier;
}

/**
 * Finds the first occurrence of `pattern` in `text` and returns a context
 * modifier for it. Returns 1.0 (neutral) if no match is found.
 */
function getFirstMatchContextModifier(pattern, text) {
  if (!pattern || !isPatternSafe(pattern)) return 1.0;
  try {
    var re = new RegExp(pattern);
    var m = re.exec(text);
    if (!m) return 1.0;
    var ctx = extractMatchContext(text, m.index, m[0].length);
    return scoreContextualIntent(ctx);
  } catch (e) {
    return 1.0;
  }
}

// ─── ② Document Section Segmentation ─────────────────────────────────────────

/**
 * Returns the score multiplier for a given section heading label.
 * Falls back to 1.0 (neutral) if no SECTION_WEIGHT_MAP entry matches.
 */
function getSectionMultiplier(sectionLabel) {
  if (!sectionLabel) return 1.0;
  for (var i = 0; i < SECTION_WEIGHT_MAP.length; i++) {
    if (SECTION_WEIGHT_MAP[i][0].test(sectionLabel)) {
      return SECTION_WEIGHT_MAP[i][1];
    }
  }
  return 1.0;
}

/**
 * Segments plain text into labeled sections based on heading detection.
 * Detects:
 *   - Markdown headings:    # Title, ## Sub-section
 *   - ALL-CAPS headings:    EMPLOYEE RECORDS, DISCLAIMER
 * Returns an array of { label: string, text: string } objects.
 * If no headings are found, returns the entire text as a single unlabeled segment.
 */
function segmentTextBySections(text) {
  var lines = text.split('\n');
  var segments = [];
  var currentLabel = '';
  var buffer = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    // Markdown heading: # ... through #### ...
    var mdMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    // ALL-CAPS heading: at least 4 uppercase letters, no lowercase, reasonable length
    var capsMatch = !mdMatch && trimmed.length >= 4 && trimmed.length <= 80
      && /^[A-Z][A-Z\s\-\/\(\)]{3,}$/.test(trimmed)
      && !/\d{4,}/.test(trimmed); // not a year-heavy line

    if ((mdMatch || capsMatch) && trimmed.length < 100) {
      // Save previous segment before starting a new one
      if (buffer.length > 0) {
        segments.push({ label: currentLabel, text: buffer.join('\n') });
        buffer = [];
      }
      currentLabel = mdMatch
        ? mdMatch[2].toLowerCase().trim()
        : trimmed.toLowerCase().trim();
    } else {
      buffer.push(line);
    }
  }

  // Flush the final buffer
  if (buffer.length > 0) {
    segments.push({ label: currentLabel, text: buffer.join('\n') });
  }

  // No headings found — treat the whole document as one unlabeled segment
  if (segments.length === 0) {
    segments.push({ label: '', text: text });
  }

  return segments;
}

/**
 * Given a pattern regex and the document's section segments, returns the
 * highest section multiplier among sections where the pattern matches.
 * Returns 1.0 if no section match is found or the document is unsegmented.
 */
function getDominantSectionMultiplier(patternRegex, segments) {
  if (!patternRegex || segments.length <= 1) return 1.0;
  var best = 1.0;
  for (var s = 0; s < segments.length; s++) {
    if (safeTestPattern(patternRegex, segments[s].text) > 0) {
      var sm = getSectionMultiplier(segments[s].label);
      if (sm > best) best = sm;
    }
  }
  return best;
}

// ─── ③ Density & Co-occurrence Scoring ───────────────────────────────────────

/**
 * Computes a density multiplier based on how frequently matches appear
 * relative to the total document length.
 *   High density → likely a data table or export (amplify)
 *   Low density  → likely a passing mention in prose (dampen)
 */
function computeDensityMultiplier(matchCount, textLength) {
  if (matchCount === 0 || textLength === 0) return 1.0;
  var density = (matchCount / textLength) * 1000; // matches per 1,000 chars
  if (density > 5)   return 2.0;  // very dense — almost certainly a data table/export
  if (density > 1)   return 1.4;  // moderately dense — likely structured data
  if (density > 0.1) return 1.0;  // normal prose mention — neutral
  return 0.8;                     // very sparse — isolated mention in a long document
}

/**
 * Checks whether multiple flagged categories belong to the same risk group
 * (e.g. SSN + name + DOB). When they co-occur, the combined risk is greater
 * than the sum of parts. Returns a total bonus to add to the final score.
 */
function computeCoOccurrenceBonus(flaggedLabels) {
  if (!flaggedLabels || flaggedLabels.length < 2) return 0;
  var labelsLower = flaggedLabels.map(function (l) { return (l || '').toLowerCase(); });
  var totalBonus = 0;

  for (var g = 0; g < CO_OCCURRENCE_GROUPS.length; g++) {
    var group = CO_OCCURRENCE_GROUPS[g];
    var matchedKeywords = 0;

    for (var k = 0; k < group.keywords.length; k++) {
      var kw = group.keywords[k];
      for (var l = 0; l < labelsLower.length; l++) {
        if (labelsLower[l].indexOf(kw) !== -1) {
          matchedKeywords++;
          break; // count each flagged label only once per keyword
        }
      }
      if (matchedKeywords >= group.minMatches) break; // early exit
    }

    if (matchedKeywords >= group.minMatches) {
      totalBonus += group.bonus;
      console.debug('ABLE: Co-occurrence bonus —', group.name, '+' + group.bonus);
    }
  }

  return totalBonus;
}

// ─── ④ Page Context Multiplier ────────────────────────────────────────────────

/**
 * Derives a score multiplier from page context signals collected by page-signals.js.
 * The destination page's own intent is a strong signal for whether an upload
 * is part of a normal workflow or a potentially risky data exfiltration path.
 *
 * @param {object|null} pageContext - Output of ABLEPageSignals.collectPageSignals()
 * @returns {number} Multiplier between 1.0 and 4.0
 */
function derivePageContextMultiplier(pageContext) {
  if (!pageContext) return 1.0;
  var mult = 1.0;

  try {
    // URL path signals: /upload, /export, /submit etc. — active outbound data flow
    var pathSegs = (pageContext.urlTokens && pageContext.urlTokens.pathSegs)
      ? pageContext.urlTokens.pathSegs.join('/').toLowerCase()
      : '';
    if (/\b(upload|submit|export|send|transfer|share|dispatch|sync)\b/.test(pathSegs)) {
      mult *= 1.3;
    }

    // Page has a file input — user is explicitly selecting a file to transmit
    if (pageContext.forms && pageContext.forms.hasFileInput) {
      mult *= 1.2;
    }

    // Form action submits to a different domain (cross-domain data submission)
    if (pageContext.forms && pageContext.forms.actionMismatch) {
      mult *= 1.3;
    }

    // Page headings mention known sensitive data domains
    var headingText = (pageContext.headings || []).join(' ').toLowerCase();
    if (/\b(patient|employee|payroll|financial|confidential|restricted|personnel|medical)\b/.test(headingText)) {
      mult *= 1.4;
    }

    // Page title explicitly signals upload or transfer intent
    var title = (pageContext.title || '').toLowerCase();
    if (/\b(upload|export|transfer|submit|send|share)\b/.test(title)) {
      mult *= 1.2;
    }

    // Meta description mentions data transfer or secure upload services
    var metaDesc = ((pageContext.meta && pageContext.meta.description) || '').toLowerCase();
    if (/\b(secure\s+upload|data\s+transfer|file\s+shar(e|ing)|submit\s+data)\b/.test(metaDesc)) {
      mult *= 1.2;
    }
  } catch (e) {
    // Non-fatal — return what we have accumulated so far
  }

  return Math.min(mult, 4.0); // cap total page context amplification at 4×
}

// ─── ⑤ Schema-level Negation/Amplification ────────────────────────────────────

/**
 * If a pattern defines negation_context_regex or amplifier_context_regex fields,
 * this inspects each match's surrounding window and adjusts the effective hit count.
 * Negated hits are excluded entirely; amplified hits count double.
 *
 * @returns {number} A multiplier (ratio of effective hits to raw hits). 0 means all negated.
 */
function applySchemaContextModifier(pattern, text) {
  if (!pattern.negation_context_regex && !pattern.amplifier_context_regex) {
    return 1.0; // no schema context defined — pass through unchanged
  }
  if (!isPatternSafe(pattern.regex)) return 1.0;

  var window = typeof pattern.negation_window === 'number' ? pattern.negation_window : 150;

  try {
    var re = new RegExp(pattern.regex, 'g');
    var m;
    var effectiveHits = 0;
    var totalHits = 0;

    while ((m = re.exec(text)) !== null) {
      totalHits++;
      var ctx = text.slice(
        Math.max(0, m.index - window),
        Math.min(text.length, m.index + m[0].length + window)
      );

      var isNegated = pattern.negation_context_regex
        && safeTestPattern(pattern.negation_context_regex, ctx) > 0;
      var isAmplified = !isNegated && pattern.amplifier_context_regex
        && safeTestPattern(pattern.amplifier_context_regex, ctx) > 0;

      if (!isNegated) {
        effectiveHits += isAmplified ? 2 : 1;
      }
    }

    if (totalHits === 0) return 1.0;
    return effectiveHits / totalHits; // 0.0 = fully negated, >1.0 = amplified
  } catch (e) {
    return 1.0;
  }
}

// ─── Criteria helpers ─────────────────────────────────────────────────────────

function sortItemsByRiskWeight(items) {
  var weightOrder = { high: 0, medium: 1, low: 2 };
  return [...items].sort(function (a, b) {
    var weightA = weightOrder[a.risk_weight || 'medium'] ?? 3;
    var weightB = weightOrder[b.risk_weight || 'medium'] ?? 3;
    if (weightA !== weightB) return weightA - weightB;
    return (b.score || 0) - (a.score || 0);
  });
}

function evaluateCriteriaItems(items, text, sortedItems) {
  var itemsToEvaluate = sortedItems || (items ? sortItemsByRiskWeight(items) : []);
  if (!itemsToEvaluate || itemsToEvaluate.length === 0) return false;

  var results = itemsToEvaluate.map(function (item) {
    if (item.sub_items && item.sub_items.length > 0) {
      var subMatched = evaluateCriteriaItems(item.sub_items, text);
      if (item.regex) {
        return safeTestPattern(item.regex, text) > 0 && subMatched;
      }
      return subMatched;
    }
    return item.regex ? safeTestPattern(item.regex, text) > 0 : false;
  });

  var hasOr = itemsToEvaluate.some(function (item) { return item.operator === 'or'; });
  return hasOr ? results.some(Boolean) : results.every(Boolean);
}

// ─── Main Scoring Function ────────────────────────────────────────────────────

/**
 * Calculates a context-aware risk score for the given text.
 *
 * @param {string} text - The content to scan.
 * @param {object} [opts]
 * @param {object|null} [opts.pageContext] - Page signals from ABLEPageSignals.collectPageSignals().
 * @returns {Promise<{ score: number, flaggedItems: Array }>}
 */
async function calculateRiskScore(text, opts) {
  opts = opts || {};
  var totalScore = 0;

  var patterns = await getRiskPatterns();

  if (patterns.length === 0) {
    console.warn('ABLE: No risk patterns available for scoring.');
    return { score: 0, flaggedItems: [] };
  }

  // ── ② Pre-segment the document by section headings ────────────────────────
  var segments = segmentTextBySections(text);
  var hasMultipleSections = segments.length > 1;
  if (hasMultipleSections) {
    console.debug('ABLE: Document segmented into', segments.length, 'sections.');
  }

  // ── ④ Compute page context multiplier once up front ───────────────────────
  var pageContextMult = derivePageContextMultiplier(opts.pageContext || null);
  if (pageContextMult !== 1.0) {
    console.debug('ABLE: Page context multiplier:', pageContextMult.toFixed(2));
  }

  // ── Priority-order the patterns ───────────────────────────────────────────
  var PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  var orderedPatterns = patterns
    .map(function (pattern, index) { return { pattern: pattern, index: index }; })
    .sort(function (a, b) {
      return (PRIORITY_ORDER[a.pattern.priority] ?? 3) -
        (PRIORITY_ORDER[b.pattern.priority] ?? 3) ||
        a.index - b.index;
    })
    .map(function (entry) { return entry.pattern; });

  var scoredRegexes = new Map(); // compositeKey → { count, score, label }

  function recordRegexMatch(regex, count, score, label) {
    var compositeKey = (regex || label) + '|||' + label;
    var existing = scoredRegexes.get(compositeKey);
    var addedScore = 0;
    if (existing) {
      existing.count += count;
      // Keep the higher score for duplicates
      if (score > existing.score) {
        addedScore = score - existing.score;
        existing.score = score;
      }
    } else {
      scoredRegexes.set(compositeKey, { count: count, score: score, label: label });
      addedScore = score || 0;
    }
    return addedScore;
  }

  // ── Pattern evaluation loop ───────────────────────────────────────────────
  for (var i = 0; i < orderedPatterns.length; i++) {
    var pattern = orderedPatterns[i];

    // Skip auto-created single copies if their parent criteria is evaluated
    if (pattern.type === 'single' && pattern.parent_criteria_id) continue;

    if (pattern.type === 'single') {
      var rawCount = safeTestPattern(pattern.regex, text);
      if (rawCount > 0) {
        // ① Contextual window: dampen/amplify based on text surrounding the first match
        var contextMod = getFirstMatchContextModifier(pattern.regex, text);

        // ⑤ Schema-level negation: if the pattern defines negation_context_regex
        var schemaMod = applySchemaContextModifier(pattern, text);

        // ② Section segmentation: find the highest-risk section where this pattern fires
        var sectionMult = hasMultipleSections
          ? getDominantSectionMultiplier(pattern.regex, segments)
          : 1.0;

        // ③ Density: adjust based on match frequency relative to document length
        var densityMult = computeDensityMultiplier(rawCount, text.length);

        // Combine all modifiers into a single adjusted score
        var combinedMult = contextMod * schemaMod * sectionMult * densityMult;
        var adjustedScore = Math.round((pattern.score || 0) * combinedMult);

        if (adjustedScore > 0) {
          var added = recordRegexMatch(pattern.regex, rawCount, adjustedScore, pattern.title);
          totalScore += added;
        } else {
          console.debug('ABLE: Pattern suppressed by context modifiers:', pattern.title, {
            rawCount,
            contextMod: contextMod.toFixed(2),
            schemaMod: schemaMod.toFixed(2),
            sectionMult: sectionMult.toFixed(2),
            densityMult: densityMult.toFixed(2),
          });
        }
      }
      if (totalScore >= 100) break;
      continue;
    }

    if (pattern.type !== 'criteria') continue;

    var items = pattern.criteria_pattern_items || [];
    if (items.length === 0) continue;

    var sortedItems = sortItemsByRiskWeight(items);
    var matchedCriteriaItems = [];
    var totalCriteriaMatches = 0;
    var criteriaItemsScore = 0;

    function collectItemMatches(itemList) {
      for (var j = 0; j < itemList.length; j++) {
        var it = itemList[j];
        var itCount = it.regex ? safeTestPattern(it.regex, text) : 0;
        if (itCount > 0) {
          totalCriteriaMatches += itCount;
          criteriaItemsScore += (it.score || 0);
          matchedCriteriaItems.push({
            title: it.title,
            regex: it.regex,
            score: it.score || 0,
            count: itCount,
          });
        }
        if (it.sub_items && it.sub_items.length > 0) {
          collectItemMatches(it.sub_items);
        }
      }
    }

    collectItemMatches(sortedItems);

    var criteriaMatched = evaluateCriteriaItems(items, text, sortedItems);

    if (criteriaMatched) {
      var patternScore = (typeof pattern.score === 'number' && pattern.score > 0)
        ? pattern.score
        : criteriaItemsScore;

      // Apply contextual modifiers to the criteria pattern as a whole
      var criteriaContextMod = pattern.regex
        ? getFirstMatchContextModifier(pattern.regex, text)
        : 1.0;
      var criteriaDensityMult = computeDensityMultiplier(totalCriteriaMatches, text.length);
      var criteriaSectionMult = 1.0;
      if (hasMultipleSections) {
        for (var cs = 0; cs < segments.length; cs++) {
          var segHasMatch = matchedCriteriaItems.some(function (mc) {
            return mc.regex && safeTestPattern(mc.regex, segments[cs].text) > 0;
          });
          if (segHasMatch) {
            var csm = getSectionMultiplier(segments[cs].label);
            if (csm > criteriaSectionMult) criteriaSectionMult = csm;
          }
        }
      }

      var criteriaAdjustedScore = Math.round(
        patternScore * criteriaContextMod * criteriaDensityMult * criteriaSectionMult
      );

      var added = recordRegexMatch(
        pattern.regex || ('criteria_' + (pattern.id || pattern.title)),
        Math.max(1, totalCriteriaMatches),
        criteriaAdjustedScore,
        pattern.title
      );
      totalScore += added;

    } else if (matchedCriteriaItems.length > 0) {
      // Criteria not fully satisfied — score matched sub-items individually
      for (var k = 0; k < matchedCriteriaItems.length; k++) {
        var matched = matchedCriteriaItems[k];

        var itemContextMod = matched.regex
          ? getFirstMatchContextModifier(matched.regex, text)
          : 1.0;
        var itemDensityMult = computeDensityMultiplier(matched.count, text.length);
        var itemSectionMult = hasMultipleSections
          ? getDominantSectionMultiplier(matched.regex, segments)
          : 1.0;
        var itemAdjustedScore = Math.round(
          matched.score * itemContextMod * itemDensityMult * itemSectionMult
        );

        if (itemAdjustedScore > 0) {
          var added = recordRegexMatch(
            matched.regex || ('criteria_item_' + matched.title),
            matched.count,
            itemAdjustedScore,
            matched.title
          );
          totalScore += added;
        }
        if (totalScore >= 100) break;
      }
    }

    if (totalScore >= 100) break;
  }

  // ── Build deduplicated flagged items ──────────────────────────────────────
  var dedupedFlagged = [];
  scoredRegexes.forEach(function (entry) {
    dedupedFlagged.push({
      label: entry.label,
      count: entry.count,
      weight: entry.score,
    });
  });

  // ── ③ Co-occurrence bonus ─────────────────────────────────────────────────
  var coBonus = computeCoOccurrenceBonus(dedupedFlagged.map(function (f) { return f.label; }));
  if (coBonus > 0) {
    totalScore += coBonus;
    console.debug('ABLE: Total co-occurrence bonus: +' + coBonus);
  }

  // ── ④ Apply page context multiplier to the pattern-derived subtotal ────────
  // Note: pageContextMult scales the content score only (not domain risk score,
  // which is added in file-scanner.js / handleTextCheck() after this returns).
  var finalScore = Math.min(100, Math.round(Math.min(100, totalScore) * pageContextMult));

  return {
    score: finalScore,
    flaggedItems: dedupedFlagged,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * High-level entry point for text analysis.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.threshold=100]
 * @param {object|null} [options.pageContext]
 */
async function analyzeText(text, options) {
  options = options || {};
  var threshold = options.threshold || 100;
  var result = await calculateRiskScore(text, { pageContext: options.pageContext || null });
  var exceeded = result.score >= threshold;
  return {
    score: result.score,
    flaggedItems: result.flaggedItems,
    thresholdReached: exceeded,
  };
}

function getPatternStats() {
  return new Promise(function (resolve) {
    getRiskPatterns().then(function (patterns) {
      var stats = {
        total: patterns.length,
        single: 0,
        criteria: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
      for (var i = 0; i < patterns.length; i++) {
        var p = patterns[i];
        if (p.type === 'single') stats.single++;
        if (p.type === 'criteria') stats.criteria++;
        if (p.priority === 'high') stats.high++;
        if (p.priority === 'medium') stats.medium++;
        if (p.priority === 'low') stats.low++;
      }
      resolve(stats);
    }).catch(function () {
      resolve({ total: 0, single: 0, criteria: 0, high: 0, medium: 0, low: 0 });
    });
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLERiskScoring = {
    calculateRiskScore,
    analyzeText,
    getPatternStats,
    safeTestPattern,
    evaluateCriteriaItems,
    // Context intelligence utilities (exposed for testing/diagnostics)
    scoreContextualIntent,
    extractMatchContext,
    segmentTextBySections,
    getSectionMultiplier,
    getDominantSectionMultiplier,
    computeDensityMultiplier,
    computeCoOccurrenceBonus,
    derivePageContextMultiplier,
    applySchemaContextModifier,
    getFirstMatchContextModifier,
  };
}
