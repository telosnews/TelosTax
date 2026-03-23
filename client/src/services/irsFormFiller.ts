/**
 * IRS Form Filler Service
 *
 * Loads official IRS fillable PDF templates, fills their AcroForm fields
 * with calculated tax return data, and merges into a single PDF.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFPage, PDFFont } from 'pdf-lib';
import type { TaxReturn, CalculationResult } from '@telostax/engine';
import type { IRSFieldMapping, IRSFormTemplate } from '@telostax/engine';
import { generateStateFormPDF } from './stateFormFiller';
import { generateStateTaxSummaryPDF } from './pdfService';
import { getFilingInstructions } from '@telostax/engine';
import type { FilingInstructions } from '@telostax/engine';
import { FORM_1040_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_1_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_2_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_3_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_C_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_D_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_SE_TEMPLATE } from '@telostax/engine';
import { FORM_8949_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_E_TEMPLATE } from '@telostax/engine';
import { FORM_8962_TEMPLATE } from '@telostax/engine';
import { FORM_5695_TEMPLATE } from '@telostax/engine';
import { FORM_8936_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_A_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_B_TEMPLATE } from '@telostax/engine';
import { FORM_4562_TEMPLATE } from '@telostax/engine';
import { FORM_1040_ES_TEMPLATE } from '@telostax/engine';
import { FORM_1040V_TEMPLATE } from '@telostax/engine';
import { FORM_4868_TEMPLATE } from '@telostax/engine';
import { FORM_7206_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_F_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_H_TEMPLATE } from '@telostax/engine';
import { SCHEDULE_R_TEMPLATE } from '@telostax/engine';
import { FORM_6251_TEMPLATE } from '@telostax/engine';
import { FORM_4797_TEMPLATE } from '@telostax/engine';
import { FORM_5329_TEMPLATE } from '@telostax/engine';
import { FORM_8606_TEMPLATE } from '@telostax/engine';
import { FORM_4137_TEMPLATE } from '@telostax/engine';
import { FORM_8283_TEMPLATE } from '@telostax/engine';
import { FORM_8911_TEMPLATE } from '@telostax/engine';
import { FORM_8863_TEMPLATE } from '@telostax/engine';
import { FORM_8889_TEMPLATE } from '@telostax/engine';
import { FORM_8582_TEMPLATE } from '@telostax/engine';
import { FORM_2210_TEMPLATE } from '@telostax/engine';
import { FORM_4952_TEMPLATE } from '@telostax/engine';
import { FORM_8615_TEMPLATE } from '@telostax/engine';
import { FORM_8839_TEMPLATE } from '@telostax/engine';
import { FORM_2555_TEMPLATE } from '@telostax/engine';
import { FORM_3903_TEMPLATE } from '@telostax/engine';
import { FORM_982_TEMPLATE } from '@telostax/engine';
import { FORM_5500_EZ_TEMPLATE } from '@telostax/engine';

// ─── Template Cache ─────────────────────────────────────────────
// Cache loaded PDF bytes in memory to avoid re-fetching on repeat downloads.
const templateCache = new Map<string, Uint8Array>();

async function loadTemplate(fileName: string): Promise<Uint8Array> {
  if (templateCache.has(fileName)) return templateCache.get(fileName)!;
  const response = await fetch(`/irs-forms/${fileName}`);
  if (!response.ok) {
    throw new Error(`Failed to load IRS form template: ${fileName} (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  templateCache.set(fileName, bytes);
  return bytes;
}

// ─── Value Resolution ───────────────────────────────────────────

/**
 * Walk a dot-path (e.g., "form1040.totalWages") into an object.
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

/**
 * Format a value for insertion into a PDF text field.
 * IRS convention: whole dollar amounts, no $ signs, no commas, blank for zero.
 */
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
      // Checkbox values are handled separately
      return '';

    default:
      return String(value);
  }
}

// ─── Form Filling ───────────────────────────────────────────────

/**
 * Fill a single IRS PDF form with data from the tax return and calculation result.
 */
export async function fillIRSForm(
  template: IRSFormTemplate,
  taxReturn: TaxReturn,
  calc: CalculationResult,
  options: { flatten?: boolean } = { flatten: true },
): Promise<Uint8Array> {
  const templateBytes = await loadTemplate(template.pdfFileName);
  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();

  // Build field-name resolution index so map entries survive prefix
  // mismatches or intermediate containers (e.g. CombField, TableRow).
  // IRS PDFs use unique leaf field names (f1_1, f1_2, …) across the
  // entire form, so matching by leaf is safe and unambiguous.
  const leafIndex = new Map<string, string>();
  for (const field of form.getFields()) {
    const fullName = field.getName();
    const leaf = fullName.split('.').pop()!;
    // Only index a leaf once — first occurrence wins (unique in IRS PDFs)
    if (!leafIndex.has(leaf)) {
      leafIndex.set(leaf, fullName);
    }
  }

  /** Resolve a pdfFieldName to the actual PDF field's full path. */
  function resolveFieldName(name: string): string {
    // Fast path: exact match
    try { form.getField(name); return name; } catch { /* fall through */ }
    // Leaf match: extract last dotted segment and look up
    const leaf = name.split('.').pop()!;
    return leafIndex.get(leaf) ?? name;
  }

  for (const mapping of template.fields) {
    // Resolve the value — either via transform or sourcePath
    let rawValue: unknown;
    if (mapping.transform) {
      rawValue = mapping.transform(taxReturn, calc);
    } else {
      const source = mapping.source === 'taxReturn' ? taxReturn : calc;
      rawValue = resolvePath(source as unknown as Record<string, unknown>, mapping.sourcePath);
    }

    // Fill the field (resolve name through leaf index for robustness)
    const resolvedName = resolveFieldName(mapping.pdfFieldName);
    if (mapping.format === 'checkbox') {
      try {
        const cb = form.getCheckBox(resolvedName);
        let shouldCheck = false;
        if (mapping.transform) {
          shouldCheck = Boolean(rawValue);
        } else if (mapping.checkWhen) {
          shouldCheck = mapping.checkWhen(rawValue, taxReturn, calc);
        } else {
          shouldCheck = Boolean(rawValue);
        }
        if (shouldCheck) cb.check();
      } catch {
        // Field may not exist in this PDF version — silently skip
      }
    } else {
      try {
        const tf = form.getTextField(resolvedName);
        const formatted = typeof rawValue === 'string' && mapping.transform
          ? rawValue  // transform already returned a formatted string
          : formatValue(rawValue, mapping.format);
        if (formatted) {
          // Only remove maxLength when the value would overflow.
          // This preserves comb spacing on SSN fields (9 digits in
          // maxLength=9) and EIN fields, while still allowing dollar
          // amounts to exceed XFA-era limits.
          const maxLen = tf.getMaxLength();
          if (maxLen !== undefined && formatted.length > maxLen) {
            tf.setMaxLength(undefined);
          }
          tf.setText(formatted);
        }
      } catch {
        // Field may not exist in this PDF version — silently skip
      }
    }
  }

  if (options.flatten) form.flatten();
  return doc.save();
}

// ─── Estimated Tax Voucher Generation ────────────────────────────

/**
 * Generate a 1040-ES voucher PDF: fill the official template, then extract
 * only the voucher pages (discarding the worksheet/instruction pages).
 */
export async function generateEstimatedTaxVouchersPDF(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): Promise<Uint8Array> {
  const template = FORM_1040_ES_TEMPLATE;
  const filledBytes = await fillIRSForm(template, taxReturn, calc);
  const filledDoc = await PDFDocument.load(filledBytes);
  const voucherDoc = await PDFDocument.create();
  const pages = await voucherDoc.copyPages(filledDoc, template.voucherPageIndices);
  for (const page of pages) voucherDoc.addPage(page);
  return voucherDoc.save();
}

// ─── Form 4868 Extension Generation ─────────────────────────────

/**
 * Generate a pre-filled Form 4868 (Automatic Extension of Time to File).
 * Standalone — not part of the filing packet.
 */
export async function generateForm4868PDF(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): Promise<Uint8Array> {
  return fillIRSForm(FORM_4868_TEMPLATE, taxReturn, calc);
}

// ─── Full Return Generation ─────────────────────────────────────

/**
 * All available form templates in IRS attachment sequence order.
 */
export const ALL_TEMPLATES: IRSFormTemplate[] = [
  FORM_1040_TEMPLATE,
  FORM_2210_TEMPLATE,    // Attachment Sequence 06
  SCHEDULE_A_TEMPLATE,   // Attachment Sequence 07
  SCHEDULE_B_TEMPLATE,   // Attachment Sequence 08
  SCHEDULE_1_TEMPLATE,
  SCHEDULE_2_TEMPLATE,
  SCHEDULE_3_TEMPLATE,
  SCHEDULE_C_TEMPLATE,   // Attachment Sequence 09
  SCHEDULE_D_TEMPLATE,   // Attachment Sequence 12
  FORM_8949_TEMPLATE,    // Attachment Sequence 12a
  SCHEDULE_E_TEMPLATE,   // Attachment Sequence 13
  FORM_8936_TEMPLATE,    // Attachment Sequence 13a
  SCHEDULE_F_TEMPLATE,   // Attachment Sequence 15
  SCHEDULE_R_TEMPLATE,   // Attachment Sequence 16
  SCHEDULE_SE_TEMPLATE,  // Attachment Sequence 17
  FORM_4797_TEMPLATE,    // Attachment Sequence 27
  FORM_5329_TEMPLATE,    // Attachment Sequence 29
  FORM_6251_TEMPLATE,    // Attachment Sequence 32
  FORM_8615_TEMPLATE,    // Attachment Sequence 33
  FORM_2555_TEMPLATE,    // Attachment Sequence 34
  FORM_7206_TEMPLATE,    // Attachment Sequence 35
  FORM_8839_TEMPLATE,    // Attachment Sequence 38
  SCHEDULE_H_TEMPLATE,   // Attachment Sequence 44
  FORM_8606_TEMPLATE,    // Attachment Sequence 48
  FORM_8863_TEMPLATE,    // Attachment Sequence 50
  FORM_4952_TEMPLATE,    // Attachment Sequence 51
  FORM_8889_TEMPLATE,    // Attachment Sequence 52
  FORM_4137_TEMPLATE,    // Attachment Sequence 56
  FORM_3903_TEMPLATE,    // Attachment Sequence 62
  FORM_8962_TEMPLATE,    // Attachment Sequence 73
  FORM_8582_TEMPLATE,    // Attachment Sequence 88
  FORM_982_TEMPLATE,     // Attachment Sequence 94
  FORM_8911_TEMPLATE,    // Attachment Sequence 151
  FORM_8283_TEMPLATE,    // Attachment Sequence 155
  FORM_5695_TEMPLATE,    // Attachment Sequence 158
  FORM_4562_TEMPLATE,    // Attachment Sequence 179
  FORM_5500_EZ_TEMPLATE, // Separate filing (Solo 401(k) plan assets > $250k)
  FORM_1040V_TEMPLATE,   // Payment voucher (loose in envelope)
];

/**
 * Generate a merged PDF containing only the selected form instances.
 * Iterates ALL_TEMPLATES in IRS attachment sequence order so the output
 * matches the standard filing order regardless of selection order.
 */
export async function generateSelectedFormsPDF(
  selections: { formId: string; instanceIndex: number }[],
  taxReturn: TaxReturn,
  calc: CalculationResult,
): Promise<Uint8Array> {
  const selSet = new Set(selections.map(s => `${s.formId}:${s.instanceIndex}`));

  const filledPDFs: Uint8Array[] = [];
  for (const template of ALL_TEMPLATES) {
    if (!template.condition(taxReturn, calc)) continue;
    const count = template.instanceCount?.(taxReturn, calc) ?? 1;
    for (let i = 0; i < count; i++) {
      if (!selSet.has(`${template.formId}:${i}`)) continue;
      const fields = template.fieldsForInstance
        ? template.fieldsForInstance(i, taxReturn, calc)
        : template.fields;
      filledPDFs.push(await fillIRSForm({ ...template, fields }, taxReturn, calc));
    }
  }

  if (filledPDFs.length === 1) return filledPDFs[0];

  const merged = await PDFDocument.create();
  for (const pdfBytes of filledPDFs) {
    const src = await PDFDocument.load(pdfBytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return merged.save();
}

/**
 * Generate a complete IRS return PDF by filling all applicable forms
 * and merging them into a single document.
 */
export async function generateIRSReturnPDF(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): Promise<Uint8Array> {
  // Determine which forms to include
  const applicableTemplates = ALL_TEMPLATES.filter(
    t => t.condition(taxReturn, calc),
  );

  // Fill each form (with multi-instance support)
  const filledPDFs: Uint8Array[] = [];
  for (const template of applicableTemplates) {
    const count = template.instanceCount?.(taxReturn, calc) ?? 1;
    for (let i = 0; i < count; i++) {
      const fields = template.fieldsForInstance
        ? template.fieldsForInstance(i, taxReturn, calc)
        : template.fields;
      const instanceTemplate = { ...template, fields };
      const filled = await fillIRSForm(instanceTemplate, taxReturn, calc);
      filledPDFs.push(filled);
    }
  }

  // If only one form (just 1040), return directly
  if (filledPDFs.length === 1) return filledPDFs[0];

  // Merge all forms into a single PDF
  const merged = await PDFDocument.create();
  for (const pdfBytes of filledPDFs) {
    const src = await PDFDocument.load(pdfBytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }

  return merged.save();
}

// ─── Cover Page ──────────────────────────────────────────────────

// Layout & style constants — matches pdfService.ts
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

interface CoverFonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

interface Cursor {
  y: number;
}

function ensureSpace(
  cursor: Cursor,
  needed: number,
  doc: PDFDocument,
): PDFPage {
  if (cursor.y - needed < MARGIN_B) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    cursor.y = PAGE_H - MARGIN_T;
    return page;
  }
  return doc.getPages()[doc.getPageCount() - 1];
}

function drawCoverSectionHeader(
  page: PDFPage,
  fonts: CoverFonts,
  cursor: Cursor,
  title: string,
) {
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

function drawCoverLine(page: PDFPage, cursor: Cursor) {
  page.drawLine({
    start: { x: MARGIN_L, y: cursor.y },
    end: { x: PAGE_W - MARGIN_R, y: cursor.y },
    thickness: 0.5,
    color: LINE_COLOR,
  });
}

/**
 * Generate a 1-page cover sheet summarizing filing instructions.
 */
async function generateCoverPagePDF(
  taxReturn: TaxReturn,
  calc: CalculationResult,
  instructions: FilingInstructions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_W, PAGE_H]);
  const fonts: CoverFonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const cursor: Cursor = { y: PAGE_H - MARGIN_T };

  // ── Header ────────────────────────────────────────────────────
  page.drawText('TelosTax Filing Packet', {
    x: MARGIN_L,
    y: cursor.y,
    size: 18,
    font: fonts.bold,
    color: ACCENT,
  });
  cursor.y -= 20;

  const taxYear = taxReturn.taxYear || 2025;
  page.drawText(`Tax Year ${taxYear}`, {
    x: MARGIN_L,
    y: cursor.y,
    size: 11,
    font: fonts.regular,
    color: DARK_GRAY,
  });
  cursor.y -= 16;

  // Taxpayer name(s)
  const names: string[] = [];
  const first = taxReturn.firstName || '';
  const last = taxReturn.lastName || '';
  if (first || last) names.push(`${first} ${last}`.trim());
  if (taxReturn.spouseFirstName || taxReturn.spouseLastName) {
    names.push(`${taxReturn.spouseFirstName || ''} ${taxReturn.spouseLastName || ''}`.trim());
  }
  if (names.length > 0) {
    page.drawText(names.join(' & '), {
      x: MARGIN_L,
      y: cursor.y,
      size: 10,
      font: fonts.regular,
      color: BLACK,
    });
    cursor.y -= 14;
  }

  drawCoverLine(page, cursor);
  cursor.y -= 12;

  // ── Filing Deadline ───────────────────────────────────────────
  page.drawText('Filing Deadline:', {
    x: MARGIN_L,
    y: cursor.y,
    size: 9,
    font: fonts.bold,
    color: BLACK,
  });
  const dlWidth = fonts.bold.widthOfTextAtSize('Filing Deadline:', 9);
  page.drawText(`  ${instructions.deadline}`, {
    x: MARGIN_L + dlWidth,
    y: cursor.y,
    size: 9,
    font: fonts.regular,
    color: DARK_GRAY,
  });
  cursor.y -= 18;

  // ── Forms Included ────────────────────────────────────────────
  drawCoverSectionHeader(page, fonts, cursor, 'Forms in Your Return');

  for (let i = 0; i < instructions.formsIncluded.length; i++) {
    page = ensureSpace(cursor, 14, doc);
    const form = instructions.formsIncluded[i];
    page.drawText(`${i + 1}.`, {
      x: MARGIN_L + 4,
      y: cursor.y,
      size: 8,
      font: fonts.regular,
      color: LIGHT_GRAY,
    });
    page.drawText(form.displayName, {
      x: MARGIN_L + 20,
      y: cursor.y,
      size: 9,
      font: fonts.regular,
      color: BLACK,
    });
    cursor.y -= 14;
  }

  page.drawText('Print all pages, even if some are blank.', {
    x: MARGIN_L,
    y: cursor.y,
    size: 7,
    font: fonts.italic,
    color: LIGHT_GRAY,
  });
  cursor.y -= 16;

  // ── Mailing Address ───────────────────────────────────────────
  page = ensureSpace(cursor, 80, doc);
  drawCoverSectionHeader(page, fonts, cursor, 'Mail To');

  // Draw address in a light box
  const addrBoxH = instructions.mailingAddress.length * 14 + 10;
  page.drawRectangle({
    x: MARGIN_L,
    y: cursor.y - addrBoxH + 12,
    width: 250,
    height: addrBoxH,
    color: rgb(0.96, 0.96, 0.96),
    borderColor: LINE_COLOR,
    borderWidth: 0.5,
  });
  for (const line of instructions.mailingAddress) {
    page.drawText(line, {
      x: MARGIN_L + 10,
      y: cursor.y,
      size: 9,
      font: fonts.regular,
      color: BLACK,
    });
    cursor.y -= 14;
  }
  cursor.y -= 6;

  page.drawText('Send via USPS. Use certified mail with return receipt for proof of delivery.', {
    x: MARGIN_L,
    y: cursor.y,
    size: 7,
    font: fonts.italic,
    color: LIGHT_GRAY,
  });
  cursor.y -= 16;

  // ── Before You Mail ───────────────────────────────────────────
  page = ensureSpace(cursor, 80, doc);
  drawCoverSectionHeader(page, fonts, cursor, 'Before You Mail');

  // Signature
  page.drawText('[ ]', { x: MARGIN_L + 4, y: cursor.y, size: 10, font: fonts.regular, color: ACCENT });
  page.drawText(instructions.signatureLines, {
    x: MARGIN_L + 20,
    y: cursor.y,
    size: 8,
    font: fonts.regular,
    color: DARK_GRAY,
  });
  cursor.y -= 14;

  // Attachments
  if (instructions.attachments.length > 0) {
    page = ensureSpace(cursor, 14 + instructions.attachments.length * 14, doc);
    page.drawText('[ ]', { x: MARGIN_L + 4, y: cursor.y, size: 10, font: fonts.regular, color: ACCENT });
    page.drawText('Attach to the front of your return:', {
      x: MARGIN_L + 20,
      y: cursor.y,
      size: 8,
      font: fonts.bold,
      color: DARK_GRAY,
    });
    cursor.y -= 14;

    for (const item of instructions.attachments) {
      page = ensureSpace(cursor, 14, doc);
      page.drawText('\u2022', { x: MARGIN_L + 28, y: cursor.y, size: 8, font: fonts.regular, color: ACCENT });
      page.drawText(item, {
        x: MARGIN_L + 40,
        y: cursor.y,
        size: 8,
        font: fonts.regular,
        color: DARK_GRAY,
      });
      cursor.y -= 14;
    }
  }

  // Don't staple
  page = ensureSpace(cursor, 14, doc);
  page.drawText('[ ]', { x: MARGIN_L + 4, y: cursor.y, size: 10, font: fonts.regular, color: ACCENT });
  page.drawText('Do not staple or paper-clip your payment to the return. Place it loosely in the envelope.', {
    x: MARGIN_L + 20,
    y: cursor.y,
    size: 8,
    font: fonts.regular,
    color: DARK_GRAY,
  });
  cursor.y -= 18;

  // ── Payment (conditional) ─────────────────────────────────────
  if (instructions.owesAmount > 0) {
    page = ensureSpace(cursor, 60, doc);
    drawCoverSectionHeader(page, fonts, cursor, 'Payment Due');

    const amt = instructions.owesAmount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    page.drawText(`Amount Owed: ${amt}`, {
      x: MARGIN_L,
      y: cursor.y,
      size: 11,
      font: fonts.bold,
      color: MONEY_RED,
    });
    cursor.y -= 16;

    if (instructions.paymentNote) {
      // Word-wrap the payment note
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
        } else {
          line = test;
        }
      }
      if (line) {
        page = ensureSpace(cursor, 12, doc);
        page.drawText(line, { x: MARGIN_L, y: cursor.y, size: 8, font: fonts.regular, color: DARK_GRAY });
        cursor.y -= 12;
      }
    }
    cursor.y -= 6;
  }

  // ── Refund (conditional) ──────────────────────────────────────
  if (instructions.refundAmount > 0) {
    page = ensureSpace(cursor, 50, doc);
    drawCoverSectionHeader(page, fonts, cursor, 'Your Refund');

    const amt = instructions.refundAmount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    page.drawText(`Estimated Refund: ${amt}`, {
      x: MARGIN_L,
      y: cursor.y,
      size: 11,
      font: fonts.bold,
      color: MONEY_GREEN,
    });
    cursor.y -= 16;

    page.drawText(
      'Paper-filed returns typically take 6\u20138 weeks to process. Check status at irs.gov/refunds about 4 weeks after mailing.',
      { x: MARGIN_L, y: cursor.y, size: 8, font: fonts.regular, color: DARK_GRAY },
    );
    cursor.y -= 18;
  }

  // ── State Filing (conditional) ────────────────────────────────
  if (instructions.hasStateReturn && instructions.stateNames.length > 0) {
    page = ensureSpace(cursor, 40, doc);
    drawCoverSectionHeader(page, fonts, cursor, 'State Filing');

    const stateText = instructions.stateNames.length === 1
      ? `You also need to file a ${instructions.stateNames[0]} state return separately.`
      : `You also need to file state returns for ${instructions.stateNames.join(' and ')} separately.`;
    page.drawText(stateText, {
      x: MARGIN_L,
      y: cursor.y,
      size: 8,
      font: fonts.regular,
      color: DARK_GRAY,
    });
    cursor.y -= 14;

    // Per-state tax amounts from calculation
    if (calc.stateResults?.length) {
      for (const sr of calc.stateResults) {
        if (sr.totalStateTax <= 0 && sr.localTax <= 0) continue;
        page = ensureSpace(cursor, 30, doc);
        const isRefund = sr.stateRefundOrOwed >= 0;
        const amtStr = `$${Math.abs(sr.stateRefundOrOwed).toLocaleString()}`;
        const label = isRefund ? `${sr.stateName}: Refund ${amtStr}` : `${sr.stateName}: Owed ${amtStr}`;
        page.drawText(label, {
          x: MARGIN_L + 8,
          y: cursor.y,
          size: 9,
          font: fonts.bold,
          color: isRefund ? MONEY_GREEN : MONEY_RED,
        });
        cursor.y -= 13;
        page.drawText(`Total tax: $${sr.totalStateTax.toLocaleString()}  |  Effective rate: ${(sr.effectiveStateRate * 100).toFixed(2)}%`, {
          x: MARGIN_L + 8,
          y: cursor.y,
          size: 7,
          font: fonts.regular,
          color: DARK_GRAY,
        });
        cursor.y -= 14;
      }
    }

    page = ensureSpace(cursor, 14, doc);
    page.drawText('State returns are mailed to your state\u2019s department of revenue \u2014 not to the IRS addresses above.', {
      x: MARGIN_L,
      y: cursor.y,
      size: 8,
      font: fonts.regular,
      color: DARK_GRAY,
    });
    cursor.y -= 18;
  }

  // ── Footer ────────────────────────────────────────────────────
  // Draw footer on every page
  const pages = doc.getPages();
  for (const p of pages) {
    p.drawLine({
      start: { x: MARGIN_L, y: MARGIN_B - 10 },
      end: { x: PAGE_W - MARGIN_R, y: MARGIN_B - 10 },
      thickness: 0.5,
      color: LINE_COLOR,
    });
    p.drawText(
      'This cover page is for your reference only \u2014 do not mail it to the IRS.',
      {
        x: MARGIN_L,
        y: MARGIN_B - 24,
        size: 7,
        font: fonts.italic,
        color: LIGHT_GRAY,
      },
    );
  }

  return doc.save();
}

// ─── Filing Packet ───────────────────────────────────────────────

/**
 * Generate a complete filing packet: cover page + all applicable IRS forms.
 */
export async function generateFilingPacketPDF(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): Promise<Uint8Array> {
  const instructions = getFilingInstructions(taxReturn, calc);
  const [coverBytes, formsBytes] = await Promise.all([
    generateCoverPagePDF(taxReturn, calc, instructions),
    generateIRSReturnPDF(taxReturn, calc),
  ]);

  // Merge cover + federal forms
  const merged = await PDFDocument.create();

  const coverDoc = await PDFDocument.load(coverBytes);
  const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
  for (const p of coverPages) merged.addPage(p);

  const formsDoc = await PDFDocument.load(formsBytes);
  const formsPages = await merged.copyPages(formsDoc, formsDoc.getPageIndices());
  for (const p of formsPages) merged.addPage(p);

  // Append state form PDFs (real filled forms preferred, summary fallback)
  if (calc.stateResults?.length) {
    for (const sr of calc.stateResults) {
      const stateFormPDF = await generateStateFormPDF(taxReturn, calc, sr);
      if (stateFormPDF) {
        const stateDoc = await PDFDocument.load(stateFormPDF);
        const statePages = await merged.copyPages(stateDoc, stateDoc.getPageIndices());
        for (const p of statePages) merged.addPage(p);
      } else if (sr.totalStateTax > 0 || sr.localTax > 0) {
        const summaryBytes = await generateStateTaxSummaryPDF(sr);
        const summaryDoc = await PDFDocument.load(summaryBytes);
        const summaryPages = await merged.copyPages(summaryDoc, summaryDoc.getPageIndices());
        for (const p of summaryPages) merged.addPage(p);
      }
    }
  }

  return merged.save();
}
