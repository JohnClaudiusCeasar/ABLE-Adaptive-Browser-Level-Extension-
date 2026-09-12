/**
 * ABLE Extension - Risk Scoring
 *
 * Pattern matching and risk score calculation for content scanning.
 */

const RE_DANGEROUS_PATTERN = /(\(\s*[^)]*[+*][^)]*\)\s*[+*{])|(\[\s*[^]]*\]\s*[+*]\s*[+*])/;

function safeTestPattern(pattern, text) {
  if (typeof pattern !== 'string' || pattern.length === 0) return 0;
  if (RE_DANGEROUS_PATTERN.test(pattern)) {
    console.warn('ABLE: Potentially unsafe regex skipped:', pattern);
    return 0;
  }
  try {
    const re = new RegExp(pattern, 'g');
    const matches = text.match(re);
    return matches ? matches.length : 0;
  } catch (error) {
    console.warn('ABLE: Invalid regex pattern:', pattern, error);
    return 0;
  }
}

function sortItemsByRiskWeight(items) {
  const weightOrder = { high: 0, medium: 1, low: 2 };
  return [...items].sort((a, b) => {
    const weightA = weightOrder[a.risk_weight || 'medium'] ?? 3;
    const weightB = weightOrder[b.risk_weight || 'medium'] ?? 3;
    if (weightA !== weightB) return weightA - weightB;
    return (b.score || 0) - (a.score || 0);
  });
}

function evaluateCriteriaItems(items, text, sortedItems = null) {
  const itemsToEvaluate = sortedItems || sortItemsByRiskWeight(items);
  const results = itemsToEvaluate.map((item) => safeTestPattern(item.regex, text) > 0);
  const hasOr = itemsToEvaluate.some((item) => item.operator === 'or');
  return hasOr ? results.some(Boolean) : results.every(Boolean);
}

async function calculateRiskScore(text) {
  let totalScore = 0;
  const flaggedItems = [];

  const patterns = await getRiskPatterns();

  if (patterns.length === 0) {
    console.warn('ABLE: No risk patterns available for scoring.');
    return {
      score: 0,
      flaggedItems: [],
    };
  }

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  const orderedPatterns = patterns
    .map((pattern, index) => ({ pattern, index }))
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.pattern.priority] ?? 3) -
          (PRIORITY_ORDER[b.pattern.priority] ?? 3) ||
        a.index - b.index,
    )
    .map((entry) => entry.pattern);

  const scoredRegexes = new Set();

  function recordRegexMatch(regex, count, score, label) {
    const isDuplicate = scoredRegexes.has(regex);
    if (!isDuplicate) {
      scoredRegexes.add(regex);
    }
    const weight = isDuplicate ? 0 : score;
    totalScore += weight;
    flaggedItems.push({
      label: label,
      count: count,
      weight: weight,
    });
  }

  for (const pattern of orderedPatterns) {
    if (pattern.type === 'single') {
      const count = safeTestPattern(pattern.regex, text);
      if (count > 0) {
        recordRegexMatch(pattern.regex, count, pattern.score, pattern.title);
      }
      continue;
    }

    if (pattern.type !== 'criteria') continue;

    const items = pattern.criteria_pattern_items || [];
    if (items.length === 0) continue;

    let matchCount = 0;

    function scoreSubItems(subItems, prefix) {
      for (const sub of subItems) {
        const count = safeTestPattern(sub.regex, text);
        if (count > 0) {
          matchCount += count;
          recordRegexMatch(
            sub.regex,
            count,
            sub.score,
            `${prefix} › ${sub.title}`,
          );
        }
        if (sub.sub_items && sub.sub_items.length > 0) {
          scoreSubItems(sub.sub_items, `${prefix} › ${sub.title}`);
        }
      }
    }

    const sortedItems = sortItemsByRiskWeight(items);

    for (const item of sortedItems) {
      const count = safeTestPattern(item.regex, text);
      if (count > 0) matchCount += count;
      if (item.sub_items && item.sub_items.length > 0) {
        scoreSubItems(item.sub_items, pattern.title);
      }
    }

    const criteriaMatched = evaluateCriteriaItems(items, text, sortedItems);

    if (criteriaMatched) {
      totalScore += pattern.score;
      flaggedItems.push({
        label: pattern.title,
        count: matchCount,
        weight: pattern.score,
      });
    }
  }

  return {
    score: Math.min(100, totalScore),
    flaggedItems,
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.ABLERiskScoring = {
    calculateRiskScore,
    safeTestPattern,
    evaluateCriteriaItems,
  };
}
