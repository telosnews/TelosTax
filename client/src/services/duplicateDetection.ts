/**
 * Import Duplicate Detection — prevents double-counting from careless re-imports.
 *
 * Compares incoming W-2 / 1099 data against already-entered items in the tax return
 * by matching employer/payer name and key dollar amounts.
 *
 * All matching is client-side. Data never leaves the browser.
 */

import type { TaxReturn } from '@telostax/engine';

// ─── Types ───────────────────────────────────────

export interface DuplicateMatch {
  /** ID of the existing item that looks like a duplicate */
  existingId: string;
  /** Human-readable label for the existing item (e.g. "Acme Corp — $50,000") */
  existingLabel: string;
  /** How confident we are: 'exact' = name + amount match, 'likely' = name match only */
  confidence: 'exact' | 'likely';
}

export interface DuplicateCheckResult {
  /** Whether any potential duplicates were found */
  hasDuplicates: boolean;
  /** The matching existing items */
  matches: DuplicateMatch[];
}

// ─── Name Matching ───────────────────────────────

/**
 * Normalize a name for comparison: lowercase, collapse whitespace,
 * strip common suffixes (Inc, LLC, Corp, etc.), and remove punctuation.
 */
function normalizeName(name: string | undefined | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.,'"]/g, '')
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|plc|lp|llp|na|n\.a)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two names are similar enough to be the same entity.
 * Uses normalized exact match — this catches "ACME INC." vs "Acme Inc" vs "Acme".
 */
function namesMatch(a: string | undefined | null, b: string | undefined | null): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  // Exact match after normalization
  if (na === nb) return true;
  // One contains the other (catches "Fidelity" vs "Fidelity Investments")
  if (na.length >= 3 && nb.length >= 3) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

/**
 * Check if two dollar amounts match (within 1 cent to handle float rounding).
 */
function amountsMatch(a: number | undefined | null, b: number | undefined | null): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.02;
}

// ─── Per-Type Duplicate Checkers ─────────────────

/** Map from incomeType key (used by addIncomeItem) to checker function. */
type DuplicateChecker = (
  taxReturn: TaxReturn,
  incoming: Record<string, unknown>,
) => DuplicateCheckResult;

function fmt(amount: number | undefined | null): string {
  if (amount == null) return '$0';
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function checkW2(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.employerName as string | undefined;
  const incomingWages = incoming.wages as number | undefined;

  for (const existing of taxReturn.w2Income ?? []) {
    if (namesMatch(incomingName, existing.employerName)) {
      const isExact = amountsMatch(incomingWages, existing.wages);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.employerName} — ${fmt(existing.wages)} wages`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099NEC(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.payerName as string | undefined;
  const incomingAmount = incoming.amount as number | undefined;

  for (const existing of taxReturn.income1099NEC ?? []) {
    if (namesMatch(incomingName, existing.payerName)) {
      const isExact = amountsMatch(incomingAmount, existing.amount);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.payerName} — ${fmt(existing.amount)}`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099INT(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.payerName as string | undefined;
  const incomingAmount = incoming.amount as number | undefined;

  for (const existing of taxReturn.income1099INT ?? []) {
    if (namesMatch(incomingName, existing.payerName)) {
      const isExact = amountsMatch(incomingAmount, existing.amount);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.payerName} — ${fmt(existing.amount)} interest`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099DIV(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.payerName as string | undefined;
  const incomingAmount = incoming.ordinaryDividends as number | undefined;

  for (const existing of taxReturn.income1099DIV ?? []) {
    if (namesMatch(incomingName, existing.payerName)) {
      const isExact = amountsMatch(incomingAmount, existing.ordinaryDividends);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.payerName} — ${fmt(existing.ordinaryDividends)} dividends`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099R(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.payerName as string | undefined;
  const incomingAmount = incoming.grossDistribution as number | undefined;

  for (const existing of taxReturn.income1099R ?? []) {
    if (namesMatch(incomingName, existing.payerName)) {
      const isExact = amountsMatch(incomingAmount, existing.grossDistribution);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.payerName} — ${fmt(existing.grossDistribution)} distribution`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099G(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.payerName as string | undefined;
  const incomingAmount = incoming.unemploymentCompensation as number | undefined;

  for (const existing of taxReturn.income1099G ?? []) {
    if (namesMatch(incomingName, existing.payerName)) {
      const isExact = amountsMatch(incomingAmount, existing.unemploymentCompensation);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.payerName} — ${fmt(existing.unemploymentCompensation)} unemployment`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099MISC(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.payerName as string | undefined;
  const incomingAmount = incoming.otherIncome as number | undefined;

  for (const existing of taxReturn.income1099MISC ?? []) {
    if (namesMatch(incomingName, existing.payerName)) {
      const isExact = amountsMatch(incomingAmount, existing.otherIncome);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.payerName} — ${fmt(existing.otherIncome)} other income`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099B(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingBroker = incoming.brokerName as string | undefined;
  const incomingDesc = incoming.description as string | undefined;
  const incomingDate = incoming.dateSold as string | undefined;
  const incomingProceeds = incoming.proceeds as number | undefined;

  // PDF import creates summary records with no dateSold and a generic description
  const isSummary = !incomingDate && (incomingDesc || '').toLowerCase().includes('consolidated summary');

  for (const existing of taxReturn.income1099B ?? []) {
    if (!namesMatch(incomingBroker, existing.brokerName)) continue;

    if (isSummary) {
      // For summary imports (PDF), match on broker name alone since desc/date won't match individual trades
      const isExact = amountsMatch(incomingProceeds, existing.proceeds);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.brokerName} — ${existing.description || 'summary'} (${fmt(existing.proceeds)})`,
        confidence: isExact ? 'exact' : 'likely',
      });
    } else {
      // For individual transactions, require description + date match
      const descMatch = normalizeName(incomingDesc) === normalizeName(existing.description);
      const dateMatch = incomingDate === existing.dateSold;
      if (descMatch && dateMatch) {
        const isExact = amountsMatch(incomingProceeds, existing.proceeds);
        matches.push({
          existingId: existing.id,
          existingLabel: `${existing.brokerName} — ${existing.description} sold ${existing.dateSold} (${fmt(existing.proceeds)})`,
          confidence: isExact ? 'exact' : 'likely',
        });
      }
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099K(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.platformName as string | undefined;
  const incomingAmount = incoming.grossAmount as number | undefined;

  for (const existing of taxReturn.income1099K ?? []) {
    if (namesMatch(incomingName, existing.platformName)) {
      const isExact = amountsMatch(incomingAmount, existing.grossAmount);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.platformName} — ${fmt(existing.grossAmount)} gross`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function checkSSA1099(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingBenefits = incoming.totalBenefits as number | undefined;

  // SSA-1099 is a single object, not an array
  const existing = taxReturn.incomeSSA1099;
  if (existing) {
    const isExact = amountsMatch(incomingBenefits, existing.totalBenefits);
    matches.push({
      existingId: existing.id,
      existingLabel: `Social Security — ${fmt(existing.totalBenefits)} net benefits`,
      confidence: isExact ? 'exact' : 'likely',
    });
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099SA(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.payerName as string | undefined;
  const incomingAmount = incoming.grossDistribution as number | undefined;

  for (const existing of taxReturn.income1099SA ?? []) {
    if (namesMatch(incomingName, existing.payerName)) {
      const isExact = amountsMatch(incomingAmount, existing.grossDistribution);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.payerName} — ${fmt(existing.grossDistribution)} HSA distribution`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099Q(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.payerName as string | undefined;
  const incomingAmount = incoming.grossDistribution as number | undefined;

  for (const existing of taxReturn.income1099Q ?? []) {
    if (namesMatch(incomingName, existing.payerName)) {
      const isExact = amountsMatch(incomingAmount, existing.grossDistribution);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.payerName} — ${fmt(existing.grossDistribution)} 529 distribution`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099DA(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingBroker = incoming.brokerName as string | undefined;
  const incomingToken = incoming.tokenName as string | undefined;
  const incomingDate = incoming.dateSold as string | undefined;
  const incomingProceeds = incoming.proceeds as number | undefined;

  for (const existing of taxReturn.income1099DA ?? []) {
    if (!namesMatch(incomingBroker, existing.brokerName)) continue;
    const tokenMatch = normalizeName(incomingToken) === normalizeName(existing.tokenName);
    const dateMatch = incomingDate === existing.dateSold;
    if (tokenMatch && dateMatch) {
      const isExact = amountsMatch(incomingProceeds, existing.proceeds);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.brokerName} — ${existing.tokenName} sold ${existing.dateSold} (${fmt(existing.proceeds)})`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function checkK1(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.entityName as string | undefined;
  const incomingAmount = incoming.ordinaryBusinessIncome as number | undefined;

  for (const existing of taxReturn.incomeK1 ?? []) {
    if (namesMatch(incomingName, existing.entityName)) {
      const isExact = amountsMatch(incomingAmount, existing.ordinaryBusinessIncome);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.entityName} — ${fmt(existing.ordinaryBusinessIncome)} business income`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function checkW2G(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.payerName as string | undefined;
  const incomingAmount = incoming.grossWinnings as number | undefined;

  for (const existing of taxReturn.incomeW2G ?? []) {
    if (namesMatch(incomingName, existing.payerName)) {
      const isExact = amountsMatch(incomingAmount, existing.grossWinnings);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.payerName} — ${fmt(existing.grossWinnings)} winnings`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099C(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.payerName as string | undefined;
  const incomingAmount = incoming.amountCancelled as number | undefined;

  for (const existing of taxReturn.income1099C ?? []) {
    if (namesMatch(incomingName, existing.payerName)) {
      const isExact = amountsMatch(incomingAmount, existing.amountCancelled);
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.payerName} — ${fmt(existing.amountCancelled)} cancelled debt`,
        confidence: isExact ? 'exact' : 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1098(taxReturn: TaxReturn, _incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  if ((taxReturn.itemizedDeductions as any)?.mortgageInterest > 0) {
    matches.push({
      existingId: 'itemized-mortgage',
      existingLabel: `Mortgage interest already entered — ${fmt((taxReturn.itemizedDeductions as any).mortgageInterest)}`,
      confidence: 'likely',
    });
  }
  return { hasDuplicates: matches.length > 0, matches };
}

function check1098T(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.institutionName as string | undefined;

  for (const existing of taxReturn.educationCredits ?? []) {
    if (namesMatch(incomingName, existing.institution)) {
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.institution} — education credit`,
        confidence: 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1098E(taxReturn: TaxReturn, _incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  if ((taxReturn.studentLoanInterest as number) > 0) {
    matches.push({
      existingId: 'student-loan-interest',
      existingLabel: `Student loan interest already entered — ${fmt(taxReturn.studentLoanInterest as number)}`,
      confidence: 'likely',
    });
  }
  return { hasDuplicates: matches.length > 0, matches };
}

function check1095A(taxReturn: TaxReturn, incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  const incomingName = incoming.marketplaceName as string | undefined;

  for (const existing of taxReturn.premiumTaxCredit?.forms1095A ?? []) {
    if (namesMatch(incomingName, existing.marketplace)) {
      matches.push({
        existingId: existing.id,
        existingLabel: `${existing.marketplace} — 1095-A`,
        confidence: 'likely',
      });
    }
  }

  return { hasDuplicates: matches.length > 0, matches };
}

function check1099S(taxReturn: TaxReturn, _incoming: Record<string, unknown>): DuplicateCheckResult {
  const matches: DuplicateMatch[] = [];
  if ((taxReturn.homeSale as any)?.salePrice > 0) {
    matches.push({
      existingId: 'home-sale',
      existingLabel: `Home sale already entered — ${fmt((taxReturn.homeSale as any).salePrice)}`,
      confidence: 'likely',
    });
  }
  return { hasDuplicates: matches.length > 0, matches };
}

// ─── Registry ────────────────────────────────────

const CHECKERS: Record<string, DuplicateChecker> = {
  w2: checkW2,
  '1099nec': check1099NEC,
  '1099int': check1099INT,
  '1099div': check1099DIV,
  '1099r': check1099R,
  '1099g': check1099G,
  '1099misc': check1099MISC,
  '1099b': check1099B,
  '1099k': check1099K,
  ssa1099: checkSSA1099,
  '1099sa': check1099SA,
  '1099q': check1099Q,
  '1099da': check1099DA,
  k1: checkK1,
  w2g: checkW2G,
  '1099c': check1099C,
  '1098': check1098,
  '1098t': check1098T,
  '1098e': check1098E,
  '1095a': check1095A,
  '1099s': check1099S,
};

// ─── Public API ──────────────────────────────────

/**
 * Check a single incoming item against existing data in the tax return.
 * Used by the PDF import flow.
 *
 * @param taxReturn - Current tax return from the Zustand store
 * @param incomeType - The type key (e.g. 'w2', '1099nec', '1099int')
 * @param incoming - The extracted/edited data about to be imported
 */
export function checkForDuplicates(
  taxReturn: TaxReturn,
  incomeType: string,
  incoming: Record<string, unknown>,
): DuplicateCheckResult {
  const checker = CHECKERS[incomeType];
  if (!checker) return { hasDuplicates: false, matches: [] };
  return checker(taxReturn, incoming);
}

/**
 * Check a batch of incoming items against existing data.
 * Used by the CSV import flow for 1099-B / 1099-DA.
 * Returns the count of items that have duplicates already in the return.
 *
 * @param taxReturn - Current tax return from the Zustand store
 * @param incomeType - '1099b' or '1099da'
 * @param items - Array of parsed row data about to be imported
 */
export function checkBatchForDuplicates(
  taxReturn: TaxReturn,
  incomeType: string,
  items: Record<string, unknown>[],
): { duplicateCount: number; totalCount: number } {
  const checker = CHECKERS[incomeType];
  if (!checker) return { duplicateCount: 0, totalCount: items.length };

  let duplicateCount = 0;
  for (const item of items) {
    const result = checker(taxReturn, item);
    if (result.hasDuplicates) duplicateCount++;
  }

  return { duplicateCount, totalCount: items.length };
}
