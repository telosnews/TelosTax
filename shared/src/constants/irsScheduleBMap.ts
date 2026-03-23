/**
 * IRS Schedule B (2025) — AcroForm Field Mapping
 *
 * Interest and Ordinary Dividends
 * PDF: client/public/irs-forms/f1040sb.pdf (Schedule B, 2025)
 * Attachment Sequence No. 08
 * Total fields: 66 text + 6 checkboxes
 *
 * Field prefix: topmostSubform[0].Page1[0]
 *
 * Layout:
 *   f1_01 = Name(s) shown on return
 *   f1_02 = Your social security number
 *
 *   Part I — Interest (14 payer rows):
 *   f1_03/f1_04 through f1_29/f1_30 = payer name / amount pairs
 *   f1_31 = Line 2: Total of line 1
 *   f1_32 = Line 3: Excludable interest on EE/I bonds (Form 8815)
 *   f1_33 = Line 4: Line 2 minus Line 3 → Form 1040 Line 2b
 *
 *   Part II — Ordinary Dividends (15 payer rows):
 *   f1_34/f1_35 through f1_62/f1_63 = payer name / amount pairs
 *   f1_64 = Line 6: Total → Form 1040 Line 3b
 *
 *   Part III — Foreign Accounts and Trusts:
 *   c1_1[0]/c1_1[1] = Line 7a: Foreign account Yes/No
 *   c1_2[0]/c1_2[1] = Line 7a follow-up: Required to file FBAR Yes/No
 *   f1_65/f1_66     = Line 7b: Country name(s) (two lines)
 *   c1_3[0]/c1_3[1] = Line 8: Foreign trust Yes/No
 *
 * Note: f1_03 lives inside Line1_ReadOrder[0], f1_34 inside ReadOrderControl[0],
 *       c1_1 inside TagcorrectingSubform[0]. All others directly under Page1[0].
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';

// ── Row counts in the PDF ──────────────────────────────────────
const INTEREST_ROWS = 14;   // Part I: 14 payer rows
const DIVIDEND_ROWS = 15;   // Part II: 15 payer rows

// ── Payer collection ───────────────────────────────────────────

interface PayerEntry { name: string; amount: number }

function getInterestPayers(tr: TaxReturn): PayerEntry[] {
  const payers: PayerEntry[] = [];

  // 1099-INT entries (Box 1)
  for (const item of tr.income1099INT || []) {
    if ((item.amount || 0) > 0) {
      payers.push({ name: item.payerName || 'Unknown Payer', amount: item.amount || 0 });
    }
  }

  // K-1 entries with interest income (Box 5)
  for (const k1 of tr.incomeK1 || []) {
    if ((k1.interestIncome || 0) > 0) {
      payers.push({ name: k1.entityName || 'K-1 Entity', amount: k1.interestIncome! });
    }
  }

  return payers;
}

function getDividendPayers(tr: TaxReturn): PayerEntry[] {
  const payers: PayerEntry[] = [];

  // 1099-DIV entries (Box 1a)
  for (const item of tr.income1099DIV || []) {
    if ((item.ordinaryDividends || 0) > 0) {
      payers.push({ name: item.payerName || 'Unknown Payer', amount: item.ordinaryDividends || 0 });
    }
  }

  // K-1 entries with ordinary dividends (Box 6a)
  for (const k1 of tr.incomeK1 || []) {
    if ((k1.ordinaryDividends || 0) > 0) {
      payers.push({ name: k1.entityName || 'K-1 Entity', amount: k1.ordinaryDividends! });
    }
  }

  return payers;
}

/**
 * Fit payers into available rows with overflow aggregation.
 * If count exceeds rows: top N-1 payers by amount, last row = "Various — see statement".
 */
function fitPayers(payers: PayerEntry[], maxRows: number): PayerEntry[] {
  if (payers.length <= maxRows) return payers;

  // Sort descending by amount so largest payers get individual rows
  const sorted = [...payers].sort((a, b) => b.amount - a.amount);
  const kept = sorted.slice(0, maxRows - 1);
  const overflow = sorted.slice(maxRows - 1);
  const overflowTotal = overflow.reduce((sum, p) => sum + p.amount, 0);
  kept.push({ name: 'Various — see statement', amount: overflowTotal });
  return kept;
}

// ── PDF field name helpers ─────────────────────────────────────

/** Interest payer name field — f1_03 has a special wrapper path */
function interestNameField(rowIndex: number): string {
  const fieldNum = String(3 + rowIndex * 2).padStart(2, '0');
  if (rowIndex === 0) {
    return `${P1}.Line1_ReadOrder[0].f1_${fieldNum}[0]`;
  }
  return `${P1}.f1_${fieldNum}[0]`;
}

/** Interest payer amount field */
function interestAmountField(rowIndex: number): string {
  const fieldNum = String(4 + rowIndex * 2).padStart(2, '0');
  return `${P1}.f1_${fieldNum}[0]`;
}

/** Dividend payer name field — f1_34 has a special wrapper path */
function dividendNameField(rowIndex: number): string {
  const fieldNum = String(34 + rowIndex * 2).padStart(2, '0');
  if (rowIndex === 0) {
    return `${P1}.ReadOrderControl[0].f1_${fieldNum}[0]`;
  }
  return `${P1}.f1_${fieldNum}[0]`;
}

/** Dividend payer amount field */
function dividendAmountField(rowIndex: number): string {
  const fieldNum = String(35 + rowIndex * 2).padStart(2, '0');
  return `${P1}.f1_${fieldNum}[0]`;
}

function fmt(n: number): string {
  return n === 0 ? '' : Math.round(n).toString();
}

// ── Build field mappings ───────────────────────────────────────

function buildFields(tr: TaxReturn, calc: CalculationResult): IRSFieldMapping[] {
  const fields: IRSFieldMapping[] = [];

  // ── Header ────────────────────────────────────────────────
  fields.push({
    pdfFieldName: `${P1}.f1_01[0]`,
    formLabel: 'Name(s) shown on return',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      if (tr.filingStatus === FilingStatus.MarriedFilingJointly) {
        const spouseParts = [tr.spouseFirstName, tr.spouseLastName].filter(Boolean);
        if (spouseParts.length > 0) {
          return `${parts.join(' ')} & ${spouseParts.join(' ')}`;
        }
      }
      return parts.join(' ');
    },
  });

  fields.push({
    pdfFieldName: `${P1}.f1_02[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  });

  // ── Part I — Interest payer rows ──────────────────────────
  const interestPayers = fitPayers(getInterestPayers(tr), INTEREST_ROWS);
  for (let i = 0; i < interestPayers.length; i++) {
    const payer = interestPayers[i];
    fields.push({
      pdfFieldName: interestNameField(i),
      formLabel: `Line 1: Interest payer name (row ${i + 1})`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => payer.name,
    });
    fields.push({
      pdfFieldName: interestAmountField(i),
      formLabel: `Line 1: Interest amount (row ${i + 1})`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmt(payer.amount),
    });
  }

  // Line 2: Total of line 1 — sum of displayed (rounded) payer amounts per IRS instructions
  const interestRowTotal = interestPayers.reduce((sum, p) => sum + Math.round(p.amount), 0);
  fields.push({
    pdfFieldName: `${P1}.f1_31[0]`,
    formLabel: 'Line 2: Add the amounts on line 1',
    sourcePath: '', source: 'calculationResult', format: 'string',
    transform: () => fmt(interestRowTotal),
  });

  // Line 3: Excludable interest on EE/I bonds (not currently supported — leave blank)

  // Line 4: Line 2 minus Line 3 → Form 1040 Line 2b
  fields.push({
    pdfFieldName: `${P1}.f1_33[0]`,
    formLabel: 'Line 4: Subtract line 3 from line 2 (to Form 1040, line 2b)',
    sourcePath: '', source: 'calculationResult', format: 'string',
    transform: () => fmt(interestRowTotal),
  });

  // ── Part II — Dividend payer rows ─────────────────────────
  const dividendPayers = fitPayers(getDividendPayers(tr), DIVIDEND_ROWS);
  for (let i = 0; i < dividendPayers.length; i++) {
    const payer = dividendPayers[i];
    fields.push({
      pdfFieldName: dividendNameField(i),
      formLabel: `Line 5: Dividend payer name (row ${i + 1})`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => payer.name,
    });
    fields.push({
      pdfFieldName: dividendAmountField(i),
      formLabel: `Line 5: Dividend amount (row ${i + 1})`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmt(payer.amount),
    });
  }

  // Line 6: Total → Form 1040 Line 3b — sum of displayed (rounded) payer amounts
  const dividendRowTotal = dividendPayers.reduce((sum, p) => sum + Math.round(p.amount), 0);
  fields.push({
    pdfFieldName: `${P1}.f1_64[0]`,
    formLabel: 'Line 6: Add the amounts on line 5 (to Form 1040, line 3b)',
    sourcePath: '', source: 'calculationResult', format: 'string',
    transform: () => fmt(dividendRowTotal),
  });

  // ── Part III — Foreign Accounts and Trusts ────────────────
  const partIII = tr.scheduleBPartIII;

  // Line 7a: Foreign account Yes/No
  fields.push({
    pdfFieldName: `${P1}.TagcorrectingSubform[0].c1_1[0]`,
    formLabel: 'Line 7a: Foreign account — Yes',
    sourcePath: '', source: 'taxReturn', format: 'checkbox',
    transform: () => partIII?.hasForeignAccounts === true,
  });
  fields.push({
    pdfFieldName: `${P1}.TagcorrectingSubform[0].c1_1[1]`,
    formLabel: 'Line 7a: Foreign account — No',
    sourcePath: '', source: 'taxReturn', format: 'checkbox',
    transform: () => partIII?.hasForeignAccounts === false,
  });

  // Line 7a follow-up: Required to file FinCEN Form 114 (FBAR) Yes/No
  fields.push({
    pdfFieldName: `${P1}.c1_2[0]`,
    formLabel: 'Line 7a: Required to file FinCEN Form 114 (FBAR) — Yes',
    sourcePath: '', source: 'taxReturn', format: 'checkbox',
    transform: () => partIII?.hasForeignAccounts === true && partIII?.requireFBAR === true,
  });
  fields.push({
    pdfFieldName: `${P1}.c1_2[1]`,
    formLabel: 'Line 7a: Required to file FinCEN Form 114 (FBAR) — No',
    sourcePath: '', source: 'taxReturn', format: 'checkbox',
    transform: () => partIII?.hasForeignAccounts === true && partIII?.requireFBAR === false,
  });

  // Line 7b: Country names (two text lines)
  const countries = partIII?.foreignAccountCountries || '';
  let countryLines: [string, string];
  if (countries.length <= 50) {
    countryLines = [countries, ''];
  } else {
    const splitIdx = countries.lastIndexOf(' ', 50);
    const breakAt = splitIdx > 0 ? splitIdx : 50;
    countryLines = [countries.slice(0, breakAt).trim(), countries.slice(breakAt).trim()];
  }
  fields.push({
    pdfFieldName: `${P1}.f1_65[0]`,
    formLabel: 'Line 7b: Foreign account country name(s) (line 1)',
    sourcePath: '', source: 'taxReturn', format: 'string',
    transform: () => countryLines[0],
  });
  fields.push({
    pdfFieldName: `${P1}.f1_66[0]`,
    formLabel: 'Line 7b: Foreign account country name(s) (line 2)',
    sourcePath: '', source: 'taxReturn', format: 'string',
    transform: () => countryLines[1],
  });

  // Line 8: Foreign trust Yes/No
  fields.push({
    pdfFieldName: `${P1}.c1_3[0]`,
    formLabel: 'Line 8: Received distribution from foreign trust — Yes',
    sourcePath: '', source: 'taxReturn', format: 'checkbox',
    transform: () => partIII?.hasForeignTrust === true,
  });
  fields.push({
    pdfFieldName: `${P1}.c1_3[1]`,
    formLabel: 'Line 8: Received distribution from foreign trust — No',
    sourcePath: '', source: 'taxReturn', format: 'checkbox',
    transform: () => partIII?.hasForeignTrust === false,
  });

  return fields;
}

// ── Condition ──────────────────────────────────────────────────

const condition = (tr: TaxReturn, calc: CalculationResult): boolean => {
  const interest = calc.form1040.totalInterest || 0;
  const dividends = calc.form1040.totalDividends || 0;
  const partIII = tr.scheduleBPartIII;
  return (
    interest > 1500 ||
    dividends > 1500 ||
    partIII?.hasForeignAccounts === true ||
    partIII?.hasForeignTrust === true
  );
};

// ── Template export ────────────────────────────────────────────

export const SCHEDULE_B_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040sb',
  displayName: 'Schedule B (Interest and Ordinary Dividends)',
  attachmentSequence: 8,
  pdfFileName: 'f1040sb.pdf',
  condition,
  // Fields are computed dynamically from payer data; use fieldsForInstance
  fields: [],
  instanceCount: () => 1,
  fieldsForInstance: (_, tr, calc) => buildFields(tr, calc),
};
