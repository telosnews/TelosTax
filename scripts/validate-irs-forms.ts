/**
 * IRS Form Filling Validation Script
 *
 * Runs the tax engine on an ATS scenario, fills the IRS PDF templates
 * using the field mappings from shared/, and reports which fields were
 * filled vs. empty.
 *
 * Usage:
 *   npx tsx scripts/validate-irs-forms.ts
 *
 * Output:
 *   scripts/output/f1040-jones.pdf
 *   scripts/output/f1040s1-jones.pdf   (if applicable)
 *   scripts/output/f1040s2-jones.pdf   (if applicable)
 *   scripts/output/f1040s3-jones.pdf   (if applicable)
 */
import { PDFDocument, PDFCheckBox, PDFTextField } from 'pdf-lib';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Engine imports from shared ──
import { calculateForm1040 } from '../shared/src/engine/form1040.js';
import { FilingStatus } from '../shared/src/types/index.js';
import type { TaxReturn, CalculationResult } from '../shared/src/types/index.js';
import type { IRSFieldMapping, IRSFormTemplate } from '../shared/src/types/irsFormMappings.js';
import { FORM_1040_TEMPLATE } from '../shared/src/constants/irsForm1040Map.js';
import { SCHEDULE_1_TEMPLATE } from '../shared/src/constants/irsSchedule1Map.js';
import { SCHEDULE_2_TEMPLATE } from '../shared/src/constants/irsSchedule2Map.js';
import { SCHEDULE_3_TEMPLATE } from '../shared/src/constants/irsSchedule3Map.js';
import { SCHEDULE_C_TEMPLATE } from '../shared/src/constants/irsScheduleCMap.js';
import { SCHEDULE_D_TEMPLATE } from '../shared/src/constants/irsScheduleDMap.js';
import { SCHEDULE_SE_TEMPLATE } from '../shared/src/constants/irsScheduleSEMap.js';
import { FORM_8949_TEMPLATE } from '../shared/src/constants/irsForm8949Map.js';
import { SCHEDULE_E_TEMPLATE } from '../shared/src/constants/irsScheduleEMap.js';
import { FORM_8962_TEMPLATE } from '../shared/src/constants/irsForm8962Map.js';
import { FORM_5695_TEMPLATE } from '../shared/src/constants/irsForm5695Map.js';
import { FORM_8936_TEMPLATE } from '../shared/src/constants/irsForm8936Map.js';
import { SCHEDULE_A_TEMPLATE } from '../shared/src/constants/irsScheduleAMap.js';

// ── Paths ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const IRS_FORMS_DIR = join(PROJECT_ROOT, 'client', 'public', 'irs-forms');
const OUTPUT_DIR = join(PROJECT_ROOT, 'scripts', 'output');

// ── All templates ──
const ALL_TEMPLATES: IRSFormTemplate[] = [
  FORM_1040_TEMPLATE,
  SCHEDULE_A_TEMPLATE,
  SCHEDULE_1_TEMPLATE,
  SCHEDULE_2_TEMPLATE,
  SCHEDULE_3_TEMPLATE,
  SCHEDULE_C_TEMPLATE,
  SCHEDULE_D_TEMPLATE,
  FORM_8949_TEMPLATE,
  SCHEDULE_E_TEMPLATE,
  FORM_8936_TEMPLATE,
  SCHEDULE_SE_TEMPLATE,
  FORM_8962_TEMPLATE,
  FORM_5695_TEMPLATE,
];

// ════════════════════════════════════════════════════════════════════
// ATS Scenario 2: John & Judy Jones (MFJ, deceased spouse, 2 W-2s,
// dependent, estimated payments)
//
// This exercises many Form 1040 fields: personal info, MFJ filing
// status, spouse info, dependents, W-2 income, standard deduction,
// CTC/ODC, withholding, estimated payments, and refund.
// ════════════════════════════════════════════════════════════════════

function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'validate-irs',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    filingStatus: FilingStatus.Single,
    w2Income: [],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
    deductionMethod: 'standard',
    dependents: [],
    expenses: [],
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  };
}

function buildJonesReturn(): TaxReturn {
  return baseTaxReturn({
    firstName: 'John',
    lastName: 'Jones',
    ssnLastFour: '4000',
    dateOfBirth: '1965-08-02',
    addressStreet: '1234 Main Street',
    addressCity: 'Dallas',
    addressState: 'TX',
    addressZip: '75201',
    filingStatus: FilingStatus.MarriedFilingJointly,
    spouseFirstName: 'Judy',
    spouseLastName: 'Jones',
    spouseSsnLastFour: '4001',
    spouseDateOfBirth: '1966-03-19',
    digitalAssetActivity: false,

    // Deceased spouse
    spouseDateOfDeath: '2025-09-11',
    isDeceasedSpouseReturn: true,

    // Agricultural cooperative patron -- no QBI
    qbiInfo: { isAgriculturalCooperativePatron: true },

    // W-2 #1 (John): Southwest Airlines
    // W-2 #2 (Judy): Target Corporation
    w2Income: [
      {
        id: 'w2-john',
        employerName: 'Southwest Airlines',
        wages: 29513,
        federalTaxWithheld: 1003,
        socialSecurityWages: 29513,
        socialSecurityTax: 1830,
        medicareWages: 29513,
        medicareTax: 428,
      },
      {
        id: 'w2-judy',
        employerName: 'Target Corporation',
        wages: 8513,
        federalTaxWithheld: 161,
        socialSecurityWages: 8513,
        socialSecurityTax: 528,
        medicareWages: 8513,
        medicareTax: 123,
      },
    ],

    // Dependent: Jacob Jones, 19-year-old student (other dependent credit)
    dependents: [
      {
        id: 'dep-jacob',
        firstName: 'Jacob',
        lastName: 'Jones',
        ssnLastFour: '4002',
        relationship: 'Son',
        dateOfBirth: '2006-07-20',
        monthsLivedWithYou: 12,
        isStudent: true,
      },
    ],

    childTaxCredit: {
      qualifyingChildren: 0,
      otherDependents: 1,
    },

    deductionMethod: 'standard',
    estimatedPaymentsMade: 300,
  });
}

// ════════════════════════════════════════════════════════════════════
// Self-Employment Scenario: Sarah Chen (Single, freelance designer,
// 1099-NEC income, business expenses, home office)
// Exercises Schedule C and Schedule SE.
// ════════════════════════════════════════════════════════════════════

function buildSelfEmployedReturn(): TaxReturn {
  return baseTaxReturn({
    firstName: 'Sarah',
    lastName: 'Chen',
    ssnLastFour: '5001',
    dateOfBirth: '1990-03-15',
    addressStreet: '456 Oak Avenue',
    addressCity: 'Austin',
    addressState: 'TX',
    addressZip: '78701',
    filingStatus: FilingStatus.Single,
    digitalAssetActivity: false,

    businesses: [
      {
        id: 'biz-1',
        businessName: 'Chen Design Studio',
        businessEin: '12-3456789',
        principalBusinessCode: '541430',
        businessDescription: 'Graphic Design Services',
        accountingMethod: 'cash' as const,
        didStartThisYear: false,
      },
    ],

    income1099NEC: [
      { id: 'nec-1', payerName: 'Acme Corp', amount: 45000, federalTaxWithheld: 0 },
      { id: 'nec-2', payerName: 'Beta LLC', amount: 30000, federalTaxWithheld: 0 },
    ],

    expenses: [
      { id: 'exp-1', scheduleCLine: 8, category: 'Advertising', amount: 1200 },
      { id: 'exp-2', scheduleCLine: 15, category: 'Insurance', amount: 2400 },
      { id: 'exp-3', scheduleCLine: 17, category: 'Legal', amount: 800 },
      { id: 'exp-4', scheduleCLine: 18, category: 'Office', amount: 3600 },
      { id: 'exp-5', scheduleCLine: 22, category: 'Supplies', amount: 1500 },
      { id: 'exp-6', scheduleCLine: 25, category: 'Utilities', amount: 900 },
      { id: 'exp-7', scheduleCLine: 24, category: 'travel', amount: 2000 },
      { id: 'exp-8', scheduleCLine: 24, category: 'meals', amount: 600, description: 'Business meals' },
    ],

    homeOffice: {
      method: 'simplified',
      squareFeet: 200,
      totalHomeSquareFeet: 1500,
    },

    deductionMethod: 'standard',
    estimatedPaymentsMade: 15000,
  });
}

// ════════════════════════════════════════════════════════════════════
// ATS Scenario 3: David Park — Capital Gains
// Single filer with W-2 income and stock/crypto transactions.
// Tests Schedule D aggregation and Form 8949 transaction detail.
// ════════════════════════════════════════════════════════════════════

function buildCapitalGainsReturn(): TaxReturn {
  return ({
    taxYear: 2025,
    firstName: 'David',
    lastName: 'Park',
    ssn: '555-55-5555',
    ssnLastFour: '5555',
    filingStatus: FilingStatus.SINGLE,
    dateOfBirth: '1988-03-15',
    occupation: 'Software Engineer',
    addressStreet: '456 Market St',
    addressCity: 'San Francisco',
    addressState: 'CA',
    addressZip: '94105',

    // W-2 income
    w2Income: [{
      id: 'w2-1',
      employerName: 'Tech Corp',
      employerEin: '99-8888888',
      wages: 120000,
      federalTaxWithheld: 22000,
      socialSecurityWages: 120000,
      socialSecurityTaxWithheld: 7440,
      medicareWages: 120000,
      medicareTaxWithheld: 1740,
      stateTaxWithheld: 8000,
      stateWages: 120000,
      state: 'CA',
    }],

    // 1099-B: Stock sales (mix of basis-reported and wash sales)
    income1099B: [
      // ST, basis reported, no adjustments → goes directly to Sched D line 1a
      {
        id: 'b-1',
        brokerName: 'Fidelity',
        description: '100 sh AAPL',
        dateAcquired: '2025-03-10',
        dateSold: '2025-07-15',
        proceeds: 18000,
        costBasis: 15000,
        isLongTerm: false,
        basisReportedToIRS: true,
      },
      // ST, basis reported, WITH wash sale adjustment → Form 8949 Box A
      {
        id: 'b-2',
        brokerName: 'Fidelity',
        description: '50 sh TSLA',
        dateAcquired: '2025-01-05',
        dateSold: '2025-02-20',
        proceeds: 8000,
        costBasis: 10000,
        isLongTerm: false,
        basisReportedToIRS: true,
        washSaleLossDisallowed: 1500,
      },
      // LT, basis reported, no adjustments → goes directly to Sched D line 8a
      {
        id: 'b-3',
        brokerName: 'Schwab',
        description: '200 sh MSFT',
        dateAcquired: '2022-06-01',
        dateSold: '2025-09-30',
        proceeds: 72000,
        costBasis: 48000,
        isLongTerm: true,
        basisReportedToIRS: true,
      },
      // LT, basis NOT reported → Form 8949 Box E
      {
        id: 'b-4',
        brokerName: 'TD Ameritrade',
        description: '500 sh XYZ inherited',
        dateAcquired: '2015-01-01',
        dateSold: '2025-11-15',
        proceeds: 25000,
        costBasis: 12000,
        isLongTerm: true,
        basisReportedToIRS: false,
      },
      // Another ST, no adjustments
      {
        id: 'b-5',
        brokerName: 'Fidelity',
        description: '75 sh NVDA',
        dateAcquired: '2025-05-01',
        dateSold: '2025-08-20',
        proceeds: 9500,
        costBasis: 7000,
        isLongTerm: false,
        basisReportedToIRS: true,
      },
    ],

    // Required empty arrays for engine
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099SSA: [],
    income1099MISC: [],
    income1099G: [],
    incomeK1: [],
    rentalProperties: [],
    businesses: [],
    expenses: [],
    dependents: [],
    estimatedPaymentsMade: 5000,
  }) as unknown as TaxReturn;
}

// ════════════════════════════════════════════════════════════════════
// ATS Scenario 4: Maria Garcia — Rental Properties
// Single filer with W-2 income and 2 rental properties.
// Tests Schedule E Part I (per-property income, expenses, totals).
// ════════════════════════════════════════════════════════════════════

function buildRentalPropertyReturn(): TaxReturn {
  return baseTaxReturn({
    firstName: 'Maria',
    lastName: 'Garcia',
    ssnLastFour: '6001',
    dateOfBirth: '1982-11-20',
    addressStreet: '789 Elm Drive',
    addressCity: 'Phoenix',
    addressState: 'AZ',
    addressZip: '85001',
    filingStatus: FilingStatus.Single,
    digitalAssetActivity: false,

    // W-2 income
    w2Income: [{
      id: 'w2-1',
      employerName: 'Desert Health Systems',
      wages: 85000,
      federalTaxWithheld: 12000,
      socialSecurityWages: 85000,
      socialSecurityTax: 5270,
      medicareWages: 85000,
      medicareTax: 1233,
    }],

    // Two rental properties
    rentalProperties: [
      {
        id: 'rental-1',
        address: '123 Investment Lane, Scottsdale, AZ 85251',
        propertyType: 'single_family' as const,
        daysRented: 365,
        personalUseDays: 0,
        rentalIncome: 24000,
        advertising: 200,
        insurance: 1800,
        management: 2400,
        mortgageInterest: 8500,
        repairs: 1200,
        taxes: 3200,
        utilities: 0,
        depreciation: 5500,
        otherExpenses: 300,
      },
      {
        id: 'rental-2',
        address: '456 Cactus Ct, Mesa, AZ 85201',
        propertyType: 'condo' as const,
        daysRented: 350,
        personalUseDays: 10,
        rentalIncome: 18000,
        advertising: 150,
        insurance: 1200,
        cleaning: 600,
        commissions: 900,
        mortgageInterest: 6000,
        repairs: 800,
        taxes: 2400,
        utilities: 1800,
        depreciation: 4200,
      },
    ],

    deductionMethod: 'standard',
    estimatedPaymentsMade: 2000,
  });
}

// ════════════════════════════════════════════════════════════════════
// ATS Scenario 5: Lisa Wong — Clean Energy + EV Credits
// Single filer with W-2 income, solar panels, and a new EV.
// Tests Form 5695 (Part I) and Form 8936.
// ════════════════════════════════════════════════════════════════════

function buildCleanEnergyReturn(): TaxReturn {
  return baseTaxReturn({
    firstName: 'Lisa',
    lastName: 'Wong',
    ssnLastFour: '7001',
    dateOfBirth: '1985-06-12',
    addressStreet: '321 Solar Lane',
    addressCity: 'Denver',
    addressState: 'CO',
    addressZip: '80202',
    filingStatus: FilingStatus.Single,
    digitalAssetActivity: false,

    w2Income: [{
      id: 'w2-1',
      employerName: 'Mountain Tech Inc',
      wages: 95000,
      federalTaxWithheld: 14000,
      socialSecurityWages: 95000,
      socialSecurityTax: 5890,
      medicareWages: 95000,
      medicareTax: 1378,
    }],

    // Clean energy: solar panels + battery storage
    cleanEnergy: {
      solarElectric: 22000,
      batteryStorage: 8000,
    },

    // EV credit: new Tesla Model 3
    evCredit: {
      vehicleDescription: '2025 Tesla Model 3',
      dateAcquired: '2025-04-15',
      vehicleMSRP: 42990,
      purchasePrice: 42990,
      isNewVehicle: true,
      finalAssemblyUS: true,
      meetsBatteryComponentReq: true,
      meetsMineralReq: true,
    },

    deductionMethod: 'standard',
  });
}

// ════════════════════════════════════════════════════════════════════
// ATS Scenario 6: Mark & Amy Rivera — Premium Tax Credit
// MFJ filers with moderate W-2 income and marketplace insurance.
// Tests Form 8962 (PTC monthly details, excess APTC repayment).
// ════════════════════════════════════════════════════════════════════

function buildPremiumTaxCreditReturn(): TaxReturn {
  return baseTaxReturn({
    firstName: 'Mark',
    lastName: 'Rivera',
    ssnLastFour: '8001',
    dateOfBirth: '1978-09-22',
    addressStreet: '555 Health Blvd',
    addressCity: 'Portland',
    addressState: 'OR',
    addressZip: '97201',
    filingStatus: FilingStatus.MarriedFilingJointly,
    spouseFirstName: 'Amy',
    spouseLastName: 'Rivera',
    spouseSsnLastFour: '8002',
    spouseDateOfBirth: '1980-04-18',
    digitalAssetActivity: false,

    w2Income: [{
      id: 'w2-1',
      employerName: 'Rose City Brewing',
      wages: 48000,
      federalTaxWithheld: 3200,
      socialSecurityWages: 48000,
      socialSecurityTax: 2976,
      medicareWages: 48000,
      medicareTax: 696,
    }],

    // Marketplace insurance (Form 1095-A)
    premiumTaxCredit: {
      familySize: 2,
      state: 'OR',
      forms1095A: [{
        id: '1095a-1',
        marketplace: 'Oregon Health Insurance Marketplace',
        policyNumber: 'OR-2025-12345',
        enrollmentPremiums: [850, 850, 850, 850, 850, 850, 850, 850, 850, 850, 850, 850],
        slcspPremiums: [920, 920, 920, 920, 920, 920, 920, 920, 920, 920, 920, 920],
        advancePTC: [400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400],
        coverageMonths: [true, true, true, true, true, true, true, true, true, true, true, true],
      }],
    },

    deductionMethod: 'standard',
  });
}

// ════════════════════════════════════════════════════════════════════
// ATS Scenario 7: James & Karen Thompson — Itemized Deductions
// MFJ filers with high income, mortgage, SALT, charitable, medical.
// Tests Schedule A (itemized deductions).
// ════════════════════════════════════════════════════════════════════

function buildItemizedReturn(): TaxReturn {
  return baseTaxReturn({
    firstName: 'James',
    lastName: 'Thompson',
    ssnLastFour: '9001',
    dateOfBirth: '1972-02-14',
    addressStreet: '100 Lakeside Dr',
    addressCity: 'Greenwich',
    addressState: 'CT',
    addressZip: '06830',
    filingStatus: FilingStatus.MarriedFilingJointly,
    spouseFirstName: 'Karen',
    spouseLastName: 'Thompson',
    spouseSsnLastFour: '9002',
    spouseDateOfBirth: '1974-07-30',
    digitalAssetActivity: false,

    w2Income: [{
      id: 'w2-1',
      employerName: 'Goldman Sachs',
      wages: 250000,
      federalTaxWithheld: 55000,
      socialSecurityWages: 168600,
      socialSecurityTax: 10453,
      medicareWages: 250000,
      medicareTax: 3625,
    }],

    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 25000,
      stateLocalIncomeTax: 18000,
      realEstateTax: 12000,
      personalPropertyTax: 1500,
      mortgageInterest: 22000,
      mortgageInsurancePremiums: 0,
      mortgageBalance: 600000,
      charitableCash: 15000,
      charitableNonCash: 3000,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
  });
}

// ── Value Resolution (from irsFormFiller.ts, adapted for Node.js) ──

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
    case 'string':
      return String(value);
    case 'dollarNoCents': {
      const num = Number(value);
      if (isNaN(num) || num === 0) return '';
      return Math.round(num).toString();
    }
    case 'dollarCents': {
      const num = Number(value);
      if (isNaN(num) || num === 0) return '';
      return num.toFixed(2);
    }
    case 'integer': {
      const num = Number(value);
      if (isNaN(num) || num === 0) return '';
      return Math.round(num).toString();
    }
    case 'ssn':
      return String(value);
    case 'ssnPartial':
      return String(value);
    case 'date':
      return String(value);
    case 'checkbox':
      return '';
    default:
      return String(value);
  }
}

// ── Fill a single form ──

interface FillResult {
  formId: string;
  displayName: string;
  totalFields: number;
  filledFields: number;
  emptyFields: number;
  fieldDetails: Array<{
    pdfFieldName: string;
    value: string | boolean;
    filled: boolean;
  }>;
  pdfBytes: Uint8Array;
}

async function fillForm(
  template: IRSFormTemplate,
  taxReturn: TaxReturn,
  calc: CalculationResult,
): Promise<FillResult> {
  const pdfPath = join(IRS_FORMS_DIR, template.pdfFileName);
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF template not found: ${pdfPath}`);
  }

  const templateBytes = readFileSync(pdfPath);
  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();

  const fieldDetails: FillResult['fieldDetails'] = [];
  let filledCount = 0;

  for (const mapping of template.fields) {
    // Resolve the value
    let rawValue: unknown;
    if (mapping.transform) {
      rawValue = mapping.transform(taxReturn, calc);
    } else {
      const source = mapping.source === 'taxReturn' ? taxReturn : calc;
      rawValue = resolvePath(source as unknown as Record<string, unknown>, mapping.sourcePath);
    }

    // Fill the field
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
          filledCount++;
        }
        fieldDetails.push({
          pdfFieldName: mapping.pdfFieldName,
          value: shouldCheck,
          filled: shouldCheck,
        });
      } catch {
        fieldDetails.push({
          pdfFieldName: mapping.pdfFieldName,
          value: false,
          filled: false,
        });
      }
    } else {
      try {
        const tf = form.getTextField(mapping.pdfFieldName);
        const formatted = typeof rawValue === 'string' && mapping.transform
          ? rawValue
          : formatValue(rawValue, mapping.format);
        if (formatted) {
          // Remove maxLength constraint if it would block the value
          // (IRS fillable PDFs sometimes have overly restrictive maxLength on
          // fields that were designed for XFA layout rather than AcroForm use)
          tf.setMaxLength(undefined);
          tf.setText(formatted);
          filledCount++;
        }
        fieldDetails.push({
          pdfFieldName: mapping.pdfFieldName,
          value: formatted,
          filled: formatted !== '',
        });
      } catch {
        // Field may not exist in this PDF version -- silently skip
        fieldDetails.push({
          pdfFieldName: mapping.pdfFieldName,
          value: '',
          filled: false,
        });
      }
    }
  }

  // Do NOT flatten so fields remain visible / inspectable
  const pdfBytes = await doc.save();

  return {
    formId: template.formId,
    displayName: template.displayName,
    totalFields: template.fields.length,
    filledFields: filledCount,
    emptyFields: template.fields.length - filledCount,
    fieldDetails,
    pdfBytes: new Uint8Array(pdfBytes),
  };
}

// ── Scenario Runner ──

async function runScenario(
  scenarioName: string,
  filePrefix: string,
  taxReturn: TaxReturn,
): Promise<{ totalFields: number; filledFields: number }> {
  console.log('='.repeat(70));
  console.log(`IRS Form Filling — ${scenarioName}`);
  console.log('='.repeat(70));
  console.log();

  console.log(`Taxpayer: ${taxReturn.firstName} ${taxReturn.lastName}`);
  console.log(`Filing Status: ${taxReturn.filingStatus}`);
  console.log();

  // Run the tax engine
  console.log('Running tax engine (calculateForm1040)...');
  const calc = calculateForm1040(taxReturn);
  console.log();

  // Print key calculation results
  console.log('--- Calculation Results ---');
  console.log(`  Total Wages:        $${calc.form1040.totalWages}`);
  console.log(`  Sched C Net Profit: $${calc.form1040.scheduleCNetProfit || 0}`);
  console.log(`  SE Tax:             $${calc.form1040.seTax || 0}`);
  console.log(`  Total Income:       $${calc.form1040.totalIncome}`);
  console.log(`  AGI:                $${calc.form1040.agi}`);
  console.log(`  Taxable Income:     $${calc.form1040.taxableIncome}`);
  console.log(`  Total Tax:          $${Math.round(calc.form1040.totalTax)}`);
  console.log(`  Refund:             $${Math.round(calc.form1040.refundAmount)}`);
  console.log(`  Amount Owed:        $${Math.round(calc.form1040.amountOwed)}`);
  console.log();

  // Ensure output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Determine applicable forms
  const applicableTemplates = ALL_TEMPLATES.filter(t => t.condition(taxReturn, calc));
  console.log(`Applicable forms: ${applicableTemplates.map(t => t.displayName).join(', ')}`);
  console.log();

  // Fill each form and save (with multi-instance support)
  let grandTotalFields = 0;
  let grandFilledFields = 0;

  for (const template of applicableTemplates) {
    const instanceCount = template.instanceCount?.(taxReturn, calc) ?? 1;
    for (let inst = 0; inst < instanceCount; inst++) {
      const fields = (instanceCount > 1 && template.fieldsForInstance)
        ? template.fieldsForInstance(inst, taxReturn, calc)
        : template.fields;
      const instanceTemplate = { ...template, fields };
      const suffix = instanceCount > 1 ? `-${inst + 1}` : '';

      console.log('-'.repeat(70));
      console.log(`Filling ${template.displayName}${suffix ? ` (instance ${inst + 1}/${instanceCount})` : ''} (${template.pdfFileName})...`);

      const result = await fillForm(instanceTemplate, taxReturn, calc);
      grandTotalFields += result.totalFields;
      grandFilledFields += result.filledFields;

      const outputPath = join(OUTPUT_DIR, `${template.formId}${suffix}-${filePrefix}.pdf`);
      writeFileSync(outputPath, result.pdfBytes);
      console.log(`  Saved: ${outputPath}`);
      console.log(`  Mapped fields: ${result.totalFields}`);
      console.log(`  Filled:        ${result.filledFields}`);
      console.log(`  Empty:         ${result.emptyFields}`);
      console.log();

      // Print filled fields
      console.log('  FILLED FIELDS:');
      for (const f of result.fieldDetails) {
        if (f.filled) {
          const shortName = f.pdfFieldName.replace(/topmostSubform\[0\]\./, '').replace(/form1\[0\]\./, '');
          const displayVal = typeof f.value === 'boolean' ? (f.value ? 'CHECKED' : '') : f.value;
          console.log(`    [x] ${shortName} = ${displayVal}`);
        }
      }
      console.log();

      console.log('  EMPTY (unmapped/zero) FIELDS:');
      let emptyCount = 0;
      for (const f of result.fieldDetails) {
        if (!f.filled) {
          const shortName = f.pdfFieldName.replace(/topmostSubform\[0\]\./, '').replace(/form1\[0\]\./, '');
          console.log(`    [ ] ${shortName}`);
          emptyCount++;
        }
      }
      if (emptyCount === 0) console.log('    (none)');
      console.log();
    }
  }

  // Summary
  console.log(`Scenario fill rate: ${grandFilledFields}/${grandTotalFields} (${((grandFilledFields / grandTotalFields) * 100).toFixed(1)}%)`);
  console.log();

  return { totalFields: grandTotalFields, filledFields: grandFilledFields };
}

// ── Main ──

async function main() {
  // Scenario 1: Jones (MFJ, W-2 only)
  const s1 = await runScenario(
    'Scenario 1: John & Judy Jones (MFJ, W-2, deceased spouse)',
    'jones',
    buildJonesReturn(),
  );

  // Scenario 2: Self-employed (Schedule C + SE)
  const s2 = await runScenario(
    'Scenario 2: Sarah Chen (Single, freelance, Schedule C + SE)',
    'chen',
    buildSelfEmployedReturn(),
  );

  // Scenario 3: Capital gains (Schedule D + Form 8949)
  const s3 = await runScenario(
    'Scenario 3: David Park (Single, stock sales, Schedule D + Form 8949)',
    'park',
    buildCapitalGainsReturn(),
  );

  // Scenario 4: Rental properties (Schedule E)
  const s4 = await runScenario(
    'Scenario 4: Maria Garcia (Single, 2 rental properties, Schedule E)',
    'garcia',
    buildRentalPropertyReturn(),
  );

  // Scenario 5: Clean energy + EV credits (Form 5695 + Form 8936)
  const s5 = await runScenario(
    'Scenario 5: Lisa Wong (Single, solar + EV, Form 5695 + Form 8936)',
    'wong',
    buildCleanEnergyReturn(),
  );

  // Scenario 6: Premium tax credit (Form 8962)
  const s6 = await runScenario(
    'Scenario 6: Mark & Amy Rivera (MFJ, marketplace insurance, Form 8962)',
    'rivera',
    buildPremiumTaxCreditReturn(),
  );

  // Scenario 7: Itemized deductions (Schedule A)
  const s7 = await runScenario(
    'Scenario 7: James & Karen Thompson (MFJ, itemized deductions, Schedule A)',
    'thompson',
    buildItemizedReturn(),
  );

  // Grand summary
  const totalFields = s1.totalFields + s2.totalFields + s3.totalFields + s4.totalFields + s5.totalFields + s6.totalFields + s7.totalFields;
  const filledFields = s1.filledFields + s2.filledFields + s3.filledFields + s4.filledFields + s5.filledFields + s6.filledFields + s7.filledFields;
  console.log('='.repeat(70));
  console.log('GRAND SUMMARY (All Scenarios)');
  console.log('='.repeat(70));
  console.log(`  Total mapped fields: ${totalFields}`);
  console.log(`  Fields filled:       ${filledFields}`);
  console.log(`  Fields empty:        ${totalFields - filledFields}`);
  console.log(`  Fill rate:           ${((filledFields / totalFields) * 100).toFixed(1)}%`);
  console.log();
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
