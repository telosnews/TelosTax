/**
 * IRS Form 1040-V (2025) — AcroForm Field Mapping
 *
 * Payment Voucher for Individuals
 * PDF: client/public/irs-forms/f1040v.pdf (Form 1040-V, 2025)
 *
 * Only included when the filer owes money (amountOwed > 0).
 * All data is already available from TaxReturn and CalculationResult —
 * no additional user input is required.
 *
 * Field prefix: topmostSubform[0].Page1[0]
 *
 *   f1_1  = Line 1: Your SSN
 *   f1_2  = Line 2: Spouse SSN (if joint)
 *   f1_3  = Line 3: Amount you are paying
 *   f1_5  = Line 4: Your first name and middle initial
 *   f1_6  = Line 4: Your last name
 *   f1_7  = If joint, spouse's first name and middle initial
 *   f1_8  = Spouse's last name
 *   f1_9  = Home address (number and street)
 *   f1_10 = Apt. no.
 *   f1_11 = City, town, or post office
 *   f1_12 = State
 *   f1_13 = ZIP code
 *   f1_14 = Foreign country name
 *   f1_15 = Foreign province/state/county
 *   f1_16 = Foreign postal code
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';

const FORM_1040V_FIELDS: IRSFieldMapping[] = [
  // Line 1: Your SSN
  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Line 1: Your social security number',
    sourcePath: 'ssn',
    source: 'taxReturn',
    format: 'ssn',
  },

  // Line 2: Spouse SSN (if joint return)
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Line 2: Spouse social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'ssn',
    transform: (tr) => {
      if (tr.filingStatus === FilingStatus.MarriedFilingJointly) {
        return tr.spouseSsn || '';
      }
      return '';
    },
  },

  // Line 3: Amount you are paying
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: 'Line 3: Amount you are paying',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const owed = calc.form1040.amountOwed || 0;
      return owed > 0 ? Math.round(owed).toString() : '';
    },
  },

  // Line 4: Your first name and middle initial
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Your first name and middle initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName || '', tr.middleInitial || ''].filter(Boolean);
      return parts.join(' ');
    },
  },

  // Line 4: Your last name
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Your last name',
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
  },

  // Spouse first name and middle initial (if joint)
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Spouse first name and middle initial',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (tr.filingStatus !== FilingStatus.MarriedFilingJointly) return '';
      const parts = [tr.spouseFirstName || '', tr.spouseMiddleInitial || ''].filter(Boolean);
      return parts.join(' ');
    },
  },

  // Spouse last name (if joint)
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'Spouse last name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      if (tr.filingStatus !== FilingStatus.MarriedFilingJointly) return '';
      return tr.spouseLastName || '';
    },
  },

  // Home address (number and street)
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    formLabel: 'Home address (number and street)',
    sourcePath: 'addressStreet',
    source: 'taxReturn',
    format: 'string',
  },

  // Apt. no. (not currently collected — leave blank)

  // City, town, or post office
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'City, town, or post office',
    sourcePath: 'addressCity',
    source: 'taxReturn',
    format: 'string',
  },

  // State
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'State',
    sourcePath: 'addressState',
    source: 'taxReturn',
    format: 'string',
  },

  // ZIP code
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'ZIP code',
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
  },
];

export const FORM_1040V_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040v',
  displayName: 'Form 1040-V (Payment Voucher)',
  attachmentSequence: 0,   // Included loose in envelope, not attached in sequence
  pdfFileName: 'f1040v.pdf',
  condition: (_tr, calc) => (calc.form1040.amountOwed || 0) > 0,
  fields: FORM_1040V_FIELDS,
};
