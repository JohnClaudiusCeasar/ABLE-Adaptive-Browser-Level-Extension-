/**
 * ABLE Extension - Risk Scoring
 *
 * Pattern matching and risk score calculation for content scanning.
 */

const RE_DANGEROUS_PATTERN = /(\(\s*[^)]*[+*][^)]*\)\s*[+*{])|(\[\s*[^]]*\]\s*[+*]\s*[+*])/;
const RE_RESOD = /(\(\s*[^)]*\)\s*\+\s*\+\s*\)|(\.\*\s*\+\s*)+\)|\(\[\^.*\]\s*\+\s*)+\)/;
const MAX_PATTERN_LENGTH = 500;
const MAX_TEXT_SLICE = 10000;

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

async function calculateRiskScore(text) {
  var totalScore = 0;
  var flaggedItems = [];

  var patterns = await getRiskPatterns();

  if (patterns.length === 0) {
    console.warn('ABLE: No risk patterns available for scoring.');
    return {
      score: 0,
      flaggedItems: [],
    };
  }

  var PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  var orderedPatterns = patterns
    .map(function (pattern, index) { return { pattern: pattern, index: index }; })
    .sort(function (a, b) {
      return (PRIORITY_ORDER[a.pattern.priority] ?? 3) -
        (PRIORITY_ORDER[b.pattern.priority] ?? 3) ||
        a.index - b.index;
    })
    .map(function (entry) { return entry.pattern; });

  var scoredRegexes = new Map(); // regex+label -> { count, score, label }

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

  for (var i = 0; i < orderedPatterns.length; i++) {
    var pattern = orderedPatterns[i];

    // Skip auto-created single copies if their parent criteria is evaluated
    if (pattern.type === 'single' && pattern.parent_criteria_id) {
      continue;
    }

    if (pattern.type === 'single') {
      var count = safeTestPattern(pattern.regex, text);
      if (count > 0) {
        var added = recordRegexMatch(pattern.regex, count, pattern.score, pattern.title);
        totalScore += added;
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
      // 1. For Criteria Patterns, if all single patterns check out by criteria,
      // display the criteria pattern ONLY as a single entity with its own overall score.
      var patternScore = (typeof pattern.score === 'number' && pattern.score > 0)
        ? pattern.score
        : criteriaItemsScore;
      var added = recordRegexMatch(
        pattern.regex || ('criteria_' + (pattern.id || pattern.title)),
        Math.max(1, totalCriteriaMatches),
        patternScore,
        pattern.title
      );
      totalScore += added;
    } else if (matchedCriteriaItems.length > 0) {
      // 2. If the criteria as a whole is not satisfied, but individual single pattern(s)
      // from the criteria were flagged, display only their single pattern equivalent(s).
      for (var k = 0; k < matchedCriteriaItems.length; k++) {
        var matched = matchedCriteriaItems[k];
        var added = recordRegexMatch(
          matched.regex || ('criteria_item_' + matched.title),
          matched.count,
          matched.score,
          matched.title
        );
        totalScore += added;
        if (totalScore >= 100) break;
      }
    }

    // Short-circuit: stop scanning if max score reached
    if (totalScore >= 100) break;
  }

  // Convert scoredRegexes Map to flaggedItems array for duplicate-free reporting
  var dedupedFlagged = [];
  scoredRegexes.forEach(function (entry, key) {
    dedupedFlagged.push({
      label: entry.label,
      count: entry.count,
      weight: entry.score,
    });
  });

  return {
    score: Math.min(100, totalScore),
    flaggedItems: dedupedFlagged,
  };
}

// New public API
async function analyzeText(text, options) {
  options = options || {};
  var threshold = options.threshold || 100;
  var result = await calculateRiskScore(text);
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
  };
}
