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
  var itemsToEvaluate = sortedItems || sortItemsByRiskWeight(items);
  var results = itemsToEvaluate.map(function (item) { return safeTestPattern(item.regex, text) > 0; });
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
    var compositeKey = regex + '|||' + label;
    var existing = scoredRegexes.get(compositeKey);
    if (existing) {
      existing.count += count;
      // Keep the higher score for duplicates
      if (score > existing.score) existing.score = score;
    } else {
      scoredRegexes.set(compositeKey, { count: count, score: score, label: label });
    }
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
        recordRegexMatch(pattern.regex, count, pattern.score, pattern.title);
        totalScore += (pattern.score || 0);
      }
      if (totalScore >= 100) break;
      continue;
    }

    if (pattern.type !== 'criteria') continue;

    var items = pattern.criteria_pattern_items || [];
    if (items.length === 0) continue;

    var matchCount = 0;
    var criteriaItemsScore = 0;

    function scoreSubItems(subItems, prefix) {
      for (var j = 0; j < subItems.length; j++) {
        var sub = subItems[j];
        var subCount = safeTestPattern(sub.regex, text);
        if (subCount > 0) {
          matchCount += subCount;
          criteriaItemsScore += (sub.score || 0);
          recordRegexMatch(sub.regex, subCount, sub.score, prefix + ' \u203A ' + sub.title);
        }
        if (sub.sub_items && sub.sub_items.length > 0) {
          scoreSubItems(sub.sub_items, prefix + ' \u203A ' + sub.title);
        }
      }
    }

    var sortedItems = sortItemsByRiskWeight(items);

    for (var j = 0; j < sortedItems.length; j++) {
      var item = sortedItems[j];
      var itemCount = safeTestPattern(item.regex, text);
      if (itemCount > 0) {
        matchCount += itemCount;
        criteriaItemsScore += (item.score || 0);
        recordRegexMatch(item.regex, itemCount, item.score, pattern.title + ' \u203A ' + item.title);
      }
      if (item.sub_items && item.sub_items.length > 0) {
        scoreSubItems(item.sub_items, pattern.title + ' \u203A ' + item.title);
      }
    }

    var criteriaMatched = evaluateCriteriaItems(items, text, sortedItems);

    if (criteriaMatched) {
      var patternScore = (pattern.score && pattern.score > 0) ? pattern.score : criteriaItemsScore;
      totalScore += patternScore;
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
