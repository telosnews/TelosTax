/**
 * California State Tax Calculator — Tax Year 2025
 *
 * Calculates:
 *   1. CA income tax (9 progressive brackets)
 *   2. Mental Health Services Tax (1% on income over $1M)
 *   3. Personal exemption credits
 *   4. CalEITC (California Earned Income Tax Credit)
 *   5. CA itemized deduction recalculation (no SALT cap, $1M mortgage limit)
 *
 * Starting point: Federal AGI → CA modifications → CA brackets
 *
 * Form 540 ordering (critical for MHST):
 *   Line 31: Tax from brackets
 *   Line 32: Exemption credits
 *   Lines 33-47: Other credits
 *   Line 48: Tax after credits
 *   Line 62: MHST added AFTER all credits (never reduced by credits)
 *   Line 64: Total tax
 */

import {
  TaxReturn, CalculationResult, StateCalculationResult,
  StateReturnConfig, FilingStatus, CalculationTrace,
} from '../../types/index.js';
import {
  CA_BRACKETS, CA_STANDARD_DEDUCTION,
  CA_PERSONAL_EXEMPTION_CREDIT, CA_DEPENDENT_EXEMPTION_CREDIT,
  CA_MHST_THRESHOLD, CA_MHST_RATE,
  CA_EITC_TABLE, CA_EITC_INVESTMENT_INCOME_LIMIT,
  CA_YCTC_AMOUNT_PER_CHILD, CA_YCTC_PHASE_OUT_START, CA_YCTC_PHASE_OUT_RATE,
  CA_MORTGAGE_LIMIT, CA_SECTION_179_LIMIT,
  CA_RENTERS_CREDIT,
  CA_DEPENDENT_CARE_TABLE, CA_DEPENDENT_CARE_EXPENSE_LIMIT_1, CA_DEPENDENT_CARE_EXPENSE_LIMIT_2,
  CA_SENIOR_HOH_CREDIT, CA_SENIOR_HOH_CREDIT_RATE, CA_SENIOR_HOH_AGI_LIMIT, CA_SENIOR_HOH_MIN_AGE,
  CA_DEPENDENT_PARENT_CREDIT,
  CA_ITEMIZED_DEDUCTION_LIMITATION_THRESHOLD,
  CA_ITEMIZED_LIMITATION_RATE, CA_ITEMIZED_LIMITATION_MAX_REDUCTION,
  CA_EXEMPTION_PHASEOUT_REDUCTION_PER_STEP, CA_EXEMPTION_PHASEOUT_STEP,
} from '../../constants/states/ca.js';
import { parseDateString } from '../utils.js';
import { STATE_FORM_REFS, StateFormLineRefs } from '../../constants/states/stateFormRefs.js';
import { TraceBuilder } from '../traceBuilder.js';
import { applyBrackets, getStateWithholding, getStateFilingKey, getStateName } from './index.js';
import { round2 } from '../utils.js';

// ─── CA Additions / Subtractions ────────────────────────────────

/**
 * CA additions to federal AGI (items CA taxes but federal doesn't).
 */
function getAdditions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let additions = 0;

  // Out-of-state municipal bond interest (taxable in CA)
  const stateData = (taxReturn.stateReturns || []).find(s => s.stateCode === 'CA')?.stateSpecificData || {};
  const otherStateMuni = typeof stateData.otherStateMuniBondInterest === 'number'
    ? stateData.otherStateMuniBondInterest : 0;
  if (otherStateMuni > 0) additions += otherStateMuni;

  // Bonus depreciation addback — CA doesn't conform to IRC §168(k)
  const bonusDepTotal = federalResult.form4562?.bonusDepreciationTotal || 0;
  if (bonusDepTotal > 0) additions += bonusDepTotal;

  // Section 179 difference — CA limit is $25K vs federal $1.25M
  const federalSection179 = federalResult.form4562?.section179Deduction || 0;
  if (federalSection179 > CA_SECTION_179_LIMIT) {
    additions += federalSection179 - CA_SECTION_179_LIMIT;
  }

  return round2(additions);
}

/**
 * CA subtractions from federal AGI (items federal taxes but CA doesn't).
 */
function getSubtractions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let subtractions = 0;

  // CA fully exempts Social Security benefits (R&TC §17087)
  const ssaBenefits = federalResult.socialSecurity?.taxableBenefits || 0;
  if (ssaBenefits > 0) {
    subtractions += ssaBenefits;
  }

  // CA lottery winnings — exempt from CA income tax
  const stateData = (taxReturn.stateReturns || []).find(s => s.stateCode === 'CA')?.stateSpecificData || {};
  const lotteryWinnings = typeof stateData.caLotteryWinnings === 'number'
    ? stateData.caLotteryWinnings : 0;
  if (lotteryWinnings > 0) subtractions += lotteryWinnings;

  // Military pay subtraction (active-duty stationed outside CA)
  const militaryPay = typeof stateData.militaryPaySubtraction === 'number'
    ? stateData.militaryPaySubtraction : 0;
  if (militaryPay > 0) subtractions += militaryPay;

  // Railroad Retirement benefits — CA exempts like Social Security
  const railroadRetirement = typeof stateData.railroadRetirementBenefits === 'number'
    ? stateData.railroadRetirementBenefits : 0;
  if (railroadRetirement > 0) subtractions += railroadRetirement;

  // CA MACRS subtraction — for assets where federal bonus was taken,
  // CA allows regular MACRS instead. Net = bonus addback − CA MACRS.
  // Computed as a subtraction to partially offset the addition.
  const caMACRS = computeCAMACRSSubtraction(federalResult);
  if (caMACRS > 0) subtractions += caMACRS;

  return round2(subtractions);
}

/**
 * For assets where federal bonus depreciation was taken, CA allows
 * regular MACRS depreciation. This subtraction partially offsets
 * the bonus depreciation addition.
 */
function computeCAMACRSSubtraction(federalResult: CalculationResult): number {
  const assets = federalResult.form4562?.assetDetails;
  if (!assets || assets.length === 0) return 0;

  // Import MACRS rate tables inline to avoid circular deps
  let total = 0;
  for (const asset of assets) {
    if (asset.bonusDepreciation <= 0) continue;

    // For assets with bonus, federal MACRS may be $0 since bonus consumed the basis.
    // CA needs to compute MACRS on the full businessUseBasis (after §179).
    const basisForMACRS = asset.businessUseBasis - asset.section179Amount;
    if (basisForMACRS <= 0) continue;

    // Use the asset's first-year MACRS rate based on property class
    // The macrsDepreciation on the asset already represents what MACRS would be
    // if computed after bonus. We need the full first-year MACRS rate on the full basis.
    // For 100% bonus assets, macrsDepreciation is $0 — we recompute.
    if (asset.macrsDepreciation > 0) {
      // Partial bonus — federal already computed some MACRS
      total += asset.macrsDepreciation;
    } else {
      // 100% bonus consumed the basis — recompute CA MACRS from first-year rates
      // Use standard half-year convention rates by property class
      const firstYearRates: Record<number, number> = {
        3: 0.3333, 5: 0.2000, 7: 0.1429, 10: 0.1000, 15: 0.0500, 20: 0.0375,
      };
      // Mid-quarter rates vary by quarter placed in service (IRS Pub 946)
      const midQuarterRates: Record<number, Record<number, number>> = {
        3:  { 1: 0.5833, 2: 0.4167, 3: 0.2500, 4: 0.0833 },
        5:  { 1: 0.3500, 2: 0.2500, 3: 0.1500, 4: 0.0500 },
        7:  { 1: 0.2500, 2: 0.1785, 3: 0.1071, 4: 0.0357 },
        10: { 1: 0.1750, 2: 0.1250, 3: 0.0750, 4: 0.0250 },
        15: { 1: 0.0875, 2: 0.0625, 3: 0.0375, 4: 0.0125 },
        20: { 1: 0.0656, 2: 0.0469, 3: 0.0281, 4: 0.0094 },
      };
      let rate: number;
      if (asset.convention === 'mid-quarter') {
        const quarter = asset.quarterPlaced || 1;
        rate = midQuarterRates[asset.propertyClass]?.[quarter] || 0;
      } else {
        rate = firstYearRates[asset.propertyClass] || 0;
      }
      if (rate === 0) continue;
      total += round2(basisForMACRS * rate);
    }
  }
  return round2(total);
}

// ─── CA Itemized Deductions ─────────────────────────────────────

/**
 * Recalculate itemized deductions under CA rules (Schedule CA):
 * - No SALT cap (federal $40K OBBBA cap doesn't apply)
 * - CA state income tax is NOT deductible on CA return
 * - CA SDI is NOT deductible on CA return
 * - Mortgage interest: CA uses $1M limit (pre-TCJA), not federal $750K
 * - Medical, charitable: CA conforms to federal rules
 */
function calculateCAItemizedDeductions(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  filingKey: string,
  caAGI: number,
): number {
  const itemized = taxReturn.itemizedDeductions;
  if (!itemized) return 0;

  const sa = federalResult.scheduleA;
  if (!sa) return 0;

  // Medical: CA conforms — reuse federal calculation
  const medical = Math.max(0, sa.medicalDeduction);

  // SALT: re-derive without federal cap, excluding CA state income tax and SDI
  // Sum W-2 state tax withheld for non-CA states only (other states' taxes are deductible)
  let otherStateTaxWithheld = 0;
  for (const w2 of taxReturn.w2Income || []) {
    if (w2.state && w2.state.toUpperCase() !== 'CA' && w2.stateTaxWithheld) {
      otherStateTaxWithheld += w2.stateTaxWithheld;
    }
  }
  // Real estate and personal property tax — no cap
  const realEstateTax = itemized.realEstateTax || 0;
  const personalPropertyTax = itemized.personalPropertyTax || 0;
  const caSALT = round2(otherStateTaxWithheld + realEstateTax + personalPropertyTax);

  // Mortgage interest: CA $1M/$500K limit vs federal $750K/$375K
  const caMortgageLimit = CA_MORTGAGE_LIMIT[filingKey] || 1000000;
  let mortgageInterest = itemized.mortgageInterest || 0;
  const mortgageBalance = itemized.mortgageBalance || 0;

  if (mortgageBalance > 0 && mortgageInterest > 0) {
    // If balance exceeds CA limit, pro-rate the interest
    if (mortgageBalance > caMortgageLimit) {
      mortgageInterest = round2(mortgageInterest * (caMortgageLimit / mortgageBalance));
    }
    // If balance is between federal limit and CA limit, CA allows full deduction
    // (already handled — we only limit at CA threshold)
  }
  const mortgageInsurance = itemized.mortgageInsurancePremiums || 0;

  // Charitable: CA conforms — reuse federal calculation
  const charitable = Math.max(0, sa.charitableDeduction);

  // Other deductions: pass through
  const otherDeductions = Math.max(0, sa.otherDeduction);

  const totalBeforeLimitation = round2(
    medical +
    Math.max(0, caSALT) +
    Math.max(0, mortgageInterest) +
    Math.max(0, mortgageInsurance) +
    charitable +
    otherDeductions
  );

  // ── CA Itemized Deduction Limitation (Pease-style phase-out) ──
  // Medical expenses are exempt from the limitation.
  // All other categories are subject to reduction.
  const threshold = CA_ITEMIZED_DEDUCTION_LIMITATION_THRESHOLD[filingKey] || 252203;
  if (caAGI <= threshold) return totalBeforeLimitation;

  const subjectAmount = round2(totalBeforeLimitation - medical);
  if (subjectAmount <= 0) return totalBeforeLimitation;

  const excess = caAGI - threshold;
  const reductionFromRate = round2(excess * CA_ITEMIZED_LIMITATION_RATE);
  const reductionFromCap = round2(subjectAmount * CA_ITEMIZED_LIMITATION_MAX_REDUCTION);
  const reduction = Math.min(reductionFromRate, reductionFromCap);

  return round2(medical + Math.max(0, subjectAmount - reduction));
}

// ─── CA Credits ─────────────────────────────────────────────────

/**
 * CA personal exemption credits — a flat credit amount per filing status
 * plus additional credit per dependent.
 *
 * Subject to AGI phase-out per Form 540 Instructions, Line 32 (p.14):
 * When federal AGI exceeds the threshold, credits are reduced by $6 per
 * $2,500 ($1,250 MFS) of excess AGI, per exemption (rounded up).
 */
function calculatePersonalExemptionCredits(
  filingKey: string,
  numDependents: number,
  federalAGI: number,
): number {
  const personalCredit = CA_PERSONAL_EXEMPTION_CREDIT[filingKey] || 153;
  const dependentCredit = numDependents * CA_DEPENDENT_EXEMPTION_CREDIT;

  // Phase-out: same AGI thresholds as itemized deduction limitation
  const threshold = CA_ITEMIZED_DEDUCTION_LIMITATION_THRESHOLD[filingKey] || 252203;
  if (federalAGI <= threshold) return personalCredit + dependentCredit;

  const excess = federalAGI - threshold;
  const step = CA_EXEMPTION_PHASEOUT_STEP[filingKey] || 2500;
  const steps = Math.ceil(excess / step);
  const reductionPerExemption = CA_EXEMPTION_PHASEOUT_REDUCTION_PER_STEP * steps;

  // Personal exemption count (Line 7): 2 for MFJ/QSS, 1 for all others
  const personalCount = filingKey === 'married_joint' ? 2 : 1;
  const reducedPersonal = Math.max(0, personalCredit - reductionPerExemption * personalCount);

  // Dependent exemption count (Line 10)
  const reducedDependent = Math.max(0, dependentCredit - reductionPerExemption * numDependents);

  return reducedPersonal + reducedDependent;
}

/**
 * CalEITC — California Earned Income Tax Credit (Form 3514).
 *
 * CalEITC is INDEPENDENT of federal EITC — a filer can qualify for
 * CalEITC without qualifying for federal EITC (and vice versa).
 *
 * Uses real Form 3514 tables with phase-in / plateau / phase-out
 * based on earned income and number of qualifying children.
 */
function calculateCalEITCFull(
  earnedIncome: number,
  investmentIncome: number,
  qualifyingChildren: number,
): number {
  // Investment income disqualification
  if (investmentIncome > CA_EITC_INVESTMENT_INCOME_LIMIT) return 0;
  if (earnedIncome <= 0) return 0;

  const childKey = Math.min(qualifyingChildren, 3); // 3+ uses same table
  const table = CA_EITC_TABLE[childKey];
  if (!table || earnedIncome > table.earnedIncomeLimit) return 0;

  // Phase-in: credit increases as income rises
  const phaseInCredit = round2(earnedIncome * table.phaseInRate);
  if (phaseInCredit >= table.maxCredit) {
    // In the plateau or phase-out region
    if (earnedIncome <= table.phaseOutStart) {
      return table.maxCredit;
    }
    // Phase-out: credit decreases
    const reduction = round2((earnedIncome - table.phaseOutStart) * table.phaseOutRate);
    return Math.max(0, round2(table.maxCredit - reduction));
  }

  // Still in phase-in region — check if also in phase-out
  if (earnedIncome > table.phaseOutStart) {
    const reduction = round2((earnedIncome - table.phaseOutStart) * table.phaseOutRate);
    return Math.max(0, round2(table.maxCredit - reduction));
  }

  return phaseInCredit;
}

/**
 * Young Child Tax Credit (YCTC) — Form 3514 Part IV.
 *
 * Refundable credit for filers with a qualifying child under age 6
 * who are also eligible for CalEITC.
 */
function calculateYCTC(
  taxReturn: TaxReturn,
  earnedIncome: number,
  calEITCAmount: number,
  filingKey: string,
): number {
  // YCTC requires CalEITC eligibility
  if (calEITCAmount <= 0) return 0;

  // Count dependents under age 6 at end of tax year (Dec 31, 2025)
  let childrenUnder6 = 0;
  for (const dep of taxReturn.dependents || []) {
    if (!dep.dateOfBirth) continue;
    const dob = parseDateString(dep.dateOfBirth);
    if (!dob) continue;
    // Under 6 means born after Dec 31, 2019 (age < 6 on Dec 31, 2025).
    // No birthday adjustment needed since year-end is Dec 31.
    const ageAtYearEnd = 2025 - dob.year;
    if (ageAtYearEnd < 6) childrenUnder6++;
  }

  if (childrenUnder6 === 0) return 0;

  const maxCredit = childrenUnder6 * CA_YCTC_AMOUNT_PER_CHILD;
  const phaseOutStart = CA_YCTC_PHASE_OUT_START[filingKey] || 27425;

  if (earnedIncome <= phaseOutStart) return maxCredit;

  // Phase-out: reduction per $100 of earned income over threshold
  const excessIncome = earnedIncome - phaseOutStart;
  const reduction = round2(Math.floor(excessIncome / 100) * (CA_YCTC_PHASE_OUT_RATE * 100));
  return Math.max(0, round2(maxCredit - reduction));
}

/**
 * CA Renter's Credit — nonrefundable credit for qualifying renters
 * with CA AGI below a filing-status-specific threshold.
 */
function calculateRentersCredit(
  caAGI: number,
  filingKey: string,
  isRenter: boolean,
): number {
  if (!isRenter) return 0;
  const entry = CA_RENTERS_CREDIT[filingKey];
  if (!entry || caAGI > entry.agiLimit) return 0;
  return entry.credit;
}

/**
 * CA Dependent Care Credit (Form 3506) — nonrefundable credit
 * for child/dependent care expenses. Separate from federal.
 */
function calculateCADependentCareCredit(
  taxReturn: TaxReturn,
  caAGI: number,
): number {
  const dc = taxReturn.dependentCare;
  if (!dc || dc.totalExpenses <= 0) return 0;

  // Find the CA rate based on AGI
  let rate = 0;
  for (const tier of CA_DEPENDENT_CARE_TABLE) {
    if (caAGI <= tier.maxAGI) {
      rate = tier.rate;
      break;
    }
  }
  if (rate === 0) return 0; // AGI over $100K → no credit

  // Expense limit: $3K for 1, $6K for 2+
  const expenseLimit = dc.qualifyingPersons >= 2
    ? CA_DEPENDENT_CARE_EXPENSE_LIMIT_2
    : CA_DEPENDENT_CARE_EXPENSE_LIMIT_1;

  // Reduce by employer FSA benefits
  const fsaReduction = dc.dependentCareFSA || 0;
  const qualifiedExpenses = Math.min(dc.totalExpenses - fsaReduction, expenseLimit);
  if (qualifiedExpenses <= 0) return 0;

  return round2(qualifiedExpenses * rate);
}

/**
 * CA Senior Head of Household Credit — Code 163.
 * 2% of taxable income, capped at $1,860.
 * For HoH filers aged 65+ with CA AGI under $98,652.
 * Source: FTB Form 540 Instructions, p.15
 */
function calculateSeniorHoHCredit(
  taxReturn: TaxReturn,
  caAGI: number,
  filingKey: string,
  taxableIncome: number,
): number {
  if (filingKey !== 'head_of_household') return 0;
  if (caAGI > CA_SENIOR_HOH_AGI_LIMIT) return 0;
  if (!taxReturn.dateOfBirth) return 0;

  const dob = parseDateString(taxReturn.dateOfBirth);
  if (!dob) return 0;

  // Age at end of tax year (Dec 31, 2025) — no birthday adjustment
  // needed since year-end is the last possible day of the year.
  const ageAtYearEnd = 2025 - dob.year;
  if (ageAtYearEnd < CA_SENIOR_HOH_MIN_AGE) return 0;

  return Math.min(round2(taxableIncome * CA_SENIOR_HOH_CREDIT_RATE), CA_SENIOR_HOH_CREDIT);
}

/**
 * CA Dependent Parent Credit — Code 173.
 * $475 per dependent with relationship 'parent'.
 * Only available to married/RDP filing separately filers.
 * Source: FTB Form 540 Instructions, p.15
 * Nonrefundable.
 */
function calculateDependentParentCredit(taxReturn: TaxReturn, filingKey: string): number {
  if (filingKey !== 'married_separate') return 0;
  const parentDeps = (taxReturn.dependents || []).filter(
    d => d.relationship === 'parent'
  );
  return parentDeps.length * CA_DEPENDENT_PARENT_CREDIT;
}

/**
 * Mental Health Services Tax (MHST) — Proposition 63.
 * Additional 1% on taxable income exceeding $1,000,000.
 */
function calculateMHST(taxableIncome: number): number {
  if (taxableIncome <= CA_MHST_THRESHOLD) return 0;
  return round2((taxableIncome - CA_MHST_THRESHOLD) * CA_MHST_RATE);
}

// ─── Core Tax Computation (reusable for resident + 540NR) ───────

interface CACoreTaxResult {
  caAGI: number;
  additions: number;
  subtractions: number;
  deduction: number;
  taxableIncome: number;
  baseTax: number;
  mhst: number;
  bracketDetails: ReturnType<typeof applyBrackets>['details'];
  exemptionCredits: number;
  rentersCredit: number;
  caDependentCareCredit: number;
  seniorHoHCredit: number;
  dependentParentCredit: number;
  nonrefundableCredits: number;
  calEITC: number;
  yctc: number;
  refundableCredits: number;
  earnedIncome: number;
  qualifyingChildrenForEIC: number;
}

/**
 * Compute core CA tax values for a given AGI.
 * Used by both resident path (actual AGI) and 540NR path (full-year AGI).
 */
function computeCACoreTax(
  agi: number,
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): CACoreTaxResult {
  const f = federalResult.form1040;
  const filingKey = getStateFilingKey(taxReturn.filingStatus);

  const additions = getAdditions(taxReturn, federalResult);
  const subtractions = getSubtractions(taxReturn, federalResult);
  const caAGI = Math.max(0, agi + additions - subtractions);

  const standardDeduction = CA_STANDARD_DEDUCTION[filingKey] || 5706;
  let caItemized = 0;
  if (taxReturn.deductionMethod === 'itemized' && federalResult.scheduleA) {
    caItemized = calculateCAItemizedDeductions(taxReturn, federalResult, filingKey, caAGI);
  }
  const deduction = Math.max(standardDeduction, caItemized);
  const taxableIncome = Math.max(0, caAGI - deduction);

  const brackets = CA_BRACKETS[filingKey] || CA_BRACKETS['single'];
  const { tax: baseTax, details: bracketDetails } = applyBrackets(taxableIncome, brackets);
  const mhst = calculateMHST(taxableIncome);

  const numDependents = taxReturn.dependents?.length || 0;
  const exemptionCredits = calculatePersonalExemptionCredits(filingKey, numDependents, agi);

  const seEarnedIncome = f.scheduleCNetProfit > 0
    ? round2(f.scheduleCNetProfit * 0.9235)
    : 0;
  const earnedIncome = (taxReturn.w2Income || []).reduce(
    (sum, w) => sum + (w.wages || 0), 0
  ) + seEarnedIncome;

  const interest = f.totalInterest || 0;
  const dividends = f.totalDividends || 0;
  const capitalGains = Math.max(0, federalResult.scheduleD?.netGainOrLoss || 0);
  const rentalIncome = Math.max(0, f.scheduleEIncome || 0);
  const investmentIncome = interest + dividends + capitalGains + rentalIncome;

  const qualifyingChildrenForEIC = (taxReturn.dependents || []).filter(dep => {
    if (!dep.dateOfBirth) return dep.monthsLivedWithYou >= 6;
    const dob = parseDateString(dep.dateOfBirth);
    if (!dob) return dep.monthsLivedWithYou >= 6;
    const age = 2025 - dob.year;
    return dep.monthsLivedWithYou >= 6 && (age < 19 || (dep.isStudent && age < 24));
  }).length;

  const calEITC = calculateCalEITCFull(earnedIncome, investmentIncome, qualifyingChildrenForEIC);
  const yctc = calculateYCTC(taxReturn, earnedIncome, calEITC, filingKey);

  const stateData = config.stateSpecificData || {};
  const isRenter = stateData.isRenter === true;
  const rentersCredit = calculateRentersCredit(caAGI, filingKey, isRenter);
  const caDependentCareCredit = calculateCADependentCareCredit(taxReturn, caAGI);
  const seniorHoHCredit = calculateSeniorHoHCredit(taxReturn, caAGI, filingKey, taxableIncome);
  const dependentParentCredit = calculateDependentParentCredit(taxReturn, filingKey);

  const nonrefundableCredits = exemptionCredits + rentersCredit + caDependentCareCredit + seniorHoHCredit + dependentParentCredit;
  const refundableCredits = calEITC + yctc;

  return {
    caAGI, additions, subtractions, deduction, taxableIncome,
    baseTax, mhst, bracketDetails,
    exemptionCredits, rentersCredit, caDependentCareCredit,
    seniorHoHCredit, dependentParentCredit, nonrefundableCredits,
    calEITC, yctc, refundableCredits, earnedIncome, qualifyingChildrenForEIC,
  };
}

// ─── 540NR: Part-Year / Nonresident Calculator ──────────────────

/**
 * CA 540NR approach for part-year and nonresident filers.
 *
 * Method: Compute tax on ALL income as if full-year resident (Column A),
 * then multiply by CA income ratio (Column B / Column A).
 *
 * MHST is computed on full taxable income, then prorated.
 * Nonrefundable credits are prorated by the same ratio.
 * Refundable credits (CalEITC, YCTC) use CA-source earned income directly.
 */
function calculate540NR(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
  tb: TraceBuilder,
  refs: StateFormLineRefs | undefined,
): StateCalculationResult {
  const stateData = config.stateSpecificData || {};
  const originalAGI = stateData._originalFederalAGI as number;
  const ratio = Math.min(1, Math.max(0, (stateData._allocationRatio as number) || 0));
  const allocatedAGI = federalResult.form1040.agi; // Already allocated by index.ts
  const filingKey = getStateFilingKey(taxReturn.filingStatus);

  // Column A: Full-year resident tax on ALL income
  // NOTE: federalResult here is the allocated version from index.ts, but
  // createAllocatedFederalResult() only modifies agi/taxableIncome/totalWages.
  // All other fields (scheduleCNetProfit, taxableInterest, ordinaryDividends,
  // rentalRealEstateIncome, scheduleD, scheduleA, form4562) are preserved at
  // original full-year values via spread. computeCACoreTax() gets the correct
  // full-year values for investment income, SE income, and deductions.
  const fullYear = computeCACoreTax(originalAGI, taxReturn, federalResult, config);

  // Prorated values
  const proratedBaseTax = round2(fullYear.baseTax * ratio);
  const proratedMHST = round2(fullYear.mhst * ratio);
  const proratedNonrefundable = round2(fullYear.nonrefundableCredits * ratio);

  // Refundable credits: use CA-source earned income (not prorated)
  // For nonresidents, only W-2 wages from CA employers + CA-source SE income
  const caSourceWages = (taxReturn.w2Income || [])
    .filter(w => w.state?.toUpperCase() === 'CA')
    .reduce((sum, w) => sum + (w.wages || 0), 0);
  const f = federalResult.form1040;
  // Use user-provided sourceBusinessIncome when available (nonresident),
  // otherwise fall back to prorating total SE income by ratio
  const sourceBusinessIncome = (stateData.sourceBusinessIncome as number) || 0;
  const caSourceSE = sourceBusinessIncome > 0
    ? round2(sourceBusinessIncome * 0.9235)
    : f.scheduleCNetProfit > 0
      ? round2(f.scheduleCNetProfit * 0.9235 * ratio)
      : 0;
  const caSourceEarnedIncome = caSourceWages + caSourceSE;

  // Investment income (uses all income for disqualification test)
  const interest = f.totalInterest || 0;
  const dividends = f.totalDividends || 0;
  const capitalGains = Math.max(0, federalResult.scheduleD?.netGainOrLoss || 0);
  const rentalIncome = Math.max(0, f.scheduleEIncome || 0);
  const investmentIncome = interest + dividends + capitalGains + rentalIncome;

  const qualifyingChildrenForEIC = (taxReturn.dependents || []).filter(dep => {
    if (!dep.dateOfBirth) return dep.monthsLivedWithYou >= 6;
    const dob = parseDateString(dep.dateOfBirth);
    if (!dob) return dep.monthsLivedWithYou >= 6;
    const age = 2025 - dob.year;
    return dep.monthsLivedWithYou >= 6 && (age < 19 || (dep.isStudent && age < 24));
  }).length;

  const calEITC = calculateCalEITCFull(caSourceEarnedIncome, investmentIncome, qualifyingChildrenForEIC);
  const yctc = calculateYCTC(taxReturn, caSourceEarnedIncome, calEITC, filingKey);
  const refundableCredits = calEITC + yctc;

  // Tax calculation (540NR method) — same MHST ordering as resident path:
  // Form 540NR: Line 63 = bracket tax after credits, Line 72 = MHST, Line 74 = total
  // Credits reduce prorated bracket tax only, MHST added after.
  const taxAfterNonrefundable = Math.max(0, round2(proratedBaseTax - proratedNonrefundable));
  const refundableUsedAgainstTax = Math.min(taxAfterNonrefundable, refundableCredits);
  const refundableExcess = refundableCredits - refundableUsedAgainstTax;
  const taxBeforeMHST = Math.max(0, round2(taxAfterNonrefundable - refundableUsedAgainstTax));
  const totalStateTax = round2(taxBeforeMHST + proratedMHST);

  // Traces for 540NR
  const caAGI = fullYear.caAGI;
  tb.trace('state.stateAGI', 'CA AGI (all income, 540NR Column A)', caAGI, {
    formula: 'Full-year AGI for 540NR calculation',
    inputs: [{ lineId: 'form1040.line11', label: 'Original Federal AGI', value: originalAGI }],
  });
  tb.trace('state.540nr.ratio', 'CA Income Ratio', ratio, {
    formula: 'CA-source income ÷ Total income',
    inputs: [
      { lineId: 'state.allocatedAGI', label: 'CA-Source Income', value: allocatedAGI },
      { lineId: 'form1040.line11', label: 'Total Income', value: originalAGI },
    ],
  });
  tb.trace('state.totalTax', 'California Total Tax (540NR)', totalStateTax, {
    formula: '(Bracket Tax × Ratio − Credits) + MHST × Ratio',
    inputs: [
      { lineId: 'state.baseTax', label: 'Full-Year Bracket Tax', value: fullYear.baseTax },
      ...(fullYear.mhst > 0 ? [{ lineId: 'state.mhst', label: 'Full-Year MHST', value: fullYear.mhst }] : []),
      { lineId: 'state.540nr.ratio', label: 'CA Ratio', value: ratio },
      ...(proratedNonrefundable > 0 ? [{ lineId: 'state.credits', label: 'Prorated Credits', value: proratedNonrefundable }] : []),
    ],
  });

  // Payments
  const stateWithholding = getStateWithholding(taxReturn, 'CA');
  const estimatedPayments = typeof stateData.estimatedPayments === 'number'
    ? stateData.estimatedPayments : 0;
  const refundOrOwed = round2(stateWithholding + estimatedPayments - totalStateTax + refundableExcess);

  const effectiveRate = allocatedAGI > 0
    ? Math.round((totalStateTax / allocatedAGI) * 10000) / 10000
    : 0;

  return {
    stateCode: 'CA',
    stateName: getStateName('CA'),
    residencyType: config.residencyType,
    federalAGI: allocatedAGI,
    stateAdditions: fullYear.additions,
    stateSubtractions: fullYear.subtractions,
    stateAGI: round2(caAGI * ratio),
    stateDeduction: round2(fullYear.deduction * ratio),
    stateTaxableIncome: round2(fullYear.taxableIncome * ratio),
    stateExemptions: 0,
    stateIncomeTax: round2(proratedBaseTax + proratedMHST),
    stateCredits: round2(proratedNonrefundable + refundableCredits),
    stateTaxAfterCredits: totalStateTax,
    localTax: 0,
    totalStateTax,
    stateWithholding,
    stateEstimatedPayments: estimatedPayments,
    stateRefundOrOwed: refundOrOwed,
    effectiveStateRate: effectiveRate,
    bracketDetails: fullYear.bracketDetails,
    allocationRatio: ratio,
    allocatedAGI,
    additionalLines: {
      baseTaxBeforeMHST: fullYear.baseTax,
      mentalHealthServicesTax: fullYear.mhst,
      proratedBaseTax,
      proratedMHST,
      proratedNonrefundableCredits: proratedNonrefundable,
      calEITC,
      youngChildTaxCredit: yctc,
      caIncomeRatio: ratio,
      originalFederalAGI: originalAGI,
      // Full-year values for 540NR PDF form lines
      fullYearCAGI: fullYear.caAGI,
      fullYearTaxableIncome: fullYear.taxableIncome,
      fullYearDeduction: fullYear.deduction,
      personalExemptionCredits: fullYear.exemptionCredits,
      rentersCredit: fullYear.rentersCredit,
      caDependentCareCredit: fullYear.caDependentCareCredit,
      seniorHoHCredit: fullYear.seniorHoHCredit,
      dependentParentCredit: fullYear.dependentParentCredit,
    },
    traces: tb.build(),
  };
}

// ─── Main Calculator ────────────────────────────────────────────

export function calculateCalifornia(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): StateCalculationResult {
  const f = federalResult.form1040;
  const filingKey = getStateFilingKey(taxReturn.filingStatus);
  const federalAGI = f.agi;
  const tb = new TraceBuilder();
  const refs = STATE_FORM_REFS['CA'];

  // ── 540NR: Part-year / Nonresident ─────────────
  const stateData = config.stateSpecificData || {};
  if (config.residencyType !== 'resident' && stateData._originalFederalAGI != null) {
    return calculate540NR(taxReturn, federalResult, config, tb, refs);
  }

  // ── Compute core tax using helper ───────────
  const core = computeCACoreTax(federalAGI, taxReturn, federalResult, config);
  const {
    caAGI, additions, subtractions, deduction, taxableIncome,
    baseTax, mhst, bracketDetails,
    exemptionCredits, rentersCredit, caDependentCareCredit,
    seniorHoHCredit, dependentParentCredit, nonrefundableCredits,
    calEITC, yctc, refundableCredits, earnedIncome, qualifyingChildrenForEIC,
  } = core;
  const numDependents = taxReturn.dependents?.length || 0;

  // ── Trace: CA AGI ──
  tb.trace(
    'state.stateAGI', 'California Adjusted Gross Income',
    caAGI, {
      authority: refs?.agiLine,
      formula: additions > 0 && subtractions > 0
        ? 'Federal AGI + Additions − Subtractions'
        : subtractions > 0 ? 'Federal AGI − Subtractions'
        : additions > 0 ? 'Federal AGI + Additions' : 'Federal AGI',
      inputs: [
        { lineId: 'form1040.line11', label: 'Federal AGI', value: federalAGI },
        ...(additions > 0 ? [{ lineId: 'state.additions', label: 'CA Additions', value: additions }] : []),
        ...(subtractions > 0 ? [{ lineId: 'state.subtractions', label: 'CA Subtractions', value: subtractions }] : []),
      ],
    },
  );

  // ── Trace: Taxable Income ──
  tb.trace(
    'state.taxableIncome', 'California Taxable Income',
    taxableIncome, {
      authority: refs?.taxableIncomeLine,
      formula: 'CA AGI − Deduction',
      inputs: [
        { lineId: 'state.stateAGI', label: 'CA AGI', value: caAGI },
        ...(deduction > 0 ? [{ lineId: 'state.deduction', label: 'Deduction', value: deduction }] : []),
      ],
    },
  );

  // ── Trace: Income Tax with bracket children + MHST ──
  const stateIncomeTax = baseTax + mhst;
  const bracketTraceChildren: CalculationTrace[] = bracketDetails
    .filter(b => b.taxAtRate > 0)
    .map(b => ({
      lineId: `state.bracket.${(b.rate * 100).toFixed(1)}pct`,
      label: `${(b.rate * 100).toFixed(1)}% bracket`,
      value: b.taxAtRate,
      formula: `${b.taxableAtRate.toLocaleString()} × ${(b.rate * 100).toFixed(1)}%`,
      inputs: [{ lineId: 'state.bracket.taxableAtRate', label: `Income at ${(b.rate * 100).toFixed(1)}%`, value: b.taxableAtRate }],
    }));
  if (mhst > 0) {
    bracketTraceChildren.push({
      lineId: 'state.mhst', label: '1.0% Mental Health Services Tax', value: mhst,
      formula: `(${taxableIncome.toLocaleString()} − ${CA_MHST_THRESHOLD.toLocaleString()}) × ${(CA_MHST_RATE * 100).toFixed(1)}%`,
      inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
    });
  }
  tb.trace(
    'state.incomeTax', 'California Income Tax',
    stateIncomeTax, {
      authority: refs?.incomeTaxLine,
      formula: mhst > 0 ? 'Bracket Tax + MHST' : `Progressive brackets (CA)`,
      inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
      children: bracketTraceChildren.length > 0 ? bracketTraceChildren : undefined,
    },
  );

  // ── Trace: Credits with children ──
  const creditChildren: CalculationTrace[] = [];
  if (exemptionCredits > 0) {
    creditChildren.push({
      lineId: 'state.credits.exemption', label: 'Personal Exemption Credits', value: exemptionCredits,
      formula: `Personal + ${numDependents} dependent(s)`,
      inputs: [],
    });
  }
  if (rentersCredit > 0) {
    creditChildren.push({
      lineId: 'state.credits.renters', label: "Renter's Credit", value: rentersCredit,
      formula: `CA renter's credit`,
      inputs: [],
    });
  }
  if (caDependentCareCredit > 0) {
    creditChildren.push({
      lineId: 'state.credits.dependentCare', label: 'CA Dependent Care Credit', value: caDependentCareCredit,
      formula: 'Form 3506',
      inputs: [],
    });
  }
  if (seniorHoHCredit > 0) {
    creditChildren.push({
      lineId: 'state.credits.seniorHoH', label: 'Senior Head of Household Credit', value: seniorHoHCredit,
      formula: 'Age 65+ HoH filer',
      inputs: [],
    });
  }
  if (dependentParentCredit > 0) {
    creditChildren.push({
      lineId: 'state.credits.dependentParent', label: 'Dependent Parent Credit', value: dependentParentCredit,
      formula: `$475 × parent dependent(s)`,
      inputs: [],
    });
  }
  if (calEITC > 0) {
    creditChildren.push({
      lineId: 'state.credits.calEITC', label: 'CalEITC (Form 3514)', value: calEITC,
      formula: `Form 3514 tables (${qualifyingChildrenForEIC} qualifying child${qualifyingChildrenForEIC !== 1 ? 'ren' : ''})`,
      inputs: [{ lineId: 'state.earnedIncome', label: 'Earned Income', value: earnedIncome }],
    });
  }
  if (yctc > 0) {
    creditChildren.push({
      lineId: 'state.credits.yctc', label: 'Young Child Tax Credit', value: yctc,
      formula: 'YCTC (Form 3514 Part IV)',
      inputs: [{ lineId: 'state.earnedIncome', label: 'Earned Income', value: earnedIncome }],
    });
  }
  const totalCredits = tb.trace(
    'state.credits', 'California Credits',
    nonrefundableCredits + refundableCredits, {
      formula: creditChildren.length > 1
        ? creditChildren.map(c => c.label).join(' + ')
        : 'Exemption Credits',
      inputs: creditChildren.map(c => ({ lineId: c.lineId, label: c.label, value: c.value })),
      children: creditChildren.length > 0 ? creditChildren : undefined,
    },
  );

  // ── Step 7: Tax After Credits ────────────────
  // Form 540 ordering: credits reduce BRACKET tax only, NOT MHST.
  // Line 31: baseTax (bracket tax)
  // Line 32-47: subtract credits from baseTax
  // Line 48: taxAfterCredits = max(0, baseTax - nonrefundableCredits)
  // Line 62: MHST added here (never reduced by credits)
  // Line 64: totalTax = taxAfterCredits + MHST - refundable credits applied
  const taxAfterNonrefundable = Math.max(0, baseTax - nonrefundableCredits);
  const refundableUsedAgainstTax = Math.min(taxAfterNonrefundable, refundableCredits);
  const refundableExcess = refundableCredits - refundableUsedAgainstTax;

  // Total tax: bracket tax after credits + MHST (MHST never reduced by credits)
  const taxBeforeMHST = Math.max(0, taxAfterNonrefundable - refundableUsedAgainstTax);
  const totalStateTax = tb.trace(
    'state.totalTax', 'California Total Tax',
    taxBeforeMHST + mhst, {
      authority: refs?.totalTaxLine,
      formula: mhst > 0
        ? 'Tax After Credits + MHST'
        : totalCredits > 0 ? 'Income Tax − Credits' : 'Income Tax',
      inputs: [
        { lineId: 'state.baseTax', label: 'Bracket Tax', value: baseTax },
        ...(nonrefundableCredits > 0 ? [{ lineId: 'state.credits.exemption', label: 'Nonrefundable Credits', value: nonrefundableCredits }] : []),
        ...(refundableUsedAgainstTax > 0 ? [{ lineId: 'state.credits.calEITC', label: 'Refundable Credits (applied)', value: refundableUsedAgainstTax }] : []),
        ...(mhst > 0 ? [{ lineId: 'state.mhst', label: 'Mental Health Services Tax', value: mhst }] : []),
      ],
    },
  );

  // ── Step 8: Payments ─────────────────────────
  // CA has no separate local income tax (unlike NY/NYC)
  const localTax = 0;

  const stateWithholding = getStateWithholding(taxReturn, 'CA');
  const estimatedPayments = typeof stateData.estimatedPayments === 'number'
    ? stateData.estimatedPayments : 0;
  const totalPayments = stateWithholding + estimatedPayments;

  const refundOrOwedRaw = totalPayments - totalStateTax + refundableExcess;
  const refundOrOwed = tb.trace(
    'state.refundOrOwed',
    refundOrOwedRaw >= 0 ? 'California Refund' : 'California Amount Owed',
    refundOrOwedRaw, {
      authority: refs?.refundLine,
      formula: 'Withholding − Total Tax' + (refundableExcess > 0 ? ' + Refundable Credits' : ''),
      inputs: [
        { lineId: 'state.totalTax', label: 'Total State Tax', value: totalStateTax },
        ...(stateWithholding > 0 ? [{ lineId: 'state.withholding', label: 'Withholding', value: stateWithholding }] : []),
        ...(estimatedPayments > 0 ? [{ lineId: 'state.estimatedPayments', label: 'Estimated Payments', value: estimatedPayments }] : []),
        ...(refundableExcess > 0 ? [{ lineId: 'state.refundableExcess', label: 'Refundable Credits', value: refundableExcess }] : []),
      ],
    },
  );

  const effectiveRate = federalAGI > 0
    ? Math.round((totalStateTax / federalAGI) * 10000) / 10000
    : 0;

  return {
    stateCode: 'CA',
    stateName: getStateName('CA'),
    residencyType: config.residencyType,
    federalAGI,
    stateAdditions: additions,
    stateSubtractions: subtractions,
    stateAGI: caAGI,
    stateDeduction: deduction,
    stateTaxableIncome: taxableIncome,
    stateExemptions: 0, // CA uses exemption credits, not exemption amounts
    stateIncomeTax,
    stateCredits: totalCredits,
    stateTaxAfterCredits: taxAfterNonrefundable,
    localTax,
    totalStateTax,
    stateWithholding,
    stateEstimatedPayments: estimatedPayments,
    stateRefundOrOwed: refundOrOwed,
    effectiveStateRate: effectiveRate,
    bracketDetails,
    additionalLines: {
      baseTaxBeforeMHST: baseTax,
      mentalHealthServicesTax: mhst,
      personalExemptionCredits: exemptionCredits,
      rentersCredit,
      caDependentCareCredit,
      seniorHoHCredit,
      dependentParentCredit,
      calEITC,
      youngChildTaxCredit: yctc,
      taxBeforeCredits: stateIncomeTax,
    },
    traces: tb.build(),
  };
}
