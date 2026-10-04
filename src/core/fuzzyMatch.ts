/**
 * Normalizes a string by:
 * - Converting to lowercase
 * - Stripping accents / diacritics (e.g. é -> e, ã -> a, í -> i, ü -> u)
 * - Removing punctuation (periods, commas, hyphens, apostrophes)
 * - Trimming extra spaces
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritic accents
    .replace(/[.,\/'#!$%\^&\*;:{}=\-_`~()]/g, ' ') // replace punctuation with spaces
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * Calculates Levenshtein Distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Fuzzy compares a user input string against one or more acceptable answers.
 * Returns { isMatch: boolean; distance: number; bestMatch: string }
 */
export function fuzzyMatch(
  userInput: string,
  acceptableAnswers: string | string[],
  maxAllowedDistance: number = 1
): { isMatch: boolean; distance: number; bestMatch: string } {
  const inputNorm = normalizeString(userInput);
  const rawList = Array.isArray(acceptableAnswers) ? acceptableAnswers : [acceptableAnswers];

  // Expand candidates: e.g. "Washington, D.C." -> ["Washington, D.C.", "Washington", "Washington DC"]
  const candidatesSet = new Set<string>();
  for (const raw of rawList) {
    candidatesSet.add(raw);
    if (raw.includes(',')) {
      candidatesSet.add(raw.split(',')[0].trim());
    }
    if (raw.includes('(')) {
      candidatesSet.add(raw.split('(')[0].trim());
    }
    if (raw.includes('/')) {
      for (const part of raw.split('/')) {
        candidatesSet.add(part.trim());
      }
    }
  }

  const answers = Array.from(candidatesSet);

  if (!inputNorm) {
    return { isMatch: false, distance: 999, bestMatch: answers[0] || '' };
  }

  let minDistance = 999;
  let bestMatch = answers[0] || '';

  for (const rawAnswer of answers) {
    const answerNorm = normalizeString(rawAnswer);
    if (!answerNorm) continue;

    // Exact normalized match
    if (inputNorm === answerNorm) {
      return { isMatch: true, distance: 0, bestMatch: rawAnswer };
    }

    // Handle common prefixes/suffixes or parenthesis (e.g. "Washington, D.C." vs "Washington")
    const simplifiedAnswer = answerNorm.replace(/\b(city|de|the|st|saint)\b/g, '').trim();
    const simplifiedInput = inputNorm.replace(/\b(city|de|the|st|saint)\b/g, '').trim();
    if (simplifiedInput.length > 2 && simplifiedAnswer === simplifiedInput) {
      return { isMatch: true, distance: 0, bestMatch: rawAnswer };
    }

    // Calculate edit distance
    const dist = levenshteinDistance(inputNorm, answerNorm);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = rawAnswer;
    }

    // Dynamic tolerance based on word length:
    // <= 4 chars: strict (0-1 edit)
    // > 4 chars: 1 edit
    // > 8 chars: 2 edits allowed
    let dynamicTolerance = maxAllowedDistance;
    if (answerNorm.length <= 4) {
      dynamicTolerance = Math.min(1, maxAllowedDistance);
    } else if (answerNorm.length >= 8) {
      dynamicTolerance = Math.max(maxAllowedDistance, 2);
    }

    if (dist <= dynamicTolerance) {
      return { isMatch: true, distance: dist, bestMatch: rawAnswer };
    }
  }

  return { isMatch: false, distance: minDistance, bestMatch };
}
