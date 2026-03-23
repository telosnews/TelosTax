/**
 * OCR Text Matching — fuzzy matching utilities for OCR-extracted text.
 *
 * Used only when `ocrMode: true` is passed to extraction functions.
 * When ocrMode is false/undefined, the digital PDF exact-match path is used instead.
 *
 * Pure functions, zero dependencies, fully testable.
 */

/**
 * Levenshtein distance between two strings.
 * Standard dynamic-programming implementation — O(n*m) time/space.
 */
export function levenshteinDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;

  if (n === 0) return m;
  if (m === 0) return n;

  // Use single-row DP for memory efficiency
  let prev = Array.from({ length: m + 1 }, (_, i) => i);
  let curr = new Array(m + 1);

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[m];
}

/**
 * Fuzzy substring inclusion check.
 * Slides a window of `needle.length` across `haystack`, checking if
 * any window has Levenshtein distance ≤ `maxDistance` from the needle.
 *
 * Used in place of `haystack.includes(needle)` when ocrMode is true.
 */
export function fuzzyIncludes(
  haystack: string,
  needle: string,
  maxDistance = 2,
): boolean {
  if (!haystack || !needle) return false;

  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();

  // Fast path: exact match
  if (h.includes(n)) return true;

  // For very short needles (≤3 chars), require exact match to avoid false positives
  if (n.length <= 3) return false;

  // Slide a window across haystack
  const windowSize = n.length;
  for (let i = 0; i <= h.length - windowSize; i++) {
    const window = h.substring(i, i + windowSize);
    if (levenshteinDistance(window, n) <= maxDistance) {
      return true;
    }
  }

  // Also check windows slightly larger/smaller (for insertion/deletion errors)
  // Expand to ±maxDistance to handle multi-char insertions/deletions
  for (let delta = -maxDistance; delta <= maxDistance; delta++) {
    if (delta === 0) continue; // Already checked exact window size above
    const ws = windowSize + delta;
    if (ws < 3) continue;
    // Tighten tolerance: larger window deltas get less distance budget
    const adjustedMax = maxDistance - Math.abs(delta);
    if (adjustedMax < 0) continue;
    for (let i = 0; i <= h.length - ws; i++) {
      const window = h.substring(i, i + ws);
      if (levenshteinDistance(window, n) <= adjustedMax) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Normalize OCR text to fix common recognition artifacts.
 * Applied to concatenated text before keyword matching.
 */
export function normalizeOCRText(text: string): string {
  let result = text;

  // Normalize Unicode dashes to ASCII hyphen
  result = result.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');

  // Normalize Unicode quotes to ASCII
  result = result.replace(/[\u2018\u2019\u201A]/g, "'");
  result = result.replace(/[\u201C\u201D\u201E]/g, '"');

  // Collapse multiple spaces/tabs to single space
  result = result.replace(/[ \t]+/g, ' ');

  // Common OCR character substitutions in tax form context:
  // Don't do global replacements — only fix in specific patterns

  // "1099-" followed by a single wrong character: e.g., "1099-NFC" → "1099-NEC"
  // This is handled by fuzzyIncludes with distance tolerance, not here.

  // Fix common "Form W-" misreads: "Forrn" → "Form", "Fonn" → "Form", "Forrm" → "Form"
  result = result.replace(/\bFo[rn]{2,3}\b/gi, 'Form');

  // Fix "lnterest" → "Interest" (common l/I confusion)
  result = result.replace(/\blnterest\b/g, 'Interest');

  // Fix "Dlvidends" or "Dividends" misreads with leading D/O confusion
  result = result.replace(/\bDlvidends\b/g, 'Dividends');

  return result;
}
