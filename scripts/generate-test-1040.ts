/**
 * Generate Test 1040 PDF
 *
 * Creates a clean, filled 2024 Form 1040 (2 pages only — no intro pages,
 * no schedules, no state returns) for testing the competitor return importer.
 *
 * Uses the existing IRS form template + field mappings + tax engine.
 *
 * Usage:
 *   npx tsx scripts/generate-test-1040.ts
 *
 * Output:
 *   test-corpus/forms/test-1040-2024-single.pdf
 *   test-corpus/forms/test-1040-2024-mfj.pdf
 *   test-corpus/forms/test-1040-2024-hoh.pdf
 */
import { PDFDocument, PDFCheckBox, PDFTextField } from 'pdf-lib';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calculateForm1040 } from '../shared/src/engine/form1040.js';
import { FilingStatus } from '../shared/src/types/index.js';
import type { TaxReturn, CalculationResult } from '../shared/src/types/index.js';
import type { IRSFieldMapping, IRSFormTemplate } from '../shared/src/types/irsFormMappings.js';
import { FORM_1040_TEMPLATE } from '../shared/src/constants/irsForm1040Map.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const IRS_FORMS_DIR = join(PROJECT_ROOT, 'client', 'public', 'irs-forms');
const OUTPUT_DIR = join(PROJECT_ROOT, 'test-corpus', 'forms');

mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Helpers ──────────────────────────────────────────

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

function formatValue(value: unknown, format: IRSFieldMapping['format']): string {
  if (value === undefined || value === null) return '';
  switch (format) {
    case 'string': return String(value);
    case 'dollarNoCents': {
      const num = Number(value);
      return isNaN(num) || num === 0 ? '' : Math.round(num).toString();
    }
    case 'dollarCents': {
      const num = Number(value);
      return isNaN(num) || num === 0 ? '' : num.toFixed(2);
    }
    case 'integer': {
      const num = Number(value);
      return isNaN(num) || num === 0 ? '' : Math.round(num).toString();
    }
    case 'ssn': return String(value);
    case 'ssnPartial': return String(value);
    case 'date': return String(value);
    case 'checkbox': return '';
    default: return String(value);
  }
}

// ─── Form Filler ──────────────────────────────────────

async function fillAndSave1040(
  taxReturn: TaxReturn,
  calc: CalculationResult,
  outputFilename: string,
): Promise<void> {
  const pdfPath = join(IRS_FORMS_DIR, FORM_1040_TEMPLATE.pdfFileName);
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF template not found: ${pdfPath}`);
  }

  const templateBytes = readFileSync(pdfPath);
  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();

  let filled = 0;
  for (const mapping of FORM_1040_TEMPLATE.fields) {
    let rawValue: unknown;
    if (mapping.transform) {
      rawValue = mapping.transform(taxReturn, calc);
    } else {
      const source = mapping.source === 'taxReturn' ? taxReturn : calc;
      rawValue = resolvePath(source as unknown as Record<string, unknown>, mapping.sourcePath);
    }

    if (mapping.format === 'checkbox') {
      try {
        const cb = form.getCheckBox(mapping.pdfFieldName);
        let shouldCheck = false;
        if (mapping.transform) {
          shouldCheck = Boolean(rawValue);
        } else if (mapping.checkWhen) {
          shouldCheck = mapping.checkWhen(rawValue, taxReturn, calc);
        } else {
          shouldCheck = Boolean(rawValue);
        }
        if (shouldCheck) {
          cb.check();
          filled++;
        }
      } catch { /* field may not exist */ }
    } else {
      try {
        const tf = form.getTextField(mapping.pdfFieldName);
        const formatted = typeof rawValue === 'string' && mapping.transform
          ? rawValue
          : formatValue(rawValue, mapping.format);
        if (formatted) {
          tf.setMaxLength(undefined);
          tf.setText(formatted);
          filled++;
        }
      } catch { /* field may not exist */ }
    }
  }

  // Flatten the form to make it a flat (non-fillable) PDF — matching how
  // competitors export. This also removes AcroForm fields,
  // forcing the importer to use text-based extraction.
  form.flatten();

  const pdfBytes = await doc.save();
  const outPath = join(OUTPUT_DIR, outputFilename);
  writeFileSync(outPath, pdfBytes);
  console.log(`  Saved: ${outPath} (${filled} fields filled, ${pdfBytes.length} bytes)`);
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
  console.log('Generating Test 1040 PDFs for Competitor Import Testing');
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

    console.log(`  Total Income: $${calc.form1040.totalIncome}`);
    console.log(`  AGI:          $${calc.form1040.agi}`);
    console.log(`  Total Tax:    $${calc.form1040.totalTax}`);
    console.log(`  Refund:       $${calc.form1040.refundAmount || 0}`);
    console.log(`  Owed:         $${calc.form1040.amountOwed || 0}`);

    await fillAndSave1040(tr, calc, file);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done! Test PDFs saved to test-corpus/forms/');
  console.log('Use these to test the competitor return import feature.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
