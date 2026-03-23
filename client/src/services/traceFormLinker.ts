/**
 * traceFormLinker — maps engine trace lineIds to Forms Mode formIds and PDF fields.
 *
 * Trace lineIds use dot-prefixed names like "form1040.line1a" or "scheduleC.line31".
 * Forms Mode uses short IDs like "f1040" or "f1040sc". This module bridges the two.
 *
 * Also maps trace lineIds (e.g. "form1040.line1a") to field mapping sourcePaths
 * (e.g. "form1040.totalWages") so the viewer can focus the exact PDF field.
 */

const PREFIX_TO_FORM: [string, string][] = [
  ['form1040.',    'f1040'],
  ['schedule1.',   'f1040s1'],
  ['schedule2.',   'f1040s2'],
  ['schedule3.',   'f1040s3'],
  ['scheduleA.',   'f1040sa'],
  ['scheduleB.',   'f1040sb'],
  ['scheduleC.',   'f1040sc'],
  ['scheduleD.',   'f1040sd'],
  ['scheduleE.',   'f1040se'],
  ['scheduleF.',   'f1040sf'],
  ['scheduleSE.',  'f1040sse'],
];

/**
 * Resolve a trace lineId (e.g. "form1040.line1a") to a Forms Mode formId (e.g. "f1040").
 * Returns null for unmappable prefixes (w2, k1, state, etc.).
 */
export function resolveFormFromLineId(lineId: string): string | null {
  for (const [prefix, formId] of PREFIX_TO_FORM) {
    if (lineId.startsWith(prefix)) return formId;
  }
  return null;
}

/**
 * Maps trace lineIds to form field mapping sourcePaths.
 * Trace lineIds use IRS line numbers (e.g. "form1040.line1a") while
 * field mappings use camelCase property names (e.g. "form1040.totalWages").
 */
const LINEID_TO_SOURCE_PATH: Record<string, string> = {
  // Form 1040 — Income
  'form1040.line1a': 'form1040.totalWages',
  'form1040.line1z': 'form1040.totalWages',
  'form1040.line2a': 'form1040.taxExemptInterest',
  'form1040.line2b': 'form1040.totalInterest',
  'form1040.line3a': 'form1040.qualifiedDividends',
  'form1040.line3b': 'form1040.totalDividends',
  'form1040.line4a': 'form1040.iraDistributionsGross',
  'form1040.line4b': 'form1040.iraDistributionsTaxable',
  'form1040.line5a': 'form1040.pensionDistributionsGross',
  'form1040.line5b': 'form1040.pensionDistributionsTaxable',
  'form1040.line6a': 'form1040.socialSecurityBenefits',
  'form1040.line6b': 'form1040.taxableSocialSecurity',
  'form1040.line7':  'form1040.capitalGainOrLoss',
  'form1040.line8':  'form1040.additionalIncome',
  'form1040.line9':  'form1040.totalIncome',
  'form1040.line10': 'form1040.totalAdjustments',
  'form1040.line11': 'form1040.agi',
  'form1040.line12': 'form1040.deductionAmount',
  'form1040.line13': 'form1040.deductionAmount',
  'form1040.line13a': 'form1040.qbiDeduction',
  'form1040.line15': 'form1040.taxableIncome',
  'form1040.line16': 'form1040.incomeTax',
  'form1040.line22': 'form1040.taxAfterCredits',
  'form1040.line24': 'form1040.totalTax',
  'form1040.line25a': 'form1040.w2Withholding',
  'form1040.line25b': 'form1040.form1099Withholding',
  'form1040.line25d': 'form1040.totalWithholding',
  'form1040.line26': 'form1040.estimatedPayments',
  'form1040.line33': 'form1040.totalPayments',
  'form1040.line37': 'form1040.estimatedTaxPenalty',

  // Schedule C
  'scheduleC.line1':  'scheduleC.grossReceipts',
  'scheduleC.line3':  'scheduleC.netReceipts',
  'scheduleC.line4':  'scheduleC.costOfGoodsSold',
  'scheduleC.line5':  'scheduleC.grossProfit',
  'scheduleC.line7':  'scheduleC.grossIncome',
  'scheduleC.line28': 'scheduleC.totalExpenses',
  'scheduleC.line29': 'scheduleC.tentativeProfit',
  'scheduleC.line30': 'scheduleC.homeOfficeDeduction',
  'scheduleC.line31': 'scheduleC.netProfit',

  // Schedule D
  'scheduleD.line7':  'scheduleD.netShortTerm',
  'scheduleD.line15': 'scheduleD.netLongTerm',
  'scheduleD.line16': 'scheduleD.netGainOrLoss',

  // Schedule SE
  'scheduleSE.line4':  'scheduleSE.netEarnings',
  'scheduleSE.line10': 'scheduleSE.socialSecurityTax',
  'scheduleSE.line11': 'scheduleSE.medicareTax',
  'scheduleSE.line12': 'scheduleSE.totalSETax',
  'scheduleSE.line13': 'scheduleSE.deductibleHalf',

  // Schedule 1
  'schedule1.line3':  'form1040.scheduleCNetProfit',
  'schedule1.line5':  'form1040.scheduleEIncome',
  'schedule1.line6':  'form1040.scheduleFNetProfit',
  'schedule1.line7':  'form1040.totalUnemployment',
  'schedule1.line10': 'form1040.additionalIncome',
  'schedule1.line15': 'form1040.hsaDeduction',
  'schedule1.line16': 'form1040.movingExpenses',
  'schedule1.line17': 'form1040.seDeduction',

  // Schedule 2
  'schedule2.line6':  'form1040.seTax',
  'schedule2.line11': 'form1040.additionalMedicareTaxW2',
  'schedule2.line12': 'form1040.niitTax',
  'schedule2.line8':  'form1040.householdEmploymentTax',

  // Schedule A
  'scheduleA.line1':  'form1040.agi',
  'scheduleA.line17': 'form1040.deductionAmount',
};

/**
 * Resolve a trace lineId to the sourcePath used in form field mappings.
 * Returns null if no mapping is known (field focus will be skipped).
 */
export function resolveSourcePathFromLineId(lineId: string): string | null {
  return LINEID_TO_SOURCE_PATH[lineId] ?? null;
}
