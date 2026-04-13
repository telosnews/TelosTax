/**
 * IRS Form 1040 (2025) — AcroForm Field Mapping
 *
 * Maps CalculationResult and TaxReturn fields to the IRS fillable
 * Form 1040 PDF field names. Field names discovered via enumerate-pdf-fields.ts.
 *
 * PDF: client/public/irs-forms/f1040.pdf (Form 1040, 2025, Created 9/5/25)
 * Total fields: 199
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult, Dependent } from '../types/index.js';
import { FilingStatus } from '../types/index.js';
import { parseDateString } from '../engine/utils.js';
import { isAge65OrOlder } from '../engine/form1040Sections.js';

// ─── Helper: is dependent under a given age at end of tax year? ───
// Uses parseDateString to avoid timezone hazards with new Date(string).
// Matches the engine's isUnderAge logic in credits.ts.
const TAX_YEAR = 2025;
function isDepUnder17(dep: Dependent | undefined): boolean {
  if (!dep?.dateOfBirth) return false;
  const dob = parseDateString(dep.dateOfBirth);
  if (!dob) return false;
  const endOfYear = new Date(TAX_YEAR, 11, 31); // Dec 31 of tax year
  const turns17 = new Date(dob.year + 17, dob.month, dob.day);
  return turns17 > endOfYear;
}

// ─── Helper: format dollar amount as whole number string ───
function dollarStr(val: number | undefined): string {
  if (val === undefined || val === null || val === 0) return '';
  return Math.round(val).toString();
}

// ─── Page 1 field name prefix ───
const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

export const FORM_1040_FIELDS: IRSFieldMapping[] = [
  // ════════════════════════════════════════════════════════════════
  // PAGE 1 — Header / Personal Info
  // ════════════════════════════════════════════════════════════════

  // ── Header line (tax year / calendar year fields) ──
  // f1_01: Header "beginning" name (non-calendar year only — skip for most returns)
  // f1_02: Header "ending" name (non-calendar year only — skip for most returns)
  // f1_03: Header ending year (2-digit, non-calendar year only — skip)

  // c1_1: Filed pursuant to section 301.9100-2
  // c1_2: Combat zone
  {
    pdfFieldName: `${P1}.c1_2[0]`,
    sourcePath: 'isActiveDutyMilitary',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === true,
    editable: true,
    formLabel: 'Combat zone extension',
  },
  // f1_04: Tax year beginning date (if not calendar year)
  // c1_3: Other checkbox
  // f1_05..f1_07: Deceased MM/DD/YYYY fields (taxpayer)
  // f1_08..f1_10: Spouse deceased MM/DD/YYYY fields

  // ── y≈710: "Other" row — c1_4 checkbox, f1_11/f1_12/f1_13 (skip for normal returns) ──
  // c1_4: "Other" checkbox
  // f1_11: "Other" text field 1 (x=68, w=168)
  // f1_12: "Other" text field 2 (x=239, w=171)
  // f1_13: "Other" text field 3 (x=411, w=165)

  // ── y≈684: Your first name / Last name / Your SSN ──
  // f1_14: Your first name and middle initial
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    sourcePath: 'firstName',
    source: 'taxReturn',
    format: 'string',
    editable: true,
    formLabel: 'Your first name and middle initial',
  },
  // f1_15: Last name
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    sourcePath: 'lastName',
    source: 'taxReturn',
    format: 'string',
    editable: true,
    formLabel: 'Your last name',
  },
  // f1_16: Your social security number (maxLen=9)
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
    formLabel: 'Your social security number',
  },

  // ── y≈660: Spouse's first name / Last name / Spouse's SSN ──
  // f1_17: Spouse's first name and middle initial
  {
    pdfFieldName: `${P1}.f1_17[0]`,
    sourcePath: 'spouseFirstName',
    source: 'taxReturn',
    format: 'string',
    editable: true,
    formLabel: "Spouse's first name and middle initial",
  },
  // f1_18: Spouse's last name
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    sourcePath: 'spouseLastName',
    source: 'taxReturn',
    format: 'string',
    editable: true,
    formLabel: "Spouse's last name",
  },
  // f1_19: Spouse's social security number (maxLen=9)
  {
    pdfFieldName: `${P1}.f1_19[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.spouseSsn?.replace(/\D/g, '') || tr.spouseSsnLastFour || '',
    formLabel: "Spouse's social security number",
  },

  // ── Address ──
  // Address_ReadOrder group:
  // f1_20: Home address (street)
  {
    pdfFieldName: `${P1}.Address_ReadOrder[0].f1_20[0]`,
    sourcePath: 'addressStreet',
    source: 'taxReturn',
    format: 'string',
    editable: true,
    formLabel: 'Home address (number and street)',
  },
  // f1_21: Apt. no. (no field on TaxReturn — skip for now)
  // f1_22: City
  {
    pdfFieldName: `${P1}.Address_ReadOrder[0].f1_22[0]`,
    sourcePath: 'addressCity',
    source: 'taxReturn',
    format: 'string',
    editable: true,
    formLabel: 'City, town, or post office',
  },
  // f1_23: State
  {
    pdfFieldName: `${P1}.Address_ReadOrder[0].f1_23[0]`,
    sourcePath: 'addressState',
    source: 'taxReturn',
    format: 'string',
    editable: true,
    formLabel: 'State',
  },
  // f1_24: ZIP code
  {
    pdfFieldName: `${P1}.Address_ReadOrder[0].f1_24[0]`,
    sourcePath: 'addressZip',
    source: 'taxReturn',
    format: 'string',
    editable: true,
    formLabel: 'ZIP code',
  },
  // f1_25: Foreign country name
  // f1_26: Foreign province/state/county
  // f1_27: Foreign postal code

  // ── Filing Status ──
  // Based on visual position analysis:
  //   c1_5 (y≈637, x=568) = "Check here if your main home" checkbox (NOT filing status)
  //   c1_6 (y≈590, x=482) = Presidential Campaign Fund — You
  {
    pdfFieldName: `${P1}.c1_6[0]`,
    sourcePath: 'presidentialCampaignFund',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === true,
    formLabel: 'Presidential Campaign Fund: You',
  },
  //   c1_7 (y≈590, x=526) = Presidential Campaign Fund — Spouse
  {
    pdfFieldName: `${P1}.c1_7[0]`,
    sourcePath: 'spousePresidentialCampaignFund',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === true,
    formLabel: 'Presidential Campaign Fund: Spouse',
  },
  //   CB.c1_8[0] (y≈578, x=98) = Single
  //   CB.c1_8[1] (y≈566, x=98) = MFJ
  //   CB.c1_8[2] (y≈554, x=98) = MFS
  //   c1_8[0] (y≈578, x=350) = HOH
  //   c1_8[1] (y≈566, x=350) = QSS

  // Single
  {
    pdfFieldName: `${P1}.Checkbox_ReadOrder[0].c1_8[0]`,
    sourcePath: 'filingStatus',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === FilingStatus.Single,
    formLabel: 'Filing status: Single',
  },
  // Married filing jointly
  {
    pdfFieldName: `${P1}.Checkbox_ReadOrder[0].c1_8[1]`,
    sourcePath: 'filingStatus',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === FilingStatus.MarriedFilingJointly,
    formLabel: 'Filing status: Married filing jointly',
  },
  // Married filing separately
  {
    pdfFieldName: `${P1}.Checkbox_ReadOrder[0].c1_8[2]`,
    sourcePath: 'filingStatus',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === FilingStatus.MarriedFilingSeparately,
    formLabel: 'Filing status: Married filing separately',
  },
  // Head of household
  {
    pdfFieldName: `${P1}.c1_8[0]`,
    sourcePath: 'filingStatus',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === FilingStatus.HeadOfHousehold,
    formLabel: 'Filing status: Head of household',
  },
  // Qualifying surviving spouse (QSS)
  {
    pdfFieldName: `${P1}.c1_8[1]`,
    sourcePath: 'filingStatus',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === FilingStatus.QualifyingSurvivingSpouse,
    formLabel: 'Filing status: Qualifying surviving spouse',
  },

  // ── Digital Assets ──
  // c1_10[0]: Digital assets Yes, c1_10[1]: No
  {
    pdfFieldName: `${P1}.c1_10[0]`,
    sourcePath: 'digitalAssetActivity',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === true,
    formLabel: 'Digital assets: Yes',
  },
  {
    pdfFieldName: `${P1}.c1_10[1]`,
    sourcePath: 'digitalAssetActivity',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === false,
    formLabel: 'Digital assets: No',
  },

  // ── Dependents (up to 4) ──
  // Table is organized by FIELD TYPE (rows), not by dependent:
  //   Row1 = (1) First name:   f1_31=Dep1, f1_32=Dep2, f1_33=Dep3, f1_34=Dep4
  //   Row2 = (2) Last name:    f1_35=Dep1, f1_36=Dep2, f1_37=Dep3, f1_38=Dep4
  //   Row3 = (3) SSN:          f1_39=Dep1, f1_40=Dep2, f1_41=Dep3, f1_42=Dep4
  //   Row4 = (4) Relationship: f1_43=Dep1, f1_44=Dep2, f1_45=Dep3, f1_46=Dep4

  // Row 1 — First names
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row1[0].f1_31[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[0]?.firstName || '',
    formLabel: 'Dependent 1: First name',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row1[0].f1_32[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[1]?.firstName || '',
    formLabel: 'Dependent 2: First name',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row1[0].f1_33[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[2]?.firstName || '',
    formLabel: 'Dependent 3: First name',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row1[0].f1_34[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[3]?.firstName || '',
    formLabel: 'Dependent 4: First name',
  },

  // Row 2 — Last names
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row2[0].f1_35[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[0]?.lastName || '',
    formLabel: 'Dependent 1: Last name',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row2[0].f1_36[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[1]?.lastName || '',
    formLabel: 'Dependent 2: Last name',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row2[0].f1_37[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[2]?.lastName || '',
    formLabel: 'Dependent 3: Last name',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row2[0].f1_38[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[3]?.lastName || '',
    formLabel: 'Dependent 4: Last name',
  },

  // Row 3 — SSNs
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row3[0].f1_39[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[0]?.ssn?.replace(/\D/g, '') || tr.dependents?.[0]?.ssnLastFour || '',
    formLabel: 'Dependent 1: SSN',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row3[0].f1_40[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[1]?.ssn?.replace(/\D/g, '') || tr.dependents?.[1]?.ssnLastFour || '',
    formLabel: 'Dependent 2: SSN',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row3[0].f1_41[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[2]?.ssn?.replace(/\D/g, '') || tr.dependents?.[2]?.ssnLastFour || '',
    formLabel: 'Dependent 3: SSN',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row3[0].f1_42[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[3]?.ssn?.replace(/\D/g, '') || tr.dependents?.[3]?.ssnLastFour || '',
    formLabel: 'Dependent 4: SSN',
  },

  // Row 4 — Relationships
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row4[0].f1_43[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[0]?.relationship || '',
    formLabel: 'Dependent 1: Relationship',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row4[0].f1_44[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[1]?.relationship || '',
    formLabel: 'Dependent 2: Relationship',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row4[0].f1_45[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[2]?.relationship || '',
    formLabel: 'Dependent 3: Relationship',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row4[0].f1_46[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.dependents?.[3]?.relationship || '',
    formLabel: 'Dependent 4: Relationship',
  },

  // Dependent credit checkboxes (Row 7):
  // c1_28[0] = child tax credit dep 1, c1_28[1] = credit for other dependents dep 1
  // c1_29[0] = child tax credit dep 2, c1_29[1] = credit for other dependents dep 2
  // c1_30[0] = child tax credit dep 3, c1_30[1] = credit for other dependents dep 3
  // c1_31[0] = child tax credit dep 4, c1_31[1] = credit for other dependents dep 4
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row7[0].Dependent1[0].c1_28[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => isDepUnder17(tr.dependents?.[0]),
    formLabel: 'Dependent 1: Child tax credit',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row7[0].Dependent1[0].c1_28[1]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => {
      const dep = tr.dependents?.[0];
      if (!dep) return false;
      return !isDepUnder17(dep);
    },
    formLabel: 'Dependent 1: Credit for other dependents',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row7[0].Dependent2[0].c1_29[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => isDepUnder17(tr.dependents?.[1]),
    formLabel: 'Dependent 2: Child tax credit',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row7[0].Dependent2[0].c1_29[1]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => {
      const dep = tr.dependents?.[1];
      if (!dep) return false;
      return !isDepUnder17(dep);
    },
    formLabel: 'Dependent 2: Credit for other dependents',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row7[0].Dependent3[0].c1_30[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => isDepUnder17(tr.dependents?.[2]),
    formLabel: 'Dependent 3: Child tax credit',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row7[0].Dependent3[0].c1_30[1]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => {
      const dep = tr.dependents?.[2];
      if (!dep) return false;
      return !isDepUnder17(dep);
    },
    formLabel: 'Dependent 3: Credit for other dependents',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row7[0].Dependent4[0].c1_31[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => isDepUnder17(tr.dependents?.[3]),
    formLabel: 'Dependent 4: Child tax credit',
  },
  {
    pdfFieldName: `${P1}.Table_Dependents[0].Row7[0].Dependent4[0].c1_31[1]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => {
      const dep = tr.dependents?.[3];
      if (!dep) return false;
      return !isDepUnder17(dep);
    },
    formLabel: 'Dependent 4: Credit for other dependents',
  },

  // ════════════════════════════════════════════════════════════════
  // PAGE 1 — Income Section
  // ════════════════════════════════════════════════════════════════

  // f1_47: Line 1a — Total wages from W-2, box 1
  {
    pdfFieldName: `${P1}.f1_47[0]`,
    sourcePath: 'form1040.totalWages',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 1a: Total wages, salaries, tips',
  },
  // f1_48: Line 1b — Household employee wages (not on W-2)
  {
    pdfFieldName: `${P1}.f1_48[0]`,
    sourcePath: 'householdEmployees.totalCashWages',
    source: 'taxReturn',
    format: 'dollarNoCents',
    formLabel: 'Line 1b: Household employee wages',
  },
  // f1_49: Line 1c — Tip income not reported on line 1a
  {
    pdfFieldName: `${P1}.f1_49[0]`,
    sourcePath: 'form4137.unreportedTips',
    source: 'taxReturn',
    format: 'dollarNoCents',
    formLabel: 'Line 1c: Tip income not on line 1a',
  },
  // f1_50: Line 1d — Medicaid waiver payments (not yet supported)
  // f1_51: Line 1e — Taxable dependent care benefits (Form 2441)
  {
    pdfFieldName: `${P1}.f1_51[0]`,
    sourcePath: 'dependentCare.employerBenefitsTaxable',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 1e: Taxable dependent care benefits',
  },
  // f1_52: Line 1f — Employer-provided adoption benefits (Form 8839 — not yet supported)
  // f1_53: Line 1g — Wages from Form 8919 (not yet supported)
  // f1_54: Line 1h — Other earned income (not yet supported)
  // f1_55: Line 1h — Other earned income (amount)
  // f1_56: Line 1i — Nontaxable combat pay
  {
    pdfFieldName: `${P1}.f1_56[0]`,
    sourcePath: 'nontaxableCombatPay',
    source: 'taxReturn',
    format: 'dollarNoCents',
    editable: true,
    formLabel: 'Line 1i: Nontaxable combat pay election',
  },
  // f1_57: Line 1z — Add lines 1a through 1h
  {
    pdfFieldName: `${P1}.f1_57[0]`,
    sourcePath: 'form1040.totalWages',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 1z: Total of lines 1a through 1h',
  },

  // f1_58: Line 2a — Tax-exempt interest (informational)
  {
    pdfFieldName: `${P1}.f1_58[0]`,
    sourcePath: 'form1040.taxExemptInterest',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 2a: Tax-exempt interest',
  },
  // f1_59: Line 2b — Taxable interest
  {
    pdfFieldName: `${P1}.f1_59[0]`,
    sourcePath: 'form1040.totalInterest',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 2b: Taxable interest',
  },
  // f1_60: Line 3a — Qualified dividends (informational)
  {
    pdfFieldName: `${P1}.f1_60[0]`,
    sourcePath: 'form1040.qualifiedDividends',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 3a: Qualified dividends',
  },
  // f1_61: Line 3b — Ordinary dividends
  {
    pdfFieldName: `${P1}.f1_61[0]`,
    sourcePath: 'form1040.totalDividends',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 3b: Ordinary dividends',
  },

  // c1_33/c1_34: Line 3c — Child's dividends checkboxes (skip — rare)

  // f1_62: Line 4a — IRA distributions (gross)
  {
    pdfFieldName: `${P1}.f1_62[0]`,
    sourcePath: 'form1040.iraDistributionsGross',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 4a: IRA distributions',
  },
  // f1_63: Line 4b — Taxable amount
  {
    pdfFieldName: `${P1}.f1_63[0]`,
    sourcePath: 'form1040.iraDistributionsTaxable',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 4b: IRA distributions, taxable amount',
  },

  // c1_35/c1_36/c1_37: Line 4c checkboxes (Rollover, QCD)
  // f1_64: Line 4c "3" field (QCD/other amount — skip for now)

  // f1_65: Line 5a — Pensions and annuities (gross)
  {
    pdfFieldName: `${P1}.f1_65[0]`,
    sourcePath: 'form1040.pensionDistributionsGross',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 5a: Pensions and annuities',
  },
  // f1_66: Line 5b — Taxable amount
  {
    pdfFieldName: `${P1}.f1_66[0]`,
    sourcePath: 'form1040.pensionDistributionsTaxable',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 5b: Pensions and annuities, taxable amount',
  },

  // c1_38/c1_39/c1_40: Line 5c checkboxes (Rollover, PSO)
  // f1_67: Line 5c "3" field (PSO amount — skip for now)

  // f1_68: Line 6a — Social security benefits
  {
    pdfFieldName: `${P1}.f1_68[0]`,
    sourcePath: 'form1040.socialSecurityBenefits',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 6a: Social security benefits',
  },
  // f1_69: Line 6b — Taxable amount
  {
    pdfFieldName: `${P1}.f1_69[0]`,
    sourcePath: 'form1040.taxableSocialSecurity',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 6b: Social security, taxable amount',
  },

  // c1_41: Line 6c checkbox (lump-sum election)
  // c1_42: Line 6d checkbox (MFS lived apart)

  // f1_70: Line 7a — Capital gain or (loss)
  {
    pdfFieldName: `${P1}.f1_70[0]`,
    sourcePath: 'form1040.capitalGainOrLoss',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 7: Capital gain or (loss)',
  },

  // c1_43/c1_44: Line 7b checkboxes (Schedule D not required, child's capital gain)
  // f1_71: Line 7b field (child's capital gain amount — skip)

  // f1_72: Line 8 — Additional income from Schedule 1, line 10
  {
    pdfFieldName: `${P1}.f1_72[0]`,
    sourcePath: 'form1040.additionalIncome',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 8: Other income from Schedule 1',
  },

  // f1_73: Line 9 — Total income
  {
    pdfFieldName: `${P1}.f1_73[0]`,
    sourcePath: 'form1040.totalIncome',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 9: Total income',
  },

  // f1_74: Line 10 — Adjustments to income from Schedule 1, line 26
  {
    pdfFieldName: `${P1}.f1_74[0]`,
    sourcePath: 'form1040.totalAdjustments',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 10: Adjustments to income',
  },

  // f1_75: Line 11a — Adjusted gross income (AGI)
  {
    pdfFieldName: `${P1}.f1_75[0]`,
    sourcePath: 'form1040.agi',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 11: Adjusted gross income (AGI)',
  },

  // ════════════════════════════════════════════════════════════════
  // PAGE 2 — Tax, Credits, Payments, Refund/Owed
  // ════════════════════════════════════════════════════════════════

  // f2_01: Line 11b — AGI (repeated from page 1)
  {
    pdfFieldName: `${P2}.f2_01[0]`,
    sourcePath: 'form1040.agi',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 11: AGI (page 2 repeat)',
  },

  // c2_1..c2_8: Standard deduction qualifier checkboxes
  // c2_1: Someone can claim you as a dependent
  {
    pdfFieldName: `${P2}.c2_1[0]`,
    sourcePath: 'canBeClaimedAsDependent',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === true,
    formLabel: 'Someone can claim you as a dependent',
  },
  // c2_2: You as a dependent (same flag — IRS uses two checkboxes but same question)
  // c2_3: Spouse itemizes on separate return or dual-status alien (skip — rare edge case)
  // c2_4: Dual-status alien (not yet supported)
  // c2_5: Born before January 2, 1961 (age 65+)
  {
    pdfFieldName: `${P2}.c2_5[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => isAge65OrOlder(tr.dateOfBirth, tr.taxYear),
    formLabel: 'Born before January 2, 1961',
  },
  // c2_6: Are blind
  {
    pdfFieldName: `${P2}.c2_6[0]`,
    sourcePath: 'isLegallyBlind',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === true,
    formLabel: 'You are blind',
  },
  // c2_7: Spouse born before January 2, 1961 (age 65+)
  {
    pdfFieldName: `${P2}.c2_7[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => isAge65OrOlder(tr.spouseDateOfBirth, tr.taxYear),
    formLabel: 'Spouse born before January 2, 1961',
  },
  // c2_8: Spouse is blind
  {
    pdfFieldName: `${P2}.c2_8[0]`,
    sourcePath: 'spouseIsLegallyBlind',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: (v) => v === true,
    formLabel: 'Spouse is blind',
  },

  // f2_02: Line 12e — Standard deduction or itemized deductions
  {
    pdfFieldName: `${P2}.f2_02[0]`,
    sourcePath: 'form1040.deductionAmount',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 12: Standard or itemized deductions',
  },

  // f2_03: Line 13a — Qualified business income deduction (§199A)
  {
    pdfFieldName: `${P2}.f2_03[0]`,
    sourcePath: 'form1040.qbiDeduction',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 13a: Qualified business income deduction',
  },

  // f2_04: Line 13b — Schedule 1-A deduction (OBBBA)
  {
    pdfFieldName: `${P2}.f2_04[0]`,
    sourcePath: 'form1040.schedule1ADeduction',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 13b: Charitable deduction (OBBBA)',
  },

  // f2_05: Line 14 — Add lines 12e, 13a, and 13b
  {
    pdfFieldName: `${P2}.f2_05[0]`,
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const total = (calc.form1040.deductionAmount || 0) +
        (calc.form1040.qbiDeduction || 0) +
        (calc.form1040.schedule1ADeduction || 0);
      return total ? Math.round(total).toString() : '';
    },
    formLabel: 'Line 14: Total deductions',
  },

  // f2_06: Line 15 — Taxable income
  {
    pdfFieldName: `${P2}.f2_06[0]`,
    sourcePath: 'form1040.taxableIncome',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 15: Taxable income',
  },

  // f2_07: Line 16 "3" field (form number for checkbox — skip)
  // f2_08: Line 16 — Tax (from tax table or worksheet)
  {
    pdfFieldName: `${P2}.f2_08[0]`,
    sourcePath: 'form1040.incomeTax',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 16: Tax',
  },

  // f2_09: Line 17 — Amount from Schedule 2, line 3
  {
    pdfFieldName: `${P2}.f2_09[0]`,
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // Schedule 2 Part I, Line 3 = AMT + excess premium credit repayment
      // For most returns this is 0
      return '';
    },
    formLabel: 'Line 17: Amount from Schedule 2, Part I',
  },

  // f2_10: Line 18 — Add lines 16 and 17
  {
    pdfFieldName: `${P2}.f2_10[0]`,
    sourcePath: 'form1040.incomeTax',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 18: Tax plus Schedule 2',
  },

  // f2_11: Line 19 — Child tax credit or credit for other dependents
  {
    pdfFieldName: `${P2}.f2_11[0]`,
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const ctc = (calc.credits?.childTaxCredit || 0) + (calc.credits?.otherDependentCredit || 0);
      return ctc ? Math.round(ctc).toString() : '';
    },
    formLabel: 'Line 19: Child tax credit / other dependent credit',
  },

  // f2_12: Line 20 — Amount from Schedule 3, line 8
  {
    pdfFieldName: `${P2}.f2_12[0]`,
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // Schedule 3 Part I total nonrefundable credits
      const credits = calc.credits;
      if (!credits) return '';
      const total = (credits.foreignTaxCredit || 0) +
        (credits.dependentCareCredit || 0) +
        (credits.educationCredit || 0) +
        (credits.saversCredit || 0) +
        (credits.cleanEnergyCredit || 0) +
        (credits.energyEfficiencyCredit || 0) +
        (credits.evCredit || 0) +
        (credits.adoptionCredit || 0) +
        (credits.elderlyDisabledCredit || 0) +
        (credits.evRefuelingCredit || 0);
      return total ? Math.round(total).toString() : '';
    },
    formLabel: 'Line 20: Schedule 3 nonrefundable credits',
  },

  // f2_13: Line 21 — Add lines 19 and 20
  {
    pdfFieldName: `${P2}.f2_13[0]`,
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const ctc = (calc.credits?.childTaxCredit || 0) + (calc.credits?.otherDependentCredit || 0);
      const credits = calc.credits;
      const sch3 = credits ? (
        (credits.foreignTaxCredit || 0) + (credits.dependentCareCredit || 0) +
        (credits.educationCredit || 0) + (credits.saversCredit || 0) +
        (credits.cleanEnergyCredit || 0) + (credits.energyEfficiencyCredit || 0) +
        (credits.evCredit || 0) + (credits.adoptionCredit || 0) +
        (credits.elderlyDisabledCredit || 0) + (credits.evRefuelingCredit || 0)
      ) : 0;
      const total = ctc + sch3;
      return total ? Math.round(total).toString() : '';
    },
    formLabel: 'Line 21: Total credits',
  },

  // f2_14: Line 22 — Subtract line 21 from line 18 (tax after credits)
  {
    pdfFieldName: `${P2}.f2_14[0]`,
    sourcePath: 'form1040.taxAfterCredits',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 22: Tax after credits',
  },

  // f2_15: Line 23 — Other taxes from Schedule 2, line 21
  {
    pdfFieldName: `${P2}.f2_15[0]`,
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // Schedule 2 Part II total = SE tax + household employment + additional Medicare + NIIT + penalties
      const seTax = calc.form1040.seTax || 0;
      const schedH = calc.form1040.householdEmploymentTax || 0;
      const addlMedicare = calc.form1040.additionalMedicareTaxW2 || 0;
      const niit = calc.form1040.niitTax || 0;
      const total = seTax + schedH + addlMedicare + niit;
      return total ? Math.round(total).toString() : '';
    },
    formLabel: 'Line 23: Other taxes from Schedule 2',
  },

  // f2_16: Line 24 — Total tax
  {
    pdfFieldName: `${P2}.f2_16[0]`,
    sourcePath: 'form1040.totalTax',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 24: Total tax',
  },

  // ── Payments Section ──

  // f2_17: Line 25a — Federal income tax withheld from Form(s) W-2
  {
    pdfFieldName: `${P2}.f2_17[0]`,
    sourcePath: 'form1040.w2Withholding',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 25a: W-2 federal withholding',
  },

  // SSN_ReadOrder: f2_22 — SSN (for page 2 header)
  {
    pdfFieldName: `${P2}.SSN_ReadOrder[0].f2_22[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
    formLabel: 'Page 2: SSN',
  },

  // f2_18: Line 25b — Form(s) 1099 withholding
  {
    pdfFieldName: `${P2}.f2_18[0]`,
    sourcePath: 'form1040.form1099Withholding',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 25b: 1099 withholding',
  },

  // f2_19: Line 25c — Other forms withholding (not yet supported)

  // f2_20: Line 25d — Total (add lines 25a through 25c)
  {
    pdfFieldName: `${P2}.f2_20[0]`,
    sourcePath: 'form1040.totalWithholding',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 25d: Total federal withholding',
  },

  // f2_21: Line 26 — Estimated tax payments
  {
    pdfFieldName: `${P2}.f2_21[0]`,
    sourcePath: 'form1040.estimatedPayments',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 26: Estimated tax payments',
  },

  // f2_23: Line 27a — Earned income credit (EIC)
  // (f2_22 is SSN on page 2 header)
  {
    pdfFieldName: `${P2}.f2_23[0]`,
    sourcePath: 'credits.eitcCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 27: Earned income credit (EIC)',
  },

  // c2_12/c2_13: Line 27/28 checkboxes
  // f2_24: Line 28 — Additional child tax credit (ACTC) from Schedule 8812
  {
    pdfFieldName: `${P2}.f2_24[0]`,
    sourcePath: 'credits.actcCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 28: Additional child tax credit',
  },

  // f2_25: Line 29 — American opportunity credit from Form 8863, line 8
  {
    pdfFieldName: `${P2}.f2_25[0]`,
    sourcePath: 'credits.aotcRefundableCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 29: American opportunity credit',
  },

  // f2_26: Line 30 — Refundable adoption credit from Form 8839

  // f2_27: Line 31 — Amount from Schedule 3, line 15
  {
    pdfFieldName: `${P2}.f2_27[0]`,
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // Schedule 3 Part II total = PTC + excess SS + other refundable
      const ptc = calc.form1040.premiumTaxCreditNet || 0;
      const excessSS = calc.credits?.excessSSTaxCredit || 0;
      const total = ptc + excessSS;
      return total ? Math.round(total).toString() : '';
    },
    formLabel: 'Line 31: Schedule 3 refundable credits',
  },

  // f2_28: Line 32 — Total other payments and refundable credits
  {
    pdfFieldName: `${P2}.f2_28[0]`,
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const eic = calc.credits?.eitcCredit || 0;
      const actc = calc.credits?.actcCredit || 0;
      const aotc = calc.credits?.aotcRefundableCredit || 0;
      const ptc = calc.form1040.premiumTaxCreditNet || 0;
      const excessSS = calc.credits?.excessSSTaxCredit || 0;
      const total = eic + actc + aotc + ptc + excessSS;
      return total ? Math.round(total).toString() : '';
    },
    formLabel: 'Line 32: Total other payments and refundable credits',
  },

  // f2_29: Line 33 — Total payments
  {
    pdfFieldName: `${P2}.f2_29[0]`,
    sourcePath: 'form1040.totalPayments',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 33: Total payments',
  },

  // f2_30: Line 34 — Overpaid amount (if line 33 > line 24)
  {
    pdfFieldName: `${P2}.f2_30[0]`,
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const overpaid = calc.form1040.refundAmount || 0;
      return overpaid > 0 ? Math.round(overpaid).toString() : '';
    },
    formLabel: 'Line 34: Overpayment',
  },

  // f2_31: Line 35a — Refund amount
  {
    pdfFieldName: `${P2}.f2_31[0]`,
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const refund = calc.form1040.refundAmount || 0;
      return refund > 0 ? Math.round(refund).toString() : '';
    },
    formLabel: 'Line 35a: Refund amount',
  },

  // c2_15: Form 8888 attached checkbox (not used — single account only)

  // f2_32: Line 35b — Routing number (inside RoutingNo container)
  {
    pdfFieldName: `${P2}.RoutingNo[0].f2_32[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.directDeposit?.routingNumber || '',
    formLabel: 'Line 35b: Routing number',
  },

  // f2_33: Line 35c — Account number (inside AccountNo container)
  {
    pdfFieldName: `${P2}.AccountNo[0].f2_33[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.directDeposit?.accountNumber || '',
    formLabel: 'Line 35c: Account number',
  },

  // c2_16[0]: Checking checkbox
  {
    pdfFieldName: `${P2}.c2_16[0]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.directDeposit?.accountType === 'checking',
    formLabel: 'Direct deposit: Checking',
  },

  // c2_16[1]: Savings checkbox
  {
    pdfFieldName: `${P2}.c2_16[1]`,
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.directDeposit?.accountType === 'savings',
    formLabel: 'Direct deposit: Savings',
  },

  // f2_35: Line 36 — Amount applied to next year estimated tax (not yet supported)

  // f2_36: Line 37 — Amount you owe
  {
    pdfFieldName: `${P2}.f2_36[0]`,
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const owed = calc.form1040.amountOwed || 0;
      return owed > 0 ? Math.round(owed).toString() : '';
    },
    formLabel: 'Line 37: Amount you owe',
  },

  // Line 38 — Estimated tax penalty (Form 2210)
  // Note: field position TBD — may need verification for penalty line
  {
    pdfFieldName: `${P2}.f2_34[0]`,
    sourcePath: 'form1040.estimatedTaxPenalty',
    source: 'calculationResult',
    format: 'dollarNoCents',
    formLabel: 'Line 38: Estimated tax penalty',
  },

  // c2_17[0]: Third party designee Yes, c2_17[1]: No
  // f2_37..f2_51: Signatures, preparer info, etc. (mostly skip — not auto-filled)

  // ── Identity Protection PINs (Sign Here section) ──
  // f2_41: Your Identity Protection PIN (maxLen=6)
  {
    pdfFieldName: `${P2}.f2_41[0]`,
    sourcePath: 'ipPin',
    source: 'taxReturn',
    format: 'string',
    editable: true,
    formLabel: 'Your Identity Protection PIN',
  },
  // f2_43: Spouse's Identity Protection PIN (maxLen=6)
  {
    pdfFieldName: `${P2}.f2_43[0]`,
    sourcePath: 'spouseIpPin',
    source: 'taxReturn',
    format: 'string',
    editable: true,
    formLabel: "Spouse's Identity Protection PIN",
  },
];

// ─── Form Template Definition ────────────────────────────────────

export const FORM_1040_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040',
  displayName: 'Form 1040',
  attachmentSequence: 0,
  pdfFileName: 'f1040.pdf',
  condition: () => true, // Always included
  fields: FORM_1040_FIELDS,
};
