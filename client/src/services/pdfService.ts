import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, RGB } from 'pdf-lib';
import {
  TaxReturn, CalculationResult, FilingStatus,
  STANDARD_DEDUCTION_2025, getDisplaySSN,
} from '@telostax/engine';
import type { StateCalculationResult } from '@telostax/engine';
import { generateStateFormPDF } from './stateFormFiller';

// ─── Colors ─────────────────────────────────────────
const BLACK = rgb(0, 0, 0);
const DARK_GRAY = rgb(0.3, 0.3, 0.3);
const LIGHT_GRAY = rgb(0.6, 0.6, 0.6);
const LINE_COLOR = rgb(0.85, 0.85, 0.85);
const HEADER_BG = rgb(0.95, 0.95, 0.97);
const ACCENT = rgb(0.1, 0.3, 0.65);
const MONEY_GREEN = rgb(0.0, 0.5, 0.2);
const MONEY_RED = rgb(0.7, 0.1, 0.1);

// ─── Layout constants ───────────────────────────────
const PAGE_W = 612;  // Letter width
const PAGE_H = 792;  // Letter height
const MARGIN_L = 50;
const MARGIN_R = 50;
const MARGIN_T = 50;
const MARGIN_B = 60;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const COL_RIGHT = PAGE_W - MARGIN_R;

// ─── Types ──────────────────────────────────────────
interface Cursor {
  y: number;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

// ─── Helpers ────────────────────────────────────────
function fmt(n: number): string {
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${str})` : str;
}

function fmtDollar(n: number): string {
  return `$${fmt(n)}`;
}

function filingStatusLabel(fs: FilingStatus): string {
  switch (fs) {
    case FilingStatus.Single: return 'Single';
    case FilingStatus.MarriedFilingJointly: return 'Married Filing Jointly';
    case FilingStatus.MarriedFilingSeparately: return 'Married Filing Separately';
    case FilingStatus.HeadOfHousehold: return 'Head of Household';
    case FilingStatus.QualifyingSurvivingSpouse: return 'Qualifying Surviving Spouse';
    default: return 'Single';
  }
}

function ensureSpace(cursor: Cursor, needed: number, doc: PDFDocument, fonts: Fonts): PDFPage {
  if (cursor.y - needed < MARGIN_B) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    cursor.y = PAGE_H - MARGIN_T;
    return page;
  }
  return doc.getPages()[doc.getPageCount() - 1];
}

// ─── Drawing primitives ─────────────────────────────

function drawSectionHeader(page: PDFPage, fonts: Fonts, cursor: Cursor, title: string) {
  cursor.y -= 8;
  page.drawRectangle({
    x: MARGIN_L - 5,
    y: cursor.y - 4,
    width: CONTENT_W + 10,
    height: 20,
    color: HEADER_BG,
  });
  page.drawText(title.toUpperCase(), {
    x: MARGIN_L,
    y: cursor.y,
    size: 9,
    font: fonts.bold,
    color: ACCENT,
  });
  cursor.y -= 22;
}

function drawLine(page: PDFPage, cursor: Cursor) {
  page.drawLine({
    start: { x: MARGIN_L, y: cursor.y },
    end: { x: COL_RIGHT, y: cursor.y },
    thickness: 0.5,
    color: LINE_COLOR,
  });
}

function drawRow(
  page: PDFPage,
  fonts: Fonts,
  cursor: Cursor,
  label: string,
  value: string,
  options?: { bold?: boolean; indent?: number; lineNum?: string; color?: RGB },
) {
  const x = MARGIN_L + (options?.indent || 0);
  const font = options?.bold ? fonts.bold : fonts.regular;
  const color = options?.color || BLACK;

  if (options?.lineNum) {
    page.drawText(options.lineNum, {
      x: MARGIN_L,
      y: cursor.y,
      size: 7,
      font: fonts.regular,
      color: LIGHT_GRAY,
    });
  }

  page.drawText(label, {
    x: options?.lineNum ? x + 20 : x,
    y: cursor.y,
    size: 9,
    font,
    color,
  });

  const valWidth = font.widthOfTextAtSize(value, 9);
  page.drawText(value, {
    x: COL_RIGHT - valWidth,
    y: cursor.y,
    size: 9,
    font,
    color,
  });

  cursor.y -= 15;
}

function drawSubtotalRow(
  page: PDFPage,
  fonts: Fonts,
  cursor: Cursor,
  label: string,
  value: string,
  color?: RGB,
) {
  drawLine(page, cursor);
  cursor.y -= 5;
  drawRow(page, fonts, cursor, label, value, { bold: true, color });
  cursor.y -= 3;
}

// ─── Main PDF generators ────────────────────────────

export async function generateForm1040PDF(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fonts: Fonts = { regular, bold, italic };

  let page = doc.addPage([PAGE_W, PAGE_H]);
  const cursor: Cursor = { y: PAGE_H - MARGIN_T };
  const f = calc.form1040;
  const fs = taxReturn.filingStatus || FilingStatus.Single;

  // ─── Title ──────────────────────────
  page.drawText('Form 1040 -U.S. Individual Income Tax Return', {
    x: MARGIN_L,
    y: cursor.y,
    size: 14,
    font: bold,
    color: ACCENT,
  });
  cursor.y -= 18;

  page.drawText(`Tax Year ${taxReturn.taxYear}  |Prepared by TelosTax`, {
    x: MARGIN_L,
    y: cursor.y,
    size: 8,
    font: italic,
    color: LIGHT_GRAY,
  });
  cursor.y -= 6;
  drawLine(page, cursor);
  cursor.y -= 12;

  // ─── Taxpayer Info ──────────────────
  drawSectionHeader(page, fonts, cursor, 'Taxpayer Information');

  const fullName = [taxReturn.firstName, taxReturn.middleInitial, taxReturn.lastName]
    .filter(Boolean)
    .join(' ');
  drawRow(page, fonts, cursor, 'Name', fullName || '-');
  drawRow(page, fonts, cursor, 'SSN', getDisplaySSN(taxReturn.ssn, taxReturn.ssnLastFour));

  const address = [taxReturn.addressStreet, taxReturn.addressCity, taxReturn.addressState, taxReturn.addressZip]
    .filter(Boolean)
    .join(', ');
  drawRow(page, fonts, cursor, 'Address', address || '-');
  drawRow(page, fonts, cursor, 'Filing Status', filingStatusLabel(fs));
  drawRow(page, fonts, cursor, 'Occupation', taxReturn.occupation || '-');

  if (fs === FilingStatus.MarriedFilingJointly && taxReturn.spouseFirstName) {
    drawRow(page, fonts, cursor, 'Spouse', `${taxReturn.spouseFirstName} ${taxReturn.spouseLastName || ''}`);
  }

  if (taxReturn.dependents.length > 0) {
    drawRow(page, fonts, cursor, 'Dependents', `${taxReturn.dependents.length}`);
    for (const d of taxReturn.dependents) {
      drawRow(page, fonts, cursor, `  ${d.firstName} ${d.lastName}`, d.relationship, { indent: 15 });
    }
  }

  // ─── Income ─────────────────────────
  page = ensureSpace(cursor, 120, doc, fonts);
  drawSectionHeader(page, fonts, cursor, 'Income');

  if (f.totalWages > 0) {
    drawRow(page, fonts, cursor, 'Wages, salaries, tips (W-2)', fmtDollar(f.totalWages), { lineNum: '1' });
  }
  if (f.totalInterest > 0) {
    drawRow(page, fonts, cursor, 'Interest income', fmtDollar(f.totalInterest), { lineNum: '2b' });
  }
  if (f.totalDividends > 0) {
    drawRow(page, fonts, cursor, 'Ordinary dividends', fmtDollar(f.totalDividends), { lineNum: '3b' });
  }
  if (f.scheduleDNetGain !== 0) {
    const capLabel = f.scheduleDNetGain > 0 ? 'Capital gain (Schedule D)' : 'Capital loss (Schedule D)';
    drawRow(page, fonts, cursor, capLabel, fmtDollar(f.scheduleDNetGain), { lineNum: '7' });
  }
  if (f.scheduleCNetProfit !== 0) {
    drawRow(page, fonts, cursor, 'Business income (Schedule C)', fmtDollar(f.scheduleCNetProfit), { lineNum: '8' });
  }

  drawSubtotalRow(page, fonts, cursor, 'Total income', fmtDollar(f.totalIncome));

  // ─── Adjustments ────────────────────
  if (f.totalAdjustments > 0) {
    page = ensureSpace(cursor, 80, doc, fonts);
    drawSectionHeader(page, fonts, cursor, 'Adjustments to Income');

    if (f.seDeduction > 0) {
      drawRow(page, fonts, cursor, 'Deductible self-employment tax', fmtDollar(f.seDeduction), { lineNum: '15' });
    }
    if (f.selfEmployedHealthInsurance > 0) {
      drawRow(page, fonts, cursor, 'Self-employed health insurance', fmtDollar(f.selfEmployedHealthInsurance), { lineNum: '17' });
    }
    if (f.retirementContributions > 0) {
      drawRow(page, fonts, cursor, 'Retirement contributions (SEP, Solo 401k)', fmtDollar(f.retirementContributions));
    }
    drawSubtotalRow(page, fonts, cursor, 'Total adjustments', fmtDollar(f.totalAdjustments));
  }

  // ─── AGI & Deductions ───────────────
  page = ensureSpace(cursor, 100, doc, fonts);
  drawSectionHeader(page, fonts, cursor, 'Adjusted Gross Income & Deductions');

  drawRow(page, fonts, cursor, 'Adjusted gross income (AGI)', fmtDollar(f.agi), { lineNum: '11', bold: true });

  if (f.deductionUsed === 'standard') {
    drawRow(page, fonts, cursor, 'Standard deduction', fmtDollar(f.deductionAmount), { lineNum: '12' });
  } else {
    drawRow(page, fonts, cursor, 'Itemized deductions (Schedule A)', fmtDollar(f.deductionAmount), { lineNum: '12' });
  }

  if (f.qbiDeduction > 0) {
    drawRow(page, fonts, cursor, 'Qualified business income deduction', fmtDollar(f.qbiDeduction), { lineNum: '13' });
  }

  drawSubtotalRow(page, fonts, cursor, 'Taxable income', fmtDollar(f.taxableIncome));

  // ─── Tax Computation ────────────────
  page = ensureSpace(cursor, 100, doc, fonts);
  drawSectionHeader(page, fonts, cursor, 'Tax Computation');

  drawRow(page, fonts, cursor, 'Income tax', fmtDollar(f.incomeTax), { lineNum: '16' });

  if (f.seTax > 0) {
    drawRow(page, fonts, cursor, 'Self-employment tax (Schedule SE)', fmtDollar(f.seTax));
  }

  if (f.totalCredits > 0) {
    drawRow(page, fonts, cursor, 'Total credits', `(${fmtDollar(f.totalCredits)})`, { color: MONEY_GREEN });
  }

  drawSubtotalRow(page, fonts, cursor, 'Total tax', fmtDollar(f.taxAfterCredits));

  // ─── Payments & Refund/Owed ─────────
  page = ensureSpace(cursor, 100, doc, fonts);
  drawSectionHeader(page, fonts, cursor, 'Payments');

  if (f.totalWithholding > 0) {
    drawRow(page, fonts, cursor, 'Federal tax withheld', fmtDollar(f.totalWithholding), { lineNum: '25' });
  }

  drawSubtotalRow(page, fonts, cursor, 'Total payments', fmtDollar(f.totalPayments));

  cursor.y -= 8;
  page.drawLine({
    start: { x: MARGIN_L, y: cursor.y + 2 },
    end: { x: COL_RIGHT, y: cursor.y + 2 },
    thickness: 2,
    color: ACCENT,
  });
  cursor.y -= 10;

  if (f.refundAmount > 0) {
    drawRow(page, fonts, cursor, 'REFUND', fmtDollar(f.refundAmount), { bold: true, color: MONEY_GREEN });
  } else if (f.amountOwed > 0) {
    drawRow(page, fonts, cursor, 'AMOUNT OWED', fmtDollar(f.amountOwed), { bold: true, color: MONEY_RED });
  } else {
    drawRow(page, fonts, cursor, 'BALANCE', '$0.00', { bold: true });
  }

  // ─── Summary stats ──────────────────
  page = ensureSpace(cursor, 60, doc, fonts);
  cursor.y -= 10;
  drawSectionHeader(page, fonts, cursor, 'Summary');
  drawRow(page, fonts, cursor, 'Effective tax rate', `${(f.effectiveTaxRate * 100).toFixed(1)}%`);
  drawRow(page, fonts, cursor, 'Marginal tax rate', `${(f.marginalTaxRate * 100).toFixed(0)}%`);

  if (f.estimatedQuarterlyPayment > 0) {
    drawRow(page, fonts, cursor, 'Estimated quarterly payment', fmtDollar(f.estimatedQuarterlyPayment));
  }

  // ─── Disclaimer ─────────────────────
  page = ensureSpace(cursor, 50, doc, fonts);
  cursor.y -= 20;
  drawLine(page, cursor);
  cursor.y -= 12;
  page.drawText(
    'This document is for informational purposes only and does not constitute an official IRS filing.',
    { x: MARGIN_L, y: cursor.y, size: 7, font: italic, color: LIGHT_GRAY },
  );
  cursor.y -= 10;
  page.drawText(
    'Consult a qualified tax professional before filing. Generated by TelosTax.',
    { x: MARGIN_L, y: cursor.y, size: 7, font: italic, color: LIGHT_GRAY },
  );

  return doc.save();
}

export async function generateScheduleCPDF(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): Promise<Uint8Array> {
  if (!calc.scheduleC) {
    throw new Error('No Schedule C data available');
  }

  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fonts: Fonts = { regular, bold, italic };

  let page = doc.addPage([PAGE_W, PAGE_H]);
  const cursor: Cursor = { y: PAGE_H - MARGIN_T };
  const sc = calc.scheduleC;

  // ─── Title ──────────────────────────
  page.drawText('Schedule C -Profit or Loss from Business', {
    x: MARGIN_L,
    y: cursor.y,
    size: 14,
    font: bold,
    color: ACCENT,
  });
  cursor.y -= 18;

  page.drawText(`Tax Year ${taxReturn.taxYear}  |Sole Proprietorship`, {
    x: MARGIN_L,
    y: cursor.y,
    size: 8,
    font: italic,
    color: LIGHT_GRAY,
  });
  cursor.y -= 6;
  drawLine(page, cursor);
  cursor.y -= 12;

  // ─── Business Info ──────────────────
  drawSectionHeader(page, fonts, cursor, 'Business Information');

  const biz = taxReturn.business;
  drawRow(page, fonts, cursor, 'Business name', biz?.businessName || '-');
  drawRow(page, fonts, cursor, 'Principal business code', biz?.principalBusinessCode || '-');
  drawRow(page, fonts, cursor, 'Business description', biz?.businessDescription || '-');
  drawRow(page, fonts, cursor, 'Accounting method', biz?.accountingMethod || 'Cash');

  // ─── Income ─────────────────────────
  drawSectionHeader(page, fonts, cursor, 'Part I -Income');

  drawRow(page, fonts, cursor, 'Gross receipts', fmtDollar(sc.grossReceipts), { lineNum: '1' });
  if (sc.returnsAndAllowances > 0) {
    drawRow(page, fonts, cursor, 'Returns and allowances', fmtDollar(sc.returnsAndAllowances), { lineNum: '2' });
  }
  if (sc.costOfGoodsSold > 0) {
    drawRow(page, fonts, cursor, 'Cost of goods sold', fmtDollar(sc.costOfGoodsSold), { lineNum: '4' });
  }
  drawSubtotalRow(page, fonts, cursor, 'Gross income', fmtDollar(sc.grossIncome));

  // ─── Expenses ───────────────────────
  page = ensureSpace(cursor, 200, doc, fonts);
  drawSectionHeader(page, fonts, cursor, 'Part II -Expenses');

  const LINE_LABELS: Record<string, string> = {
    '8': 'Advertising',
    '9': 'Car and truck expenses',
    '10': 'Commissions and fees',
    '11': 'Contract labor',
    '12': 'Depletion',
    '13': 'Depreciation / Section 179',
    '14': 'Employee benefit programs',
    '15': 'Insurance (non-health)',
    '16': 'Interest (mortgage)',
    '17': 'Interest (other)',
    '18': 'Legal and professional services',
    '19': 'Office expense',
    '20': 'Pension / profit-sharing plans',
    '21': 'Rent (vehicles, machinery)',
    '22': 'Rent (other business property)',
    '23': 'Repairs and maintenance',
    '24': 'Supplies',
    '24a': 'Travel',
    '24b': 'Meals (50%)',
    '25': 'Taxes and licenses',
    '26': 'Wages',
    '27': 'Other expenses',
  };

  for (const [line, amount] of Object.entries(sc.lineItems).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) {
    const label = LINE_LABELS[line] || `Line ${line}`;
    page = ensureSpace(cursor, 18, doc, fonts);
    drawRow(page, fonts, cursor, label, fmtDollar(amount), { lineNum: line });
  }

  drawSubtotalRow(page, fonts, cursor, 'Total expenses', fmtDollar(sc.totalExpenses));

  // ─── Profit ─────────────────────────
  page = ensureSpace(cursor, 80, doc, fonts);
  drawSectionHeader(page, fonts, cursor, 'Net Profit');

  drawRow(page, fonts, cursor, 'Tentative profit', fmtDollar(sc.tentativeProfit), { lineNum: '29' });

  if (sc.homeOfficeDeduction > 0) {
    drawRow(page, fonts, cursor, 'Home office deduction', fmtDollar(sc.homeOfficeDeduction), { lineNum: '30' });
  }

  cursor.y -= 3;
  page.drawLine({
    start: { x: MARGIN_L, y: cursor.y + 2 },
    end: { x: COL_RIGHT, y: cursor.y + 2 },
    thickness: 2,
    color: ACCENT,
  });
  cursor.y -= 10;

  const profitColor = sc.netProfit >= 0 ? BLACK : MONEY_RED;
  drawRow(page, fonts, cursor, 'NET PROFIT (LOSS)', fmtDollar(sc.netProfit), {
    bold: true,
    lineNum: '31',
    color: profitColor,
  });

  // ─── Disclaimer ─────────────────────
  page = ensureSpace(cursor, 50, doc, fonts);
  cursor.y -= 30;
  drawLine(page, cursor);
  cursor.y -= 12;
  page.drawText(
    'This document is for informational purposes only. Consult a qualified tax professional.',
    { x: MARGIN_L, y: cursor.y, size: 7, font: italic, color: LIGHT_GRAY },
  );

  return doc.save();
}

export async function generateScheduleSEPDF(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): Promise<Uint8Array> {
  if (!calc.scheduleSE) {
    throw new Error('No Schedule SE data available');
  }

  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fonts: Fonts = { regular, bold, italic };

  const page = doc.addPage([PAGE_W, PAGE_H]);
  const cursor: Cursor = { y: PAGE_H - MARGIN_T };
  const se = calc.scheduleSE;

  // ─── Title ──────────────────────────
  page.drawText('Schedule SE -Self-Employment Tax', {
    x: MARGIN_L,
    y: cursor.y,
    size: 14,
    font: bold,
    color: ACCENT,
  });
  cursor.y -= 18;

  page.drawText(`Tax Year ${taxReturn.taxYear}`, {
    x: MARGIN_L,
    y: cursor.y,
    size: 8,
    font: italic,
    color: LIGHT_GRAY,
  });
  cursor.y -= 6;
  drawLine(page, cursor);
  cursor.y -= 12;

  // ─── Taxpayer ───────────────────────
  drawSectionHeader(page, fonts, cursor, 'Taxpayer');
  const fullName = [taxReturn.firstName, taxReturn.middleInitial, taxReturn.lastName]
    .filter(Boolean)
    .join(' ');
  drawRow(page, fonts, cursor, 'Name', fullName || '-');
  drawRow(page, fonts, cursor, 'SSN', getDisplaySSN(taxReturn.ssn, taxReturn.ssnLastFour));

  // ─── Computation ────────────────────
  drawSectionHeader(page, fonts, cursor, 'Part I -Self-Employment Tax');

  drawRow(page, fonts, cursor, 'Net earnings from self-employment', fmtDollar(se.netEarnings), { lineNum: '4' });

  cursor.y -= 5;
  drawRow(page, fonts, cursor, 'Social Security tax', fmtDollar(se.socialSecurityTax), { lineNum: '10' });
  drawRow(page, fonts, cursor, 'Medicare tax', fmtDollar(se.medicareTax), { lineNum: '11' });

  if (se.additionalMedicareTax > 0) {
    drawRow(page, fonts, cursor, 'Additional Medicare tax (0.9%)', fmtDollar(se.additionalMedicareTax), { lineNum: '12' });
  }

  cursor.y -= 3;
  page.drawLine({
    start: { x: MARGIN_L, y: cursor.y + 2 },
    end: { x: COL_RIGHT, y: cursor.y + 2 },
    thickness: 2,
    color: ACCENT,
  });
  cursor.y -= 10;
  drawRow(page, fonts, cursor, 'TOTAL SELF-EMPLOYMENT TAX', fmtDollar(se.totalSETax), { bold: true, lineNum: '13' });

  cursor.y -= 15;
  drawRow(page, fonts, cursor, 'Deductible half of SE tax', fmtDollar(se.deductibleHalf), {
    lineNum: '14',
    color: MONEY_GREEN,
  });

  page.drawText(
    'This amount transfers to Form 1040, Schedule 1, line 15',
    { x: MARGIN_L + 25, y: cursor.y + 4, size: 7, font: italic, color: LIGHT_GRAY },
  );
  cursor.y -= 20;

  // ─── Disclaimer ─────────────────────
  cursor.y -= 20;
  drawLine(page, cursor);
  cursor.y -= 12;
  page.drawText(
    'This document is for informational purposes only. Consult a qualified tax professional.',
    { x: MARGIN_L, y: cursor.y, size: 7, font: italic, color: LIGHT_GRAY },
  );

  return doc.save();
}

/**
 * Generate a combined PDF with all applicable forms.
 */
export async function generateScheduleDPDF(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fonts: Fonts = { regular, bold, italic };

  let page = doc.addPage([PAGE_W, PAGE_H]);
  const cursor: Cursor = { y: PAGE_H - MARGIN_T };
  if (!calc.scheduleD) return doc.save();
  const sd = calc.scheduleD;

  // ─── Title ──────────────────────────
  page.drawText('Schedule D — Capital Gains and Losses', {
    x: MARGIN_L, y: cursor.y, size: 14, font: bold, color: ACCENT,
  });
  cursor.y -= 18;
  page.drawText(`Tax Year ${taxReturn.taxYear}  |  Prepared by TelosTax`, {
    x: MARGIN_L, y: cursor.y, size: 8, font: italic, color: LIGHT_GRAY,
  });
  cursor.y -= 6;
  drawLine(page, cursor);
  cursor.y -= 12;

  // ─── Part I: Short-Term ──────────────
  drawSectionHeader(page, fonts, cursor, 'Part I — Short-Term Capital Gains and Losses');

  // List individual short-term transactions
  const allTransactions = [
    ...(taxReturn.income1099B || []).map(t => ({ ...t, source: '1099-B' })),
    ...(taxReturn.income1099DA || []).map(da => ({
      brokerName: da.brokerName,
      description: `${da.tokenName}${da.tokenSymbol ? ` (${da.tokenSymbol})` : ''}${da.description ? ' — ' + da.description : ''}`,
      proceeds: da.proceeds,
      costBasis: da.costBasis,
      isLongTerm: da.isLongTerm,
      source: '1099-DA',
    })),
  ];

  const stTransactions = allTransactions.filter(t => !t.isLongTerm);
  const ltTransactions = allTransactions.filter(t => t.isLongTerm);

  for (const t of stTransactions) {
    page = ensureSpace(cursor, 30, doc, fonts);
    const gl = t.proceeds - t.costBasis;
    const color = gl >= 0 ? MONEY_GREEN : MONEY_RED;
    drawRow(page, fonts, cursor, `${t.brokerName} — ${t.description || 'Sale'}`, fmtDollar(gl), { color });
    drawRow(page, fonts, cursor, `  Proceeds: ${fmtDollar(t.proceeds)}  |  Basis: ${fmtDollar(t.costBasis)}  |  ${t.source}`, '', { color: LIGHT_GRAY });
  }
  if (stTransactions.length === 0) {
    drawRow(page, fonts, cursor, 'No short-term transactions', '', { color: LIGHT_GRAY });
  }

  page = ensureSpace(cursor, 30, doc, fonts);
  cursor.y -= 4;
  drawSubtotalRow(page, fonts, cursor, 'Net short-term gain/loss', fmtDollar(sd.netShortTerm));

  // ─── Part II: Long-Term ──────────────
  page = ensureSpace(cursor, 60, doc, fonts);
  drawSectionHeader(page, fonts, cursor, 'Part II — Long-Term Capital Gains and Losses');

  for (const t of ltTransactions) {
    page = ensureSpace(cursor, 30, doc, fonts);
    const gl = t.proceeds - t.costBasis;
    const color = gl >= 0 ? MONEY_GREEN : MONEY_RED;
    drawRow(page, fonts, cursor, `${t.brokerName} — ${t.description || 'Sale'}`, fmtDollar(gl), { color });
    drawRow(page, fonts, cursor, `  Proceeds: ${fmtDollar(t.proceeds)}  |  Basis: ${fmtDollar(t.costBasis)}  |  ${t.source}`, '', { color: LIGHT_GRAY });
  }
  if (ltTransactions.length === 0) {
    drawRow(page, fonts, cursor, 'No long-term transactions', '', { color: LIGHT_GRAY });
  }

  page = ensureSpace(cursor, 30, doc, fonts);
  cursor.y -= 4;
  drawSubtotalRow(page, fonts, cursor, 'Net long-term gain/loss', fmtDollar(sd.netLongTerm));

  // ─── Part III: Summary ───────────────
  page = ensureSpace(cursor, 100, doc, fonts);
  drawSectionHeader(page, fonts, cursor, 'Part III — Summary');

  drawRow(page, fonts, cursor, 'Net short-term gain/loss', fmtDollar(sd.netShortTerm));
  drawRow(page, fonts, cursor, 'Net long-term gain/loss', fmtDollar(sd.netLongTerm));
  drawRow(page, fonts, cursor, 'Total net gain/loss', fmtDollar(sd.netGainOrLoss), { bold: true });

  if (sd.capitalLossDeduction > 0) {
    drawRow(page, fonts, cursor, 'Capital loss deduction (max $3,000)', fmtDollar(sd.capitalLossDeduction));
  }
  if (sd.capitalLossCarryforward > 0) {
    drawRow(page, fonts, cursor, 'Capital loss carryforward to next year', fmtDollar(sd.capitalLossCarryforward));
    drawRow(page, fonts, cursor, `  Short-term: ${fmtDollar(sd.capitalLossCarryforwardST)}  |  Long-term: ${fmtDollar(sd.capitalLossCarryforwardLT)}`, '', { color: LIGHT_GRAY });
  }

  // ─── Disclaimer ──────────────────────
  page = ensureSpace(cursor, 50, doc, fonts);
  cursor.y -= 20;
  drawLine(page, cursor);
  cursor.y -= 12;
  page.drawText(
    'This document is for informational purposes only. Generated by TelosTax.',
    { x: MARGIN_L, y: cursor.y, size: 7, font: italic, color: LIGHT_GRAY },
  );

  return doc.save();
}

export async function generateStateTaxSummaryPDF(
  sr: StateCalculationResult,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fonts: Fonts = { regular, bold, italic };

  const page = doc.addPage([PAGE_W, PAGE_H]);
  const cursor: Cursor = { y: PAGE_H - MARGIN_T };

  // ─── Title ──────────────────────────
  page.drawText(`State Tax Summary — ${sr.stateName}`, {
    x: MARGIN_L,
    y: cursor.y,
    size: 14,
    font: bold,
    color: ACCENT,
  });
  cursor.y -= 18;

  const residencyLabel = sr.residencyType === 'resident' ? 'Full-year resident'
    : sr.residencyType === 'part_year' ? 'Part-year resident' : 'Nonresident';
  page.drawText(`${sr.stateCode}  |  ${residencyLabel}  |  Prepared by TelosTax`, {
    x: MARGIN_L,
    y: cursor.y,
    size: 8,
    font: italic,
    color: LIGHT_GRAY,
  });
  cursor.y -= 6;
  drawLine(page, cursor);
  cursor.y -= 12;

  // ─── Income Computation ──────────────
  drawSectionHeader(page, fonts, cursor, 'Income Computation');

  drawRow(page, fonts, cursor, 'Federal AGI', fmtDollar(sr.federalAGI));
  if (sr.stateAdditions > 0) {
    drawRow(page, fonts, cursor, 'State additions', `+${fmtDollar(sr.stateAdditions)}`);
  }
  if (sr.stateSubtractions > 0) {
    drawRow(page, fonts, cursor, 'State subtractions', `(${fmtDollar(sr.stateSubtractions)})`);
  }
  drawSubtotalRow(page, fonts, cursor, 'State AGI', fmtDollar(sr.stateAGI));

  if (sr.stateDeduction > 0) {
    drawRow(page, fonts, cursor, 'Deduction', `(${fmtDollar(sr.stateDeduction)})`);
  }
  if (sr.stateExemptions > 0) {
    drawRow(page, fonts, cursor, 'Exemptions', `(${fmtDollar(sr.stateExemptions)})`);
  }
  drawSubtotalRow(page, fonts, cursor, 'State taxable income', fmtDollar(sr.stateTaxableIncome));

  // ─── Tax Computation ─────────────────
  drawSectionHeader(page, fonts, cursor, 'Tax Computation');

  drawRow(page, fonts, cursor, 'State income tax', fmtDollar(sr.stateIncomeTax));
  if (sr.stateCredits > 0) {
    drawRow(page, fonts, cursor, 'State credits', `(${fmtDollar(sr.stateCredits)})`, { color: MONEY_GREEN });
  }
  if (sr.localTax > 0) {
    drawRow(page, fonts, cursor, 'Local tax', fmtDollar(sr.localTax));
  }
  drawSubtotalRow(page, fonts, cursor, 'Total state tax', fmtDollar(sr.totalStateTax));

  // ─── Payments ────────────────────────
  drawSectionHeader(page, fonts, cursor, 'Payments');

  if (sr.stateWithholding > 0) {
    drawRow(page, fonts, cursor, 'State withholding', fmtDollar(sr.stateWithholding));
  }
  if (sr.stateEstimatedPayments > 0) {
    drawRow(page, fonts, cursor, 'Estimated payments', fmtDollar(sr.stateEstimatedPayments));
  }

  // ─── Refund / Owed ───────────────────
  cursor.y -= 8;
  page.drawLine({
    start: { x: MARGIN_L, y: cursor.y + 2 },
    end: { x: COL_RIGHT, y: cursor.y + 2 },
    thickness: 2,
    color: ACCENT,
  });
  cursor.y -= 10;

  if (sr.stateRefundOrOwed >= 0) {
    drawRow(page, fonts, cursor, 'STATE REFUND', fmtDollar(sr.stateRefundOrOwed), { bold: true, color: MONEY_GREEN });
  } else {
    drawRow(page, fonts, cursor, 'STATE AMOUNT OWED', fmtDollar(Math.abs(sr.stateRefundOrOwed)), { bold: true, color: MONEY_RED });
  }

  // ─── Summary ─────────────────────────
  cursor.y -= 5;
  drawRow(page, fonts, cursor, 'Effective state rate', `${(sr.effectiveStateRate * 100).toFixed(2)}%`);

  // ─── Bracket Details ─────────────────
  if (sr.bracketDetails && sr.bracketDetails.length > 0) {
    drawSectionHeader(page, fonts, cursor, 'Tax Bracket Details');
    for (const b of sr.bracketDetails) {
      drawRow(page, fonts, cursor, `${(b.rate * 100).toFixed(1)}% bracket`, `${fmtDollar(b.taxableAtRate)} → ${fmtDollar(b.taxAtRate)}`);
    }
  }

  // ─── Disclaimer ──────────────────────
  cursor.y -= 20;
  drawLine(page, cursor);
  cursor.y -= 12;
  page.drawText(
    'This document is for informational purposes only. State returns must be filed separately.',
    { x: MARGIN_L, y: cursor.y, size: 7, font: italic, color: LIGHT_GRAY },
  );

  return doc.save();
}

export async function generateFullReturnPDF(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): Promise<Uint8Array> {
  // Generate each applicable form
  const form1040Bytes = await generateForm1040PDF(taxReturn, calc);

  const parts: Uint8Array[] = [form1040Bytes];

  if (calc.scheduleC) {
    parts.push(await generateScheduleCPDF(taxReturn, calc));
  }
  if (calc.scheduleSE) {
    parts.push(await generateScheduleSEPDF(taxReturn, calc));
  }
  if (calc.scheduleD && (calc.scheduleD.netGainOrLoss !== 0 || (taxReturn.income1099B?.length || 0) > 0 || (taxReturn.income1099DA?.length || 0) > 0)) {
    parts.push(await generateScheduleDPDF(taxReturn, calc));
  }

  // State tax pages — prefer real filled form PDFs, fall back to summary
  if (calc.stateResults?.length) {
    for (const sr of calc.stateResults) {
      const stateFormPDF = await generateStateFormPDF(taxReturn, calc, sr);
      if (stateFormPDF) {
        parts.push(stateFormPDF);
      } else if (sr.totalStateTax > 0 || sr.localTax > 0) {
        parts.push(await generateStateTaxSummaryPDF(sr));
      }
    }
  }

  // Merge all PDFs into one
  if (parts.length === 1) {
    return parts[0];
  }

  const merged = await PDFDocument.create();
  for (const pdfBytes of parts) {
    const src = await PDFDocument.load(pdfBytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const p of pages) {
      merged.addPage(p);
    }
  }

  return merged.save();
}
