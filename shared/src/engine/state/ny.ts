/**
 * New York State + NYC Tax Calculator — Tax Year 2025
 *
 * Calculates:
 *   1. NYS income tax (progressive brackets + supplemental tax worksheets)
 *   2. NYC income tax (if applicable, progressive brackets + credits)
 *   3. Yonkers surcharge (if applicable, 16.75% of NYS tax after nonrefundable credits)
 *   4. NYS credits — nonrefundable: household, college tuition
 *                   — refundable: EITC, Empire State Child Credit, dependent care
 *   5. NYC credits — nonrefundable: household, school tax, tax elimination
 *                   — refundable: EITC, dependent care
 *   6. MCTMT (Metropolitan Commuter Transportation Mobility Tax)
 *
 * Starting point: Federal AGI -> NY modifications -> NY brackets/worksheets
 *
 * Sources: IT-201 Instructions (2025), 41 pages
 */

import {
  TaxReturn, CalculationResult, StateCalculationResult,
  StateReturnConfig, FilingStatus, CalculationTrace,
} from '../../types/index.js';
import {
  NY_BRACKETS, NY_STANDARD_DEDUCTION, NY_DEPENDENT_EXEMPTION,
  NYC_BRACKETS, YONKERS_RESIDENT_SURCHARGE_RATE,
  NY_SUPPLEMENTAL_AGI_THRESHOLD, NY_SUPPLEMENTAL_FLAT_STOP_AGI,
  NY_SUPPLEMENTAL_PHASE_RANGE, NY_SUPPLEMENTAL_TOP_AGI,
  NY_FIRST_WORKSHEET, NY_SUPPLEMENTAL_WORKSHEETS,
  NYC_HOUSEHOLD_CREDIT_SINGLE, NYC_HOUSEHOLD_CREDIT_PER_DEP,
  NYC_HOUSEHOLD_CREDIT_MFS_PER_DEP,
  NYC_SCHOOL_TAX_CREDIT_FIXED, NYC_SCHOOL_TAX_CREDIT_INCOME_LIMIT,
  NYC_SCHOOL_TAX_RATE_REDUCTION, NYC_SCHOOL_TAX_RATE_REDUCTION_LOW_RATE,
  NYC_SCHOOL_TAX_RATE_REDUCTION_INCOME_LIMIT,
  NY_ESCC_PER_CHILD_UNDER_4, NY_ESCC_PER_CHILD_4_TO_16,
  NY_ESCC_PHASE_OUT_PER_1000, NY_ESCC_FEDERAL_CTC_RATE,
  NY_ESCC_AGI_THRESHOLD,
  NY_DEPENDENT_CARE_TABLE, NYC_DEPENDENT_CARE_MAX_AGI, NYC_DEPENDENT_CARE_RATE,
  NY_COLLEGE_TUITION_CREDIT_RATE, NY_COLLEGE_TUITION_CREDIT_MAX,
  NYC_TAX_ELIMINATION_THRESHOLDS, NYC_TAX_ELIMINATION_PER_ADDITIONAL,
  NYC_TAX_ELIMINATION_PHASE_OUT,
  MCTMT_ZONE1_RATE, MCTMT_ZONE2_RATE, MCTMT_THRESHOLD,
} from '../../constants/states/ny.js';
import { STATE_FORM_REFS } from '../../constants/states/stateFormRefs.js';
import { TraceBuilder } from '../traceBuilder.js';
import { applyBrackets, getStateWithholding, getStateFilingKey, getStateName } from './index.js';
import { parseDateString, round2 } from '../utils.js';

// ─── NY Additions / Subtractions ────────────────────────────────

/**
 * NY additions to federal AGI (items NY taxes but federal doesn't).
 */
function getAdditions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let additions = 0;

  // Interest income from other states' municipal bonds
  // (not implemented — would require bond-level detail)

  // 529 plan distributions used for out-of-state plans
  // (not implemented — would require 529 detail)

  return additions;
}

/**
 * NY subtractions from federal AGI (items federal taxes but NY doesn't).
 */
function getSubtractions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let subtractions = 0;

  // NY doesn't tax Social Security benefits
  const ssaBenefits = federalResult.socialSecurity?.taxableBenefits || 0;
  if (ssaBenefits > 0) {
    subtractions += ssaBenefits;
  }

  // NY excludes up to $20,000 of pensions/annuities from NYS/local/federal sources
  // Only for taxpayers age 59½ or older (NY IT-201 instructions, pension exclusion)
  const pensionIncome = (taxReturn.income1099R || []).reduce(
    (sum, r) => sum + (r.taxableAmount || 0), 0
  );
  if (pensionIncome > 0) {
    // Check age — must be 59½ or older at end of tax year
    const dob = taxReturn.dateOfBirth;
    let meetsAgeReq = false;
    if (dob) {
      const dobParts = parseDateString(dob);
      if (dobParts) {
        const age = 2025 - dobParts.year;
        // 59½ by Dec 31, 2025 means born on or before June 30 (month is 0-based, so June = 5)
        meetsAgeReq = age >= 60 || (age === 59 && dobParts.month <= 5);
      }
    }
    if (meetsAgeReq) {
      subtractions += Math.min(pensionIncome, 20000);
    }
  }

  return subtractions;
}

// ─── NY Itemized Deductions (Form IT-196) ───────────────────────

/**
 * Calculate NY itemized deductions per Form IT-196.
 * Key differences from federal:
 *   - No SALT cap: full real estate tax + personal property tax deductible
 *   - No state/local income tax deduction on the NY return
 *   - Medical, mortgage, charitable, casualty, other: same as federal
 */
function calculateNYItemizedDeductions(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
): number {
  const sa = federalResult.scheduleA;
  if (!sa || taxReturn.deductionMethod !== 'itemized') return 0;
  const id = taxReturn.itemizedDeductions;
  if (!id) return 0;

  const medical = sa.medicalDeduction || 0;
  // SALT: full property tax (uncapped), NO state/local income tax
  const nySALT = (id.realEstateTax || 0) + (id.personalPropertyTax || 0);
  const mortgage = sa.interestDeduction || 0;
  const charitable = sa.charitableDeduction || 0;
  // Casualty + other: use Schedule A's computed amount (applies $100 floor + 10% AGI floor)
  const other = sa.otherDeduction || 0;

  return round2(medical + nySALT + mortgage + charitable + other);
}

// ─── Supplemental Tax (Recapture Worksheets, IT-201 pp.34-39) ───

/**
 * Calculate NY state tax using the supplemental tax worksheets when AGI > $107,650.
 *
 * Three worksheet types:
 *   Type A (WS1/7/12): Flat rate phase-in for AGI $107,650–$157,650
 *   Type B (WS2-5/8-10/13-15): Recapture of lower-bracket benefits
 *   Type C (WS6/11/16): Flat 10.9% for AGI > $25,000,000
 *
 * Returns the final NY state tax amount.
 */
function calculateNYStateTax(
  taxableIncome: number,
  nyAGI: number,
  filingKey: string,
): { tax: number; bracketDetails: ReturnType<typeof applyBrackets>['details']; supplementalUsed: string | null } {
  const brackets = NY_BRACKETS[filingKey] || NY_BRACKETS['single'];
  const { tax: rateScheduleTax, details: bracketDetails } = applyBrackets(taxableIncome, brackets);

  // Below supplemental threshold — use rate schedule only
  if (nyAGI <= NY_SUPPLEMENTAL_AGI_THRESHOLD) {
    return { tax: rateScheduleTax, bracketDetails, supplementalUsed: null };
  }

  // Type C: Flat 10.9% for AGI > $25M
  if (nyAGI > NY_SUPPLEMENTAL_TOP_AGI) {
    const flatTax = round2(taxableIncome * 0.109);
    return { tax: flatTax, bracketDetails, supplementalUsed: 'flat_10.9%' };
  }

  // Get worksheet configs for this filing status
  const firstWS = NY_FIRST_WORKSHEET[filingKey];
  const recaptureWSList = NY_SUPPLEMENTAL_WORKSHEETS[filingKey] || [];

  // Type A: First worksheet (flat rate phase-in)
  // Applies when taxable income ≤ the first bracket threshold for this filing status
  if (firstWS && taxableIncome <= firstWS.maxTaxableIncome) {
    const flatTax = round2(firstWS.flatRate * taxableIncome);

    // If AGI ≥ $157,650, fully phased in — use flat rate directly
    if (nyAGI >= NY_SUPPLEMENTAL_FLAT_STOP_AGI) {
      return { tax: flatTax, bracketDetails, supplementalUsed: 'first_worksheet_full' };
    }

    // Partial phase-in
    const diff = flatTax - rateScheduleTax;
    const phaseIn = Math.round(((nyAGI - NY_SUPPLEMENTAL_AGI_THRESHOLD) / NY_SUPPLEMENTAL_PHASE_RANGE) * 10000) / 10000;
    const tax = round2(rateScheduleTax + diff * phaseIn);
    return { tax, bracketDetails, supplementalUsed: 'first_worksheet_partial' };
  }

  // Type B: Recapture worksheets — find the applicable one
  // Walk through worksheets in order; use the last one whose AGI threshold the filer exceeds
  let applicableWS = null;
  for (const ws of recaptureWSList) {
    if (nyAGI > ws.agiThreshold) {
      applicableWS = ws;
    }
  }

  if (applicableWS) {
    const excess = nyAGI - applicableWS.agiThreshold;
    const phaseInAmount = Math.min(excess, NY_SUPPLEMENTAL_PHASE_RANGE);
    const phaseInFraction = Math.round((phaseInAmount / NY_SUPPLEMENTAL_PHASE_RANGE) * 10000) / 10000;
    const additionalTax = round2(applicableWS.incrementalBenefit * phaseInFraction);
    const tax = round2(rateScheduleTax + applicableWS.recaptureBase + additionalTax);
    return { tax, bracketDetails, supplementalUsed: `recapture_${applicableWS.agiThreshold}` };
  }

  // Fallback: rate schedule (should not reach here)
  return { tax: rateScheduleTax, bracketDetails, supplementalUsed: null };
}

// ─── NYS Credits ────────────────────────────────────────────────

/**
 * NYS Household Credit — a small nonrefundable credit for lower-income filers.
 * Tables 1-3, IT-201 pp.13-14
 */
function calculateHouseholdCredit(
  nyAGI: number,
  filingStatus: FilingStatus | undefined,
  dependents: number,
): number {
  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly;
  const agiLimit = isMFJ ? 32000 : 28000;

  if (nyAGI > agiLimit) return 0;

  // Base credit amount (varies by AGI and filing status)
  let baseCredit = 0;
  if (isMFJ) {
    if (nyAGI <= 22000) baseCredit = 90;
    else if (nyAGI <= 25000) baseCredit = 75;
    else if (nyAGI <= 28000) baseCredit = 60;
    else if (nyAGI <= 32000) baseCredit = 45;
  } else {
    if (nyAGI <= 15000) baseCredit = 75;
    else if (nyAGI <= 17500) baseCredit = 60;
    else if (nyAGI <= 20000) baseCredit = 50;
    else if (nyAGI <= 22500) baseCredit = 45;
    else if (nyAGI <= 25000) baseCredit = 40;
    else if (nyAGI <= 28000) baseCredit = 20;
  }

  // Additional per dependent
  const depCredit = dependents * 15;

  return baseCredit + depCredit;
}

/**
 * NYS EITC supplement — 30% of federal EITC. REFUNDABLE.
 */
function calculateNYEITC(federalEITC: number): number {
  return round2(federalEITC * 0.30);
}

/**
 * NYC EITC supplement — 10% of federal EITC (on top of NYS supplement). REFUNDABLE.
 * Only for NYC residents.
 */
function calculateNYCEITC(federalEITC: number): number {
  return round2(federalEITC * 0.10);
}

/**
 * Empire State Child Credit (IT-213, Line 63) — REFUNDABLE.
 *
 * Per IT-213 instructions (2025 expansion):
 *   - $1,000 per qualifying child under age 4
 *   - $330 per qualifying child ages 4-16
 *   - Phase-out: reduced by $16.50 per $1,000 of FAGI over threshold
 *   - Alternative: 33% of unused federal CTC (ACTC) — taxpayer gets the greater
 */
function calculateEmpireStateChildCredit(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  nyAGI: number,
  filingKey: string,
): number {
  const dependents = taxReturn.dependents || [];
  if (dependents.length === 0) return 0;

  // Count qualifying children by age (at end of tax year 2025)
  let under4Amount = 0;
  let ages4to16Amount = 0;
  for (const dep of dependents) {
    if (!dep.dateOfBirth) continue;
    const dob = parseDateString(dep.dateOfBirth);
    if (!dob) continue;
    // Age at end of tax year (Dec 31, 2025)
    const age = 2025 - dob.year;
    if (age < 0) continue;
    if (age < 4) {
      under4Amount += NY_ESCC_PER_CHILD_UNDER_4;
    } else if (age <= 16) {
      ages4to16Amount += NY_ESCC_PER_CHILD_4_TO_16;
    }
  }

  const basicCredit = under4Amount + ages4to16Amount;

  // Alternative: 33% of unused federal CTC (ACTC is the refundable portion = unused CTC)
  const altCredit = round2((federalResult.credits.actcCredit || 0) * NY_ESCC_FEDERAL_CTC_RATE);

  const rawCredit = Math.max(basicCredit, altCredit);
  if (rawCredit <= 0) return 0;

  // Phase-out
  const threshold = NY_ESCC_AGI_THRESHOLD[filingKey] || 75000;
  const excess = Math.max(0, nyAGI - threshold);
  const reduction = Math.ceil(excess / 1000) * NY_ESCC_PHASE_OUT_PER_1000;

  return round2(Math.max(0, rawCredit - reduction));
}

/**
 * NY/NYC Child & Dependent Care Credit (IT-216, Line 64) — NYS portion REFUNDABLE.
 *
 * NYS credit = percentage of federal dependent care credit (Form 2441),
 * based on NY AGI per IT-216 table.
 *
 * NYC additional: if NYC resident AND FAGI <= $30K AND qualifying child under 4,
 * NYC credit = 75% of NYS credit.
 */
function calculateNYDependentCareCredit(
  federalDependentCareCredit: number,
  nyAGI: number,
  isNYCResident: boolean,
  hasChildUnder4: boolean,
): { nyCredit: number; nycCredit: number } {
  if (federalDependentCareCredit <= 0) return { nyCredit: 0, nycCredit: 0 };

  // Find rate from table
  let rate = 0;
  for (const tier of NY_DEPENDENT_CARE_TABLE) {
    if (nyAGI <= tier.maxAGI) {
      rate = tier.rate;
      break;
    }
  }
  // Above $150K -> $0
  if (rate === 0) return { nyCredit: 0, nycCredit: 0 };

  const nyCredit = round2(federalDependentCareCredit * rate);

  // NYC additional credit
  let nycCredit = 0;
  if (isNYCResident && nyAGI <= NYC_DEPENDENT_CARE_MAX_AGI && hasChildUnder4) {
    nycCredit = round2(nyCredit * NYC_DEPENDENT_CARE_RATE);
  }

  return { nyCredit, nycCredit };
}

/**
 * College Tuition Credit (IT-272, Line 68) — NONREFUNDABLE.
 *
 * 4% of qualified tuition, max $400 per student.
 */
function calculateCollegeTuitionCredit(taxReturn: TaxReturn): number {
  const edCredits = taxReturn.educationCredits || [];
  if (edCredits.length === 0) return 0;

  let total = 0;
  for (const ec of edCredits) {
    const tuition = ec.tuitionPaid || 0;
    if (tuition > 0) {
      total += Math.min(round2(tuition * NY_COLLEGE_TUITION_CREDIT_RATE), NY_COLLEGE_TUITION_CREDIT_MAX);
    }
  }
  return round2(total);
}

// ─── NYC Credits ────────────────────────────────────────────────

/**
 * NYC Household Credit — Tables 4-6, IT-201 p.14
 * Only for NYC residents. NONREFUNDABLE.
 *
 * - Table 4: Single — flat amounts by AGI
 * - Table 5: MFJ/HoH/QSS — per-dependent amounts by AGI
 * - Table 6: MFS — per-dependent amounts by AGI (roughly half of Table 5)
 *
 * "Dependents" for Tables 5-6 = number on IT-201 item H + 1 for filer + 1 for spouse if MFJ
 */
function calculateNYCHouseholdCredit(
  nyAGI: number,
  filingStatus: FilingStatus | undefined,
  numDependents: number,
): number {
  const isSingle = filingStatus === FilingStatus.Single;
  const isMFS = filingStatus === FilingStatus.MarriedFilingSeparately;
  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly;

  if (isSingle) {
    // Table 4: flat credit by AGI
    for (const tier of NYC_HOUSEHOLD_CREDIT_SINGLE) {
      if (nyAGI <= tier.maxAGI) return tier.credit;
    }
    return 0;
  }

  // Tables 5 & 6: per-dependent credit
  // Count = dependents + 1 (filer) + 1 (spouse if MFJ)
  const depCount = numDependents + 1 + (isMFJ ? 1 : 0);
  const table = isMFS ? NYC_HOUSEHOLD_CREDIT_MFS_PER_DEP : NYC_HOUSEHOLD_CREDIT_PER_DEP;

  for (const tier of table) {
    if (nyAGI <= tier.maxAGI) return tier.perDep * depCount;
  }
  return 0;
}

/**
 * NYC School Tax Credit — IT-201 pp.20-21, Lines 69 and 69a. NONREFUNDABLE.
 *
 * Line 69 (fixed amount): $63 (S/MFS/HoH) or $125 (MFJ) if income <= $250,000
 * Line 69a (rate reduction amount): if not dependent AND income <= $500,000
 *   - Below threshold: 0.171% x city taxable income
 *   - Above threshold: base + 0.228% x (city taxable income - threshold)
 */
function calculateNYCSchoolTaxCredit(
  taxableIncome: number,
  nyAGI: number,
  filingKey: string,
  isClaimedAsDependent: boolean,
): { fixed: number; rateReduction: number } {
  let fixed = 0;
  let rateReduction = 0;

  // Line 69: Fixed amount
  if (nyAGI <= NYC_SCHOOL_TAX_CREDIT_INCOME_LIMIT) {
    fixed = NYC_SCHOOL_TAX_CREDIT_FIXED[filingKey] || 63;
  }

  // Line 69a: Rate reduction amount
  if (!isClaimedAsDependent && nyAGI <= NYC_SCHOOL_TAX_RATE_REDUCTION_INCOME_LIMIT) {
    const config = NYC_SCHOOL_TAX_RATE_REDUCTION[filingKey];
    if (config) {
      if (taxableIncome <= config.threshold) {
        rateReduction = round2(NYC_SCHOOL_TAX_RATE_REDUCTION_LOW_RATE * taxableIncome);
      } else {
        rateReduction = round2(config.base + config.rate * (taxableIncome - config.threshold));
      }
    }
  }

  return { fixed, rateReduction };
}

/**
 * NYC Income Tax Elimination Credit (IT-270, Line 70a) — NONREFUNDABLE.
 *
 * New for 2025. Based on 150% of 2023 federal poverty thresholds.
 * Eligibility: NYC resident, 1+ dependents, investment income <= $10K, no PTET.
 * Phase-out over $5K above threshold.
 */
function calculateNYCTaxEliminationCredit(
  taxReturn: TaxReturn,
  nycTaxGross: number,
  federalAGI: number,
  filingKey: string,
): number {
  const dependents = taxReturn.dependents || [];
  if (dependents.length === 0) return 0;
  if (nycTaxGross <= 0) return 0;

  // Household size = filer + spouse (if MFJ) + dependents
  const isMFJ = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly;
  const householdSize = 1 + (isMFJ ? 1 : 0) + dependents.length;

  // Get threshold for this household size
  let threshold: number;
  if (householdSize < NYC_TAX_ELIMINATION_THRESHOLDS.length) {
    threshold = NYC_TAX_ELIMINATION_THRESHOLDS[householdSize];
  } else {
    // For sizes > 8, add per-additional amount
    threshold = NYC_TAX_ELIMINATION_THRESHOLDS[8]
      + (householdSize - 8) * NYC_TAX_ELIMINATION_PER_ADDITIONAL;
  }

  if (threshold <= 0) return 0;

  // Check investment income limit ($10K) — includes interest, dividends, and capital gains
  const investmentIncome =
    (taxReturn.income1099INT || []).reduce((s, i) => s + (i.amount || 0), 0) +
    (taxReturn.income1099DIV || []).reduce((s, d) => s + (d.ordinaryDividends || 0), 0) +
    (taxReturn.income1099B || []).reduce((s, b) => s + Math.max(0, (b.proceeds || 0) - (b.costBasis || 0)), 0);
  if (investmentIncome > 10000) return 0;

  if (federalAGI <= threshold) {
    // Full credit = eliminate entire NYC tax
    return round2(nycTaxGross);
  }

  const over = federalAGI - threshold;
  if (over >= NYC_TAX_ELIMINATION_PHASE_OUT) {
    return 0; // Fully phased out
  }

  // Linear phase-out within $5K range
  const fraction = 1 - over / NYC_TAX_ELIMINATION_PHASE_OUT;
  return round2(nycTaxGross * fraction);
}

/**
 * MCTMT — Metropolitan Commuter Transportation Mobility Tax (IT-201 p.17).
 *
 * Applies to self-employed with net SE income > $50,000 in MTA district.
 * Zone 1 (NYC boroughs): 0.60%; Zone 2 (suburban counties): 0.34%.
 */
function calculateMCTMT(
  federalResult: CalculationResult,
  stateData: Record<string, unknown>,
  isNYCResident: boolean,
): number {
  const netSE = federalResult.scheduleSE?.netEarnings || 0;
  if (netSE <= MCTMT_THRESHOLD) return 0;

  // Determine zone
  if (isNYCResident) {
    return round2(netSE * MCTMT_ZONE1_RATE); // Zone 1
  }
  if (stateData.mtaZone === 2) {
    return round2(netSE * MCTMT_ZONE2_RATE); // Zone 2
  }

  return 0; // Not in MTA district
}

// ─── Core Tax Computation ───────────────────────────────────────

/**
 * Core NY tax computation for residents.
 * Mirrors computeCACoreTax() pattern — handles all calculation steps
 * from federal AGI through final refund/owed.
 *
 * Credit pipeline splits refundable/nonrefundable per CA pattern:
 *   - Nonrefundable credits reduce tax to $0 floor
 *   - Refundable credits generate excess that flows to refund
 *
 * calculateNewYork() is a thin wrapper that routes here.
 */
function computeNYCoreTax(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): StateCalculationResult {
  const f = federalResult.form1040;
  const filingKey = getStateFilingKey(taxReturn.filingStatus);
  const federalAGI = f.agi;
  const tb = new TraceBuilder();
  const refs = STATE_FORM_REFS['NY'];

  // ── Step 1: NY AGI ───────────────────────────
  const additions = getAdditions(taxReturn, federalResult);
  const subtractions = getSubtractions(taxReturn, federalResult);
  const nyAGI = tb.trace(
    'state.stateAGI', 'New York Adjusted Gross Income',
    Math.max(0, federalAGI + additions - subtractions), {
      authority: refs?.agiLine,
      formula: additions > 0 && subtractions > 0
        ? 'Federal AGI + Additions - Subtractions'
        : subtractions > 0 ? 'Federal AGI - Subtractions'
        : additions > 0 ? 'Federal AGI + Additions' : 'Federal AGI',
      inputs: [
        { lineId: 'form1040.line11', label: 'Federal AGI', value: federalAGI },
        ...(additions > 0 ? [{ lineId: 'state.additions', label: 'NY Additions', value: additions }] : []),
        ...(subtractions > 0 ? [{ lineId: 'state.subtractions', label: 'NY Subtractions (SS, pension)', value: subtractions }] : []),
      ],
    },
  );

  // ── Step 2: Deductions ───────────────────────
  const standardDeduction = NY_STANDARD_DEDUCTION[filingKey] || 8000;
  const nyItemized = calculateNYItemizedDeductions(taxReturn, federalResult);
  const deduction = Math.max(standardDeduction, nyItemized);

  // ── Step 3: Exemptions ───────────────────────
  const numDependents = taxReturn.dependents?.length || 0;
  const exemptions = numDependents * NY_DEPENDENT_EXEMPTION;

  // ── Step 4: Taxable Income ───────────────────
  const taxableIncome = tb.trace(
    'state.taxableIncome', 'New York Taxable Income',
    Math.max(0, nyAGI - deduction - exemptions), {
      authority: refs?.taxableIncomeLine,
      formula: 'NY AGI - Deduction - Exemptions',
      inputs: [
        { lineId: 'state.stateAGI', label: 'NY AGI', value: nyAGI },
        ...(deduction > 0 ? [{ lineId: 'state.deduction', label: 'Deduction', value: deduction }] : []),
        ...(exemptions > 0 ? [{ lineId: 'state.exemptions', label: 'Dependent Exemptions', value: exemptions }] : []),
      ],
    },
  );

  // ── Step 5: NY State Tax (with supplemental worksheets) ──
  const { tax: nysTax, bracketDetails, supplementalUsed } = calculateNYStateTax(taxableIncome, nyAGI, filingKey);

  // ── Trace: Income Tax with bracket children ──
  const bracketTraceChildren: CalculationTrace[] = bracketDetails
    .filter(b => b.taxAtRate > 0)
    .map(b => ({
      lineId: `state.bracket.${(b.rate * 100).toFixed(1)}pct`,
      label: `${(b.rate * 100).toFixed(1)}% bracket`,
      value: b.taxAtRate,
      formula: `${b.taxableAtRate.toLocaleString()} x ${(b.rate * 100).toFixed(1)}%`,
      inputs: [{ lineId: 'state.bracket.taxableAtRate', label: `Income at ${(b.rate * 100).toFixed(1)}%`, value: b.taxableAtRate }],
    }));
  tb.trace('state.incomeTax', 'New York State Income Tax', nysTax, {
    authority: refs?.incomeTaxLine,
    formula: supplementalUsed
      ? `Supplemental tax worksheet (${supplementalUsed})`
      : 'Progressive brackets (NY)',
    inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
    children: bracketTraceChildren.length > 0 ? bracketTraceChildren : undefined,
  });

  // ── Step 6: NYS Credits (split nonrefundable / refundable) ──
  const federalEITC = federalResult.credits.eitcCredit || 0;
  const stateData = config.stateSpecificData || {};
  const isNYCResident = stateData.nycResident === true;
  const isYonkersResident = !isNYCResident && stateData.yonkersResident === true;

  // Check if any dependent is under age 4 (for dependent care NYC credit)
  const hasChildUnder4 = (taxReturn.dependents || []).some(dep => {
    if (!dep.dateOfBirth) return false;
    const dob = parseDateString(dep.dateOfBirth);
    if (!dob) return false;
    const age = 2025 - dob.year;
    return age >= 0 && age < 4;
  });

  // NYS nonrefundable credits
  const householdCredit = calculateHouseholdCredit(nyAGI, taxReturn.filingStatus, numDependents);
  const collegeTuitionCredit = calculateCollegeTuitionCredit(taxReturn);

  // NYS refundable credits
  const nyEITC = calculateNYEITC(federalEITC);
  const empireStateChildCredit = calculateEmpireStateChildCredit(taxReturn, federalResult, nyAGI, filingKey);
  const federalDepCareCredit = federalResult.credits.dependentCareCredit || 0;
  const depCare = calculateNYDependentCareCredit(federalDepCareCredit, nyAGI, isNYCResident, hasChildUnder4);
  const nyDependentCareCredit = depCare.nyCredit;
  const nycDependentCareCredit = depCare.nycCredit;

  const nysNonrefundable = householdCredit + collegeTuitionCredit;
  const nysRefundable = nyEITC + empireStateChildCredit + nyDependentCareCredit;

  const nysAfterNonrefundable = Math.max(0, round2(nysTax - nysNonrefundable));

  // ── Trace: NYS Credits ──
  const creditChildren: CalculationTrace[] = [];
  if (householdCredit > 0) {
    creditChildren.push({
      lineId: 'state.credits.household', label: 'Household Credit', value: householdCredit,
      formula: 'NYS household credit (AGI-based)',
      inputs: [],
    });
  }
  if (collegeTuitionCredit > 0) {
    creditChildren.push({
      lineId: 'state.credits.collegeTuition', label: 'College Tuition Credit', value: collegeTuitionCredit,
      formula: '4% of qualified tuition, max $400/student',
      inputs: [],
    });
  }
  if (nyEITC > 0) {
    creditChildren.push({
      lineId: 'state.credits.nyEITC', label: 'NY EITC (30%)', value: nyEITC,
      formula: `Federal EITC x 30%`,
      inputs: [{ lineId: 'federal.eitc', label: 'Federal EITC', value: federalEITC }],
    });
  }
  if (empireStateChildCredit > 0) {
    creditChildren.push({
      lineId: 'state.credits.escc', label: 'Empire State Child Credit', value: empireStateChildCredit,
      formula: 'IT-213 per-child amounts or 33% of unused CTC',
      inputs: [],
    });
  }
  if (nyDependentCareCredit > 0) {
    creditChildren.push({
      lineId: 'state.credits.depCare', label: 'NY Dependent Care Credit', value: nyDependentCareCredit,
      formula: 'Percentage of federal dependent care credit',
      inputs: [{ lineId: 'federal.depCare', label: 'Federal Dep. Care Credit', value: federalDepCareCredit }],
    });
  }
  const totalNYSCreditsForTrace = nysNonrefundable + nysRefundable;
  tb.trace(
    'state.credits', 'New York Credits',
    totalNYSCreditsForTrace, {
      formula: 'Nonrefundable + Refundable NYS Credits',
      inputs: [
        ...(nysNonrefundable > 0 ? [{ lineId: 'state.credits.nonrefundable', label: 'Nonrefundable', value: nysNonrefundable }] : []),
        ...(nysRefundable > 0 ? [{ lineId: 'state.credits.refundable', label: 'Refundable', value: nysRefundable }] : []),
      ],
      children: creditChildren.length > 0 ? creditChildren : undefined,
    },
  );

  // ── Step 7: NYC / Yonkers Tax ────────────────
  let localTax = 0;
  let nycTaxGross = 0;

  // NYC credit accumulators
  let nycHouseholdCredit = 0;
  let nycSchoolTaxCreditFixed = 0;
  let nycSchoolTaxCreditReduction = 0;
  let nycTaxEliminationCredit = 0;
  let nycEITC = 0;

  // NYC refundable/nonrefundable split
  let nycNonrefundable = 0;
  let nycRefundable = 0;

  if (isNYCResident) {
    const nycBrackets = NYC_BRACKETS[filingKey] || NYC_BRACKETS['single'];
    const nycBracketsResult = applyBrackets(taxableIncome, nycBrackets);
    nycTaxGross = nycBracketsResult.tax;
    const nycBracketDetails = nycBracketsResult.details;

    // NYC nonrefundable credits
    nycTaxEliminationCredit = calculateNYCTaxEliminationCredit(taxReturn, nycTaxGross, federalAGI, filingKey);
    nycHouseholdCredit = calculateNYCHouseholdCredit(nyAGI, taxReturn.filingStatus, numDependents);
    const isClaimedAsDependent = taxReturn.canBeClaimedAsDependent === true;
    const schoolTaxCredit = calculateNYCSchoolTaxCredit(
      taxableIncome, nyAGI, filingKey, isClaimedAsDependent,
    );
    nycSchoolTaxCreditFixed = schoolTaxCredit.fixed;
    nycSchoolTaxCreditReduction = schoolTaxCredit.rateReduction;

    // NYC refundable credits
    nycEITC = calculateNYCEITC(federalEITC);

    nycNonrefundable = nycTaxEliminationCredit + nycHouseholdCredit
      + nycSchoolTaxCreditFixed + nycSchoolTaxCreditReduction;
    nycRefundable = nycEITC + nycDependentCareCredit;

    const nycAfterNonrefundable = Math.max(0, round2(nycTaxGross - nycNonrefundable));
    localTax = nycAfterNonrefundable;

    // ── Trace: NYC local tax with bracket children ──
    const nycBracketChildren: CalculationTrace[] = nycBracketDetails
      .filter(b => b.taxAtRate > 0)
      .map(b => ({
        lineId: `state.local.bracket.${(b.rate * 100).toFixed(2)}pct`,
        label: `${(b.rate * 100).toFixed(2)}% NYC bracket`,
        value: b.taxAtRate,
        formula: `${b.taxableAtRate.toLocaleString()} x ${(b.rate * 100).toFixed(2)}%`,
        inputs: [{ lineId: 'state.local.bracket.taxableAtRate', label: `Income at ${(b.rate * 100).toFixed(2)}%`, value: b.taxableAtRate }],
      }));
    const totalNYCCreditsForTrace = nycNonrefundable + nycRefundable;
    if (totalNYCCreditsForTrace > 0) {
      if (nycTaxEliminationCredit > 0) {
        nycBracketChildren.push({
          lineId: 'state.local.nycTaxElimination', label: 'NYC Tax Elimination Credit', value: -nycTaxEliminationCredit,
          formula: 'IT-270 poverty-based credit',
          inputs: [],
        });
      }
      if (nycHouseholdCredit > 0) {
        nycBracketChildren.push({
          lineId: 'state.local.nycHouseholdCredit', label: 'NYC Household Credit', value: -nycHouseholdCredit,
          formula: 'NYC household credit (AGI-based)',
          inputs: [],
        });
      }
      if (nycSchoolTaxCreditFixed > 0 || nycSchoolTaxCreditReduction > 0) {
        nycBracketChildren.push({
          lineId: 'state.local.nycSchoolTaxCredit', label: 'NYC School Tax Credit',
          value: -(nycSchoolTaxCreditFixed + nycSchoolTaxCreditReduction),
          formula: 'Fixed amount + Rate reduction amount',
          inputs: [],
        });
      }
      if (nycEITC > 0) {
        nycBracketChildren.push({
          lineId: 'state.local.nycEITC', label: 'NYC EITC (10%)', value: -nycEITC,
          formula: `Federal EITC x 10% (refundable)`,
          inputs: [{ lineId: 'federal.eitc', label: 'Federal EITC', value: federalEITC }],
        });
      }
      if (nycDependentCareCredit > 0) {
        nycBracketChildren.push({
          lineId: 'state.local.nycDepCare', label: 'NYC Dependent Care Credit', value: -nycDependentCareCredit,
          formula: '75% of NYS dependent care credit (refundable)',
          inputs: [],
        });
      }
    }
    tb.trace('state.localTax', 'NYC Income Tax', localTax, {
      formula: nycNonrefundable > 0 ? 'NYC Bracket Tax - NYC Nonrefundable Credits' : 'NYC Bracket Tax',
      inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
      children: nycBracketChildren.length > 0 ? nycBracketChildren : undefined,
    });
  } else if (isYonkersResident) {
    // Yonkers surcharge uses NYS tax after NONREFUNDABLE credits only (correct per IT-201 p.17)
    localTax = round2(nysAfterNonrefundable * YONKERS_RESIDENT_SURCHARGE_RATE);

    tb.trace('state.localTax', 'Yonkers Resident Surcharge', localTax, {
      formula: `NYS Tax After Nonrefundable Credits x ${(YONKERS_RESIDENT_SURCHARGE_RATE * 100).toFixed(2)}%`,
      inputs: [{ lineId: 'state.nysAfterCredits', label: 'NYS Tax After Nonref. Credits', value: nysAfterNonrefundable }],
    });
  }

  // ── MCTMT ──
  const mctmt = calculateMCTMT(federalResult, stateData, isNYCResident);

  // ── Step 8: Total, Refundable Credits & Payments ──
  // Total tax = NYS after nonrefundable + local tax + MCTMT
  const totalStateTax = tb.trace(
    'state.totalTax', 'New York Total Tax',
    round2(nysAfterNonrefundable + localTax + mctmt), {
      authority: refs?.totalTaxLine,
      formula: [
        'NYS Tax After Nonrefundable Credits',
        localTax > 0 ? '+ Local Tax' : '',
        mctmt > 0 ? '+ MCTMT' : '',
      ].filter(Boolean).join(' '),
      inputs: [
        { lineId: 'state.incomeTax', label: 'NYS Tax Before Credits', value: nysTax },
        ...(nysNonrefundable > 0 ? [{ lineId: 'state.credits.nonrefundable', label: 'NYS Nonrefundable Credits', value: nysNonrefundable }] : []),
        ...(localTax > 0 ? [{ lineId: 'state.localTax', label: 'Local Tax', value: localTax }] : []),
        ...(mctmt > 0 ? [{ lineId: 'state.mctmt', label: 'MCTMT', value: mctmt }] : []),
      ],
    },
  );

  // Total refundable credits (NYS + NYC)
  const totalRefundable = round2(nysRefundable + nycRefundable);

  const stateWithholding = getStateWithholding(taxReturn, 'NY');
  const estimatedPayments = typeof stateData.estimatedPayments === 'number'
    ? stateData.estimatedPayments : 0;
  const totalPayments = stateWithholding + estimatedPayments;

  // Refund/owed = payments - tax + refundable credits
  const refundOrOwedRaw = round2(totalPayments - totalStateTax + totalRefundable);
  const refundOrOwed = tb.trace(
    'state.refundOrOwed',
    refundOrOwedRaw >= 0 ? 'New York Refund' : 'New York Amount Owed',
    refundOrOwedRaw, {
      authority: refs?.refundLine,
      formula: 'Withholding + Estimated Payments - Total Tax + Refundable Credits',
      inputs: [
        { lineId: 'state.totalTax', label: 'Total State Tax', value: totalStateTax },
        ...(stateWithholding > 0 ? [{ lineId: 'state.withholding', label: 'Withholding', value: stateWithholding }] : []),
        ...(estimatedPayments > 0 ? [{ lineId: 'state.estimatedPayments', label: 'Estimated Payments', value: estimatedPayments }] : []),
        ...(totalRefundable > 0 ? [{ lineId: 'state.refundableCredits', label: 'Refundable Credits', value: totalRefundable }] : []),
      ],
    },
  );

  const effectiveRate = federalAGI > 0
    ? Math.round((totalStateTax / federalAGI) * 10000) / 10000
    : 0;

  // stateCredits = nonrefundable only (for backward compat with result schema)
  const totalNonrefundable = nysNonrefundable + nycNonrefundable;

  return {
    stateCode: 'NY',
    stateName: getStateName('NY'),
    residencyType: config.residencyType,
    federalAGI,
    stateAdditions: additions,
    stateSubtractions: subtractions,
    stateAGI: nyAGI,
    stateDeduction: deduction,
    stateTaxableIncome: taxableIncome,
    stateExemptions: exemptions,
    stateIncomeTax: nysAfterNonrefundable,
    stateCredits: totalNonrefundable,
    stateTaxAfterCredits: nysAfterNonrefundable,
    localTax,
    totalStateTax,
    stateWithholding,
    stateEstimatedPayments: estimatedPayments,
    stateRefundOrOwed: refundOrOwed,
    effectiveStateRate: effectiveRate,
    bracketDetails,
    additionalLines: {
      nysTaxBeforeCredits: nysTax,
      householdCredit,
      empireStateChildCredit,
      nyDependentCareCredit,
      nyEITC,
      collegeTuitionCredit,
      nycTaxEliminationCredit,
      nycHouseholdCredit,
      nycSchoolTaxCreditFixed,
      nycSchoolTaxCreditReduction,
      nycDependentCareCredit,
      nycEITC,
      ...(isNYCResident ? { nycTax: localTax, nycTaxGross } : {}),
      ...(isYonkersResident ? { yonkersTax: localTax } : {}),
      mctmt,
      totalRefundable,
    },
    traces: tb.build(),
  };
}

// ─── Main Calculator (thin wrapper) ─────────────────────────────

export function calculateNewYork(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): StateCalculationResult {
  return computeNYCoreTax(taxReturn, federalResult, config);
}
