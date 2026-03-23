/**
 * Dynamic IRS Reference Data Builder
 *
 * Generates a personalized block of IRS thresholds/limits for the AI chat
 * system prompt. Instead of hardcoding all constants, this pulls from the
 * engine's tax2025.ts based on the user's filing status, current section,
 * and enabled income/deduction/credit types.
 *
 * Benefits:
 *   - Always in sync with the engine (single source of truth)
 *   - ~40-60% fewer tokens than embedding everything
 *   - Higher signal-to-noise → better model responses
 */

import { FilingStatus } from '../types/index.js';
import {
  TAX_BRACKETS_2025,
  STANDARD_DEDUCTION_2025,
  ADDITIONAL_STANDARD_DEDUCTION,
  SE_TAX,
  QBI,
  SCHEDULE_A,
  CHILD_TAX_CREDIT,
  EDUCATION_CREDITS,
  STUDENT_LOAN_INTEREST,
  HSA,
  IRA,
  CAPITAL_GAINS_RATES,
  NIIT,
  SCHEDULE_D,
  DEPENDENT_CARE,
  SAVERS_CREDIT,
  SOCIAL_SECURITY,
  ACTC,
  EARLY_DISTRIBUTION,
  CLEAN_ENERGY,
  QCD,
  HOME_OFFICE,
} from '../constants/tax2025.js';
import { AMT_2025 } from '../constants/amt2025.js';
import { EITC_BRACKETS, INVESTMENT_INCOME_LIMIT } from '../engine/eitc.js';

// ─── Types ────────────────────────────────────────

export interface IrsReferenceDataOptions {
  filingStatus?: string;
  currentSection?: string;
  incomeDiscovery?: Record<string, string>;
  deductionMethod?: string;
  dependentCount?: number;
}

// ─── Filing Status Mapping ────────────────────────

const FS_MAP: Record<string, FilingStatus> = {
  single: FilingStatus.Single,
  married_filing_jointly: FilingStatus.MarriedFilingJointly,
  married_filing_separately: FilingStatus.MarriedFilingSeparately,
  head_of_household: FilingStatus.HeadOfHousehold,
  qualifying_surviving_spouse: FilingStatus.QualifyingSurvivingSpouse,
};

const FS_SHORT: Record<FilingStatus, string> = {
  [FilingStatus.Single]: 'Single',
  [FilingStatus.MarriedFilingJointly]: 'MFJ',
  [FilingStatus.MarriedFilingSeparately]: 'MFS',
  [FilingStatus.HeadOfHousehold]: 'HOH',
  [FilingStatus.QualifyingSurvivingSpouse]: 'QSS',
};

// ─── Helpers ──────────────────────────────────────

function $(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

function formatBrackets(fs: FilingStatus): string {
  const brackets = TAX_BRACKETS_2025[fs];
  const label = FS_SHORT[fs];
  const parts = brackets.map((b) => {
    const rate = `${(b.rate * 100).toFixed(0)}%`;
    return b.max === Infinity ? `${rate} above` : `${rate} to ${$(b.max)}`;
  });
  return `Tax Brackets (${label}): ${parts.join(' | ')}`;
}

function has(discovery: Record<string, string> | undefined, ...keys: string[]): boolean {
  if (!discovery) return false;
  return keys.some((k) => discovery[k] === 'yes');
}

// ─── Layer 1: Always-Include Baseline ─────────────

function buildBaseline(fs: FilingStatus, isMFS: boolean): string[] {
  const lines: string[] = [];

  // Standard deduction
  const stdDed = STANDARD_DEDUCTION_2025[fs];
  const addlAmt = fs === FilingStatus.Single || fs === FilingStatus.HeadOfHousehold
    ? ADDITIONAL_STANDARD_DEDUCTION.UNMARRIED
    : ADDITIONAL_STANDARD_DEDUCTION.MARRIED;
  lines.push(`Standard Deduction (${FS_SHORT[fs]}): ${$(stdDed)} | Additional (65+ or blind): ${$(addlAmt)}`);

  // Brackets
  lines.push(formatBrackets(fs));

  // SALT cap
  const saltCap = isMFS ? SCHEDULE_A.SALT_CAP_MFS : SCHEDULE_A.SALT_CAP;
  const saltFloor = isMFS ? SCHEDULE_A.SALT_CAP_FLOOR_MFS : SCHEDULE_A.SALT_CAP_FLOOR;
  const saltPhaseDown = isMFS ? SCHEDULE_A.SALT_PHASE_DOWN_THRESHOLD_MFS : SCHEDULE_A.SALT_PHASE_DOWN_THRESHOLD;
  lines.push(`SALT Cap: ${$(saltCap)} (OBBBA 2025-2029) | Phases down above ${$(saltPhaseDown)} MAGI | Floor ${$(saltFloor)}`);

  return lines;
}

// ─── Layer 2: Section-Emphasized Data ─────────────

function buildSectionData(fs: FilingStatus, isMFS: boolean, section: string): string[] {
  const lines: string[] = [];

  switch (section) {
    case 'income':
    case 'self_employment':
    case 'selfEmployment': {
      lines.push(`SE Tax: ${(SE_TAX.RATE * 100).toFixed(1)}% (${(SE_TAX.SS_RATE * 100).toFixed(1)}% OASDI up to ${$(SE_TAX.SS_WAGE_BASE)} + ${(SE_TAX.MEDICARE_RATE * 100).toFixed(1)}% Medicare)`);
      const addlThreshold = fs === FilingStatus.MarriedFilingJointly || fs === FilingStatus.QualifyingSurvivingSpouse
        ? SE_TAX.ADDITIONAL_MEDICARE_THRESHOLD_MFJ
        : isMFS ? SE_TAX.ADDITIONAL_MEDICARE_THRESHOLD_MFS : SE_TAX.ADDITIONAL_MEDICARE_THRESHOLD_SINGLE;
      lines.push(`Additional Medicare Tax: 0.9% on SE income above ${$(addlThreshold)}`);
      lines.push(`QBI Deduction: ${(QBI.RATE * 100).toFixed(0)}% of qualified business income. SSTB threshold: ${$(isMFS ? QBI.THRESHOLD_SINGLE : (fs === FilingStatus.MarriedFilingJointly ? QBI.THRESHOLD_MFJ : QBI.THRESHOLD_SINGLE))}`);
      // Capital gains for investment income
      const cg0 = CAPITAL_GAINS_RATES.THRESHOLD_0[fs];
      const cg15 = CAPITAL_GAINS_RATES.THRESHOLD_15[fs];
      lines.push(`Capital Gains (${FS_SHORT[fs]}): 0% to ${$(cg0)} | 15% to ${$(cg15)} | 20% above`);
      break;
    }

    case 'deductions': {
      lines.push(`Medical Expense Floor: ${(SCHEDULE_A.MEDICAL_AGI_THRESHOLD * 100).toFixed(1)}% of AGI`);
      const mortLimit = isMFS ? SCHEDULE_A.MORTGAGE_LIMIT_MFS : SCHEDULE_A.MORTGAGE_LIMIT;
      lines.push(`Mortgage Interest: Deductible on first ${$(mortLimit)} of acquisition debt`);
      lines.push(`HSA Limits: ${$(HSA.INDIVIDUAL_LIMIT)} (self) / ${$(HSA.FAMILY_LIMIT)} (family). Catch-up 55+: ${$(HSA.CATCH_UP_55_PLUS)}`);
      lines.push(`IRA Limit: ${$(IRA.MAX_CONTRIBUTION)} (${$(IRA.MAX_CONTRIBUTION + IRA.CATCH_UP_50_PLUS)} if 50+)`);
      const slPhaseOut = fs === FilingStatus.MarriedFilingJointly
        ? `${$(STUDENT_LOAN_INTEREST.PHASE_OUT_MFJ)}-${$(STUDENT_LOAN_INTEREST.PHASE_OUT_MFJ + STUDENT_LOAN_INTEREST.PHASE_OUT_RANGE_MFJ)}`
        : `${$(STUDENT_LOAN_INTEREST.PHASE_OUT_SINGLE)}-${$(STUDENT_LOAN_INTEREST.PHASE_OUT_SINGLE + STUDENT_LOAN_INTEREST.PHASE_OUT_RANGE_SINGLE)}`;
      lines.push(`Student Loan Interest: Up to ${$(STUDENT_LOAN_INTEREST.MAX_DEDUCTION)}. Phase-out ${slPhaseOut}`);
      lines.push(`Home Office (Simplified): ${$(HOME_OFFICE.SIMPLIFIED_RATE)}/sq ft, max ${HOME_OFFICE.SIMPLIFIED_MAX_SQFT} sq ft = ${$(HOME_OFFICE.SIMPLIFIED_MAX_DEDUCTION)}`);
      break;
    }

    case 'credits': {
      lines.push(`Child Tax Credit: ${$(CHILD_TAX_CREDIT.PER_CHILD)}/child under 17 | ${$(CHILD_TAX_CREDIT.PER_OTHER_DEPENDENT)} per other dependent`);
      const ctcPhaseOut = fs === FilingStatus.MarriedFilingJointly
        ? $(CHILD_TAX_CREDIT.PHASE_OUT_THRESHOLD_MFJ)
        : $(CHILD_TAX_CREDIT.PHASE_OUT_THRESHOLD_SINGLE);
      lines.push(`  Phase-out at ${ctcPhaseOut} AGI | ACTC refundable max ${$(CHILD_TAX_CREDIT.REFUNDABLE_MAX)}`);

      // EITC
      const e0 = EITC_BRACKETS[0], e1 = EITC_BRACKETS[1], e2 = EITC_BRACKETS[2], e3 = EITC_BRACKETS[3];
      lines.push(`EITC Max Credit: ${$(e0.maxCredit)} (0 children) | ${$(e1.maxCredit)} (1) | ${$(e2.maxCredit)} (2) | ${$(e3.maxCredit)} (3+). Investment income limit: ${$(INVESTMENT_INCOME_LIMIT)}`);

      // Education
      const aotcPO = fs === FilingStatus.MarriedFilingJointly
        ? `${$(EDUCATION_CREDITS.AOTC_PHASE_OUT_MFJ)}-${$(EDUCATION_CREDITS.AOTC_PHASE_OUT_MFJ + EDUCATION_CREDITS.AOTC_PHASE_OUT_RANGE_MFJ)}`
        : `${$(EDUCATION_CREDITS.AOTC_PHASE_OUT_SINGLE)}-${$(EDUCATION_CREDITS.AOTC_PHASE_OUT_SINGLE + EDUCATION_CREDITS.AOTC_PHASE_OUT_RANGE_SINGLE)}`;
      lines.push(`AOTC: Up to ${$(EDUCATION_CREDITS.AOTC_MAX)} (40% refundable). Phase-out ${aotcPO}`);
      lines.push(`LLC: Up to ${$(EDUCATION_CREDITS.LLC_MAX)}. Phase-out same ranges`);

      lines.push(`Dependent Care Credit: Up to ${$(DEPENDENT_CARE.EXPENSE_LIMIT_ONE)} (1) / ${$(DEPENDENT_CARE.EXPENSE_LIMIT_TWO_PLUS)} (2+). Rate ${(DEPENDENT_CARE.MIN_RATE * 100).toFixed(0)}-${(DEPENDENT_CARE.MAX_RATE * 100).toFixed(0)}%`);

      const saverMFJ = SAVERS_CREDIT.MFJ_10;
      const saverSingle = SAVERS_CREDIT.SINGLE_10;
      const saverLimit = fs === FilingStatus.MarriedFilingJointly ? saverMFJ : saverSingle;
      lines.push(`Saver's Credit: Up to ${$(SAVERS_CREDIT.CONTRIBUTION_LIMIT)} eligible contributions. AGI limit ${$(saverLimit)} (${FS_SHORT[fs]})`);

      lines.push(`Clean Energy Credit: ${(CLEAN_ENERGY.RATE * 100).toFixed(0)}% of qualified expenditures`);
      break;
    }

    case 'review':
    case 'state':
    case 'finish': {
      const amtExemption = isMFS ? AMT_2025.EXEMPTION.MFS
        : fs === FilingStatus.MarriedFilingJointly || fs === FilingStatus.QualifyingSurvivingSpouse
          ? AMT_2025.EXEMPTION.MFJ
          : AMT_2025.EXEMPTION.SINGLE;
      const amtPhaseOut = isMFS ? AMT_2025.PHASE_OUT.MFS
        : fs === FilingStatus.MarriedFilingJointly || fs === FilingStatus.QualifyingSurvivingSpouse
          ? AMT_2025.PHASE_OUT.MFJ
          : AMT_2025.PHASE_OUT.SINGLE;
      lines.push(`AMT Exemption: ${$(amtExemption)} (${FS_SHORT[fs]}). Phase-out starts at ${$(amtPhaseOut)}`);

      const capLossLimit = isMFS ? SCHEDULE_D.CAPITAL_LOSS_LIMIT_MFS : SCHEDULE_D.CAPITAL_LOSS_LIMIT;
      lines.push(`Capital Loss Limit: ${$(capLossLimit)}/year`);

      const ssBase = fs === FilingStatus.MarriedFilingJointly
        ? SOCIAL_SECURITY.MFJ_BASE_AMOUNT
        : SOCIAL_SECURITY.SINGLE_BASE_AMOUNT;
      lines.push(`Social Security Taxability: Provisional income threshold ${$(ssBase)} (${FS_SHORT[fs]})`);

      const niitThreshold = fs === FilingStatus.MarriedFilingJointly || fs === FilingStatus.QualifyingSurvivingSpouse
        ? NIIT.THRESHOLD_MFJ
        : isMFS ? NIIT.THRESHOLD_MFS : NIIT.THRESHOLD_SINGLE;
      lines.push(`NIIT: ${(NIIT.RATE * 100).toFixed(1)}% on net investment income if MAGI > ${$(niitThreshold)}`);
      break;
    }

    default: {
      // For myInfo, welcome, etc. — just include SE tax basics
      lines.push(`SE Tax: ${(SE_TAX.RATE * 100).toFixed(1)}% (12.4% OASDI up to ${$(SE_TAX.SS_WAGE_BASE)} + 2.9% Medicare)`);
      break;
    }
  }

  return lines;
}

// ─── Layer 3: Conditional Data ────────────────────

function buildConditionalData(
  fs: FilingStatus,
  isMFS: boolean,
  discovery: Record<string, string> | undefined,
  deductionMethod: string | undefined,
  dependentCount: number | undefined,
): string[] {
  const lines: string[] = [];
  const added = new Set<string>();

  function addOnce(key: string, line: string) {
    if (!added.has(key)) {
      added.add(key);
      lines.push(line);
    }
  }

  // Self-employment
  if (has(discovery, '1099nec', '1099k')) {
    addOnce('se', `SE Tax: ${(SE_TAX.RATE * 100).toFixed(1)}% (OASDI up to ${$(SE_TAX.SS_WAGE_BASE)} + Medicare). Min threshold: ${$(SE_TAX.MINIMUM_EARNINGS_THRESHOLD)}`);
    addOnce('qbi', `QBI Deduction: ${(QBI.RATE * 100).toFixed(0)}% of QBI. SSTB threshold: ${$(fs === FilingStatus.MarriedFilingJointly ? QBI.THRESHOLD_MFJ : QBI.THRESHOLD_SINGLE)}`);
    addOnce('homeoffice', `Home Office (Simplified): ${$(HOME_OFFICE.SIMPLIFIED_RATE)}/sq ft, max ${$(HOME_OFFICE.SIMPLIFIED_MAX_DEDUCTION)}`);
  }

  // Capital gains
  if (has(discovery, '1099b', '1099da')) {
    const cg0 = CAPITAL_GAINS_RATES.THRESHOLD_0[fs];
    const cg15 = CAPITAL_GAINS_RATES.THRESHOLD_15[fs];
    addOnce('capgains', `Capital Gains (${FS_SHORT[fs]}): 0% to ${$(cg0)} | 15% to ${$(cg15)} | 20% above`);
    const capLossLimit = isMFS ? SCHEDULE_D.CAPITAL_LOSS_LIMIT_MFS : SCHEDULE_D.CAPITAL_LOSS_LIMIT;
    addOnce('caploss', `Capital Loss Limit: ${$(capLossLimit)}/year`);
    const niitThreshold = fs === FilingStatus.MarriedFilingJointly ? NIIT.THRESHOLD_MFJ : (isMFS ? NIIT.THRESHOLD_MFS : NIIT.THRESHOLD_SINGLE);
    addOnce('niit', `NIIT: ${(NIIT.RATE * 100).toFixed(1)}% on net investment income if MAGI > ${$(niitThreshold)}`);
  }

  // Dividends
  if (has(discovery, '1099div')) {
    const cg0 = CAPITAL_GAINS_RATES.THRESHOLD_0[fs];
    addOnce('qualdiv', `Qualified Dividends: Taxed at capital gains rates (0% up to ${$(cg0)} for ${FS_SHORT[fs]})`);
  }

  // HSA
  if (has(discovery, 'ded_hsa', '1099sa')) {
    addOnce('hsa', `HSA Limits: ${$(HSA.INDIVIDUAL_LIMIT)} (self) / ${$(HSA.FAMILY_LIMIT)} (family). Catch-up 55+: ${$(HSA.CATCH_UP_55_PLUS)}`);
  }

  // IRA / Retirement
  if (has(discovery, 'ded_ira', '1099r')) {
    addOnce('ira', `IRA Limit: ${$(IRA.MAX_CONTRIBUTION)} (${$(IRA.MAX_CONTRIBUTION + IRA.CATCH_UP_50_PLUS)} if 50+)`);
    if (has(discovery, '1099r')) {
      addOnce('earlydist', `Early Distribution Penalty: ${(EARLY_DISTRIBUTION.PENALTY_RATE * 100).toFixed(0)}% on non-exempt early withdrawals`);
      addOnce('qcd', `QCD: Up to ${$(QCD.MAX_AMOUNT)}/year from IRA to charity (age 70½+)`);
    }
  }

  // Student loan
  if (has(discovery, 'ded_student_loan')) {
    const slPO = fs === FilingStatus.MarriedFilingJointly
      ? `${$(STUDENT_LOAN_INTEREST.PHASE_OUT_MFJ)}-${$(STUDENT_LOAN_INTEREST.PHASE_OUT_MFJ + STUDENT_LOAN_INTEREST.PHASE_OUT_RANGE_MFJ)}`
      : `${$(STUDENT_LOAN_INTEREST.PHASE_OUT_SINGLE)}-${$(STUDENT_LOAN_INTEREST.PHASE_OUT_SINGLE + STUDENT_LOAN_INTEREST.PHASE_OUT_RANGE_SINGLE)}`;
    addOnce('studentloan', `Student Loan Interest: Up to ${$(STUDENT_LOAN_INTEREST.MAX_DEDUCTION)}. Phase-out ${slPO}`);
  }

  // Social Security
  if (has(discovery, 'ssa1099')) {
    const ssBase = fs === FilingStatus.MarriedFilingJointly ? SOCIAL_SECURITY.MFJ_BASE_AMOUNT : SOCIAL_SECURITY.SINGLE_BASE_AMOUNT;
    addOnce('ss', `Social Security Taxability: Up to 85% taxable. Provisional income threshold ${$(ssBase)} (${FS_SHORT[fs]})`);
  }

  // Child/dependent credits
  if ((dependentCount && dependentCount > 0) || has(discovery, 'child_credit')) {
    addOnce('ctc', `Child Tax Credit: ${$(CHILD_TAX_CREDIT.PER_CHILD)}/child under 17 | ACTC refundable max ${$(CHILD_TAX_CREDIT.REFUNDABLE_MAX)}`);
  }
  if (has(discovery, 'dependent_care')) {
    addOnce('depcare', `Dependent Care Credit: Up to ${$(DEPENDENT_CARE.EXPENSE_LIMIT_ONE)} (1) / ${$(DEPENDENT_CARE.EXPENSE_LIMIT_TWO_PLUS)} (2+). Rate ${(DEPENDENT_CARE.MIN_RATE * 100).toFixed(0)}-${(DEPENDENT_CARE.MAX_RATE * 100).toFixed(0)}%`);
  }

  // Education
  if (has(discovery, 'education_credit')) {
    addOnce('aotc', `AOTC: Up to ${$(EDUCATION_CREDITS.AOTC_MAX)} (40% refundable)`);
    addOnce('llc', `LLC: Up to ${$(EDUCATION_CREDITS.LLC_MAX)}`);
  }

  // Itemized deductions
  if (deductionMethod === 'itemized' || has(discovery, 'ded_mortgage', 'ded_property_tax', 'ded_charitable', 'ded_medical')) {
    const mortLimit = isMFS ? SCHEDULE_A.MORTGAGE_LIMIT_MFS : SCHEDULE_A.MORTGAGE_LIMIT;
    addOnce('mortgage', `Mortgage Interest: Deductible on first ${$(mortLimit)} of acquisition debt`);
    addOnce('medical', `Medical Expense Floor: ${(SCHEDULE_A.MEDICAL_AGI_THRESHOLD * 100).toFixed(1)}% of AGI`);
  }

  // AMT
  if (has(discovery, 'amt_data')) {
    const amtEx = isMFS ? AMT_2025.EXEMPTION.MFS
      : fs === FilingStatus.MarriedFilingJointly ? AMT_2025.EXEMPTION.MFJ : AMT_2025.EXEMPTION.SINGLE;
    addOnce('amt', `AMT Exemption: ${$(amtEx)} (${FS_SHORT[fs]})`);
  }

  return lines;
}

// ─── Main Export ──────────────────────────────────

/**
 * Build a personalized IRS reference data block for the AI system prompt.
 * Pulls directly from the engine's tax2025 constants.
 */
export function buildIrsReferenceData(options: IrsReferenceDataOptions): string {
  const fsString = options.filingStatus || 'single';
  const fs = FS_MAP[fsString] ?? FilingStatus.Single;
  const isMFS = fs === FilingStatus.MarriedFilingSeparately;

  const section = options.currentSection || '';

  const baseline = buildBaseline(fs, isMFS);
  const sectionData = buildSectionData(fs, isMFS, section);
  const conditional = buildConditionalData(
    fs, isMFS,
    options.incomeDiscovery,
    options.deductionMethod,
    options.dependentCount,
  );

  // Deduplicate: if a conditional line is already covered by section data, skip it
  const sectionSet = new Set(sectionData);
  const filteredConditional = conditional.filter((line) => !sectionSet.has(line));

  const allLines = [
    `TAX YEAR 2025 REFERENCE DATA (${FS_SHORT[fs]} filer):`,
    '',
    ...baseline,
    '',
    ...sectionData,
  ];

  if (filteredConditional.length > 0) {
    allLines.push('', ...filteredConditional);
  }

  return allLines.join('\n');
}
