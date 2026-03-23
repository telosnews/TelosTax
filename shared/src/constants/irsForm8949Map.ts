/**
 * IRS Form 8949 (2025) — AcroForm Field Mapping
 *
 * Sales and Other Dispositions of Capital Assets
 * PDF: client/public/irs-forms/f8949.pdf (Form 8949, 2025)
 * Attachment Sequence No. 12a
 * Total fields: 202 (text: 196, checkbox: 6 per page)
 *
 * Structure:
 *   Page 1 — Part I: Short-Term (Assets Held One Year or Less)
 *     Header: f1_01 (name), f1_02 (SSN)
 *     Checkboxes: c1_1[0..5] → Box A, B, C, G, H, I
 *     Table: 11 rows × 8 columns (description, dateAcquired, dateSold, proceeds, costBasis, code, adjustment, gainLoss)
 *       Row1:  f1_03..f1_10
 *       Row2:  f1_11..f1_18
 *       Row3:  f1_19..f1_26
 *       Row4:  f1_27..f1_34
 *       Row5:  f1_35..f1_42
 *       Row6:  f1_43..f1_50
 *       Row7:  f1_51..f1_58
 *       Row8:  f1_59..f1_66
 *       Row9:  f1_67..f1_74
 *       Row10: f1_75..f1_82
 *       Row11: f1_83..f1_90
 *     Totals: f1_91 (proceeds), f1_92 (cost), f1_93 (code), f1_94 (adjustment), f1_95 (gain/loss)
 *
 *   Page 2 — Part II: Long-Term (Assets Held More Than One Year)
 *     Same structure with f2_ prefix and c2_1 checkboxes
 *     Checkboxes: c2_1[0..5] → Box D, E, F, J, K, L
 *
 * Multi-instance: When transactions exceed 11 per category per term, additional
 * form instances are generated. Each instance fills the appropriate page(s).
 *
 * Form 8949 is only needed for transactions that CANNOT go directly on Schedule D
 * line 1a/8a — specifically, transactions with adjustments (wash sales) or where
 * basis was NOT reported to the IRS. Transactions with basis reported and no
 * adjustments go directly to Schedule D line 1a/8a without Form 8949.
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult, Income1099B, Income1099DA } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';
const ROWS_PER_PAGE = 11;

// ─── Transaction Categorization ─────────────────────────────────

/** A normalized transaction ready for Form 8949 */
interface F8949Transaction {
  description: string;
  dateAcquired: string;
  dateSold: string;
  proceeds: number;
  costBasis: number;
  code: string;       // Adjustment code (e.g., "W" for wash sale)
  adjustment: number;  // Amount of adjustment
  gainLoss: number;
}

type BoxCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * Categorize all transactions by Form 8949 Box.
 * Only transactions needing Form 8949 are included (adjustments or basis not reported).
 */
function categorizeTransactions(tr: TaxReturn): Record<BoxCategory, F8949Transaction[]> {
  const result: Record<BoxCategory, F8949Transaction[]> = {
    A: [], B: [], C: [], D: [], E: [], F: [],
  };

  const all1099B: Income1099B[] = tr.income1099B || [];
  for (const t of all1099B) {
    const basisReported = t.basisReportedToIRS !== false;
    const hasAdjustments = (t.washSaleLossDisallowed || 0) !== 0;

    // Transactions with basis reported and no adjustments go directly to Schedule D
    if (basisReported && !hasAdjustments) continue;

    const txn: F8949Transaction = {
      description: t.description || '',
      dateAcquired: t.dateAcquired || 'VARIOUS',
      dateSold: t.dateSold || '',
      proceeds: t.proceeds,
      costBasis: t.costBasis,
      code: hasAdjustments ? 'W' : '',
      adjustment: t.washSaleLossDisallowed || 0,
      gainLoss: (t.proceeds - t.costBasis) + (t.washSaleLossDisallowed || 0),
    };

    if (!t.isLongTerm) {
      result[basisReported ? 'A' : 'B'].push(txn);
    } else {
      result[basisReported ? 'D' : 'E'].push(txn);
    }
  }

  // 1099-DA (digital assets)
  const all1099DA: Income1099DA[] = (tr as unknown as Record<string, unknown>).income1099DA as Income1099DA[] || [];
  for (const t of all1099DA) {
    const basisReported = t.isBasisReportedToIRS !== false;
    const hasAdjustments = (t.washSaleLossDisallowed || 0) !== 0;

    if (basisReported && !hasAdjustments) continue;

    const txn: F8949Transaction = {
      description: t.description || t.tokenName || '',
      dateAcquired: t.dateAcquired || 'VARIOUS',
      dateSold: t.dateSold || '',
      proceeds: t.proceeds,
      costBasis: t.costBasis,
      code: hasAdjustments ? 'W' : '',
      adjustment: t.washSaleLossDisallowed || 0,
      gainLoss: (t.proceeds - t.costBasis) + (t.washSaleLossDisallowed || 0),
    };

    if (!t.isLongTerm) {
      result[basisReported ? 'A' : 'B'].push(txn);
    } else {
      result[basisReported ? 'D' : 'E'].push(txn);
    }
  }

  return result;
}

/**
 * Compute the total number of Form 8949 instances needed.
 * Each instance uses one PDF (2 pages). We pair ST and LT categories:
 * Instance layout: Page 1 = ST category, Page 2 = LT category.
 * For overflow (>11 per category), additional instances are created.
 */
interface InstancePlan {
  stBox: BoxCategory | null;
  stTransactions: F8949Transaction[];
  ltBox: BoxCategory | null;
  ltTransactions: F8949Transaction[];
}

function planInstances(tr: TaxReturn): InstancePlan[] {
  const cats = categorizeTransactions(tr);
  const plans: InstancePlan[] = [];

  // ST categories: A, B, C → pair with LT categories: D, E, F
  const stCategories: BoxCategory[] = ['A', 'B', 'C'];
  const ltCategories: BoxCategory[] = ['D', 'E', 'F'];

  // For each pairing (A↔D, B↔E, C↔F), chunk into pages of 11
  for (let i = 0; i < 3; i++) {
    const stBox = stCategories[i];
    const ltBox = ltCategories[i];
    const stTxns = cats[stBox];
    const ltTxns = cats[ltBox];

    if (stTxns.length === 0 && ltTxns.length === 0) continue;

    const stPages = stTxns.length > 0 ? Math.ceil(stTxns.length / ROWS_PER_PAGE) : 0;
    const ltPages = ltTxns.length > 0 ? Math.ceil(ltTxns.length / ROWS_PER_PAGE) : 0;
    const maxPages = Math.max(stPages, ltPages, 1);

    for (let p = 0; p < maxPages; p++) {
      const stSlice = stTxns.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
      const ltSlice = ltTxns.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
      plans.push({
        stBox: stSlice.length > 0 ? stBox : null,
        stTransactions: stSlice,
        ltBox: ltSlice.length > 0 ? ltBox : null,
        ltTransactions: ltSlice,
      });
    }
  }

  return plans;
}

// ─── Field Mapping Generators ────────────────────────────────────

function fmtDollar(v: number): string {
  return v && !isNaN(v) ? Math.round(v).toString() : '';
}

function fmtDate(d: string): string {
  if (!d || d === 'VARIOUS') return d;
  // Convert YYYY-MM-DD to MM/DD/YYYY
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
  return d;
}

/** Checkbox index for ST boxes: A=0, B=1, C=2, G=3, H=4, I=5 */
function stCheckboxIndex(box: BoxCategory): number {
  return { A: 0, B: 1, C: 2, D: -1, E: -1, F: -1 }[box];
}

/** Checkbox index for LT boxes: D=0, E=1, F=2, J=3, K=4, L=5 */
function ltCheckboxIndex(box: BoxCategory): number {
  return { A: -1, B: -1, C: -1, D: 0, E: 1, F: 2 }[box];
}

/** Box label for ST categories */
function stBoxLabel(box: BoxCategory): string {
  return { A: 'Box A: Basis reported to IRS', B: 'Box B: Basis NOT reported to IRS', C: 'Box C: Not on 1099-B', D: '', E: '', F: '' }[box];
}

/** Box label for LT categories */
function ltBoxLabel(box: BoxCategory): string {
  return { A: '', B: '', C: '', D: 'Box D: Basis reported to IRS', E: 'Box E: Basis NOT reported to IRS', F: 'Box F: Not on 1099-B' }[box];
}

/**
 * Build field mappings for one Form 8949 instance.
 */
function buildInstanceFields(plan: InstancePlan, tr: TaxReturn): IRSFieldMapping[] {
  const fields: IRSFieldMapping[] = [];

  // ── Page 1 Header ──
  fields.push({
    pdfFieldName: `${P1}.f1_01[0]`,
    formLabel: 'Name shown on return',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim(),
  });
  fields.push({
    pdfFieldName: `${P1}.f1_02[0]`,
    formLabel: 'Social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  });

  // ── Page 1 Box Checkbox (ST) ──
  if (plan.stBox !== null) {
    const idx = stCheckboxIndex(plan.stBox);
    if (idx >= 0) {
      fields.push({
        pdfFieldName: `${P1}.c1_1[${idx}]`,
        formLabel: `Part I: ${stBoxLabel(plan.stBox)}`,
        sourcePath: '',
        source: 'taxReturn',
        format: 'checkbox',
        transform: () => true,
      });
    }
  }

  // ── Page 1 Transaction Rows (ST) ──
  const stBaseField = 3; // f1_03 is the first field of Row1
  for (let row = 0; row < plan.stTransactions.length && row < ROWS_PER_PAGE; row++) {
    const txn = plan.stTransactions[row];
    const fieldBase = stBaseField + (row * 8);
    const rowNum = row + 1;
    const prefix = `${P1}.Table_Line1_Part1[0].Row${rowNum}[0]`;

    // (a) Description
    fields.push({
      pdfFieldName: `${prefix}.f1_${String(fieldBase).padStart(2, '0')}[0]`,
      formLabel: `Part I Row ${rowNum}(a): Description of property`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => txn.description,
    });
    // (b) Date acquired
    fields.push({
      pdfFieldName: `${prefix}.f1_${String(fieldBase + 1).padStart(2, '0')}[0]`,
      formLabel: `Part I Row ${rowNum}(b): Date acquired`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(txn.dateAcquired),
    });
    // (c) Date sold
    fields.push({
      pdfFieldName: `${prefix}.f1_${String(fieldBase + 2).padStart(2, '0')}[0]`,
      formLabel: `Part I Row ${rowNum}(c): Date sold or disposed of`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(txn.dateSold),
    });
    // (d) Proceeds
    fields.push({
      pdfFieldName: `${prefix}.f1_${String(fieldBase + 3).padStart(2, '0')}[0]`,
      formLabel: `Part I Row ${rowNum}(d): Proceeds`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(txn.proceeds),
    });
    // (e) Cost basis
    fields.push({
      pdfFieldName: `${prefix}.f1_${String(fieldBase + 4).padStart(2, '0')}[0]`,
      formLabel: `Part I Row ${rowNum}(e): Cost or other basis`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(txn.costBasis),
    });
    // (f) Code
    fields.push({
      pdfFieldName: `${prefix}.f1_${String(fieldBase + 5).padStart(2, '0')}[0]`,
      formLabel: `Part I Row ${rowNum}(f): Adjustment code`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => txn.code,
    });
    // (g) Adjustment
    fields.push({
      pdfFieldName: `${prefix}.f1_${String(fieldBase + 6).padStart(2, '0')}[0]`,
      formLabel: `Part I Row ${rowNum}(g): Amount of adjustment`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(txn.adjustment),
    });
    // (h) Gain or loss
    fields.push({
      pdfFieldName: `${prefix}.f1_${String(fieldBase + 7).padStart(2, '0')}[0]`,
      formLabel: `Part I Row ${rowNum}(h): Gain or loss`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(txn.gainLoss),
    });
  }

  // ── Page 1 Totals ──
  if (plan.stTransactions.length > 0) {
    const stTotals = plan.stTransactions.reduce(
      (acc, t) => ({
        proceeds: acc.proceeds + t.proceeds,
        cost: acc.cost + t.costBasis,
        adj: acc.adj + t.adjustment,
        gl: acc.gl + t.gainLoss,
      }),
      { proceeds: 0, cost: 0, adj: 0, gl: 0 },
    );
    fields.push({
      pdfFieldName: `${P1}.f1_91[0]`,
      formLabel: 'Part I Totals: Proceeds',
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(stTotals.proceeds),
    });
    fields.push({
      pdfFieldName: `${P1}.f1_92[0]`,
      formLabel: 'Part I Totals: Cost or other basis',
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(stTotals.cost),
    });
    fields.push({
      pdfFieldName: `${P1}.f1_94[0]`,
      formLabel: 'Part I Totals: Amount of adjustment',
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(stTotals.adj),
    });
    fields.push({
      pdfFieldName: `${P1}.f1_95[0]`,
      formLabel: 'Part I Totals: Gain or loss',
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(stTotals.gl),
    });
  }

  // ── Page 2 Header ──
  fields.push({
    pdfFieldName: `${P2}.f2_01[0]`,
    formLabel: 'Name shown on return (page 2)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim(),
  });
  fields.push({
    pdfFieldName: `${P2}.f2_02[0]`,
    formLabel: 'Social security number (page 2)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  });

  // ── Page 2 Box Checkbox (LT) ──
  if (plan.ltBox !== null) {
    const idx = ltCheckboxIndex(plan.ltBox);
    if (idx >= 0) {
      fields.push({
        pdfFieldName: `${P2}.c2_1[${idx}]`,
        formLabel: `Part II: ${ltBoxLabel(plan.ltBox)}`,
        sourcePath: '',
        source: 'taxReturn',
        format: 'checkbox',
        transform: () => true,
      });
    }
  }

  // ── Page 2 Transaction Rows (LT) ──
  const ltBaseField = 3; // f2_03 is the first field of Row1
  for (let row = 0; row < plan.ltTransactions.length && row < ROWS_PER_PAGE; row++) {
    const txn = plan.ltTransactions[row];
    const fieldBase = ltBaseField + (row * 8);
    const rowNum = row + 1;
    const prefix = `${P2}.Table_Line1_Part2[0].Row${rowNum}[0]`;

    // (a) Description
    fields.push({
      pdfFieldName: `${prefix}.f2_${String(fieldBase).padStart(2, '0')}[0]`,
      formLabel: `Part II Row ${rowNum}(a): Description of property`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => txn.description,
    });
    // (b) Date acquired
    fields.push({
      pdfFieldName: `${prefix}.f2_${String(fieldBase + 1).padStart(2, '0')}[0]`,
      formLabel: `Part II Row ${rowNum}(b): Date acquired`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(txn.dateAcquired),
    });
    // (c) Date sold
    fields.push({
      pdfFieldName: `${prefix}.f2_${String(fieldBase + 2).padStart(2, '0')}[0]`,
      formLabel: `Part II Row ${rowNum}(c): Date sold or disposed of`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(txn.dateSold),
    });
    // (d) Proceeds
    fields.push({
      pdfFieldName: `${prefix}.f2_${String(fieldBase + 3).padStart(2, '0')}[0]`,
      formLabel: `Part II Row ${rowNum}(d): Proceeds`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(txn.proceeds),
    });
    // (e) Cost basis
    fields.push({
      pdfFieldName: `${prefix}.f2_${String(fieldBase + 4).padStart(2, '0')}[0]`,
      formLabel: `Part II Row ${rowNum}(e): Cost or other basis`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(txn.costBasis),
    });
    // (f) Code
    fields.push({
      pdfFieldName: `${prefix}.f2_${String(fieldBase + 5).padStart(2, '0')}[0]`,
      formLabel: `Part II Row ${rowNum}(f): Adjustment code`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => txn.code,
    });
    // (g) Adjustment
    fields.push({
      pdfFieldName: `${prefix}.f2_${String(fieldBase + 6).padStart(2, '0')}[0]`,
      formLabel: `Part II Row ${rowNum}(g): Amount of adjustment`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(txn.adjustment),
    });
    // (h) Gain or loss
    fields.push({
      pdfFieldName: `${prefix}.f2_${String(fieldBase + 7).padStart(2, '0')}[0]`,
      formLabel: `Part II Row ${rowNum}(h): Gain or loss`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(txn.gainLoss),
    });
  }

  // ── Page 2 Totals ──
  if (plan.ltTransactions.length > 0) {
    const ltTotals = plan.ltTransactions.reduce(
      (acc, t) => ({
        proceeds: acc.proceeds + t.proceeds,
        cost: acc.cost + t.costBasis,
        adj: acc.adj + t.adjustment,
        gl: acc.gl + t.gainLoss,
      }),
      { proceeds: 0, cost: 0, adj: 0, gl: 0 },
    );
    fields.push({
      pdfFieldName: `${P2}.f2_91[0]`,
      formLabel: 'Part II Totals: Proceeds',
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(ltTotals.proceeds),
    });
    fields.push({
      pdfFieldName: `${P2}.f2_92[0]`,
      formLabel: 'Part II Totals: Cost or other basis',
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(ltTotals.cost),
    });
    fields.push({
      pdfFieldName: `${P2}.f2_94[0]`,
      formLabel: 'Part II Totals: Amount of adjustment',
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(ltTotals.adj),
    });
    fields.push({
      pdfFieldName: `${P2}.f2_95[0]`,
      formLabel: 'Part II Totals: Gain or loss',
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(ltTotals.gl),
    });
  }

  return fields;
}

// ─── Exports ─────────────────────────────────────────────────────

/**
 * Form 8949 uses dynamic field generation via fieldsForInstance.
 * The static `fields` array is empty — all mappings are generated per-instance.
 */
export const FORM_8949_FIELDS: IRSFieldMapping[] = [];

export const FORM_8949_TEMPLATE: IRSFormTemplate = {
  formId: 'f8949',
  displayName: 'Form 8949',
  attachmentSequence: 12.5, // 12a — after Schedule D (12)
  pdfFileName: 'f8949.pdf',

  condition: (tr: TaxReturn, _calc: CalculationResult) => {
    // Form 8949 is needed when transactions have adjustments or basis not reported
    const plans = planInstances(tr);
    return plans.length > 0;
  },

  fields: FORM_8949_FIELDS,

  instanceCount: (tr: TaxReturn, _calc: CalculationResult) => {
    return Math.max(planInstances(tr).length, 0);
  },

  fieldsForInstance: (
    index: number,
    tr: TaxReturn,
    _calc: CalculationResult,
  ) => {
    const plans = planInstances(tr);
    if (index >= plans.length) return [];
    return buildInstanceFields(plans[index], tr);
  },
};
