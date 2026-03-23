/**
 * IRS Form 4797 (2025) -- AcroForm Field Mapping
 *
 * Sales of Business Property
 * PDF: client/public/irs-forms/f4797.pdf (Form 4797, 2025)
 * Attachment Sequence No. 27
 *
 * Field prefix: topmostSubform[0]
 *
 * Layout:
 *   Page 1:
 *     f1_1 = Name(s) shown on return
 *     f1_2 = Identifying number (SSN/EIN)
 *
 *     Part I: Sales or Exchanges of Property Used in a Trade or Business and
 *             Involuntary Conversions From Other Than Casualty or Theft --
 *             Property Held More Than 1 Year (Section 1231)
 *       TableLine2: 4 rows x 7 columns
 *         Row 1: f1_03..f1_09  (description, dateAcquired, dateSold, grossSalesPrice, depreciation, costBasis, gainOrLoss)
 *         Row 2: f1_10..f1_16
 *         Row 3: f1_17..f1_23
 *         Row 4: f1_24..f1_30
 *       f1_31 = Line 6: Gain, if any, from Form 4684
 *       f1_32 = Line 7: Section 1231 gain from installment sales
 *       f1_33 = Line 8: Section 1231 gain or loss from like-kind exchanges
 *       f1_34 = Line 9: Gain from Form 6252 (installment)
 *       f1_35 = Line 10: Net gain or loss -- combine lines 2-9
 *       f1_36 = Line 11: Nonrecaptured net Section 1231 losses from prior years
 *
 *     Part II: Ordinary Gains and Losses
 *       TableLine10: 4 rows x 7 columns
 *         Row 1: f1_37..f1_43  (description, dateAcquired, dateSold, grossSalesPrice, depreciation, costBasis, gainOrLoss)
 *         Row 2: f1_44..f1_50
 *         Row 3: f1_51..f1_57
 *         Row 4: f1_58..f1_64
 *       f1_65 = Line 15: Net gain from Form 4797 Part III line 31 (ordinary income from recapture)
 *       f1_66 = Line 16: Ordinary gains from Part I of Form 4684
 *       f1_67 = Line 17: Combine lines 10 through 16
 *       f1_68 = Line 18a: For all except individual returns (skip)
 *       f1_69 = Line 18b: Combines with 18a
 *
 *   Page 2:
 *     Part III: Gain From Disposition of Property Under Sections 1245, 1250,
 *               1252, 1254, and 1255 (table for up to 4 properties)
 *       Column (a)-(d) for up to 4 properties:
 *       f2_01..f2_04 = Line 19: Description of section 1245/1250/etc. property
 *       f2_05..f2_08 = Line 20: Date acquired
 *       f2_09..f2_12 = Line 21: Date sold
 *       f2_13..f2_16 = Line 22: Cost or other basis
 *       f2_17..f2_20 = Line 23: Depreciation allowed
 *       f2_21..f2_24 = Line 24: Adjusted basis (line 22 minus line 23)
 *       f2_25..f2_28 = Line 25: Total gain (line 20a minus line 24)
 *       f2_29..f2_32 = Line 26: Section 1245 -- applicable percentage (usually 100%)
 *       f2_33..f2_36 = Line 25b: If section 1245 property: lesser of line 25 or depreciation
 *       f2_37..f2_40 = Line 26: Section 1250 -- excess depreciation
 *       f2_41..f2_44 = Line 26a: Additional depreciation after 1975
 *       f2_45..f2_48 = Line 26b: Applicable percentage (for certain property)
 *       f2_49..f2_52 = Line 26c: Multiply line 26a x line 26b
 *       --- (Lines 27-30 for sections 1252, 1254, 1255 -- less common, skipped)
 *       f2_61..f2_64 = Line 31: Total (summary of ordinary income per property)
 *
 *     Part IV: Recapture Amounts Under Sections 179 and 280F(b)(2)
 *       f2_65 = Line 32: Section 179 expense deduction or depreciation
 *       f2_66 = Line 33: Section 280F(b)(2) listed property
 *
 * Multi-instance: When properties exceed 4 per section, additional
 * form instances are generated.
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult, Form4797Property, Form4797PropertyResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';
const ROWS_PER_SECTION = 4;

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

// ---- Property Classification ----

/** Classify properties into Part I (Section 1231), Part II (ordinary), and Part III (recapture detail) */
interface PropertyClassification {
  /** Part I: Section 1231 properties with no recapture (held > 1 year, no 1245/1250 designation) */
  partIProperties: Form4797Property[];
  partIResults: Form4797PropertyResult[];

  /** Part II: Properties with ordinary gain/loss that have depreciation recapture */
  partIIProperties: Form4797Property[];
  partIIResults: Form4797PropertyResult[];

  /** Part III: Section 1245/1250 properties that need recapture detail */
  partIIIProperties: Form4797Property[];
  partIIIResults: Form4797PropertyResult[];
}

function classifyProperties(
  properties: Form4797Property[],
  results: Form4797PropertyResult[],
): PropertyClassification {
  const classification: PropertyClassification = {
    partIProperties: [],
    partIResults: [],
    partIIProperties: [],
    partIIResults: [],
    partIIIProperties: [],
    partIIIResults: [],
  };

  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    const result = results[i];
    if (!result) continue;

    if (prop.isSection1245 || prop.isSection1250) {
      // Properties with recapture go to Part III for detail,
      // and their ordinary income flows from Part III Line 31 to Part II Line 15
      classification.partIIIProperties.push(prop);
      classification.partIIIResults.push(result);

      // Any remaining Section 1231 gain/loss after recapture goes to Part I
      if (result.section1231GainOrLoss !== 0) {
        classification.partIProperties.push(prop);
        classification.partIResults.push(result);
      }
    } else {
      // Pure Section 1231 property -- all gain/loss goes to Part I
      classification.partIProperties.push(prop);
      classification.partIResults.push(result);
    }
  }

  return classification;
}

// ---- Instance Planning ----

interface InstancePlan {
  partIProps: Form4797Property[];
  partIResults: Form4797PropertyResult[];
  partIIIProps: Form4797Property[];
  partIIIResults: Form4797PropertyResult[];
  /** Whether this instance carries the summary lines (only first instance) */
  isSummaryInstance: boolean;
}

function planInstances(tr: TaxReturn, calc: CalculationResult): InstancePlan[] {
  const properties = tr.form4797Properties || [];
  const form4797 = calc.form4797;
  if (!form4797 || form4797.propertyResults.length === 0) return [];

  const classified = classifyProperties(properties, form4797.propertyResults);
  const plans: InstancePlan[] = [];

  const partIPages = Math.max(1, Math.ceil(classified.partIProperties.length / ROWS_PER_SECTION));
  const partIIIPages = Math.ceil(classified.partIIIProperties.length / ROWS_PER_SECTION);
  const maxPages = Math.max(partIPages, partIIIPages, 1);

  for (let p = 0; p < maxPages; p++) {
    const partISliceProps = classified.partIProperties.slice(
      p * ROWS_PER_SECTION,
      (p + 1) * ROWS_PER_SECTION,
    );
    const partISliceResults = classified.partIResults.slice(
      p * ROWS_PER_SECTION,
      (p + 1) * ROWS_PER_SECTION,
    );
    const partIIISliceProps = classified.partIIIProperties.slice(
      p * ROWS_PER_SECTION,
      (p + 1) * ROWS_PER_SECTION,
    );
    const partIIISliceResults = classified.partIIIResults.slice(
      p * ROWS_PER_SECTION,
      (p + 1) * ROWS_PER_SECTION,
    );

    plans.push({
      partIProps: partISliceProps,
      partIResults: partISliceResults,
      partIIIProps: partIIISliceProps,
      partIIIResults: partIIISliceResults,
      isSummaryInstance: p === 0,
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
  const form4797 = calc.form4797!;

  // ============================================================
  // Header
  // ============================================================

  fields.push({
    pdfFieldName: `${P1}.f1_1[0]`,
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
  // Part I: Section 1231 Property (Lines 2-9)
  // TableLine2: 4 rows x 7 columns
  // Row fields: description, dateAcquired, dateSold, grossSalesPrice, depreciation, costBasis, gainOrLoss
  // ============================================================

  for (let row = 0; row < plan.partIProps.length && row < ROWS_PER_SECTION; row++) {
    const prop = plan.partIProps[row];
    const result = plan.partIResults[row];
    const baseField = 6 + (row * 7); // Row 1: f1_6..f1_12, Row 2: f1_13..f1_19, etc.

    // (a) Description of property
    fields.push({
      pdfFieldName: `${P1}.f1_${baseField}[0]`,
      formLabel: `Part I Row ${row + 1}: Description of property`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => prop.description,
    });
    // (b) Date acquired
    fields.push({
      pdfFieldName: `${P1}.f1_${baseField + 1}[0]`,
      formLabel: `Part I Row ${row + 1}: Date acquired`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(prop.dateAcquired),
    });
    // (c) Date sold
    fields.push({
      pdfFieldName: `${P1}.f1_${baseField + 2}[0]`,
      formLabel: `Part I Row ${row + 1}: Date sold`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(prop.dateSold),
    });
    // (d) Gross sales price
    fields.push({
      pdfFieldName: `${P1}.f1_${baseField + 3}[0]`,
      formLabel: `Part I Row ${row + 1}: Gross sales price`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(prop.salesPrice),
    });
    // (e) Depreciation allowed (or allowable)
    fields.push({
      pdfFieldName: `${P1}.f1_${baseField + 4}[0]`,
      formLabel: `Part I Row ${row + 1}: Depreciation allowed`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(prop.depreciationAllowed),
    });
    // (f) Cost or other basis, plus improvements and expense of sale
    fields.push({
      pdfFieldName: `${P1}.f1_${baseField + 5}[0]`,
      formLabel: `Part I Row ${row + 1}: Cost or other basis`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(prop.costBasis),
    });
    // (g) Gain or (loss). Subtract (f) from (d) + (e)
    fields.push({
      pdfFieldName: `${P1}.f1_${baseField + 6}[0]`,
      formLabel: `Part I Row ${row + 1}: Gain or loss`,
      sourcePath: '', source: 'calculationResult', format: 'dollarNoCents',
      transform: () => {
        const gl = result.section1231GainOrLoss;
        return gl !== 0 ? Math.round(gl).toString() : undefined;
      },
    });
  }

  // ============================================================
  // Part I Summary Lines (only on first instance)
  // ============================================================

  if (plan.isSummaryInstance) {
    // Line 7 (f1_38): Net section 1231 gain or loss -- combine lines 2 through 6
    fields.push({
      pdfFieldName: `${P1}.f1_38[0]`,
      formLabel: 'Line 7: Net Section 1231 gain or loss',
      sourcePath: '',
      source: 'calculationResult',
      format: 'dollarNoCents',
      transform: (_tr, calc) => {
        const net = calc.form4797?.netSection1231GainOrLoss;
        return net !== undefined && net !== 0 ? Math.round(net).toString() : undefined;
      },
    });

    // ============================================================
    // Part II Summary Lines
    // ============================================================

    // Line 15 (f1_73): Net gain from Part III line 31 (ordinary income from recapture)
    fields.push({
      pdfFieldName: `${P1}.f1_73[0]`,
      formLabel: 'Line 15: Ordinary income from Part III recapture',
      sourcePath: '',
      source: 'calculationResult',
      format: 'dollarNoCents',
      transform: (_tr, calc) => fmtDollar(calc.form4797?.totalOrdinaryIncome),
    });

    // Line 17 (f1_75): Combine lines 10 through 16 (total ordinary gains/losses)
    fields.push({
      pdfFieldName: `${P1}.f1_75[0]`,
      formLabel: 'Line 17: Total ordinary gains and losses',
      sourcePath: '',
      source: 'calculationResult',
      format: 'dollarNoCents',
      transform: (_tr, calc) => fmtDollar(calc.form4797?.totalOrdinaryIncome),
    });
  }

  // ============================================================
  // Page 2 -- Part III: Gain From Disposition of Property Under
  // Sections 1245, 1250, 1252, 1254, and 1255
  // Up to 4 properties in columns (a)-(d)
  // ============================================================

  for (let col = 0; col < plan.partIIIProps.length && col < ROWS_PER_SECTION; col++) {
    const prop = plan.partIIIProps[col];
    const result = plan.partIIIResults[col];

    // Line 19: Description of section 1245/1250 property
    // PartIIITable1 is organized by PROPERTY: each row = one property,
    // 3 cols = description (wide), date acquired, date sold
    fields.push({
      pdfFieldName: `${P2}.f2_${1 + col * 3}[0]`,
      formLabel: `Line 19 Col ${String.fromCharCode(97 + col)}: Description of property`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => prop.description,
    });

    // Line 20: Date acquired
    fields.push({
      pdfFieldName: `${P2}.f2_${2 + col * 3}[0]`,
      formLabel: `Line 20 Col ${String.fromCharCode(97 + col)}: Date acquired`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(prop.dateAcquired),
    });

    // Line 21: Date sold
    fields.push({
      pdfFieldName: `${P2}.f2_${3 + col * 3}[0]`,
      formLabel: `Line 21 Col ${String.fromCharCode(97 + col)}: Date sold`,
      sourcePath: '', source: 'taxReturn', format: 'string',
      transform: () => fmtDate(prop.dateSold),
    });

    // Line 22: Cost or other basis plus expense of sale
    fields.push({
      pdfFieldName: `${P2}.f2_${String(13 + col)}[0]`,
      formLabel: `Line 22 Col ${String.fromCharCode(97 + col)}: Cost or other basis`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(prop.costBasis),
    });

    // Line 23: Depreciation (or depletion) allowed or allowable
    fields.push({
      pdfFieldName: `${P2}.f2_${String(17 + col)}[0]`,
      formLabel: `Line 23 Col ${String.fromCharCode(97 + col)}: Depreciation allowed`,
      sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
      transform: () => fmtDollar(prop.depreciationAllowed),
    });

    // Line 24: Adjusted basis (line 22 minus line 23)
    fields.push({
      pdfFieldName: `${P2}.f2_${String(21 + col)}[0]`,
      formLabel: `Line 24 Col ${String.fromCharCode(97 + col)}: Adjusted basis`,
      sourcePath: '', source: 'calculationResult', format: 'dollarNoCents',
      transform: () => fmtDollar(result.adjustedBasis),
    });

    // Line 25: Total gain (sales price minus adjusted basis)
    fields.push({
      pdfFieldName: `${P2}.f2_${String(25 + col)}[0]`,
      formLabel: `Line 25 Col ${String.fromCharCode(97 + col)}: Total gain`,
      sourcePath: '', source: 'calculationResult', format: 'dollarNoCents',
      transform: () => fmtDollar(result.gain),
    });

    // Section 1245 recapture
    if (prop.isSection1245) {
      // Line 25b (f2_33..f2_36): Section 1245 ordinary income
      // (lesser of line 25 or depreciation allowed)
      fields.push({
        pdfFieldName: `${P2}.f2_${String(33 + col)}[0]`,
        formLabel: `Line 25b Col ${String.fromCharCode(97 + col)}: Section 1245 ordinary income`,
        sourcePath: '', source: 'calculationResult', format: 'dollarNoCents',
        transform: () => fmtDollar(result.section1245OrdinaryIncome),
      });
    }

    // Section 1250 recapture
    if (prop.isSection1250) {
      // Line 26a (f2_41..f2_44): Additional depreciation after 1975 (excess over straight-line)
      fields.push({
        pdfFieldName: `${P2}.f2_${String(41 + col)}[0]`,
        formLabel: `Line 26a Col ${String.fromCharCode(97 + col)}: Additional depreciation after 1975`,
        sourcePath: '', source: 'taxReturn', format: 'dollarNoCents',
        transform: () => {
          const straightLine = prop.straightLineDepreciation || 0;
          const excess = Math.max(0, prop.depreciationAllowed - straightLine);
          return fmtDollar(excess);
        },
      });

      // Line 26c (f2_49..f2_52): Section 1250 ordinary income
      fields.push({
        pdfFieldName: `${P2}.f2_${String(49 + col)}[0]`,
        formLabel: `Line 26c Col ${String.fromCharCode(97 + col)}: Section 1250 ordinary income`,
        sourcePath: '', source: 'calculationResult', format: 'dollarNoCents',
        transform: () => fmtDollar(result.section1250OrdinaryIncome),
      });
    }

    // Line 31 (f2_61..f2_64): Total ordinary income per property
    // = section1245OrdinaryIncome + section1250OrdinaryIncome
    fields.push({
      pdfFieldName: `${P2}.f2_${String(61 + col)}[0]`,
      formLabel: `Line 31 Col ${String.fromCharCode(97 + col)}: Total ordinary income`,
      sourcePath: '', source: 'calculationResult', format: 'dollarNoCents',
      transform: () => fmtDollar(result.section1245OrdinaryIncome + result.section1250OrdinaryIncome),
    });
  }

  return fields;
}

// ---- Exports ----

/**
 * Form 4797 uses dynamic field generation via fieldsForInstance.
 * The static `fields` array is empty -- all mappings are generated per-instance.
 */
export const FORM_4797_FIELDS: IRSFieldMapping[] = [];

export const FORM_4797_TEMPLATE: IRSFormTemplate = {
  formId: 'f4797',
  displayName: 'Form 4797',
  attachmentSequence: 27,
  pdfFileName: 'f4797.pdf',

  condition: (_tr: TaxReturn, calc: CalculationResult) => {
    const result = calc.form4797;
    return !!(result && result.propertyResults.length > 0);
  },

  fields: FORM_4797_FIELDS,

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
