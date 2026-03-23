/**
 * Form 1040 Section Sub-Orchestrators
 *
 * Extracted from the monolithic calculateForm1040() function for maintainability.
 * Each function handles one logical section of the Form 1040 calculation and
 * mutates the shared Form1040Context accumulator.
 *
 * The main orchestrator in form1040.ts calls these in order:
 *   1. calculateIncomeSection
 *   2. calculateSelfEmploymentSection
 *   3. calculateCapitalAssetsSection
 *   4. calculatePreliminaryIncomeSection
 *   5. calculateAdjustmentsSection
 *   6. calculateDeductionsSection
 *   7. calculateIncomeTaxSection
 *   8. calculateAdditionalTaxesSection
 *   9. calculateCreditsSection
 *  10. calculateLiabilitySection
 *  11. assembleForm1040Result (output builder)
 */

import {
  FilingStatus, TaxReturn, CalculationResult, Income1099B,
  ScheduleCResult, ScheduleSEResult, ScheduleAResult, ScheduleDResult,
  SocialSecurityResult, ScheduleEResult, ScheduleFResult, ScheduleRResult,
  DependentCareResult, SaversCreditResult, CleanEnergyResult,
  EVCreditResult, EnergyEfficiencyResult, ForeignTaxCreditResult,
  AdoptionCreditResult, EstimatedTaxPenaltyResult, ScheduleHResult,
  PremiumTaxCreditResult, Schedule1AResult, HomeSaleResult,
  Form982Result, InvestmentInterestResult, Form5329Result,
  EVRefuelingCreditResult, Form4797Result, Form4797Property, Form4137Result, HoHValidationResult,
  RentalProperty,
  DeceasedSpouseValidationResult,
  CreditsResult, Form1040Result, Form7206Result, ArcherMSAResult,
  Solo401kResult, SEPIRAResult, HSAContributionInfo,
  ScholarshipCreditResult, Form8801Result,
} from '../types/index.js';
import { STANDARD_DEDUCTION_2025, ADDITIONAL_STANDARD_DEDUCTION, DEPENDENT_STANDARD_DEDUCTION, STUDENT_LOAN_INTEREST, IRA, EARLY_DISTRIBUTION, EDUCATOR_EXPENSES, EXCESS_SS_TAX, ALIMONY, NOL, DEPENDENT_CARE_FSA, DISTRIBUTION_529, FORM_4137, QCD, SE_TAX } from '../constants/tax2025.js';
import { calculateScheduleC } from './scheduleC.js';
import { calculateScheduleSE } from './scheduleSE.js';
import { calculateScheduleA } from './scheduleA.js';
import { calculateProgressiveTax, traceProgressiveTax, getMarginalRate } from './brackets.js';
import { calculatePreferentialRateTax } from './capitalGains.js';
import { calculateCredits } from './credits.js';
import { calculateQBIDeduction, calculateMultiBusinessQBIDeduction } from './qbi.js';
import { calculateEstimatedQuarterly } from './estimatedTax.js';
import { calculateEITC } from './eitc.js';
import { calculateNIIT } from './niit.js';
import { calculateAdditionalMedicareTaxW2 } from './additionalMedicare.js';
import { calculateScheduleD } from './scheduleD.js';
import { calculateTaxableSocialSecurity } from './socialSecurity.js';
import { calculateScheduleE } from './scheduleE.js';
import { calculateDependentCareCredit } from './dependentCare.js';
import { calculateSaversCredit } from './saversCredit.js';
import { calculateCleanEnergyCredit } from './cleanEnergy.js';
import { calculateEVCredit } from './evCredit.js';
import { calculateEnergyEfficiencyCredit } from './energyEfficiency.js';
import { calculateForeignTaxCredit } from './foreignTaxCredit.js';
import { aggregateK1Income, K1RoutingResult } from './k1.js';
import { aggregateHSADistributions } from './hsaDistributions.js';
import { calculateHSADeduction } from './hsaForm8889.js';
import { calculateForm8606, Form8606Result } from './form8606.js';
import type { Form8606Info } from '../types/index.js';
import { calculateEstimatedTaxPenalty } from './estimatedTaxPenalty.js';
import { calculateKiddieTax, KiddieTaxResult } from './kiddieTax.js';
import { calculateFEIE, FEIEResult } from './feie.js';
import { calculateScheduleH } from './scheduleH.js';
import { calculateAdoptionCredit } from './adoptionCredit.js';
import { calculateEVRefuelingCredit } from './form8911.js';
import { calculatePremiumTaxCredit, calculatePTCHouseholdIncome } from './premiumTaxCredit.js';
import { calculateSchedule1A } from './schedule1A.js';
import { calculateHomeSaleExclusion } from './homeSale.js';
import { calculateCancellationOfDebt, applyAttributeReduction } from './cancellationOfDebt.js';
import { calculateInvestmentInterest } from './investmentInterest.js';
import { calculateForm5329 } from './form5329.js';
import { calculateSimplifiedMethod } from './simplifiedMethod.js';
import { calculateScholarshipCredit } from './scholarshipCredit.js';
import { calculateForm4797 } from './form4797.js';
import { calculateForm4684 } from './form4684.js';
import { calculateForm6252 } from './form6252.js';
import { calculateForm4137 } from './form4137.js';
import { calculateScheduleF } from './scheduleF.js';
import { calculateScheduleR } from './scheduleR.js';
import { calculateForm8801Credit } from './form8801.js';
import { calculateArcherMSADeduction } from './archerMSA.js';
import { calculateSolo401kLimits, calculateSEPIRALimits } from './solo401k.js';
import { calculateForm7206, legacyToForm7206Input } from './form7206.js';
import { calculateAMT, adjustAMTForRegularFTC, AMTResult } from './amt.js';
import { calculateForm8582 } from './form8582.js';
import type { Form8582Result } from '../types/index.js';
import { hasRetirementPlanCoverage, totalSalaryDeferrals, totalEmployerHSAContributions } from './w2Helpers.js';
import type { TraceOptions, CalculationTrace } from '../types/index.js';
import type { TraceBuilder } from './traceBuilder.js';
import { round2, parseDateString } from './utils.js';

// ─── Shared Utilities ─────────────────────────────────────

/**
 * Coerce non-finite numeric values (NaN, Infinity, null, undefined) to 0.
 */
export function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// getTotalAPTCFromReturn removed — Pub 974 iteration now resolves
// the SE health ↔ PTC circularity directly (see Section 4).

// ─── Form1040Context ──────────────────────────────────────

/**
 * Mutable accumulator passed between section sub-orchestrators.
 * Each section reads what it needs and writes its outputs here.
 */
export interface Form1040Context {
  // ── Inputs (set once by orchestrator) ─────────────
  taxReturn: TaxReturn;
  filingStatus: FilingStatus;
  tb: TraceBuilder;
  traceOptions?: TraceOptions;

  // ── Filing status validation ──────────────────────
  hohValidation?: HoHValidationResult;
  deceasedSpouseValidation?: DeceasedSpouseValidationResult;

  // ── Section 1: Income ─────────────────────────────
  scheduleC?: ScheduleCResult;
  scheduleCNetProfit: number;
  scheduleFResult?: ScheduleFResult;
  scheduleFNetProfit: number;
  totalWages: number;
  totalInterest: number;
  totalOrdinaryDividends: number;
  totalQualifiedDividends: number;
  totalCapitalGainDistributions: number;
  otherIncome: number;
  iraDistributionsGross: number;
  iraDistributionsTaxable: number;
  totalQCD: number;                 // Total Qualified Charitable Distributions (IRC §408(d)(8))
  regularIRADistForForm8606: number; // Preserved for Form 8606 reconciliation in adjustments section
  pensionDistributionsGross: number;
  pensionDistributionsTaxable: number;
  totalRetirementIncome: number;
  totalUnemployment: number;
  total1099MISCIncome: number;
  misc1099Rents: number;           // 1099-MISC Box 1 rents → Schedule E
  misc1099Royalties: number;       // 1099-MISC Box 2 royalties → Schedule E
  totalGamblingIncome: number;
  form982Result?: Form982Result;
  cancellationOfDebtIncome: number;
  alimonyReceivedIncome: number;
  taxable529Income: number;
  penalty529: number;
  k1Routing?: K1RoutingResult;
  k1OrdinaryIncome: number;
  k1Interest: number;
  k1OrdinaryDividends: number;
  k1QualifiedDividends: number;
  k1ShortTermGain: number;
  k1LongTermGain: number;
  k1RentalIncome: number;
  k1Royalties: number;
  k1QBI: number;
  k1Section179Deduction: number;
  // Box 13 — Partner's deductions
  k1CharitableCash: number;
  k1CharitableNonCash: number;
  k1InvestmentInterestExpense: number;
  k1OtherDeductions: number;
  // Box 15 — Partner's credits
  k1ForeignTaxPaid: number;
  k1OtherCredits: number;
  hsaDistResult?: { totalTaxable: number; totalPenalty: number };
  hsaDistributionTaxable: number;
  hsaDistributionPenalty: number;
  hsaExcessWithdrawalEarnings: number; // Earnings on withdrawn HSA excess — taxable as Other income
  iraExcessWithdrawalEarnings: number; // Earnings on withdrawn IRA excess — taxable as Other income

  // ── Section 2: Self-Employment ────────────────────
  scheduleSE?: ScheduleSEResult;
  seDeductibleHalf: number;
  k1SEIncome: number;
  totalSENetProfit: number;
  w2SSWages: number;
  solo401kResult?: Solo401kResult;
  solo401kTotalContribution: number;
  sepIRAResult?: SEPIRAResult;
  sepIRATotalContribution: number;
  simpleIraTotalContribution: number;
  taxpayerAge?: number;

  // ── Section 3: Capital Assets ─────────────────────
  homeSaleResult?: HomeSaleResult;
  homeSaleTaxableGain: number;
  scheduleD?: ScheduleDResult;
  form4797Result?: Form4797Result;
  form4797OrdinaryIncome: number;
  form4797Section1231GainOrLoss: number;
  form4797Unrecaptured1250: number;
  form4797LTCGContribution: number;
  scheduleDNetGain: number;
  capitalLossDeduction: number;
  scheduleDLongTermGain: number;

  // ── Section 4: Preliminary Income ─────────────────
  allInterest: number;
  allOrdinaryDividends: number;
  allQualifiedDividends: number;
  form4797OrdinaryLoss: number;
  dcFSATaxableExcess: number;    // IRC §129: employer DC benefits over $5k/$2.5k → taxable
  incomeBeforeSS: number;
  taxExemptInterest: number;
  socialSecurityResult?: SocialSecurityResult;
  taxableSocialSecurity: number;
  scheduleEResult?: ScheduleEResult;
  form8582Result?: Form8582Result;
  scheduleEIncome: number;
  k1PassiveSuspendedAdj: number;  // Adjustment: suspended K-1 passive losses already in incomeBeforeSS
  feieResult?: FEIEResult;
  feieExclusion: number;
  totalIncome: number;

  // ── Section 5: Adjustments ────────────────────────
  selfEmployedHealthInsurance: number;
  form7206Result?: Form7206Result;
  hsaDeduction: number;
  archerMSADeduction: number;
  archerMSAResult?: ArcherMSAResult;
  movingExpenses: number;           // Form 3903 — military only (Schedule 1 Line 14)
  studentLoanInterest: number;
  iraDeduction: number;
  educatorExpenses: number;
  earlyWithdrawalPenalty: number;
  alimonyDeduction: number;
  retirementContributions: number;
  totalAdjustments: number;
  agi: number;

  // ── Section 6: Deductions ─────────────────────────
  standardDeduction: number;
  scheduleA?: ScheduleAResult;
  itemizedDeduction: number;
  investmentInterestResult?: InvestmentInterestResult;
  investmentInterestDeduction: number;
  deductionUsed: 'standard' | 'itemized';
  deductionAmount: number;
  qbiDeduction: number;
  nolDeduction: number;
  schedule1AResult?: Schedule1AResult;
  schedule1ADeduction: number;
  taxableIncome: number;

  // ── Section 7: Income Tax ─────────────────────────
  incomeTax: number;
  preferentialTax: number;
  section1250Tax: number;
  marginalTaxRate: number;
  amtResult?: AMTResult;
  amtAmount: number;

  // ── Section 8: Additional Taxes ───────────────────
  seTax: number;
  niitTax: number;
  additionalMedicareTaxW2: number;
  earlyDistributionPenalty: number;
  kiddieTaxResults: KiddieTaxResult[];
  kiddieTaxAmount: number;
  scheduleHResult?: ScheduleHResult;
  scheduleHTax: number;
  form5329Result?: Form5329Result;
  excessContributionPenalty: number;
  form4137Result?: Form4137Result;
  form4137Tax: number;
  totalTaxBeforeCredits: number;
  totalTax: number;

  // ── Section 9: Credits ────────────────────────────
  credits: CreditsResult;
  earnedIncome: number;
  dependentCareResult?: DependentCareResult;
  saversCreditResult?: SaversCreditResult;
  cleanEnergyResult?: CleanEnergyResult;
  evCreditResult?: EVCreditResult;
  energyEfficiencyResult?: EnergyEfficiencyResult;
  foreignTaxCreditResult?: ForeignTaxCreditResult;
  totalForeignTaxPaid: number;
  adoptionCreditResult?: AdoptionCreditResult;
  evRefuelingResult?: EVRefuelingCreditResult;
  scholarshipCreditResult?: ScholarshipCreditResult;
  scheduleRResult?: ScheduleRResult;
  form8801Result?: Form8801Result;
  ptcResult?: PremiumTaxCreditResult;
  premiumTaxCreditNet: number;
  excessAPTCRepayment: number;

  // ── Section 10: Liability ─────────────────────────
  taxAfterNonRefundable: number;
  taxAfterCredits: number;
  w2Withholding: number;
  form1099Withholding: number;
  form8959WithholdingCredit: number;  // Form 8959 Part III — excess Medicare tax withheld over regular 1.45% rate
  totalWithholding: number;
  estimatedPayments: number;
  totalPayments: number;
  estimatedTaxPenaltyResult?: EstimatedTaxPenaltyResult;
  estimatedTaxPenalty: number;
  form8606Result?: Form8606Result;
  balance: number;
  amountOwed: number;
  refundAmount: number;
  refundAppliedToNextYear: number;
  netRefund: number;
  effectiveTaxRate: number;
  quarterlyPayment: number;
}

/**
 * Create a fresh context with all numeric fields initialized to 0.
 */
export function createForm1040Context(
  taxReturn: TaxReturn,
  filingStatus: FilingStatus,
  tb: TraceBuilder,
  traceOptions?: TraceOptions,
): Form1040Context {
  return {
    taxReturn,
    filingStatus,
    tb,
    traceOptions,

    // All numeric fields default to 0
    scheduleCNetProfit: 0,
    scheduleFNetProfit: 0,
    totalWages: 0,
    totalInterest: 0,
    totalOrdinaryDividends: 0,
    totalQualifiedDividends: 0,
    totalCapitalGainDistributions: 0,
    otherIncome: 0,
    iraDistributionsGross: 0,
    iraDistributionsTaxable: 0,
    totalQCD: 0,
    regularIRADistForForm8606: 0,
    pensionDistributionsGross: 0,
    pensionDistributionsTaxable: 0,
    totalRetirementIncome: 0,
    totalUnemployment: 0,
    total1099MISCIncome: 0,
    misc1099Rents: 0,
    misc1099Royalties: 0,
    totalGamblingIncome: 0,
    cancellationOfDebtIncome: 0,
    alimonyReceivedIncome: 0,
    taxable529Income: 0,
    penalty529: 0,
    k1OrdinaryIncome: 0,
    k1Interest: 0,
    k1OrdinaryDividends: 0,
    k1QualifiedDividends: 0,
    k1ShortTermGain: 0,
    k1LongTermGain: 0,
    k1RentalIncome: 0,
    k1Royalties: 0,
    k1QBI: 0,
    k1Section179Deduction: 0,
    k1CharitableCash: 0,
    k1CharitableNonCash: 0,
    k1InvestmentInterestExpense: 0,
    k1OtherDeductions: 0,
    k1ForeignTaxPaid: 0,
    k1OtherCredits: 0,
    hsaDistributionTaxable: 0,
    hsaDistributionPenalty: 0,
    hsaExcessWithdrawalEarnings: 0,
    iraExcessWithdrawalEarnings: 0,
    seDeductibleHalf: 0,
    k1SEIncome: 0,
    totalSENetProfit: 0,
    w2SSWages: 0,
    solo401kTotalContribution: 0,
    sepIRATotalContribution: 0,
    simpleIraTotalContribution: 0,
    homeSaleTaxableGain: 0,
    form4797OrdinaryIncome: 0,
    form4797Section1231GainOrLoss: 0,
    form4797Unrecaptured1250: 0,
    form4797LTCGContribution: 0,
    scheduleDNetGain: 0,
    capitalLossDeduction: 0,
    scheduleDLongTermGain: 0,
    allInterest: 0,
    allOrdinaryDividends: 0,
    allQualifiedDividends: 0,
    form4797OrdinaryLoss: 0,
    dcFSATaxableExcess: 0,
    incomeBeforeSS: 0,
    taxExemptInterest: 0,
    taxableSocialSecurity: 0,
    scheduleEIncome: 0,
    k1PassiveSuspendedAdj: 0,
    feieExclusion: 0,
    totalIncome: 0,
    selfEmployedHealthInsurance: 0,
    hsaDeduction: 0,
    archerMSADeduction: 0,
    movingExpenses: 0,
    studentLoanInterest: 0,
    iraDeduction: 0,
    educatorExpenses: 0,
    earlyWithdrawalPenalty: 0,
    alimonyDeduction: 0,
    retirementContributions: 0,
    totalAdjustments: 0,
    agi: 0,
    standardDeduction: 0,
    itemizedDeduction: 0,
    investmentInterestDeduction: 0,
    deductionUsed: 'standard',
    deductionAmount: 0,
    qbiDeduction: 0,
    nolDeduction: 0,
    schedule1ADeduction: 0,
    taxableIncome: 0,
    incomeTax: 0,
    preferentialTax: 0,
    section1250Tax: 0,
    marginalTaxRate: 0,
    amtAmount: 0,
    seTax: 0,
    niitTax: 0,
    additionalMedicareTaxW2: 0,
    earlyDistributionPenalty: 0,
    kiddieTaxResults: [],
    kiddieTaxAmount: 0,
    scheduleHTax: 0,
    excessContributionPenalty: 0,
    form4137Tax: 0,
    totalTaxBeforeCredits: 0,
    totalTax: 0,
    credits: {
      childTaxCredit: 0,
      otherDependentCredit: 0,
      actcCredit: 0,
      educationCredit: 0,
      aotcRefundableCredit: 0,
      dependentCareCredit: 0,
      saversCredit: 0,
      cleanEnergyCredit: 0,
      evCredit: 0,
      energyEfficiencyCredit: 0,
      foreignTaxCredit: 0,
      excessSSTaxCredit: 0,
      adoptionCredit: 0,
      evRefuelingCredit: 0,
      elderlyDisabledCredit: 0,
      scholarshipCredit: 0,
      priorYearMinTaxCredit: 0,
      k1OtherCredits: 0,
      eitcCredit: 0,
      premiumTaxCredit: 0,
      totalNonRefundable: 0,
      totalRefundable: 0,
      totalCredits: 0,
    },
    earnedIncome: 0,
    totalForeignTaxPaid: 0,
    premiumTaxCreditNet: 0,
    excessAPTCRepayment: 0,
    taxAfterNonRefundable: 0,
    taxAfterCredits: 0,
    w2Withholding: 0,
    form1099Withholding: 0,
    form8959WithholdingCredit: 0,
    totalWithholding: 0,
    estimatedPayments: 0,
    totalPayments: 0,
    estimatedTaxPenalty: 0,
    balance: 0,
    amountOwed: 0,
    refundAmount: 0,
    refundAppliedToNextYear: 0,
    netRefund: 0,
    effectiveTaxRate: 0,
    quarterlyPayment: 0,
  };
}

// ─── Section 1: Income ────────────────────────────────────

export function calculateIncomeSection(ctx: Form1040Context): void {
  const { taxReturn } = ctx;

  // Schedule C (if self-employed)
  const hasSelfEmployment =
    taxReturn.income1099NEC.length > 0 ||
    taxReturn.income1099K.length > 0 ||
    !!taxReturn.business ||
    (taxReturn.businesses && taxReturn.businesses.length > 0);
  ctx.scheduleC = hasSelfEmployment
    ? calculateScheduleC(taxReturn)
    : undefined;
  ctx.scheduleCNetProfit = ctx.scheduleC?.netProfit || 0;

  // Schedule F (if farming)
  if (taxReturn.scheduleF) {
    ctx.scheduleFResult = calculateScheduleF(taxReturn.scheduleF);
    ctx.scheduleFNetProfit = ctx.scheduleFResult.netFarmProfit;
  }

  // Statutory employee W-2s: Box 13 statutory employee checked → wages go to Schedule C, not Line 1a.
  // Withholding and SS/Medicare from statutory W-2s are still included normally.
  const statutoryW2Income = taxReturn.w2Income
    .filter(w => w.box13?.statutoryEmployee === true)
    .reduce((sum, w) => sum + (w.wages || 0), 0);
  if (statutoryW2Income > 0) {
    ctx.scheduleCNetProfit = round2(ctx.scheduleCNetProfit + statutoryW2Income);
  }

  // Income — exclude statutory employee wages from Line 1a (they're on Schedule C)
  ctx.totalWages = taxReturn.w2Income
    .filter(w => w.box13?.statutoryEmployee !== true)
    .reduce((sum, w) => sum + (w.wages || 0), 0);
  // 1099-INT interest + 1099-OID (OID + other periodic interest, reduced by acquisition premium)
  const intInterest = taxReturn.income1099INT.reduce((sum, i) => sum + (i.amount || 0), 0);
  const oidInterest = (taxReturn.income1099OID || []).reduce((sum, o) => {
    const oid = Math.max(0, (o.originalIssueDiscount || 0) - (o.acquisitionPremium || 0));
    return sum + oid + (o.otherPeriodicInterest || 0);
  }, 0);
  ctx.totalInterest = round2(intInterest + oidInterest);
  ctx.totalOrdinaryDividends = taxReturn.income1099DIV.reduce((sum, i) => sum + (i.ordinaryDividends || 0), 0);
  ctx.totalQualifiedDividends = taxReturn.income1099DIV.reduce((sum, i) => sum + (i.qualifiedDividends || 0), 0);
  ctx.totalCapitalGainDistributions = taxReturn.income1099DIV.reduce(
    (sum, i) => sum + (i.capitalGainDistributions || 0), 0,
  );
  ctx.otherIncome = safeNum(taxReturn.otherIncome);

  // Form 6252 — Installment sale income (flows to Schedule 1 other income)
  const installmentSaleIncome = (taxReturn.installmentSales || []).reduce((sum, sale) => {
    const result = calculateForm6252(sale);
    return sum + result.installmentSaleIncome;
  }, 0);
  if (installmentSaleIncome > 0) {
    ctx.otherIncome = round2(ctx.otherIncome + installmentSaleIncome);
  }

  // 1099-R (retirement distributions)
  ctx.totalRetirementIncome = (taxReturn.income1099R || []).reduce((sum, r) => {
    const code = (r.distributionCode || '7').toUpperCase();
    const gross = safeNum(r.grossDistribution);
    let taxable = safeNum(r.taxableAmount);
    // G = direct rollover, T = Roth IRA (5-year rule met), Q = qualified Roth (age 59½+)
    const isRolloverOrRoth = ['G', 'T', 'Q'].includes(code);

    // Simplified Method — IRS Pub 939: compute taxable portion for pension distributions
    // when the payer didn't determine Box 2a (or user elects to use Simplified Method).
    if (r.useSimplifiedMethod && r.simplifiedMethod && !r.isIRA) {
      const smResult = calculateSimplifiedMethod({
        monthlyPayment: gross / Math.max(1, r.simplifiedMethod.paymentsThisYear),
        totalContributions: r.simplifiedMethod.totalContributions,
        ageAtStartDate: r.simplifiedMethod.ageAtStartDate,
        isJointAndSurvivor: r.simplifiedMethod.isJointAndSurvivor,
        combinedAge: r.simplifiedMethod.combinedAge,
        paymentsThisYear: r.simplifiedMethod.paymentsThisYear,
        priorYearTaxFreeRecovery: r.simplifiedMethod.priorYearTaxFreeRecovery,
      });
      taxable = smResult.taxableAmount;
    }

    // Roth IRA basis recovery: for non-qualified Roth distributions (Code 1, J, etc.),
    // the portion up to total Roth contributions (basis) is always tax-free per IRC §408A(d)(4).
    // Box 2a may already reflect this, but if the user provides rothContributionBasis
    // we recalculate to ensure correctness.
    if (r.isRothIRA && r.rothContributionBasis && r.rothContributionBasis > 0 && !isRolloverOrRoth) {
      // Taxable = gross minus basis (contributions are always recovered tax-free first)
      // But never less than zero
      taxable = round2(Math.max(0, gross - r.rothContributionBasis));
    }

    // QCD: accumulate qualified charitable distribution amounts from traditional IRA entries.
    // QCDs are included in Line 4a (gross) but excluded from Line 4b (taxable).
    // IRC §408(d)(8) — only traditional IRAs, not Roth.
    const qcd = (r.isIRA && !r.isRothIRA && !isRolloverOrRoth) ? safeNum(r.qcdAmount) : 0;
    ctx.totalQCD += Math.min(qcd, gross); // QCD can't exceed distribution amount

    if (r.isIRA) {
      ctx.iraDistributionsGross += gross;
      if (!isRolloverOrRoth) ctx.iraDistributionsTaxable += taxable;
    } else {
      ctx.pensionDistributionsGross += gross;
      if (!isRolloverOrRoth) ctx.pensionDistributionsTaxable += taxable;
    }

    if (isRolloverOrRoth) return sum;
    return sum + taxable;
  }, 0);

  // Form 8606 — Roth conversion (must be computed after 1099-R but before income totals)
  // The taxable conversion amount flows to Form 1040 lines 4a/4b and total income.
  // Two patterns: (1) conversion has its own 1099-R → adjust taxable via pro-rata,
  //               (2) conversion is standalone in form8606 → add as new income.
  if (taxReturn.form8606) {
    const conversionGross = Math.max(0, taxReturn.form8606.rothConversionAmount || 0);

    // Detect if the conversion is already represented by an IRA 1099-R entry
    // (real conversions generate a 1099-R; some data models include both)
    const conversionIn1099R = conversionGross > 0 && (taxReturn.income1099R || []).some(r =>
      r.isIRA && Math.abs(safeNum(r.grossDistribution) - conversionGross) < 1,
    );

    // Regular (non-conversion) IRA distributions for Form 8606 Line 7 pro-rata denominator.
    // QCDs bypass the pro-rata rule (Notice 2007-7, Q&A-36) — exclude them from the denominator.
    const cappedQCD = Math.min(ctx.totalQCD, QCD.MAX_AMOUNT);
    const regularIRADist = conversionIn1099R
      ? Math.max(0, ctx.iraDistributionsGross - conversionGross - cappedQCD)
      : Math.max(0, ctx.iraDistributionsGross - cappedQCD);

    // Save for potential reconciliation after IRA deduction phase-out (Bug #2 fix)
    ctx.regularIRADistForForm8606 = regularIRADist;

    ctx.form8606Result = calculateForm8606(taxReturn.form8606, regularIRADist);
    const conversionTaxable = ctx.form8606Result.taxableConversion;

    if (conversionIn1099R) {
      // Conversion already in 1099-R — Form 8606 pro-rata overrides box 2a taxable amount
      const taxableAdjustment = conversionTaxable - conversionGross;
      ctx.iraDistributionsTaxable += taxableAdjustment;
      ctx.totalRetirementIncome += taxableAdjustment;
    } else {
      // Conversion NOT in 1099-R — add as new income on lines 4a/4b
      ctx.iraDistributionsGross += conversionGross;
      ctx.iraDistributionsTaxable += conversionTaxable;
      ctx.totalRetirementIncome += conversionTaxable;
    }

    // Form 8606 Line 12: reduce regular IRA distributions by non-taxable pro-rata portion
    if (ctx.form8606Result.nonTaxableDistributions > 0) {
      ctx.iraDistributionsTaxable -= ctx.form8606Result.nonTaxableDistributions;
      ctx.totalRetirementIncome -= ctx.form8606Result.nonTaxableDistributions;
      ctx.iraDistributionsTaxable = Math.max(0, ctx.iraDistributionsTaxable);
    }
  }

  // QCD: exclude qualified charitable distributions from taxable IRA income.
  // QCDs reduce Line 4b (taxable) but NOT Line 4a (gross). IRC §408(d)(8).
  // Applied after Form 8606 so pro-rata is computed on non-QCD distributions only.
  if (ctx.totalQCD > 0) {
    const cappedQCD = Math.min(ctx.totalQCD, QCD.MAX_AMOUNT);
    ctx.totalQCD = cappedQCD;
    ctx.iraDistributionsTaxable = Math.max(0, ctx.iraDistributionsTaxable - cappedQCD);
    ctx.totalRetirementIncome = Math.max(0, ctx.totalRetirementIncome - cappedQCD);
  }

  // 1099-G (unemployment)
  ctx.totalUnemployment = (taxReturn.income1099G || []).reduce(
    (sum, g) => sum + safeNum(g.unemploymentCompensation), 0,
  );

  // 1099-MISC — Box 3 (Other Income) stays in "other income" line
  ctx.total1099MISCIncome = (taxReturn.income1099MISC || []).reduce(
    (sum, m) => sum + safeNum(m.otherIncome), 0,
  );
  // 1099-MISC Box 1 (Rents) → Schedule E
  ctx.misc1099Rents = (taxReturn.income1099MISC || []).reduce(
    (sum, m) => sum + safeNum(m.rents), 0,
  );
  // 1099-MISC Box 2 (Royalties) → Schedule E
  ctx.misc1099Royalties = (taxReturn.income1099MISC || []).reduce(
    (sum, m) => sum + safeNum(m.royalties), 0,
  );

  // W-2G (gambling)
  ctx.totalGamblingIncome = (taxReturn.incomeW2G || []).reduce(
    (sum, g) => sum + safeNum(g.grossWinnings), 0,
  );

  // 1099-C / Form 982 (cancellation of debt)
  const has1099C = (taxReturn.income1099C || []).length > 0;
  if (has1099C) {
    ctx.form982Result = calculateCancellationOfDebt(taxReturn.income1099C, taxReturn.form982);
    ctx.cancellationOfDebtIncome = ctx.form982Result.taxableAmount;
  }

  // Alimony received (pre-2019)
  if (taxReturn.alimonyReceived && taxReturn.alimonyReceived.totalReceived > 0) {
    const divorceDate = new Date(taxReturn.alimonyReceived.divorceDate);
    const cutoff = new Date(ALIMONY.TCJA_CUTOFF_DATE);
    if (!isNaN(divorceDate.getTime()) && divorceDate < cutoff) {
      ctx.alimonyReceivedIncome = round2(Math.max(0, taxReturn.alimonyReceived.totalReceived));
    }
  }

  // 1099-Q (529 distributions) — IRC §529(c)(3)(B), Pub 970 Ch. 8
  // IRC §529(c)(3)(A): Taxable earnings are reported on the return of the distributee
  // (the person named on the 1099-Q). When recipientType === 'beneficiary', the 1099-Q
  // was issued to the student/beneficiary — income goes on their return, not the parents'.
  const has1099Q = (taxReturn.income1099Q || []).length > 0;
  if (has1099Q) {
    for (const dist of taxReturn.income1099Q) {
      // Skip distributions issued to the beneficiary — taxable on beneficiary's return
      if (dist.recipientType === 'beneficiary') continue;

      if (dist.distributionType === 'non_qualified') {
        // Pub 970 Worksheet: Adjusted Qualified Education Expenses
        const aqee = round2(Math.max(0,
          (dist.qualifiedExpenses || 0)
          - (dist.taxFreeAssistance || 0)
          - (dist.expensesClaimedForCredit || 0),
        ));
        // Pro-rata exclusion ratio (capped at 1.0)
        const exclusionRatio = dist.grossDistribution > 0
          ? Math.min(1, aqee / dist.grossDistribution)
          : 1;
        const taxFreeEarnings = round2(dist.earnings * exclusionRatio);
        const taxableEarnings = round2(Math.max(0, dist.earnings - taxFreeEarnings));
        ctx.taxable529Income = round2(ctx.taxable529Income + taxableEarnings);
      }
    }
    ctx.penalty529 = round2(ctx.taxable529Income * DISTRIBUTION_529.PENALTY_RATE);
  }

  // K-1 (partnerships & S-Corps)
  const hasK1 = (taxReturn.incomeK1 || []).length > 0;
  ctx.k1Routing = hasK1 ? aggregateK1Income(taxReturn.incomeK1) : undefined;

  if (ctx.k1Routing) {
    // §1231: net gain → long-term capital gain; net loss → ordinary loss (IRC §1231(a))
    const net1231 = ctx.k1Routing.netSection1231Gain || 0;
    const section1231AsLTCG = Math.max(0, net1231);
    const section1231AsOrdinaryLoss = Math.min(0, net1231); // negative or 0

    ctx.k1OrdinaryIncome = round2(ctx.k1Routing.ordinaryBusinessIncome + ctx.k1Routing.guaranteedPayments + ctx.k1Routing.otherIncome + section1231AsOrdinaryLoss);
    ctx.k1Interest = ctx.k1Routing.interestIncome || 0;
    ctx.k1OrdinaryDividends = ctx.k1Routing.ordinaryDividends || 0;
    ctx.k1QualifiedDividends = ctx.k1Routing.qualifiedDividends || 0;
    ctx.k1ShortTermGain = ctx.k1Routing.shortTermCapitalGain || 0;
    ctx.k1LongTermGain = round2((ctx.k1Routing.longTermCapitalGain || 0) + section1231AsLTCG);
    ctx.k1RentalIncome = ctx.k1Routing.rentalIncome || 0;
    ctx.k1Royalties = ctx.k1Routing.royalties || 0;
    ctx.k1QBI = ctx.k1Routing.section199AQBI || 0;

    const k1Section179Raw = ctx.k1Routing.section179Deduction || 0;
    ctx.k1Section179Deduction = round2(Math.min(k1Section179Raw, Math.max(0, ctx.k1OrdinaryIncome)));

    // Box 13 deductions
    ctx.k1CharitableCash = ctx.k1Routing.charitableCash || 0;
    ctx.k1CharitableNonCash = ctx.k1Routing.charitableNonCash || 0;
    ctx.k1InvestmentInterestExpense = ctx.k1Routing.investmentInterestExpense || 0;
    ctx.k1OtherDeductions = ctx.k1Routing.otherDeductions || 0;

    // Box 15 credits
    ctx.k1ForeignTaxPaid = ctx.k1Routing.foreignTaxPaid || 0;
    ctx.k1OtherCredits = ctx.k1Routing.otherCredits || 0;
  }

  // 1099-SA (HSA distributions)
  const has1099SA = (taxReturn.income1099SA || []).length > 0;
  const taxpayerIs65 = isAge65OrOlder(taxReturn.dateOfBirth, taxReturn.taxYear);
  const hsaDistResult = has1099SA
    ? aggregateHSADistributions(taxReturn.income1099SA, taxpayerIs65)
    : undefined;
  ctx.hsaDistResult = hsaDistResult ? { totalTaxable: hsaDistResult.totalTaxable, totalPenalty: hsaDistResult.totalPenalty } : undefined;
  ctx.hsaDistributionTaxable = hsaDistResult?.totalTaxable || 0;
  ctx.hsaDistributionPenalty = hsaDistResult?.totalPenalty || 0;
}

// ─── Section 2: Self-Employment ───────────────────────────

export function calculateSelfEmploymentSection(ctx: Form1040Context): void {
  const { taxReturn, filingStatus } = ctx;

  ctx.k1SEIncome = ctx.k1Routing?.totalSEIncome || 0;
  ctx.totalSENetProfit = round2(ctx.scheduleCNetProfit + ctx.k1SEIncome + ctx.scheduleFNetProfit);

  // Farm Optional Method: if elected, compute the optional method amount
  // and pass it to calculateScheduleSE to bypass the 92.35% reduction on farm income.
  const farmOptionalAmount = ctx.scheduleFResult?.farmOptionalMethodAmount || 0;

  // Per IRS Schedule SE Line 8a: each spouse has their own SS wage base ($176,100).
  // Only the self-employed person's W-2 SS wages reduce THEIR SS cap.
  // For MFJ: determine which spouse has SE income and use only that spouse's W-2 SS wages.
  const sePersonIsSpouse = (taxReturn.businesses || []).some(b => b.isSpouse === true);
  const sePersonIsPrimary = (taxReturn.businesses || []).some(b => b.isSpouse === false || b.isSpouse === undefined);
  const bothSpousesSE = sePersonIsSpouse && sePersonIsPrimary;

  if (filingStatus === FilingStatus.MarriedFilingJointly && bothSpousesSE) {
    // Both spouses have SE income: compute per-spouse Schedule SE with separate SS wage caps.
    // Per IRS, each spouse files their own Schedule SE — their SS wage base ($176,100) is
    // reduced only by their own W-2 social security wages, not the other spouse's.
    const businesses = taxReturn.businesses || [];
    const businessResults = ctx.scheduleC?.businessResults || [];

    // Split Schedule C profits by spouse using businessId → business.isSpouse mapping
    const primarySchCProfit = businessResults
      .filter(br => {
        const biz = businesses.find(b => b.id === br.businessId);
        return !biz?.isSpouse;
      })
      .reduce((sum, br) => sum + br.netProfit, 0);
    const spouseSchCProfit = round2(ctx.scheduleCNetProfit - primarySchCProfit);

    // K-1 SE income and Schedule F default to primary (no isSpouse field on these types)
    const primaryTotalProfit = round2(primarySchCProfit + ctx.k1SEIncome + ctx.scheduleFNetProfit);
    const spouseTotalProfit = spouseSchCProfit;

    // Filter W-2 SS wages per spouse
    const primaryW2SS = taxReturn.w2Income
      .filter(w => w.isSpouse !== true)
      .reduce((sum, w) => sum + (w.socialSecurityWages || 0), 0);
    const spouseW2SS = taxReturn.w2Income
      .filter(w => w.isSpouse === true)
      .reduce((sum, w) => sum + (w.socialSecurityWages || 0), 0);

    const primarySE = primaryTotalProfit > 0
      ? calculateScheduleSE(primaryTotalProfit, filingStatus, primaryW2SS, farmOptionalAmount)
      : undefined;
    const spouseSE = spouseTotalProfit > 0
      ? calculateScheduleSE(spouseTotalProfit, filingStatus, spouseW2SS)
      : undefined;

    // Combine per-spouse results into single ctx.scheduleSE for downstream use.
    // SS tax and regular Medicare are per-person (each spouse has own wage base),
    // but Additional Medicare Tax uses a single household threshold (Form 8959).
    // Per-spouse calculation may undercount when neither spouse alone exceeds the
    // $250k MFJ threshold but their combined SE earnings do.
    ctx.scheduleSE = (primarySE || spouseSE) ? (() => {
      const combinedNetEarnings = (primarySE?.netEarnings || 0) + (spouseSE?.netEarnings || 0);
      const perSpouseAdditionalMedicare = (primarySE?.additionalMedicareTax || 0) + (spouseSE?.additionalMedicareTax || 0);
      // Recalculate Additional Medicare at household level
      const householdAdditionalMedicare = round2(
        Math.max(0, combinedNetEarnings - SE_TAX.ADDITIONAL_MEDICARE_THRESHOLD_MFJ) * SE_TAX.ADDITIONAL_MEDICARE_RATE,
      );
      const additionalMedicareDiff = round2(householdAdditionalMedicare - perSpouseAdditionalMedicare);
      return {
        netEarnings: combinedNetEarnings,
        socialSecurityTax: (primarySE?.socialSecurityTax || 0) + (spouseSE?.socialSecurityTax || 0),
        medicareTax: (primarySE?.medicareTax || 0) + (spouseSE?.medicareTax || 0),
        additionalMedicareTax: householdAdditionalMedicare,
        totalSETax: round2((primarySE?.totalSETax || 0) + (spouseSE?.totalSETax || 0) + additionalMedicareDiff),
        deductibleHalf: (primarySE?.deductibleHalf || 0) + (spouseSE?.deductibleHalf || 0),
      };
    })() : undefined;
    ctx.w2SSWages = primaryW2SS + spouseW2SS; // Combined for reference
  } else if (filingStatus === FilingStatus.MarriedFilingJointly && (sePersonIsSpouse || sePersonIsPrimary)) {
    // Single-spouse SE: only use that spouse's W-2 SS wages
    const useSpouseW2 = sePersonIsSpouse;
    ctx.w2SSWages = taxReturn.w2Income
      .filter(w => useSpouseW2 ? w.isSpouse === true : w.isSpouse !== true)
      .reduce((sum, w) => sum + (w.socialSecurityWages || 0), 0);
    ctx.scheduleSE = ctx.totalSENetProfit > 0 || farmOptionalAmount > 0
      ? calculateScheduleSE(ctx.totalSENetProfit, filingStatus, ctx.w2SSWages, farmOptionalAmount)
      : undefined;
  } else {
    // Single filer or non-MFJ: use all W-2 SS wages
    ctx.w2SSWages = taxReturn.w2Income.reduce((sum, w) => sum + (w.socialSecurityWages || 0), 0);
    ctx.scheduleSE = ctx.totalSENetProfit > 0 || farmOptionalAmount > 0
      ? calculateScheduleSE(ctx.totalSENetProfit, filingStatus, ctx.w2SSWages, farmOptionalAmount)
      : undefined;
  }

  ctx.seDeductibleHalf = ctx.scheduleSE?.deductibleHalf || 0;
  const sed = taxReturn.selfEmploymentDeductions;

  ctx.taxpayerAge = getAgeAtEndOfYear(taxReturn.dateOfBirth, taxReturn.taxYear);

  // SEP-IRA (calculate first so Solo 401(k) can aggregate for §415(c))
  if (sed && sed.sepIraContributions > 0) {
    ctx.sepIRAResult = calculateSEPIRALimits({
      scheduleCNetProfit: ctx.scheduleCNetProfit,
      seDeductibleHalf: ctx.seDeductibleHalf,
      desiredContribution: sed.sepIraContributions,
    });
    ctx.sepIRATotalContribution = ctx.sepIRAResult.appliedContribution;
  }

  // Solo 401(k)
  if (sed && (sed.solo401kEmployeeDeferral || sed.solo401kEmployerContribution || sed.solo401kContributions)) {
    const hasDetailedFields = (sed.solo401kEmployeeDeferral !== undefined && sed.solo401kEmployeeDeferral > 0) ||
                               (sed.solo401kEmployerContribution !== undefined && sed.solo401kEmployerContribution > 0);
    // Auto-derive W-2 salary deferrals from Box 12 codes D/E/F/G/H/S/AA/BB/EE
    // These reduce the §402(g) elective deferral limit for Solo 401(k)
    const autoW2Deferrals = totalSalaryDeferrals(taxReturn.w2Income);
    ctx.solo401kResult = calculateSolo401kLimits({
      scheduleCNetProfit: ctx.scheduleCNetProfit,
      seDeductibleHalf: ctx.seDeductibleHalf,
      employeeDeferral: hasDetailedFields ? (sed.solo401kEmployeeDeferral || 0) : (sed.solo401kContributions || 0),
      rothDeferral: sed.solo401kRothDeferral || 0,
      employerContribution: hasDetailedFields ? (sed.solo401kEmployerContribution || 0) : 0,
      age: ctx.taxpayerAge,
      w2SalaryDeferrals: autoW2Deferrals > 0 ? autoW2Deferrals : undefined,
      simpleIraDeferrals: sed.simpleIraContributions || 0,
      sepIraContributions: ctx.sepIRATotalContribution > 0 ? ctx.sepIRATotalContribution : undefined,
    });
    // Use deductibleContribution for Schedule 1 Line 16 (excludes Roth deferrals)
    ctx.solo401kTotalContribution = ctx.solo401kResult.deductibleContribution;
  }

  // SIMPLE IRA contributions (self-employed elective deferrals)
  // These are deductible on Schedule 1 Line 16 and aggregate with §402(g)
  if (sed && (sed.simpleIraContributions || 0) > 0) {
    ctx.simpleIraTotalContribution = sed.simpleIraContributions || 0;
  }
}

// ─── Bridge: Disposed Rentals → Form 4797 ─────────────────
// When a rental property is disposed and has sale details (salesPrice, costBasis),
// auto-generate a Form4797Property entry so the gain flows through the §1250
// depreciation recapture pipeline. Residential rental is always §1250 real property
// with straight-line depreciation (27.5-year MACRS).
//
// Known precision gap vs commercial software (~$200-$300):
//   Commercial software's Form 4797 auto-generation from rental dispositions tracks additional
//   data we currently require the user to enter:
//     1. dateAcquired / dateSold — we leave blank (no UI field for these on rental)
//     2. Selling expenses — TT deducts closing costs from net proceeds automatically
//     3. Land vs building allocation — TT may separate non-depreciable land portion
//     4. Partial-year depreciation in year of sale — we use user-entered cumulative
//   These factors can produce small gain/tax differences (~$200-$300 range).
//   Future enhancement: add dateAcquired, dateSold, sellingExpenses, landValue
//   fields to RentalProperty to close this gap.
export function convertDisposedRentalsToForm4797(
  rentalProperties: RentalProperty[],
): Form4797Property[] {
  return rentalProperties
    .filter(p => p.disposedDuringYear && p.salesPrice != null && p.costBasis != null)
    .map(p => ({
      id: `rental-4797-${p.id}`,
      description: p.address || 'Rental Property',
      dateAcquired: '',
      dateSold: '',
      salesPrice: p.salesPrice!,
      costBasis: p.costBasis!,
      depreciationAllowed: p.cumulativeDepreciation || 0,
      isSection1250: true,                             // Real property
      straightLineDepreciation: p.cumulativeDepreciation || 0, // Residential = all straight-line
    }));
}

// ─── Section 3: Capital Assets ────────────────────────────

export function calculateCapitalAssetsSection(ctx: Form1040Context): void {
  const { taxReturn, filingStatus } = ctx;

  // Sale of Home Exclusion (Section 121)
  if (taxReturn.homeSale && taxReturn.homeSale.salePrice > 0) {
    ctx.homeSaleResult = calculateHomeSaleExclusion(taxReturn.homeSale, filingStatus);
    ctx.homeSaleTaxableGain = ctx.homeSaleResult.taxableGain;
  }

  // 1099-DA (crypto) → merge with 1099-B for Schedule D
  const digitalAssetTransactions: Income1099B[] = (taxReturn.income1099DA || []).map(da => ({
    id: da.id,
    brokerName: da.brokerName,
    description: da.tokenName + (da.tokenSymbol ? ` (${da.tokenSymbol})` : '') + (da.description ? ` - ${da.description}` : ''),
    dateAcquired: da.dateAcquired,
    dateSold: da.dateSold,
    proceeds: da.proceeds,
    costBasis: da.costBasis,
    isLongTerm: da.isLongTerm,
    federalTaxWithheld: da.federalTaxWithheld,
    washSaleLossDisallowed: da.washSaleLossDisallowed,
    basisReportedToIRS: da.isBasisReportedToIRS,
  }));
  // Nonbusiness bad debts → synthetic short-term capital losses (IRC §166(d))
  const badDebtTransactions: Income1099B[] = (taxReturn.nonbusinessBadDebts || []).map(bd => ({
    id: `bad-debt-${bd.id}`,
    brokerName: 'Nonbusiness Bad Debt',
    description: `Bad debt: ${bd.debtorName} — ${bd.description}`,
    dateSold: `${taxReturn.taxYear}-12-31`,
    proceeds: 0,
    costBasis: Math.max(0, bd.amountOwed),
    isLongTerm: false, // Always short-term per IRC §166(d)(1)(B)
  }));

  const allScheduleDTransactions = [...(taxReturn.income1099B || []), ...digitalAssetTransactions, ...badDebtTransactions];

  // Schedule D
  const has1099B = allScheduleDTransactions.length > 0;
  const hasCapGainDist = ctx.totalCapitalGainDistributions > 0;
  ctx.scheduleD = (has1099B || ctx.homeSaleTaxableGain > 0 || hasCapGainDist)
    ? calculateScheduleD(
        allScheduleDTransactions,
        safeNum(taxReturn.capitalLossCarryforward),
        filingStatus,
        taxReturn.capitalLossCarryforwardST,
        taxReturn.capitalLossCarryforwardLT,
        ctx.totalCapitalGainDistributions,
      )
    : undefined;

  // Form 4797 — merge explicit entries with auto-generated from disposed rentals
  const rentalForm4797 = convertDisposedRentalsToForm4797(taxReturn.rentalProperties || []);
  const allForm4797 = [...(taxReturn.form4797Properties || []), ...rentalForm4797];
  if (allForm4797.length > 0) {
    ctx.form4797Result = calculateForm4797(allForm4797);
    ctx.form4797OrdinaryIncome = ctx.form4797Result.totalOrdinaryIncome;
    ctx.form4797Section1231GainOrLoss = ctx.form4797Result.netSection1231GainOrLoss;
    ctx.form4797Unrecaptured1250 = ctx.form4797Result.unrecapturedSection1250Gain;
  }

  // Derived capital amounts
  ctx.form4797LTCGContribution = ctx.form4797Result?.section1231IsGain
    ? ctx.form4797Result.netSection1231GainOrLoss
    : 0;
  ctx.scheduleDNetGain = ctx.scheduleD
    ? (ctx.scheduleD.netGainOrLoss > 0 ? ctx.scheduleD.netGainOrLoss : 0) + ctx.homeSaleTaxableGain
    : ctx.homeSaleTaxableGain;
  ctx.capitalLossDeduction = ctx.scheduleD?.capitalLossDeduction || 0;
  ctx.scheduleDLongTermGain = ctx.scheduleD
    ? Math.max(0, ctx.scheduleD.netLongTerm) + ctx.homeSaleTaxableGain
    : ctx.homeSaleTaxableGain;
}

// ─── Section 4: Preliminary Income ────────────────────────

export function calculatePreliminaryIncomeSection(ctx: Form1040Context): void {
  const { taxReturn, filingStatus } = ctx;

  ctx.allInterest = round2(ctx.totalInterest + ctx.k1Interest);
  ctx.allOrdinaryDividends = round2(ctx.totalOrdinaryDividends + ctx.k1OrdinaryDividends);
  ctx.allQualifiedDividends = round2(ctx.totalQualifiedDividends + ctx.k1QualifiedDividends);

  ctx.form4797OrdinaryLoss = ctx.form4797Section1231GainOrLoss < 0
    ? ctx.form4797Section1231GainOrLoss
    : 0;

  // IRC §129: Dependent care employer benefits over exclusion limit → taxable income
  const rawDCBenefits = Math.max(0,
    taxReturn.dependentCare?.employerBenefits ?? taxReturn.dependentCare?.dependentCareFSA ?? 0,
  );
  if (rawDCBenefits > 0) {
    const dcExclusionLimit = filingStatus === FilingStatus.MarriedFilingSeparately
      ? DEPENDENT_CARE_FSA.MAX_EXCLUSION_MFS
      : DEPENDENT_CARE_FSA.MAX_EXCLUSION;
    ctx.dcFSATaxableExcess = round2(Math.max(0, rawDCBenefits - dcExclusionLimit));
  }

  // Note: K-1 royalties and 1099-MISC rents/royalties flow through Schedule E (added later),
  // matching the pattern used for rental income (not in pre-SS computation).
  // Capital gain distributions now flow through Schedule D Line 13 (long-term gains),
  // so they're included in scheduleDNetGain — not added separately here.
  ctx.incomeBeforeSS = round2(
    ctx.totalWages + ctx.allInterest + ctx.allOrdinaryDividends +
    ctx.scheduleCNetProfit + ctx.scheduleFNetProfit + ctx.totalRetirementIncome + ctx.totalUnemployment +
    ctx.total1099MISCIncome + ctx.otherIncome + ctx.totalGamblingIncome + ctx.cancellationOfDebtIncome +
    ctx.alimonyReceivedIncome + ctx.taxable529Income +
    ctx.k1OrdinaryIncome - ctx.k1Section179Deduction + ctx.k1ShortTermGain + ctx.k1LongTermGain +
    ctx.hsaDistributionTaxable +
    ctx.scheduleDNetGain - ctx.capitalLossDeduction +
    ctx.form4797OrdinaryIncome + ctx.form4797LTCGContribution + ctx.form4797OrdinaryLoss +
    ctx.dcFSATaxableExcess,
  );

  // Social Security
  ctx.taxExemptInterest = taxReturn.income1099INT.reduce(
    (sum, i) => sum + (i.taxExemptInterest || 0), 0,
  );
  const ssaBenefits = taxReturn.incomeSSA1099?.totalBenefits || 0;
  // Per IRS Publication 915 Worksheet 1: "other income" for SS taxability is
  // Modified AGI (excluding SS), which subtracts above-the-line adjustments.
  // The SE deductible half is the most impactful adjustment available at this point.
  const ssMAGI = round2(ctx.incomeBeforeSS - ctx.seDeductibleHalf);
  ctx.socialSecurityResult = ssaBenefits > 0
    ? calculateTaxableSocialSecurity(ssaBenefits, ssMAGI, filingStatus, ctx.taxExemptInterest, taxReturn.livedApartFromSpouse ?? false)
    : undefined;
  ctx.taxableSocialSecurity = ctx.socialSecurityResult?.taxableBenefits || 0;

  // Schedule E (with preliminary AGI for passive loss phase-out)
  const totalIncomePreScheduleE = round2(ctx.incomeBeforeSS + ctx.taxableSocialSecurity);

  // Precise Form 7206 computation — retirement contributions are already known from Section 2.
  // IRC §162(l); Form 7206
  const sed = taxReturn.selfEmploymentDeductions;
  const retirementForSEHICap = round2(
    ctx.sepIRATotalContribution +
    ctx.solo401kTotalContribution +
    ctx.simpleIraTotalContribution +
    (sed?.otherRetirementContributions || 0),
  );
  const form7206Raw = sed?.form7206
    ?? (sed?.healthInsurancePremiums ? legacyToForm7206Input(sed.healthInsurancePremiums) : undefined);
  // Inject taxpayer/spouse ages so Form 7206 LTC age-based limits work
  const form7206Input = form7206Raw ? {
    ...form7206Raw,
    taxpayerAge: form7206Raw.taxpayerAge ?? ctx.taxpayerAge,
    spouseAge: form7206Raw.spouseAge ?? (
      (filingStatus === FilingStatus.MarriedFilingJointly || filingStatus === FilingStatus.QualifyingSurvivingSpouse)
        ? getAgeAtEndOfYear(taxReturn.spouseDateOfBirth, taxReturn.taxYear)
        : undefined
    ),
  } : undefined;
  // ── Pub 974 iterative calculation: SE health insurance ↔ PTC circularity ──
  // Per IRS Pub 974, the SE health insurance deduction must be reduced by the
  // *actual* PTC (not the advance PTC from 1095-A). Since PTC depends on AGI
  // and AGI depends on the SE health deduction, we iterate to convergence.
  //
  // Uses preliminary AGI (before Schedule E, FEIE, student loan, IRA) for the
  // PTC estimate. This is accurate for the vast majority of SE + marketplace
  // filers; the final PTC is recomputed in Section 9 with actual AGI.
  const earlyWdPenaltyForPrelim = round2(
    taxReturn.income1099INT.reduce((sum, i) => sum + (i.earlyWithdrawalPenalty || 0), 0) +
    (taxReturn.income1099OID || []).reduce((sum, o) => sum + (o.earlyWithdrawalPenalty || 0), 0),
  );
  const halfSE = ctx.scheduleSE?.deductibleHalf || 0;
  const hsaDed = safeNum(taxReturn.hsaDeduction);
  const ssaBenefitsForPrelim = taxReturn.incomeSSA1099?.totalBenefits || 0;
  const nonTaxableSSForPrelim = round2(ssaBenefitsForPrelim - ctx.taxableSocialSecurity);

  let ptcForForm7206 = 0;
  if (form7206Input && taxReturn.premiumTaxCredit?.forms1095A?.length) {
    // First pass: Form 7206 with no PTC adjustment → preliminary AGI → preliminary PTC
    const firstPassForm7206 = calculateForm7206(
      form7206Input, ctx.scheduleCNetProfit, ctx.scheduleFNetProfit,
      halfSE, retirementForSEHICap, 0, filingStatus,
    );
    const firstPassAdj = round2(halfSE + firstPassForm7206.finalDeduction + retirementForSEHICap + hsaDed + earlyWdPenaltyForPrelim);
    const firstPassAGI = round2(totalIncomePreScheduleE - firstPassAdj);
    const firstPassHI = calculatePTCHouseholdIncome(firstPassAGI, 0, ctx.taxExemptInterest, nonTaxableSSForPrelim);
    const firstPassPTC = calculatePremiumTaxCredit(taxReturn.premiumTaxCredit, firstPassHI, filingStatus);

    if (firstPassPTC.annualPTC > 0) {
      // Actual PTC > 0: iterate until SE health deduction ↔ PTC converge
      ptcForForm7206 = firstPassPTC.annualPTC;
      for (let iter = 0; iter < 10; iter++) {
        const iterForm7206 = calculateForm7206(
          form7206Input, ctx.scheduleCNetProfit, ctx.scheduleFNetProfit,
          halfSE, retirementForSEHICap, ptcForForm7206, filingStatus,
        );
        const iterAdj = round2(halfSE + iterForm7206.finalDeduction + retirementForSEHICap + hsaDed + earlyWdPenaltyForPrelim);
        const iterAGI = round2(totalIncomePreScheduleE - iterAdj);
        const iterHI = calculatePTCHouseholdIncome(iterAGI, 0, ctx.taxExemptInterest, nonTaxableSSForPrelim);
        const iterPTC = calculatePremiumTaxCredit(taxReturn.premiumTaxCredit, iterHI, filingStatus);
        if (Math.abs(iterPTC.annualPTC - ptcForForm7206) < 1) break; // converged
        ptcForForm7206 = iterPTC.annualPTC;
      }
    }
    // else: PTC = $0 → no adjustment needed, ptcForForm7206 stays 0
  }

  ctx.form7206Result = calculateForm7206(
    form7206Input,
    ctx.scheduleCNetProfit,
    ctx.scheduleFNetProfit,
    halfSE,
    retirementForSEHICap,
    ptcForForm7206,
    filingStatus,
  );
  ctx.selfEmployedHealthInsurance = ctx.form7206Result.finalDeduction;

  const prelimAdjustments = round2(
    halfSE +
    ctx.selfEmployedHealthInsurance +
    retirementForSEHICap +
    hsaDed +
    earlyWdPenaltyForPrelim,
  );
  const prelimAGI = round2(totalIncomePreScheduleE - prelimAdjustments);

  // IRC §469(i)(3)(F): MAGI for passive loss $25k allowance must exclude:
  //   taxable SS, student loan interest, IRA deduction, and passive losses themselves.
  // Student loan/IRA aren't computed yet (Section 5), and §469(i)(3)(F) excludes them anyway.
  // So we use incomeBeforeSS (no taxable SS) minus preliminary adjustments.
  const magiForPassiveLoss = round2(ctx.incomeBeforeSS - prelimAdjustments);

  // Form 4835 — Farm rental income (passive, flows to Schedule E)
  const farmRentalNet = (taxReturn.farmRentals || []).reduce((sum, fr) => {
    const exp = fr.expenses || {};
    const totalExp = (exp.insurance || 0) + (exp.repairs || 0) + (exp.taxes || 0) +
      (exp.utilities || 0) + (exp.depreciation || 0) + (exp.other || 0);
    return sum + round2(Math.max(0, fr.rentalIncome) - totalExp);
  }, 0);

  // Schedule E — rentals, royalties (1099-MISC + K-1 + farm rental)
  const totalRoyalties = round2(ctx.misc1099Royalties + ctx.k1Royalties);
  const hasScheduleE = (taxReturn.rentalProperties || []).length > 0 ||
    (taxReturn.royaltyProperties || []).length > 0 ||
    ctx.k1RentalIncome !== 0 || ctx.misc1099Rents !== 0 || totalRoyalties !== 0 ||
    farmRentalNet !== 0;
  if (hasScheduleE) {
    ctx.scheduleEResult = calculateScheduleE(
      taxReturn.rentalProperties || [], ctx.k1RentalIncome,
      ctx.misc1099Rents, totalRoyalties,
      taxReturn.royaltyProperties || [],
    );
    // Form 8582 — apply passive activity loss limitation (IRC §469)
    ctx.form8582Result = calculateForm8582(
      ctx.scheduleEResult,
      taxReturn.rentalProperties || [],
      taxReturn.incomeK1 || [],
      magiForPassiveLoss,
      filingStatus,
      !!taxReturn.livedApartFromSpouse,
      taxReturn.form8582Data,
      ctx.misc1099Rents,
    );
    // Form 8582 determines the allowed loss; compute final scheduleEIncome
    const rawRentalNet = ctx.scheduleEResult.netRentalIncome;
    if (rawRentalNet >= 0) {
      // No loss → no limitation needed, pass through raw
      ctx.scheduleEIncome = ctx.scheduleEResult.scheduleEIncome;
    } else {
      // Loss → use Form 8582's allowed amount + royalties + any positive rental income
      ctx.scheduleEIncome = round2(
        ctx.form8582Result.totalAllowedLoss + ctx.scheduleEResult.royaltyIncome,
      );
    }

    // Add Form 4835 farm rental income (passive) to Schedule E total
    if (farmRentalNet !== 0) {
      ctx.scheduleEIncome = round2(ctx.scheduleEIncome + farmRentalNet);
    }

    // K-1 passive ORDINARY income adjustment:
    // K-1 passive ordinary income was included in incomeBeforeSS (via ctx.k1OrdinaryIncome),
    // but Form 8582 may have suspended it. Compute the suspended portion and add it back
    // (positive adjustment removes the negative loss from income).
    // NOTE: Only _passive activities, NOT _rental — K-1 rental income goes through Schedule E
    // and is already handled by totalAllowedLoss above.
    if (ctx.form8582Result.activities) {
      for (const act of ctx.form8582Result.activities) {
        // Only K-1 passive ordinary activities (id ends with _passive), NOT K-1 rentals
        if (act.type === 'k1_passive' && act.id.endsWith('_passive') && act.currentYearNetIncome < 0) {
          // This K-1's current-year ordinary loss was included in incomeBeforeSS.
          // Determine how much of that current-year loss is now suspended.
          if (act.allowedLoss === 0) {
            // Fully suspended: add back the entire current-year loss amount
            ctx.k1PassiveSuspendedAdj = round2(ctx.k1PassiveSuspendedAdj + Math.abs(act.currentYearNetIncome));
          } else if (act.allowedLoss < 0) {
            // Partially allowed: compute what portion of current year is allowed.
            // If the activity also has prior-year losses, the allowed amount covers both.
            const totalLoss = Math.abs(act.overallGainOrLoss);
            const allowed = Math.abs(act.allowedLoss);
            // Pro-rata: current-year share of allowed loss
            const currentYearShare = totalLoss > 0
              ? Math.abs(act.currentYearNetIncome) / totalLoss
              : 1;
            const currentYearAllowed = round2(allowed * currentYearShare);
            const currentYearSuspended = round2(Math.abs(act.currentYearNetIncome) - currentYearAllowed);
            ctx.k1PassiveSuspendedAdj = round2(ctx.k1PassiveSuspendedAdj + Math.max(0, currentYearSuspended));
          }
        }
      }
    }
  }

  // FEIE (Form 2555)
  if (taxReturn.foreignEarnedIncome && taxReturn.foreignEarnedIncome.foreignEarnedIncome > 0) {
    ctx.feieResult = calculateFEIE(taxReturn.foreignEarnedIncome);
    ctx.feieExclusion = ctx.feieResult.totalExclusion;
  }

  ctx.totalIncome = round2(totalIncomePreScheduleE + ctx.scheduleEIncome + ctx.k1PassiveSuspendedAdj - ctx.feieExclusion);

  // Trace: Total Income
  ctx.tb.trace('form1040.line9', 'Total Income', ctx.totalIncome, {
    authority: 'Form 1040, Line 9; IRC §61',
    formula: 'sum of all income sources',
    inputs: [
      ...(ctx.totalWages > 0 ? [{ lineId: 'form1040.line1a', label: 'W-2 Wages', value: round2(ctx.totalWages) }] : []),
      ...(ctx.allInterest > 0 ? [{ lineId: 'form1040.line2b', label: 'Taxable Interest', value: round2(ctx.allInterest) }] : []),
      ...(ctx.allOrdinaryDividends > 0 ? [{ lineId: 'form1040.line3b', label: 'Ordinary Dividends', value: round2(ctx.allOrdinaryDividends) }] : []),
      ...(ctx.scheduleCNetProfit > 0 ? [{ lineId: 'scheduleC.line31', label: 'Schedule C Net Profit', value: round2(ctx.scheduleCNetProfit) }] : []),
      ...(ctx.scheduleFNetProfit !== 0 ? [{ lineId: 'scheduleF.line34', label: 'Schedule F Net Farm Profit', value: round2(ctx.scheduleFNetProfit) }] : []),
      ...(ctx.totalRetirementIncome > 0 ? [{ lineId: 'form1040.line5b', label: 'Taxable Retirement Distributions', value: round2(ctx.totalRetirementIncome) }] : []),
      ...(ctx.taxableSocialSecurity > 0 ? [{ lineId: 'form1040.line6b', label: 'Taxable Social Security', value: round2(ctx.taxableSocialSecurity) }] : []),
      ...(ctx.scheduleDNetGain > 0 ? [{ lineId: 'scheduleD', label: 'Capital Gains', value: round2(ctx.scheduleDNetGain) }] : []),
      ...(ctx.scheduleEIncome !== 0 ? [{ lineId: 'scheduleE', label: 'Rental/Partnership Income', value: round2(ctx.scheduleEIncome) }] : []),
      ...(ctx.totalUnemployment > 0 ? [{ lineId: 'form1040.1099g', label: 'Unemployment Compensation', value: round2(ctx.totalUnemployment) }] : []),
      ...(ctx.k1OrdinaryIncome > 0 ? [{ lineId: 'k1.ordinary', label: 'K-1 Ordinary Income', value: round2(ctx.k1OrdinaryIncome) }] : []),
    ],
  });
}

// ─── Section 5: Adjustments ───────────────────────────────

export function calculateAdjustmentsSection(ctx: Form1040Context): void {
  const { taxReturn, filingStatus } = ctx;
  const disc = taxReturn.incomeDiscovery || {};
  const isDeclined = (key: string) => disc[key] === 'no';

  const seDeduction = ctx.scheduleSE?.deductibleHalf || 0;

  ctx.retirementContributions = round2(
    ctx.sepIRATotalContribution +
    ctx.solo401kTotalContribution +
    ctx.simpleIraTotalContribution +
    (taxReturn.selfEmploymentDeductions?.otherRetirementContributions || 0),
  );

  // Auto-derive employer HSA contributions from W-2 Box 12 code W if not explicitly set
  // Explicit user value on HSAContributionInfo.employerContributions takes precedence via ??
  if (!isDeclined('ded_hsa')) {
    if (taxReturn.hsaContribution) {
      const autoEmployerHSA = totalEmployerHSAContributions(taxReturn.w2Income);
      const effectiveHSAInfo: HSAContributionInfo = {
        ...taxReturn.hsaContribution,
        totalContributions: taxReturn.hsaContribution.totalContributions ?? taxReturn.hsaDeduction ?? 0,
        employerContributions: taxReturn.hsaContribution.employerContributions ?? autoEmployerHSA,
        dateOfBirth: taxReturn.hsaContribution.dateOfBirth ?? taxReturn.dateOfBirth,
        taxYear: taxReturn.hsaContribution.taxYear ?? taxReturn.taxYear,
      };
      ctx.hsaDeduction = calculateHSADeduction(effectiveHSAInfo);
    } else {
      ctx.hsaDeduction = taxReturn.hsaDeduction || 0;
    }
  }

  // Archer MSA (Form 8853)
  if (taxReturn.archerMSA && (taxReturn.archerMSA.personalContributions || 0) > 0) {
    ctx.archerMSAResult = calculateArcherMSADeduction(taxReturn.archerMSA, taxReturn.w2Income);
    ctx.archerMSADeduction = ctx.archerMSAResult.deduction;
  }

  // IRC §221(b)(2)(C)(iii) / §219(g)(3)(A)(ii): MAGI for student loan and IRA
  // phase-outs = AGI (for domestic filers) + FEIE exclusion (Form 2555 Line 45).
  // Since AGI itself depends on the student loan & IRA deductions (circular),
  // we compute a preliminary AGI from all OTHER adjustments first, then use it
  // as MAGI for the phase-out calculations.
  const preliminaryAdjustments = round2(
    seDeduction + ctx.selfEmployedHealthInsurance + ctx.retirementContributions +
    ctx.hsaDeduction + ctx.archerMSADeduction + ctx.movingExpenses + ctx.educatorExpenses + ctx.earlyWithdrawalPenalty +
    ctx.alimonyDeduction,
  );
  const magiForAdjustments = round2(ctx.totalIncome - preliminaryAdjustments + ctx.feieExclusion);

  if (!isDeclined('ded_student_loan')) {
    const rawStudentLoan = Math.min(safeNum(taxReturn.studentLoanInterest), STUDENT_LOAN_INTEREST.MAX_DEDUCTION);
    ctx.studentLoanInterest = calculateStudentLoanDeduction(rawStudentLoan, magiForAdjustments, filingStatus);
  }

  if (!isDeclined('ded_ira')) {
    // IRC §219(b)(5)(B): $1,000 catch-up contribution for age 50+
    const iraCatchUpEligible = isAge50OrOlder(taxReturn.dateOfBirth, taxReturn.taxYear) ||
      isAge50OrOlder(taxReturn.spouseDateOfBirth, taxReturn.taxYear);
    const iraLimit = IRA.MAX_CONTRIBUTION + (iraCatchUpEligible ? IRA.CATCH_UP_50_PLUS : 0);
    const rawIRA = Math.min(safeNum(taxReturn.iraContribution), iraLimit);
    // Auto-derive coveredByEmployerPlan from W-2 Box 13 if not explicitly set
    // Explicit user value (from the IRA deduction step) takes precedence via ??
    const effectiveCoveredByPlan = taxReturn.coveredByEmployerPlan ?? hasRetirementPlanCoverage(taxReturn.w2Income);
    ctx.iraDeduction = calculateIRADeduction(rawIRA, magiForAdjustments, filingStatus, effectiveCoveredByPlan, taxReturn.spouseCoveredByEmployerPlan);
  }

  if (!isDeclined('ded_educator')) {
    ctx.educatorExpenses = round2(Math.min(Math.max(0, safeNum(taxReturn.educatorExpenses)), EDUCATOR_EXPENSES.MAX_DEDUCTION));
  }

  ctx.earlyWithdrawalPenalty = round2(
    taxReturn.income1099INT.reduce((sum, i) => sum + (i.earlyWithdrawalPenalty || 0), 0) +
    (taxReturn.income1099OID || []).reduce((sum, o) => sum + (o.earlyWithdrawalPenalty || 0), 0),
  );

  if (!isDeclined('ded_alimony')) {
    ctx.alimonyDeduction = calculateAlimonyDeduction(taxReturn.alimony);
  }

  // Form 3903 — Moving expenses (military only, Schedule 1 Line 14)
  ctx.movingExpenses = taxReturn.isActiveDutyMilitary
    ? round2(Math.max(0, safeNum(taxReturn.movingExpenses)))
    : 0;

  ctx.totalAdjustments = round2(
    seDeduction + ctx.selfEmployedHealthInsurance + ctx.retirementContributions +
    ctx.hsaDeduction + ctx.archerMSADeduction + ctx.movingExpenses + ctx.studentLoanInterest + ctx.iraDeduction + ctx.educatorExpenses + ctx.earlyWithdrawalPenalty +
    ctx.alimonyDeduction,
  );

  ctx.agi = round2(ctx.totalIncome - ctx.totalAdjustments);

  // ── Form 8606 Reconciliation ──────────────────────────────
  // If IRA deduction was phased out (partially or fully), the non-deductible
  // remainder must be fed back into Form 8606 basis and the pro-rata recalculated.
  // IRC §219(g) phase-out → IRC §408(d)(1) pro-rata rule
  if (taxReturn.form8606 && taxReturn.iraContribution) {
    // Match the catch-up-aware limit used above
    const iraCatchUpEligibleFor8606 = isAge50OrOlder(taxReturn.dateOfBirth, taxReturn.taxYear) ||
      isAge50OrOlder(taxReturn.spouseDateOfBirth, taxReturn.taxYear);
    const iraLimitFor8606 = IRA.MAX_CONTRIBUTION + (iraCatchUpEligibleFor8606 ? IRA.CATCH_UP_50_PLUS : 0);
    const rawIRA = Math.min(safeNum(taxReturn.iraContribution), iraLimitFor8606);
    const nonDeductibleRemainder = round2(rawIRA - ctx.iraDeduction);

    if (nonDeductibleRemainder > 0) {
      const augmentedInfo: Form8606Info = {
        ...taxReturn.form8606,
        nondeductibleContributions: (taxReturn.form8606.nondeductibleContributions || 0) + nonDeductibleRemainder,
      };

      const oldResult = ctx.form8606Result;
      ctx.form8606Result = calculateForm8606(augmentedInfo, ctx.regularIRADistForForm8606);

      // Apply deltas to income for the change in taxable amounts
      if (oldResult) {
        const conversionDelta = ctx.form8606Result.taxableConversion - oldResult.taxableConversion;
        const distNonTaxDelta = ctx.form8606Result.nonTaxableDistributions - (oldResult.nonTaxableDistributions || 0);

        ctx.iraDistributionsTaxable += conversionDelta - distNonTaxDelta;
        ctx.totalRetirementIncome += conversionDelta - distNonTaxDelta;
        ctx.iraDistributionsTaxable = Math.max(0, ctx.iraDistributionsTaxable);
        ctx.totalIncome = round2(ctx.totalIncome + conversionDelta - distNonTaxDelta);
      }

      // Recompute AGI with updated totalIncome
      ctx.agi = round2(ctx.totalIncome - ctx.totalAdjustments);
    }
  }

  // Trace: Adjustments & AGI
  if (ctx.totalAdjustments > 0) {
    ctx.tb.trace('form1040.line10', 'Total Adjustments', ctx.totalAdjustments, {
      authority: 'Form 1040, Schedule 1, Part II; IRC §62',
      formula: 'sum of above-the-line deductions',
      inputs: [
        ...(seDeduction > 0 ? [{ lineId: 'schedule1.line15', label: 'Deductible Half of SE Tax', value: seDeduction }] : []),
        ...(ctx.selfEmployedHealthInsurance > 0 ? [{ lineId: 'schedule1.line17', label: 'SE Health Insurance (Form 7206)', value: ctx.selfEmployedHealthInsurance }] : []),
        ...(ctx.retirementContributions > 0 ? [{ lineId: 'schedule1.line16', label: 'Retirement Contributions', value: ctx.retirementContributions }] : []),
        ...(ctx.hsaDeduction > 0 ? [{ lineId: 'schedule1.line13', label: 'HSA Deduction', value: ctx.hsaDeduction }] : []),
        ...(ctx.movingExpenses > 0 ? [{ lineId: 'schedule1.line14', label: 'Moving Expenses (Military)', value: ctx.movingExpenses }] : []),
        ...(ctx.studentLoanInterest > 0 ? [{ lineId: 'schedule1.line21', label: 'Student Loan Interest', value: ctx.studentLoanInterest }] : []),
        ...(ctx.iraDeduction > 0 ? [{ lineId: 'schedule1.line20', label: 'IRA Deduction', value: ctx.iraDeduction }] : []),
        ...(ctx.educatorExpenses > 0 ? [{ lineId: 'schedule1.line11', label: 'Educator Expenses', value: ctx.educatorExpenses }] : []),
      ],
    });
  }
  ctx.tb.trace('form1040.line11', 'Adjusted Gross Income (AGI)', ctx.agi, {
    authority: 'Form 1040, Line 11; IRC §62',
    formula: 'Total Income − Total Adjustments',
    inputs: [
      { lineId: 'form1040.line9', label: 'Total Income', value: ctx.totalIncome },
      { lineId: 'form1040.line10', label: 'Total Adjustments', value: ctx.totalAdjustments },
    ],
  });
}

// ─── Section 6: Deductions ────────────────────────────────

export function calculateDeductionsSection(ctx: Form1040Context): void {
  const { taxReturn, filingStatus } = ctx;
  const disc = taxReturn.incomeDiscovery || {};
  const isDeclined = (key: string) => disc[key] === 'no';

  const earnedIncomeForDeduction = round2(ctx.totalWages + Math.max(0, ctx.scheduleCNetProfit) + Math.max(0, ctx.k1SEIncome) + Math.max(0, ctx.scheduleFNetProfit));
  ctx.standardDeduction = calculateStandardDeduction(taxReturn, filingStatus, earnedIncomeForDeduction);

  // Investment Interest Expense (Form 4952)
  // Include K-1 Box 13 Code H investment interest expense alongside direct input
  const directInvestmentInterest = taxReturn.investmentInterest?.investmentInterestPaid || 0;
  const totalInvestmentInterestPaid = round2(directInvestmentInterest + ctx.k1InvestmentInterestExpense);
  if (totalInvestmentInterestPaid > 0) {
    // Build effective investment interest info, merging K-1 amounts with direct input
    const effectiveInvestmentInterest = {
      investmentInterestPaid: totalInvestmentInterestPaid,
      priorYearDisallowed: taxReturn.investmentInterest?.priorYearDisallowed || 0,
      electToIncludeQualifiedDividends: taxReturn.investmentInterest?.electToIncludeQualifiedDividends,
      electToIncludeLTCG: taxReturn.investmentInterest?.electToIncludeLTCG,
    };
    ctx.investmentInterestResult = calculateInvestmentInterest(
      effectiveInvestmentInterest,
      ctx.allInterest,
      ctx.allOrdinaryDividends,
      ctx.allQualifiedDividends,
      ctx.scheduleDLongTermGain,
    );
    ctx.investmentInterestDeduction = ctx.investmentInterestResult.deductibleAmount;
  }

  if (taxReturn.deductionMethod === 'itemized' && taxReturn.itemizedDeductions) {
    // Zero out declined itemized categories so data persists but doesn't affect calculations
    const raw = taxReturn.itemizedDeductions;
    const filtered = {
      ...raw,
      medicalExpenses: isDeclined('ded_medical') ? 0 : raw.medicalExpenses,
      stateLocalIncomeTax: isDeclined('ded_property_tax') ? 0 : raw.stateLocalIncomeTax,
      realEstateTax: isDeclined('ded_property_tax') ? 0 : raw.realEstateTax,
      personalPropertyTax: isDeclined('ded_property_tax') ? 0 : raw.personalPropertyTax,
      mortgageInterest: isDeclined('ded_mortgage') ? 0 : raw.mortgageInterest,
      mortgageInsurancePremiums: isDeclined('ded_mortgage') ? 0 : raw.mortgageInsurancePremiums,
      charitableCash: isDeclined('ded_charitable') ? 0 : raw.charitableCash,
      charitableNonCash: isDeclined('ded_charitable') ? 0 : raw.charitableNonCash,
      nonCashDonations: isDeclined('ded_charitable') ? [] : raw.nonCashDonations,
      charitableCarryforward: isDeclined('ded_charitable') ? [] : raw.charitableCarryforward,
    };

    // Merge K-1 Box 13 charitable contributions (only when charitable is not declined)
    let effectiveItemized: typeof taxReturn.itemizedDeductions = (!isDeclined('ded_charitable') && (ctx.k1CharitableCash > 0 || ctx.k1CharitableNonCash > 0))
      ? {
          ...filtered,
          charitableCash: round2(filtered.charitableCash + ctx.k1CharitableCash),
          charitableNonCash: round2(filtered.charitableNonCash + ctx.k1CharitableNonCash),
        }
      : filtered;

    // Form 4684 — Compute casualty losses if provided (overrides manual casualtyLoss entry)
    // Form 4684 already applies $100/event floor and 10% AGI floor, so pass as
    // otherDeductions to bypass Schedule A's built-in casualty floor logic.
    if (taxReturn.casualtyLosses && taxReturn.casualtyLosses.length > 0) {
      const form4684 = calculateForm4684(taxReturn.casualtyLosses, ctx.agi);
      effectiveItemized = {
        ...effectiveItemized,
        casualtyLoss: 0, // Clear manual entry — Form 4684 handles it
        otherDeductions: round2((effectiveItemized?.otherDeductions || 0) + form4684.netDeductiblePersonalLoss),
      };
    }

    ctx.scheduleA = calculateScheduleA(effectiveItemized, ctx.agi, filingStatus);
    const gamblingLossDeduction = !isDeclined('ded_gambling') ? Math.min(
      Math.max(0, safeNum(taxReturn.gamblingLosses)),
      ctx.totalGamblingIncome,
    ) : 0;
    ctx.itemizedDeduction = round2(ctx.scheduleA.totalItemized + gamblingLossDeduction + ctx.investmentInterestDeduction);
  }

  // Force-itemize election: taxpayer can elect to itemize even when standard deduction
  // is higher (e.g., for state tax benefit). Per IRS, this is a valid election.
  ctx.deductionUsed =
    taxReturn.deductionMethod === 'itemized' && ctx.itemizedDeduction > 0
      ? 'itemized'
      : 'standard';
  ctx.deductionAmount = ctx.deductionUsed === 'itemized' ? ctx.itemizedDeduction : ctx.standardDeduction;

  // NOL Carryforward — computed BEFORE QBI per IRC §172/§199A ordering.
  // The NOL deduction is limited to 80% of taxable income before QBI.
  const nolCarryforward = !isDeclined('ded_nol') ? Math.max(0, safeNum(taxReturn.nolCarryforward)) : 0;
  const taxableBeforeNOL = Math.max(0, ctx.agi - ctx.deductionAmount);
  ctx.nolDeduction = nolCarryforward > 0
    ? round2(Math.min(nolCarryforward, taxableBeforeNOL * NOL.DEDUCTION_LIMIT_RATE))
    : 0;

  // QBI — per IRC §199A, QBI deduction is based on taxable income AFTER NOL.
  // Farm income (Schedule F) is eligible for QBI per IRC §199A(c)(3)(A)(i).
  const totalQBI = round2(ctx.scheduleCNetProfit + ctx.k1QBI + ctx.scheduleFNetProfit);
  const taxableIncomeBeforeQBI = Math.max(0, ctx.agi - ctx.deductionAmount - ctx.nolDeduction);

  // IRC §199A(a)(2): taxable income limit reduced by "net capital gain" per §1(h)
  // Net capital gain = max(0, net LTCG) + qualified dividends (§1(h)(11))
  const netLTCGForQBI = Math.max(0, ctx.scheduleD?.netLongTerm || 0);
  const netCapitalGainForQBI = round2(netLTCGForQBI + ctx.allQualifiedDividends);

  ctx.qbiDeduction = 0;
  if (totalQBI > 0 && !taxReturn.qbiInfo?.isAgriculturalCooperativePatron) {
    if (taxReturn.qbiInfo?.businesses && taxReturn.qbiInfo.businesses.length > 0) {
      ctx.qbiDeduction = calculateMultiBusinessQBIDeduction(
        taxReturn.qbiInfo.businesses,
        taxableIncomeBeforeQBI,
        filingStatus,
        netCapitalGainForQBI,
      );
    } else {
      ctx.qbiDeduction = calculateQBIDeduction(
        totalQBI, taxableIncomeBeforeQBI, filingStatus,
        taxReturn.qbiInfo?.isSSTB ?? true,
        taxReturn.qbiInfo?.w2WagesPaidByBusiness ?? 0,
        taxReturn.qbiInfo?.ubiaOfQualifiedProperty ?? 0,
        netCapitalGainForQBI,
      );
    }
  }

  // Schedule 1-A (OBBBA)
  const schedule1AMAGI = round2(ctx.agi + ctx.feieExclusion);
  const taxpayerIs65ForSenior = isAge65OrOlder(taxReturn.dateOfBirth, taxReturn.taxYear);
  const spouseIs65ForSenior = isAge65OrOlder(taxReturn.spouseDateOfBirth, taxReturn.taxYear);

  if (taxReturn.schedule1A) {
    ctx.schedule1AResult = calculateSchedule1A(
      taxReturn.schedule1A, schedule1AMAGI, filingStatus,
      taxpayerIs65ForSenior, spouseIs65ForSenior,
    );
    ctx.schedule1ADeduction = ctx.schedule1AResult.totalDeduction;
  } else if (taxpayerIs65ForSenior || (filingStatus === FilingStatus.MarriedFilingJointly && spouseIs65ForSenior)) {
    ctx.schedule1AResult = calculateSchedule1A(
      {}, schedule1AMAGI, filingStatus,
      taxpayerIs65ForSenior, spouseIs65ForSenior,
    );
    ctx.schedule1ADeduction = ctx.schedule1AResult.totalDeduction;
  }

  ctx.taxableIncome = round2(Math.max(0, taxableBeforeNOL - ctx.nolDeduction - ctx.qbiDeduction - ctx.schedule1ADeduction));

  // Trace: Deductions & Taxable Income
  ctx.tb.trace('form1040.line13', 'Deductions', ctx.deductionAmount, {
    authority: ctx.deductionUsed === 'standard' ? 'IRC §63(c)' : 'IRC §63(d); Schedule A',
    formula: ctx.deductionUsed === 'standard' ? 'Standard Deduction' : 'Itemized Deductions (Schedule A)',
    inputs: [],
    note: ctx.deductionUsed === 'standard'
      ? `Using standard deduction ($${ctx.deductionAmount.toLocaleString()})`
      : `Using itemized deductions ($${ctx.deductionAmount.toLocaleString()})`,
  });
  ctx.tb.trace('form1040.line15', 'Taxable Income', ctx.taxableIncome, {
    authority: 'Form 1040, Line 15; IRC §63',
    formula: 'AGI − Deductions − QBI Deduction',
    inputs: [
      { lineId: 'form1040.line11', label: 'AGI', value: ctx.agi },
      { lineId: 'form1040.line13', label: 'Deductions', value: ctx.deductionAmount },
      ...(ctx.qbiDeduction > 0 ? [{ lineId: 'form1040.line13a', label: 'QBI Deduction', value: ctx.qbiDeduction }] : []),
      ...(ctx.schedule1ADeduction > 0 ? [{ lineId: 'schedule1A', label: 'Schedule 1-A Deduction', value: ctx.schedule1ADeduction }] : []),
    ],
  });
}

// ─── Section 7: Income Tax ────────────────────────────────

export function calculateIncomeTaxSection(ctx: Form1040Context): void {
  const { taxReturn, filingStatus } = ctx;

  let preferentialQD = ctx.allQualifiedDividends;
  // Capital gain distributions are now included in scheduleDLongTermGain (via Schedule D Line 13)
  let preferentialLTCGBase = round2(ctx.scheduleDLongTermGain + ctx.k1LongTermGain + ctx.form4797LTCGContribution);
  if (taxReturn.investmentInterest?.electToIncludeQualifiedDividends) {
    preferentialQD = 0;
  }
  if (taxReturn.investmentInterest?.electToIncludeLTCG) {
    preferentialLTCGBase = 0;
  }
  const totalPreferentialLTCG = preferentialLTCGBase;
  const unrecapturedSection1250Gain = round2(
    safeNum(taxReturn.unrecapturedSection1250Gain) + ctx.form4797Unrecaptured1250,
  );
  const hasPreferentialIncome = preferentialQD > 0 || totalPreferentialLTCG > 0;

  // §911(f) stacking: when FEIE is claimed, tax on remaining income must be
  // computed at the rates that would apply if excluded income were still included.
  // Formula: tax = tax(taxableIncome + exclusion) - tax(exclusion)
  const feieStack = ctx.feieExclusion > 0 ? ctx.feieExclusion : 0;

  if (hasPreferentialIncome) {
    if (feieStack > 0) {
      // §911(f) + preferential rates: stack excluded income under the full computation
      const fullResult = calculatePreferentialRateTax(
        ctx.taxableIncome + feieStack, preferentialQD, totalPreferentialLTCG, filingStatus,
        unrecapturedSection1250Gain,
      );
      const excludedResult = calculateProgressiveTax(feieStack, filingStatus);
      ctx.incomeTax = round2(Math.max(0, fullResult.totalTax - excludedResult.tax));
      ctx.preferentialTax = fullResult.preferentialTax;
      ctx.section1250Tax = fullResult.section1250Tax;
      ctx.marginalTaxRate = fullResult.marginalRate;
    } else {
      const prefResult = calculatePreferentialRateTax(
        ctx.taxableIncome, preferentialQD, totalPreferentialLTCG, filingStatus,
        unrecapturedSection1250Gain,
      );
      ctx.incomeTax = prefResult.totalTax;
      ctx.preferentialTax = prefResult.preferentialTax;
      ctx.section1250Tax = prefResult.section1250Tax;
      ctx.marginalTaxRate = prefResult.marginalRate;
    }
  } else {
    if (feieStack > 0) {
      // §911(f): tax = tax(taxableIncome + exclusion) - tax(exclusion)
      const fullResult = calculateProgressiveTax(ctx.taxableIncome + feieStack, filingStatus);
      const excludedResult = calculateProgressiveTax(feieStack, filingStatus);
      ctx.incomeTax = round2(Math.max(0, fullResult.tax - excludedResult.tax));
      ctx.marginalTaxRate = fullResult.marginalRate;
    } else {
      const result = calculateProgressiveTax(ctx.taxableIncome, filingStatus);
      ctx.incomeTax = result.tax;
      ctx.marginalTaxRate = result.marginalRate;
    }
    ctx.preferentialTax = 0;
  }

  // AMT (Form 6251) — pass QD/LTCG/§1250 for Part III preferential rates
  ctx.amtResult = calculateAMT(
    taxReturn, ctx.incomeTax, ctx.scheduleA, ctx.taxableIncome, filingStatus,
    ctx.deductionAmount,
    preferentialQD,
    totalPreferentialLTCG,
    unrecapturedSection1250Gain,
  );
  ctx.amtAmount = ctx.amtResult.amtAmount;

  // Trace: Income Tax
  {
    let bracketChildren: CalculationTrace[] | undefined;
    if (ctx.traceOptions?.enabled && !hasPreferentialIncome) {
      // When stacking, trace the full (stacked) brackets so user sees the real rate schedule
      const traceIncome = feieStack > 0 ? ctx.taxableIncome + feieStack : ctx.taxableIncome;
      const traced = traceProgressiveTax(traceIncome, filingStatus);
      bracketChildren = traced.traces;
    }
    const feieNote = feieStack > 0
      ? ` (§911(f) stacked: rates applied as if $${feieStack.toLocaleString()} excluded income were included)`
      : '';
    ctx.tb.trace('form1040.line16', 'Income Tax', ctx.incomeTax, {
      authority: 'Form 1040, Line 16; IRC §1' + (feieStack > 0 ? '; IRC §911(f)' : ''),
      formula: feieStack > 0
        ? '§911(f): tax(taxableIncome + exclusion) − tax(exclusion)'
        : hasPreferentialIncome
          ? 'Preferential rate tax (qualified dividends/LTCG at 0%/15%/20%)'
          : 'Progressive tax on taxable income',
      inputs: [
        { lineId: 'form1040.line15', label: 'Taxable Income', value: ctx.taxableIncome },
        ...(feieStack > 0 ? [{ lineId: 'form2555', label: 'FEIE Exclusion (stacked)', value: feieStack }] : []),
      ],
      children: bracketChildren,
      note: hasPreferentialIncome
        ? 'Includes qualified dividends and/or long-term capital gains taxed at preferential rates' + feieNote
        : `Marginal rate: ${(ctx.marginalTaxRate * 100).toFixed(0)}%` + feieNote,
    });
  }
}

// ─── Section 8: Additional Taxes ──────────────────────────

export function calculateAdditionalTaxesSection(ctx: Form1040Context): void {
  const { taxReturn, filingStatus } = ctx;

  // SE Tax
  ctx.seTax = ctx.scheduleSE?.totalSETax || 0;

  // NIIT
  // Per Form 8960 Line 5a: include net gain or loss from dispositions.
  // Per IRC §1411(c)(1)(A)(iii), net gain is included only if positive.
  // A net capital loss does NOT reduce other investment income for NIIT purposes —
  // the $3k capital loss deduction reduces AGI (affecting the threshold comparison)
  // but is not subtracted from net investment income.
  const scheduleDGainForNIIT = ctx.scheduleD
    ? Math.max(0, ctx.scheduleD.netGainOrLoss)
    : 0;
  const rentalIncomeForNIIT = ctx.scheduleEResult ? Math.max(0, ctx.scheduleEResult.netRentalIncome) : 0;
  const royaltyIncomeForNIIT = ctx.scheduleEResult ? Math.max(0, ctx.scheduleEResult.royaltyIncome - (ctx.scheduleEResult.totalRoyaltyExpenses || 0)) : 0;
  // K-1 rental excluded — already in rentalIncomeForNIIT via Schedule E netRentalIncome
  const k1InvestmentForNIIT = round2(
    ctx.k1Interest + ctx.k1OrdinaryDividends + Math.max(0, ctx.k1ShortTermGain) +
    Math.max(0, ctx.k1LongTermGain),
  );
  const form4797NIITContribution = Math.max(0, ctx.form4797LTCGContribution);
  // Capital gain distributions now included in scheduleDGainForNIIT (via Schedule D)
  const grossInvestmentIncomeForNIIT = round2(
    ctx.allInterest + ctx.allOrdinaryDividends +
    scheduleDGainForNIIT + rentalIncomeForNIIT + royaltyIncomeForNIIT + k1InvestmentForNIIT +
    form4797NIITContribution -
    ctx.k1Interest - ctx.k1OrdinaryDividends,
  );

  // Form 8960 Part II, Line 9b — State/local income tax properly allocable to NII.
  // Reg §1.1411-4(f)(7): Allocate state/local income taxes pro-rata to investment income.
  // Formula: stateTaxPaid × (grossInvestmentIncome / AGI)
  let niitStateTaxDeduction = 0;
  if (grossInvestmentIncomeForNIIT > 0 && ctx.agi > 0) {
    const totalStateTaxPaid = round2(
      taxReturn.w2Income.reduce((sum, w) => sum + (w.stateTaxWithheld || 0), 0),
    );
    if (totalStateTaxPaid > 0) {
      niitStateTaxDeduction = round2(totalStateTaxPaid * (grossInvestmentIncomeForNIIT / ctx.agi));
    }
  }
  const investmentIncomeForNIIT = round2(Math.max(0, grossInvestmentIncomeForNIIT - niitStateTaxDeduction));
  ctx.niitTax = calculateNIIT(ctx.agi, investmentIncomeForNIIT, filingStatus);

  // Additional Medicare Tax
  const w2MedicareWages = taxReturn.w2Income.reduce((sum, w) => sum + (w.medicareWages || w.wages || 0), 0);
  const seNetEarnings = ctx.scheduleSE?.netEarnings || 0;
  ctx.additionalMedicareTaxW2 = calculateAdditionalMedicareTaxW2(w2MedicareWages, seNetEarnings, filingStatus);

  // Early Distribution Penalty — now computed via Form 5329 (includes SECURE 2.0 emergency exemption
  // and IRC §72(t)(2) partial exceptions for education, medical, first-time homebuyer, etc.)
  // Pre-compute here for standalone returns without excess contributions
  {
    let earlyDistTotal = 0;
    let earlyExceptionTotal = 0;
    for (const r of taxReturn.income1099R || []) {
      const code = (r.distributionCode || '7').toUpperCase();
      if (EARLY_DISTRIBUTION.PENALTY_CODES.includes(code)) {
        const taxable = Math.max(0, safeNum(r.taxableAmount));
        earlyDistTotal += taxable;
        // IRC §72(t)(2) partial exception — subtract exception amount before penalty
        if (r.earlyDistributionExceptionAmount && r.earlyDistributionExceptionAmount > 0) {
          earlyExceptionTotal += Math.min(Math.max(0, r.earlyDistributionExceptionAmount), taxable);
        }
      }
    }
    const penaltyBase = Math.max(0, earlyDistTotal - earlyExceptionTotal);
    const earlyDistributions = round2(penaltyBase * EARLY_DISTRIBUTION.PENALTY_RATE);
    // If there are emergency distributions, reduce penalty via Form 5329
    if (taxReturn.emergencyDistributions && earlyDistTotal > 0) {
      // Handled below in consolidated Form 5329 block
      ctx.earlyDistributionPenalty = 0; // will be set by Form 5329
    } else {
      ctx.earlyDistributionPenalty = earlyDistributions;
    }
  }

  // Kiddie Tax — iterate over all entries (backward compat: migrate legacy single field)
  const kiddieTaxEntries = taxReturn.kiddieTaxEntries?.length
    ? taxReturn.kiddieTaxEntries
    : taxReturn.kiddieTax && taxReturn.kiddieTax.childUnearnedIncome > 0
      ? [{ id: 'legacy', ...taxReturn.kiddieTax }]
      : [];
  for (const entry of kiddieTaxEntries) {
    if (entry.childUnearnedIncome > 0) {
      const result = calculateKiddieTax(entry);
      ctx.kiddieTaxResults.push(result);
      ctx.kiddieTaxAmount = round2(ctx.kiddieTaxAmount + result.additionalTax);
    }
  }

  // Schedule H
  if (taxReturn.householdEmployees && taxReturn.householdEmployees.totalCashWages > 0) {
    ctx.scheduleHResult = calculateScheduleH(taxReturn.householdEmployees);
    ctx.scheduleHTax = ctx.scheduleHResult.totalTax;
  }

  // Form 5329 — excess contribution penalties + early distribution penalties (with emergency exemption)
  const hasExcess = !!taxReturn.excessContributions;
  const hasEmergency = !!taxReturn.emergencyDistributions;
  const hasEarlyDist = (taxReturn.income1099R || []).some(r => EARLY_DISTRIBUTION.PENALTY_CODES.includes((r.distributionCode || '7').toUpperCase()));
  if (hasExcess || (hasEmergency && hasEarlyDist)) {
    // Apply corrective withdrawal choices — reduces effective excess before penalty calc
    let effectiveExcess = { ...(taxReturn.excessContributions || { iraExcessContribution: 0, hsaExcessContribution: 0 }) };

    // HSA corrective withdrawal — Per IRS Pub 969: withdrawing excess + earnings by filing deadline avoids the 6% excise tax
    const hsaWithdrawal = taxReturn.hsaExcessWithdrawal;
    if (hsaWithdrawal && (effectiveExcess.hsaExcessContribution || 0) > 0) {
      const rawExcess = effectiveExcess.hsaExcessContribution || 0;
      if (hsaWithdrawal.choice === 'full') {
        effectiveExcess = { ...effectiveExcess, hsaExcessContribution: 0 };
      } else if (hsaWithdrawal.choice === 'partial') {
        const withdrawn = Math.min(hsaWithdrawal.withdrawalAmount || 0, rawExcess);
        effectiveExcess = { ...effectiveExcess, hsaExcessContribution: round2(rawExcess - withdrawn) };
      }
      // Earnings on withdrawn excess are taxable as Other income (Pub 969, Form 8889 instructions).
      // Must also adjust totalIncome and AGI since those were computed in earlier sections.
      const hsaEarnings = hsaWithdrawal.earningsOnExcess || 0;
      if (hsaEarnings > 0) {
        ctx.otherIncome = round2(ctx.otherIncome + hsaEarnings);
        ctx.totalIncome = round2(ctx.totalIncome + hsaEarnings);
        ctx.agi = round2(ctx.agi + hsaEarnings);
        ctx.hsaExcessWithdrawalEarnings = hsaEarnings;
      }
    }

    // IRA corrective withdrawal — Per IRS Pub 590-A: withdrawing excess + NIA by filing deadline avoids the 6% excise tax
    const iraWithdrawal = taxReturn.iraExcessWithdrawal;
    if (iraWithdrawal && (effectiveExcess.iraExcessContribution || 0) > 0) {
      const rawExcess = effectiveExcess.iraExcessContribution || 0;
      if (iraWithdrawal.choice === 'full') {
        effectiveExcess = { ...effectiveExcess, iraExcessContribution: 0 };
      } else if (iraWithdrawal.choice === 'partial') {
        const withdrawn = Math.min(iraWithdrawal.withdrawalAmount || 0, rawExcess);
        effectiveExcess = { ...effectiveExcess, iraExcessContribution: round2(rawExcess - withdrawn) };
      }
      // Net income attributable to withdrawn IRA excess is taxable as Other income (Pub 590-A).
      const iraEarnings = iraWithdrawal.earningsOnExcess || 0;
      if (iraEarnings > 0) {
        ctx.otherIncome = round2(ctx.otherIncome + iraEarnings);
        ctx.totalIncome = round2(ctx.totalIncome + iraEarnings);
        ctx.agi = round2(ctx.agi + iraEarnings);
        ctx.iraExcessWithdrawalEarnings = iraEarnings;
      }
    }

    ctx.form5329Result = calculateForm5329(
      effectiveExcess,
      hasEmergency ? taxReturn.income1099R : undefined,
      taxReturn.emergencyDistributions,
    );
    ctx.excessContributionPenalty = round2(ctx.form5329Result.iraExciseTax + ctx.form5329Result.hsaExciseTax + ctx.form5329Result.esaExciseTax);
    // Override early distribution penalty if Form 5329 computed it (with emergency exemption)
    if (hasEmergency && hasEarlyDist) {
      ctx.earlyDistributionPenalty = ctx.form5329Result.earlyDistributionPenalty;
    }
  }

  // Form 4137 (unreported tips)
  if (taxReturn.form4137 && taxReturn.form4137.unreportedTips > 0) {
    ctx.form4137Result = calculateForm4137(taxReturn.form4137.unreportedTips, ctx.w2SSWages);
    ctx.form4137Tax = ctx.form4137Result.totalTax;
  }

  ctx.totalTaxBeforeCredits = round2(ctx.incomeTax + ctx.amtAmount + ctx.seTax + ctx.niitTax + ctx.additionalMedicareTaxW2 + ctx.earlyDistributionPenalty + ctx.hsaDistributionPenalty + ctx.kiddieTaxAmount + ctx.scheduleHTax + ctx.excessContributionPenalty + ctx.penalty529 + ctx.form4137Tax);

  // Trace: Total Tax Before Credits (intermediate — not Line 24)
  ctx.tb.trace('form1040.totalTaxBeforeCredits', 'Total Tax Before Credits', ctx.totalTaxBeforeCredits, {
    authority: 'Form 1040, Lines 16–23 (sum before non-refundable credits)',
    formula: 'Income Tax + SE Tax + NIIT + AMT + Additional Medicare + penalties',
    inputs: [
      { lineId: 'form1040.line16', label: 'Income Tax', value: ctx.incomeTax },
      ...(ctx.seTax > 0 ? [{ lineId: 'scheduleSE', label: 'Self-Employment Tax', value: ctx.seTax }] : []),
      ...(ctx.amtAmount > 0 ? [{ lineId: 'form6251', label: 'AMT', value: ctx.amtAmount }] : []),
      ...(ctx.niitTax > 0 ? [{ lineId: 'form8960', label: 'Net Investment Income Tax (3.8%)', value: ctx.niitTax }] : []),
      ...(ctx.additionalMedicareTaxW2 > 0 ? [{ lineId: 'form8959', label: 'Additional Medicare Tax (0.9%)', value: ctx.additionalMedicareTaxW2 }] : []),
      ...(ctx.earlyDistributionPenalty > 0 ? [{ lineId: 'form5329', label: 'Early Distribution Penalty', value: ctx.earlyDistributionPenalty }] : []),
    ],
  });
}

// ─── Section 9: Credits ───────────────────────────────────

export function calculateCreditsSection(ctx: Form1040Context): void {
  const { taxReturn, filingStatus } = ctx;
  const disc = taxReturn.incomeDiscovery || {};
  const isDeclined = (key: string) => disc[key] === 'no';

  ctx.earnedIncome = round2(ctx.totalWages + Math.max(0, ctx.scheduleCNetProfit) + Math.max(0, ctx.k1SEIncome) + Math.max(0, ctx.scheduleFNetProfit));

  // Form 8863 Line 7: Refundable AOTC excluded when filer was under 24 at year-end,
  // didn't provide more than half own support, has a living parent, and isn't MFJ/QSS.
  const aotcRefundableExcluded = (() => {
    if (filingStatus === FilingStatus.MarriedFilingJointly ||
        filingStatus === FilingStatus.QualifyingSurvivingSpouse) return false;
    if (!taxReturn.dateOfBirth) return false;
    const dob = parseDateString(taxReturn.dateOfBirth);
    if (!dob) return false;
    const yearEnd = taxReturn.taxYear || 2025;
    if (yearEnd - dob.year >= 24) return false; // 24 or older at year-end
    // Under 24: check support and parent conditions (default to not excluded if not specified)
    const providedHalfSupport = taxReturn.providedHalfOwnSupport ?? true;
    const hasLivingParent = taxReturn.hasLivingParent ?? true;
    return !providedHalfSupport && hasLivingParent;
  })();

  ctx.credits = calculateCredits(
    filingStatus,
    ctx.agi,
    isDeclined('child_credit') ? undefined : taxReturn.childTaxCredit,
    isDeclined('education_credit') ? [] : taxReturn.educationCredits,
    isDeclined('child_credit') ? [] : taxReturn.dependents,
    taxReturn.taxYear,
    ctx.earnedIncome,
    ctx.incomeTax,
    aotcRefundableExcluded,
  );

  // Dependent Care (Form 2441)
  if (!isDeclined('dependent_care') && taxReturn.dependentCare && taxReturn.dependentCare.totalExpenses > 0) {
    const spouseEarned = (filingStatus === FilingStatus.MarriedFilingJointly ||
        filingStatus === FilingStatus.QualifyingSurvivingSpouse)
      ? taxReturn.dependentCare.spouseEarnedIncome
      : undefined;

    const employerBenefits = taxReturn.dependentCare.employerBenefits
      ?? taxReturn.dependentCare.dependentCareFSA
      ?? undefined;

    const livedApartMFS = filingStatus === FilingStatus.MarriedFilingSeparately
      ? taxReturn.livedApartFromSpouse
      : undefined;

    ctx.dependentCareResult = calculateDependentCareCredit(
      taxReturn.dependentCare.totalExpenses,
      taxReturn.dependentCare.qualifyingPersons,
      ctx.agi,
      filingStatus,
      ctx.earnedIncome,
      spouseEarned,
      employerBenefits,
      taxReturn.dependentCare.isStudentSpouse,
      taxReturn.dependentCare.isDisabledSpouse,
      livedApartMFS,
    );
    if (ctx.dependentCareResult.credit > 0) {
      ctx.credits.dependentCareCredit = ctx.dependentCareResult.credit;
      ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.dependentCareResult.credit);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.dependentCareResult.credit);
    }
  }

  // Saver's Credit (Form 8880)
  if (!isDeclined('savers_credit') && taxReturn.saversCredit && taxReturn.saversCredit.totalContributions > 0) {
    ctx.saversCreditResult = calculateSaversCredit(
      taxReturn.saversCredit.totalContributions,
      ctx.agi,
      filingStatus,
      {
        dateOfBirth: taxReturn.dateOfBirth,
        spouseDateOfBirth: taxReturn.spouseDateOfBirth,
        taxYear: taxReturn.taxYear,
        isFullTimeStudent: taxReturn.isFullTimeStudent,
        isSpouseFullTimeStudent: taxReturn.isSpouseFullTimeStudent,
        isClaimedAsDependent: taxReturn.isClaimedAsDependent,
      },
    );
    if (ctx.saversCreditResult.credit > 0) {
      ctx.credits.saversCredit = ctx.saversCreditResult.credit;
      ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.saversCreditResult.credit);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.saversCreditResult.credit);
    }
  }

  // Scholarship Credit (IRC §25F)
  if (!isDeclined('scholarship_credit') && taxReturn.scholarshipCredit && taxReturn.scholarshipCredit.contributionAmount > 0) {
    ctx.scholarshipCreditResult = calculateScholarshipCredit(taxReturn.scholarshipCredit);
    if (ctx.scholarshipCreditResult.credit > 0) {
      ctx.credits.scholarshipCredit = ctx.scholarshipCreditResult.credit;
      ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.scholarshipCreditResult.credit);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.scholarshipCreditResult.credit);
    }
  }

  // Clean Energy (Form 5695, Part I)
  if (!isDeclined('clean_energy') && taxReturn.cleanEnergy) {
    ctx.cleanEnergyResult = calculateCleanEnergyCredit(taxReturn.cleanEnergy);
    if (ctx.cleanEnergyResult.totalAvailableCredit > 0) {
      ctx.credits.cleanEnergyCredit = ctx.cleanEnergyResult.totalAvailableCredit;
      ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.cleanEnergyResult.totalAvailableCredit);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.cleanEnergyResult.totalAvailableCredit);
    }
  }

  // EV Credit (Form 8936)
  // IRC §30D(f)(10): Income test uses lesser of current-year or prior-year MAGI
  if (!isDeclined('ev_credit') && taxReturn.evCredit) {
    const priorYearAgiForEV = taxReturn.priorYearSummary?.agi;
    ctx.evCreditResult = calculateEVCredit(taxReturn.evCredit, ctx.agi, filingStatus, priorYearAgiForEV);
    if (ctx.evCreditResult.credit > 0) {
      ctx.credits.evCredit = ctx.evCreditResult.credit;
      ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.evCreditResult.credit);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.evCreditResult.credit);
    }
  }

  // Energy Efficiency (Form 5695, Part II)
  if (!isDeclined('energy_efficiency') && taxReturn.energyEfficiency) {
    ctx.energyEfficiencyResult = calculateEnergyEfficiencyCredit(taxReturn.energyEfficiency);
    if (ctx.energyEfficiencyResult.credit > 0) {
      ctx.credits.energyEfficiencyCredit = ctx.energyEfficiencyResult.credit;
      ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.energyEfficiencyResult.credit);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.energyEfficiencyResult.credit);
    }
  }

  // Foreign Tax Credit (Form 1116)
  // Include K-1 Box 15 foreign taxes alongside 1099-DIV foreign taxes
  const divForeignTaxPaid = round2(taxReturn.income1099DIV.reduce(
    (sum, d) => sum + (d.foreignTaxPaid || 0), 0,
  ));
  ctx.totalForeignTaxPaid = round2(divForeignTaxPaid + ctx.k1ForeignTaxPaid);
  if (ctx.totalForeignTaxPaid > 0) {
    // Foreign source income: use supplemental foreignSourceIncome when available,
    // otherwise fall back to total ordinary dividends from funds with foreign tax paid.
    // For K-1 foreign tax, the related foreign source income is estimated as the K-1 ordinary income
    // from entities that reported foreign tax. A precise allocation would require per-entity tracking.
    const divForeignSourceIncome = round2(taxReturn.income1099DIV.reduce(
      (sum, d) => (d.foreignTaxPaid && d.foreignTaxPaid > 0)
        ? sum + safeNum(d.foreignSourceIncome ?? d.ordinaryDividends) : sum, 0,
    ));
    const k1ForeignSourceIncome = ctx.k1ForeignTaxPaid > 0
      ? round2(ctx.k1OrdinaryIncome + ctx.k1Interest + ctx.k1OrdinaryDividends)
      : 0;
    const grossForeignSourceIncome = round2(divForeignSourceIncome + k1ForeignSourceIncome);

    // Form 1116 Lines 3a-3g: Pro-rata deduction allocation to foreign source income.
    // A proportional share of the standard/itemized deduction reduces foreign source income.
    const proRataDeduction = ctx.totalIncome > 0
      ? round2(ctx.deductionAmount * (grossForeignSourceIncome / ctx.totalIncome))
      : 0;
    const foreignSourceIncome = round2(Math.max(0, grossForeignSourceIncome - proRataDeduction));

    ctx.foreignTaxCreditResult = calculateForeignTaxCredit(
      ctx.totalForeignTaxPaid,
      foreignSourceIncome,
      Math.max(0, ctx.taxableIncome),
      ctx.incomeTax,
      filingStatus,
      taxReturn.foreignTaxCreditCategories,
    );
    if (ctx.foreignTaxCreditResult.creditAllowed > 0) {
      ctx.credits.foreignTaxCredit = ctx.foreignTaxCreditResult.creditAllowed;
      ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.foreignTaxCreditResult.creditAllowed);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.foreignTaxCreditResult.creditAllowed);

      // Form 6251 Line 10: regular tax minus FTC before AMT comparison.
      // AMT was computed in Section 7 before FTC was known, so adjust now.
      if (ctx.amtResult) {
        ctx.amtResult = adjustAMTForRegularFTC(ctx.amtResult, ctx.foreignTaxCreditResult.creditAllowed);
        ctx.amtAmount = ctx.amtResult.amtAmount;
      }
    }
  }

  // Excess SS Tax Credit — IRC §31(b), Schedule 3 Line 11
  // Excess SS applies per-person: each taxpayer's total SS withholding is capped at MAX_SS_TAX.
  // For MFJ, primary and spouse W-2s are grouped separately using the isSpouse flag.
  // For non-MFJ, all W-2s belong to one person.
  {
    const primarySSTax = round2(taxReturn.w2Income
      .filter(w => !w.isSpouse)
      .reduce((sum, w) => sum + (w.socialSecurityTax || 0), 0));
    const spouseSSTax = round2(taxReturn.w2Income
      .filter(w => w.isSpouse)
      .reduce((sum, w) => sum + (w.socialSecurityTax || 0), 0));
    const primaryExcess = round2(Math.max(0, primarySSTax - EXCESS_SS_TAX.MAX_SS_TAX));
    const spouseExcess = round2(Math.max(0, spouseSSTax - EXCESS_SS_TAX.MAX_SS_TAX));
    const excessSSCredit = round2(primaryExcess + spouseExcess);
    if (excessSSCredit > 0) {
      ctx.credits.excessSSTaxCredit = excessSSCredit;
      ctx.credits.totalRefundable = round2(ctx.credits.totalRefundable + excessSSCredit);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + excessSSCredit);
    }
  }

  // Adoption Credit (Form 8839)
  if (!isDeclined('adoption_credit') && taxReturn.adoptionCredit && (taxReturn.adoptionCredit.qualifiedExpenses > 0 || taxReturn.adoptionCredit.isSpecialNeeds)) {
    ctx.adoptionCreditResult = calculateAdoptionCredit(taxReturn.adoptionCredit, ctx.agi);
    if (ctx.adoptionCreditResult.credit > 0) {
      ctx.credits.adoptionCredit = ctx.adoptionCreditResult.credit;
      ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.adoptionCreditResult.credit);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.adoptionCreditResult.credit);
    }
  }

  // EV Refueling (Form 8911)
  if (!isDeclined('ev_refueling') && taxReturn.evRefuelingCredit?.properties?.length) {
    ctx.evRefuelingResult = calculateEVRefuelingCredit(taxReturn.evRefuelingCredit);
    if (ctx.evRefuelingResult.totalCredit > 0) {
      ctx.credits.evRefuelingCredit = ctx.evRefuelingResult.totalCredit;
      ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.evRefuelingResult.totalCredit);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.evRefuelingResult.totalCredit);
    }
  }

  // Schedule R (Elderly/Disabled Credit)
  if (!isDeclined('elderly_disabled') && taxReturn.scheduleR) {
    ctx.scheduleRResult = calculateScheduleR(taxReturn.scheduleR, ctx.agi, filingStatus);
    if (ctx.scheduleRResult.credit > 0) {
      ctx.credits.elderlyDisabledCredit = ctx.scheduleRResult.credit;
      ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.scheduleRResult.credit);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.scheduleRResult.credit);
    }
  }

  // Prior Year Minimum Tax Credit (Form 8801)
  if (!isDeclined('prior_year_amt_credit') && taxReturn.form8801) {
    const netInput = (taxReturn.form8801.netPriorYearMinimumTax || 0) + (taxReturn.form8801.priorYearCreditCarryforward || 0);
    if (netInput > 0) {
      ctx.form8801Result = calculateForm8801Credit(
        taxReturn.form8801,
        ctx.incomeTax,
        ctx.amtAmount,
      );
      if (ctx.form8801Result.credit > 0) {
        ctx.credits.priorYearMinTaxCredit = ctx.form8801Result.credit;
        ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.form8801Result.credit);
        ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.form8801Result.credit);
      }
    }
  }

  // PTC (Form 8962)
  if (!isDeclined('premium_tax_credit') && taxReturn.premiumTaxCredit && taxReturn.premiumTaxCredit.forms1095A?.length > 0) {
    const ssaTotal = taxReturn.incomeSSA1099?.totalBenefits || 0;
    const nonTaxableSS = round2(ssaTotal - ctx.taxableSocialSecurity);
    const ptcHouseholdIncome = calculatePTCHouseholdIncome(ctx.agi, ctx.feieExclusion, ctx.taxExemptInterest, nonTaxableSS);

    ctx.ptcResult = calculatePremiumTaxCredit(taxReturn.premiumTaxCredit, ptcHouseholdIncome, filingStatus);

    if (ctx.ptcResult.netPTC > 0) {
      ctx.premiumTaxCreditNet = ctx.ptcResult.netPTC;
      ctx.credits.premiumTaxCredit = ctx.premiumTaxCreditNet;
      ctx.credits.totalRefundable = round2(ctx.credits.totalRefundable + ctx.premiumTaxCreditNet);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.premiumTaxCreditNet);
    }
    ctx.excessAPTCRepayment = ctx.ptcResult.excessAPTCRepayment;
  }

  // K-1 Box 15 — Other partner credits (non-refundable)
  if (ctx.k1OtherCredits > 0) {
    ctx.credits.k1OtherCredits = ctx.k1OtherCredits;
    ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable + ctx.k1OtherCredits);
    ctx.credits.totalCredits = round2(ctx.credits.totalCredits + ctx.k1OtherCredits);
  }

  // EITC
  const ctcChildrenFallback = taxReturn.childTaxCredit?.qualifyingChildren || 0;
  const qualifyingChildrenForEITC = countEITCQualifyingChildren(taxReturn.dependents, taxReturn.taxYear, ctcChildrenFallback);
  // EITC investment income per IRS Pub 596 includes: taxable + tax-exempt interest,
  // ordinary dividends, capital gain net income (Schedule D line 7), and net rental/royalty income.
  const scheduleDNetGain = ctx.scheduleD ? Math.max(0, ctx.scheduleD.netGainOrLoss) : 0;
  const k1CapitalGains = round2(Math.max(0, ctx.k1ShortTermGain) + Math.max(0, ctx.k1LongTermGain));
  const rentalRoyaltyNet = ctx.scheduleEResult
    ? round2(Math.max(0, ctx.scheduleEResult.netRentalIncome) + Math.max(0, ctx.scheduleEResult.royaltyIncome - (ctx.scheduleEResult.totalRoyaltyExpenses || 0)))
    : 0;
  const taxExemptInterest = taxReturn.income1099INT.reduce((sum, i) => sum + (i.taxExemptInterest || 0), 0);
  // Capital gain distributions now included in scheduleDNetGain (via Schedule D Line 13)
  const investmentIncomeForEITC = round2(
    ctx.allInterest + taxExemptInterest + ctx.allOrdinaryDividends +
    scheduleDNetGain + k1CapitalGains + rentalRoyaltyNet,
  );
  // Combat pay EITC election — IRC §32(c)(2)(B)(vi)
  // Taxpayers with nontaxable combat pay (W-2 Box 12 code Q) may elect to
  // include it in earned income for EITC purposes. This can increase or decrease
  // the credit. When elected, compute EITC with combat pay added to earned income.
  let eitcEarnedIncome = ctx.earnedIncome;
  if (taxReturn.includeCombatPayForEITC && taxReturn.nontaxableCombatPay && taxReturn.nontaxableCombatPay > 0) {
    eitcEarnedIncome = round2(ctx.earnedIncome + taxReturn.nontaxableCombatPay);
  }
  const eitcCredit = calculateEITC(filingStatus, eitcEarnedIncome, ctx.agi, qualifyingChildrenForEITC, investmentIncomeForEITC, taxReturn.dateOfBirth, taxReturn.taxYear, taxReturn.livedApartFromSpouse);

  ctx.credits.eitcCredit = eitcCredit;
  ctx.credits.totalRefundable = round2(ctx.credits.totalRefundable + eitcCredit);
  ctx.credits.totalCredits = round2(ctx.credits.totalCredits + eitcCredit);
}

// ─── Section 10: Liability ────────────────────────────────

export function calculateLiabilitySection(ctx: Form1040Context): void {
  const { taxReturn } = ctx;

  // Apply non-refundable credits against income tax + AMT + excess APTC repayment
  // (Form 1040 Lines 16 + 17 = Line 18, then Line 22 = Line 18 − credits),
  // then add other taxes (SE, NIIT, etc.) from Schedule 2 Part II (Line 23).
  // Line 24 = Line 22 + Line 23.
  // Per IRS Form 1040: Line 17 = Schedule 2, Part I, Line 3 = AMT + excess APTC.
  ctx.taxAfterNonRefundable = round2(
    Math.max(0, ctx.incomeTax + ctx.amtAmount + ctx.excessAPTCRepayment - ctx.credits.totalNonRefundable) +
    ctx.seTax + ctx.niitTax + ctx.additionalMedicareTaxW2 + ctx.earlyDistributionPenalty + ctx.hsaDistributionPenalty +
    ctx.kiddieTaxAmount + ctx.scheduleHTax + ctx.excessContributionPenalty + ctx.penalty529 + ctx.form4137Tax,
  );

  // Clean Energy Credit carryforward — IRC §25D(c)
  if (ctx.cleanEnergyResult && ctx.cleanEnergyResult.totalAvailableCredit > 0) {
    const taxBeforeCredits = round2(ctx.incomeTax + ctx.amtAmount);
    const unusedNonRefundable = round2(Math.max(0, ctx.credits.totalNonRefundable - taxBeforeCredits));
    if (unusedNonRefundable > 0) {
      const cleanEnergyUnused = round2(Math.min(unusedNonRefundable, ctx.cleanEnergyResult.totalAvailableCredit));
      const cleanEnergyUsed = round2(ctx.cleanEnergyResult.totalAvailableCredit - cleanEnergyUnused);
      ctx.cleanEnergyResult.credit = cleanEnergyUsed;
      ctx.cleanEnergyResult.carryforwardToNextYear = cleanEnergyUnused;
      ctx.credits.cleanEnergyCredit = cleanEnergyUsed;
      ctx.credits.totalNonRefundable = round2(ctx.credits.totalNonRefundable - cleanEnergyUnused);
      ctx.credits.totalCredits = round2(ctx.credits.totalCredits - cleanEnergyUnused);
    } else {
      ctx.cleanEnergyResult.credit = ctx.cleanEnergyResult.totalAvailableCredit;
      ctx.cleanEnergyResult.carryforwardToNextYear = 0;
    }
  }

  // Form 1040 Line 24 — Total Tax (after non-refundable credits)
  // Line 24 = max(0, incomeTax + AMT − nonRefundableCredits) + SE + NIIT + other taxes
  ctx.totalTax = ctx.taxAfterNonRefundable;

  ctx.tb.trace('form1040.line24', 'Total Tax', ctx.totalTax, {
    authority: 'Form 1040, Line 24',
    formula: 'max(0, Income Tax + AMT − Non-Refundable Credits) + SE Tax + NIIT + other taxes',
    inputs: [
      { lineId: 'form1040.line16', label: 'Income Tax', value: ctx.incomeTax },
      ...(ctx.amtAmount > 0 ? [{ lineId: 'form6251', label: 'AMT', value: ctx.amtAmount }] : []),
      ...(ctx.credits.totalNonRefundable > 0 ? [{ lineId: 'form1040.line21', label: 'Non-Refundable Credits', value: -ctx.credits.totalNonRefundable }] : []),
      ...(ctx.seTax > 0 ? [{ lineId: 'scheduleSE', label: 'Self-Employment Tax', value: ctx.seTax }] : []),
      ...(ctx.niitTax > 0 ? [{ lineId: 'form8960', label: 'Net Investment Income Tax (3.8%)', value: ctx.niitTax }] : []),
      ...(ctx.additionalMedicareTaxW2 > 0 ? [{ lineId: 'form8959', label: 'Additional Medicare Tax (0.9%)', value: ctx.additionalMedicareTaxW2 }] : []),
    ],
  });

  // Refundable credits
  ctx.taxAfterCredits = round2(ctx.taxAfterNonRefundable - ctx.credits.totalRefundable);

  // Withholding & payments — split W-2 vs 1099/other for Lines 25a/25b
  ctx.w2Withholding = round2(
    taxReturn.w2Income.reduce((sum, w) => sum + (w.federalTaxWithheld || 0), 0),
  );
  ctx.form1099Withholding = round2(
    taxReturn.income1099NEC.reduce((sum, i) => sum + (i.federalTaxWithheld || 0), 0) +
    taxReturn.income1099K.reduce((sum, i) => sum + (i.federalTaxWithheld || 0), 0) +
    taxReturn.income1099INT.reduce((sum, i) => sum + (i.federalTaxWithheld || 0), 0) +
    taxReturn.income1099DIV.reduce((sum, i) => sum + (i.federalTaxWithheld || 0), 0) +
    (taxReturn.income1099R || []).reduce((sum, r) => sum + (r.federalTaxWithheld || 0), 0) +
    (taxReturn.income1099G || []).reduce((sum, g) => sum + (g.federalTaxWithheld || 0), 0) +
    (taxReturn.income1099MISC || []).reduce((sum, m) => sum + (m.federalTaxWithheld || 0), 0) +
    (taxReturn.income1099B || []).reduce((sum, b) => sum + (b.federalTaxWithheld || 0), 0) +
    (taxReturn.incomeSSA1099?.federalTaxWithheld || 0) +
    (taxReturn.incomeK1 || []).reduce((sum, k) => sum + (k.federalTaxWithheld || 0), 0) +
    (taxReturn.income1099SA || []).reduce((sum, s) => sum + (s.federalTaxWithheld || 0), 0) +
    (taxReturn.incomeW2G || []).reduce((sum, g) => sum + (g.federalTaxWithheld || 0), 0) +
    (taxReturn.income1099DA || []).reduce((sum, d) => sum + (d.federalTaxWithheld || 0), 0) +
    (taxReturn.income1099C || []).reduce((sum, c) => sum + (c.federalTaxWithheld || 0), 0),
  );
  // Form 8959 Part III — Withholding credit for excess Medicare tax withheld.
  // Computes excess over regular 1.45% rate (may include Additional Medicare Tax
  // the employer withheld on wages > $200K, or any other over-withholding).
  // Applies whenever Medicare tax was withheld, even if no Additional Medicare Tax
  // is owed — the credit is about excess withholding, not excess liability.
  // IRC §3102(f)(2): excess Medicare tax withheld treated as income tax withheld.
  // Flows to Form 1040 Line 25d as an additional payment.
  {
    const totalMedicareTaxWithheld = round2(
      taxReturn.w2Income.reduce((sum, w) => sum + (w.medicareTax || 0), 0),
    );
    if (totalMedicareTaxWithheld > 0) {
      const totalMedicareWages = round2(
        taxReturn.w2Income.reduce((sum, w) => sum + (w.medicareWages || w.wages || 0), 0),
      );
      const regularMedicareTax = round2(totalMedicareWages * FORM_4137.MEDICARE_RATE);
      ctx.form8959WithholdingCredit = round2(Math.max(0, totalMedicareTaxWithheld - regularMedicareTax));
    }
  }

  // Form 1040 Lines 25d/33 use whole-dollar amounts per IRS instructions.
  // The excess-Medicare withholding credit (Form 8959) can introduce fractional
  // cents from the 1.45% rate, so we round to whole dollars here.
  ctx.totalWithholding = Math.round(ctx.w2Withholding + ctx.form1099Withholding + ctx.form8959WithholdingCredit);

  ctx.estimatedPayments = taxReturn.estimatedQuarterlyPayments
    ? round2(taxReturn.estimatedQuarterlyPayments.reduce((sum, q) => sum + (q || 0), 0))
    : safeNum(taxReturn.estimatedPaymentsMade);
  ctx.totalPayments = Math.round(ctx.totalWithholding + ctx.estimatedPayments);

  // Estimated Tax Penalty (Form 2210)
  // Always compute — when priorYearTax is undefined, uses 90% current-year test only.
  ctx.estimatedTaxPenaltyResult = calculateEstimatedTaxPenalty(
    Math.max(0, ctx.taxAfterCredits),
    ctx.totalPayments,
    taxReturn.priorYearTax,
    ctx.agi,
    ctx.filingStatus,
    taxReturn.annualizedIncome,
  );
  ctx.estimatedTaxPenalty = ctx.estimatedTaxPenaltyResult.penalty;

  // Balance — excess APTC repayment is already included in totalTax (Line 24)
  // via taxAfterNonRefundable (Line 17 → Line 18 → Line 22 → Line 24).
  ctx.balance = round2(ctx.taxAfterCredits + ctx.estimatedTaxPenalty - ctx.totalPayments);
  ctx.amountOwed = ctx.balance > 0 ? ctx.balance : 0;
  ctx.refundAmount = ctx.balance < 0 ? Math.abs(ctx.balance) : 0;

  // Line 36: Apply refund to next year's estimated tax
  const requestedApply = Math.max(0, taxReturn.refundAppliedToNextYear || 0);
  ctx.refundAppliedToNextYear = round2(Math.min(requestedApply, ctx.refundAmount));
  ctx.netRefund = round2(ctx.refundAmount - ctx.refundAppliedToNextYear);

  // Effective rate
  ctx.effectiveTaxRate = ctx.totalIncome > 0
    ? round2((Math.max(0, ctx.taxAfterCredits) / ctx.totalIncome) * 100) / 100
    : 0;

  // Estimated quarterly
  const { quarterlyPayment } = calculateEstimatedQuarterly(Math.max(0, ctx.taxAfterCredits), ctx.totalWithholding);
  ctx.quarterlyPayment = quarterlyPayment;

  const isRefund = ctx.refundAmount > 0;

  // Trace: Credits, Payments, Bottom Line
  if (ctx.credits.totalCredits > 0) {
    ctx.tb.trace('form1040.line21', 'Total Credits', ctx.credits.totalCredits, {
      authority: 'Form 1040, Lines 19-21; Schedule 3',
      formula: 'Non-refundable + Refundable credits',
      inputs: [
        ...(ctx.credits.childTaxCredit > 0 ? [{ lineId: 'credits.ctc', label: 'Child Tax Credit', value: ctx.credits.childTaxCredit }] : []),
        ...(ctx.credits.actcCredit > 0 ? [{ lineId: 'credits.actc', label: 'Additional Child Tax Credit', value: ctx.credits.actcCredit }] : []),
        ...(ctx.credits.educationCredit > 0 ? [{ lineId: 'credits.education', label: 'Education Credit', value: ctx.credits.educationCredit }] : []),
        ...(ctx.credits.eitcCredit > 0 ? [{ lineId: 'credits.eitc', label: 'Earned Income Tax Credit', value: ctx.credits.eitcCredit }] : []),
        ...(ctx.credits.dependentCareCredit > 0 ? [{ lineId: 'credits.depCare', label: 'Dependent Care Credit', value: ctx.credits.dependentCareCredit }] : []),
        ...(ctx.credits.saversCredit > 0 ? [{ lineId: 'credits.savers', label: "Saver's Credit", value: ctx.credits.saversCredit }] : []),
        ...(ctx.credits.cleanEnergyCredit > 0 ? [{ lineId: 'credits.cleanEnergy', label: 'Clean Energy Credit', value: ctx.credits.cleanEnergyCredit }] : []),
        ...(ctx.credits.foreignTaxCredit > 0 ? [{ lineId: 'credits.ftc', label: 'Foreign Tax Credit', value: ctx.credits.foreignTaxCredit }] : []),
      ],
    });
  }
  ctx.tb.trace('form1040.line37', isRefund ? 'Refund' : 'Amount Owed', isRefund ? ctx.refundAmount : ctx.amountOwed, {
    authority: isRefund ? 'Form 1040, Line 34' : 'Form 1040, Line 37',
    formula: 'Total Tax − Credits − Payments',
    inputs: [
      { lineId: 'form1040.line24', label: 'Total Tax', value: ctx.totalTax },
      ...(ctx.credits.totalCredits > 0 ? [{ lineId: 'form1040.line21', label: 'Total Credits', value: ctx.credits.totalCredits }] : []),
      ...(ctx.totalPayments > 0 ? [{ lineId: 'form1040.line33', label: 'Total Payments', value: ctx.totalPayments }] : []),
    ],
    note: isRefund
      ? `Refund of $${ctx.refundAmount.toLocaleString()}`
      : ctx.amountOwed > 0 ? `Amount owed: $${ctx.amountOwed.toLocaleString()}` : 'No balance due',
  });
}

// ─── Output Assembly ──────────────────────────────────────

export function assembleForm1040Result(ctx: Form1040Context): CalculationResult {
  const { taxReturn } = ctx;
  const ssaBenefits = taxReturn.incomeSSA1099?.totalBenefits || 0;
  const capitalGainOrLoss = round2(ctx.scheduleDNetGain - ctx.capitalLossDeduction);

  const form1040: Form1040Result = {
    totalWages: round2(ctx.totalWages),
    totalInterest: round2(ctx.allInterest),
    taxExemptInterest: round2(ctx.taxExemptInterest),
    totalDividends: round2(ctx.allOrdinaryDividends),
    qualifiedDividends: round2(ctx.allQualifiedDividends),
    totalCapitalGainDistributions: round2(ctx.totalCapitalGainDistributions),
    scheduleDNetGain: round2(ctx.scheduleDNetGain),
    capitalLossDeduction: round2(ctx.capitalLossDeduction),
    capitalGainOrLoss,
    taxableSocialSecurity: round2(ctx.taxableSocialSecurity),
    socialSecurityBenefits: round2(ssaBenefits),
    scheduleEIncome: round2(ctx.scheduleEIncome),
    royaltyIncome: round2(ctx.scheduleEResult?.royaltyIncome || 0),
    totalRetirementIncome: round2(ctx.totalRetirementIncome),
    iraDistributionsGross: round2(ctx.iraDistributionsGross),
    iraDistributionsTaxable: round2(ctx.iraDistributionsTaxable),
    totalQCD: round2(ctx.totalQCD),
    pensionDistributionsGross: round2(ctx.pensionDistributionsGross),
    pensionDistributionsTaxable: round2(ctx.pensionDistributionsTaxable),
    totalUnemployment: round2(ctx.totalUnemployment),
    total1099MISCIncome: round2(ctx.total1099MISCIncome),
    scheduleCNetProfit: round2(ctx.scheduleCNetProfit),
    rothConversionTaxable: round2(ctx.form8606Result?.taxableConversion || 0),
    additionalIncome: round2(
      ctx.scheduleCNetProfit + ctx.scheduleFNetProfit + ctx.scheduleEIncome +
      ctx.totalUnemployment + ctx.total1099MISCIncome + ctx.totalGamblingIncome +
      ctx.cancellationOfDebtIncome + ctx.alimonyReceivedIncome + ctx.taxable529Income +
      ctx.form4797OrdinaryIncome + ctx.form4797OrdinaryLoss + ctx.otherIncome
    ),
    k1OrdinaryIncome: round2(ctx.k1OrdinaryIncome),
    k1SEIncome: round2(ctx.k1SEIncome),
    hsaDistributionTaxable: round2(ctx.hsaDistributionTaxable),
    hsaDistributionPenalty: round2(ctx.hsaDistributionPenalty),
    totalIncome: round2(ctx.totalIncome),

    seDeduction: ctx.seDeductibleHalf,
    selfEmployedHealthInsurance: ctx.selfEmployedHealthInsurance,
    retirementContributions: ctx.retirementContributions,
    hsaDeduction: ctx.hsaDeduction,
    hsaDeductionComputed: taxReturn.hsaContribution ? ctx.hsaDeduction : 0,
    archerMSADeduction: ctx.archerMSADeduction,
    studentLoanInterest: ctx.studentLoanInterest,
    iraDeduction: ctx.iraDeduction,
    educatorExpenses: ctx.educatorExpenses,
    earlyWithdrawalPenalty: ctx.earlyWithdrawalPenalty,
    movingExpenses: round2(ctx.movingExpenses),
    feieExclusion: round2(ctx.feieExclusion),
    nolDeduction: round2(ctx.nolDeduction),
    alimonyDeduction: ctx.alimonyDeduction,
    totalAdjustments: ctx.totalAdjustments,

    agi: ctx.agi,
    standardDeduction: ctx.standardDeduction,
    itemizedDeduction: ctx.itemizedDeduction,
    deductionUsed: ctx.deductionUsed,
    deductionAmount: ctx.deductionAmount,
    qbiDeduction: ctx.qbiDeduction,
    schedule1ADeduction: round2(ctx.schedule1ADeduction),
    homeSaleExclusion: round2(ctx.homeSaleResult?.exclusionAmount || 0),
    taxableIncome: ctx.taxableIncome,

    incomeTax: ctx.incomeTax,
    preferentialTax: ctx.preferentialTax,
    section1250Tax: ctx.section1250Tax,
    amtAmount: round2(ctx.amtAmount),
    seTax: ctx.seTax,
    niitTax: ctx.niitTax,
    additionalMedicareTaxW2: ctx.additionalMedicareTaxW2,
    earlyDistributionPenalty: ctx.earlyDistributionPenalty,
    kiddieTaxAmount: round2(ctx.kiddieTaxAmount),
    householdEmploymentTax: round2(ctx.scheduleHTax),
    estimatedTaxPenalty: round2(ctx.estimatedTaxPenalty),
    totalTax: ctx.totalTax,

    totalCredits: ctx.credits.totalCredits,
    taxAfterCredits: Math.max(0, ctx.taxAfterCredits),

    w2Withholding: ctx.w2Withholding,
    form1099Withholding: ctx.form1099Withholding,
    form8959WithholdingCredit: ctx.form8959WithholdingCredit,
    totalWithholding: ctx.totalWithholding,
    estimatedPayments: ctx.estimatedPayments,
    totalPayments: ctx.totalPayments,

    amountOwed: ctx.amountOwed,
    refundAmount: ctx.refundAmount,
    refundAppliedToNextYear: ctx.refundAppliedToNextYear,
    netRefund: ctx.netRefund,

    totalGamblingIncome: round2(ctx.totalGamblingIncome),

    cancellationOfDebtIncome: round2(ctx.cancellationOfDebtIncome),
    investmentInterestDeduction: round2(ctx.investmentInterestDeduction),

    alimonyReceivedIncome: round2(ctx.alimonyReceivedIncome),
    excessContributionPenalty: round2(ctx.excessContributionPenalty),
    taxable529Income: round2(ctx.taxable529Income),
    penalty529: round2(ctx.penalty529),
    k1Section179Deduction: round2(ctx.k1Section179Deduction),

    premiumTaxCreditNet: round2(ctx.premiumTaxCreditNet),
    excessAPTCRepayment: round2(ctx.excessAPTCRepayment),

    form4797OrdinaryIncome: round2(ctx.form4797OrdinaryIncome),
    form4797Section1231GainOrLoss: round2(ctx.form4797Section1231GainOrLoss),

    form4137Tax: round2(ctx.form4137Tax),

    scheduleFNetProfit: round2(ctx.scheduleFNetProfit),

    foreignTaxPaid: round2(ctx.totalForeignTaxPaid),
    extensionFiled: !!taxReturn.extensionFiled,

    solo401kCalculation: ctx.solo401kResult,
    sepIRACalculation: ctx.sepIRAResult,

    effectiveTaxRate: ctx.effectiveTaxRate,
    marginalTaxRate: ctx.marginalTaxRate,
    estimatedQuarterlyPayment: ctx.quarterlyPayment,
  };

  // ── Form 982 Part II: Attribute Reduction ──────────────────────────
  // Must run after all attributes are computed. Per IRC §108(b)(2), the
  // excluded debt amount reduces tax attributes in mandatory order.
  if (ctx.form982Result && ctx.form982Result.exclusionAmount > 0) {
    // Gather available tax attributes from the completed calculation
    const nol = ctx.nolDeduction + Math.max(0, safeNum(taxReturn.nolCarryforward) - ctx.nolDeduction);
    // Capital loss includes both current-year Schedule D loss and prior-year carryforward.
    // When Schedule D isn't computed (no transactions), fall back to TaxReturn carryforward.
    const capitalLoss = ctx.scheduleD
      ? (ctx.scheduleD.capitalLossDeduction + ctx.scheduleD.capitalLossCarryforward)
      : (safeNum(taxReturn.capitalLossCarryforward)
        + safeNum(taxReturn.capitalLossCarryforwardST)
        + safeNum(taxReturn.capitalLossCarryforwardLT));
    const passiveActivityLoss = ctx.form8582Result
      ? Math.abs(ctx.form8582Result.totalPassiveLoss) - ctx.form8582Result.allowedPassiveLoss
      : 0;

    ctx.form982Result = applyAttributeReduction(ctx.form982Result, {
      nol,
      capitalLoss,
      passiveActivityLoss,
    });
  }

  const federalResult: CalculationResult = {
    scheduleC: ctx.scheduleC,
    scheduleSE: ctx.scheduleSE,
    scheduleA: ctx.scheduleA,
    scheduleD: ctx.scheduleD,
    socialSecurity: ctx.socialSecurityResult,
    scheduleE: ctx.scheduleEResult,
    dependentCare: ctx.dependentCareResult,
    saversCreditResult: ctx.saversCreditResult,
    cleanEnergy: ctx.cleanEnergyResult,
    evCredit: ctx.evCreditResult,
    energyEfficiency: ctx.energyEfficiencyResult,
    foreignTaxCredit: ctx.foreignTaxCreditResult,
    k1Routing: ctx.k1Routing,
    hsaDistributions: ctx.hsaDistResult ? { totalTaxable: ctx.hsaDistResult.totalTaxable, totalPenalty: ctx.hsaDistResult.totalPenalty } : undefined,
    form8606: ctx.form8606Result ? { taxableConversion: ctx.form8606Result.taxableConversion, nonTaxableDistributions: ctx.form8606Result.nonTaxableDistributions, taxableDistributions: ctx.form8606Result.taxableDistributions, regularDistributions: ctx.form8606Result.regularDistributions, remainingBasis: ctx.form8606Result.remainingBasis } : undefined,
    estimatedTaxPenalty: ctx.estimatedTaxPenaltyResult,
    kiddieTax: ctx.kiddieTaxAmount > 0 ? { additionalTax: ctx.kiddieTaxAmount, childTaxableUnearned: ctx.kiddieTaxResults.reduce((s, r) => s + r.unearnedIncomeAboveThreshold, 0) } : undefined,
    kiddieTaxEntries: ctx.kiddieTaxResults.filter(r => r.applies).map((r, i) => {
      const sourceEntries = taxReturn.kiddieTaxEntries?.length ? taxReturn.kiddieTaxEntries : [];
      return {
        childName: sourceEntries[i]?.childName,
        additionalTax: r.additionalTax,
        childTaxableUnearned: r.unearnedIncomeAboveThreshold,
      };
    }),
    feie: ctx.feieResult ? { incomeExclusion: ctx.feieResult.incomeExclusion, housingExclusion: ctx.feieResult.housingExclusion } : undefined,
    scheduleH: ctx.scheduleHResult,
    adoptionCredit: ctx.adoptionCreditResult,
    evRefuelingCredit: ctx.evRefuelingResult,
    scholarshipCredit: ctx.scholarshipCreditResult,
    form4797: ctx.form4797Result,
    form4137: ctx.form4137Result,
    scheduleF: ctx.scheduleFResult,
    scheduleR: ctx.scheduleRResult,
    form8801: ctx.form8801Result,
    archerMSA: ctx.archerMSAResult,
    hohValidation: ctx.hohValidation,
    deceasedSpouseValidation: ctx.deceasedSpouseValidation,
    premiumTaxCredit: ctx.ptcResult,
    schedule1A: ctx.schedule1AResult,
    homeSale: ctx.homeSaleResult,
    form982: ctx.form982Result,
    investmentInterest: ctx.investmentInterestResult,
    form8283: ctx.scheduleA?.form8283,
    form5329: ctx.form5329Result,
    solo401k: ctx.solo401kResult,
    sepIRA: ctx.sepIRAResult,
    form7206: ctx.form7206Result,
    amt: ctx.amtResult,
    form8582: ctx.form8582Result,
    credits: ctx.credits,
    form1040,
    ...(ctx.traceOptions?.enabled ? { traces: ctx.tb.build() } : {}),
  };

  return federalResult;
}

// ─── Helper Functions (exported for form1040.ts) ──────────

/**
 * Student loan interest deduction with income phase-out.
 */
export function calculateStudentLoanDeduction(amount: number, income: number, filingStatus: FilingStatus): number {
  if (amount <= 0) return 0;
  if (filingStatus === FilingStatus.MarriedFilingSeparately) return 0;

  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const phaseOutStart = isMFJ ? STUDENT_LOAN_INTEREST.PHASE_OUT_MFJ : STUDENT_LOAN_INTEREST.PHASE_OUT_SINGLE;
  const phaseOutRange = isMFJ ? STUDENT_LOAN_INTEREST.PHASE_OUT_RANGE_MFJ : STUDENT_LOAN_INTEREST.PHASE_OUT_RANGE_SINGLE;

  if (income <= phaseOutStart) return round2(amount);
  if (income >= phaseOutStart + phaseOutRange) return 0;

  const reduction = (income - phaseOutStart) / phaseOutRange;
  return round2(amount * (1 - reduction));
}

/**
 * Traditional IRA deduction with income phase-out.
 */
export function calculateIRADeduction(
  amount: number,
  income: number,
  filingStatus: FilingStatus,
  coveredByEmployerPlan?: boolean,
  spouseCoveredByEmployerPlan?: boolean,
): number {
  if (amount <= 0) return 0;

  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const isMFS = filingStatus === FilingStatus.MarriedFilingSeparately;

  if (coveredByEmployerPlan) {
    let phaseOutStart: number;
    let phaseOutRange: number;

    if (isMFS) {
      phaseOutStart = IRA.DEDUCTION_PHASE_OUT_MFS;
      phaseOutRange = IRA.DEDUCTION_PHASE_OUT_RANGE_MFS;
    } else if (isMFJ) {
      phaseOutStart = IRA.DEDUCTION_PHASE_OUT_MFJ;
      phaseOutRange = IRA.DEDUCTION_PHASE_OUT_RANGE_MFJ;
    } else {
      phaseOutStart = IRA.DEDUCTION_PHASE_OUT_SINGLE;
      phaseOutRange = IRA.DEDUCTION_PHASE_OUT_RANGE_SINGLE;
    }

    if (income <= phaseOutStart) return round2(amount);
    if (income >= phaseOutStart + phaseOutRange) return 0;
    const reduction = (income - phaseOutStart) / phaseOutRange;
    return round2(amount * (1 - reduction));
  }

  if (spouseCoveredByEmployerPlan && isMFJ) {
    const phaseOutStart = IRA.DEDUCTION_PHASE_OUT_MFJ_SPOUSE_COVERED;
    const phaseOutRange = IRA.DEDUCTION_PHASE_OUT_RANGE_MFJ_SPOUSE_COVERED;

    if (income <= phaseOutStart) return round2(amount);
    if (income >= phaseOutStart + phaseOutRange) return 0;
    const reduction = (income - phaseOutStart) / phaseOutRange;
    return round2(amount * (1 - reduction));
  }

  return round2(amount);
}

/**
 * Standard deduction with additional amounts for age 65+ and/or legally blind.
 */
export function calculateStandardDeduction(taxReturn: TaxReturn, filingStatus: FilingStatus, earnedIncome: number = 0): number {
  let base = STANDARD_DEDUCTION_2025[filingStatus];

  if (taxReturn.canBeClaimedAsDependent) {
    const dependentBase = Math.max(
      DEPENDENT_STANDARD_DEDUCTION.MIN_AMOUNT,
      earnedIncome + DEPENDENT_STANDARD_DEDUCTION.EARNED_INCOME_PLUS,
    );
    base = Math.min(dependentBase, base);
  }

  // QSS uses the married additional standard deduction amount per IRS Form 1040 instructions
  const isMarried = filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.MarriedFilingSeparately ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const additionalAmount = isMarried
    ? ADDITIONAL_STANDARD_DEDUCTION.MARRIED
    : ADDITIONAL_STANDARD_DEDUCTION.UNMARRIED;

  let additional = 0;

  if (isAge65OrOlder(taxReturn.dateOfBirth, taxReturn.taxYear)) {
    additional += additionalAmount;
  }
  if (taxReturn.isLegallyBlind) {
    additional += additionalAmount;
  }

  if (filingStatus === FilingStatus.MarriedFilingJointly) {
    if (isAge65OrOlder(taxReturn.spouseDateOfBirth, taxReturn.taxYear)) {
      additional += additionalAmount;
    }
    if (taxReturn.spouseIsLegallyBlind) {
      additional += additionalAmount;
    }
  }

  return base + additional;
}

/**
 * Get a person's age at the end of the tax year (Dec 31).
 * Since Dec 31 is the last day of the year, everyone's birthday has occurred
 * by then, so age = taxYear − birthYear.
 */
function getAgeAtEndOfYear(dateOfBirth: string | undefined, taxYear: number): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = parseDateString(dateOfBirth);
  if (!dob) return undefined;
  return taxYear - dob.year;
}

/**
 * Check if a person is age 65 or older by end of the tax year.
 * IRS rule: you are considered 65 on the day before your 65th birthday.
 */
export function isAge65OrOlder(dateOfBirth: string | undefined, taxYear: number): boolean {
  if (!dateOfBirth) return false;
  const dob = parseDateString(dateOfBirth);
  if (!dob) return false;

  // IRS rule: you are considered 65 on the day before your 65th birthday.
  const age65Birthday = new Date(dob.year + 65, dob.month, dob.day);
  age65Birthday.setDate(age65Birthday.getDate() - 1);
  const endOfTaxYear = new Date(taxYear, 11, 31);
  return age65Birthday <= endOfTaxYear;
}

/**
 * Check if a person is age 50 or older by end of the tax year.
 * Used for IRA catch-up contribution eligibility — IRC §219(b)(5)(B).
 * $1,000 additional contribution allowed for individuals age 50+.
 */
function isAge50OrOlder(dateOfBirth: string | undefined, taxYear: number): boolean {
  if (!dateOfBirth) return false;
  const dob = parseDateString(dateOfBirth);
  if (!dob) return false;
  return taxYear - dob.year >= 50;
}

/**
 * Alimony deduction for pre-2019 divorce agreements.
 */
export function calculateAlimonyDeduction(alimony?: { totalPaid: number; divorceDate: string }): number {
  if (!alimony || alimony.totalPaid <= 0) return 0;
  if (!alimony.divorceDate) return 0;

  const divorceDate = new Date(alimony.divorceDate);
  if (isNaN(divorceDate.getTime())) return 0;

  const cutoff = new Date(ALIMONY.TCJA_CUTOFF_DATE);
  if (divorceDate >= cutoff) return 0;

  return round2(Math.max(0, alimony.totalPaid));
}

/**
 * Count EITC-qualifying children from the dependents array.
 */
export function countEITCQualifyingChildren(
  dependents: import('../types/index.js').Dependent[],
  taxYear: number | undefined,
  ctcFallback: number,
): number {
  if (!dependents || dependents.length === 0) return Math.min(ctcFallback, 3);

  const hasAgeData = dependents.some(d => d.dateOfBirth);
  if (!hasAgeData) return Math.min(ctcFallback, 3);

  const year = taxYear || 2025;
  let count = 0;
  for (const dep of dependents) {
    if (dep.monthsLivedWithYou < 7) continue;
    if (dep.isDisabled) { count++; continue; }
    if (!dep.dateOfBirth) continue;
    const birthParts = parseDateString(dep.dateOfBirth);
    if (!birthParts) continue;
    // Dec 31 is last day of year, so birthday always occurred: age = year − birthYear
    const ageAtYearEnd = year - birthParts.year;
    if (ageAtYearEnd < 19) { count++; }
    else if (ageAtYearEnd < 24 && dep.isStudent) { count++; }
  }
  return Math.min(count, 3);
}
