/**
 * IRS Form 5695 (2025) — AcroForm Field Mapping
 *
 * Residential Energy Credits
 * PDF: client/public/irs-forms/f5695.pdf (Form 5695, 2025)
 * Attachment Sequence No. 158
 * Total fields: 167 (text: 149, checkbox: 18)
 *
 * Part I  (Pages 1-2): Residential Clean Energy Credit (solar, wind, geothermal, battery, fuel cell)
 * Part II (Pages 3-4): Energy Efficient Home Improvement Credit (insulation, windows, HVAC, etc.)
 *
 * This mapping covers:
 *   - Header fields (name, SSN)
 *   - Part I: Residential Clean Energy Credit (from CleanEnergyInfo/Result)
 *   - Part II: Energy Efficient Home Improvement Credit (from EnergyEfficiencyInfo/Result)
 *
 * Field prefix: topmostSubform[0].PageN[0]
 *
 * Page 1 (Part I — Residential Clean Energy Credit):
 *   f1_01 = Name(s)
 *   f1_02 = SSN
 *   f1_03 = Line 1: Qualified solar electric property costs
 *   f1_04 = Line 2: Qualified solar water heating property costs
 *   f1_05 = Line 3: Qualified small wind energy property costs
 *   f1_06 = Line 4: Qualified geothermal heat pump property costs
 *   f1_07 = Line 5: Qualified battery storage technology costs
 *   f1_08 = Line 6a: Qualified fuel cell property costs
 *   f1_09 = Line 6b: Fuel cell kilowatt capacity
 *   f1_10 = Line 6c: Fuel cell credit limit
 *   f1_11 = Line 7: Add lines 1-5 and 6a
 *   c1_1[0/1] = Line 8: Yes/No (did you share expenses?)
 *   f1_12 = Line 9: Applicable percentage (30%)
 *   f1_13 = Line 10: Multiply line 7 by line 9
 *   f1_14 = Line 11: Fuel cell credit
 *   c1_2[0/1] = Line 12a/12b
 *   f1_15 = Line 13: Credit carryforward from prior year
 *   f1_16 = Line 14: Add lines 10, 11, and 13
 *   f1_17..f1_30 = Lines 15-30: Tax limitation worksheet
 *
 * Page 3 (Part II — Energy Efficient Home Improvement Credit):
 *   f3_01..f3_20 = Line 21c table (qualified improvements table)
 *   f3_21 = Line 21d: Total from table
 *   f3_22..f3_52 = Lines 22-30: Credit calculation, limitations
 *
 * Page 4 (Part II continuation):
 *   f4_01..f4_21 = Lines 26-30+: Additional calculations, prior year credits
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P3 = 'topmostSubform[0].Page3[0]';
const P4 = 'topmostSubform[0].Page4[0]';

export const FORM_5695_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════

  {
    pdfFieldName: `${P1}.f1_01[0]`,
    formLabel: 'Your name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim() || undefined,
  },
  {
    pdfFieldName: `${P1}.f1_02[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ══════════════════════════════════════════════════════════════
  // Part I — Residential Clean Energy Credit (Lines 1-14)
  // ══════════════════════════════════════════════════════════════

  // Line 1: Solar electric costs
  {
    pdfFieldName: `${P1}.f1_03[0]`,
    formLabel: 'Line 1: Qualified solar electric property costs',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const v = tr.cleanEnergy?.solarElectric;
      return v ? Math.round(v).toString() : undefined;
    },
  },
  // Line 2: Solar water heating costs
  {
    pdfFieldName: `${P1}.f1_04[0]`,
    formLabel: 'Line 2: Qualified solar water heating property costs',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const v = tr.cleanEnergy?.solarWaterHeating;
      return v ? Math.round(v).toString() : undefined;
    },
  },
  // Line 3: Small wind energy costs
  {
    pdfFieldName: `${P1}.f1_05[0]`,
    formLabel: 'Line 3: Qualified small wind energy property costs',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const v = tr.cleanEnergy?.smallWindEnergy;
      return v ? Math.round(v).toString() : undefined;
    },
  },
  // Line 4: Geothermal heat pump costs
  {
    pdfFieldName: `${P1}.f1_06[0]`,
    formLabel: 'Line 4: Qualified geothermal heat pump property costs',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const v = tr.cleanEnergy?.geothermalHeatPump;
      return v ? Math.round(v).toString() : undefined;
    },
  },
  // Line 5: Battery storage technology costs
  {
    pdfFieldName: `${P1}.f1_07[0]`,
    formLabel: 'Line 5: Qualified battery storage technology costs',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const v = tr.cleanEnergy?.batteryStorage;
      return v ? Math.round(v).toString() : undefined;
    },
  },
  // Line 6a: Fuel cell costs
  {
    pdfFieldName: `${P1}.f1_08[0]`,
    formLabel: 'Line 6a: Qualified fuel cell property costs',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const v = tr.cleanEnergy?.fuelCell;
      return v ? Math.round(v).toString() : undefined;
    },
  },
  // Line 6b: Fuel cell kilowatt capacity
  {
    pdfFieldName: `${P1}.f1_09[0]`,
    formLabel: 'Line 6b: Fuel cell kilowatt capacity',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const kw = tr.cleanEnergy?.fuelCellKW;
      return kw ? String(kw) : undefined;
    },
  },
  // Line 7: Total expenditures (add lines 1-5 and 6a)
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 7: Total qualified clean energy property costs',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.cleanEnergy?.totalExpenditures;
      return v ? Math.round(v).toString() : undefined;
    },
  },
  // Line 9: Applicable percentage (always 30%)
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 9: Applicable percentage',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.cleanEnergy ? '30' : undefined,
  },
  // Line 10: Multiply line 7 by 30%
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 10: Clean energy credit (line 7 x line 9)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.cleanEnergy?.currentYearCredit;
      return v ? Math.round(v).toString() : undefined;
    },
  },
  // Line 13: Credit carryforward from prior year
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 13: Credit carryforward from prior year',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.cleanEnergy?.priorYearCarryforward;
      return v ? Math.round(v).toString() : undefined;
    },
  },
  // Line 14: Total available credit (lines 10 + 11 + 13)
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    formLabel: 'Line 14: Total residential clean energy credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.cleanEnergy?.totalAvailableCredit;
      return v ? Math.round(v).toString() : undefined;
    },
  },
  // Line 30: Residential clean energy credit (final — to Schedule 3)
  {
    pdfFieldName: `${P1}.f1_30[0]`,
    formLabel: 'Line 30: Residential clean energy credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.cleanEnergy?.credit;
      return v ? Math.round(v).toString() : undefined;
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Part II — Energy Efficient Home Improvement Credit (Page 3)
  // ══════════════════════════════════════════════════════════════

  // The Part II credit is simpler: total expenditures × rates with per-item caps.
  // The engine computes the final credit directly.
  // We map the key summary fields.

  // Line 25: Total energy efficient home improvement credit
  {
    pdfFieldName: `${P3}.f3_35[0]`,
    formLabel: 'Line 25: Energy efficient home improvement credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.energyEfficiency?.credit;
      return v ? Math.round(v).toString() : undefined;
    },
  },
  // Line 30: Total residential energy credit (combined Part I + Part II)
  {
    pdfFieldName: `${P3}.f3_52[0]`,
    formLabel: 'Line 30: Total residential energy credits',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const cleanEnergy = calc.cleanEnergy?.credit ?? 0;
      const efficiency = calc.energyEfficiency?.credit ?? 0;
      const total = cleanEnergy + efficiency;
      return total ? Math.round(total).toString() : undefined;
    },
  },
];

export const FORM_5695_TEMPLATE: IRSFormTemplate = {
  formId: 'f5695',
  displayName: 'Form 5695',
  attachmentSequence: 158,
  pdfFileName: 'f5695.pdf',
  condition: (tr, calc) => {
    // Check for actual nonzero clean energy costs (not just property existence,
    // since visiting the step creates an all-zeros default object)
    const ce = tr.cleanEnergy;
    const hasCleanEnergy = (ce != null && (
      (ce.solarElectric ?? 0) > 0 || (ce.solarWaterHeating ?? 0) > 0 ||
      (ce.smallWindEnergy ?? 0) > 0 || (ce.geothermalHeatPump ?? 0) > 0 ||
      (ce.batteryStorage ?? 0) > 0 || (ce.fuelCell ?? 0) > 0 ||
      (ce.priorYearCarryforward ?? 0) > 0
    )) || (calc.cleanEnergy?.credit ?? 0) > 0;

    const ee = tr.energyEfficiency;
    const hasEfficiency = (ee != null && (
      (ee.heatPump ?? 0) > 0 || (ee.centralAC ?? 0) > 0 ||
      (ee.waterHeater ?? 0) > 0 || (ee.furnaceBoiler ?? 0) > 0 ||
      (ee.insulation ?? 0) > 0 || (ee.windows ?? 0) > 0 ||
      (ee.doors ?? 0) > 0 || (ee.electricalPanel ?? 0) > 0 ||
      (ee.homeEnergyAudit ?? 0) > 0
    )) || (calc.energyEfficiency?.credit ?? 0) > 0;

    return hasCleanEnergy || hasEfficiency;
  },
  fields: FORM_5695_FIELDS,
};
