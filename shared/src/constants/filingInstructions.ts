/**
 * Filing Instructions Generator
 *
 * Pure function that computes everything a filer needs to know to complete
 * their paper filing: which forms are included, where to mail, what to
 * attach, and whether they owe or are getting a refund.
 *
 * Reuses the same IRSFormTemplate condition logic used by irsFormFiller.ts
 * so the forms list stays in sync with the actual PDF output.
 */
import type { TaxReturn, CalculationResult } from '../types/index.js';
import type { IRSFormTemplate } from '../types/irsFormMappings.js';
import { FORM_1040_TEMPLATE } from './irsForm1040Map.js';
import { SCHEDULE_A_TEMPLATE } from './irsScheduleAMap.js';
import { SCHEDULE_B_TEMPLATE } from './irsScheduleBMap.js';
import { SCHEDULE_1_TEMPLATE } from './irsSchedule1Map.js';
import { SCHEDULE_2_TEMPLATE } from './irsSchedule2Map.js';
import { SCHEDULE_3_TEMPLATE } from './irsSchedule3Map.js';
import { SCHEDULE_C_TEMPLATE } from './irsScheduleCMap.js';
import { SCHEDULE_D_TEMPLATE } from './irsScheduleDMap.js';
import { FORM_8949_TEMPLATE } from './irsForm8949Map.js';
import { SCHEDULE_E_TEMPLATE } from './irsScheduleEMap.js';
import { FORM_8936_TEMPLATE } from './irsForm8936Map.js';
import { SCHEDULE_SE_TEMPLATE } from './irsScheduleSEMap.js';
import { FORM_8962_TEMPLATE } from './irsForm8962Map.js';
import { FORM_5695_TEMPLATE } from './irsForm5695Map.js';
import { FORM_4562_TEMPLATE } from './irsForm4562Map.js';
import { FORM_7206_TEMPLATE } from './irsForm7206Map.js';
import { FORM_1040V_TEMPLATE } from './irsForm1040VMap.js';
import { SCHEDULE_F_TEMPLATE } from './irsScheduleFMap.js';
import { SCHEDULE_H_TEMPLATE } from './irsScheduleHMap.js';
import { SCHEDULE_R_TEMPLATE } from './irsScheduleRMap.js';
import { FORM_6251_TEMPLATE } from './irsForm6251Map.js';
import { FORM_4797_TEMPLATE } from './irsForm4797Map.js';
import { FORM_5329_TEMPLATE } from './irsForm5329Map.js';
import { FORM_8606_TEMPLATE } from './irsForm8606Map.js';
import { FORM_4137_TEMPLATE } from './irsForm4137Map.js';
import { FORM_8283_TEMPLATE } from './irsForm8283Map.js';
import { FORM_8911_TEMPLATE } from './irsForm8911Map.js';
import { FORM_8863_TEMPLATE } from './irsForm8863Map.js';
import { FORM_5500_EZ_TEMPLATE } from './irsForm5500EZMap.js';
import { getIRSMailingAddress } from './irsMailingAddresses.js';
import { STATE_MAILING_ADDRESSES } from './stateMailingAddresses.js';
import type { StateMailingAddress } from './stateMailingAddresses.js';
import { assessEstimatedPaymentNeed } from '../engine/estimatedTaxVoucher.js';

// ── All registered templates (same order as irsFormFiller.ts) ───
const ALL_TEMPLATES: IRSFormTemplate[] = [
  FORM_1040_TEMPLATE,
  SCHEDULE_A_TEMPLATE,   // Attachment Sequence 07
  SCHEDULE_B_TEMPLATE,   // Attachment Sequence 08
  SCHEDULE_1_TEMPLATE,
  SCHEDULE_2_TEMPLATE,
  SCHEDULE_3_TEMPLATE,
  SCHEDULE_C_TEMPLATE,   // Attachment Sequence 09
  SCHEDULE_D_TEMPLATE,   // Attachment Sequence 12
  FORM_8949_TEMPLATE,    // Attachment Sequence 12a
  SCHEDULE_E_TEMPLATE,   // Attachment Sequence 13
  FORM_8936_TEMPLATE,    // Attachment Sequence 13a
  SCHEDULE_F_TEMPLATE,   // Attachment Sequence 15
  SCHEDULE_R_TEMPLATE,   // Attachment Sequence 16
  SCHEDULE_SE_TEMPLATE,  // Attachment Sequence 17
  FORM_4797_TEMPLATE,    // Attachment Sequence 27
  FORM_5329_TEMPLATE,    // Attachment Sequence 29
  FORM_6251_TEMPLATE,    // Attachment Sequence 32
  FORM_7206_TEMPLATE,    // Attachment Sequence 35
  SCHEDULE_H_TEMPLATE,   // Attachment Sequence 44
  FORM_8606_TEMPLATE,    // Attachment Sequence 48
  FORM_8863_TEMPLATE,    // Attachment Sequence 50
  FORM_4137_TEMPLATE,    // Attachment Sequence 56
  FORM_8962_TEMPLATE,    // Attachment Sequence 73
  FORM_8911_TEMPLATE,    // Attachment Sequence 151
  FORM_8283_TEMPLATE,    // Attachment Sequence 155
  FORM_5695_TEMPLATE,    // Attachment Sequence 158
  FORM_4562_TEMPLATE,    // Attachment Sequence 179
  FORM_5500_EZ_TEMPLATE, // Separate filing (Solo 401(k) plan assets > $250k)
  FORM_1040V_TEMPLATE,   // Payment voucher (loose in envelope)
];

// ── US state abbreviation → full name ───────────────────────────
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii',
  ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

// ── Result type ─────────────────────────────────────────────────

export interface FilingInstructions {
  /** IRS forms included in this return (formId + display name) */
  formsIncluded: { formId: string; displayName: string }[];

  /** IRS mailing address lines */
  mailingAddress: string[];

  /** Documents to attach / include in the envelope */
  attachments: string[];

  /** Signature instruction text */
  signatureLines: string;

  /** Amount owed to IRS (0 if refund or break-even) */
  owesAmount: number;

  /** Refund amount (0 if balance due or break-even) */
  refundAmount: number;

  /** Whether the filer has state return(s) to file separately */
  hasStateReturn: boolean;

  /** Full names of states being filed */
  stateNames: string[];

  /** Payment guidance (only present when filer owes) */
  paymentNote?: string;

  /** Filing deadline */
  deadline: string;

  /** Per-state filing info (mailing addresses, form names) */
  stateFilingInfo: {
    stateCode: string;
    stateName: string;
    mailingAddress: StateMailingAddress | null;
  }[];

  /** Estimated tax payment info for next year (only present when recommended) */
  estimatedPaymentInfo?: {
    recommended: boolean;
    quarterlyAmount: number;
    annualAmount: number;
    firstDueDate: string;
    reasons: string[];
    note: string;
  };
}

/**
 * Generate complete filing instructions from a tax return and its calculation result.
 */
export function getFilingInstructions(
  taxReturn: TaxReturn,
  calc: CalculationResult,
): FilingInstructions {
  // ── Forms included ──────────────────────────────────────────
  const formsIncluded = ALL_TEMPLATES
    .filter(t => t.condition(taxReturn, calc))
    .map(t => ({ formId: t.formId, displayName: t.displayName }));

  // ── Refund vs. owed ─────────────────────────────────────────
  const refundAmount = calc.form1040.refundAmount || 0;
  const owesAmount = calc.form1040.amountOwed || 0;
  const enclosingPayment = owesAmount > 0;

  // ── Mailing address ─────────────────────────────────────────
  const filerState = taxReturn.addressState || '';
  const { lines: mailingAddress } = getIRSMailingAddress(filerState, enclosingPayment);

  // ── Attachments ─────────────────────────────────────────────
  const attachments: string[] = [];

  const w2Count = (taxReturn.w2Income || []).length;
  if (w2Count > 0) {
    attachments.push(
      w2Count === 1
        ? 'Original W-2 (Copy B — "To Be Filed With Employee\'s FEDERAL Tax Return")'
        : `All ${w2Count} W-2 forms (Copy B — "To Be Filed With Employee's FEDERAL Tax Return")`,
    );
  }

  const has1099RWithholding = (taxReturn.income1099R || []).some(
    r => (r.federalTaxWithheld || 0) > 0,
  );
  if (has1099RWithholding) {
    attachments.push('Form 1099-R (if federal tax was withheld)');
  }

  if (enclosingPayment) {
    attachments.push('Form 1040-V payment voucher with your check or money order');
  }

  // Schedule B overflow: when payers exceed PDF rows, a statement is needed
  const interestPayerCount = (taxReturn.income1099INT || []).filter(i => (i.amount || 0) > 0).length
    + (taxReturn.incomeK1 || []).filter(k => (k.interestIncome || 0) > 0).length;
  const dividendPayerCount = (taxReturn.income1099DIV || []).filter(d => (d.ordinaryDividends || 0) > 0).length
    + (taxReturn.incomeK1 || []).filter(k => (k.ordinaryDividends || 0) > 0).length;
  const scheduleBIncluded = formsIncluded.some(f => f.formId === 'f1040sb');
  if (scheduleBIncluded && (interestPayerCount > 14 || dividendPayerCount > 15)) {
    attachments.push('Statement listing additional Schedule B payers (interest and/or dividends) — attach behind Schedule B');
  }

  // Form 5500-EZ: separate filing reminder
  const needs5500EZ = (taxReturn.selfEmploymentDeductions?.solo401kPlanBalance || 0) > 250000;
  if (needs5500EZ) {
    attachments.push(
      'Form 5500-EZ (filed SEPARATELY — due July 31, 2026 for calendar-year plans). ' +
      'A pre-filled copy is included at the end of your filing packet for your convenience.',
    );
  }

  // ── Signature ───────────────────────────────────────────────
  const isMFJ = taxReturn.filingStatus === 2; // MarriedFilingJointly
  const signatureLines = isMFJ
    ? 'Both spouses must sign and date on page 2 (lines 37–38). The return is not valid without both signatures.'
    : 'Sign and date on page 2, line 37. Your return is not valid without your signature.';

  // ── State returns ───────────────────────────────────────────
  const stateReturns = taxReturn.stateReturns || [];
  const hasStateReturn = stateReturns.length > 0;
  const stateNames = stateReturns
    .map(sr => STATE_NAMES[(sr.stateCode || '').toUpperCase()] || sr.stateCode)
    .filter(Boolean);

  // ── Payment note ────────────────────────────────────────────
  let paymentNote: string | undefined;
  if (enclosingPayment) {
    const formatted = owesAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    paymentNote =
      `You owe ${formatted}. Make your check or money order payable to "United States Treasury." ` +
      'Do not send cash. Write your SSN, daytime phone number, and "2025 Form 1040" on your payment. ' +
      'You can also pay online at IRS Direct Pay (irs.gov/directpay) — no check needed.';
  }

  // ── State filing info ──────────────────────────────────────────
  const stateFilingInfo = stateReturns.map(sr => {
    const code = (sr.stateCode || '').toUpperCase();
    return {
      stateCode: code,
      stateName: STATE_NAMES[code] || code,
      mailingAddress: STATE_MAILING_ADDRESSES[code] || null,
    };
  });

  // ── Estimated tax payment recommendation ───────────────────────
  const estRec = assessEstimatedPaymentNeed(taxReturn, calc);
  const estimatedPaymentInfo = estRec.recommended
    ? {
        recommended: true,
        quarterlyAmount: estRec.quarterlyAmount,
        annualAmount: estRec.annualAmount,
        firstDueDate: estRec.dueDates[0].date,
        reasons: estRec.reasons,
        note: estRec.note,
      }
    : undefined;

  return {
    formsIncluded,
    mailingAddress,
    attachments,
    signatureLines,
    owesAmount,
    refundAmount,
    hasStateReturn,
    stateNames,
    paymentNote,
    deadline: 'April 15, 2026',
    stateFilingInfo,
    estimatedPaymentInfo,
  };
}
