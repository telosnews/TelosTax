/**
 * Document Inventory Service — pure completeness analysis for tax returns.
 *
 * Analyzes a TaxReturn and returns a structured inventory model showing:
 * - All income form groups with per-entry completeness status
 * - Discovery cross-reference (discovered but not entered)
 * - Non-income section completeness (personal info, filing status, etc.)
 *
 * Pure functions, zero React dependencies, fully testable.
 */

import type {
  TaxReturn,
  W2Income,
  Income1099NEC,
  Income1099K,
  Income1099INT,
  Income1099DIV,
  Income1099R,
  Income1099G,
  Income1099MISC,
  Income1099B,
  Income1099DA,
  IncomeSSA1099,
  IncomeK1,
  Income1099SA,
  IncomeW2G,
  Income1099C,
  Income1099Q,
  RentalProperty,
} from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';

// ─── Types ──────────────────────────────────────

export type CompletenessStatus = 'complete' | 'partial' | 'missing_required' | 'not_entered';

export interface FormEntry {
  id: string;
  label: string;
  status: CompletenessStatus;
  filledFields: number;
  totalFields: number;
  missingRequired: string[];
  missingOptional: string[];
}

export interface FormTypeGroup {
  formType: string;
  formLabel: string;
  stepId: string;
  discoveryAnswer: 'yes' | 'no' | 'later' | 'not_asked';
  entries: FormEntry[];
  count: number;
  keyTotal: number;
  keyTotalLabel: string;
  groupStatus: CompletenessStatus;
}

export interface NonIncomeSection {
  id: string;
  label: string;
  stepId: string;
  status: CompletenessStatus;
  summary: string[];
  issues: string[];
}

export interface DocumentInventory {
  incomeGroups: FormTypeGroup[];
  pendingGroups: FormTypeGroup[];
  nonIncomeSections: NonIncomeSection[];
  overallCompleteness: number;
  totalFormsEntered: number;
  totalFormsPending: number;
}

// ─── Form Field Specs ──────────────────────────────

interface FieldSpec {
  field: string;
  label: string;
  required: boolean;
  /** When true, a value of 0 is treated as "filled" (e.g. costBasis on gifted stock). */
  allowZero?: boolean;
}

interface FormTypeSpec {
  discoveryKey: string;
  formLabel: string;
  stepId: string;
  keyTotalLabel: string;
  fields: FieldSpec[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEntries: (tr: TaxReturn) => any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getLabel: (entry: any) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getKeyTotal: (entries: any[]) => number;
}

const FORM_TYPE_SPECS: FormTypeSpec[] = [
  {
    discoveryKey: 'w2',
    formLabel: 'W-2 Employment',
    stepId: 'w2_income',
    keyTotalLabel: 'Total wages',
    fields: [
      { field: 'employerName', label: 'Employer name', required: true },
      { field: 'wages', label: 'Wages (Box 1)', required: true },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld (Box 2)', required: false },
      { field: 'socialSecurityWages', label: 'SS wages (Box 3)', required: false },
      { field: 'socialSecurityTax', label: 'SS tax (Box 4)', required: false },
      { field: 'medicareWages', label: 'Medicare wages (Box 5)', required: false },
      { field: 'medicareTax', label: 'Medicare tax (Box 6)', required: false },
      { field: 'stateTaxWithheld', label: 'State tax withheld (Box 17)', required: false },
      { field: 'stateWages', label: 'State wages (Box 16)', required: false },
      { field: 'state', label: 'State (Box 15)', required: false },
    ],
    getEntries: (tr) => tr.w2Income || [],
    getLabel: (e) => (e.employerName as string) || 'Unnamed employer',
    getKeyTotal: (entries) => entries.reduce((s: number, e: W2Income) => s + (e.wages || 0), 0),
  },
  {
    discoveryKey: '1099nec',
    formLabel: '1099-NEC',
    stepId: '1099nec_income',
    keyTotalLabel: 'Total nonemployee comp',
    fields: [
      { field: 'payerName', label: 'Payer name', required: true },
      { field: 'amount', label: 'Compensation (Box 1)', required: true },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld (Box 4)', required: false },
    ],
    getEntries: (tr) => tr.income1099NEC || [],
    getLabel: (e) => (e.payerName as string) || 'Unnamed payer',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099NEC) => s + (e.amount || 0), 0),
  },
  {
    discoveryKey: '1099k',
    formLabel: '1099-K Platform',
    stepId: '1099k_income',
    keyTotalLabel: 'Total gross amount',
    fields: [
      { field: 'platformName', label: 'Platform name', required: true },
      { field: 'grossAmount', label: 'Gross amount (Box 1a)', required: true },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld (Box 4)', required: false },
    ],
    getEntries: (tr) => tr.income1099K || [],
    getLabel: (e) => (e.platformName as string) || 'Unnamed platform',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099K) => s + (e.grossAmount || 0), 0),
  },
  {
    discoveryKey: '1099int',
    formLabel: 'Interest (1099-INT)',
    stepId: '1099int_income',
    keyTotalLabel: 'Total interest',
    fields: [
      { field: 'payerName', label: 'Payer name', required: true },
      { field: 'amount', label: 'Interest income (Box 1)', required: true },
      { field: 'taxExemptInterest', label: 'Tax-exempt interest (Box 8)', required: false },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld (Box 4)', required: false },
    ],
    getEntries: (tr) => tr.income1099INT || [],
    getLabel: (e) => (e.payerName as string) || 'Unnamed payer',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099INT) => s + (e.amount || 0), 0),
  },
  {
    discoveryKey: '1099div',
    formLabel: 'Dividends (1099-DIV)',
    stepId: '1099div_income',
    keyTotalLabel: 'Total dividends',
    fields: [
      { field: 'payerName', label: 'Payer name', required: true },
      { field: 'ordinaryDividends', label: 'Ordinary dividends (Box 1a)', required: true },
      { field: 'qualifiedDividends', label: 'Qualified dividends (Box 1b)', required: true, allowZero: true },
      { field: 'capitalGainDistributions', label: 'Capital gains (Box 2a)', required: false },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld (Box 4)', required: false },
      { field: 'foreignTaxPaid', label: 'Foreign tax paid (Box 7)', required: false },
    ],
    getEntries: (tr) => tr.income1099DIV || [],
    getLabel: (e) => (e.payerName as string) || 'Unnamed payer',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099DIV) => s + (e.ordinaryDividends || 0), 0),
  },
  {
    discoveryKey: '1099r',
    formLabel: 'Retirement (1099-R)',
    stepId: '1099r_income',
    keyTotalLabel: 'Total taxable',
    fields: [
      { field: 'payerName', label: 'Payer name', required: true },
      { field: 'grossDistribution', label: 'Gross distribution (Box 1)', required: true },
      { field: 'taxableAmount', label: 'Taxable amount (Box 2a)', required: true, allowZero: true },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld (Box 4)', required: false },
      { field: 'distributionCode', label: 'Distribution code (Box 7)', required: false },
    ],
    getEntries: (tr) => tr.income1099R || [],
    getLabel: (e) => (e.payerName as string) || 'Unnamed payer',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099R) => s + (e.taxableAmount || 0), 0),
  },
  {
    discoveryKey: '1099g',
    formLabel: 'Unemployment (1099-G)',
    stepId: '1099g_income',
    keyTotalLabel: 'Total unemployment',
    fields: [
      { field: 'payerName', label: 'Payer name', required: true },
      { field: 'unemploymentCompensation', label: 'Unemployment (Box 1)', required: true },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld (Box 4)', required: false },
    ],
    getEntries: (tr) => tr.income1099G || [],
    getLabel: (e) => (e.payerName as string) || 'Unnamed payer',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099G) => s + (e.unemploymentCompensation || 0), 0),
  },
  {
    discoveryKey: '1099misc',
    formLabel: 'Misc (1099-MISC)',
    stepId: '1099misc_income',
    keyTotalLabel: 'Total misc income',
    fields: [
      { field: 'payerName', label: 'Payer name', required: true },
      { field: 'otherIncome', label: 'Other income (Box 3)', required: false },
      { field: 'rents', label: 'Rents (Box 1)', required: false },
      { field: 'royalties', label: 'Royalties (Box 2)', required: false },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld (Box 4)', required: false },
    ],
    getEntries: (tr) => tr.income1099MISC || [],
    getLabel: (e) => (e.payerName as string) || 'Unnamed payer',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099MISC) => {
      return s + (e.rents || 0) + (e.royalties || 0) + (e.otherIncome || 0);
    }, 0),
  },
  {
    discoveryKey: '1099b',
    formLabel: 'Capital Gains (1099-B)',
    stepId: '1099b_income',
    keyTotalLabel: 'Net gain/loss',
    fields: [
      { field: 'brokerName', label: 'Broker name', required: true },
      { field: 'description', label: 'Description', required: true },
      { field: 'dateSold', label: 'Date sold', required: true },
      { field: 'proceeds', label: 'Proceeds', required: true },
      { field: 'costBasis', label: 'Cost basis', required: true, allowZero: true },
      { field: 'isLongTerm', label: 'Holding period', required: false },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld', required: false },
    ],
    getEntries: (tr) => tr.income1099B || [],
    getLabel: (e) => (e.brokerName as string) || 'Unnamed broker',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099B) => {
      return s + ((e.proceeds || 0) - (e.costBasis || 0));
    }, 0),
  },
  {
    discoveryKey: '1099da',
    formLabel: 'Digital Assets (1099-DA)',
    stepId: '1099da_income',
    keyTotalLabel: 'Net gain/loss',
    fields: [
      { field: 'brokerName', label: 'Broker name', required: true },
      { field: 'proceeds', label: 'Proceeds', required: true },
      { field: 'costBasis', label: 'Cost basis', required: true, allowZero: true },
      { field: 'dateSold', label: 'Date sold', required: true },
      { field: 'isLongTerm', label: 'Holding period', required: false },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld', required: false },
    ],
    getEntries: (tr) => tr.income1099DA || [],
    getLabel: (e) => (e.brokerName as string) || 'Unnamed broker',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099DA) => {
      return s + ((e.proceeds || 0) - (e.costBasis || 0));
    }, 0),
  },
  {
    discoveryKey: 'ssa1099',
    formLabel: 'Social Security',
    stepId: 'ssa1099_income',
    keyTotalLabel: 'Total benefits',
    fields: [
      { field: 'totalBenefits', label: 'Total benefits (Box 5)', required: true },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld (Box 6)', required: false },
    ],
    getEntries: (tr) => {
      const ssa = tr.incomeSSA1099;
      if (!ssa || !ssa.totalBenefits) return [];
      return [ssa];
    },
    getLabel: () => 'Social Security Administration',
    getKeyTotal: (entries) => entries.reduce((s: number, e: IncomeSSA1099) => s + (e.totalBenefits || 0), 0),
  },
  {
    discoveryKey: 'k1',
    formLabel: 'Schedule K-1',
    stepId: 'k1_income',
    keyTotalLabel: 'Total business income',
    fields: [
      { field: 'entityName', label: 'Entity name', required: true },
      { field: 'entityType', label: 'Entity type', required: true },
      { field: 'ordinaryBusinessIncome', label: 'Ordinary business income (Box 1)', required: false },
      { field: 'guaranteedPayments', label: 'Guaranteed payments (Box 4)', required: false },
      { field: 'interestIncome', label: 'Interest income (Box 5)', required: false },
      { field: 'ordinaryDividends', label: 'Ordinary dividends (Box 6a)', required: false },
    ],
    getEntries: (tr) => tr.incomeK1 || [],
    getLabel: (e) => (e.entityName as string) || 'Unnamed entity',
    getKeyTotal: (entries) => entries.reduce((s: number, e: IncomeK1) => {
      return s + (e.ordinaryBusinessIncome || 0) + (e.guaranteedPayments || 0);
    }, 0),
  },
  {
    discoveryKey: '1099sa',
    formLabel: 'HSA Distributions (1099-SA)',
    stepId: '1099sa_income',
    keyTotalLabel: 'Total distributions',
    fields: [
      { field: 'payerName', label: 'Payer name', required: true },
      { field: 'grossDistribution', label: 'Gross distribution (Box 1)', required: true },
      { field: 'distributionCode', label: 'Distribution code (Box 3)', required: false },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld', required: false },
    ],
    getEntries: (tr) => tr.income1099SA || [],
    getLabel: (e) => (e.payerName as string) || 'Unnamed payer',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099SA) => s + (e.grossDistribution || 0), 0),
  },
  {
    discoveryKey: 'w2g',
    formLabel: 'Gambling (W-2G)',
    stepId: 'w2g_income',
    keyTotalLabel: 'Total winnings',
    fields: [
      { field: 'payerName', label: 'Payer name', required: true },
      { field: 'grossWinnings', label: 'Gross winnings (Box 1)', required: true },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld (Box 4)', required: false },
    ],
    getEntries: (tr) => tr.incomeW2G || [],
    getLabel: (e) => (e.payerName as string) || 'Unnamed payer',
    getKeyTotal: (entries) => entries.reduce((s: number, e: IncomeW2G) => s + (e.grossWinnings || 0), 0),
  },
  {
    discoveryKey: '1099c',
    formLabel: 'Cancelled Debt (1099-C)',
    stepId: '1099c_income',
    keyTotalLabel: 'Total cancelled',
    fields: [
      { field: 'payerName', label: 'Creditor name', required: true },
      { field: 'amountCancelled', label: 'Amount cancelled (Box 2)', required: true },
      { field: 'dateOfCancellation', label: 'Date of cancellation (Box 1)', required: false },
      { field: 'federalTaxWithheld', label: 'Federal tax withheld', required: false },
    ],
    getEntries: (tr) => tr.income1099C || [],
    getLabel: (e) => (e.payerName as string) || 'Unnamed creditor',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099C) => s + (e.amountCancelled || 0), 0),
  },
  {
    discoveryKey: '1099q',
    formLabel: 'Education (1099-Q)',
    stepId: '1099q_income',
    keyTotalLabel: 'Total distributions',
    fields: [
      { field: 'payerName', label: 'Plan name', required: true },
      { field: 'grossDistribution', label: 'Gross distribution (Box 1)', required: true },
      { field: 'earnings', label: 'Earnings (Box 2)', required: false },
      { field: 'basisReturn', label: 'Basis return (Box 3)', required: false },
    ],
    getEntries: (tr) => tr.income1099Q || [],
    getLabel: (e) => (e.payerName as string) || 'Unnamed plan',
    getKeyTotal: (entries) => entries.reduce((s: number, e: Income1099Q) => s + (e.grossDistribution || 0), 0),
  },
  {
    discoveryKey: 'rental',
    formLabel: 'Rental Income',
    stepId: 'rental_income',
    keyTotalLabel: 'Total rental income',
    fields: [
      { field: 'address', label: 'Property address', required: true },
      { field: 'rentalIncome', label: 'Rental income', required: true },
      { field: 'propertyType', label: 'Property type', required: false },
      { field: 'daysRented', label: 'Days rented', required: false },
    ],
    getEntries: (tr) => tr.rentalProperties || [],
    getLabel: (e) => (e.address as string) || 'Unnamed property',
    getKeyTotal: (entries) => entries.reduce((s: number, e: RentalProperty) => s + (e.rentalIncome || 0), 0),
  },
];

// ─── Completeness Analysis ──────────────────────────

/** Check a single entry against its field spec. */
function analyzeEntry(
  entry: Record<string, unknown>,
  fields: FieldSpec[],
  labelFn: (e: Record<string, unknown>) => string,
): FormEntry {
  const id = (entry.id as string) || 'unknown';
  const label = labelFn(entry);

  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  let filledCount = 0;

  for (const f of fields) {
    const val = entry[f.field];
    const isFilled = val !== undefined && val !== null && val !== ''
      && (f.allowZero ? true : val !== 0);

    if (isFilled) {
      filledCount++;
    } else if (f.required) {
      missingRequired.push(f.label);
    } else {
      missingOptional.push(f.label);
    }
  }

  // Status: missing optionals do NOT downgrade from 'complete'.
  // 'partial' is reserved for group-level or future use.
  let status: CompletenessStatus;
  if (missingRequired.length > 0) {
    status = 'missing_required';
  } else {
    status = 'complete';
  }

  return {
    id,
    label,
    status,
    filledFields: filledCount,
    totalFields: fields.length,
    missingRequired,
    missingOptional,
  };
}

/** Determine worst status in a group. */
function worstStatus(entries: FormEntry[]): CompletenessStatus {
  if (entries.length === 0) return 'not_entered';
  if (entries.some((e) => e.status === 'missing_required')) return 'missing_required';
  if (entries.some((e) => e.status === 'partial')) return 'partial';
  return 'complete';
}

// ─── Non-Income Section Checks ──────────────────────

function checkPersonalInfo(tr: TaxReturn): NonIncomeSection {
  const issues: string[] = [];
  const summary: string[] = [];

  const required: Array<[string, string]> = [
    ['firstName', 'First name'],
    ['lastName', 'Last name'],
    ['addressStreet', 'Street address'],
    ['addressCity', 'City'],
    ['addressState', 'State'],
    ['addressZip', 'ZIP code'],
  ];

  for (const [field, label] of required) {
    if (!tr[field as keyof TaxReturn]) {
      issues.push(`Missing ${label.toLowerCase()}`);
    }
  }

  if (tr.firstName && tr.lastName) {
    summary.push(`${tr.firstName} ${tr.lastName}`);
  }
  if (tr.addressCity && tr.addressState) {
    summary.push(`${tr.addressCity}, ${tr.addressState}`);
  }

  return {
    id: 'personal_info',
    label: 'Personal Information',
    stepId: 'personal_info',
    status: issues.length > 0 ? 'missing_required' : 'complete',
    summary,
    issues,
  };
}

function checkFilingStatus(tr: TaxReturn): NonIncomeSection {
  const issues: string[] = [];
  const summary: string[] = [];

  if (!tr.filingStatus) {
    issues.push('Filing status not selected');
  } else {
    const labels: Record<number, string> = {
      1: 'Single',
      2: 'Married Filing Jointly',
      3: 'Married Filing Separately',
      4: 'Head of Household',
      5: 'Qualifying Surviving Spouse',
    };
    summary.push(labels[tr.filingStatus as number] || 'Selected');

    // Check spouse info for MFJ
    if (tr.filingStatus === FilingStatus.MarriedFilingJointly) {
      if (!tr.spouseFirstName) issues.push('Missing spouse first name');
      if (!tr.spouseLastName) issues.push('Missing spouse last name');
      if (tr.spouseFirstName && tr.spouseLastName) {
        summary.push(`Spouse: ${tr.spouseFirstName} ${tr.spouseLastName}`);
      }
    }
  }

  return {
    id: 'filing_status',
    label: 'Filing Status',
    stepId: 'filing_status',
    status: issues.length > 0 ? 'missing_required' : 'complete',
    summary,
    issues,
  };
}

function checkDependents(tr: TaxReturn): NonIncomeSection {
  const deps = tr.dependents || [];
  const summary: string[] = [];
  const issues: string[] = [];

  summary.push(`${deps.length} dependent${deps.length !== 1 ? 's' : ''}`);

  for (const dep of deps) {
    const missing: string[] = [];
    if (!dep.firstName) missing.push('first name');
    if (!dep.lastName) missing.push('last name');
    if (!dep.relationship) missing.push('relationship');
    if (missing.length > 0) {
      const name = dep.firstName || dep.lastName || 'Unnamed';
      issues.push(`${name}: missing ${missing.join(', ')}`);
    }
  }

  let status: CompletenessStatus;
  if (deps.length === 0) {
    status = 'complete'; // No dependents is valid
  } else if (issues.length > 0) {
    status = 'missing_required';
  } else {
    status = 'complete';
  }

  return {
    id: 'dependents',
    label: 'Dependents',
    stepId: 'dependents',
    status,
    summary,
    issues,
  };
}

function checkDeductions(tr: TaxReturn): NonIncomeSection {
  const summary: string[] = [];
  const issues: string[] = [];

  if (tr.deductionMethod === 'standard') {
    summary.push('Standard deduction');
  } else if (tr.deductionMethod === 'itemized') {
    summary.push('Itemized deductions');
    const item = tr.itemizedDeductions;
    if (item) {
      const hasValues = [
        item.medicalExpenses, item.stateLocalIncomeTax, item.realEstateTax,
        item.mortgageInterest, item.charitableCash, item.charitableNonCash,
      ].some((v) => v && v > 0);
      if (!hasValues) {
        issues.push('No itemized deduction amounts entered');
      }
    } else {
      issues.push('Itemized deductions selected but no amounts entered');
    }
  } else {
    summary.push('Not yet selected');
    issues.push('Deduction method not selected');
  }

  return {
    id: 'deductions',
    label: 'Deductions',
    stepId: 'deduction_method',
    status: issues.length > 0 ? 'missing_required' : 'complete',
    summary,
    issues,
  };
}

function checkCredits(tr: TaxReturn): NonIncomeSection {
  const summary: string[] = [];
  const issues: string[] = [];

  const eduCount = (tr.educationCredits || []).length;
  if (eduCount > 0) summary.push(`${eduCount} education credit${eduCount !== 1 ? 's' : ''}`);
  if (tr.childTaxCredit) summary.push('Child tax credit');
  if (tr.dependentCare) summary.push('Dependent care credit');
  if (tr.saversCredit) summary.push("Saver's credit");
  if (tr.cleanEnergy) summary.push('Clean energy credit');
  if (tr.evCredit) summary.push('EV credit');
  if (tr.adoptionCredit) summary.push('Adoption credit');

  if (summary.length === 0) {
    summary.push('No credits claimed');
  }

  // Credits are optional — never mark as missing_required
  return {
    id: 'credits',
    label: 'Credits',
    stepId: 'credits_overview',
    status: 'complete',
    summary,
    issues,
  };
}

// ─── Main Builder ──────────────────────────────

export function buildDocumentInventory(taxReturn: TaxReturn): DocumentInventory {
  const discovery = taxReturn.incomeDiscovery || {};

  // Build income groups
  const incomeGroups: FormTypeGroup[] = [];
  const pendingGroups: FormTypeGroup[] = [];

  for (const spec of FORM_TYPE_SPECS) {
    const entries = spec.getEntries(taxReturn);
    const discoveryAnswer = (discovery[spec.discoveryKey] as 'yes' | 'no' | 'later') || 'not_asked';

    // Only include groups that have data OR where the user said 'yes'
    if (entries.length === 0 && discoveryAnswer !== 'yes') continue;

    const formEntries = entries.map((e: Record<string, unknown>) => {
      const analyzed = analyzeEntry(e, spec.fields, spec.getLabel);
      // 1099-MISC: all income fields are optional, but at least one must have a value
      if (spec.discoveryKey === '1099misc' && analyzed.status === 'complete') {
        const raw = e as Record<string, number>;
        const hasIncome = (raw.rents || 0) > 0 || (raw.royalties || 0) > 0 || (raw.otherIncome || 0) > 0;
        if (!hasIncome) {
          return {
            ...analyzed,
            status: 'missing_required' as CompletenessStatus,
            missingRequired: [...analyzed.missingRequired, 'At least one income amount (Rents, Royalties, or Other Income)'],
          };
        }
      }
      return analyzed;
    });

    const group: FormTypeGroup = {
      formType: spec.discoveryKey,
      formLabel: spec.formLabel,
      stepId: spec.stepId,
      discoveryAnswer,
      entries: formEntries,
      count: formEntries.length,
      keyTotal: spec.getKeyTotal(entries),
      keyTotalLabel: spec.keyTotalLabel,
      groupStatus: formEntries.length > 0 ? worstStatus(formEntries) : 'not_entered',
    };

    incomeGroups.push(group);

    // Track pending: discovery='yes' but no entries
    if (discoveryAnswer === 'yes' && formEntries.length === 0) {
      pendingGroups.push(group);
    }
  }

  // Handle otherIncome (plain number, not an array)
  const otherDiscovery = (discovery['other'] as 'yes' | 'no' | 'later') || 'not_asked';
  const otherVal = typeof taxReturn.otherIncome === 'number' ? taxReturn.otherIncome : 0;
  if (otherVal > 0 || otherDiscovery === 'yes') {
    const otherEntries: FormEntry[] = otherVal > 0
      ? [{
          id: 'other_income',
          label: 'Other income',
          status: 'complete' as CompletenessStatus,
          filledFields: 1,
          totalFields: 1,
          missingRequired: [],
          missingOptional: [],
        }]
      : [];
    const otherGroup: FormTypeGroup = {
      formType: 'other',
      formLabel: 'Other Income',
      stepId: 'other_income',
      discoveryAnswer: otherDiscovery,
      entries: otherEntries,
      count: otherEntries.length,
      keyTotal: otherVal,
      keyTotalLabel: 'Total other income',
      groupStatus: otherEntries.length > 0 ? 'complete' : 'not_entered',
    };
    incomeGroups.push(otherGroup);
    if (otherDiscovery === 'yes' && otherEntries.length === 0) {
      pendingGroups.push(otherGroup);
    }
  }

  // Non-income sections
  const nonIncomeSections: NonIncomeSection[] = [
    checkPersonalInfo(taxReturn),
    checkFilingStatus(taxReturn),
    checkDependents(taxReturn),
    checkDeductions(taxReturn),
    checkCredits(taxReturn),
  ];

  // Overall completeness
  const totalFormsEntered = incomeGroups.reduce((s, g) => s + g.count, 0);
  const totalFormsPending = pendingGroups.length;

  // Count completed items vs total items for percentage
  let completedItems = 0;
  let totalItems = 0;

  // Income groups
  for (const g of incomeGroups) {
    if (g.count > 0) {
      totalItems += g.count;
      completedItems += g.entries.filter((e) => e.status === 'complete').length;
    } else {
      // Pending group counts as 1 incomplete item
      totalItems += 1;
    }
  }

  // Non-income sections
  for (const s of nonIncomeSections) {
    totalItems += 1;
    if (s.status === 'complete') completedItems += 1;
  }

  const overallCompleteness = totalItems > 0
    ? Math.round((completedItems / totalItems) * 100)
    : 0;

  return {
    incomeGroups,
    pendingGroups,
    nonIncomeSections,
    overallCompleteness,
    totalFormsEntered,
    totalFormsPending,
  };
}
