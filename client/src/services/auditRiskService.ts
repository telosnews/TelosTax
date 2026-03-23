/**
 * Audit Risk Scoring Service
 *
 * Evaluates a tax return for IRS audit risk factors and produces a
 * plain-English assessment with mitigation tips. This is presentation-level
 * logic — it consumes existing engine outputs and plausibility warnings.
 *
 * Pure function, no side effects.
 *
 * ─── Source Authority ────────────────────────────────────────────────
 * Every factual claim in this service is sourced from one of the following:
 *
 *  [DB24]  IRS Data Book 2024 (Publication 55B), Table 17 — Examination
 *          Coverage by Type and Size of Return, Tax Year 2022.
 *          https://www.irs.gov/statistics/soi-tax-stats-examination-coverage-and-recommended-additional-tax-after-examination-by-type-and-size-of-return-irs-data-book-table-17
 *
 *  [GAO22] GAO-22-104960 — "Tax Compliance: Trends of IRS Audit Rates
 *          and Results for Individual Taxpayers by Income," May 2022.
 *          https://www.gao.gov/products/gao-22-104960
 *
 *  [GAP22] IRS Publication 5869 (Rev. 10-2024) — "Federal Tax Compliance
 *          Research: Tax Gap Projections for Tax Year 2022."
 *          https://www.irs.gov/pub/irs-pdf/p5869.pdf
 *
 *  [GAO23] GAO-24-105281 — "Sole Proprietor Compliance: Treasury and IRS
 *          Have Opportunities to Reduce the Tax Gap," October 2023.
 *          https://www.gao.gov/assets/gao-24-105281.pdf
 *
 *  [TIGTA] TIGTA Report 2025-400-025 — "Assessment of Fiscal Year 2024
 *          Compliance With Improper Payment Reporting Requirements."
 *          https://www.tigta.gov
 *
 *  [NTA]   National Taxpayer Advocate Annual Report — Most Litigated Issues:
 *          Passive Activity Losses Under IRC §469.
 *          https://www.taxpayeradvocate.irs.gov
 *
 *  [IRM]   Internal Revenue Manual, Section 4.1.2.6 — DIF Overview.
 *          https://www.irs.gov/irm/part4/irm_04-001-002
 *
 *  [D6209] IRS Document 6209, Section 12 — Examination: describes DIF as
 *          assigning "weights to certain basic return characteristics" and
 *          ranking returns by composite score.
 *          https://www.irs.gov/pub/irs-6209/6209_section%2012_2014.pdf
 *
 *  [VITA]  IRS Link & Learn Taxes (VITA training) — "Schedule C Situations
 *          that Raise a 'Red Flag'."
 *          https://apps.irs.gov/app/vita/content/09s/09_08_010.jsp?level=advanced
 *
 *  [TIGTA-AOTC]  TIGTA Report 2024-40-026 — "Assessment of FY 2023 Compliance
 *                with PIIA." AOTC improper payment rate: 31.6% ($1.7B).
 *                https://www.tigta.gov
 *
 *  [GAO-AOTC]  GAO-16-475 — "Refundable Tax Credits: Comprehensive Compliance
 *              Strategy..." (May 2016). Average AOTC overclaims: $5.0B/year.
 *              https://www.gao.gov/products/gao-16-475
 *
 *  [TIGTA-FEIE]  TIGTA Report 2014-30-098 — "More Scrutiny Needed for Tax
 *                Returns of Taxpayers Claiming the Foreign Earned Income
 *                Exclusion" (Dec 2013). 99% of audited Form 2555 returns not
 *                referred to international examiners.
 *                https://www.tigta.gov
 *
 *  [LBI-FEIE]  IRS LB&I Compliance Campaign — "Foreign Earned Income Exclusion"
 *              (announced Nov 3, 2017). Active examination campaign.
 *              https://www.irs.gov/businesses/irs-lbi-compliance-campaigns-nov-3-2017
 *
 *  [GAO-FEIE]  GAO-14-387 — "Tax Policy: Economic Benefits of Income Exclusion
 *              for U.S. Citizens Working Abroad Are Uncertain" (May 2014).
 *              $4.4B tax expenditure; 445K filers.
 *              https://www.gao.gov/products/gao-14-387
 *
 *  [TIGTA-HOBBY]  TIGTA Report 2016-30-031 — "Opportunities Exist to Identify
 *                 and Examine Individual Taxpayers Who Deduct Potential Hobby
 *                 Losses" (April 2016). 88% of sampled returns showed hobby
 *                 indicators; $70.9M estimated improper deductions.
 *                 https://www.tigta.gov
 *
 *  [P5558]  IRS Publication 5558 (Rev. Sep 2021) — "Audit Technique Guide:
 *           IRC Section 183, Activities Not Engaged in for Profit."
 *           https://www.irs.gov/pub/irs-pdf/p5558.pdf
 *
 *  [TIGTA-NONCASH]  TIGTA Report 2013-40-009 — "Many Taxpayers Are Still Not
 *                   Complying With Noncash Charitable Contribution Reporting
 *                   Requirements" (Feb 2013). 60% noncompliance rate on >$5K
 *                   claims; $3.8B erroneous.
 *                   https://www.tigta.gov
 *
 *  [TIGTA-EV]  TIGTA Audit #202340825 — "Inflation Reduction Act: Implementation
 *              of the Clean Vehicle Tax Credits" (~Sep 2024). 97% of flagged
 *              returns confirmed noncompliant.
 *              https://www.tigta.gov
 *
 *  [TIGTA-EV19]  TIGTA Report 2019-30-011 — identified 16,510 returns receiving
 *                $73.8M in erroneous plug-in electric vehicle credits.
 *                https://www.tigta.gov
 *
 *  [TIGTA-5329]  TIGTA Report #2024-10-0065 — "Millions of Taxpayers Took Early
 *                Retirement Distributions but Some Did Not Pay the Additional Tax"
 *                (Sep 30, 2024). 2.8M taxpayers, $12.9B, ~$1.29B potential tax.
 *                https://www.tigta.gov
 *
 *  [GAO-K1]  GAO-14-453 — "Partnerships and S Corporations: IRS Needs to Improve
 *            Information to Address Tax Noncompliance" (May 2014). Estimated $91B
 *            annual misreporting.
 *            https://www.gao.gov/products/gao-14-453
 *
 *  [LBI-K1]  IRS LB&I Compliance Campaign — "Partnership Losses in Excess of
 *            Partner's Basis" (Feb 8, 2023).
 *            https://www.irs.gov/businesses/corporations/lbi-active-campaigns
 *
 *  [TIGTA-PTC]  TIGTA Report 2024-40-026 — FY 2023: Net Premium Tax Credit
 *               improper payment rate was 26.0%, representing approximately
 *               $1.0 billion. Part of $21.4 billion across four refundable credits.
 *               https://www.tigta.gov
 *
 *  [GAO-PTC]  GAO-26-108742 — "Preliminary Results Suggest Fraud Risks in the
 *             Advance Premium Tax Credit Persist" (Dec 2025). Over $21 billion
 *             in APTC paid for plan year 2023 could not be reconciled with IRS
 *             tax records. Nearly one-third of enrollees unreconciled.
 *             https://www.gao.gov/products/gao-26-108742
 *
 *  [TIGTA-DA]  TIGTA Report 2024-30-030 — "Virtual Currency Tax Compliance
 *              Enforcement Can Be Improved" (Jul 2024). Of 365,000+ SB/SE
 *              examinations, only 1,144 (0.31%) included digital asset review.
 *              https://www.tigta.gov
 *
 *  [LBI-DA]  IRS LB&I Compliance Campaign — "Virtual Currency Compliance."
 *            Active campaign with examination treatment stream.
 *            https://www.irs.gov/businesses/corporations/lbi-active-campaigns
 *
 *  [GAO-DA]  GAO-20-188 — "Virtual Currencies: Additional Information Reporting
 *            and Clarified Guidance Could Improve Tax Compliance" (Feb 2020).
 *            https://www.gao.gov/products/gao-20-188
 *
 * Statutory citations use standard IRC/Treas. Reg. format.
 *
 * ─── What DIF scores are and are not ────────────────────────────────
 * The IRS Discriminant Index Function (DIF) system assigns a numerical
 * score to every return based on statistical comparison to norms derived
 * from National Research Program (NRP) audit data [IRM 4.1.2.6, D6209].
 * The specific formulas, weights, and thresholds are classified. This
 * service identifies characteristics that publicly available data shows
 * correlate with higher examination rates or enforcement focus. The point
 * values and level thresholds are our own heuristic weighting — they do
 * not represent IRS scoring and should not be presented as such.
 */

import type { TaxReturn, CalculationResult } from '@telostax/engine';
import { checkPlausibility, SANCTIONED_COUNTRIES } from '@telostax/engine';

// ─── Types ──────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high';

export type RiskCategory = 'income' | 'deduction' | 'credit' | 'structural';

export interface RiskFactor {
  id: string;
  category: RiskCategory;
  points: number;
  label: string;
  explanation: string;
  mitigation: string;
  triggered: boolean;
}

export interface AuditRiskAssessment {
  level: RiskLevel;
  score: number;
  maxPossibleScore: number;
  triggeredFactors: RiskFactor[];
  summary: string;
}

// ─── Constants ──────────────────────────────────────

const LEVEL_THRESHOLDS = {
  moderate: 10,
  elevated: 24,
  high: 38,
} as const;

// Max possible: 15 + 10 + 8 + 5 + 8 + 6 + 6 + 5 + 4 + 12 + 3 = 82 (original)
//   + 5 (AOTC) + 8 (FEIE) + 7 (Farm Loss) + 6 (Noncash Charity) + 4 (EV) + 5 (Early Dist) + 5 (K-1) = 122
//   + 5 (PTC) + 5 (Digital Assets) = 132
//   + 8 (Sanctioned Country) = 140
// (very_high_income replaces high_income, so 15 not 25)
const MAX_POSSIBLE_SCORE = 140;

// ─── Core Assessment ────────────────────────────────

export function assessAuditRisk(
  taxReturn: TaxReturn,
  calculation: CalculationResult,
): AuditRiskAssessment {
  const factors: RiskFactor[] = [];
  const f = calculation.form1040;
  const agi = f.agi;

  /**
   * 1. Income level (mutually exclusive tiers)
   *
   * Source: IRS Data Book 2024, Table 17 [DB24] — TY 2022 examination
   * coverage rates by Total Positive Income (TPI):
   *   $1M–$5M TPI:   1.1%
   *   $5M–$10M TPI:  3.1%
   *   $10M+ TPI:     4.0%
   *   $500k–$1M TPI: 0.6%
   *   Overall:       ~0.2%
   *
   * Note: IRS Data Book reports rates by TPI, not AGI. TPI is the sum
   * of all positive income items (losses zeroed out), so TPI ≥ AGI.
   * We use AGI as a proxy since that is what the user sees. TY 2022
   * rates are interim — they will increase as audits open within the
   * statute of limitations period.
   *
   * Note: The $200k–$500k TPI bracket shows a 0.1% examination rate
   * in TY 2022 — actually below the overall average — so we do not
   * flag that bracket as elevated risk.
   */
  if (agi > 1_000_000) {
    factors.push({
      id: 'very_high_income',
      category: 'income',
      points: 15,
      label: 'Very High Income',
      explanation: 'Returns with total positive income above $1 million had an examination rate of 1.1%–4.0% for tax year 2022 — 5 to 20 times the overall rate of 0.2%.',
      mitigation: 'Ensure all income is accurately reported and supported by documentation. Consider working with a tax professional for returns of this complexity.',
      triggered: true,
    });
  } else if (agi > 500_000) {
    factors.push({
      id: 'high_income',
      category: 'income',
      points: 10,
      label: 'High Income',
      explanation: 'Returns with total positive income of $500,000–$1 million had an examination rate of 0.6% for tax year 2022 — three times the overall rate. These are interim figures; final rates will be higher as additional audits open within the statute of limitations.',
      mitigation: 'Ensure all income is accurately reported and supported by documentation.',
      triggered: true,
    });
  }

  /**
   * 2. Self-employment income (Schedule C)
   *
   * Source: IRS Publication 5869 [GAP22] — Tax Gap Projections for TY 2022.
   * Nonfarm sole proprietor income has a net misreporting percentage of
   * approximately 55%, compared to ~1% for wages subject to withholding.
   * Schedule C income is the single largest source of the individual
   * underreporting tax gap at $117 billion (31% of the individual gap).
   *
   * Source: GAO-24-105281 [GAO23] — Confirms sole proprietors are the
   * largest contributor to the individual income tax gap.
   *
   * Note: The IRS Data Book does not publish audit rates broken out by
   * Schedule C vs. non-Schedule C. We cannot verify the commonly cited
   * claim that Schedule C filers are "audited at double the rate."
   * What IS verified is that self-employment income has dramatically
   * higher noncompliance rates, making it a known enforcement priority.
   */
  const hasSE = (taxReturn.income1099NEC?.length ?? 0) > 0 ||
    (taxReturn.income1099K?.length ?? 0) > 0 ||
    (taxReturn.businesses?.length ?? 0) > 0;
  if (hasSE) {
    factors.push({
      id: 'schedule_c_filer',
      category: 'structural',
      points: 10,
      label: 'Self-Employment Income',
      explanation: 'Self-employment income has the highest noncompliance rate of any income type — approximately 55% of sole proprietor income goes unreported, according to IRS tax gap research. This makes Schedule C returns a known enforcement priority.',
      mitigation: 'Maintain meticulous records. Keep receipts and a contemporaneous log for all business expenses. Report all income, including cash payments.',
      triggered: true,
    });
  }

  /**
   * 3. Business revenue with no expenses
   *
   * Source: IRS VITA training materials [VITA] identify "Schedule C
   * Situations that Raise a Red Flag," including businesses with
   * unusual patterns. While no specific IRS source flags zero expenses
   * as a named trigger, the DIF system [IRM, D6209] compares returns
   * to statistical norms for similar businesses using NAICS industry
   * codes. A business with significant revenue and zero deductions is
   * a statistical outlier that would deviate from those norms.
   */
  const schedC = calculation.scheduleC;
  if (schedC && schedC.grossReceipts > 10_000 && schedC.totalExpenses === 0) {
    factors.push({
      id: 'cash_business_no_expenses',
      category: 'structural',
      points: 8,
      label: 'Business Revenue With No Expenses',
      explanation: 'The IRS compares business returns to statistical norms for similar businesses by industry. A business with significant revenue but zero deductible expenses is a statistical outlier that deviates from those norms.',
      mitigation: 'If you have legitimate business expenses, claim them. If this is genuinely pure service income with no costs, keep records that explain why.',
      triggered: true,
    });
  }

  /**
   * 4. Home office deduction
   *
   * Source: IRC §280A(c)(1) — requires the space be used "exclusively"
   * and on a "regular basis" as the taxpayer's principal place of
   * business. IRS Publication 587 provides detailed guidance.
   *
   * Note: The commonly repeated claim that the home office deduction is
   * "historically one of the top audit triggers" CANNOT be verified from
   * any IRS Data Book table, TIGTA report, or GAO report. The IRS does
   * not publish audit rates by specific deduction type. However, the
   * deduction does carry heightened substantiation requirements under
   * IRC §280A, and the exclusive-use test is a frequent source of
   * disallowance in Tax Court cases.
   */
  if (taxReturn.homeOffice?.method) {
    factors.push({
      id: 'home_office_claimed',
      category: 'deduction',
      points: 5,
      label: 'Home Office Deduction',
      explanation: 'The home office deduction requires exclusive and regular business use of the space under IRC §280A. The exclusive-use test is strictly enforced — any personal use of the space disqualifies the deduction.',
      mitigation: 'Document that your office space is used exclusively and regularly for business. Take photos and keep records of the dedicated space. The simplified method ($5/sq ft, max 300 sq ft) avoids complex calculations.',
      triggered: true,
    });
  }

  /**
   * 5. Large charitable deductions relative to income
   *
   * Source: The IRS DIF system [IRM 4.1.2.6, D6209] compares line items
   * to statistical norms for returns with similar characteristics. IRS
   * SOI data (Individual Statistical Tables by Size of AGI) publishes
   * average charitable deduction amounts by income bracket.
   *
   * Substantiation requirements:
   *   - $250+: contemporaneous written acknowledgment (IRC §170(f)(8))
   *   - $500+ noncash: Form 8283 Section A (IRC §170(f)(11)(B))
   *   - $5,000+ noncash: qualified appraisal required (IRC §170(f)(11)(C))
   *
   * Note: There is NO IRS-published threshold (such as ">30% of AGI")
   * that triggers audit selection. The 30% threshold used here is our
   * heuristic for identifying deductions that significantly exceed
   * typical patterns. Average charitable deductions are in the 3–5%
   * of AGI range for most income brackets per SOI data.
   */
  if (agi > 0 && taxReturn.itemizedDeductions) {
    const totalCharity =
      (taxReturn.itemizedDeductions.charitableCash || 0) +
      (taxReturn.itemizedDeductions.charitableNonCash || 0);
    if (totalCharity > agi * 0.30) {
      factors.push({
        id: 'large_charitable',
        category: 'deduction',
        points: 8,
        label: 'Large Charitable Deductions',
        explanation: 'Your charitable deductions exceed 30% of your AGI. Average charitable giving is 3–5% of AGI for most income brackets per IRS Statistics of Income data. The IRS DIF system flags line items that deviate significantly from statistical norms.',
        mitigation: 'Keep written acknowledgments from charities for all donations of $250 or more (IRC §170(f)(8)). For noncash donations over $500, file Form 8283. For noncash donations over $5,000, obtain a qualified appraisal.',
        triggered: true,
      });
    }
  }

  /**
   * 6. Earned Income Tax Credit
   *
   * Source: IRS Data Book 2024, Table 17 [DB24] — TY 2022: EITC returns
   * had a 0.7% examination rate vs. 0.2% overall — approximately 3.5x
   * the overall individual average.
   *
   * Source: TIGTA Report 2025-400-025 [TIGTA] — FY 2024: EITC improper
   * payment rate was 27%.
   *
   * Source: GAO-22-104960 [GAO22] — TY 2019: EITC audit rate was 0.77%
   * vs. 0.25% overall (3.1x).
   *
   * Note: The commonly cited "5x the average" figure refers to the
   * comparison between EITC claimants (~0.7%) and above-poverty-line
   * filers (~0.14%), not the overall average. Against the overall
   * individual average, the rate is approximately 3–3.5x.
   */
  if (calculation.credits.eitcCredit > 0) {
    factors.push({
      id: 'eitc_claimed',
      category: 'credit',
      points: 6,
      label: 'Earned Income Tax Credit',
      explanation: 'EITC returns had an examination rate of 0.7% for tax year 2022 — approximately 3.5 times the overall individual average of 0.2%. The EITC improper payment rate was 27% in fiscal year 2024 per TIGTA, making it a consistent enforcement focus.',
      mitigation: 'Ensure all qualifying children meet the residency and relationship tests. Keep records showing each child lived with you for more than half the year.',
      triggered: true,
    });
  }

  /**
   * 7. Rental property losses
   *
   * Source: IRC §469 — passive activity loss rules. Rental activities
   * are treated as passive per se under §469(c)(2), with exceptions for
   * real estate professionals (§469(c)(7)) and a $25,000 special
   * allowance for active participants (§469(i), phased out at
   * $100k–$150k MAGI).
   *
   * Source: National Taxpayer Advocate Annual Report [NTA] — passive
   * activity losses under IRC §469 are consistently listed among the
   * Most Litigated Issues, with the IRS prevailing in approximately
   * 82% of cases.
   *
   * Material participation: Treas. Reg. §1.469-5T (7 tests).
   */
  if (calculation.scheduleE && calculation.scheduleE.netRentalIncome < 0) {
    factors.push({
      id: 'rental_losses',
      category: 'deduction',
      points: 6,
      label: 'Rental Property Losses',
      explanation: 'Rental losses are subject to passive activity rules under IRC §469. The National Taxpayer Advocate consistently lists passive activity losses among the most litigated tax issues, with the IRS prevailing in approximately 82% of cases.',
      mitigation: 'If claiming material participation, document your hours spent on rental activities with a contemporaneous log. The IRS requires meeting one of seven tests under Treas. Reg. §1.469-5T.',
      triggered: true,
    });
  }

  /**
   * 8. High vehicle business-use percentage
   *
   * Source: IRC §274(d) — vehicles are "listed property" under
   * §280F(d)(4), subject to heightened substantiation requirements.
   * The Cohan rule (estimation) does not apply — if substantiation
   * fails, the entire deduction is disallowed.
   *
   * Source: Treas. Reg. §1.274-5(c)(2) — "adequate records" means
   * an account book, diary, log, or similar record made at or near
   * the time of the expenditure. IRS Publication 463 details
   * requirements.
   *
   * Note: No IRS publication or IRM section specifically identifies
   * a high business-use percentage as a "red flag." However, vehicles
   * carry the strictest substantiation requirements of any deduction
   * category (IRC §274(d) overrides Cohan), and the IRS DIF system
   * compares return characteristics to statistical norms [D6209].
   */
  const veh = taxReturn.vehicle;
  if (veh && veh.totalMiles && veh.totalMiles > 0) {
    const bizPct = (veh.businessMiles || 0) / veh.totalMiles;
    if (bizPct > 0.75) {
      factors.push({
        id: 'high_vehicle_business_use',
        category: 'deduction',
        points: 5,
        label: 'High Vehicle Business Use',
        explanation: 'Vehicle expenses are "listed property" under IRC §280F, subject to the strictest substantiation requirements in the tax code (IRC §274(d)). For most deductions, the Cohan rule allows courts to estimate a reasonable amount when records are incomplete. Vehicle expenses are an exception — if your records are insufficient, the entire deduction is disallowed with no estimation allowed.',
        mitigation: 'Keep a contemporaneous mileage log recording each trip\'s date, destination, business purpose, and miles driven. Records made "at or near the time" of the trip carry the highest credibility (Treas. Reg. §1.274-5(c)(2)).',
        triggered: true,
      });
    }
  }

  /**
   * 9. Large meal expenses relative to gross receipts
   *
   * Source: IRC §274(k) and (n) — business meals are 50% deductible
   * (the temporary 100% restaurant provision expired after 2022).
   * Entertainment expenses are fully nondeductible post-TCJA
   * (P.L. 115-97, §13304; finalized in Treas. Reg. §1.274-11 and
   * §1.274-12 per T.D. 9925).
   *
   * Note: There is NO IRS-published threshold (such as ">10% of
   * gross receipts") for meal expenses that triggers audit selection.
   * The 10% threshold used here is our heuristic. The DIF system
   * compares deduction patterns to norms by NAICS industry code
   * [IRM, D6209], and meal expenses that are disproportionate to
   * revenue would deviate from those norms.
   */
  if (schedC && schedC.grossReceipts > 0) {
    const meals = (schedC.lineItems?.['24a'] || 0) + (schedC.lineItems?.['24b'] || 0);
    if (meals > schedC.grossReceipts * 0.10) {
      factors.push({
        id: 'large_meals_entertainment',
        category: 'deduction',
        points: 4,
        label: 'High Meal Expenses',
        explanation: 'Your meal expenses exceed 10% of your business gross receipts. The IRS DIF system compares deduction patterns to statistical norms for businesses in your industry. Business meals are 50% deductible under IRC §274(n); entertainment expenses are fully nondeductible after the 2017 Tax Cuts and Jobs Act.',
        mitigation: 'Keep detailed records for every business meal: date, amount, business purpose, attendees, and business relationship (IRC §274(d)).',
        triggered: true,
      });
    }
  }

  /**
   * 10. Plausibility warnings from the engine
   *
   * Source: The IRS DIF system [IRM 4.1.2.6, D6209] scores returns by
   * comparing line items to statistical norms derived from NRP audit
   * data. Returns with values that deviate significantly from those
   * norms receive higher scores and are more likely to be selected
   * for examination.
   *
   * Our engine's checkPlausibility() function flags values that exceed
   * reasonable ranges — this is a simplified version of the same
   * concept, not a replication of DIF.
   */
  const plausibilityWarnings = checkPlausibility(taxReturn, agi);
  if (plausibilityWarnings.length > 0) {
    const pts = Math.min(plausibilityWarnings.length * 3, 12);
    factors.push({
      id: 'plausibility_warnings',
      category: 'structural',
      points: pts,
      label: 'Unusual Values Flagged',
      explanation: `Your return has ${plausibilityWarnings.length} value${plausibilityWarnings.length !== 1 ? 's' : ''} outside typical ranges. The IRS DIF system compares every line item on your return to statistical norms for similar taxpayers — values that deviate significantly increase your DIF score and the likelihood of examination selection.`,
      mitigation: 'Review each flagged item in the Warnings panel. If the amounts are correct, keep extra documentation readily available in case of inquiry.',
      triggered: true,
    });
  }

  /**
   * 11. Round-number expenses
   *
   * Source: IRS VITA/TCE training materials [VITA] — the IRS Link &
   * Learn Taxes platform identifies round-number gross receipts on
   * Schedule C as a situation that "raises a red flag," noting that
   * "it is unlikely that someone operating a business has annual gross
   * receipts from the business that are an exact round dollar amount."
   *
   * Note: No IRM section specifically identifies round-number expenses
   * as an audit selection criterion. This is based on IRS training
   * guidance for volunteer preparers and general Tax Court practice
   * where courts discount round-number testimony as suggesting
   * estimation rather than actual recordkeeping.
   */
  const nonzeroExpenses = (taxReturn.expenses || []).filter(e => e.amount > 0);
  if (nonzeroExpenses.length >= 4) {
    const roundCount = nonzeroExpenses.filter(e => e.amount % 100 === 0).length;
    if (roundCount / nonzeroExpenses.length > 0.50) {
      factors.push({
        id: 'round_numbers',
        category: 'structural',
        points: 3,
        label: 'Rounded Expense Amounts',
        explanation: 'IRS training materials flag round-number amounts as suggesting estimation rather than actual recordkeeping. Tax courts also give less credibility to round-number expense claims.',
        mitigation: 'Use exact amounts from receipts and bank statements rather than rounded estimates.',
        triggered: true,
      });
    }
  }

  /**
   * 12. American Opportunity Tax Credit (AOTC)
   *
   * Source: TIGTA Report 2024-40-026 [TIGTA-AOTC] — FY 2023: AOTC improper
   * payment rate was 31.6% ($1.7 billion). The rate has remained in the
   * 25–36% range since reporting began, far exceeding the 10% statutory
   * threshold under the Payment Integrity Information Act.
   *
   * Source: GAO-16-475 [GAO-AOTC] — Average AOTC overclaims of $5.0 billion
   * per year (2009–2011 average). Found the IRS had no comprehensive
   * compliance strategy for AOTC comparable to its EITC strategy.
   *
   * Source: TIGTA 2015-40-027 — TY 2012: 2+ million filers received $3.2B
   * with no Form 1098-T on file; 419,827 filers claimed AOTC for students
   * in more than 4 tax years (violating the IRC §25A(b)(2)(C) lifetime limit).
   *
   * The PATH Act (P.L. 114-113, Dec 2015) extended paid preparer due diligence
   * requirements (IRC §6695(g)) to AOTC, imposing a $650 penalty per failure
   * (inflation-adjusted for 2026).
   */
  // Note: educationCredit is the combined Form 8863 nonrefundable credit (AOTC + LLC).
  // We use aotcRefundableCredit only, since 40% of any AOTC claim always flows to
  // the refundable portion (Form 8863, Line 29). This avoids false positives for
  // taxpayers claiming only the Lifetime Learning Credit, which has a much lower
  // improper payment rate and is not the subject of the TIGTA findings cited above.
  const hasAOTC = calculation.credits.aotcRefundableCredit > 0;
  if (hasAOTC) {
    factors.push({
      id: 'aotc_claimed',
      category: 'credit',
      points: 5,
      label: 'American Opportunity Tax Credit',
      explanation: 'The AOTC had a 31.6% improper payment rate ($1.7 billion) in FY 2023 per TIGTA — the highest of any education credit and comparable to the EITC. Common errors include exceeding the 4-year lifetime limit (IRC §25A(b)(2)(C)) and claiming for students at ineligible institutions.',
      mitigation: 'Keep Form 1098-T from the educational institution. Verify the student has not claimed AOTC for more than 4 tax years and is enrolled at least half-time. Retain receipts for qualified tuition and related expenses.',
      triggered: true,
    });
  }

  /**
   * 13. Foreign Earned Income Exclusion (FEIE)
   *
   * Source: TIGTA Report 2014-30-098 [TIGTA-FEIE] — found that 99% of
   * audited Form 2555 returns (2,851 of 2,876) were NOT referred to
   * international examiners as required by IRS procedures.
   *
   * Source: IRS LB&I [LBI-FEIE] — The Foreign Earned Income Exclusion is
   * an active LB&I compliance campaign (announced Nov 3, 2017), targeting
   * taxpayers who claimed FEIE/housing exclusion without meeting qualifying
   * requirements. Treatment stream: examination.
   *
   * Source: GAO-14-387 [GAO-FEIE] — IRC §911 cost approximately $4.4 billion
   * in forgone tax revenue in 2013. Approximately 445,000 returns claimed
   * FEIE, representing 0.3% of all individual returns.
   *
   * Qualifying tests: Physical Presence (330 full days in 12-month period,
   * IRC §911(d)(1)(B)) or Bona Fide Residence (entire tax year,
   * IRC §911(d)(1)(A)).
   */
  const hasFEIE = (calculation.form1040.feieExclusion > 0) ||
    ((taxReturn.foreignEarnedIncome?.foreignEarnedIncome ?? 0) > 0);
  if (hasFEIE) {
    factors.push({
      id: 'feie_claimed',
      category: 'structural',
      points: 8,
      label: 'Foreign Earned Income Exclusion',
      explanation: 'The FEIE is an active IRS LB&I compliance campaign (since 2017) targeting taxpayers who claimed the exclusion without meeting qualifying tests. TIGTA found that 99% of audited Form 2555 returns were not properly referred to international examiners, indicating a systematic enforcement gap the IRS is working to close.',
      mitigation: 'Document your qualifying test: for Physical Presence, keep travel records showing 330 full days in a foreign country within a 12-month period. For Bona Fide Residence, retain evidence of foreign ties (lease, bank accounts, local tax filings). The IRS LB&I Practice Unit provides the examination framework agents use.',
      triggered: true,
    });
  }

  /**
   * 14. Farm losses (Schedule F / IRC §183 hobby loss)
   *
   * Source: TIGTA Report 2016-30-031 [TIGTA-HOBBY] — sampled returns with
   * high-income earners and multiyear business losses. Of 100 sampled
   * returns, 88 (88%) showed indications the activities were NOT engaged
   * in for profit. Estimated $70.9 million in improper deductions for
   * TY 2013 alone.
   *
   * Source: IRS Publication 5558 [P5558] (Rev. Sep 2021) — the IRS Audit
   * Technique Guide for IRC §183 codifies the nine-factor test from
   * Treas. Reg. §1.183-2(b) and provides examiner guidance.
   *
   * Source: IRC §183(d) — presumption of profit motive if gross income
   * exceeds deductions in 3 of 5 consecutive tax years (2 of 7 for
   * horse breeding/racing/showing activities).
   *
   * Source: IRS Publication 5869 [GAP22] — farm and sole proprietor income
   * falls in the "little or no information reporting" visibility category
   * with a 55% net misreporting percentage.
   *
   * Note: The TIGTA report sampled Schedule C returns, not Schedule F
   * specifically. However, the IRC §183 legal framework, the nine-factor
   * test, and the DIF comparison methodology apply identically to farm
   * activities. Farm losses are litigated frequently in Tax Court under
   * §183 (e.g., Schwarz v. Commissioner, T.C. Memo 2025-122: $15M in
   * farming losses denied).
   */
  const farmResult = calculation.scheduleF;
  if (farmResult && farmResult.netFarmProfit < 0) {
    factors.push({
      id: 'farm_losses',
      category: 'deduction',
      points: 7,
      label: 'Farm Losses',
      explanation: 'Farm losses are subject to the hobby loss rules under IRC §183. TIGTA found that 88% of sampled returns with high income and multiyear business losses showed indications of non-profit activity. The IRS ATG (Publication 5558) applies a nine-factor test to determine profit motive. Farm income falls in the "little or no information reporting" category with a 55% net misreporting rate.',
      mitigation: 'Maintain businesslike records and a written business plan. Document expertise (industry publications, consultations). Track time spent on farming. The §183(d) safe harbor presumes profit motive if profitable in 3 of 5 years (2 of 7 for horse activities).',
      triggered: true,
    });
  }

  /**
   * 15. Large noncash charitable contributions
   *
   * Source: TIGTA Report 2013-40-009 [TIGTA-NONCASH] — TY 2010: 273,000+
   * taxpayers claimed approximately $3.8 billion in potentially erroneous
   * noncash contributions, with an estimated $1.1 billion tax reduction.
   * Of returns with >$5K noncash claims, approximately 60% did not comply
   * with reporting requirements.
   *
   * Substantiation tiers (IRC §170(f)(11)):
   *   $250+:    contemporaneous written acknowledgment (IRC §170(f)(8))
   *   $500+:    Form 8283 Section A (IRC §170(f)(11)(C))
   *   $5,000+:  qualified appraisal + Form 8283 Section B (IRC §170(f)(11)(D))
   *   $500,000+: complete appraisal attached to return (IRC §170(f)(11)(E))
   *
   * Overvaluation penalties: 20% for values claimed at 150%+ of correct
   * value (IRC §6662(e)); 40% for 200%+ (IRC §6662(h)). The IRS Art
   * Advisory Panel recommends 46–55% value reductions on charitable items
   * reviewed (IRS Publication 5392).
   *
   * Conservation easement enforcement: IRS is examining 28,000 investors
   * challenging $21 billion in syndicated conservation easement deductions.
   * Notice 2017-10 designated these as listed transactions.
   */
  const noncash = taxReturn.itemizedDeductions?.charitableNonCash || 0;
  if (noncash > 5000) {
    factors.push({
      id: 'large_noncash_charitable',
      category: 'deduction',
      points: 6,
      label: 'Large Noncash Charitable Contributions',
      explanation: 'TIGTA found that approximately 60% of returns with noncash charitable contributions over $5,000 did not comply with reporting requirements. Overvaluation of donated property is a perennial enforcement target — the IRS Art Advisory Panel recommends 46–55% reductions on items it reviews. Noncash contributions over $5,000 require a qualified appraisal (IRC §170(f)(11)(D)).',
      mitigation: 'Obtain a qualified appraisal for donated property valued at $5,000+ and complete Form 8283 Section B (signed by both donee and appraiser). For $500+ items, file Form 8283 Section A. Keep contemporaneous written acknowledgments for all donations of $250+. Use realistic fair market values — overvaluation penalties are 20% (IRC §6662(e)) or 40% for gross misstatements.',
      triggered: true,
    });
  }

  /**
   * 16. Clean Vehicle Credits (Form 8936)
   *
   * Source: TIGTA Audit #202340825 [TIGTA-EV] — IRS identified 1,130 returns
   * with potentially erroneous clean vehicle credit claims totaling $3.2M;
   * 1,098 of 1,130 (97.2%) were confirmed noncompliant.
   *
   * Source: TIGTA Report 2019-30-011 [TIGTA-EV19] — identified 16,510 returns
   * receiving approximately $73.8M in erroneous plug-in electric vehicle
   * credits during Processing Years 2014–2018. IRS lacked effective processes
   * to identify false claims.
   *
   * IRS eligibility controls (post-IRA): MSRP caps ($80K for vans/SUVs/pickups,
   * $55K for all others); AGI limits ($300K MFJ / $225K HOH / $150K others).
   * Starting Jan 1, 2024, the IRS accepts/rejects dealer reports in real time
   * through the Energy Credits Online (ECO) portal.
   */
  if (calculation.credits.evCredit > 0) {
    factors.push({
      id: 'clean_vehicle_credit',
      category: 'credit',
      points: 4,
      label: 'Clean Vehicle Credit',
      explanation: 'TIGTA found 97% of flagged clean vehicle credit returns were confirmed noncompliant. A prior TIGTA audit identified $73.8 million in erroneous plug-in credits over 5 years. The credit has strict MSRP caps and AGI limits that are verified through the IRS Energy Credits Online portal.',
      mitigation: 'Retain the dealer sales documentation and IRS confirmation from the Energy Credits Online portal. Verify the vehicle meets MSRP requirements ($80K for SUVs/vans/pickups, $55K for other vehicles) and that your AGI is within limits ($300K MFJ / $150K single).',
      triggered: true,
    });
  }

  /**
   * 17. Early distribution penalty exceptions (Form 5329)
   *
   * Source: TIGTA Report #2024-10-0065 [TIGTA-5329] (Sep 30, 2024) —
   * TY 2021: approximately 2.8 million taxpayers received early distributions
   * of approximately $12.9 billion but did not pay the 10% additional tax
   * and did not file Form 5329. Potential additional tax liability:
   * approximately $1.29 billion. TIGTA found that without the failure-to-file
   * penalty, there are "potentially no consequences" for noncompliance.
   *
   * Source: IRC §72(t) — 10% additional tax on early distributions from
   * qualified retirement plans. Exceptions include disability, SEPP, and
   * first-time homebuyer. The SEPP (72(t)) modification rules carry a
   * retroactive recapture penalty if modified before the later of 5 years
   * or age 59½.
   */
  const hasEarlyDistribution = taxReturn.income1099R?.some(
    r => (r.grossDistribution || 0) > 0 && r.distributionCode === '1',
  );
  if (hasEarlyDistribution) {
    factors.push({
      id: 'early_distribution_exception',
      category: 'structural',
      points: 5,
      label: 'Early Retirement Distribution',
      explanation: 'TIGTA found that 2.8 million taxpayers took $12.9 billion in early retirement distributions without paying the 10% additional tax or filing Form 5329, representing $1.29 billion in potential unpaid tax. If claiming an exception, documentation of the qualifying event is essential.',
      mitigation: 'If claiming a penalty exception (disability, SEPP, first-time homebuyer, etc.), keep documentation of the qualifying event. For SEPP (72(t)) plans, do not modify the payment schedule before the later of 5 years or age 59½ — modification triggers retroactive recapture of all prior penalties plus interest.',
      triggered: true,
    });
  }

  /**
   * 18. K-1 pass-through losses
   *
   * Source: GAO-14-453 [GAO-K1] — estimated approximately $91 billion per year
   * of partnership and S corporation income was misreported by individuals
   * (2006–2009). K-1s were "at times missing, unable to be matched,
   * unavailable for months, subject to misreporting by recipients, and
   * only partially allocating partnership income."
   *
   * Source: IRS LB&I Compliance Campaign [LBI-K1] — "Partnership Losses in
   * Excess of Partner's Basis" (announced Feb 8, 2023). Active examination
   * campaign targeting partners claiming losses exceeding outside basis
   * under IRC §§705/704(d).
   *
   * Source: IRS Tax Gap data — pass-through entity income has a 15% net
   * misreporting percentage (TY 2014–2016), compared to 1% for wages.
   * Partnership audit rate in FY 2023: approximately 0.1%.
   *
   * Source: GAO-23-106020 — large partnerships (>$100M assets) grew ~600%
   * between 2002 and 2019; audit rate dropped to <0.5% since 2007.
   *
   * Source: IR-2024-166 — Treasury estimates abusive basis shifting
   * transactions in partnerships could cost $50B+ over 10 years. IRS
   * established a new Pass-Through Organizations Unit in LB&I.
   */
  const k1Losses = (taxReturn.incomeK1 || []).filter(
    k => ((k.ordinaryBusinessIncome || 0) < 0) || ((k.rentalIncome || 0) < 0),
  );
  if (k1Losses.length > 0) {
    factors.push({
      id: 'k1_pass_through_losses',
      category: 'structural',
      points: 5,
      label: 'K-1 Pass-Through Losses',
      explanation: 'GAO estimated $91 billion in annual partnership/S-corp income misreporting. The IRS launched a dedicated compliance campaign in 2023 targeting partnership losses exceeding basis (IRC §§704(d)/705) and established a new Pass-Through Organizations Unit. K-1 income has a 15% net misreporting percentage — 15 times the rate for wages.',
      mitigation: 'Track your outside basis in each partnership/S-corp to ensure losses do not exceed basis (IRC §704(d)/1366(d)). Keep K-1 documents and supporting schedules. Losses are further limited by at-risk rules (IRC §465) and passive activity rules (IRC §469).',
      triggered: true,
    });
  }

  /**
   * 19. K-1 Sanctioned Country (IRC §901(j))
   *
   * Source: IRC §901(j) — foreign tax credit denied for taxes paid to
   * countries designated under IRC §901(j)(2)(A)-(C): countries supporting
   * international terrorism, countries the US does not recognize or has
   * severed diplomatic relations with, or countries where the US government
   * has determined FTC would be contrary to national interests.
   *
   * Current designated countries: Cuba, Iran, North Korea, Syria.
   *
   * Source: OFAC SDN list and Treasury Department regulations.
   * Claiming FTC from a sanctioned country is a compliance red flag that
   * triggers manual review under LB&I international compliance campaigns.
   */
  const sanctionedK1s = (taxReturn.incomeK1 || []).filter(k1 => {
    const country = (k1.box15ForeignCountry || '').trim().toLowerCase();
    return country && SANCTIONED_COUNTRIES.some(sc => country.includes(sc.toLowerCase()));
  });
  if (sanctionedK1s.length > 0) {
    factors.push({
      id: 'k1_sanctioned_country',
      category: 'structural',
      points: 8,
      label: 'K-1 Income from Sanctioned Country',
      explanation: `IRC §901(j) disallows foreign tax credits for taxes paid to designated sanctioned countries (Cuba, Iran, North Korea, Syria). The IRS international compliance campaign actively reviews returns claiming FTC from these jurisdictions. ${sanctionedK1s.length} K-1(s) report income from a sanctioned country.`,
      mitigation: 'Foreign tax paid to a sanctioned country cannot be claimed as a credit or deduction. Ensure the country designation is accurate — if the entity operates in a non-sanctioned country, correct the K-1 Box 15 country field. Consult a tax professional for transactions involving sanctioned jurisdictions.',
      triggered: true,
    });
  }

  /**
   * 20. Premium Tax Credit (Form 8962)
   *
   * Source: TIGTA Report 2024-40-026 [TIGTA-PTC] — FY 2023: the Net Premium
   * Tax Credit had an improper payment rate of 26.0%, representing approximately
   * $1.0 billion. This is part of a combined $21.4 billion in improper payments
   * (21.9% overall rate) across four refundable credits (EITC, ACTC, AOTC, PTC).
   * The IRS has not met the statutory 10% threshold under the Payment Integrity
   * Information Act for any of these credits.
   *
   * Source: GAO-26-108742 [GAO-PTC] (Dec 2025) — Over $21 billion in APTC
   * paid for plan year 2023 enrollees who provided SSNs to the federal
   * Marketplace could not be reconciled with IRS tax records. Nearly one-third
   * of enrollees with SSNs were unreconciled. GAO submitted 20 fictitious
   * applications in 2024; 18 of 20 remained actively covered as of Sep 2025,
   * receiving combined APTC of over $10,000/month.
   *
   * Source: GAO-17-467 — Identified control weaknesses in both CMS and IRS
   * oversight of PTC. IRS lacked procedures to check for duplicate employer-
   * or government-sponsored coverage.
   *
   * Enforcement mechanism: Since TY 2021, IRS business rule F8962-070
   * automatically rejects e-filed returns when IRS records show the taxpayer
   * received APTC but did not include Form 8962.
   */
  if (calculation.credits.premiumTaxCredit > 0) {
    factors.push({
      id: 'ptc_claimed',
      category: 'credit',
      points: 5,
      label: 'Premium Tax Credit',
      explanation: 'The Premium Tax Credit had a 26% improper payment rate ($1.0 billion) in FY 2023 per TIGTA — comparable to the EITC. GAO found over $21 billion in advance PTC payments for 2023 that could not be reconciled with IRS tax records, and nearly one-third of marketplace enrollees could not be matched to filed returns.',
      mitigation: 'Ensure Form 8962 accurately reconciles all advance PTC received during the year. Keep Form 1095-A from the Health Insurance Marketplace. Report any life changes (income, household size, coverage) promptly to avoid large repayment obligations.',
      triggered: true,
    });
  }

  /**
   * 21. Digital Asset Transactions (1099-DA)
   *
   * Source: TIGTA Report 2024-30-030 [TIGTA-DA] (Jul 2024) — Of over 365,000
   * SB/SE examinations from FY 2020 onward, only 1,144 (0.31%) included a
   * review of digital asset activity. IRS Criminal Investigation investigated
   * 390 digital asset cases during FYs 2018–2023, with 224 recommended for
   * prosecution (113% increase FY 2018 to FY 2023).
   *
   * Source: TIGTA Report 2024-IER-005 (Dec 2023) — Approximately 2.3 million
   * filers reported virtual currency transactions for TY 2020. IRS SOI research
   * (Hoopes, Menzer & Wilde) found 12–21% of U.S. adults owned crypto but only
   * ~6.5% of taxpayers reported transactions — a significant reporting gap.
   *
   * Source: GAO-20-188 [GAO-DA] (Feb 2020) — Many virtual currency transactions
   * go unreported due to unclear requirements and reporting thresholds. GAO
   * recommended increased information reporting and clearer guidance.
   *
   * Source: IRS LB&I [LBI-DA] — "Virtual Currency Compliance" is an active
   * compliance campaign with examination treatment stream, involving a cross-IRS
   * working group (LB&I, SB/SE, CI, Chief Counsel).
   *
   * Enforcement escalation: The digital asset question moved from Schedule 1
   * (2019) to the front page of Form 1040 (2020+). IRS issued 10,000+
   * compliance letters in 2019. John Doe summonses served on Coinbase (2016),
   * Kraken (2021), Circle/Poloniex (2021), and SFOX (2022). Form 1099-DA
   * gross proceeds reporting begins for transactions on/after Jan 1, 2025;
   * basis reporting begins Jan 1, 2026.
   *
   * Joint Committee on Taxation estimated expanded broker reporting (Section
   * 80603, Infrastructure Investment and Jobs Act) would raise $28 billion
   * over 10 years in additional tax revenue from unreported digital asset income.
   */
  const hasDigitalAssets = (taxReturn.income1099DA?.length ?? 0) > 0;
  if (hasDigitalAssets) {
    factors.push({
      id: 'digital_assets',
      category: 'structural',
      points: 5,
      label: 'Digital Asset Transactions',
      explanation: 'Digital assets are an active IRS compliance campaign across LB&I, SB/SE, and Criminal Investigation. TIGTA found only 0.31% of SB/SE examinations included digital asset review despite 2.3 million filers reporting crypto for TY 2020. IRS research shows a significant reporting gap — 12–21% of adults own crypto, but only ~6.5% of taxpayers report transactions. CI digital asset prosecutions increased 113% from FY 2018 to FY 2023.',
      mitigation: 'Answer the Form 1040 digital asset question accurately. Report all dispositions on Form 8949 with correct cost basis. Retain exchange transaction records, wallet transfer histories, and DeFi protocol interactions. Form 1099-DA reporting begins in 2025, so broker records will be matched against your return.',
      triggered: true,
    });
  }

  // ── Score and level ─────────────────────────────────
  const triggeredFactors = factors.filter(rf => rf.triggered);
  const score = triggeredFactors.reduce((sum, rf) => sum + rf.points, 0);

  const level: RiskLevel =
    score >= LEVEL_THRESHOLDS.high ? 'high' :
    score >= LEVEL_THRESHOLDS.elevated ? 'elevated' :
    score >= LEVEL_THRESHOLDS.moderate ? 'moderate' :
    'low';

  return {
    level,
    score,
    maxPossibleScore: MAX_POSSIBLE_SCORE,
    triggeredFactors,
    summary: buildSummary(level, triggeredFactors.length),
  };
}

// ─── Helpers ────────────────────────────────────────

function buildSummary(level: RiskLevel, factorCount: number): string {
  switch (level) {
    case 'low':
      return 'Your return has minimal audit risk factors. Standard recordkeeping should be sufficient.';
    case 'moderate':
      return `Your return has ${factorCount} characteristic${factorCount !== 1 ? 's' : ''} associated with higher IRS examination rates. Keep organized records for your major deductions.`;
    case 'elevated':
      return `Your return has ${factorCount} factors associated with increased IRS scrutiny. Ensure you have documentation for every deduction claimed.`;
    case 'high':
      return `Your return has ${factorCount} significant audit-risk indicators. We strongly recommend thorough documentation and consider having a tax professional review your return.`;
  }
}
