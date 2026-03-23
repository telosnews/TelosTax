/**
 * MA Form 1 — Massachusetts Resident Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 Form 1 fillable PDF.
 *
 * MA is a flat-tax state with a 5.0% rate on Part A income.
 * Additional rates apply: 8.5% short-term cap gains, 5% long-term, 12% collectibles.
 * 4% surtax on income over $1,083,150.
 *
 * PDF: client/public/state-forms/ma-1.pdf (115 fields)
 */
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const MA_1_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // INCOME LINES — Schedule B / Form 1 references
  // ═══════════════════════════════════════════════════════════════

  // Form 1 line 10: Total 5.0% income
  {
    pdfFieldName: '1 Enter your total 5.0% income from Form 1, line 10. Not less than 0. (Add back any Abandoned Building Renovation deduction claimed on Schedule(s) C and/or E before entering an amount in line 1.)',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const val = sr.stateAGI;
      return val > 0 ? Math.round(val).toString() : '0';
    },
  },

  // Line 7 of Massachusetts AGI Worksheet (total AGI)
  {
    pdfFieldName: '7 Add lines 3 through 6',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return Math.round(sr.stateAGI).toString();
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // SURTAX / MILLIONAIRES TAX WORKSHEET
  // ═══════════════════════════════════════════════════════════════

  // Surtax worksheet line 1: MA AGI
  {
    pdfFieldName: '1 Enter amount from line 7 of Massachusetts AGI Worksheet',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => Math.round(sr.stateAGI).toString(),
  },

  // Surtax worksheet line 2: Threshold ($8,000 single, $16,400 MFJ + $1,000/dep)
  {
    pdfFieldName: '2 Enter $8,000 if single. If married and filing a joint return, multiply the number of dependents (from Form 1, line 2b) by $1,000 and add $16,400 to that amount. If head of household, multiply the number of dependents (from Form 1, line 2b) by $1,000 and add $14,400 to that amount and enter the result here',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const deps = (tr.dependents || []).length;
      const fs = tr.filingStatus;
      if (fs === 2) return (16400 + deps * 1000).toString(); // MFJ
      if (fs === 4) return (14400 + deps * 1000).toString(); // HoH
      return '8000'; // Single/MFS
    },
  },

  // Surtax worksheet line 3: AGI minus threshold
  {
    pdfFieldName: '3  Subtract line 2 from line 1',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (tr, _calc, sr) => {
      const deps = (tr.dependents || []).length;
      const fs = tr.filingStatus;
      let threshold = 8000;
      if (fs === 2) threshold = 16400 + deps * 1000;
      else if (fs === 4) threshold = 14400 + deps * 1000;
      const result = sr.stateAGI - threshold;
      return result > 0 ? Math.round(result).toString() : '0';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TAX COMPUTATION LINES
  // ═══════════════════════════════════════════════════════════════

  // Form 1 line 32: Tax from computation
  {
    pdfFieldName: '1 Enter amount from Form 1, line 32',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Form 1 lines 38-47: Total credits
  {
    pdfFieldName: '2 Enter the total of Form 1, lines 38 hrough 40 and 43 through 47',
    sourcePath: 'stateCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 3: Tax minus credits
  {
    pdfFieldName: '3 Amount due. Subtract line 2 from line 1, not less than 0',
    sourcePath: 'stateTaxAfterCredits',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // SCHEDULE B — Interest/Dividend Income
  // ═══════════════════════════════════════════════════════════════

  // Schedule B line 35: Interest + dividend income
  {
    pdfFieldName: '1 Enter amount from Schedule B, line 35. Not less than 0',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const interest = (tr.income1099INT || []).reduce((s, i) => s + (i.amount || 0), 0);
      const divs = (tr.income1099DIV || []).reduce((s, d) => s + (d.ordinaryDividends || 0), 0);
      const total = interest + divs;
      return total > 0 ? Math.round(total).toString() : '0';
    },
  },

  // Schedule B line 35 (also used in another worksheet)
  {
    pdfFieldName: '5 Enter amount from Schedule B, line 35. If there is no entry in Schedule B, line 35 or if not filing Schedule B, enter the amount from Form 1, line 20',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const interest = (tr.income1099INT || []).reduce((s, i) => s + (i.amount || 0), 0);
      const divs = (tr.income1099DIV || []).reduce((s, d) => s + (d.ordinaryDividends || 0), 0);
      const total = interest + divs;
      return total > 0 ? Math.round(total).toString() : '0';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // SCHEDULE D — Capital Gains
  // ═══════════════════════════════════════════════════════════════

  // Schedule D short-term gains
  {
    pdfFieldName: '1 Gross short-term capital gains from U.S.  Schedule D, lines 1 through 5, column h',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const stcg = calc.scheduleD?.netShortTerm || 0;
      return stcg !== 0 ? Math.round(Math.abs(stcg)).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // SCHEDULE D — Collectibles (12% income)
  // ═══════════════════════════════════════════════════════════════

  // Schedule D collectibles 12% income
  {
    pdfFieldName: '1 Total taxable gains from Schedule B, line 39',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const ltcg = calc.scheduleD?.netLongTerm || 0;
      return ltcg > 0 ? Math.round(ltcg).toString() : '';
    },
  },

  // 8.5% income
  {
    pdfFieldName: '4 Subtract line 3 from line 1. Enter result here and on Form 1, line 23a, 8.5% Income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const stcg = calc.scheduleD?.netShortTerm || 0;
      return stcg > 0 ? Math.round(stcg).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // USE TAX
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: '1 Total of purchases in 2025 subject to Massachusetts use tax',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Not modeled
  },

  // ═══════════════════════════════════════════════════════════════
  // PFML WORKSHEET
  // ═══════════════════════════════════════════════════════════════

  // W-2 income for PFML
  {
    pdfFieldName: '1 Enter your income as shown on your  combined Form W-2s. If greater than $176,100, then enter $176,100',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const w2Total = (tr.w2Income || []).reduce((s, w) => s + (w.wages || 0), 0);
      return Math.min(w2Total, 176100) > 0 ? Math.round(Math.min(w2Total, 176100)).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // SCHEDULE C — Meals Deduction
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: '1 100% deductible meals schCl23ws',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Not modeled
  },

  // ═══════════════════════════════════════════════════════════════
  // FORM 1 LINE 18 — Exemption amount
  // ═══════════════════════════════════════════════════════════════

  {
    pdfFieldName: '2 Enter amount from Form 1, line 18',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      const exemptions = sr.stateExemptions;
      return exemptions > 0 ? Math.round(exemptions).toString() : '0';
    },
  },

  // Form 1 line 17: Total deductions
  {
    pdfFieldName: '3 Enter amount from Form 1, line 17',
    sourcePath: 'stateDeduction',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Combine
  {
    pdfFieldName: '5 Combine lines 1 and 4',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return Math.round(sr.stateTaxableIncome).toString();
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const MA_1_TEMPLATE: StateFormTemplate = {
  formId: 'ma-1',
  stateCode: 'MA',
  displayName: 'Form 1 Massachusetts Resident Income Tax Return',
  pdfFileName: 'ma-1.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'MA',
  fields: MA_1_FIELDS,
};
