/**
 * IRS Form 8839 (2025) -- AcroForm Field Mapping
 *
 * Qualified Adoption Expenses
 * PDF: client/public/irs-forms/f8839.pdf (Form 8839, 2025)
 * Attachment Sequence No. 38
 *
 * Structure:
 *   Page 1:
 *     Header: f1_1 (Name), f1_2 (SSN)
 *     Part I -- Information About Your Eligible Child or Children (Lines 1-2):
 *       Child 1: f1_3 (name), f1_4 (year of birth), f1_5/c1_1 (disabled checkbox)
 *       Child 2: f1_6 (name), f1_7 (year of birth), f1_8/c1_2 (disabled checkbox)
 *       Child 3: f1_9 (name), f1_10 (year of birth), f1_11/c1_3 (disabled checkbox)
 *       c1_1..c1_6: various checkboxes (special needs, foreign adoption, etc.)
 *
 *     Part II -- Adoption Credit (Lines 3-16):
 *       Child 1: f1_12 (L3 max credit), f1_13 (L4 qualified expenses), f1_14 (L5 subtract)
 *       Child 2: f1_15 (L6), f1_16 (L7), f1_17 (L8)
 *       Child 3: f1_18 (L9), f1_19 (L10), f1_20 (L11)
 *
 *     Part III -- AGI Limitation and Credit (Lines 12-18):
 *       Modified AGI, phase-out calculation, final credit
 *
 * Engine sources:
 *   tr.adoptionCredit: { qualifiedExpenses, numberOfChildren?, isSpecialNeeds? }
 *   calc.adoptionCredit: { expensesBasis, credit }
 *   calc.credits.adoptionCredit: number (final credit amount)
 *
 * This mapping covers header, Part I child info, Part II key amounts,
 * and Part III summary credit. Fields without engine data are left unmapped.
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { ADOPTION_CREDIT } from './tax2025.js';

const fmtDollar = (v: number | undefined): string => {
  if (v === undefined || v === null || v === 0) return '';
  return Math.round(v).toString();
};

const P1 = 'topmostSubform[0].Page1[0]';

const FORM_8839_FIELDS: IRSFieldMapping[] = [
  // ================================================================
  // Header
  // ================================================================

  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name shown on return',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim() || undefined,
  },
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ================================================================
  // Part I -- Information About Your Eligible Child or Children
  // ================================================================

  // Child 1 name (Line 1, column a)
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: 'Line 1: Child 1 name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      // Use first dependent's name if available, otherwise leave blank
      const dep = tr.dependents?.[0];
      return dep ? `${dep.firstName || ''} ${dep.lastName || ''}`.trim() || undefined : undefined;
    },
  },
  // Child 1 year of birth (Line 1, column b)
  {
    pdfFieldName: `${P1}.f1_4[0]`,
    formLabel: 'Line 1: Child 1 year of birth',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const dep = tr.dependents?.[0];
      if (!dep?.dateOfBirth) return undefined;
      // Extract year from date string (YYYY-MM-DD or similar)
      const match = dep.dateOfBirth.match(/(\d{4})/);
      return match ? match[1] : undefined;
    },
  },
  // Child 1 disabled checkbox (Line 1, column c)
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 1: Child 1 is disabled',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.adoptionCredit?.isSpecialNeeds === true,
  },

  // Child 1 special needs checkbox (c1_1)
  {
    pdfFieldName: `${P1}.c1_1[0]`,
    formLabel: 'Line 2: Child 1 has special needs',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.adoptionCredit?.isSpecialNeeds === true,
  },

  // ================================================================
  // Part II -- Adoption Credit (Lines 3-11)
  // ================================================================

  // Line 3: Maximum adoption credit per child ($17,280 for 2025)
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 3: Maximum adoption credit per child',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      if (!tr.adoptionCredit) return undefined;
      return fmtDollar(ADOPTION_CREDIT.MAX_CREDIT) || undefined;
    },
  },
  // Line 4: Qualified adoption expenses (Child 1)
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 4: Qualified adoption expenses (Child 1)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      if (!tr.adoptionCredit) return undefined;
      if (tr.adoptionCredit.isSpecialNeeds) {
        // Special needs: full credit amount regardless of expenses
        return fmtDollar(ADOPTION_CREDIT.MAX_CREDIT) || undefined;
      }
      const v = Math.min(tr.adoptionCredit.qualifiedExpenses || 0, ADOPTION_CREDIT.MAX_CREDIT);
      return fmtDollar(v) || undefined;
    },
  },
  // Line 5: Subtract line 4 from line 3 (remaining credit capacity)
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    formLabel: 'Line 5: Subtract line 4 from line 3',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      if (!tr.adoptionCredit) return undefined;
      const maxCredit = ADOPTION_CREDIT.MAX_CREDIT;
      const expenses = tr.adoptionCredit.isSpecialNeeds
        ? maxCredit
        : Math.min(tr.adoptionCredit.qualifiedExpenses || 0, maxCredit);
      const diff = Math.max(0, maxCredit - expenses);
      return diff > 0 ? fmtDollar(diff) : '0';
    },
  },

  // ================================================================
  // Part III -- Credit Summary (AGI phase-out applied by engine)
  // ================================================================

  // The engine computes the final adoption credit after AGI phase-out.
  // We map the expenses basis and final credit from the calculation result.

  // Expenses basis (total qualified expenses after per-child cap and special needs)
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Line 9: Total qualified adoption expenses basis',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.adoptionCredit?.expensesBasis) || undefined,
  },

  // Final adoption credit amount (after AGI phase-out)
  {
    pdfFieldName: `${P1}.f1_20[0]`,
    formLabel: 'Line 11: Adoption credit after AGI phase-out',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.adoptionCredit?.credit) || undefined,
  },
];

export const FORM_8839_TEMPLATE: IRSFormTemplate = {
  formId: 'f8839',
  displayName: 'Form 8839',
  attachmentSequence: 38,
  pdfFileName: 'f8839.pdf',
  condition: (tr, calc) =>
    (calc.adoptionCredit?.credit ?? 0) > 0 ||
    (tr.adoptionCredit?.qualifiedExpenses ?? 0) > 0,
  fields: FORM_8839_FIELDS,
};
