/**
 * IRS Form 4868 (2025) — AcroForm Field Mapping
 *
 * Application for Automatic Extension of Time to File
 * U.S. Individual Income Tax Return
 * PDF: client/public/irs-forms/f4868.pdf
 *
 * Total fields: 17 (text: 15, checkbox: 2)
 *
 * VoucherHeader (payment voucher at bottom of page):
 *   f1_1 = Name(s)
 *   f1_2 = Address (street + city)
 *   f1_3 = State abbreviation (maxLen 2)
 *
 * PartI_ReadOrder (main form identification):
 *   f1_4  = Name(s) shown on return
 *   f1_5  = Address (number, street, apartment)
 *   f1_6  = City, town, or post office
 *   f1_7  = State (maxLen 2)
 *   f1_8  = ZIP code (maxLen 10)
 *   f1_9  = Your SSN (maxLen 11, format XXX-XX-XXXX)
 *   f1_10 = Spouse's SSN (maxLen 11)
 *
 * Dollar lines (standalone on Page1):
 *   f1_11 = Line 4: Estimate of total tax liability
 *   f1_12 = Line 5: Total payments
 *   f1_13 = Line 6: Balance due (line 4 − line 5)
 *   f1_14 = Line 7: Amount you're paying
 *
 * Checkboxes:
 *   c1_1 = Line 8: Out of the country
 *   c1_2 = Line 9: Filing Form 1040-NR
 *
 * Page 3:
 *   f3_1 = Part II individual info (not used)
 *
 * Note: Filing status checkboxes do not exist as fillable AcroForm
 * fields in this PDF version. Only 2 checkboxes are present (Lines 8/9).
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const VH = `${P1}.VoucherHeader[0]`;
const PI = `${P1}.PartI_ReadOrder[0]`;

// ── Helpers ─────────────────────────────────────────────────────

function buildName(tr: TaxReturn): string | undefined {
  const first = tr.firstName || '';
  const last = tr.lastName || '';
  const primary = `${first} ${last}`.trim();
  if (!primary) return undefined;

  if (
    tr.filingStatus === FilingStatus.MarriedFilingJointly &&
    (tr.spouseFirstName || tr.spouseLastName)
  ) {
    const spouse = `${tr.spouseFirstName || ''} ${tr.spouseLastName || ''}`.trim();
    return spouse ? `${primary} & ${spouse}` : primary;
  }
  return primary;
}

function formatSSN(ssn: string | undefined): string {
  if (!ssn) return '';
  const digits = ssn.replace(/\D/g, '');
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  return ssn;
}

// ── Field Mappings ──────────────────────────────────────────────

export const FORM_4868_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Part I — Identification (main form)
  // ══════════════════════════════════════════════════════════════

  // Name(s) shown on return
  {
    pdfFieldName: `${PI}.f1_4[0]`,
    formLabel: 'Name(s) shown on return',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => buildName(tr),
  },
  // Address (number, street, apartment)
  {
    pdfFieldName: `${PI}.f1_5[0]`,
    formLabel: 'Home address (number, street, apartment)',
    sourcePath: 'addressStreet',
    source: 'taxReturn',
    format: 'string',
  },
  // City, town, or post office
  {
    pdfFieldName: `${PI}.f1_6[0]`,
    formLabel: 'City, town, or post office',
    sourcePath: 'addressCity',
    source: 'taxReturn',
    format: 'string',
  },
  // State (2-letter abbreviation)
  {
    pdfFieldName: `${PI}.f1_7[0]`,
    formLabel: 'State',
    sourcePath: 'addressState',
    source: 'taxReturn',
    format: 'string',
  },
  // ZIP code
  {
    pdfFieldName: `${PI}.f1_8[0]`,
    formLabel: 'ZIP code',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },
  // Your SSN
  {
    pdfFieldName: `${PI}.f1_9[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => formatSSN(tr.ssn) || tr.ssnLastFour || '',
  },
  // Spouse's SSN (MFJ only)
  {
    pdfFieldName: `${PI}.f1_10[0]`,
    formLabel: "Spouse's social security number",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (tr.filingStatus !== FilingStatus.MarriedFilingJointly) return '';
      return formatSSN(tr.spouseSsn) || tr.spouseSsnLastFour || '';
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Lines 4–7 — Tax Estimates
  // ══════════════════════════════════════════════════════════════

  // Line 4: Estimate of total tax liability for 2025
  // Uses totalTax minus estimatedTaxPenalty (penalty wouldn't exist at extension time)
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 4: Estimate of total tax liability',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const totalTax = calc.form1040.totalTax || 0;
      const penalty = calc.form1040.estimatedTaxPenalty || 0;
      const estimated = Math.max(0, totalTax - penalty);
      return estimated > 0 ? Math.round(estimated).toString() : '';
    },
  },
  // Line 5: Total payments
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 5: Total payments',
    sourcePath: 'form1040.totalPayments',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 6: Balance due (line 4 − line 5, minimum 0)
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 6: Balance due',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const totalTax = calc.form1040.totalTax || 0;
      const penalty = calc.form1040.estimatedTaxPenalty || 0;
      const estimated = Math.max(0, totalTax - penalty);
      const payments = calc.form1040.totalPayments || 0;
      const balance = Math.max(0, estimated - payments);
      return balance > 0 ? Math.round(balance).toString() : '';
    },
  },
  // Line 7: Amount you're paying (always blank — no payment integration)
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    formLabel: 'Line 7: Amount you are paying',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '',
  },

  // ══════════════════════════════════════════════════════════════
  // Lines 8–9 — Checkboxes (always unchecked)
  // ══════════════════════════════════════════════════════════════

  // Line 8: Out of the country
  {
    pdfFieldName: `${P1}.c1_1[0]`,
    formLabel: 'Line 8: Out of the country',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false,
  },
  // Line 9: Filing Form 1040-NR
  {
    pdfFieldName: `${P1}.c1_2[0]`,
    formLabel: 'Line 9: Filing Form 1040-NR',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false,
  },

  // ══════════════════════════════════════════════════════════════
  // Payment Voucher (bottom of page — duplicates identification)
  // ══════════════════════════════════════════════════════════════

  // Name(s) on voucher
  {
    pdfFieldName: `${VH}.f1_1[0]`,
    formLabel: 'Payment voucher: Name(s)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => buildName(tr),
  },
  // Address on voucher
  {
    pdfFieldName: `${VH}.f1_2[0]`,
    formLabel: 'Payment voucher: Address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [
        tr.addressStreet,
        [tr.addressCity, tr.addressState, tr.addressZip].filter(Boolean).join(', '),
      ].filter(Boolean);
      return parts.join(', ') || undefined;
    },
  },
  // State on voucher
  {
    pdfFieldName: `${VH}.f1_3[0]`,
    formLabel: 'Payment voucher: State',
    sourcePath: 'addressState',
    source: 'taxReturn',
    format: 'string',
  },
];

// ── Template Export ──────────────────────────────────────────────

export const FORM_4868_TEMPLATE: IRSFormTemplate = {
  formId: 'f4868',
  displayName: 'Form 4868 (Automatic Extension)',
  pdfFileName: 'f4868.pdf',
  attachmentSequence: 9999, // Not part of filing sequence — standalone form
  condition: () => false, // Never auto-included in return packet
  fields: FORM_4868_FIELDS,
};
