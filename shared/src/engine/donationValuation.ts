import type { DonationCategory, DonationItemCondition, DonationItemEntry } from '../types/index.js';
import { DONATION_ITEMS, getDepreciationSchedule } from '../constants/donationValuationDb.js';
import { round2 } from './utils.js';

// ─── Normalization ──────────────────────────────────────────

/** Lowercase, strip apostrophes/hyphens, trim. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/['\u2019-]/g, '').trim();
}

/** Split normalized string into tokens. */
function tokenize(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean);
}

// ─── Search ─────────────────────────────────────────────────

export interface SearchResult {
  item: DonationItemEntry;
  score: number;
}

/**
 * Token-based search over DONATION_ITEMS.
 * Scoring: all tokens match name → 1.0, name starts with query → 0.9,
 * partial token overlap in name → 0.7 * fraction, keyword-only match → 0.5.
 */
export function searchDonationItems(
  query: string,
  category?: DonationCategory,
  maxResults = 20,
): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const normalizedQuery = normalize(query);
  const pool = category
    ? DONATION_ITEMS.filter((item) => item.category === category)
    : DONATION_ITEMS;

  const results: SearchResult[] = [];

  for (const item of pool) {
    const nameNorm = normalize(item.name);
    const nameTokens = tokenize(item.name);
    const keywordTokens = (item.keywords ?? []).map(normalize);

    // Count how many query tokens appear in the name tokens
    // Only match if the name token contains the query token (not reverse)
    const nameMatches = tokens.filter((t) =>
      nameTokens.some((nt) => nt.includes(t)),
    ).length;

    // Count how many query tokens appear in keywords
    const keywordMatches = tokens.filter((t) =>
      keywordTokens.some((kw) => kw.includes(t)),
    ).length;

    let score = 0;

    if (nameMatches === tokens.length) {
      // All tokens match name
      score = 1.0;
      // Boost exact match
      if (nameNorm === normalizedQuery) score = 1.0;
    } else if (nameNorm.startsWith(normalizedQuery)) {
      score = 0.9;
    } else if (nameMatches > 0) {
      score = 0.7 * (nameMatches / tokens.length);
    } else if (keywordMatches > 0) {
      score = 0.5 * (keywordMatches / tokens.length);
    }

    if (score > 0) {
      results.push({ item, score });
    }
  }

  // Sort descending by score, then alphabetically for ties
  results.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

  return results.slice(0, maxResults);
}

/**
 * Get all items in a category, sorted alphabetically.
 */
export function getItemsByCategory(category: DonationCategory): DonationItemEntry[] {
  return DONATION_ITEMS
    .filter((item) => item.category === category)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── FMV Calculation ────────────────────────────────────────

/**
 * Calculate FMV for a database item given a condition.
 * Good = lowFMV (0%), Very Good = midpoint (50%), Like New = highFMV (100%).
 */
export function calculateDatabaseFMV(
  item: DonationItemEntry,
  condition: DonationItemCondition,
): number {
  const conditionMap: Record<DonationItemCondition, number> = {
    good: 0,
    very_good: 0.5,
    like_new: 1,
  };
  const position = conditionMap[condition];
  return round2(item.lowFMV + position * (item.highFMV - item.lowFMV));
}

/**
 * Calculate FMV from an arbitrary 0.0-1.0 slider position.
 * Clamped to [0, 1].
 */
export function calculateSliderFMV(
  item: DonationItemEntry,
  position: number,
): number {
  const clamped = Math.min(1, Math.max(0, position));
  return round2(item.lowFMV + clamped * (item.highFMV - item.lowFMV));
}

// ─── Depreciation Calculator ────────────────────────────────

export interface DepreciationResult {
  estimatedFMV: number;
  depreciationRate: number;
  method: string;
}

/**
 * Estimate FMV from original purchase price using depreciation schedules.
 * Supports fractional years (e.g. 0.5 = 6 months) via linear interpolation.
 */
export function calculateDepreciatedFMV(params: {
  originalPrice: number;
  ageYears: number;
  category: DonationCategory | 'general';
}): DepreciationResult {
  const { originalPrice, ageYears, category } = params;

  if (originalPrice <= 0) {
    return { estimatedFMV: 0, depreciationRate: 0, method: 'Depreciation estimate from original cost' };
  }

  const schedule = getDepreciationSchedule(category);
  const { rates, floorRate } = schedule;

  let rate: number;

  if (ageYears <= 0) {
    rate = 0;
  } else if (ageYears >= rates.length + 1) {
    // Older than schedule — use floor rate
    rate = floorRate;
  } else {
    // ageYears maps to rates: year 1 → rates[0], year 2 → rates[1], etc.
    // For fractional years, linearly interpolate between adjacent rate points.
    // Rate points: year 0 = 0%, year 1 = rates[0], year 2 = rates[1], ...
    const lowerYear = Math.floor(ageYears);
    const fraction = ageYears - lowerYear;

    // Rate at the lower whole-year boundary
    const lowerRate = lowerYear === 0 ? 0 : (lowerYear - 1 < rates.length ? rates[lowerYear - 1] : floorRate);
    // Rate at the upper whole-year boundary
    const upperRate = lowerYear < rates.length ? rates[lowerYear] : floorRate;

    rate = lowerRate + fraction * (upperRate - lowerRate);
  }

  const estimatedFMV = round2(originalPrice * (1 - rate));

  return {
    estimatedFMV,
    depreciationRate: round2(rate),
    method: 'Depreciation estimate from original cost',
  };
}
