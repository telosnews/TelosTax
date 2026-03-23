/**
 * IRS Form 8911 (2025) -- AcroForm Field Mapping
 *
 * Alternative Fuel Vehicle Refueling Property Credit
 * PDF: client/public/irs-forms/f8911.pdf (Form 8911, 2025)
 * Attachment Sequence No. 151
 * Total fields: 15 (text only)
 *
 * Field prefix: topmostSubform[0].Page1[0]
 *
 * Layout:
 *   f1_01 = Name(s) shown on return
 *   f1_02 = Identifying number (SSN/EIN)
 *
 *   Part I -- Total Cost of Qualified Property:
 *   f1_03 = Line 1: Total cost of qualified alternative fuel vehicle refueling property
 *                    placed in service during tax year (personal use portion)
 *
 *   Part II -- Credit for Personal Use Property (Lines 2-7):
 *   f1_04 = Line 2: Section 30C(e)(1) property costs (personal use)
 *   f1_05 = Line 3: Multiply line 2 by 30% (0.30)
 *   f1_06 = Line 4: Maximum credit per item ($1,000)
 *   f1_07 = Line 5: Enter the smaller of line 3 or line 4
 *   f1_08 = Line 6: Personal use credit (from all properties)
 *   f1_09 = Line 7: Tax liability limitation (for non-refundable credit)
 *
 *   Part III -- Credit for Business/Investment Use Property (Lines 8-12):
 *   f1_10 = Line 8: Business/investment use property costs
 *   f1_11 = Line 9: Multiply line 8 by 30%
 *   f1_12 = Line 10: Maximum credit per item ($100,000)
 *   f1_13 = Line 11: Business credit (smaller of line 9 or 10)
 *   f1_14 = Line 12: Total business credit (all properties)
 *
 *   f1_15 = Line 13: Total credit (personal + business, goes to Schedule 3 or Form 3800)
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';

/** Format a dollar amount -- blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

export const FORM_8911_FIELDS: IRSFieldMapping[] = [
  // ======================================================================
  // Header
  // ======================================================================

  {
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
      return parts.join(' ') || undefined;
    },
  },
  {
    pdfFieldName: `${P1}.f1_02[0]`,
    formLabel: 'Identifying number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ======================================================================
  // Part I -- Total Cost of Qualified Property
  // ======================================================================

  // Line 1: Total cost of qualified refueling property
  {
    pdfFieldName: `${P1}.f1_03[0]`,
    formLabel: 'Line 1: Total cost of qualified refueling property',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.evRefuelingCredit?.totalCost),
  },

  // ======================================================================
  // Part II -- Credit for Personal Use Property
  // ======================================================================

  // Line 2: Personal use property costs
  {
    pdfFieldName: `${P1}.f1_04[0]`,
    formLabel: 'Line 2: Personal use property costs',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const personalCost = calc.evRefuelingCredit?.propertyResults
        ?.filter((p) => !p.isBusinessUse)
        .reduce((sum, p) => sum + p.cost, 0);
      return fmtDollar(personalCost);
    },
  },
  // Line 3: Multiply line 2 by 30%
  {
    pdfFieldName: `${P1}.f1_05[0]`,
    formLabel: 'Line 3: Line 2 multiplied by 30%',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const personalCost = calc.evRefuelingCredit?.propertyResults
        ?.filter((p) => !p.isBusinessUse)
        .reduce((sum, p) => sum + p.cost, 0);
      return fmtDollar(personalCost ? Math.round(personalCost * 0.30) : undefined);
    },
  },
  // Line 4: Maximum credit per item ($1,000)
  {
    pdfFieldName: `${P1}.f1_06[0]`,
    formLabel: 'Line 4: Maximum credit per item',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // Only show if there are personal-use properties
      const hasPersonal = calc.evRefuelingCredit?.propertyResults?.some((p) => !p.isBusinessUse);
      return hasPersonal ? '1000' : undefined;
    },
  },
  // Line 5: Smaller of line 3 or line 4 (per-property, summed)
  {
    pdfFieldName: `${P1}.f1_07[0]`,
    formLabel: 'Line 5: Smaller of line 3 or line 4',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const personalCredit = calc.evRefuelingCredit?.propertyResults
        ?.filter((p) => !p.isBusinessUse)
        .reduce((sum, p) => sum + p.credit, 0);
      return fmtDollar(personalCredit);
    },
  },
  // Line 6: Personal use credit (total from all personal-use properties)
  {
    pdfFieldName: `${P1}.f1_08[0]`,
    formLabel: 'Line 6: Personal use credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const personalCredit = calc.evRefuelingCredit?.propertyResults
        ?.filter((p) => !p.isBusinessUse)
        .reduce((sum, p) => sum + p.credit, 0);
      return fmtDollar(personalCredit);
    },
  },

  // ======================================================================
  // Part III -- Credit for Business/Investment Use Property
  // ======================================================================

  // Line 8: Business/investment use property costs
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 8: Business/investment use property costs',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const bizCost = calc.evRefuelingCredit?.propertyResults
        ?.filter((p) => p.isBusinessUse)
        .reduce((sum, p) => sum + p.cost, 0);
      return fmtDollar(bizCost);
    },
  },
  // Line 9: Multiply line 8 by 30%
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 9: Line 8 multiplied by 30%',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const bizCost = calc.evRefuelingCredit?.propertyResults
        ?.filter((p) => p.isBusinessUse)
        .reduce((sum, p) => sum + p.cost, 0);
      return fmtDollar(bizCost ? Math.round(bizCost * 0.30) : undefined);
    },
  },
  // Line 10: Maximum credit per item ($100,000)
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 10: Maximum business credit per item',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const hasBiz = calc.evRefuelingCredit?.propertyResults?.some((p) => p.isBusinessUse);
      return hasBiz ? '100000' : undefined;
    },
  },
  // Line 11: Business credit (smaller of line 9 or 10, per property)
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 11: Business credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const bizCredit = calc.evRefuelingCredit?.propertyResults
        ?.filter((p) => p.isBusinessUse)
        .reduce((sum, p) => sum + p.credit, 0);
      return fmtDollar(bizCredit);
    },
  },

  // ======================================================================
  // Total Credit
  // ======================================================================

  // Line 13: Total credit (personal + business) -- flows to Schedule 3
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 13: Total alternative fuel refueling property credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.evRefuelingCredit?.totalCredit),
  },
];

export const FORM_8911_TEMPLATE: IRSFormTemplate = {
  formId: 'f8911',
  displayName: 'Form 8911',
  attachmentSequence: 151,
  pdfFileName: 'f8911.pdf',
  condition: (tr, calc) => {
    // Check for actual nonzero property costs (not just empty array)
    const hasProperties = tr.evRefuelingCredit?.properties?.some(
      (p) => (p.cost ?? 0) > 0,
    );
    const hasCredit = (calc.evRefuelingCredit?.totalCredit ?? 0) > 0;
    return hasProperties || hasCredit;
  },
  fields: FORM_8911_FIELDS,
};
