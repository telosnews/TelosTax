import { FilingStatus, ForeignTaxCreditResult, ForeignTaxCreditCategory, ForeignTaxCreditCategoryResult } from '../types/index.js';
import { FOREIGN_TAX_CREDIT } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Foreign Tax Credit (Form 1116).
 *
 * Two modes:
 *   1. Simplified (no categories): Credit = min(foreignTaxPaid, US tax × foreignIncome / worldwide)
 *   2. Per-category (IRC §904(d)): Each category (general, passive) computes its own limitation.
 *      Total credit = sum of per-category credits.
 *
 * If foreign tax paid ≤ $300 ($600 MFJ), the simplified election allows
 * the full amount as a credit without Form 1116.
 *
 * The credit is non-refundable (reduces tax, cannot go below $0).
 *
 * @authority
 *   IRC: Section 901 — taxes of foreign countries and of possessions of United States
 *   IRC: Section 904 — limitation on foreign tax credit
 *   IRC: Section 904(d) — separate application of section to certain categories of income
 *   Form: Form 1116
 * @scope Foreign tax credit with limitation formula and separate category limitations
 * @limitations No carryback/carryforward, no AMT FTC, no re-sourcing rules
 */
export function calculateForeignTaxCredit(
  foreignTaxPaid: number,
  foreignSourceIncome: number,
  worldwideIncome: number,
  usTaxLiability: number,
  filingStatus: FilingStatus,
  categories?: ForeignTaxCreditCategory[],
): ForeignTaxCreditResult {
  const zero: ForeignTaxCreditResult = { foreignTaxPaid: 0, creditAllowed: 0 };

  if (foreignTaxPaid <= 0) return zero;
  if (worldwideIncome <= 0) return { foreignTaxPaid: round2(foreignTaxPaid), creditAllowed: 0 };

  // ─── Per-category limitation (IRC §904(d)) ──
  // When categories are provided, compute each category's limitation independently
  if (categories && categories.length > 0) {
    return calculateCategoryFTC(categories, worldwideIncome, usTaxLiability);
  }

  // ─── Simplified (single-category) ──
  // Simplified election: if foreign tax ≤ threshold, full credit (no Form 1116 required)
  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const simplifiedLimit = isMFJ
    ? FOREIGN_TAX_CREDIT.SIMPLIFIED_ELECTION_LIMIT_MFJ
    : FOREIGN_TAX_CREDIT.SIMPLIFIED_ELECTION_LIMIT;

  if (foreignTaxPaid <= simplifiedLimit && foreignSourceIncome >= foreignTaxPaid) {
    // Simplified election — credit = full foreign tax paid, limited to tax liability
    const credit = Math.min(foreignTaxPaid, usTaxLiability);
    return {
      foreignTaxPaid: round2(foreignTaxPaid),
      creditAllowed: round2(Math.max(0, credit)),
    };
  }

  // Full Form 1116 limitation:
  // Credit = min(foreign tax paid, US tax × (foreign income / worldwide income))
  const effectiveForeignIncome = Math.min(Math.max(0, foreignSourceIncome), worldwideIncome);
  const foreignIncomeRatio = effectiveForeignIncome / worldwideIncome;
  const limitedByTax = round2(usTaxLiability * foreignIncomeRatio);
  const credit = Math.min(foreignTaxPaid, limitedByTax);

  return {
    foreignTaxPaid: round2(foreignTaxPaid),
    creditAllowed: round2(Math.max(0, credit)),
  };
}

/**
 * Calculate FTC with separate limitation per category.
 *
 * IRC §904(d): Each category's limitation is computed independently:
 *   Category limitation = US tax × (category foreign income / worldwide income)
 *   Category credit = min(category foreign tax, category limitation)
 *   Total credit = sum of all category credits
 *
 * This prevents high-tax income in one category from "sheltering"
 * low-tax income in another category.
 *
 * @authority IRC §904(d)(1) — separate application of section to certain categories
 */
function calculateCategoryFTC(
  categories: ForeignTaxCreditCategory[],
  worldwideIncome: number,
  usTaxLiability: number,
): ForeignTaxCreditResult {
  const categoryResults: ForeignTaxCreditCategoryResult[] = [];
  let totalForeignTax = 0;
  let totalCredit = 0;

  for (const cat of categories) {
    const foreignTax = Math.max(0, cat.foreignTaxPaid);
    const foreignIncome = Math.min(Math.max(0, cat.foreignSourceIncome), worldwideIncome);

    totalForeignTax = round2(totalForeignTax + foreignTax);

    if (foreignTax <= 0 || worldwideIncome <= 0) {
      categoryResults.push({
        category: cat.category,
        foreignTaxPaid: round2(foreignTax),
        foreignSourceIncome: round2(foreignIncome),
        limitation: 0,
        creditAllowed: 0,
      });
      continue;
    }

    // Per-category limitation
    const foreignIncomeRatio = foreignIncome / worldwideIncome;
    const limitation = round2(usTaxLiability * foreignIncomeRatio);
    const credit = round2(Math.min(foreignTax, limitation));

    totalCredit = round2(totalCredit + credit);

    categoryResults.push({
      category: cat.category,
      foreignTaxPaid: round2(foreignTax),
      foreignSourceIncome: round2(foreignIncome),
      limitation,
      creditAllowed: credit,
    });
  }

  return {
    foreignTaxPaid: round2(totalForeignTax),
    creditAllowed: round2(Math.max(0, totalCredit)),
    categoryResults,
  };
}
