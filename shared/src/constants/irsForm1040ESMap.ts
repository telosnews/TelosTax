/**
 * IRS Form 1040-ES (Estimated Tax Payment Vouchers) — Field Mapping
 *
 * Maps taxpayer data to the 4 payment voucher pages in the official IRS f1040es.pdf.
 * The PDF has 16 pages total; voucher fields live on pages 14 and 15 (0-indexed: 13, 14).
 *
 * Each voucher has 14 fields: amount, name (first+MI, last), SSN, spouse name,
 * spouse SSN, address, city, state, ZIP, foreign country/province/postal.
 *
 * @authority Form 1040-ES (2026) — Estimated Tax for Individuals
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';
import { assessEstimatedPaymentNeed } from '../engine/estimatedTaxVoucher.js';

// ── Helpers ─────────────────────────────────────────────────────

function firstName(tr: TaxReturn): string {
  const first = tr.firstName || '';
  const mi = tr.middleInitial ? ` ${tr.middleInitial}` : '';
  return `${first}${mi}`;
}

function spouseFirstName(tr: TaxReturn): string | undefined {
  if (tr.filingStatus !== FilingStatus.MarriedFilingJointly) return undefined;
  const first = tr.spouseFirstName || '';
  if (!first) return undefined;
  const mi = tr.spouseMiddleInitial ? ` ${tr.spouseMiddleInitial}` : '';
  return `${first}${mi}`;
}

function quarterlyAmountStr(tr: TaxReturn, calc: CalculationResult): string {
  const rec = assessEstimatedPaymentNeed(tr, calc);
  if (!rec.recommended || rec.quarterlyAmount <= 0) return '';
  return Math.round(rec.quarterlyAmount).toString();
}

// ── Per-voucher field builder ───────────────────────────────────

function voucherFields(
  voucherLabel: string,
  amountField: string,
  firstNameField: string,
  lastNameField: string,
  ssnField: string,
  spouseFirstField: string,
  spouseLastField: string,
  spouseSsnField: string,
  addressField: string,
  cityField: string,
  stateField: string,
  zipField: string,
): IRSFieldMapping[] {
  return [
    {
      pdfFieldName: amountField,
      formLabel: `${voucherLabel}: Amount of estimated tax payment`,
      sourcePath: '',
      source: 'calculationResult',
      format: 'dollarNoCents',
      transform: (tr, calc) => quarterlyAmountStr(tr, calc),
    },
    {
      pdfFieldName: firstNameField,
      formLabel: `${voucherLabel}: Your first name and middle initial`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'string',
      transform: (tr) => firstName(tr),
    },
    {
      pdfFieldName: lastNameField,
      formLabel: `${voucherLabel}: Your last name`,
      sourcePath: 'lastName',
      source: 'taxReturn',
      format: 'string',
    },
    {
      pdfFieldName: ssnField,
      formLabel: `${voucherLabel}: Your social security number`,
      sourcePath: 'ssn',
      source: 'taxReturn',
      format: 'ssn',
    },
    {
      pdfFieldName: spouseFirstField,
      formLabel: `${voucherLabel}: Spouse first name and middle initial`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'string',
      transform: (tr) => spouseFirstName(tr),
    },
    {
      pdfFieldName: spouseLastField,
      formLabel: `${voucherLabel}: Spouse last name`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'string',
      transform: (tr) => {
        if (tr.filingStatus !== FilingStatus.MarriedFilingJointly) return undefined;
        return tr.spouseLastName || undefined;
      },
    },
    {
      pdfFieldName: spouseSsnField,
      formLabel: `${voucherLabel}: Spouse social security number`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'ssn',
      transform: (tr) => {
        if (tr.filingStatus !== FilingStatus.MarriedFilingJointly) return undefined;
        return tr.spouseSsn || undefined;
      },
    },
    {
      pdfFieldName: addressField,
      formLabel: `${voucherLabel}: Home address`,
      sourcePath: '',
      source: 'taxReturn',
      format: 'string',
      transform: (tr) => tr.addressStreet || undefined,
    },
    {
      pdfFieldName: cityField,
      formLabel: `${voucherLabel}: City`,
      sourcePath: 'addressCity',
      source: 'taxReturn',
      format: 'string',
    },
    {
      pdfFieldName: stateField,
      formLabel: `${voucherLabel}: State`,
      sourcePath: 'addressState',
      source: 'taxReturn',
      format: 'string',
    },
    {
      pdfFieldName: zipField,
      formLabel: `${voucherLabel}: ZIP code`,
      sourcePath: 'addressZip',
      source: 'taxReturn',
      format: 'string',
    },
  ];
}

// ── Field mappings for all 4 vouchers ───────────────────────────

const P14 = 'topmostSubform[0].Page14[0]';
const P15 = 'topmostSubform[0].Page15[0]';

const ALL_VOUCHER_FIELDS: IRSFieldMapping[] = [
  // Voucher 4 — Page 14 (Due Jan. 15, 2027)
  ...voucherFields(
    'Voucher 4 (Jan 15)',
    `${P14}.f14_1[0]`,     // amount
    `${P14}.f14_2[0]`,     // first name + MI
    `${P14}.f14_3[0]`,     // last name
    `${P14}.f14_4[0]`,     // SSN
    `${P14}.f14_5[0]`,     // spouse first
    `${P14}.f14_6[0]`,     // spouse last
    `${P14}.f14_7[0]`,     // spouse SSN
    `${P14}.f14_8[0]`,     // address
    `${P14}.f14_9[0]`,     // city
    `${P14}.f14_10[0]`,    // state
    `${P14}.f14_11[0]`,    // zip
  ),

  // Voucher 3 — Page 15 top (Due Sept. 15, 2026)
  ...voucherFields(
    'Voucher 3 (Sep 15)',
    `${P15}.f15_1[0]`,
    `${P15}.f15_2[0]`,
    `${P15}.f15_3[0]`,
    `${P15}.f15_4[0]`,
    `${P15}.f15_5[0]`,
    `${P15}.f15_6[0]`,
    `${P15}.f15_7[0]`,
    `${P15}.f15_8[0]`,
    `${P15}.f15_9[0]`,
    `${P15}.f15_10[0]`,
    `${P15}.f15_11[0]`,
  ),

  // Voucher 2 — Page 15 middle (Due June 15, 2026)
  ...voucherFields(
    'Voucher 2 (Jun 15)',
    `${P15}.f15_15[0]`,
    `${P15}.f15_16[0]`,
    `${P15}.f15_17[0]`,
    `${P15}.f15_18[0]`,
    `${P15}.f15_19[0]`,
    `${P15}.f15_20[0]`,
    `${P15}.f15_21[0]`,
    `${P15}.f15_22[0]`,
    `${P15}.f15_23[0]`,
    `${P15}.f15_24[0]`,
    `${P15}.f15_25[0]`,
  ),

  // Voucher 1 — Page 15 bottom (Due April 15, 2026)
  ...voucherFields(
    'Voucher 1 (Apr 15)',
    `${P15}.f15_29[0]`,
    `${P15}.f15_30[0]`,
    `${P15}.f15_31[0]`,
    `${P15}.f15_32[0]`,
    `${P15}.f15_33[0]`,
    `${P15}.f15_34[0]`,
    `${P15}.f15_35[0]`,
    `${P15}.f15_36[0]`,
    `${P15}.f15_37[0]`,
    `${P15}.f15_38[0]`,
    `${P15}.f15_39[0]`,
  ),
];

// ── Template export ─────────────────────────────────────────────

export const FORM_1040_ES_TEMPLATE: IRSFormTemplate & {
  voucherPageIndices: number[];
} = {
  formId: 'f1040es',
  displayName: 'Form 1040-ES (Estimated Tax Vouchers)',
  pdfFileName: 'f1040es.pdf',
  attachmentSequence: 9999, // Not part of filing sequence
  voucherPageIndices: [13, 14], // 0-indexed: pages with voucher forms
  condition: (tr, calc) => assessEstimatedPaymentNeed(tr, calc).recommended,
  fields: ALL_VOUCHER_FIELDS,
};
