/**
 * Generate Test 1040 PDFs using the 2024 IRS Form 1040 template.
 *
 * Creates filled, flattened 2024 Form 1040 PDFs for testing the competitor
 * return importer. Uses the actual 2024 IRS form (f1040-2024.pdf) with
 * 2024-specific field names.
 *
 * Usage:
 *   npx tsx scripts/generate-test-1040-2024.ts
 *
 * Output:
 *   test-corpus/forms/test-1040-2024-single.pdf
 *   test-corpus/forms/test-1040-2024-mfj.pdf
 *   test-corpus/forms/test-1040-2024-hoh.pdf
 */
import { PDFDocument, PDFCheckBox } from 'pdf-lib';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calculateForm1040 } from '../shared/src/engine/form1040.js';
import { FilingStatus } from '../shared/src/types/index.js';
import type { TaxReturn, CalculationResult } from '../shared/src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const FORM_2024_PATH = join(PROJECT_ROOT, 'client', 'public', 'irs-forms', 'f1040-2024.pdf');
const OUTPUT_DIR = join(PROJECT_ROOT, 'test-corpus', 'forms');

mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── 2024 Form 1040 field names ───────────────────────────
// Discovered via enumerate-pdf-fields.ts on f1040-2024.pdf

const P1 = 'topmostSubform[0].Page1[0]';
const ADDR = `${P1}.Address_ReadOrder[0]`;
const L4_11 = `${P1}.Line4a-11_ReadOrder[0]`;
const P2 = 'topmostSubform[0].Page2[0]';

// Personal info
const FIELDS_2024_PERSONAL = {
  firstName:       `${P1}.f1_01[0]`,
  lastName:        `${P1}.f1_02[0]`,
  ssn:             `${P1}.f1_03[0]`,
  spouseFirstName: `${P1}.f1_04[0]`,
  spouseLastName:  `${P1}.f1_05[0]`,
  spouseSsn:       `${P1}.f1_06[0]`,
  addressStreet:   `${ADDR}.f1_10[0]`,
  addressApt:      `${ADDR}.f1_11[0]`,
  addressCity:     `${ADDR}.f1_12[0]`,
  addressState:    `${ADDR}.f1_13[0]`,
  addressZip:      `${ADDR}.f1_14[0]`,
};

// Filing status checkboxes (2024 form)
const FILING_STATUS_2024: Record<number, string> = {
  [FilingStatus.Single]:                     `${P1}.FilingStatus_ReadOrder[0].c1_3[0]`,
  [FilingStatus.MarriedFilingJointly]:        `${P1}.FilingStatus_ReadOrder[0].c1_3[1]`,
  [FilingStatus.MarriedFilingSeparately]:     `${P1}.FilingStatus_ReadOrder[0].c1_3[2]`,
  [FilingStatus.HeadOfHousehold]:            `${P1}.c1_3[0]`,
  [FilingStatus.QualifyingSurvivingSpouse]:  `${P1}.c1_3[1]`,
};

// Income / financial fields (Page 1)
const FIELDS_2024_INCOME = {
  wages:            `${P1}.f1_32[0]`,     // Line 1a
  householdWages:   `${P1}.f1_33[0]`,     // Line 1b
  tipIncome:        `${P1}.f1_34[0]`,     // Line 1c
  totalWages:       `${P1}.f1_41[0]`,     // Line 1z (sum 1a-1i)
  taxExemptInt:     `${P1}.f1_42[0]`,     // Line 2a
  taxableInterest:  `${P1}.f1_43[0]`,     // Line 2b
  qualifiedDiv:     `${P1}.f1_44[0]`,     // Line 3a
  ordinaryDiv:      `${P1}.f1_45[0]`,     // Line 3b
  iraDistribTotal:  `${L4_11}.f1_46[0]`,  // Line 4a
  iraDistribTax:    `${L4_11}.f1_47[0]`,  // Line 4b
  pensionTotal:     `${L4_11}.f1_48[0]`,  // Line 5a
  pensionTax:       `${L4_11}.f1_49[0]`,  // Line 5b
  ssTotal:          `${L4_11}.f1_50[0]`,  // Line 6a
  ssTaxable:        `${L4_11}.f1_51[0]`,  // Line 6b
  capitalGain:      `${L4_11}.f1_52[0]`,  // Line 7
  otherIncome:      `${L4_11}.f1_53[0]`,  // Line 8
  totalIncome:      `${L4_11}.f1_54[0]`,  // Line 9
  adjustments:      `${L4_11}.f1_55[0]`,  // Line 10
  agi:              `${L4_11}.f1_56[0]`,  // Line 11
  deduction:        `${P1}.f1_57[0]`,     // Line 12
  qbiDeduction:     `${P1}.f1_58[0]`,     // Line 13
  totalDeductions:  `${P1}.f1_59[0]`,     // Line 14
  taxableIncome:    `${P1}.f1_60[0]`,     // Line 15
};

// Page 2 financial fields
const FIELDS_2024_PAGE2 = {
  tax:              `${P2}.f2_01[0]`,     // Line 16
  schedule2Tax:     `${P2}.f2_02[0]`,     // Line 17
  totalTaxBefore:   `${P2}.f2_03[0]`,     // Line 18
  childTaxCredit:   `${P2}.f2_04[0]`,     // Line 19
  schedule3Credits: `${P2}.f2_05[0]`,     // Line 20
  totalCredits:     `${P2}.f2_06[0]`,     // Line 21
  taxAfterCredits:  `${P2}.f2_07[0]`,     // Line 22
  otherTaxes:       `${P2}.f2_08[0]`,     // Line 23
  totalTax:         `${P2}.f2_09[0]`,     // Line 24
  w2Withholding:    `${P2}.f2_10[0]`,     // Line 25a
  withholding1099:  `${P2}.f2_11[0]`,     // Line 25b
  otherWithholding: `${P2}.f2_12[0]`,     // Line 25c
  totalWithholding: `${P2}.f2_13[0]`,     // Line 25d
  estimatedPmts:    `${P2}.f2_14[0]`,     // Line 26
  eic:              `${P2}.f2_15[0]`,     // Line 27a
  additionalCTC:    `${P2}.f2_18[0]`,     // Line 28
  totalOtherPmts:   `${P2}.f2_22[0]`,     // Line 32
  totalPayments:    `${P2}.f2_23[0]`,     // Line 33
  overpaid:         `${P2}.f2_24[0]`,     // Line 34
  refund:           `${P2}.f2_27[0]`,     // Line 35a
  appliedToNext:    `${P2}.f2_28[0]`,     // Line 36
  amountOwed:       `${P2}.f2_29[0]`,     // Line 37
};

// Dependent fields (2024)
const DEP_TABLE = `${P1}.Table_Dependents[0]`;
const DEP_ROWS_2024 = [
  { name: `${DEP_TABLE}.Row1[0].f1_20[0]`, ssn: `${DEP_TABLE}.Row1[0].f1_21[0]`, rel: `${DEP_TABLE}.Row1[0].f1_22[0]`, ctc: `${DEP_TABLE}.Row1[0].c1_14[0]` },
  { name: `${DEP_TABLE}.Row2[0].f1_23[0]`, ssn: `${DEP_TABLE}.Row2[0].f1_24[0]`, rel: `${DEP_TABLE}.Row2[0].f1_25[0]`, ctc: `${DEP_TABLE}.Row2[0].c1_16[0]` },
  { name: `${DEP_TABLE}.Row3[0].f1_26[0]`, ssn: `${DEP_TABLE}.Row3[0].f1_27[0]`, rel: `${DEP_TABLE}.Row3[0].f1_28[0]`, ctc: `${DEP_TABLE}.Row3[0].c1_18[0]` },
  { name: `${DEP_TABLE}.Row4[0].f1_29[0]`, ssn: `${DEP_TABLE}.Row4[0].f1_30[0]`, rel: `${DEP_TABLE}.Row4[0].f1_31[0]`, ctc: `${DEP_TABLE}.Row4[0].c1_20[0]` },
];

// ─── Helpers ──────────────────────────────────────────

function dollarStr(val: number | undefined): string {
  if (val === undefined || val === null || val === 0) return '';
  return Math.round(val).toString();
}

function setTextField(form: ReturnType<PDFDocument['getForm']>, name: string, value: string) {
  if (!value) return;
  try {
    const field = form.getTextField(name);
    field.setMaxLength(undefined);
    field.setText(value);
  } catch { /* field may not exist in this version of the form */ }
}

function checkBox(form: ReturnType<PDFDocument['getForm']>, name: string) {
  try {
    const cb = form.getCheckBox(name);
    cb.check();
  } catch { /* field may not exist */ }
}

// ─── Form Filler ──────────────────────────────────────

async function fill2024Form(
  taxReturn: TaxReturn,
  calc: CalculationResult,
  outputFilename: string,
): Promise<void> {
  const templateBytes = readFileSync(FORM_2024_PATH);
  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();
  const f = calc.form1040;

  // ── Personal info ──
  setTextField(form, FIELDS_2024_PERSONAL.firstName, taxReturn.firstName || '');
  setTextField(form, FIELDS_2024_PERSONAL.lastName, taxReturn.lastName || '');
  setTextField(form, FIELDS_2024_PERSONAL.ssn, (taxReturn as Record<string, unknown>).ssn as string || '');
  setTextField(form, FIELDS_2024_PERSONAL.spouseFirstName, taxReturn.spouseFirstName || '');
  setTextField(form, FIELDS_2024_PERSONAL.spouseLastName, taxReturn.spouseLastName || '');
  setTextField(form, FIELDS_2024_PERSONAL.spouseSsn, (taxReturn as Record<string, unknown>).spouseSsn as string || '');
  setTextField(form, FIELDS_2024_PERSONAL.addressStreet, taxReturn.addressStreet || '');
  setTextField(form, FIELDS_2024_PERSONAL.addressCity, taxReturn.addressCity || '');
  setTextField(form, FIELDS_2024_PERSONAL.addressState, taxReturn.addressState || '');
  setTextField(form, FIELDS_2024_PERSONAL.addressZip, taxReturn.addressZip || '');

  // ── Filing status ──
  const fsField = FILING_STATUS_2024[taxReturn.filingStatus ?? FilingStatus.Single];
  if (fsField) checkBox(form, fsField);

  // ── Dependents ──
  const deps = taxReturn.dependents || [];
  for (let i = 0; i < Math.min(deps.length, 4); i++) {
    const dep = deps[i];
    const row = DEP_ROWS_2024[i];
    setTextField(form, row.name, `${dep.firstName} ${dep.lastName}`);
    if (dep.ssnLastFour) setTextField(form, row.ssn, `***-**-${dep.ssnLastFour}`);
    if (dep.relationship) setTextField(form, row.rel, dep.relationship);
    checkBox(form, row.ctc);
  }

  // ── Income (Page 1) ──
  setTextField(form, FIELDS_2024_INCOME.wages, dollarStr(f.totalWages));
  setTextField(form, FIELDS_2024_INCOME.totalWages, dollarStr(f.totalWages));
  setTextField(form, FIELDS_2024_INCOME.taxableInterest, dollarStr(f.totalInterest));
  setTextField(form, FIELDS_2024_INCOME.qualifiedDiv, dollarStr(f.qualifiedDividends));
  setTextField(form, FIELDS_2024_INCOME.ordinaryDiv, dollarStr(f.totalDividends));
  setTextField(form, FIELDS_2024_INCOME.iraDistribTax, dollarStr(f.iraDistributionsTaxable));
  setTextField(form, FIELDS_2024_INCOME.pensionTax, dollarStr(f.pensionDistributionsTaxable));
  setTextField(form, FIELDS_2024_INCOME.ssTaxable, dollarStr(f.taxableSocialSecurity));
  setTextField(form, FIELDS_2024_INCOME.capitalGain, dollarStr(f.capitalGainOrLoss));
  setTextField(form, FIELDS_2024_INCOME.otherIncome, dollarStr(f.otherIncome));
  setTextField(form, FIELDS_2024_INCOME.totalIncome, dollarStr(f.totalIncome));
  setTextField(form, FIELDS_2024_INCOME.adjustments, dollarStr(f.adjustmentsToIncome));
  setTextField(form, FIELDS_2024_INCOME.agi, dollarStr(f.agi));
  setTextField(form, FIELDS_2024_INCOME.deduction, dollarStr(f.deductionAmount));
  setTextField(form, FIELDS_2024_INCOME.totalDeductions, dollarStr(f.deductionAmount));
  setTextField(form, FIELDS_2024_INCOME.taxableIncome, dollarStr(f.taxableIncome));

  // ── Taxes & Payments (Page 2) ──
  setTextField(form, FIELDS_2024_PAGE2.tax, dollarStr(f.taxBeforeCredits));
  setTextField(form, FIELDS_2024_PAGE2.totalTaxBefore, dollarStr(f.taxBeforeCredits));
  setTextField(form, FIELDS_2024_PAGE2.childTaxCredit, dollarStr(f.childTaxCredit));
  setTextField(form, FIELDS_2024_PAGE2.totalCredits, dollarStr(f.totalCredits));
  setTextField(form, FIELDS_2024_PAGE2.taxAfterCredits, dollarStr(Math.max(0, f.taxBeforeCredits - f.totalCredits)));
  setTextField(form, FIELDS_2024_PAGE2.totalTax, dollarStr(f.totalTax));
  setTextField(form, FIELDS_2024_PAGE2.w2Withholding, dollarStr(f.federalWithholding));
  setTextField(form, FIELDS_2024_PAGE2.totalWithholding, dollarStr(f.federalWithholding));
  setTextField(form, FIELDS_2024_PAGE2.additionalCTC, dollarStr(f.additionalChildTaxCredit));
  setTextField(form, FIELDS_2024_PAGE2.totalPayments, dollarStr(f.totalPayments));
  setTextField(form, FIELDS_2024_PAGE2.overpaid, dollarStr(f.refundAmount));
  setTextField(form, FIELDS_2024_PAGE2.refund, dollarStr(f.refundAmount));
  setTextField(form, FIELDS_2024_PAGE2.amountOwed, dollarStr(f.amountOwed));

  // Flatten to simulate competitor PDF output
  form.flatten();

  const pdfBytes = await doc.save();
  const outPath = join(OUTPUT_DIR, outputFilename);
  writeFileSync(outPath, pdfBytes);
  console.log(`  Saved: ${outPath} (${pdfBytes.length} bytes)`);
}

// ─── Base Return Factory ──────────────────────────────

function makeReturn(overrides: Partial<TaxReturn>): TaxReturn {
  return {
    id: 'test-2024',
    taxYear: 2024,
    schemaVersion: 10,
    status: 'filed',
    currentStep: 0,
    currentSection: 'review',
    createdAt: '2025-04-10',
    updatedAt: '2025-04-10',
    filingStatus: FilingStatus.Single,
    firstName: '',
    lastName: '',
    ssnLastFour: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    w2Income: [],
    income1099INT: [],
    income1099DIV: [],
    income1099B: [],
    income1099R: [],
    income1099MISC: [],
    income1099NEC: [],
    income1099G: [],
    income1099K: [],
    income1099SSA: [],
    income1099S: [],
    businesses: [],
    dependents: [],
    stateReturns: [],
    ...overrides,
  } as TaxReturn;
}

// ─── Test Personas ────────────────────────────────────

// Persona 1: Single W-2 employee with investment income
const persona1 = makeReturn({
  firstName: 'Sarah',
  lastName: 'Chen',
  ssn: '412-55-7890',
  ssnLastFour: '7890',
  addressStreet: '1234 Market Street, Apt 5C',
  addressCity: 'Philadelphia',
  addressState: 'PA',
  addressZip: '19103',
  filingStatus: FilingStatus.Single,
  occupation: 'Software Engineer',
  w2Income: [{
    employerName: 'TechCorp Inc',
    employerEIN: '23-4567890',
    wages: 92000,
    federalTaxWithheld: 16500,
    socialSecurityWages: 92000,
    socialSecurityTax: 5704,
    medicareWages: 92000,
    medicareTax: 1334,
    stateName: 'PA',
    stateWages: 92000,
    stateTaxWithheld: 2824,
  }],
  income1099INT: [{
    payerName: 'Vanguard Brokerage',
    taxableInterest: 850,
    taxExemptInterest: 200,
  }],
  income1099DIV: [{
    payerName: 'Vanguard Brokerage',
    ordinaryDividends: 3200,
    qualifiedDividends: 2800,
  }],
  stateReturns: [{ stateCode: 'PA' }],
});

// Persona 2: MFJ couple with W-2 + 1099 income and dependents
const persona2 = makeReturn({
  firstName: 'Michael',
  lastName: 'Williams',
  ssn: '333-22-1111',
  ssnLastFour: '1111',
  spouseFirstName: 'Jennifer',
  spouseLastName: 'Williams',
  spouseSsn: '333-22-2222',
  spouseSsnLastFour: '2222',
  addressStreet: '456 Elm Drive',
  addressCity: 'Austin',
  addressState: 'TX',
  addressZip: '78701',
  filingStatus: FilingStatus.MarriedFilingJointly,
  occupation: 'Teacher',
  spouseOccupation: 'Nurse',
  w2Income: [
    {
      employerName: 'Austin ISD',
      employerEIN: '74-1234567',
      wages: 58000,
      federalTaxWithheld: 5800,
      socialSecurityWages: 58000,
      socialSecurityTax: 3596,
      medicareWages: 58000,
      medicareTax: 841,
      stateName: 'TX',
    },
    {
      employerName: 'St. David\'s Medical Center',
      employerEIN: '74-9876543',
      wages: 72000,
      federalTaxWithheld: 9200,
      socialSecurityWages: 72000,
      socialSecurityTax: 4464,
      medicareWages: 72000,
      medicareTax: 1044,
      stateName: 'TX',
    },
  ],
  income1099INT: [{
    payerName: 'Chase Bank',
    taxableInterest: 420,
  }],
  dependents: [
    {
      firstName: 'Emma',
      lastName: 'Williams',
      relationship: 'daughter',
      dateOfBirth: '2016-03-15',
      ssnLastFour: '4444',
      livesWithTaxpayer: true,
      monthsLivedWithTaxpayer: 12,
    },
    {
      firstName: 'Lucas',
      lastName: 'Williams',
      relationship: 'son',
      dateOfBirth: '2018-08-22',
      ssnLastFour: '5555',
      livesWithTaxpayer: true,
      monthsLivedWithTaxpayer: 12,
    },
  ],
  stateReturns: [{ stateCode: 'TX' }],
});

// Persona 3: Head of Household with 1099 income
const persona3 = makeReturn({
  firstName: 'Maria',
  lastName: 'Rodriguez',
  ssn: '555-44-3333',
  ssnLastFour: '3333',
  addressStreet: '789 Sunset Blvd, Unit 12',
  addressCity: 'Los Angeles',
  addressState: 'CA',
  addressZip: '90028',
  filingStatus: FilingStatus.HeadOfHousehold,
  occupation: 'Freelance Designer',
  w2Income: [{
    employerName: 'Creative Agency LLC',
    employerEIN: '95-1234567',
    wages: 48000,
    federalTaxWithheld: 4200,
    socialSecurityWages: 48000,
    socialSecurityTax: 2976,
    medicareWages: 48000,
    medicareTax: 696,
    stateName: 'CA',
    stateWages: 48000,
    stateTaxWithheld: 1440,
  }],
  income1099DIV: [{
    payerName: 'Fidelity Investments',
    ordinaryDividends: 1800,
    qualifiedDividends: 1400,
    capitalGainDistributions: 600,
  }],
  income1099B: [{
    description: '100 shares AAPL',
    dateAcquired: '2023-03-15',
    dateSold: '2024-09-20',
    proceeds: 22000,
    costBasis: 15000,
    gainOrLoss: 7000,
    isLongTerm: true,
    basisReportedToIRS: true,
  }],
  dependents: [{
    firstName: 'Sofia',
    lastName: 'Rodriguez',
    relationship: 'daughter',
    dateOfBirth: '2015-11-02',
    ssnLastFour: '7777',
    livesWithTaxpayer: true,
    monthsLivedWithTaxpayer: 12,
  }],
  stateReturns: [{ stateCode: 'CA' }],
});

// ─── Main ─────────────────────────────────────────────

async function main() {
  console.log('Generating Test 1040 PDFs (2024 Form Template)');
  console.log('='.repeat(60));

  const scenarios = [
    { name: 'Single W-2 + Investments', file: 'test-1040-2024-single.pdf', tr: persona1 },
    { name: 'MFJ + Dependents', file: 'test-1040-2024-mfj.pdf', tr: persona2 },
    { name: 'HOH + 1099-NEC', file: 'test-1040-2024-hoh.pdf', tr: persona3 },
  ];

  for (const { name, file, tr } of scenarios) {
    console.log(`\n--- ${name} ---`);
    console.log(`  ${tr.firstName} ${tr.lastName}, ${FilingStatus[tr.filingStatus!]}`);

    const calc = calculateForm1040({
      ...tr,
      filingStatus: tr.filingStatus ?? FilingStatus.Single,
    });

    const f = calc.form1040;
    console.log(`  Wages:        $${f.totalWages}`);
    console.log(`  Interest:     $${f.totalInterest}`);
    console.log(`  Dividends:    $${f.totalDividends}`);
    console.log(`  Capital Gain: $${f.capitalGainOrLoss}`);
    console.log(`  Total Income: $${f.totalIncome}`);
    console.log(`  AGI:          $${f.agi}`);
    console.log(`  Deduction:    $${f.deductionAmount}`);
    console.log(`  Taxable Inc:  $${f.taxableIncome}`);
    console.log(`  Total Tax:    $${f.totalTax}`);
    console.log(`  Withholding:  $${f.federalWithholding}`);
    console.log(`  Total Pmts:   $${f.totalPayments}`);
    console.log(`  Refund:       $${f.refundAmount || 0}`);
    console.log(`  Owed:         $${f.amountOwed || 0}`);

    await fill2024Form(tr, calc, file);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done! Test PDFs saved to test-corpus/forms/');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
