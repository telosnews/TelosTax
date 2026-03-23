/**
 * IRS Schedule E (Form 1040) 2025 — AcroForm Field Mapping
 *
 * Supplemental Income and Loss
 * (From rental real estate, royalties, partnerships, S corporations, estates, trusts, REMICs, etc.)
 * PDF: client/public/irs-forms/f1040se.pdf (Schedule E, 2025)
 * Attachment Sequence No. 13
 * Total fields: 185 (text: 167, checkbox: 18)
 *
 * Field prefix: topmostSubform[0].Page1[0] (page 1) / topmostSubform[0].Page2[0] (page 2)
 *
 * Page 1 field map (Part I — Income or Loss From Rental Real Estate and Royalties):
 *   f1_1  = Name(s) shown on return
 *   f1_2  = Your social security number
 *   c1_1[0/1] = A: Did you make payments requiring Form(s) 1099? (Yes/No)
 *   c1_2[0/1] = B: If "Yes," did you file required Form(s) 1099? (Yes/No)
 *
 *   Properties A/B/C (3-column grid):
 *   Table_Line1a RowA/B/C: f1_3..f1_5 = Physical address of each property
 *   Table_Line1b RowA/B/C: f1_6..f1_8 = Type of property (code 1-8)
 *   Table_Line2  RowA/B/C: f1_9..f1_14 = Fair rental days + Personal use days
 *                           c1_3..c1_5 = QJV checkbox
 *   f1_15 = (reserved/spacer)
 *
 *   Income:
 *   Table_Income Line3: f1_16..f1_18 = Rents received (A/B/C)
 *   Table_Income Line4: f1_19..f1_21 = Royalties received (A/B/C)
 *
 *   Expenses (Lines 5-19, 3 columns per line):
 *   Table_Expenses Line5:  f1_22..f1_24 = Advertising
 *   Table_Expenses Line6:  f1_25..f1_27 = Auto and travel
 *   Table_Expenses Line7:  f1_28..f1_30 = Cleaning and maintenance
 *   Table_Expenses Line8:  f1_31..f1_33 = Commissions
 *   Table_Expenses Line9:  f1_34..f1_36 = Insurance
 *   Table_Expenses Line10: f1_37..f1_39 = Legal and other professional fees
 *   Table_Expenses Line11: f1_40..f1_42 = Management fees
 *   Table_Expenses Line12: f1_43..f1_45 = Mortgage interest paid
 *   Table_Expenses Line13: f1_46..f1_48 = Other interest
 *   Table_Expenses Line14: f1_49..f1_51 = Repairs
 *   Table_Expenses Line15: f1_52..f1_54 = Supplies
 *   Table_Expenses Line16: f1_55..f1_57 = Taxes
 *   Table_Expenses Line17: f1_58..f1_60 = Utilities
 *   Table_Expenses Line18: f1_61..f1_63 = Depreciation expense or depletion
 *   Table_Expenses Line19: f1_64 = Other description, f1_65..f1_67 = Other (A/B/C)
 *
 *   Totals:
 *   Table_Expenses Line20: f1_68..f1_70 = Total expenses (A/B/C)
 *   Table_Expenses Line21: f1_71..f1_73 = Net income/loss per property (A/B/C)
 *   Table_Expenses Line22: f1_74..f1_76 = Deductible rental real estate loss (A/B/C)
 *
 *   Summary (Lines 23-26):
 *   f1_77 = Line 23a: Total rents received (sum across all properties)
 *   f1_78 = Line 23b: Total royalties received
 *   f1_79 = Line 23c: Total expenses (sum across all properties)
 *   f1_80 = Line 23d: Net income/loss (sum of Line 21 across properties)
 *   f1_81 = Line 23e: Deductible loss total (sum of Line 22)
 *   f1_82 = Line 24: Income (positive amounts only)
 *   f1_83 = Line 25: Losses (as positive amount)
 *   f1_84 = Line 26: Total rental real estate and royalty income or (loss)
 *
 * Page 2:
 *   f2_1  = Name(s) continuation
 *   f2_2  = SSN continuation
 *   c2_1[0/1] = Line 27: Active participation checkbox
 *
 *   Part II — Income or Loss From Partnerships and S Corporations:
 *   Table_Line28a-f RowA-D: Entity info (name, type, foreign, EIN, at-risk, basis)
 *   Table_Line28g-k RowA-D: Income/loss columns (passive deduction, passive income,
 *                            nonpassive deduction, nonpassive income, sec 179)
 *   f2_35..f2_41: Lines 29-32 totals
 *
 *   Part III — Income or Loss From Estates and Trusts (skipped in this mapping)
 *   Part IV — Income or Loss From Real Estate Mortgage Investment Conduits (skipped)
 *
 *   Summary:
 *   f2_76..f2_80: Lines 39-42 grand totals
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult, RentalProperty } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

// ─── Helpers ─────────────────────────────────────────────────────

/** Format a dollar amount for IRS: whole-dollar, no $ or commas, blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

/** Map RentalProperty.propertyType to IRS Schedule E type code (1-8) */
function propertyTypeCode(type: RentalProperty['propertyType']): string {
  switch (type) {
    case 'single_family': return '1';
    case 'multi_family': return '2';
    case 'condo': return '1';       // Single family residence
    case 'commercial': return '4';
    case 'other': return '8';
    default: return '8';
  }
}

/** Sum all expense line items for a rental property */
function sumExpenses(p: RentalProperty): number {
  return (
    (p.advertising || 0) +
    (p.auto || 0) +
    (p.cleaning || 0) +
    (p.commissions || 0) +
    (p.insurance || 0) +
    (p.legal || 0) +
    (p.management || 0) +
    (p.mortgageInterest || 0) +
    (p.otherInterest || 0) +
    (p.repairs || 0) +
    (p.supplies || 0) +
    (p.taxes || 0) +
    (p.utilities || 0) +
    (p.depreciation || 0) +
    (p.otherExpenses || 0)
  );
}

// ─── Expense Line Definitions ────────────────────────────────────
// Maps IRS Schedule E expense line numbers (5-18) to RentalProperty keys.
// Line 19 (Other) is handled separately due to its extra description field.

const EXPENSE_LINES: Array<{ irsLine: number; prop: keyof RentalProperty; label: string }> = [
  { irsLine: 5, prop: 'advertising', label: 'Advertising' },
  { irsLine: 6, prop: 'auto', label: 'Auto and travel' },
  { irsLine: 7, prop: 'cleaning', label: 'Cleaning and maintenance' },
  { irsLine: 8, prop: 'commissions', label: 'Commissions' },
  { irsLine: 9, prop: 'insurance', label: 'Insurance' },
  { irsLine: 10, prop: 'legal', label: 'Legal and other professional fees' },
  { irsLine: 11, prop: 'management', label: 'Management fees' },
  { irsLine: 12, prop: 'mortgageInterest', label: 'Mortgage interest paid' },
  { irsLine: 13, prop: 'otherInterest', label: 'Other interest' },
  { irsLine: 14, prop: 'repairs', label: 'Repairs' },
  { irsLine: 15, prop: 'supplies', label: 'Supplies' },
  { irsLine: 16, prop: 'taxes', label: 'Taxes' },
  { irsLine: 17, prop: 'utilities', label: 'Utilities' },
  { irsLine: 18, prop: 'depreciation', label: 'Depreciation expense or depletion' },
];

// ─── Per-Property Field Generator ────────────────────────────────
// Schedule E Part I supports 3 properties per page (columns A, B, C).
// This generates the field mappings for each property column.

function generatePropertyFields(): IRSFieldMapping[] {
  const fields: IRSFieldMapping[] = [];
  const rows = ['A', 'B', 'C'] as const;

  for (let col = 0; col < 3; col++) {
    const row = rows[col];
    const propIdx = col;

    // ── Line 1a: Physical address (rental) or description (royalty) ──
    fields.push({
      pdfFieldName: `${P1}.Table_Line1a[0].Row${row}[0].f1_${3 + col}[0]`,
      formLabel: `Line 1a: Physical address — Property ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'string',
      transform: (tr) => {
        const rental = tr.rentalProperties?.[propIdx];
        if (rental) return rental.address;
        const royIdx = propIdx - (tr.rentalProperties || []).length;
        return royIdx >= 0 ? tr.royaltyProperties?.[royIdx]?.description : undefined;
      },
    });

    // ── Line 1b: Type of property (IRS code 1-8; royalties = 6) ──
    fields.push({
      pdfFieldName: `${P1}.Table_Line1b[0].Row${row}[0].f1_${6 + col}[0]`,
      formLabel: `Line 1b: Type of property — Property ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'string',
      transform: (tr) => {
        const p = tr.rentalProperties?.[propIdx];
        if (p) return propertyTypeCode(p.propertyType);
        const royIdx = propIdx - (tr.rentalProperties || []).length;
        return royIdx >= 0 && tr.royaltyProperties?.[royIdx] ? '6' : undefined;
      },
    });

    // ── Line 2: Fair rental days ──
    fields.push({
      pdfFieldName: `${P1}.Table_Line2[0].Row${row}[0].f1_${9 + col * 2}[0]`,
      formLabel: `Line 2: Fair rental days — Property ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'integer',
      transform: (tr) => {
        const d = tr.rentalProperties?.[propIdx]?.daysRented;
        return d ? String(d) : undefined;
      },
    });

    // ── Line 2: Personal use days ──
    fields.push({
      pdfFieldName: `${P1}.Table_Line2[0].Row${row}[0].f1_${10 + col * 2}[0]`,
      formLabel: `Line 2: Personal use days — Property ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'integer',
      transform: (tr) => {
        const d = tr.rentalProperties?.[propIdx]?.personalUseDays;
        return d ? String(d) : undefined;
      },
    });

    // ── Line 3: Rents received ──
    fields.push({
      pdfFieldName: `${P1}.Table_Income[0].Line3[0].f1_${16 + col}[0]`,
      formLabel: `Line 3: Rents received — Property ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'dollarNoCents',
      transform: (tr) => fmtDollar(tr.rentalProperties?.[propIdx]?.rentalIncome),
    });

    // ── Line 4: Royalties received (per-property) ──
    // Royalty properties are placed in columns after rental properties.
    fields.push({
      pdfFieldName: `${P1}.Table_Income[0].Line4[0].f1_${19 + col}[0]`,
      formLabel: `Line 4: Royalties received — Property ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'dollarNoCents',
      transform: (tr) => {
        const royIdx = propIdx - (tr.rentalProperties || []).length;
        return royIdx >= 0 ? fmtDollar(tr.royaltyProperties?.[royIdx]?.royaltyIncome) : undefined;
      },
    });

    // ── Lines 5-18: Expenses ──
    for (let lineIdx = 0; lineIdx < EXPENSE_LINES.length; lineIdx++) {
      const { irsLine, prop, label } = EXPENSE_LINES[lineIdx];
      const fieldNum = 22 + lineIdx * 3 + col;
      fields.push({
        pdfFieldName: `${P1}.Table_Expenses[0].Line${irsLine}[0].f1_${fieldNum}[0]`,
        formLabel: `Line ${irsLine}: ${label} — Property ${row}`,
        sourcePath: '',
        source: 'taxReturn',
        format: 'dollarNoCents',
        transform: (tr) => {
          const rental = tr.rentalProperties?.[propIdx];
          if (rental) return fmtDollar(rental[prop] as number | undefined);
          const royIdx = propIdx - (tr.rentalProperties || []).length;
          const royalty = tr.royaltyProperties?.[royIdx];
          return royalty ? fmtDollar((royalty as any)[prop] as number | undefined) : undefined;
        },
      });
    }

    // ── Line 19: Other expenses (amount column) ──
    // f1_64 = description label, f1_65/66/67 = amounts for A/B/C
    fields.push({
      pdfFieldName: `${P1}.Table_Expenses[0].Line19[0].f1_${65 + col}[0]`,
      formLabel: `Line 19: Other expenses — Property ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'dollarNoCents',
      transform: (tr) => {
        const rental = tr.rentalProperties?.[propIdx];
        if (rental) return fmtDollar(rental.otherExpenses);
        const royIdx = propIdx - (tr.rentalProperties || []).length;
        return fmtDollar(tr.royaltyProperties?.[royIdx]?.otherExpenses);
      },
    });

    // ── Line 20: Total expenses ──
    fields.push({
      pdfFieldName: `${P1}.Table_Expenses[0].Line20[0].f1_${68 + col}[0]`,
      formLabel: `Line 20: Total expenses — Property ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'dollarNoCents',
      transform: (tr) => {
        const p = tr.rentalProperties?.[propIdx];
        return p ? fmtDollar(sumExpenses(p)) : undefined;
      },
    });

    // ── Line 21: Net income or (loss) per property ──
    // = Line 3 (rents) - Line 20 (total expenses)
    fields.push({
      pdfFieldName: `${P1}.Table_Expenses[0].Line21[0].f1_${71 + col}[0]`,
      formLabel: `Line 21: Net income or (loss) — Property ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'dollarNoCents',
      transform: (tr) => {
        const p = tr.rentalProperties?.[propIdx];
        if (!p) return undefined;
        const net = (p.rentalIncome || 0) - sumExpenses(p);
        return net !== 0 ? Math.round(net).toString() : undefined;
      },
    });

    // ── Line 22: Deductible rental real estate loss after limitation ──
    // For simplicity, we set this equal to Line 21 when it's a loss.
    // The passive loss limitation is applied at the aggregate level by the engine.
    fields.push({
      pdfFieldName: `${P1}.Table_Expenses[0].Line22[0].f1_${74 + col}[0]`,
      formLabel: `Line 22: Deductible rental real estate loss — Property ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'dollarNoCents',
      transform: (tr) => {
        const p = tr.rentalProperties?.[propIdx];
        if (!p) return undefined;
        const net = (p.rentalIncome || 0) - sumExpenses(p);
        // Only show loss amounts (negative values)
        return net < 0 ? Math.round(net).toString() : undefined;
      },
    });
  }

  return fields;
}

// ─── Field Mappings ──────────────────────────────────────────────

export const SCHEDULE_E_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════

  // Name(s) shown on return
  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name(s) shown on return',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      if (tr.spouseFirstName && tr.spouseLastName) {
        parts.push('&', tr.spouseFirstName, tr.spouseLastName);
      }
      return parts.join(' ') || undefined;
    },
  },
  // Social security number
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ══════════════════════════════════════════════════════════════
  // Per-Property Fields (A/B/C) — Lines 1a through 22
  // ══════════════════════════════════════════════════════════════
  ...generatePropertyFields(),

  // ══════════════════════════════════════════════════════════════
  // Summary Lines 23-26 (Page 1 bottom)
  // ══════════════════════════════════════════════════════════════

  // Line 23a: Total rents received (sum of Line 3 across all properties)
  {
    pdfFieldName: `${P1}.f1_77[0]`,
    formLabel: 'Line 23a: Total rents received',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const income = calc.scheduleE?.totalRentalIncome ?? 0;
      return income > 0 ? fmtDollar(income) : undefined;
    },
  },
  // Line 23b: Total royalties received
  {
    pdfFieldName: `${P1}.f1_78[0]`,
    formLabel: 'Line 23b: Total royalties received',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleE?.royaltyIncome),
  },
  // Line 23c: Total expenses (sum of Line 20 across all properties)
  {
    pdfFieldName: `${P1}.f1_79[0]`,
    formLabel: 'Line 23c: Total expenses',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleE?.totalRentalExpenses),
  },
  // Line 23d: Net income/loss (sum of Line 21 across all properties, before passive loss)
  {
    pdfFieldName: `${P1}.f1_80[0]`,
    formLabel: 'Line 23d: Net income or (loss)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const net = calc.scheduleE?.netRentalIncome ?? 0;
      return net !== 0 ? Math.round(net).toString() : undefined;
    },
  },
  // Line 23e: Total deductible loss after limitation
  {
    pdfFieldName: `${P1}.f1_81[0]`,
    formLabel: 'Line 23e: Deductible rental real estate loss',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const loss = calc.scheduleE?.allowableLoss ?? 0;
      return loss > 0 ? `-${Math.round(loss)}` : undefined;
    },
  },
  // Line 24: Income (positive portion of net rental + royalty)
  {
    pdfFieldName: `${P1}.f1_82[0]`,
    formLabel: 'Line 24: Income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const income = calc.scheduleE?.scheduleEIncome ?? 0;
      return income > 0 ? fmtDollar(income) : undefined;
    },
  },
  // Line 25: Losses (absolute value)
  {
    pdfFieldName: `${P1}.f1_83[0]`,
    formLabel: 'Line 25: Losses',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const income = calc.scheduleE?.scheduleEIncome ?? 0;
      return income < 0 ? Math.round(Math.abs(income)).toString() : undefined;
    },
  },
  // Line 26: Total rental real estate and royalty income or (loss)
  // This is the amount that flows to Schedule 1, line 5
  {
    pdfFieldName: `${P1}.f1_84[0]`,
    formLabel: 'Line 26: Total rental real estate and royalty income or (loss)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const total = calc.scheduleE?.scheduleEIncome ?? 0;
      return total !== 0 ? Math.round(total).toString() : undefined;
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Page 2 — Header continuation
  // ══════════════════════════════════════════════════════════════

  // Name(s) continuation
  {
    pdfFieldName: `${P2}.f2_1[0]`,
    formLabel: 'Name(s) shown on return (page 2)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      if (tr.spouseFirstName && tr.spouseLastName) {
        parts.push('&', tr.spouseFirstName, tr.spouseLastName);
      }
      return parts.join(' ') || undefined;
    },
  },
  // SSN continuation
  {
    pdfFieldName: `${P2}.f2_2[0]`,
    formLabel: 'Social security number (page 2)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ══════════════════════════════════════════════════════════════
  // Part II — Partnerships and S Corporations (Lines 28-32)
  // Up to 4 entities (Rows A-D) from incomeK1[]
  // ══════════════════════════════════════════════════════════════

  // We map K-1 entities that are partnerships or S-corps.
  // Row A-D entity info (Table_Line28a-f)
  ...generateK1EntityFields(),

  // Row A-D income/loss (Table_Line28g-k)
  ...generateK1IncomeFields(),
];

// ─── K-1 Entity Info Generator ───────────────────────────────────

function generateK1EntityFields(): IRSFieldMapping[] {
  const fields: IRSFieldMapping[] = [];
  const rows = ['A', 'B', 'C', 'D'] as const;

  // Field number offsets per row in Table_Line28a-f:
  // RowA: f2_3 (name), f2_4 (type P/S), f2_5 (EIN)
  // RowB: f2_6, f2_7, f2_8
  // RowC: f2_9, f2_10, f2_11
  // RowD: f2_12, f2_13, f2_14
  const nameFields = [3, 6, 9, 12];
  const typeFields = [4, 7, 10, 13];
  const einFields = [5, 8, 11, 14];

  for (let i = 0; i < 4; i++) {
    const row = rows[i];
    const k1Idx = i;

    // Filter K-1s to partnership/S-corp only
    const getK1 = (tr: TaxReturn) => {
      const k1s = (tr.incomeK1 || []).filter(
        k => k.entityType === 'partnership' || k.entityType === 's_corp',
      );
      return k1s[k1Idx];
    };

    // 28a: Entity name
    fields.push({
      pdfFieldName: `${P2}.Table_Line28a-f[0].Row${row}[0].f2_${nameFields[i]}[0]`,
      formLabel: `Line 28a: Entity name — Row ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'string',
      transform: (tr) => getK1(tr)?.entityName,
    });

    // 28b: Type (P for partnership, S for S corporation)
    fields.push({
      pdfFieldName: `${P2}.Table_Line28a-f[0].Row${row}[0].f2_${typeFields[i]}[0]`,
      formLabel: `Line 28b: Entity type (P or S) — Row ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'string',
      transform: (tr) => {
        const k1 = getK1(tr);
        if (!k1) return undefined;
        return k1.entityType === 'partnership' ? 'P' : 'S';
      },
    });

    // 28d: Employer identification number
    fields.push({
      pdfFieldName: `${P2}.Table_Line28a-f[0].Row${row}[0].f2_${einFields[i]}[0]`,
      formLabel: `Line 28d: Employer ID number (EIN) — Row ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'string',
      transform: (tr) => getK1(tr)?.entityEin,
    });
  }

  return fields;
}

// ─── K-1 Income/Loss Generator ───────────────────────────────────

function generateK1IncomeFields(): IRSFieldMapping[] {
  const fields: IRSFieldMapping[] = [];
  const rows = ['A', 'B', 'C', 'D'] as const;

  // Table_Line28g-k: 5 columns per row
  // RowA: f2_15 (g: passive deduction), f2_16 (h: passive income),
  //       f2_17 (i: nonpassive deduction), f2_18 (j: nonpassive income), f2_19 (k: sec 179)
  // RowB: f2_20..f2_24
  // RowC: f2_25..f2_29
  // RowD: f2_30..f2_34
  const baseFields = [15, 20, 25, 30]; // Starting field number per row

  for (let i = 0; i < 4; i++) {
    const row = rows[i];
    const base = baseFields[i];
    const k1Idx = i;

    const getK1 = (tr: TaxReturn) => {
      const k1s = (tr.incomeK1 || []).filter(
        k => k.entityType === 'partnership' || k.entityType === 's_corp',
      );
      return k1s[k1Idx];
    };

    // Column g: Passive deduction (loss)
    // Rental income from K-1 that is negative = passive loss
    fields.push({
      pdfFieldName: `${P2}.Table_Line28g-k[0].Row${row}[0].f2_${base}[0]`,
      formLabel: `Line 28g: Passive deduction (loss) — Row ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'dollarNoCents',
      transform: (tr) => {
        const k1 = getK1(tr);
        if (!k1) return undefined;
        const rental = k1.rentalIncome ?? 0;
        return rental < 0 ? fmtDollar(Math.abs(rental)) : undefined;
      },
    });

    // Column h: Passive income
    fields.push({
      pdfFieldName: `${P2}.Table_Line28g-k[0].Row${row}[0].f2_${base + 1}[0]`,
      formLabel: `Line 28h: Passive income — Row ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'dollarNoCents',
      transform: (tr) => {
        const k1 = getK1(tr);
        if (!k1) return undefined;
        const rental = k1.rentalIncome ?? 0;
        return rental > 0 ? fmtDollar(rental) : undefined;
      },
    });

    // Column i: Nonpassive deduction (loss)
    // Ordinary business income that is negative
    fields.push({
      pdfFieldName: `${P2}.Table_Line28g-k[0].Row${row}[0].f2_${base + 2}[0]`,
      formLabel: `Line 28i: Nonpassive deduction (loss) — Row ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'dollarNoCents',
      transform: (tr) => {
        const k1 = getK1(tr);
        if (!k1) return undefined;
        const biz = k1.ordinaryBusinessIncome ?? 0;
        return biz < 0 ? fmtDollar(Math.abs(biz)) : undefined;
      },
    });

    // Column j: Nonpassive income
    fields.push({
      pdfFieldName: `${P2}.Table_Line28g-k[0].Row${row}[0].f2_${base + 3}[0]`,
      formLabel: `Line 28j: Nonpassive income — Row ${row}`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'dollarNoCents',
      transform: (tr) => {
        const k1 = getK1(tr);
        if (!k1) return undefined;
        const biz = (k1.ordinaryBusinessIncome ?? 0) + (k1.guaranteedPayments ?? 0);
        return biz > 0 ? fmtDollar(biz) : undefined;
      },
    });

    // Column k: Section 179 deduction (not tracked in current engine — skip)
  }

  return fields;
}

// ─── Template Definition ─────────────────────────────────────────

export const SCHEDULE_E_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040se',
  displayName: 'Schedule E',
  attachmentSequence: 13,
  pdfFileName: 'f1040se.pdf',
  condition: (tr, calc) => {
    const hasRentalProps = (tr.rentalProperties?.length ?? 0) > 0;
    const hasK1PassThrough = (tr.incomeK1 || []).some(
      k => (k.entityType === 'partnership' || k.entityType === 's_corp') &&
           ((k.ordinaryBusinessIncome ?? 0) !== 0 ||
            (k.rentalIncome ?? 0) !== 0 ||
            (k.guaranteedPayments ?? 0) !== 0),
    );
    const hasScheduleEIncome = (calc.scheduleE?.scheduleEIncome ?? 0) !== 0;
    return hasRentalProps || hasK1PassThrough || hasScheduleEIncome;
  },
  fields: SCHEDULE_E_FIELDS,
};
