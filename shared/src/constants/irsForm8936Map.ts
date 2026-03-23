/**
 * IRS Form 8936 (2025) — AcroForm Field Mapping
 *
 * Clean Vehicle Credits
 * PDF: client/public/irs-forms/f8936.pdf (Form 8936, 2025)
 * Attachment Sequence No. 13a
 * Total fields: 31 (all text)
 *
 * Field prefix: topmostSubform[0].Page1[0]
 *
 * Page 1 field map:
 *   f1_1  = Name(s) shown on return
 *   f1_2  = Your identifying number (SSN)
 *   f1_3  = Line 1a: Year, make, model of vehicle (via Line1a_ReadOrder)
 *   f1_4  = Line 1b: Vehicle identification number (VIN)
 *   f1_5  = Line 1c: Date vehicle was placed in service
 *   f1_6  = Line 2a: Is this a new vehicle? (Yes/No text)
 *   f1_7  = Line 2b: Cost or other basis
 *   f1_8  = Line 2c: MSRP (if new)
 *   f1_9  = Line 3a: Is this a previously owned vehicle? (via Line3a_ReadOrder)
 *   f1_10 = Line 3b: Purchase price (if used)
 *   f1_11 = Line 4: Tentative credit amount
 *   f1_12 = Line 5: Business/investment use percentage
 *   f1_13 = Line 6: Business/investment use credit
 *   f1_14 = Line 7: Section 179 deduction
 *   f1_15 = Line 8: Personal use credit
 *   f1_16-f1_17 = Lines 9-10: Multiple vehicle adjustments
 *   f1_18 = Line 11: Total new clean vehicle credit
 *   f1_19-f1_22 = Lines 12-15: Previously owned vehicle credit
 *   f1_23 = Line 16: Total previously owned vehicle credit
 *   f1_24-f1_28 = Lines 17-21: Summary / carryforward
 *   f1_29 = Line 22: Credit to Schedule 3
 *   f1_30-f1_31 = Lines 23-24: Additional fields
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';

export const FORM_8936_FIELDS: IRSFieldMapping[] = [
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
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim() || undefined,
  },
  // Identifying number (SSN)
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Your identifying number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ══════════════════════════════════════════════════════════════
  // Vehicle Information
  // ══════════════════════════════════════════════════════════════

  // Line 1a: Year, make, and model of vehicle
  {
    pdfFieldName: `${P1}.Line1a_ReadOrder[0].f1_3[0]`,
    formLabel: 'Line 1a: Year, make, and model of vehicle',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.evCredit?.vehicleDescription,
  },
  // Line 1c: Date vehicle was placed in service
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 1c: Date vehicle placed in service',
    sourcePath: '',
    source: 'taxReturn',
    format: 'date',
    transform: (tr) => tr.evCredit?.dateAcquired,
  },

  // ══════════════════════════════════════════════════════════════
  // New Vehicle Section (Lines 2-11)
  // ══════════════════════════════════════════════════════════════

  // Line 2b: Cost or other basis
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 2b: Cost or other basis',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      if (!tr.evCredit?.isNewVehicle) return undefined;
      const price = tr.evCredit.purchasePrice;
      return price ? Math.round(price).toString() : undefined;
    },
  },
  // Line 2c: MSRP
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'Line 2c: Manufacturer suggested retail price (MSRP)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      if (!tr.evCredit?.isNewVehicle) return undefined;
      const msrp = tr.evCredit.vehicleMSRP;
      return msrp ? Math.round(msrp).toString() : undefined;
    },
  },
  // Line 4: Tentative credit (base credit from engine)
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 4: Tentative credit amount',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const base = calc.evCredit?.baseCredit;
      return base ? Math.round(base).toString() : undefined;
    },
  },
  // Line 5: Business/investment use percentage (100% for personal use)
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 5: Business/investment use percentage',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.evCredit ? '100.00' : undefined,
  },
  // Line 8: Personal use credit
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 8: Personal use credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const credit = calc.evCredit?.credit;
      return credit ? Math.round(credit).toString() : undefined;
    },
  },
  // Line 11: Total new clean vehicle credit
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Line 11: Total new clean vehicle credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      if (!tr.evCredit?.isNewVehicle) return undefined;
      const credit = calc.evCredit?.credit;
      return credit ? Math.round(credit).toString() : undefined;
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Previously Owned Vehicle Section (Lines 12-16)
  // ══════════════════════════════════════════════════════════════

  // Line 12: Purchase price (used vehicle)
  {
    pdfFieldName: `${P1}.f1_19[0]`,
    formLabel: 'Line 12: Previously owned vehicle purchase price',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      if (tr.evCredit?.isNewVehicle !== false) return undefined;
      const price = tr.evCredit?.purchasePrice;
      return price ? Math.round(price).toString() : undefined;
    },
  },
  // Line 16: Total previously owned vehicle credit
  {
    pdfFieldName: `${P1}.f1_23[0]`,
    formLabel: 'Line 16: Total previously owned vehicle credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      if (tr.evCredit?.isNewVehicle !== false) return undefined;
      const credit = calc.evCredit?.credit;
      return credit ? Math.round(credit).toString() : undefined;
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Summary (Lines 22+)
  // ══════════════════════════════════════════════════════════════

  // Line 22: Credit to Schedule 3 (total EV credit)
  {
    pdfFieldName: `${P1}.f1_29[0]`,
    formLabel: 'Line 22: Total clean vehicle credit to Schedule 3',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const credit = calc.evCredit?.credit;
      return credit ? Math.round(credit).toString() : undefined;
    },
  },
];

export const FORM_8936_TEMPLATE: IRSFormTemplate = {
  formId: 'f8936',
  displayName: 'Form 8936',
  attachmentSequence: 13.5,  // 13a — after Schedule E
  pdfFileName: 'f8936.pdf',
  condition: (tr, calc) =>
    tr.evCredit !== undefined || (calc.evCredit?.credit ?? 0) > 0,
  fields: FORM_8936_FIELDS,
};
