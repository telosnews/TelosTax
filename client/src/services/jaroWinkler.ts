/**
 * Jaro-Winkler String Similarity
 *
 * Pure utility for fuzzy merchant name matching in the Deduction Finder.
 * Returns a similarity score between 0 (no match) and 1 (identical).
 *
 * Standard Jaro-Winkler algorithm with:
 *   - Prefix scale factor p = 0.1
 *   - Max common prefix length = 4
 *
 * Zero external dependencies.
 */

/**
 * Compute Jaro similarity between two strings.
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matching characters
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  );
}

/**
 * Compute Jaro-Winkler similarity between two strings.
 * Boosts the Jaro score for strings that share a common prefix (up to 4 chars).
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  const jaro = jaroSimilarity(s1, s2);

  // Common prefix length (max 4)
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  let prefixLen = 0;
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefixLen++;
    else break;
  }

  const p = 0.1; // Standard Winkler scaling factor
  return jaro + prefixLen * p * (1 - jaro);
}
