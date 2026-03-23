/**
 * Filing Options Service
 *
 * Pure functions for:
 * 1. Assessing eligibility for free IRS filing programs
 * 2. Generating a Transfer Guide — a line-by-line mapping of
 *    calculated values to IRS form line numbers, enabling users
 *    to manually transfer data into Free Fillable Forms.
 *
 * No React dependencies. Follows the same pure-function pattern
 * as the tax engine modules.
 */
import type { TaxReturn, CalculationResult } from '../types/index.js';

// ── Types ────────────────────────────────────────────────────────

export type EligibilityStatus = 'eligible' | 'likely_eligible' | 'not_eligible' | 'unknown';

export interface FilingOptionEligibility {
  status: EligibilityStatus;
  reason: string;
}

export interface FilingOptionsAssessment {
  freeFile: FilingOptionEligibility;
  freeFileForms: FilingOptionEligibility;
  vita: FilingOptionEligibility;
  tce: FilingOptionEligibility;
}

export interface TransferGuideLine {
  /** IRS line number (e.g., "1a", "9", "15") */
  line: string;
  /** Human-readable label (e.g., "Wages, salaries, tips") */
  label: string;
  /** Raw numeric value */
  value: number;
  /** Display-formatted value (e.g., "$42,470") */
  formattedValue: string;
}

export interface TransferGuideForm {
  formId: string;
  formName: string;
  lines: TransferGuideLine[];
}

export interface TransferGuideData {
  forms: TransferGuideForm[];
  generatedAt: string;
}

// ── Constants ────────────────────────────────────────────────────

const FREE_FILE_AGI_LIMIT = 89_000;   // 2025 tax year
const VITA_AGI_LIMIT = 69_000;
const TCE_MIN_AGE = 60;

/** IRS program URLs */
export const FILING_URLS = {
  freeFile: 'https://apps.irs.gov/app/freeFile/browse-all-offers/',
  freeFileForms: 'https://www.freefilefillableforms.com/',
  vitaLocator: 'https://irs.treasury.gov/freetaxprep/',
  efileProviders: 'https://www.irs.gov/e-file-providers/authorized-irs-e-file-providers-for-individuals',
  directPay: 'https://directpay.irs.gov',
} as const;

// ── Eligibility Assessment ───────────────────────────────────────

/**
 * Assess eligibility for each free IRS filing program based on
 * the filer's tax return data and calculation results.
 */
export function assessFilingOptions(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): FilingOptionsAssessment {
  const agi = calc.form1040.agi;

  return {
    freeFile: assessFreeFile(agi),
    freeFileForms: { status: 'eligible', reason: 'Available to all taxpayers' },
    vita: assessVITA(agi),
    tce: assessTCE(taxReturn),
  };
}

function assessFreeFile(agi: number): FilingOptionEligibility {
  if (agi <= FREE_FILE_AGI_LIMIT) {
    return {
      status: 'eligible',
      reason: `Your AGI ($${agi.toLocaleString()}) is within the $${FREE_FILE_AGI_LIMIT.toLocaleString()} limit`,
    };
  }
  return {
    status: 'not_eligible',
    reason: `Your AGI ($${agi.toLocaleString()}) exceeds the $${FREE_FILE_AGI_LIMIT.toLocaleString()} limit`,
  };
}

function assessVITA(agi: number): FilingOptionEligibility {
  if (agi <= VITA_AGI_LIMIT) {
    return {
      status: 'eligible',
      reason: `Your AGI ($${agi.toLocaleString()}) is within the $${VITA_AGI_LIMIT.toLocaleString()} limit`,
    };
  }
  return {
    status: 'not_eligible',
    reason: `Your AGI ($${agi.toLocaleString()}) exceeds the $${VITA_AGI_LIMIT.toLocaleString()} VITA income limit`,
  };
}

function assessTCE(taxReturn: TaxReturn): FilingOptionEligibility {
  const dob = taxReturn.dateOfBirth;
  if (!dob) {
    return { status: 'unknown', reason: 'Date of birth not provided — cannot determine age' };
  }

  const age = computeAge(dob, new Date(2025, 11, 31)); // Age as of Dec 31, 2025
  if (age >= TCE_MIN_AGE) {
    return {
      status: 'eligible',
      reason: `You qualify as age ${age} (60 or older)`,
    };
  }
  return {
    status: 'not_eligible',
    reason: `TCE is for taxpayers age 60 and older (you are ${age})`,
  };
}

/** Compute age as of a reference date */
function computeAge(dobString: string, asOf: Date): number {
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return 0;

  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// ── Transfer Guide ───────────────────────────────────────────────

interface TransferLineDefinition {
  line: string;
  label: string;
  sourcePath: string;
  source: 'taxReturn' | 'calculationResult';
}

interface TransferFormDefinition {
  formId: string;
  formName: string;
  /** Condition: include this form only when it has data */
  condition: (taxReturn: TaxReturn, calc: CalculationResult) => boolean;
  lines: TransferLineDefinition[];
}

/** Curated line definitions — key IRS lines users need to transfer */
const TRANSFER_GUIDE_DEFINITIONS: TransferFormDefinition[] = [
  {
    formId: 'f1040',
    formName: 'Form 1040 — U.S. Individual Income Tax Return',
    condition: () => true, // Always present
    lines: [
      { line: '1a', label: 'Wages, salaries, tips', sourcePath: 'form1040.totalWages', source: 'calculationResult' },
      { line: '2a', label: 'Tax-exempt interest', sourcePath: 'form1040.taxExemptInterest', source: 'calculationResult' },
      { line: '2b', label: 'Taxable interest', sourcePath: 'form1040.totalInterest', source: 'calculationResult' },
      { line: '3a', label: 'Qualified dividends', sourcePath: 'form1040.qualifiedDividends', source: 'calculationResult' },
      { line: '3b', label: 'Ordinary dividends', sourcePath: 'form1040.totalDividends', source: 'calculationResult' },
      { line: '4a', label: 'IRA distributions', sourcePath: 'form1040.iraDistributionsGross', source: 'calculationResult' },
      { line: '4b', label: 'IRA distributions (taxable)', sourcePath: 'form1040.iraDistributionsTaxable', source: 'calculationResult' },
      { line: '5a', label: 'Pensions and annuities', sourcePath: 'form1040.pensionDistributionsGross', source: 'calculationResult' },
      { line: '5b', label: 'Pensions (taxable)', sourcePath: 'form1040.pensionDistributionsTaxable', source: 'calculationResult' },
      { line: '6a', label: 'Social Security benefits', sourcePath: 'form1040.socialSecurityBenefits', source: 'calculationResult' },
      { line: '6b', label: 'Social Security (taxable)', sourcePath: 'form1040.taxableSocialSecurity', source: 'calculationResult' },
      { line: '7', label: 'Capital gain or loss', sourcePath: 'form1040.capitalGainOrLoss', source: 'calculationResult' },
      { line: '8', label: 'Other income (Schedule 1)', sourcePath: 'form1040.totalIncome', source: 'calculationResult' },
      { line: '9', label: 'Total income', sourcePath: 'form1040.totalIncome', source: 'calculationResult' },
      { line: '10', label: 'Adjustments to income', sourcePath: 'form1040.totalAdjustments', source: 'calculationResult' },
      { line: '11', label: 'Adjusted gross income (AGI)', sourcePath: 'form1040.agi', source: 'calculationResult' },
      { line: '12', label: 'Deductions (standard or itemized)', sourcePath: 'form1040.deductionAmount', source: 'calculationResult' },
      { line: '13', label: 'Qualified business income deduction', sourcePath: 'form1040.qbiDeduction', source: 'calculationResult' },
      { line: '15', label: 'Taxable income', sourcePath: 'form1040.taxableIncome', source: 'calculationResult' },
      { line: '16', label: 'Tax', sourcePath: 'form1040.incomeTax', source: 'calculationResult' },
      { line: '24', label: 'Total tax', sourcePath: 'form1040.totalTax', source: 'calculationResult' },
      { line: '25d', label: 'Total federal tax withheld', sourcePath: 'form1040.totalWithholding', source: 'calculationResult' },
      { line: '26', label: 'Estimated tax payments', sourcePath: 'form1040.estimatedPayments', source: 'calculationResult' },
      { line: '33', label: 'Total payments', sourcePath: 'form1040.totalPayments', source: 'calculationResult' },
      { line: '34', label: 'Overpayment (if refund)', sourcePath: 'form1040.refundAmount', source: 'calculationResult' },
      { line: '37', label: 'Amount you owe', sourcePath: 'form1040.amountOwed', source: 'calculationResult' },
    ],
  },
  {
    formId: 'schedulec',
    formName: 'Schedule C — Profit or Loss From Business',
    condition: (_tr, calc) => calc.scheduleC != null,
    lines: [
      { line: '1', label: 'Gross receipts or sales', sourcePath: 'scheduleC.grossReceipts', source: 'calculationResult' },
      { line: '7', label: 'Gross income', sourcePath: 'scheduleC.grossIncome', source: 'calculationResult' },
      { line: '28', label: 'Total expenses', sourcePath: 'scheduleC.totalExpenses', source: 'calculationResult' },
      { line: '31', label: 'Net profit (or loss)', sourcePath: 'scheduleC.netProfit', source: 'calculationResult' },
    ],
  },
  {
    formId: 'schedulese',
    formName: 'Schedule SE — Self-Employment Tax',
    condition: (_tr, calc) => calc.scheduleSE != null,
    lines: [
      { line: '4', label: 'Net earnings from self-employment', sourcePath: 'scheduleSE.netEarnings', source: 'calculationResult' },
      { line: '12', label: 'Self-employment tax', sourcePath: 'scheduleSE.totalSETax', source: 'calculationResult' },
      { line: '13', label: 'Deductible part of SE tax', sourcePath: 'scheduleSE.deductibleHalf', source: 'calculationResult' },
    ],
  },
  {
    formId: 'scheduled',
    formName: 'Schedule D — Capital Gains and Losses',
    condition: (_tr, calc) => calc.scheduleD != null,
    lines: [
      { line: '7', label: 'Net short-term capital gain (loss)', sourcePath: 'scheduleD.netShortTerm', source: 'calculationResult' },
      { line: '15', label: 'Net long-term capital gain (loss)', sourcePath: 'scheduleD.netLongTerm', source: 'calculationResult' },
      { line: '16', label: 'Combined gain (loss)', sourcePath: 'scheduleD.netGainOrLoss', source: 'calculationResult' },
      { line: '21', label: 'Capital loss deduction', sourcePath: 'scheduleD.capitalLossDeduction', source: 'calculationResult' },
    ],
  },
  {
    formId: 'schedulea',
    formName: 'Schedule A — Itemized Deductions',
    condition: (_tr, calc) => calc.scheduleA != null,
    lines: [
      { line: '4', label: 'Medical & dental expenses (deductible)', sourcePath: 'scheduleA.medicalDeduction', source: 'calculationResult' },
      { line: '5d', label: 'State & local taxes (SALT, capped)', sourcePath: 'scheduleA.saltDeduction', source: 'calculationResult' },
      { line: '10', label: 'Interest you paid (mortgage + other)', sourcePath: 'scheduleA.interestDeduction', source: 'calculationResult' },
      { line: '14', label: 'Gifts to charity', sourcePath: 'scheduleA.charitableDeduction', source: 'calculationResult' },
      { line: '17', label: 'Total itemized deductions', sourcePath: 'scheduleA.totalItemized', source: 'calculationResult' },
    ],
  },
  {
    formId: 'schedule1',
    formName: 'Schedule 1 — Additional Income and Adjustments',
    condition: (_tr, calc) => {
      // Present when any Schedule 1 income or adjustments exist
      const f = calc.form1040;
      return (
        f.scheduleCNetProfit !== 0 ||
        f.scheduleEIncome !== 0 ||
        f.totalUnemployment > 0 ||
        f.totalRetirementIncome > 0 ||
        f.seDeduction > 0 ||
        f.movingExpenses > 0 ||
        f.selfEmployedHealthInsurance > 0 ||
        f.retirementContributions > 0 ||
        f.hsaDeduction > 0 ||
        f.studentLoanInterest > 0 ||
        f.iraDeduction > 0 ||
        f.educatorExpenses > 0 ||
        f.alimonyDeduction > 0
      );
    },
    lines: [
      // Part I — Additional Income
      { line: '3', label: 'Business income (Schedule C)', sourcePath: 'form1040.scheduleCNetProfit', source: 'calculationResult' },
      { line: '5', label: 'Rental/royalty income (Schedule E)', sourcePath: 'form1040.scheduleEIncome', source: 'calculationResult' },
      { line: '7', label: 'Unemployment compensation', sourcePath: 'form1040.totalUnemployment', source: 'calculationResult' },
      // Part II — Adjustments
      { line: '14', label: 'Moving expenses (military)', sourcePath: 'form1040.movingExpenses', source: 'calculationResult' },
      { line: '15', label: 'SE tax deduction', sourcePath: 'form1040.seDeduction', source: 'calculationResult' },
      { line: '17', label: 'Self-employed health insurance', sourcePath: 'form1040.selfEmployedHealthInsurance', source: 'calculationResult' },
      { line: '19', label: 'IRA deduction', sourcePath: 'form1040.iraDeduction', source: 'calculationResult' },
      { line: '20', label: 'Student loan interest deduction', sourcePath: 'form1040.studentLoanInterest', source: 'calculationResult' },
      { line: '21', label: 'Educator expenses', sourcePath: 'form1040.educatorExpenses', source: 'calculationResult' },
      { line: '22', label: 'Retirement plan contributions (SE)', sourcePath: 'form1040.retirementContributions', source: 'calculationResult' },
      { line: '13', label: 'HSA deduction', sourcePath: 'form1040.hsaDeduction', source: 'calculationResult' },
      { line: '26', label: 'Total adjustments', sourcePath: 'form1040.totalAdjustments', source: 'calculationResult' },
    ],
  },
  {
    formId: 'schedulee',
    formName: 'Schedule E — Supplemental Income and Loss',
    condition: (_tr, calc) => calc.scheduleE != null,
    lines: [
      { line: '3', label: 'Total rental income', sourcePath: 'scheduleE.totalRentalIncome', source: 'calculationResult' },
      { line: '20', label: 'Total rental expenses', sourcePath: 'scheduleE.totalRentalExpenses', source: 'calculationResult' },
      { line: '21', label: 'Net rental income (loss)', sourcePath: 'scheduleE.netRentalIncome', source: 'calculationResult' },
      { line: '26', label: 'Total Schedule E income', sourcePath: 'scheduleE.scheduleEIncome', source: 'calculationResult' },
    ],
  },
];

/**
 * Generate a Transfer Guide — curated line-by-line values
 * mapped to IRS form line numbers for manual transfer.
 */
export function generateTransferGuide(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): TransferGuideData {
  const forms: TransferGuideForm[] = [];

  for (const formDef of TRANSFER_GUIDE_DEFINITIONS) {
    if (!formDef.condition(taxReturn, calc)) continue;

    const lines: TransferGuideLine[] = [];

    for (const lineDef of formDef.lines) {
      const sourceObj = lineDef.source === 'taxReturn' ? taxReturn : calc;
      const rawValue = resolvePath(sourceObj as unknown as Record<string, unknown>, lineDef.sourcePath);

      // Only include lines with non-zero numeric values
      const numValue = typeof rawValue === 'number' ? rawValue : 0;
      if (numValue === 0) continue;

      lines.push({
        line: lineDef.line,
        label: lineDef.label,
        value: numValue,
        formattedValue: formatDollar(numValue),
      });
    }

    if (lines.length > 0) {
      forms.push({
        formId: formDef.formId,
        formName: formDef.formName,
        lines,
      });
    }
  }

  return {
    forms,
    generatedAt: new Date().toISOString(),
  };
}

// ── Utilities ────────────────────────────────────────────────────

/**
 * Resolve a dot-separated path on a nested object.
 * e.g., resolvePath(calc, 'form1040.totalWages') → 52470
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Format a number as a dollar string with commas and sign */
function formatDollar(value: number): string {
  const abs = Math.abs(Math.round(value));
  const formatted = `$${abs.toLocaleString('en-US')}`;
  return value < 0 ? `-${formatted}` : formatted;
}

// Re-export constants for testing
export { FREE_FILE_AGI_LIMIT, VITA_AGI_LIMIT, TCE_MIN_AGE };
