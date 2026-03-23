/**
 * PA-40 Pennsylvania Income Tax Return — Field Mapping
 *
 * Maps TaxReturn, CalculationResult, and StateCalculationResult fields
 * to AcroForm field names in the official 2025 PA-40 fillable PDF.
 *
 * PA-40 AcroForm field names are human-readable strings (not nested XFA paths).
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from '../../types/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../../types/stateFormMappings.js';

// ─── Field Mappings ──────────────────────────────────────────────

export const PA_40_FIELDS: StateFieldMapping[] = [
  // ═══════════════════════════════════════════════════════════════
  // HEADER — Taxpayer Information
  // ═══════════════════════════════════════════════════════════════

  // SSN (shown first on return — typically the primary filer)
  {
    pdfFieldName: 'Enter SSN shown first without dashes or spaces',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.ssn || tr.ssnLastFour || '').replace(/-/g, ''),
  },

  // Taxpayer name
  {
    pdfFieldName: "Use all caps to enter taxpayer's first name",
    sourcePath: 'firstName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.firstName || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Use Cap For Your Middle Initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.middleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: "Use all caps to enter taxpayer's last name",
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.lastName || '').toUpperCase(),
  },

  // Spouse name (MFJ)
  {
    pdfFieldName: "Use all caps to enter spouse's first name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseFirstName || '').toUpperCase(),
  },
  {
    pdfFieldName: "Use Cap For Your Spouse's Middle Initial",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseMiddleInitial || '').toUpperCase(),
  },
  {
    pdfFieldName: "Use all caps to enter spouse's last name if different from above",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (!tr.spouseLastName || tr.spouseLastName === tr.lastName) return '';
      return tr.spouseLastName.toUpperCase();
    },
  },

  // Spouse SSN
  {
    pdfFieldName: 'Enter SSN of spouse without dashes or spaces',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.spouseSsn || tr.spouseSsnLastFour || '').replace(/-/g, ''),
  },

  // Address
  {
    pdfFieldName: 'Use all caps to enter First Line of Address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressStreet || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Use all caps to enter Second Line of Address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Apt/suite line not modeled separately
  },
  {
    pdfFieldName: 'Use all caps to enter City or Post Office',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressCity || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Use all caps to enter two character State abbreviation',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => (tr.addressState || '').toUpperCase(),
  },
  {
    pdfFieldName: 'Enter five digit Zip Code',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.addressZip || '',
  },
  {
    pdfFieldName: 'Enter Daytime Telephone Number without parenthesis, dashes or spaces',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '', // Phone not modeled in TaxReturn
  },

  // Occupation
  {
    pdfFieldName: 'Your Occupation',
    sourcePath: 'occupation',
    source: 'taxReturn',
    format: 'string',
  },
  {
    pdfFieldName: "Spouse's occupation",
    sourcePath: 'spouseOccupation',
    source: 'taxReturn',
    format: 'string',
  },

  // Page 2 header (SSN & name repeated)
  {
    pdfFieldName: 'Name(s)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      if (tr.spouseFirstName) {
        parts.push('&', tr.spouseFirstName, tr.spouseLastName || tr.lastName || '');
      }
      return parts.join(' ').toUpperCase();
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // FILING STATUS (checkbox — only one should be checked)
  // ═══════════════════════════════════════════════════════════════
  {
    pdfFieldName: 'Filing Status',
    sourcePath: 'filingStatus',
    source: 'taxReturn',
    format: 'checkbox',
    // PA-40 Filing Status checkbox is a single field with multiple values.
    // The exact behavior depends on the PDF widget. We check it for MFJ.
    checkWhen: (_, tr) => tr.filingStatus === 2, // MFJ
  },

  // ═══════════════════════════════════════════════════════════════
  // INCOME LINES (Lines 1–9)
  // ═══════════════════════════════════════════════════════════════

  // Line 1a: Gross Compensation (sum of W-2 wages for PA sources)
  {
    pdfFieldName: '1a. Gross Compensation',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const w2Total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return w2Total > 0 ? Math.round(w2Total).toString() : '';
    },
  },

  // Line 1b: Unreimbursed Employee Business Expenses (not modeled)
  {
    pdfFieldName: '1b. Unreimbursed Employee Business Expenses',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '', // Not implemented
  },

  // Line 1c: Net Compensation (Line 1a − Line 1b)
  {
    pdfFieldName: '1c. Net Compensation',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const w2Total = (tr.w2Income || []).reduce((sum, w) => sum + (w.wages || 0), 0);
      return w2Total > 0 ? Math.round(w2Total).toString() : '';
    },
  },

  // Line 2: Interest Income
  {
    pdfFieldName: '2. Interest Income',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = (tr.income1099INT || []).reduce((sum, i) => sum + (i.amount || 0), 0);
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // Line 3: Dividend and Capital Gains Distributions Income
  {
    pdfFieldName: '3. Dividend  and Capital Gains Distributions Income',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const divTotal = (tr.income1099DIV || []).reduce(
        (sum, d) => sum + (d.ordinaryDividends || 0), 0,
      );
      return divTotal > 0 ? Math.round(divTotal).toString() : '';
    },
  },

  // Line 4: Net Income or Loss from the Operation of a Business
  {
    pdfFieldName: '4. Net Income or Loss from the Operation of a Business, etc',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const bizIncome = calc.scheduleC?.netProfit || 0;
      if (bizIncome === 0) return '';
      return Math.round(Math.abs(bizIncome)).toString();
    },
  },
  // Line 4 loss checkbox
  {
    pdfFieldName: '4. Loss',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    checkWhen: (_, __, calc) => (calc.scheduleC?.netProfit || 0) < 0,
  },

  // Line 5: Net Gain or Loss from Sale of Property
  {
    pdfFieldName: '5. Net Gain or Loss from Sale, etc. of Property',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const gain = calc.scheduleD?.netGainOrLoss || 0;
      if (gain === 0) return '';
      return Math.round(Math.abs(gain)).toString();
    },
  },
  {
    pdfFieldName: '5. Loss',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    checkWhen: (_, __, calc) => (calc.scheduleD?.netGainOrLoss || 0) < 0,
  },

  // Line 6: Net Income or Loss from Rents, Royalties, Patents
  {
    pdfFieldName: '6. Net Income or Loss from Rents, etc',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const rentalIncome = calc.scheduleE?.totalRentalIncome || 0;
      if (rentalIncome === 0) return '';
      return Math.round(Math.abs(rentalIncome)).toString();
    },
  },
  {
    pdfFieldName: '6. Loss',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    checkWhen: (_, __, calc) => (calc.scheduleE?.totalRentalIncome || 0) < 0,
  },

  // Line 7: Estate or Trust Income (not modeled)
  {
    pdfFieldName: '7. Estate or Trust income',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: () => '',
  },

  // Line 8: Gambling and Lottery Winnings
  {
    pdfFieldName: '8. Gambling and Lottery Winnings',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const gambling = (tr.incomeW2G || []).reduce(
        (sum, w) => sum + (w.grossWinnings || 0), 0,
      );
      return gambling > 0 ? Math.round(gambling).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TOTALS & TAX (Lines 9–12)
  // ═══════════════════════════════════════════════════════════════

  // Line 9: Total PA Taxable Income
  {
    pdfFieldName: '9. Total PA Taxable Income',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 11: Adjusted PA Taxable Income (same as Line 9 minus Line 10 deductions)
  {
    pdfFieldName: '11. Adjusted PA Taxable Income',
    sourcePath: 'stateTaxableIncome',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 12: PA Tax Liability (Line 11 × 3.07%)
  {
    pdfFieldName: '12. PA Tax Liability. Multiply Line 11 by 3.07%',
    sourcePath: 'stateIncomeTax',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS & CREDITS (Lines 13–24)
  // ═══════════════════════════════════════════════════════════════

  // Line 13: Total PA Tax Withheld (from W-2 Box 17 for PA)
  {
    pdfFieldName: '13. Total PA Tax Withheld',
    sourcePath: 'stateWithholding',
    source: 'stateResult',
    format: 'dollarNoCents',
  },

  // Line 24: Total Payments and Credits
  {
    pdfFieldName: '24. Total Payments and Credits',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      // stateCredits are non-refundable (already factored into tax computation).
      const total = sr.stateWithholding + sr.stateEstimatedPayments;
      return total > 0 ? Math.round(total).toString() : '';
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TAX DUE / OVERPAYMENT (Lines 25–31)
  // ═══════════════════════════════════════════════════════════════

  // Line 26: Tax Due (if total tax > total payments)
  {
    pdfFieldName: '26. TAX DUE',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 28: Total Payment (same as line 26 + penalties)
  {
    pdfFieldName: '28. TOTAL PAYMENT',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (_tr, _calc, sr) => {
      return sr.stateRefundOrOwed < 0 ? Math.round(Math.abs(sr.stateRefundOrOwed)).toString() : '';
    },
  },

  // Line 29: Overpayment
  {
    pdfFieldName: '29. OVERPAYMENT',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (tr, calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Line 30: Refund (requesting overpayment as refund)
  {
    pdfFieldName: '30. Refund',
    sourcePath: '',
    source: 'stateResult',
    format: 'dollarNoCents',
    transform: (tr, calc, sr) => {
      return sr.stateRefundOrOwed > 0 ? Math.round(sr.stateRefundOrOwed).toString() : '';
    },
  },

  // Dependents count (for Tax Forgiveness section)
  {
    pdfFieldName: 'Dependents',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const count = (tr.dependents || []).length;
      return count > 0 ? count.toString() : '';
    },
  },
];

// ─── Template ────────────────────────────────────────────────────

export const PA_40_TEMPLATE: StateFormTemplate = {
  formId: 'pa-40',
  stateCode: 'PA',
  displayName: 'PA-40 Pennsylvania Income Tax Return',
  pdfFileName: 'pa-40.pdf',
  condition: (_tr, _calc, sr) => sr.stateCode === 'PA',
  fields: PA_40_FIELDS,
};
