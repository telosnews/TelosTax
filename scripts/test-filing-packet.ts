/**
 * Filing Packet Test Script
 *
 * Generates a filing packet (cover page + IRS forms) for a test scenario
 * and writes it to scripts/output/ for manual inspection.
 *
 * Usage:
 *   npx tsx scripts/test-filing-packet.ts
 */
import { PDFDocument } from 'pdf-lib';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { calculateForm1040 } from '../shared/src/engine/form1040.js';
import { getFilingInstructions } from '../shared/src/constants/filingInstructions.js';
import { FilingStatus } from '../shared/src/types/index.js';
import type { TaxReturn, CalculationResult } from '../shared/src/types/index.js';
import type { IRSFormTemplate, IRSFieldMapping } from '../shared/src/types/irsFormMappings.js';
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
import { StandardFonts, rgb } from 'pdf-lib';
import type { PDFPage, PDFFont } from 'pdf-lib';
import type { FilingInstructions } from '../shared/src/constants/filingInstructions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const IRS_FORMS_DIR = join(PROJECT_ROOT, 'client', 'public', 'irs-forms');
const OUTPUT_DIR = join(PROJECT_ROOT, 'scripts', 'output');

mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Replicate cover page generation (same as irsFormFiller.ts) ──

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_L = 50;
const MARGIN_R = 50;
const MARGIN_T = 50;
const MARGIN_B = 60;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

const BLACK = rgb(0, 0, 0);
const DARK_GRAY = rgb(0.3, 0.3, 0.3);
const LIGHT_GRAY = rgb(0.6, 0.6, 0.6);
const LINE_COLOR = rgb(0.85, 0.85, 0.85);
const HEADER_BG = rgb(0.95, 0.95, 0.97);
const ACCENT = rgb(0.1, 0.3, 0.65);
const MONEY_GREEN = rgb(0.0, 0.5, 0.2);
const MONEY_RED = rgb(0.7, 0.1, 0.1);

interface CoverFonts { regular: PDFFont; bold: PDFFont; italic: PDFFont; }
interface Cursor { y: number; }

function ensureSpace(cursor: Cursor, needed: number, doc: PDFDocument): PDFPage {
  if (cursor.y - needed < MARGIN_B) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    cursor.y = PAGE_H - MARGIN_T;
    return page;
  }
  return doc.getPages()[doc.getPageCount() - 1];
}

function drawCoverSectionHeader(page: PDFPage, fonts: CoverFonts, cursor: Cursor, title: string) {
  cursor.y -= 8;
  page.drawRectangle({ x: MARGIN_L - 5, y: cursor.y - 4, width: CONTENT_W + 10, height: 20, color: HEADER_BG });
  page.drawText(title.toUpperCase(), { x: MARGIN_L, y: cursor.y, size: 9, font: fonts.bold, color: ACCENT });
  cursor.y -= 22;
}

async function generateCoverPagePDF(
  taxReturn: TaxReturn, _calc: CalculationResult, instructions: FilingInstructions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_W, PAGE_H]);
  const fonts: CoverFonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const cursor: Cursor = { y: PAGE_H - MARGIN_T };

  // Header
  page.drawText('TelosTax Filing Packet', { x: MARGIN_L, y: cursor.y, size: 18, font: fonts.bold, color: ACCENT });
  cursor.y -= 20;
  page.drawText(`Tax Year ${taxReturn.taxYear || 2025}`, { x: MARGIN_L, y: cursor.y, size: 11, font: fonts.regular, color: DARK_GRAY });
  cursor.y -= 16;

  const names: string[] = [];
  if (taxReturn.firstName || taxReturn.lastName) names.push(`${taxReturn.firstName || ''} ${taxReturn.lastName || ''}`.trim());
  if (taxReturn.spouseFirstName || taxReturn.spouseLastName) names.push(`${taxReturn.spouseFirstName || ''} ${taxReturn.spouseLastName || ''}`.trim());
  if (names.length > 0) {
    page.drawText(names.join(' & '), { x: MARGIN_L, y: cursor.y, size: 10, font: fonts.regular, color: BLACK });
    cursor.y -= 14;
  }

  page.drawLine({ start: { x: MARGIN_L, y: cursor.y }, end: { x: PAGE_W - MARGIN_R, y: cursor.y }, thickness: 0.5, color: LINE_COLOR });
  cursor.y -= 12;

  // Filing Deadline
  page.drawText('Filing Deadline:', { x: MARGIN_L, y: cursor.y, size: 9, font: fonts.bold, color: BLACK });
  const dlW = fonts.bold.widthOfTextAtSize('Filing Deadline:', 9);
  page.drawText(`  ${instructions.deadline}`, { x: MARGIN_L + dlW, y: cursor.y, size: 9, font: fonts.regular, color: DARK_GRAY });
  cursor.y -= 18;

  // Forms Included
  drawCoverSectionHeader(page, fonts, cursor, 'Forms in Your Return');
  for (let i = 0; i < instructions.formsIncluded.length; i++) {
    page = ensureSpace(cursor, 14, doc);
    page.drawText(`${i + 1}.`, { x: MARGIN_L + 4, y: cursor.y, size: 8, font: fonts.regular, color: LIGHT_GRAY });
    page.drawText(instructions.formsIncluded[i].displayName, { x: MARGIN_L + 20, y: cursor.y, size: 9, font: fonts.regular, color: BLACK });
    cursor.y -= 14;
  }
  page.drawText('Print all pages, even if some are blank.', { x: MARGIN_L, y: cursor.y, size: 7, font: fonts.italic, color: LIGHT_GRAY });
  cursor.y -= 16;

  // Mailing Address
  page = ensureSpace(cursor, 80, doc);
  drawCoverSectionHeader(page, fonts, cursor, 'Mail To');
  const addrBoxH = instructions.mailingAddress.length * 14 + 10;
  page.drawRectangle({ x: MARGIN_L, y: cursor.y - addrBoxH + 12, width: 250, height: addrBoxH, color: rgb(0.96, 0.96, 0.96), borderColor: LINE_COLOR, borderWidth: 0.5 });
  for (const line of instructions.mailingAddress) {
    page.drawText(line, { x: MARGIN_L + 10, y: cursor.y, size: 9, font: fonts.regular, color: BLACK });
    cursor.y -= 14;
  }
  cursor.y -= 6;
  page.drawText('Send via USPS. Use certified mail with return receipt for proof of delivery.', { x: MARGIN_L, y: cursor.y, size: 7, font: fonts.italic, color: LIGHT_GRAY });
  cursor.y -= 16;

  // Before You Mail
  page = ensureSpace(cursor, 80, doc);
  drawCoverSectionHeader(page, fonts, cursor, 'Before You Mail');
  page.drawText('[ ]', { x: MARGIN_L + 4, y: cursor.y, size: 10, font: fonts.regular, color: ACCENT });
  page.drawText(instructions.signatureLines, { x: MARGIN_L + 20, y: cursor.y, size: 8, font: fonts.regular, color: DARK_GRAY });
  cursor.y -= 14;

  if (instructions.attachments.length > 0) {
    page = ensureSpace(cursor, 14 + instructions.attachments.length * 14, doc);
    page.drawText('[ ]', { x: MARGIN_L + 4, y: cursor.y, size: 10, font: fonts.regular, color: ACCENT });
    page.drawText('Attach to the front of your return:', { x: MARGIN_L + 20, y: cursor.y, size: 8, font: fonts.bold, color: DARK_GRAY });
    cursor.y -= 14;
    for (const item of instructions.attachments) {
      page = ensureSpace(cursor, 14, doc);
      page.drawText('\u2022', { x: MARGIN_L + 28, y: cursor.y, size: 8, font: fonts.regular, color: ACCENT });
      page.drawText(item, { x: MARGIN_L + 40, y: cursor.y, size: 8, font: fonts.regular, color: DARK_GRAY });
      cursor.y -= 14;
    }
  }

  page = ensureSpace(cursor, 14, doc);
  page.drawText('[ ]', { x: MARGIN_L + 4, y: cursor.y, size: 10, font: fonts.regular, color: ACCENT });
  page.drawText('Do not staple or paper-clip your payment to the return. Place it loosely in the envelope.', { x: MARGIN_L + 20, y: cursor.y, size: 8, font: fonts.regular, color: DARK_GRAY });
  cursor.y -= 18;

  // Payment
  if (instructions.owesAmount > 0) {
    page = ensureSpace(cursor, 60, doc);
    drawCoverSectionHeader(page, fonts, cursor, 'Payment Due');
    const amt = instructions.owesAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    page.drawText(`Amount Owed: ${amt}`, { x: MARGIN_L, y: cursor.y, size: 11, font: fonts.bold, color: MONEY_RED });
    cursor.y -= 16;
    if (instructions.paymentNote) {
      const words = instructions.paymentNote.split(' ');
      let line = '';
      const maxW = CONTENT_W - 4;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (fonts.regular.widthOfTextAtSize(test, 8) > maxW) {
          page = ensureSpace(cursor, 12, doc);
          page.drawText(line, { x: MARGIN_L, y: cursor.y, size: 8, font: fonts.regular, color: DARK_GRAY });
          cursor.y -= 12;
          line = word;
        } else { line = test; }
      }
      if (line) {
        page = ensureSpace(cursor, 12, doc);
        page.drawText(line, { x: MARGIN_L, y: cursor.y, size: 8, font: fonts.regular, color: DARK_GRAY });
        cursor.y -= 12;
      }
    }
    cursor.y -= 6;
  }

  // Refund
  if (instructions.refundAmount > 0) {
    page = ensureSpace(cursor, 50, doc);
    drawCoverSectionHeader(page, fonts, cursor, 'Your Refund');
    const amt = instructions.refundAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    page.drawText(`Estimated Refund: ${amt}`, { x: MARGIN_L, y: cursor.y, size: 11, font: fonts.bold, color: MONEY_GREEN });
    cursor.y -= 16;
    page.drawText('Paper-filed returns typically take 6\u20138 weeks to process. Check status at irs.gov/refunds about 4 weeks after mailing.', { x: MARGIN_L, y: cursor.y, size: 8, font: fonts.regular, color: DARK_GRAY });
    cursor.y -= 18;
  }

  // State Filing
  if (instructions.hasStateReturn && instructions.stateNames.length > 0) {
    page = ensureSpace(cursor, 40, doc);
    drawCoverSectionHeader(page, fonts, cursor, 'State Filing');
    const stateText = instructions.stateNames.length === 1
      ? `You also need to file a ${instructions.stateNames[0]} state return separately.`
      : `You also need to file state returns for ${instructions.stateNames.join(' and ')} separately.`;
    page.drawText(stateText, { x: MARGIN_L, y: cursor.y, size: 8, font: fonts.regular, color: DARK_GRAY });
    cursor.y -= 12;
    page.drawText('State returns are mailed to your state\u2019s department of revenue \u2014 not to the IRS addresses above.', { x: MARGIN_L, y: cursor.y, size: 8, font: fonts.regular, color: DARK_GRAY });
    cursor.y -= 18;
  }

  // Footer on every page
  for (const p of doc.getPages()) {
    p.drawLine({ start: { x: MARGIN_L, y: MARGIN_B - 10 }, end: { x: PAGE_W - MARGIN_R, y: MARGIN_B - 10 }, thickness: 0.5, color: LINE_COLOR });
    p.drawText('This cover page is for your reference only \u2014 do not mail it to the IRS.', { x: MARGIN_L, y: MARGIN_B - 24, size: 7, font: fonts.italic, color: LIGHT_GRAY });
  }

  return doc.save();
}

// ── Base return builder (same as validate-irs-forms.ts) ──

function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-packet',
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
  } as TaxReturn;
}

// Scenario 1: W-2 employee with refund (TX — Austin mailing)
const scenario1 = baseTaxReturn({
  firstName: 'John',
  lastName: 'Smith',
  ssnLastFour: '6789',
  filingStatus: FilingStatus.Single,
  addressStreet: '123 Main St',
  addressCity: 'Austin',
  addressState: 'TX',
  addressZip: '73301',
  w2Income: [{
    employerName: 'Acme Corp',
    wages: 75000,
    federalTaxWithheld: 12000,
    socialSecurityWages: 75000,
    socialSecurityTax: 4650,
    medicareWages: 75000,
    medicareTax: 1087.50,
  }],
});

// Scenario 2: Freelancer with Schedule C + SE (NY — Kansas City mailing, owes)
const scenario2 = baseTaxReturn({
  firstName: 'Jane',
  lastName: 'Doe',
  ssnLastFour: '4321',
  filingStatus: FilingStatus.Single,
  addressStreet: '456 Broadway',
  addressCity: 'New York',
  addressState: 'NY',
  addressZip: '10001',
  income1099NEC: [{
    payerName: 'Client Inc',
    amount: 120000,
  }],
  businesses: [{
    name: 'Jane Doe Consulting',
    businessCode: '541990',
    accountingMethod: 'cash' as const,
    officeExpenses: 3000,
    suppliesExpenses: 1500,
    advertisingExpenses: 2000,
    internetExpenses: 1200,
  }],
  stateReturns: [{ stateCode: 'NY' }],
});

// Scenario 3: MFJ with spouse (CA — Ogden mailing, refund)
const scenario3 = baseTaxReturn({
  firstName: 'Bob',
  lastName: 'Johnson',
  spouseFirstName: 'Alice',
  spouseLastName: 'Johnson',
  ssnLastFour: '3333',
  spouseSsnLastFour: '6666',
  filingStatus: FilingStatus.MarriedFilingJointly,
  addressStreet: '789 Oak Ave',
  addressCity: 'San Francisco',
  addressState: 'CA',
  addressZip: '94102',
  w2Income: [
    {
      employerName: 'Tech Corp',
      wages: 95000,
      federalTaxWithheld: 18000,
      socialSecurityWages: 95000,
      socialSecurityTax: 5890,
      medicareWages: 95000,
      medicareTax: 1377.50,
    },
    {
      employerName: 'Design Co',
      wages: 65000,
      federalTaxWithheld: 10000,
      socialSecurityWages: 65000,
      socialSecurityTax: 4030,
      medicareWages: 65000,
      medicareTax: 942.50,
    },
  ],
  income1099R: [{
    payerName: 'Old 401k Plan',
    grossDistribution: 5000,
    taxableAmount: 5000,
    federalTaxWithheld: 500,
    distributionCode: '1',
    isIRA: false,
  }],
  stateReturns: [{ stateCode: 'CA' }],
});

async function runScenario(name: string, taxReturn: TaxReturn) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Scenario: ${name}`);
  console.log('='.repeat(70));

  const calc = calculateForm1040({
    ...taxReturn,
    filingStatus: taxReturn.filingStatus || FilingStatus.Single,
  });

  console.log(`  Refund:     $${calc.form1040.refundAmount || 0}`);
  console.log(`  Owed:       $${calc.form1040.amountOwed || 0}`);

  const instructions = getFilingInstructions(taxReturn, calc);
  console.log(`  Deadline:   ${instructions.deadline}`);
  console.log(`  Forms:      ${instructions.formsIncluded.map(f => f.formId).join(', ')}`);
  console.log(`  Mail to:    ${instructions.mailingAddress.join(' / ')}`);
  console.log(`  Attachments: ${instructions.attachments.length > 0 ? instructions.attachments.join('; ') : '(none)'}`);
  console.log(`  Signature:  ${instructions.signatureLines.substring(0, 60)}...`);
  if (instructions.hasStateReturn) console.log(`  State:      ${instructions.stateNames.join(', ')}`);

  // Generate cover page
  const coverBytes = await generateCoverPagePDF(taxReturn, calc, instructions);
  const coverDoc = await PDFDocument.load(coverBytes);
  console.log(`  Cover page: ${coverDoc.getPageCount()} page(s), ${coverBytes.length} bytes`);

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const outPath = join(OUTPUT_DIR, `cover-${slug}.pdf`);
  writeFileSync(outPath, coverBytes);
  console.log(`  Saved:      ${outPath}`);
}

async function main() {
  console.log('Filing Packet Cover Page Test');
  console.log('='.repeat(70));

  await runScenario('W2 Employee Refund TX', scenario1);
  await runScenario('Freelancer Owes NY', scenario2);
  await runScenario('MFJ Refund CA', scenario3);

  console.log('\n' + '='.repeat(70));
  console.log('All scenarios completed. Check scripts/output/ for cover PDFs.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
