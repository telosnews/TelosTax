/**
 * IRS Form 5500-EZ (2025) — AcroForm Field Mapping
 *
 * Annual Return of a One-Participant (Owners/Partners and Their Spouses)
 * Retirement Plan or a Foreign Plan.
 *
 * This form is filed SEPARATELY from Form 1040 (due July 31 for calendar-
 * year plans). TelosTax pre-fills it and includes it in the filing packet
 * as a convenience so the filer doesn't have to fill it out by hand.
 *
 * Required when Solo 401(k) plan assets exceed $250,000 at end of year.
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

/** Get the first business with a Solo 401(k) (usually the only one). */
function getSoloBusiness(tr: TaxReturn) {
  const businesses = tr.businesses || [];
  return businesses[0]; // Solo 401(k) is tied to the primary SE business
}

function buildFullName(tr: TaxReturn): string {
  return `${tr.firstName || ''} ${tr.lastName || ''}`.trim();
}

function buildAddress(tr: TaxReturn): string {
  return tr.addressStreet || '';
}

function buildCityStateZip(tr: TaxReturn): string {
  const parts: string[] = [];
  if (tr.addressCity) parts.push(tr.addressCity);
  if (tr.addressState) parts.push(tr.addressState);
  const cityState = parts.join(', ');
  if (tr.addressZip) return `${cityState} ${tr.addressZip}`;
  return cityState;
}

export const FORM_5500_EZ_FIELDS: IRSFieldMapping[] = [
  // ── Part I — Annual Return Identification ──

  // Plan year: calendar year 2025
  {
    pdfFieldName: `${P1}.begginning_date[0]`,
    formLabel: 'Plan year beginning date',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '01/01/2025',
  },
  {
    pdfFieldName: `${P1}.ending_date[0]`,
    formLabel: 'Plan year ending date',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '12/31/2025',
  },

  // ── Part II — Basic Plan Information ──

  // 1a: Name of plan
  {
    pdfFieldName: `${P1}.NameOfPlan[0]`,
    formLabel: 'Line 1a: Name of plan',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const sed = tr.selfEmploymentDeductions;
      if (sed?.solo401kPlanName) return sed.solo401kPlanName;
      return `${buildFullName(tr)} Solo 401(k) Plan`;
    },
  },
  // 1b: Three-digit plan number
  {
    pdfFieldName: `${P1}.ThreeDigitPlanNumber[0]`,
    formLabel: 'Line 1b: Three-digit plan number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.selfEmploymentDeductions?.solo401kPlanNumber || '001',
  },

  // 2a: Employer's name (business name or personal name)
  {
    pdfFieldName: `${P1}.Line2a_Fields[0].EmployersName[0]`,
    formLabel: 'Line 2a: Employer name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const biz = getSoloBusiness(tr);
      return biz?.businessName || buildFullName(tr);
    },
  },
  // Trade name
  {
    pdfFieldName: `${P1}.Line2a_Fields[0].TradeNameOfBusiness[0]`,
    formLabel: 'Line 2a: Trade name of business',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const biz = getSoloBusiness(tr);
      // Only fill if different from employer name
      if (biz?.businessName && buildFullName(tr) !== biz.businessName) {
        return buildFullName(tr);
      }
      return '';
    },
  },
  // Mailing address
  {
    pdfFieldName: `${P1}.Line2a_Fields[0].MailingAddress[0]`,
    formLabel: 'Line 2a: Mailing address',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => buildAddress(tr),
  },
  // City, state, ZIP
  {
    pdfFieldName: `${P1}.Line2a_Fields[0].CityTownState[0]`,
    formLabel: 'Line 2a: City, state, and ZIP',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => buildCityStateZip(tr),
  },
  // 2b: EIN
  {
    pdfFieldName: `${P1}.EmployerIdentificationNumber[0]`,
    formLabel: 'Line 2b: Employer identification number (EIN)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const sed = tr.selfEmploymentDeductions;
      if (sed?.solo401kPlanEIN) return sed.solo401kPlanEIN;
      const biz = getSoloBusiness(tr);
      return biz?.businessEin || '';
    },
  },
  // 2d: Business code
  {
    pdfFieldName: `${P1}.BusinessCode[0]`,
    formLabel: 'Line 2d: Business code',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const biz = getSoloBusiness(tr);
      return biz?.principalBusinessCode || '';
    },
  },

  // 3a: Plan administrator — "Same" for sole proprietor
  {
    pdfFieldName: `${P1}.Line3a_Fields[0].PlanAdministratorsName[0]`,
    formLabel: 'Line 3a: Plan administrator name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => 'Same',
  },

  // Repeat header fields on line 4 area (employer/plan name echo)
  {
    pdfFieldName: `${P1}.EmplpoyersName[0]`,
    formLabel: 'Line 4: Employer name (repeated)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const biz = getSoloBusiness(tr);
      return biz?.businessName || buildFullName(tr);
    },
  },
  {
    pdfFieldName: `${P1}.EIN[0]`,
    formLabel: 'Line 4: EIN (repeated)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const sed = tr.selfEmploymentDeductions;
      if (sed?.solo401kPlanEIN) return sed.solo401kPlanEIN;
      const biz = getSoloBusiness(tr);
      return biz?.businessEin || '';
    },
  },
  {
    pdfFieldName: `${P1}.PlanName[0]`,
    formLabel: 'Line 4: Plan name (repeated)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const sed = tr.selfEmploymentDeductions;
      if (sed?.solo401kPlanName) return sed.solo401kPlanName;
      return `${buildFullName(tr)} Solo 401(k) Plan`;
    },
  },
  {
    pdfFieldName: `${P1}.PN[0]`,
    formLabel: 'Line 4: Plan number (repeated)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.selfEmploymentDeductions?.solo401kPlanNumber || '001',
  },

  // 5a(1)-(2), 5b(1)-(2): Participant counts — Solo 401(k) = 1 participant
  {
    pdfFieldName: `${P1}.NumberParticipantsBeginning[0]`,
    formLabel: 'Line 5a(1): Total participants, beginning of year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '1',
  },
  {
    pdfFieldName: `${P1}.NumberActiveBeginning[0]`,
    formLabel: 'Line 5a(2): Active participants, beginning of year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '1',
  },
  {
    pdfFieldName: `${P1}.NumberParticipantsEnd[0]`,
    formLabel: 'Line 5b(1): Total participants, end of year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '1',
  },
  {
    pdfFieldName: `${P1}.NumberActiveEnd[0]`,
    formLabel: 'Line 5b(2): Active participants, end of year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '1',
  },
  // 5c: Terminated with < 100% vested — 0 for Solo 401(k)
  {
    pdfFieldName: `${P1}.NumberTerminatedEmplyment[0]`,
    formLabel: 'Line 5c: Participants terminated with less than 100% vested',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '0',
  },

  // ── Part III — Financial Information ──

  // 6a: Total plan assets — beginning of year
  {
    pdfFieldName: `${P1}.#subform[5].Table_Part3[0].Line6a[0].BeginningOfYear6a[0]`,
    formLabel: 'Line 6a: Total plan assets, beginning of year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => String(Math.round(tr.selfEmploymentDeductions?.solo401kPlanStartBalance || 0)),
  },
  // 6a: Total plan assets — end of year
  {
    pdfFieldName: `${P1}.#subform[5].Table_Part3[0].Line6a[0].EndOfYear6a[0]`,
    formLabel: 'Line 6a: Total plan assets, end of year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => String(Math.round(tr.selfEmploymentDeductions?.solo401kPlanBalance || 0)),
  },
  // 6b: Total plan liabilities — typically 0 for Solo 401(k)
  {
    pdfFieldName: `${P1}.#subform[5].Table_Part3[0].Line6b[0].BeginningOfYear6b[0]`,
    formLabel: 'Line 6b: Total plan liabilities, beginning of year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '0',
  },
  {
    pdfFieldName: `${P1}.#subform[5].Table_Part3[0].Line6b[0].EndOfYear6b[0]`,
    formLabel: 'Line 6b: Total plan liabilities, end of year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '0',
  },
  // 6c: Net plan assets (same as 6a since liabilities = 0)
  {
    pdfFieldName: `${P1}.#subform[5].Table_Part3[0].Line6c[0].BeginningOfYear6c[0]`,
    formLabel: 'Line 6c: Net plan assets, beginning of year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => String(Math.round(tr.selfEmploymentDeductions?.solo401kPlanStartBalance || 0)),
  },
  {
    pdfFieldName: `${P1}.#subform[5].Table_Part3[0].Line6c[0].EndOfYear6c[0]`,
    formLabel: 'Line 6c: Net plan assets, end of year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => String(Math.round(tr.selfEmploymentDeductions?.solo401kPlanBalance || 0)),
  },

  // ── Page 2 — Part III continued ──

  // 7a: Employer contributions
  {
    pdfFieldName: `${P2}.Employers[1]`,
    formLabel: 'Line 7a: Employer contributions',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const solo = calc.solo401k;
      return String(Math.round(solo?.appliedEmployerContribution || 0));
    },
  },
  // 7b: Participant contributions (employee deferrals)
  {
    pdfFieldName: `${P2}.Participants[1]`,
    formLabel: 'Line 7b: Participant contributions (employee deferrals)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const solo = calc.solo401k;
      return String(Math.round(solo?.appliedEmployeeDeferral || 0));
    },
  },
  // 7c: Others (including rollovers) — typically 0
  {
    pdfFieldName: `${P2}.OthersIncludingRollovers[0]`,
    formLabel: 'Line 7c: Other contributions including rollovers',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '0',
  },

  // ── Part IV — Plan Characteristics ──
  // Common codes for Solo 401(k):
  // 2T = 401(k) feature, 2R = profit-sharing, 3D = participant-directed
  {
    pdfFieldName: `${P2}.PlanCharacteristicsCodes1[0]`,
    formLabel: 'Line 8: Plan characteristics code 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '2T',
  },
  {
    pdfFieldName: `${P2}.PlanCharacteristicsCodes2[0]`,
    formLabel: 'Line 8: Plan characteristics code 2',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      // 2G = Roth 401(k) feature, if Roth deferrals were made
      const roth = tr.selfEmploymentDeductions?.solo401kRothDeferral || 0;
      return roth > 0 ? '2G' : '2R';
    },
  },
  {
    pdfFieldName: `${P2}.PlanCharacteristicsCodes3[0]`,
    formLabel: 'Line 8: Plan characteristics code 3',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const roth = tr.selfEmploymentDeductions?.solo401kRothDeferral || 0;
      return roth > 0 ? '2R' : '3D';
    },
  },
  {
    pdfFieldName: `${P2}.PlanCharacteristicsCodes4[0]`,
    formLabel: 'Line 8: Plan characteristics code 4',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const roth = tr.selfEmploymentDeductions?.solo401kRothDeferral || 0;
      return roth > 0 ? '3D' : '';
    },
  },

  // ── Part V — Compliance and Funding Questions ──

  // Line 9: Participant loans — No for typical Solo 401(k)
  {
    pdfFieldName: `${P2}.TagCorrectingSubform[0].c2_1[1]`,
    formLabel: 'Line 9: Were any plan assets used as security for a loan? (No)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: () => true, // Check "No"
  },
  // Line 10: Defined benefit plan — No
  {
    pdfFieldName: `${P2}.c2_2[1]`,
    formLabel: 'Line 10: Is this a defined benefit plan? (No)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: () => true, // Check "No"
  },
  // Line 11: Defined contribution subject to §412 minimum funding — No
  {
    pdfFieldName: `${P2}.c2_3[1]`,
    formLabel: 'Line 11: Is this plan subject to minimum funding standards? (No)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    checkWhen: () => true, // Check "No"
  },

  // Sign Here — print name
  {
    pdfFieldName: `${P2}.NameIndividualSigning[0]`,
    formLabel: 'Signature: Name of individual signing',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => buildFullName(tr),
  },
];

export const FORM_5500_EZ_TEMPLATE: IRSFormTemplate = {
  formId: 'f5500ez',
  displayName: 'Form 5500-EZ',
  // Form 5500-EZ is NOT part of the Form 1040 attachment sequence.
  // Using 999 to place it after all 1040-attached forms but before payment voucher.
  attachmentSequence: 999,
  pdfFileName: 'f5500ez.pdf',
  condition: (tr) => {
    const balance = tr.selfEmploymentDeductions?.solo401kPlanBalance || 0;
    return balance > 250000;
  },
  fields: FORM_5500_EZ_FIELDS,
};
