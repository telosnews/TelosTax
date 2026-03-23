/**
 * IRS Form 8283 (2025) -- AcroForm Field Mapping
 *
 * Noncash Charitable Contributions
 * PDF: client/public/irs-forms/f8283.pdf (Form 8283, 2025)
 * Attachment Sequence No. 155
 *
 * NOTE: This PDF uses `Form8283[0]` as its AcroForm prefix (NOT `topmostSubform[0]`)
 *
 * Layout:
 *   Page 1:
 *     Form8283[0].Page1[0]:
 *       f1_1 = Name(s) shown on your income tax return
 *       f1_2 = Identifying number
 *       c1_1  = Checkbox: Check if over 500 items
 *
 *     Section A -- Donated Property of $5,000 or Less and Publicly Traded Securities
 *       Two column groups of 4 rows each (A-D per group)
 *
 *       Group 1 (Lines 1a, columns a-f):
 *         Row A: f1_03..f1_08  (doneeOrg, description, dateOfContrib, dateAcquired, howAcquired, FMV, costBasis)
 *         Row B: f1_09..f1_14
 *         Row C: f1_15..f1_20
 *         Row D: f1_21..f1_26
 *
 *       Actually, the Section A table has these columns per row:
 *         (i)   Name and address of donee organization
 *         (ii)  Description of donated property
 *         (iii) Date of contribution
 *         (iv)  Date acquired by donor
 *         (v)   How acquired by donor
 *         (vi)  Donor's cost or adjusted basis
 *         (vii) Fair market value
 *         (viii) Method used to determine FMV
 *
 *       Section A rows: 4 items (A-D), each with fields in two groups
 *         Group 1 (cols a-c): 3 text fields per row
 *           Row A: f1_5, f1_6, f1_7
 *           Row B: f1_8, f1_9, f1_10
 *           Row C: f1_11, f1_12, f1_13
 *           Row D: f1_14, f1_15, f1_16
 *         Group 2 (cols d-i): 6 fields per row (we map 5)
 *           Row A: f1_17, f1_18, f1_19, f1_20, f1_21 (+f1_22)
 *           Row B: f1_23, f1_24, f1_25, f1_26, f1_27 (+f1_28)
 *           Row C: f1_29, f1_30, f1_31, f1_32, f1_33 (+f1_34)
 *           Row D: f1_35, f1_36, f1_37, f1_38, f1_39 (+f1_40)
 *
 *   Page 2:
 *     Form8283[0].Page2[0]:
 *       Section B -- Donated Property Over $5,000 (Except Publicly Traded Securities)
 *         Part I: Information on Donated Property
 *           f2_1 = Name of charitable organization (donee)
 *           f2_2 = Donee address/EIN
 *           f2_3 = Description of donated property (Line 5a)
 *           f2_4 = Physical condition of property (Line 5b)
 *           f2_5..f2_9 = Date acquired, how acquired, donor's cost, FMV, date of FMV
 *           f2_10 = Brief description of how FMV was determined
 *
 *         Part II: Taxpayer (Donor) Statement
 *           (Declaration text -- no mapped fields)
 *
 *         Part III: Declaration of Appraiser
 *           f2_11 = Appraiser name
 *           f2_12 = Appraiser address
 *           f2_13 = Appraiser TIN
 *           f2_14 = Date of appraisal
 *           f2_15 = Appraised FMV
 *
 *         Part IV: Donee Acknowledgment
 *           f2_16 = Date received
 *           f2_17 = Amount received for property (if any)
 *           c2_2  = Checkbox: intends to use property for exempt purpose
 *
 * Multi-instance: When Section A items exceed 5, or Section B items exceed 1,
 * additional form instances are generated.
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult, NonCashDonation } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'Form8283[0].Page1[0]';
const P2 = 'Form8283[0].Page2[0]';
const SECTION_A_ROWS = 4;
const SECTION_B_ROWS = 1; // Section B typically has detail for 1 item per form instance

// ---- Helpers ----

/** Format a dollar amount -- blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

/** Format date from YYYY-MM-DD to MM/DD/YYYY */
function fmtDate(d: string | undefined): string {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
  return d;
}

/** Map howAcquired code to display string */
function fmtHowAcquired(how: string | undefined): string {
  switch (how) {
    case 'purchase': return 'Purchase';
    case 'gift': return 'Gift';
    case 'inheritance': return 'Inheritance';
    case 'exchange': return 'Exchange';
    case 'other': return 'Other';
    default: return how || '';
  }
}

// ---- Instance Planning ----

interface InstancePlan {
  sectionAItems: NonCashDonation[];
  sectionBItems: NonCashDonation[];
  /** Whether this instance carries the header (first instance) */
  isFirstInstance: boolean;
}

function planInstances(tr: TaxReturn, calc: CalculationResult): InstancePlan[] {
  const form8283 = calc.form8283 || calc.scheduleA?.form8283;
  if (!form8283) return [];

  const { sectionAItems, sectionBItems } = form8283;
  if (sectionAItems.length === 0 && sectionBItems.length === 0) return [];

  const plans: InstancePlan[] = [];

  const sectionAPages = Math.max(sectionAItems.length > 0 ? Math.ceil(sectionAItems.length / SECTION_A_ROWS) : 0, 0);
  const sectionBPages = Math.max(sectionBItems.length > 0 ? Math.ceil(sectionBItems.length / SECTION_B_ROWS) : 0, 0);
  const maxPages = Math.max(sectionAPages, sectionBPages, 1);

  for (let p = 0; p < maxPages; p++) {
    const aSlice = sectionAItems.slice(p * SECTION_A_ROWS, (p + 1) * SECTION_A_ROWS);
    const bSlice = sectionBItems.slice(p * SECTION_B_ROWS, (p + 1) * SECTION_B_ROWS);

    plans.push({
      sectionAItems: aSlice,
      sectionBItems: bSlice,
      isFirstInstance: p === 0,
    });
  }

  return plans;
}

// ---- Field Mapping Builders ----

function buildInstanceFields(
  plan: InstancePlan,
  tr: TaxReturn,
  calc: CalculationResult,
): IRSFieldMapping[] {
  const fields: IRSFieldMapping[] = [];

  // ============================================================
  // Header
  // ============================================================

  fields.push({
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name(s) shown on your return',
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
  });
  fields.push({
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Identifying number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  });

  // ============================================================
  // Section A: Donated Property of $5,000 or Less
  // 4 rows (A-D), split into two column groups
  //
  // Group 1 (cols a-c): donee org name, description, date of contribution
  //   Row A: f1_5, f1_6, f1_7
  //   Row B: f1_8, f1_9, f1_10
  //   Row C: f1_11, f1_12, f1_13
  //   Row D: f1_14, f1_15, f1_16
  //
  // Group 2 (cols d-i): dateAcquired, howAcquired, costBasis, FMV, method
  //   Row A: f1_17, f1_18, f1_19, f1_20, f1_21
  //   Row B: f1_23, f1_24, f1_25, f1_26, f1_27
  //   Row C: f1_29, f1_30, f1_31, f1_32, f1_33
  //   Row D: f1_35, f1_36, f1_37, f1_38, f1_39
  // ============================================================

  const rowLetters = ['A', 'B', 'C', 'D'];
  for (let row = 0; row < plan.sectionAItems.length && row < SECTION_A_ROWS; row++) {
    const item = plan.sectionAItems[row];
    const rl = rowLetters[row];

    // Group 1 base: f1_5 + (row * 3) => Row A=5, B=8, C=11, D=14
    const g1Base = 5 + (row * 3);
    // Group 2 base: f1_17 + (row * 6) => Row A=17, B=23, C=29, D=35
    const g2Base = 17 + (row * 6);

    // (i) Name and address of donee organization
    fields.push({
      pdfFieldName: `${P1}.f1_${g1Base}[0]`,
      formLabel: `Section A, Row ${rl}: Donee organization name`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => item.doneeOrganization,
    });

    // (ii) Description of donated property
    fields.push({
      pdfFieldName: `${P1}.f1_${g1Base + 1}[0]`,
      formLabel: `Section A, Row ${rl}: Description of donated property`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => item.description,
    });

    // (iii) Date of the contribution
    fields.push({
      pdfFieldName: `${P1}.f1_${g1Base + 2}[0]`,
      formLabel: `Section A, Row ${rl}: Date of contribution`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(item.dateOfContribution),
    });

    // (iv) Date acquired by donor
    fields.push({
      pdfFieldName: `${P1}.f1_${g2Base}[0]`,
      formLabel: `Section A, Row ${rl}: Date acquired by donor`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(item.dateAcquired),
    });

    // (v) How acquired by donor
    fields.push({
      pdfFieldName: `${P1}.f1_${g2Base + 1}[0]`,
      formLabel: `Section A, Row ${rl}: How acquired by donor`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtHowAcquired(item.howAcquired),
    });

    // (vi) Donor's cost or adjusted basis
    fields.push({
      pdfFieldName: `${P1}.f1_${g2Base + 2}[0]`,
      formLabel: `Section A, Row ${rl}: Donor's cost or adjusted basis`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(item.costBasis),
    });

    // (vii) Fair market value
    fields.push({
      pdfFieldName: `${P1}.f1_${g2Base + 3}[0]`,
      formLabel: `Section A, Row ${rl}: Fair market value`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(item.fairMarketValue),
    });

    // (viii) Method used to determine FMV
    fields.push({
      pdfFieldName: `${P1}.f1_${g2Base + 4}[0]`,
      formLabel: `Section A, Row ${rl}: Method used to determine FMV`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => item.method || '',
    });
  }

  // ============================================================
  // Section B: Donated Property Over $5,000 (Page 2)
  // Typically 1 property per form instance with full detail
  // ============================================================

  for (let idx = 0; idx < plan.sectionBItems.length && idx < SECTION_B_ROWS; idx++) {
    const item = plan.sectionBItems[idx];

    // Part I: Information on Donated Property

    // Donee organization name
    fields.push({
      pdfFieldName: `${P2}.f2_1[0]`,
      formLabel: 'Section B, Line 4: Name of charitable organization (donee)',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => item.doneeOrganization,
    });

    // Line 5a: Description of donated property
    fields.push({
      pdfFieldName: `${P2}.f2_3[0]`,
      formLabel: 'Section B, Line 5a: Description of donated property',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => item.description,
    });

    // Date acquired
    fields.push({
      pdfFieldName: `${P2}.f2_5[0]`,
      formLabel: 'Section B, Line 5c: Date acquired by donor',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(item.dateAcquired),
    });

    // How acquired
    fields.push({
      pdfFieldName: `${P2}.f2_6[0]`,
      formLabel: 'Section B, Line 5d: How acquired by donor',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtHowAcquired(item.howAcquired),
    });

    // Donor's cost or adjusted basis
    fields.push({
      pdfFieldName: `${P2}.f2_7[0]`,
      formLabel: "Section B, Line 5e: Donor's cost or adjusted basis",
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(item.costBasis),
    });

    // Fair market value
    fields.push({
      pdfFieldName: `${P2}.f2_8[0]`,
      formLabel: 'Section B, Line 5f: Fair market value',
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(item.fairMarketValue),
    });

    // Date of FMV determination (use date of contribution)
    fields.push({
      pdfFieldName: `${P2}.f2_9[0]`,
      formLabel: 'Section B, Line 5g: Date of fair market value determination',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(item.dateOfContribution),
    });

    // Method used to determine FMV
    fields.push({
      pdfFieldName: `${P2}.f2_10[0]`,
      formLabel: 'Section B, Line 5h: Method used to determine FMV',
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => item.method || 'Comparable Sales',
    });

    // Part III: Declaration of Appraiser (if qualified appraisal exists)
    if (item.hasQualifiedAppraisal && item.appraiserName) {
      fields.push({
        pdfFieldName: `${P2}.f2_11[0]`,
        formLabel: 'Part III: Appraiser name',
        sourcePath: '', source: 'taxReturn', format: 'string',
        transform: () => item.appraiserName || '',
      });

      // Appraised FMV
      fields.push({
        pdfFieldName: `${P2}.f2_15[0]`,
        formLabel: 'Part III: Appraised fair market value',
        sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
        transform: () => fmtDollar(item.fairMarketValue),
      });
    }
  }

  return fields;
}

// ---- Exports ----

/**
 * Form 8283 uses dynamic field generation via fieldsForInstance.
 * The static `fields` array is empty -- all mappings are generated per-instance.
 */
export const FORM_8283_FIELDS: IRSFieldMapping[] = [];

export const FORM_8283_TEMPLATE: IRSFormTemplate = {
  formId: 'f8283',
  displayName: 'Form 8283',
  attachmentSequence: 155,
  pdfFileName: 'f8283.pdf',

  condition: (_tr: TaxReturn, calc: CalculationResult) => {
    // Form 8283 is needed when noncash charitable items exist
    const form8283 = calc.form8283 || calc.scheduleA?.form8283;
    if (!form8283) return false;

    return form8283.sectionAItems.length > 0 || form8283.sectionBItems.length > 0;
  },

  fields: FORM_8283_FIELDS,

  instanceCount: (tr: TaxReturn, calc: CalculationResult) => {
    return Math.max(planInstances(tr, calc).length, 0);
  },

  fieldsForInstance: (
    index: number,
    tr: TaxReturn,
    calc: CalculationResult,
  ) => {
    const plans = planInstances(tr, calc);
    if (index >= plans.length) return [];
    return buildInstanceFields(plans[index], tr, calc);
  },
};
