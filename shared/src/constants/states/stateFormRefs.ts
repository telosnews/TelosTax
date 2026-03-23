/**
 * State Tax Form Line References — TY 2025
 *
 * Maps state codes to the official form names and key line numbers
 * used in calculation trace authority fields. These reference the
 * 2025 tax year forms from each state's Department of Revenue.
 *
 * Sourced from: docs/state-tax-booklets/*.pdf
 */

export interface StateFormLineRefs {
  /** Form name, e.g. "PA-40" */
  formName: string;
  /** Line where Federal AGI or starting income appears */
  agiLine?: string;
  /** Line for state taxable income */
  taxableIncomeLine?: string;
  /** Line for computed income tax */
  incomeTaxLine?: string;
  /** Line for total tax after credits */
  totalTaxLine?: string;
  /** Line for refund or amount owed */
  refundLine?: string;
}

// ─── Flat-Tax States (13) ────────────────────────────────────────────
const PA: StateFormLineRefs = {
  formName: 'PA-40',
  agiLine: 'PA-40, Lines 1–8 (PA income classes)',
  taxableIncomeLine: 'PA-40, Line 9',
  incomeTaxLine: 'PA-40, Line 12',
  totalTaxLine: 'PA-40, Line 28',
  refundLine: 'PA-40, Line 30',
};

const IL: StateFormLineRefs = {
  formName: 'IL-1040',
  agiLine: 'IL-1040, Line 1',
  taxableIncomeLine: 'IL-1040, Line 11',
  incomeTaxLine: 'IL-1040, Line 12',
  totalTaxLine: 'IL-1040, Line 24',
  refundLine: 'IL-1040, Line 38',
};

const MA: StateFormLineRefs = {
  formName: 'Form 1',
  agiLine: 'Form 1, Line 10',
  taxableIncomeLine: 'Form 1, Line 14',
  incomeTaxLine: 'Form 1, Line 19',
  totalTaxLine: 'Form 1, Line 28',
  refundLine: 'Form 1, Line 37',
};

const NC: StateFormLineRefs = {
  formName: 'D-400',
  agiLine: 'D-400, Line 6',
  taxableIncomeLine: 'D-400, Line 12a',
  incomeTaxLine: 'D-400, Line 12b',
  totalTaxLine: 'D-400, Line 15',
  refundLine: 'D-400, Line 27',
};

const MI: StateFormLineRefs = {
  formName: 'MI-1040',
  agiLine: 'MI-1040, Line 10',
  taxableIncomeLine: 'MI-1040, Line 16',
  incomeTaxLine: 'MI-1040, Line 17',
  totalTaxLine: 'MI-1040, Line 23',
  refundLine: 'MI-1040, Line 32',
};

const IN: StateFormLineRefs = {
  formName: 'IT-40',
  agiLine: 'IT-40, Line 1',
  taxableIncomeLine: 'IT-40, Line 7',
  incomeTaxLine: 'IT-40, Line 8',
  totalTaxLine: 'IT-40, Line 12',
  refundLine: 'IT-40, Line 22',
};

const CO: StateFormLineRefs = {
  formName: 'Form 104',
  agiLine: 'Form 104, Line 1',
  taxableIncomeLine: 'Form 104, Line 4',
  incomeTaxLine: 'Form 104, Line 5',
  totalTaxLine: 'Form 104, Line 12',
  refundLine: 'Form 104, Line 33',
};

const KY: StateFormLineRefs = {
  formName: 'Form 740',
  agiLine: 'Form 740, Line 5',
  taxableIncomeLine: 'Form 740, Line 11',
  incomeTaxLine: 'Form 740, Line 12',
  totalTaxLine: 'Form 740, Line 16',
  refundLine: 'Form 740, Line 30',
};

const UT: StateFormLineRefs = {
  formName: 'TC-40',
  agiLine: 'TC-40, Line 1',
  taxableIncomeLine: 'TC-40, Line 8',
  incomeTaxLine: 'TC-40, Line 9',
  totalTaxLine: 'TC-40, Line 23',
  refundLine: 'TC-40, Line 31',
};

const GA: StateFormLineRefs = {
  formName: 'Form 500',
  agiLine: 'Form 500, Line 8',
  taxableIncomeLine: 'Form 500, Line 15',
  incomeTaxLine: 'Form 500, Line 16',
  totalTaxLine: 'Form 500, Line 19',
  refundLine: 'Form 500, Line 26',
};

const AZ: StateFormLineRefs = {
  formName: 'Form 140',
  agiLine: 'Form 140, Line 12',
  taxableIncomeLine: 'Form 140, Line 19',
  incomeTaxLine: 'Form 140, Line 20',
  totalTaxLine: 'Form 140, Line 34',
  refundLine: 'Form 140, Line 53',
};

const LA: StateFormLineRefs = {
  formName: 'IT-540',
  agiLine: 'IT-540, Line 7',
  taxableIncomeLine: 'IT-540, Line 10',
  incomeTaxLine: 'IT-540, Line 11',
  totalTaxLine: 'IT-540, Line 16',
  refundLine: 'IT-540, Line 26',
};

const IA: StateFormLineRefs = {
  formName: 'IA 1040',
  agiLine: 'IA 1040, Line 1',
  taxableIncomeLine: 'IA 1040, Line 6',
  incomeTaxLine: 'IA 1040, Line 39',
  totalTaxLine: 'IA 1040, Line 47',
  refundLine: 'IA 1040, Line 55',
};

// ─── Progressive-Tax States (20) ─────────────────────────────────────
const VA: StateFormLineRefs = {
  formName: 'Form 760',
  agiLine: 'Form 760, Line 1',
  taxableIncomeLine: 'Form 760, Line 15',
  incomeTaxLine: 'Form 760, Line 16',
  totalTaxLine: 'Form 760, Line 18',
  refundLine: 'Form 760, Line 28',
};

const MN: StateFormLineRefs = {
  formName: 'Form M1',
  agiLine: 'Form M1, Line 1',
  taxableIncomeLine: 'Form M1, Line 9',
  incomeTaxLine: 'Form M1, Line 10',
  totalTaxLine: 'Form M1, Line 19',
  refundLine: 'Form M1, Line 24',
};

const OR: StateFormLineRefs = {
  formName: 'Form 40',
  agiLine: 'OR Form 40, Line 7',
  taxableIncomeLine: 'OR Form 40, Line 19',
  incomeTaxLine: 'OR Form 40, Line 20',
  totalTaxLine: 'OR Form 40, Line 27',
  refundLine: 'OR Form 40, Line 45',
};

const MO: StateFormLineRefs = {
  formName: 'MO-1040',
  agiLine: 'MO-1040, Line 1',
  taxableIncomeLine: 'MO-1040, Line 6',
  incomeTaxLine: 'MO-1040, Line 7',
  totalTaxLine: 'MO-1040, Line 16',
  refundLine: 'MO-1040, Line 41',
};

const SC: StateFormLineRefs = {
  formName: 'SC1040',
  agiLine: 'SC1040, Line 1',
  taxableIncomeLine: 'SC1040, Line 5',
  incomeTaxLine: 'SC1040, Line 6',
  totalTaxLine: 'SC1040, Line 10',
  refundLine: 'SC1040, Line 20',
};

const MS: StateFormLineRefs = {
  formName: 'Form 80-105',
  agiLine: 'Form 80-105, Line 18',
  taxableIncomeLine: 'Form 80-105, Line 27',
  incomeTaxLine: 'Form 80-105, Line 28',
  totalTaxLine: 'Form 80-105, Line 31',
  refundLine: 'Form 80-105, Line 42',
};

const KS: StateFormLineRefs = {
  formName: 'K-40',
  agiLine: 'K-40, Line 1',
  taxableIncomeLine: 'K-40, Line 7',
  incomeTaxLine: 'K-40, Line 8',
  totalTaxLine: 'K-40, Line 14',
  refundLine: 'K-40, Line 22',
};

const OK: StateFormLineRefs = {
  formName: 'Form 511',
  agiLine: 'Form 511, Line 1',
  taxableIncomeLine: 'Form 511, Line 12',
  incomeTaxLine: 'Form 511, Line 13',
  totalTaxLine: 'Form 511, Line 20',
  refundLine: 'Form 511, Line 30',
};

const AR: StateFormLineRefs = {
  formName: 'AR1000F',
  agiLine: 'AR1000F, Line 24',
  taxableIncomeLine: 'AR1000F, Line 35',
  incomeTaxLine: 'AR1000F, Line 36',
  totalTaxLine: 'AR1000F, Line 41',
  refundLine: 'AR1000F, Line 51',
};

const ID: StateFormLineRefs = {
  formName: 'Form 40',
  agiLine: 'ID Form 40, Line 7',
  taxableIncomeLine: 'ID Form 40, Line 22',
  incomeTaxLine: 'ID Form 40, Line 23',
  totalTaxLine: 'ID Form 40, Line 30',
  refundLine: 'ID Form 40, Line 44',
};

const ND: StateFormLineRefs = {
  formName: 'Form ND-1',
  agiLine: 'Form ND-1, Line 1',
  taxableIncomeLine: 'Form ND-1, Line 8',
  incomeTaxLine: 'Form ND-1, Line 9',
  totalTaxLine: 'Form ND-1, Line 15',
  refundLine: 'Form ND-1, Line 23',
};

const RI: StateFormLineRefs = {
  formName: 'RI-1040',
  agiLine: 'RI-1040, Line 1',
  taxableIncomeLine: 'RI-1040, Line 7',
  incomeTaxLine: 'RI-1040, Line 8',
  totalTaxLine: 'RI-1040, Line 13',
  refundLine: 'RI-1040, Line 19',
};

const WV: StateFormLineRefs = {
  formName: 'IT-140',
  agiLine: 'IT-140, Line 1',
  taxableIncomeLine: 'IT-140, Line 7',
  incomeTaxLine: 'IT-140, Line 8',
  totalTaxLine: 'IT-140, Line 12',
  refundLine: 'IT-140, Line 17',
};

const ME: StateFormLineRefs = {
  formName: '1040ME',
  agiLine: '1040ME, Line 14',
  taxableIncomeLine: '1040ME, Line 19',
  incomeTaxLine: '1040ME, Line 20',
  totalTaxLine: '1040ME, Line 25',
  refundLine: '1040ME, Line 32',
};

const NM: StateFormLineRefs = {
  formName: 'PIT-1',
  agiLine: 'PIT-1, Line 5',
  taxableIncomeLine: 'PIT-1, Line 12',
  incomeTaxLine: 'PIT-1, Line 13',
  totalTaxLine: 'PIT-1, Line 18',
  refundLine: 'PIT-1, Line 28',
};

const MT: StateFormLineRefs = {
  formName: 'Form 2',
  agiLine: 'MT Form 2, Line 14',
  taxableIncomeLine: 'MT Form 2, Line 18',
  incomeTaxLine: 'MT Form 2, Line 19',
  totalTaxLine: 'MT Form 2, Line 25',
  refundLine: 'MT Form 2, Line 38',
};

const NE: StateFormLineRefs = {
  formName: 'Form 1040N',
  agiLine: 'Form 1040N, Line 1',
  taxableIncomeLine: 'Form 1040N, Line 14',
  incomeTaxLine: 'Form 1040N, Line 15',
  totalTaxLine: 'Form 1040N, Line 24',
  refundLine: 'Form 1040N, Line 36',
};

const VT: StateFormLineRefs = {
  formName: 'IN-111',
  agiLine: 'IN-111, Line 1',
  taxableIncomeLine: 'IN-111, Line 7',
  incomeTaxLine: 'IN-111, Line 8',
  totalTaxLine: 'IN-111, Line 15',
  refundLine: 'IN-111, Line 26',
};

const DE: StateFormLineRefs = {
  formName: 'Form 200-01',
  agiLine: 'Form 200-01, Line 1',
  taxableIncomeLine: 'Form 200-01, Line 16',
  incomeTaxLine: 'Form 200-01, Line 17',
  totalTaxLine: 'Form 200-01, Line 22',
  refundLine: 'Form 200-01, Line 27',
};

const DC: StateFormLineRefs = {
  formName: 'D-40',
  agiLine: 'D-40, Line 3',
  taxableIncomeLine: 'D-40, Line 8',
  incomeTaxLine: 'D-40, Line 9',
  totalTaxLine: 'D-40, Line 17',
  refundLine: 'D-40, Line 30',
};

// ─── Custom-Calculator States ─────────────────────────────────────────
const CA: StateFormLineRefs = {
  formName: 'Form 540',
  agiLine: 'Form 540, Line 13',
  taxableIncomeLine: 'Form 540, Line 19',
  incomeTaxLine: 'Form 540, Line 31',
  totalTaxLine: 'Form 540, Line 48',
  refundLine: 'Form 540, Line 115',
};

const NY: StateFormLineRefs = {
  formName: 'Form IT-201',
  agiLine: 'Form IT-201, Line 19',
  taxableIncomeLine: 'Form IT-201, Line 38',
  incomeTaxLine: 'Form IT-201, Line 39',
  totalTaxLine: 'Form IT-201, Line 62',
  refundLine: 'Form IT-201, Line 78',
};

const AL: StateFormLineRefs = {
  formName: 'Form 40',
  agiLine: 'Form 40, Line 8',
  taxableIncomeLine: 'Form 40, Line 15',
  incomeTaxLine: 'Form 40, Line 16',
  totalTaxLine: 'Form 40, Line 18',
  refundLine: 'Form 40, Line 28',
};

const OH: StateFormLineRefs = {
  formName: 'Form IT 1040',
  agiLine: 'Form IT 1040, Line 3',
  taxableIncomeLine: 'Form IT 1040, Line 5',
  incomeTaxLine: 'Form IT 1040, Line 8',
  totalTaxLine: 'Form IT 1040, Line 10',
  refundLine: 'Form IT 1040, Line 23',
};

const NJ: StateFormLineRefs = {
  formName: 'Form NJ-1040',
  agiLine: 'Form NJ-1040, Line 29',
  taxableIncomeLine: 'Form NJ-1040, Line 39',
  incomeTaxLine: 'Form NJ-1040, Line 40',
  totalTaxLine: 'Form NJ-1040, Line 45',
  refundLine: 'Form NJ-1040, Line 55',
};

const HI: StateFormLineRefs = {
  formName: 'Form N-11',
  agiLine: 'Form N-11, Line 18',
  taxableIncomeLine: 'Form N-11, Line 26',
  incomeTaxLine: 'Form N-11, Line 27',
  totalTaxLine: 'Form N-11, Line 35',
  refundLine: 'Form N-11, Line 51',
};

const WI: StateFormLineRefs = {
  formName: 'Form 1',
  agiLine: 'WI Form 1, Line 1',
  taxableIncomeLine: 'WI Form 1, Line 11',
  incomeTaxLine: 'WI Form 1, Line 12',
  totalTaxLine: 'WI Form 1, Line 22',
  refundLine: 'WI Form 1, Line 36',
};

const MD: StateFormLineRefs = {
  formName: 'Form 502',
  agiLine: 'Form 502, Line 16',
  taxableIncomeLine: 'Form 502, Line 21',
  incomeTaxLine: 'Form 502, Line 22',
  totalTaxLine: 'Form 502, Line 34',
  refundLine: 'Form 502, Line 50',
};

/**
 * Lookup table mapping state codes to form line references.
 * Used by the flat-tax and progressive-tax factory calculators
 * to populate trace authority fields.
 */
export const STATE_FORM_REFS: Record<string, StateFormLineRefs | undefined> = {
  // Flat-tax states
  PA, IL, MA, NC, MI, IN, CO, KY, UT, GA, AZ, LA, IA,
  // Progressive-tax states
  VA, MN, OR, MO, SC, MS, KS, OK, AR, ID, ND, RI, WV, ME, NM, MT, NE, VT, DE, DC,
  // Custom-calculator states
  CA, NY, NJ, OH, AL, MD, WI, HI,
};
