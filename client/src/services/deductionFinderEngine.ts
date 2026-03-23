/**
 * Deduction Finder — Scanning Engine
 *
 * Pure function that scans normalized transactions against the pattern catalog
 * and produces ranked DeductionInsight results. Follows the assessAuditRisk()
 * accumulator pattern.
 *
 * Matching modes:
 *   - 'substring' (default): uses .includes() — works for long unambiguous strings.
 *   - 'word_boundary': uses regex with lookbehind/lookahead — for short/collision-prone tokens.
 *   - Evidence and negative tokens always use word-boundary matching.
 *
 * All processing runs client-side. Transaction data never leaves the browser.
 */

import type {
  NormalizedTransaction,
  ReturnContext,
  DeductionInsight,
  MerchantPattern,
  ConfidenceTier,
  MatchReason,
  PatternRequirements,
} from './deductionFinderTypes';
import { DEDUCTION_PATTERNS } from './deductionFinderPatterns';
import { computeRecurrence } from './deductionFinderRecurrence';
import { lookupMCC } from './mccTaxMap';
import { jaroWinklerSimilarity } from './jaroWinkler';

// ─── Scoring Weights ────────────────────────────────

export const SCORING_WEIGHTS = {
  confidence: 0.4,
  impact: 0.4,
  ease: 0.2,
} as const;

const CONFIDENCE_SCORES: Record<ConfidenceTier, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

const MAX_SAMPLE_DESCRIPTIONS = 100;
const RECURRENCE_BONUS = 0.05;
const SIGNAL_COUNT_BONUS = 0.05;
const MCC_BONUS = 0.05;
const SIGNAL_COUNT_THRESHOLD = 5;
const FUZZY_THRESHOLD = 0.88;

// ─── MCC Range Matching ─────────────────────────────

/** Check if an MCC code matches any code in a list, with range support
 *  for airlines (3000-3299) and hotels (3501-3999). */
function matchesMCCList(mccCodes: string[], code: string): boolean {
  if (mccCodes.includes(code)) return true;
  const numeric = parseInt(code, 10);
  if (isNaN(numeric)) return false;
  if (mccCodes.includes('3000') && numeric >= 3000 && numeric <= 3299) return true;
  if (mccCodes.includes('3501') && numeric >= 3501 && numeric <= 3999) return true;
  return false;
}

// ─── Regex Compilation (once at module load) ────────

/** Escape regex special characters in a token. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a word-boundary regex for a token.
 *  Uses negative lookbehind/lookahead so "TAX" matches "TAX PREP" but not "TAXI". */
export function buildWordBoundaryRegex(token: string): RegExp {
  const escaped = escapeRegex(token);
  return new RegExp(`(?<![A-Z0-9])${escaped}(?![A-Z0-9])`, 'i');
}

interface CompiledPattern {
  pattern: MerchantPattern;
  merchantMatchers: TokenMatcher[];
  evidenceMatchers: TokenMatcher[];
  negativeMatchers: TokenMatcher[];
}

interface TokenMatcher {
  token: string;
  test: (upper: string) => boolean;
}

function compileTokenMatcher(token: string, useWordBoundary: boolean): TokenMatcher {
  if (useWordBoundary) {
    const regex = buildWordBoundaryRegex(token);
    return { token, test: (upper) => regex.test(upper) };
  }
  return { token, test: (upper) => upper.includes(token) };
}

/** Pre-compile all patterns into efficient matchers. */
const COMPILED_PATTERNS: CompiledPattern[] = DEDUCTION_PATTERNS.map((pattern) => {
  const useWordBoundary = pattern.matchMode === 'word_boundary';
  return {
    pattern,
    merchantMatchers: pattern.merchants.map((m) => compileTokenMatcher(m, useWordBoundary)),
    // Evidence and negative tokens always use word-boundary matching
    evidenceMatchers: (pattern.evidenceTokens || []).map((t) => compileTokenMatcher(t, true)),
    negativeMatchers: (pattern.negativeTokens || []).map((t) => compileTokenMatcher(t, true)),
  };
});

// ─── Declarative Gate Evaluation ─────────────────────

/** Evaluate a flat PatternRequirements object against a ReturnContext.
 *  All conditions are AND-ed — returns false if any fails. */
export function evaluateRequirements(reqs: PatternRequirements, ctx: ReturnContext): boolean {
  if (reqs.requireTrue) {
    for (const key of reqs.requireTrue) {
      if (!ctx[key]) return false;
    }
  }
  if (reqs.requireFalse) {
    for (const key of reqs.requireFalse) {
      if (ctx[key]) return false;
    }
  }
  if (reqs.requirePositive) {
    for (const key of reqs.requirePositive) {
      if ((ctx[key] as number) <= 0) return false;
    }
  }
  if (reqs.requireItemizing && ctx.deductionMethod !== 'itemized') return false;
  if (reqs.minAGI !== undefined && ctx.agi < reqs.minAGI) return false;
  if (reqs.maxAGI !== undefined && ctx.agi > reqs.maxAGI) return false;
  return true;
}

/** Evaluate a gate — supports both declarative requirements and function escape hatch. */
function evaluateGate(
  gate: PatternRequirements | ((ctx: ReturnContext) => boolean),
  ctx: ReturnContext,
): boolean {
  return typeof gate === 'function' ? gate(ctx) : evaluateRequirements(gate, ctx);
}

// ─── Core Engine ────────────────────────────────────

export function scanForSignals(
  transactions: NormalizedTransaction[],
  context: ReturnContext,
  taxYear?: number,
): DeductionInsight[] {
  const insights: DeductionInsight[] = [];
  const upperDescriptions = transactions.map((t) => t.description.toUpperCase());
  const year = taxYear ?? new Date().getFullYear();

  for (const compiled of COMPILED_PATTERNS) {
    const { pattern } = compiled;

    // Check context gate — skip if irrelevant
    if (!evaluateGate(pattern.gate, context)) continue;

    // Check for existing data annotation (additive categories)
    let existingDataNote: string | undefined;
    if (typeof pattern.gate === 'object' && pattern.gate.existingDataKeys) {
      const hasExisting = pattern.gate.existingDataKeys.some((key) => context[key] as boolean);
      if (hasExisting) {
        existingDataNote = `You've already entered some ${pattern.title.toLowerCase().replace(/ deduction| credit/i, '')} data. ` +
          `These are additional items found in your statement.`;
      }
    }

    // Find matching transactions with reasons
    const { matched, reasons, hasMCCMatch } = findMatches(transactions, upperDescriptions, compiled);
    if (matched.length === 0) continue;

    // Compute base score (unchanged formula)
    const baseScore =
      SCORING_WEIGHTS.confidence * CONFIDENCE_SCORES[pattern.confidence] +
      SCORING_WEIGHTS.impact * pattern.impactScore +
      SCORING_WEIGHTS.ease * pattern.easeScore;

    // Compute recurrence score (only for patterns that opt in)
    let recurrenceScore = 0;
    if (pattern.recurrenceRelevant) {
      const recurrence = computeRecurrence(matched);
      recurrenceScore = recurrence?.score ?? 0;
    }

    // Additive bonuses (don't penalize one-off deductions)
    let bonus = 0;
    if (pattern.recurrenceRelevant && recurrenceScore > 0.3) {
      bonus += RECURRENCE_BONUS;
    }
    if (matched.length >= SIGNAL_COUNT_THRESHOLD) {
      bonus += SIGNAL_COUNT_BONUS;
    }
    if (hasMCCMatch) {
      bonus += MCC_BONUS;
    }

    const compositeScore = Math.min(1.0, baseScore + bonus);

    // Amount stats — sum raw amounts so refunds net against purchases
    const rawTotal = matched.reduce((sum, t) => sum + t.amount, 0);
    const totalAmount = Math.max(0, rawTotal);
    const averageAmount = matched.length > 0 ? rawTotal / matched.length : 0;

    // Sample descriptions sorted by amount descending (highest-value first)
    const sampleDescriptions = [...matched]
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, MAX_SAMPLE_DESCRIPTIONS)
      .map((t) => t.description);

    // Deduplicate match reasons
    const uniqueReasons = deduplicateReasons(reasons);

    const insight: DeductionInsight = {
      id: `${pattern.id}_${year}`,
      category: pattern.category,
      confidence: pattern.confidence,
      title: pattern.title,
      description: pattern.description,
      statutoryMax: pattern.statutoryMax,
      actionStepId: pattern.actionStepId,
      signalCount: matched.length,
      sampleDescriptions,
      compositeScore: Math.round(compositeScore * 1000) / 1000,
      totalAmount: Math.round(totalAmount * 100) / 100,
      averageAmount: Math.round(averageAmount * 100) / 100,
      recurrenceScore,
      matchReasons: uniqueReasons,
    };
    if (existingDataNote) insight.existingDataNote = existingDataNote;
    insights.push(insight);
  }

  // Sort by composite score descending
  insights.sort((a, b) => b.compositeScore - a.compositeScore);

  return insights;
}

// ─── Helpers ────────────────────────────────────────

interface FindMatchesResult {
  matched: NormalizedTransaction[];
  reasons: MatchReason[];
  hasMCCMatch: boolean;
}

function findMatches(
  transactions: NormalizedTransaction[],
  upperDescriptions: string[],
  compiled: CompiledPattern,
): FindMatchesResult {
  const matched: NormalizedTransaction[] = [];
  const reasons: MatchReason[] = [];
  let hasMCCMatch = false;
  const patternMCCs = compiled.pattern.mccCodes;

  for (let i = 0; i < transactions.length; i++) {
    const upper = upperDescriptions[i];

    // Check if any merchant token matches (exact or word-boundary)
    let merchantHit = compiled.merchantMatchers.find((m) => m.test(upper));
    let isFuzzy = false;

    // Fuzzy fallback: Jaro-Winkler similarity against description tokens
    if (!merchantHit) {
      const fuzzyResult = tryFuzzyMatch(upper, compiled.pattern.merchants);
      if (!fuzzyResult) continue;
      merchantHit = { token: fuzzyResult.merchant, test: () => true };
      isFuzzy = true;
    }

    // Check evidence tokens if required
    let evidenceHit: TokenMatcher | undefined;
    if (compiled.evidenceMatchers.length > 0) {
      evidenceHit = compiled.evidenceMatchers.find((t) => t.test(upper));
      if (!evidenceHit) continue;
    }

    // Check negative tokens — suppress if any match
    if (compiled.negativeMatchers.length > 0) {
      const hasNegative = compiled.negativeMatchers.some((t) => t.test(upper));
      if (hasNegative) continue;
    }

    matched.push(transactions[i]);
    if (isFuzzy) {
      reasons.push({ kind: 'fuzzy_match', value: merchantHit.token });
    } else {
      reasons.push({ kind: 'merchant_token', value: merchantHit.token });
    }
    if (evidenceHit) {
      reasons.push({ kind: 'evidence_token', value: evidenceHit.token });
    }

    // Check MCC code — boosts confidence when it confirms the merchant match
    const txn = transactions[i];
    if (txn.mccCode) {
      // Direct match: txn MCC is in pattern's mccCodes list
      if (patternMCCs && matchesMCCList(patternMCCs, txn.mccCode)) {
        hasMCCMatch = true;
        reasons.push({ kind: 'mcc_match', value: txn.mccCode });
      }
      // Indirect match: txn MCC maps to a tax category that includes this pattern's category
      else {
        const entry = lookupMCC(txn.mccCode);
        if (entry && entry.taxCategories.includes(compiled.pattern.category)) {
          hasMCCMatch = true;
          reasons.push({ kind: 'mcc_boost', value: txn.mccCode });
        }
      }
    }
  }

  return { matched, reasons, hasMCCMatch };
}

// ─── Fuzzy Matching ─────────────────────────────────

/** Tokenize a transaction description into words for fuzzy comparison. */
function tokenizeDescription(upper: string): string[] {
  return upper.split(/[\s\-/#*.,]+/).filter((t) => t.length >= 3);
}

/** Try to fuzzy-match any merchant token against description tokens.
 *  Returns the best match above FUZZY_THRESHOLD, or null. */
function tryFuzzyMatch(
  upper: string,
  merchants: string[],
): { merchant: string; descToken: string; score: number } | null {
  const descTokens = tokenizeDescription(upper);
  if (descTokens.length === 0) return null;

  let bestMatch: { merchant: string; descToken: string; score: number } | null = null;

  for (const merchant of merchants) {
    // Skip short merchants (< 4 chars) — too many false positives with fuzzy
    if (merchant.length < 4) continue;

    // For multi-word merchants, check full description similarity
    if (merchant.includes(' ')) {
      const score = jaroWinklerSimilarity(upper, merchant);
      if (score >= FUZZY_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { merchant, descToken: upper, score };
      }
      continue;
    }

    // For single-word merchants, check each description token
    for (const dt of descTokens) {
      const score = jaroWinklerSimilarity(dt, merchant);
      if (score >= FUZZY_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { merchant, descToken: dt, score };
      }
    }
  }

  return bestMatch;
}

/** Deduplicate reasons by kind+value, keeping the first occurrence. */
function deduplicateReasons(reasons: MatchReason[]): MatchReason[] {
  const seen = new Set<string>();
  return reasons.filter((r) => {
    const key = `${r.kind}:${r.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
