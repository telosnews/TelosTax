import { create } from 'zustand';
import { TaxReturn, CalculationResult, evaluateCondition, setDeepPath } from '@telostax/engine';
import type { StepCondition } from '@telostax/engine';
import { writeReturn } from '../api/client';
import { isEncryptionSetup } from '../services/crypto';

// ─── Debounced Auto-Save ─────────────────────────
// Writes the full TaxReturn to localStorage after 500ms of inactivity.
// All data stays local — never leaves the user's browser.
//
// IMPORTANT: reads the CURRENT state from the store when the timer fires,
// NOT a stale captured reference. This prevents a race condition where
// goNext() writes an updated step position immediately, then the debounced
// timer fires and overwrites it with stale pre-navigation state.
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let autoSaveCallback: (() => void) | null = null;

function debouncedAutoSave(onSaved?: () => void) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveCallback = onSaved || null;
  autoSaveTimer = setTimeout(() => {
    const tr = useTaxReturnStore.getState().taxReturn;
    if (tr) {
      writeReturn(tr);
    }
    autoSaveCallback?.();
    autoSaveCallback = null;
  }, 500);
}

/** Immediately flush any pending auto-save (used before explicit saves and on page unload). */
export function flushAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  const tr = useTaxReturnStore.getState().taxReturn;
  if (tr) {
    writeReturn(tr);
  }
  // Fire the pending callback so saveState transitions correctly
  if (autoSaveCallback) {
    autoSaveCallback();
    autoSaveCallback = null;
  }
}

// ─── Wizard Step Definitions ────────────────────
export interface WizardStep {
  id: string;
  label: string;
  section: string;
  /** Legacy imperative condition (kept for migration). */
  condition?: (taxReturn: TaxReturn) => boolean;
  /** Declarative condition — preferred over `condition` when both are present.
   *  Can be serialized, inspected by the AI chat, and described in documentation. */
  declarativeCondition?: StepCondition;
}

export const SECTIONS = [
  { id: 'my_info', label: 'My Info', icon: 'User' },
  { id: 'income', label: 'Income', icon: 'DollarSign' },
  { id: 'self_employment', label: 'Self-Employment', icon: 'Briefcase' },
  { id: 'deductions', label: 'Deductions', icon: 'Scissors' },
  { id: 'credits', label: 'Credits', icon: 'Award' },
  { id: 'state', label: 'State Taxes', icon: 'MapPin' },
  { id: 'review', label: 'Review', icon: 'ClipboardCheck' },
  { id: 'finish', label: 'Finish', icon: 'Download' },
] as const;

const hasSelfeEmployment = (tr: TaxReturn) =>
  tr.incomeDiscovery['1099nec'] === 'yes' ||
  tr.incomeDiscovery['1099k'] === 'yes' ||
  (tr.income1099NEC?.length > 0) ||
  (tr.income1099K?.length > 0);

const hasStateReturns = (tr: TaxReturn) =>
  (tr.stateReturns?.length || 0) > 0;

const hasAMTData = (tr: TaxReturn) =>
  !!(tr.amtData?.isoExerciseSpread || tr.amtData?.privateActivityBondInterest || tr.amtData?.otherAMTAdjustments);

const wantsItemized = (tr: TaxReturn) => tr.deductionMethod === 'itemized';
const wantsChildCredit = (tr: TaxReturn) => tr.incomeDiscovery['child_credit'] === 'yes';
const wantsEducationCredit = (tr: TaxReturn) => tr.incomeDiscovery['education_credit'] === 'yes';

// ─── Declarative Condition Equivalents ──────────
// These mirror the legacy condition functions above but are serializable,
// inspectable by AI chat, and auditable. Inspired by IRS Direct File's
// declarative screen conditions.

const DC_SELF_EMPLOYMENT: StepCondition = {
  type: 'any', conditions: [
    { type: 'discovery_equals', incomeType: '1099nec', value: 'yes' },
    { type: 'discovery_equals', incomeType: '1099k', value: 'yes' },
    { type: 'array_not_empty', field: 'income1099NEC' },
    { type: 'array_not_empty', field: 'income1099K' },
  ],
};

const DC_STATE_RETURNS: StepCondition = { type: 'array_not_empty', field: 'stateReturns' };

const DC_AMT: StepCondition = {
  type: 'any', conditions: [
    { type: 'field_truthy', field: 'amtData.isoExerciseSpread' },
    { type: 'field_truthy', field: 'amtData.privateActivityBondInterest' },
    { type: 'field_truthy', field: 'amtData.otherAMTAdjustments' },
  ],
};

const dcDiscovery = (incomeType: string): StepCondition =>
  ({ type: 'discovery_equals', incomeType, value: 'yes' });

export const WIZARD_STEPS: WizardStep[] = [
  // My Info
  { id: 'welcome', label: 'Welcome', section: 'my_info' },
  { id: 'personal_info', label: 'Personal Info', section: 'my_info' },
  { id: 'encryption_setup', label: 'Protect Your Data', section: 'my_info', condition: () => !isEncryptionSetup() },
  { id: 'filing_status', label: 'Filing Status', section: 'my_info' },
  { id: 'dependents', label: 'Dependents', section: 'my_info' },

  // Income — ordered to match IncomeOverviewStep groups
  { id: 'transition_income', label: 'Getting Started', section: 'income' },
  { id: 'income_overview', label: 'Income Overview', section: 'income' },
  { id: 'import_data', label: 'Import Data', section: 'income' },
  // Wages & Employment
  { id: 'w2_income', label: 'Employment (W-2)', section: 'income', condition: (tr) => tr.incomeDiscovery['w2'] === 'yes', declarativeCondition: dcDiscovery('w2') },
  // Self-Employment & Freelance
  { id: '1099nec_income', label: 'Nonemployee (1099-NEC)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099nec'] === 'yes', declarativeCondition: dcDiscovery('1099nec') },
  { id: '1099k_income', label: 'Platform (1099-K)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099k'] === 'yes', declarativeCondition: dcDiscovery('1099k') },
  { id: '1099misc_income', label: 'Miscellaneous (1099-MISC)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099misc'] === 'yes', declarativeCondition: dcDiscovery('1099misc') },
  // Interest & Dividends
  { id: '1099int_income', label: 'Interest (1099-INT)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099int'] === 'yes', declarativeCondition: dcDiscovery('1099int') },
  { id: '1099div_income', label: 'Dividends (1099-DIV)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099div'] === 'yes', declarativeCondition: dcDiscovery('1099div') },
  { id: '1099oid_income', label: 'OID (1099-OID)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099oid'] === 'yes', declarativeCondition: dcDiscovery('1099oid') },
  // Investments
  { id: '1099b_income', label: 'Capital Gains (1099-B)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099b'] === 'yes', declarativeCondition: dcDiscovery('1099b') },
  { id: '1099da_income', label: 'Digital Assets (1099-DA)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099da'] === 'yes', declarativeCondition: dcDiscovery('1099da') },
  { id: 'k1_income', label: 'Partnership / S-Corp (K-1)', section: 'income', condition: (tr) => tr.incomeDiscovery['k1'] === 'yes', declarativeCondition: dcDiscovery('k1') },
  // Retirement & Benefits
  { id: '1099r_income', label: 'Retirement (1099-R)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099r'] === 'yes', declarativeCondition: dcDiscovery('1099r') },
  { id: 'ssa1099_income', label: 'Social Security (SSA-1099)', section: 'income', condition: (tr) => tr.incomeDiscovery['ssa1099'] === 'yes', declarativeCondition: dcDiscovery('ssa1099') },
  { id: '1099g_income', label: 'Unemployment (1099-G)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099g'] === 'yes', declarativeCondition: dcDiscovery('1099g') },
  // Property & Farming
  { id: 'home_sale', label: 'Home Sale', section: 'income', condition: (tr) => tr.incomeDiscovery['home_sale'] === 'yes', declarativeCondition: dcDiscovery('home_sale') },
  { id: 'rental_income', label: 'Rental (Sch E)', section: 'income', condition: (tr) => tr.incomeDiscovery['rental'] === 'yes', declarativeCondition: dcDiscovery('rental') },
    { id: 'royalty_income', label: 'Royalties (Sch E)', section: 'income', condition: (tr) => tr.incomeDiscovery['royalty'] === 'yes', declarativeCondition: dcDiscovery('royalty') },
  { id: 'schedule_f', label: 'Farm Income (Sch F)', section: 'income', condition: (tr) => tr.incomeDiscovery['schedule_f'] === 'yes', declarativeCondition: dcDiscovery('schedule_f') },
  { id: 'farm_rental', label: 'Farm Rental (4835)', section: 'income', condition: (tr) => tr.incomeDiscovery['farm_rental'] === 'yes', declarativeCondition: dcDiscovery('farm_rental') },
  // Health & Education
  { id: '1099sa_income', label: 'HSA Distributions (1099-SA)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099sa'] === 'yes', declarativeCondition: dcDiscovery('1099sa') },
  { id: '1099q_income', label: '529 Distributions (1099-Q)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099q'] === 'yes', declarativeCondition: dcDiscovery('1099q') },
  // Other Income
  { id: 'w2g_income', label: 'Gambling Winnings (W-2G)', section: 'income', condition: (tr) => tr.incomeDiscovery['w2g'] === 'yes', declarativeCondition: dcDiscovery('w2g') },
  { id: '1099c_income', label: 'Cancelled Debt (1099-C)', section: 'income', condition: (tr) => tr.incomeDiscovery['1099c'] === 'yes', declarativeCondition: dcDiscovery('1099c') },
  { id: 'foreign_earned_income', label: 'Foreign Income (2555)', section: 'income', condition: (tr) => tr.incomeDiscovery['foreign_income'] === 'yes', declarativeCondition: dcDiscovery('foreign_income') },
  { id: 'form4797', label: 'Business Property (4797)', section: 'income', condition: (tr) => tr.incomeDiscovery['form4797'] === 'yes', declarativeCondition: dcDiscovery('form4797') },
  { id: 'installment_sale', label: 'Installment Sales (6252)', section: 'income', condition: (tr) => tr.incomeDiscovery['installment_sale'] === 'yes', declarativeCondition: dcDiscovery('installment_sale') },
  { id: 'other_income', label: 'Other Income', section: 'income', condition: (tr) => tr.incomeDiscovery['other'] === 'yes', declarativeCondition: dcDiscovery('other') },
  { id: 'income_summary', label: 'Income Summary', section: 'income' },

  // Self-Employment (conditional)
  { id: 'transition_se', label: 'Self-Employment', section: 'self_employment', condition: hasSelfeEmployment, declarativeCondition: DC_SELF_EMPLOYMENT },
  { id: 'business_info', label: 'Business Info', section: 'self_employment', condition: hasSelfeEmployment, declarativeCondition: DC_SELF_EMPLOYMENT },
  { id: 'expense_categories', label: 'Expenses', section: 'self_employment', condition: hasSelfeEmployment, declarativeCondition: DC_SELF_EMPLOYMENT },
  { id: 'cost_of_goods_sold', label: 'Cost of Goods', section: 'self_employment', condition: hasSelfeEmployment, declarativeCondition: DC_SELF_EMPLOYMENT },
  { id: 'home_office', label: 'Home Office', section: 'self_employment', condition: hasSelfeEmployment, declarativeCondition: DC_SELF_EMPLOYMENT },
  { id: 'vehicle_expenses', label: 'Vehicle', section: 'self_employment', condition: hasSelfeEmployment, declarativeCondition: DC_SELF_EMPLOYMENT },
  { id: 'depreciation_assets', label: 'Equipment', section: 'self_employment', condition: hasSelfeEmployment, declarativeCondition: DC_SELF_EMPLOYMENT },
  { id: 'se_health_insurance', label: 'SE Health Insurance', section: 'self_employment', condition: hasSelfeEmployment, declarativeCondition: DC_SELF_EMPLOYMENT },
  { id: 'se_retirement', label: 'SE Retirement Plans', section: 'self_employment', condition: hasSelfeEmployment, declarativeCondition: DC_SELF_EMPLOYMENT },
  { id: 'se_summary', label: 'Self-Employment Summary', section: 'self_employment', condition: hasSelfeEmployment, declarativeCondition: DC_SELF_EMPLOYMENT },

  // Deductions
  { id: 'transition_deductions', label: 'Deductions', section: 'deductions' },
  { id: 'deductions_discovery', label: 'Deductions Overview', section: 'deductions' },
  { id: 'deduction_method', label: 'Deduction Method', section: 'deductions' },
  // Individual itemized deduction steps (conditional: discovery key + itemized)
  { id: 'medical_expenses', label: 'Medical Expenses', section: 'deductions', condition: (tr) => tr.deductionMethod === 'itemized' && tr.incomeDiscovery['ded_medical'] === 'yes' },
  { id: 'salt_deduction', label: 'State & Local Taxes', section: 'deductions', condition: (tr) => tr.deductionMethod === 'itemized' && tr.incomeDiscovery['ded_property_tax'] === 'yes' },
  { id: 'mortgage_interest_ded', label: 'Mortgage Interest', section: 'deductions', condition: (tr) => tr.deductionMethod === 'itemized' && tr.incomeDiscovery['ded_mortgage'] === 'yes' },
  { id: 'charitable_deduction', label: 'Charitable Donations', section: 'deductions', condition: (tr) => tr.deductionMethod === 'itemized' && tr.incomeDiscovery['ded_charitable'] === 'yes' },
  { id: 'gambling_losses_ded', label: 'Gambling Losses', section: 'deductions', condition: (tr) => tr.deductionMethod === 'itemized' && tr.incomeDiscovery['ded_gambling'] === 'yes' },
  { id: 'itemized_deductions', label: 'Itemized Summary', section: 'deductions', condition: wantsItemized, declarativeCondition: { type: 'field_equals', field: 'deductionMethod', value: 'itemized' } },
  // Individual above-the-line adjustment steps
  { id: 'hsa_contributions', label: 'HSA Contributions', section: 'deductions', condition: (tr) => tr.incomeDiscovery['ded_hsa'] === 'yes' },
  { id: 'archer_msa', label: 'Archer MSA', section: 'deductions', condition: (tr) => tr.incomeDiscovery['ded_archer_msa'] === 'yes', declarativeCondition: dcDiscovery('ded_archer_msa') },
  { id: 'student_loan_ded', label: 'Student Loan Interest', section: 'deductions', condition: (tr) => tr.incomeDiscovery['ded_student_loan'] === 'yes' },
  { id: 'ira_contribution_ded', label: 'IRA Contributions', section: 'deductions', condition: (tr) => tr.incomeDiscovery['ded_ira'] === 'yes' },
  { id: 'educator_expenses_ded', label: 'Educator Expenses', section: 'deductions', condition: (tr) => tr.incomeDiscovery['ded_educator'] === 'yes' },
  { id: 'alimony_paid', label: 'Alimony Paid', section: 'deductions', condition: (tr) => tr.incomeDiscovery['ded_alimony'] === 'yes' },
  { id: 'nol_carryforward', label: 'NOL Carryforward', section: 'deductions', condition: (tr) => tr.incomeDiscovery['ded_nol'] === 'yes' },
  // Other deduction situations
  { id: 'estimated_payments', label: 'Estimated Payments', section: 'deductions', condition: (tr) => tr.incomeDiscovery['ded_estimated_payments'] === 'yes', declarativeCondition: dcDiscovery('ded_estimated_payments') },
  { id: 'schedule1a', label: 'Tips/Overtime/Car Loan', section: 'deductions', condition: (tr) => tr.incomeDiscovery['schedule1a'] === 'yes', declarativeCondition: dcDiscovery('schedule1a') },
  { id: 'investment_interest', label: 'Investment Interest', section: 'deductions', condition: (tr) => tr.incomeDiscovery['investment_interest'] === 'yes', declarativeCondition: dcDiscovery('investment_interest') },
  { id: 'form8606', label: 'Roth Conversion', section: 'deductions', condition: (tr) => tr.incomeDiscovery['form8606'] === 'yes', declarativeCondition: dcDiscovery('form8606') },
  { id: 'schedule_h', label: 'Household Employees', section: 'deductions', condition: (tr) => tr.incomeDiscovery['schedule_h'] === 'yes', declarativeCondition: dcDiscovery('schedule_h') },
  { id: 'form5329', label: 'Excess Contributions', section: 'deductions', condition: (tr) => {
    if (tr.incomeDiscovery['form5329'] === 'yes') return true;
    // Auto-surface when excess contributions already recorded
    const ec = tr.excessContributions;
    if (ec && ((ec.iraExcessContribution || 0) > 0 || (ec.hsaExcessContribution || 0) > 0 || (ec.esaExcessContribution || 0) > 0)) return true;
    // Auto-surface when HSA contributions exceed the limit
    const hsaAmount = tr.hsaDeduction || 0;
    if (hsaAmount > 0) {
      const baseLimit = tr.hsaContribution?.coverageType === 'family' ? 8550 : 4300;
      const catchUp = (tr.hsaContribution?.catchUpContributions || 0) > 0 ? 1000 : 0;
      if (hsaAmount > baseLimit + catchUp) return true;
    }
    // Auto-surface when IRA contributions exceed the limit
    const iraAmount = tr.iraContribution || 0;
    if (iraAmount > 0 && tr.dateOfBirth) {
      const age = Math.floor((Date.now() - new Date(tr.dateOfBirth).getTime()) / 31557600000);
      const iraLimit = 7000 + (age >= 50 ? 1000 : 0);
      if (iraAmount > iraLimit) return true;
    }
    return false;
  }, declarativeCondition: dcDiscovery('form5329') },
  { id: 'bad_debt', label: 'Bad Debt', section: 'deductions', condition: (tr) => tr.incomeDiscovery['bad_debt'] === 'yes', declarativeCondition: dcDiscovery('bad_debt') },
  { id: 'casualty_loss', label: 'Casualty Loss', section: 'deductions', condition: (tr) => tr.incomeDiscovery['casualty_loss'] === 'yes', declarativeCondition: dcDiscovery('casualty_loss') },
  { id: 'qbi_detail', label: 'QBI Detail', section: 'deductions', condition: (tr) => tr.incomeDiscovery['qbi_detail'] === 'yes', declarativeCondition: dcDiscovery('qbi_detail') },
  { id: 'amt_data', label: 'AMT Adjustments', section: 'deductions', condition: (tr) => tr.incomeDiscovery['amt_data'] === 'yes', declarativeCondition: dcDiscovery('amt_data') },
  { id: 'form8582_data', label: 'Passive Loss Data', section: 'deductions', condition: (tr) => ((tr.rentalProperties || []).length > 0 || (tr.incomeK1 || []).some(k => k.isPassiveActivity || k.rentalIncome)), declarativeCondition: { type: 'any', conditions: [{ type: 'array_not_empty', field: 'rentalProperties' }, { type: 'field_truthy', field: 'incomeK1' }] } },
  { id: 'deductions_summary', label: 'Deductions Summary', section: 'deductions' },

  // Credits
  { id: 'transition_credits', label: 'Credits', section: 'credits' },
  { id: 'credits_overview', label: 'Credits Overview', section: 'credits' },
  { id: 'child_tax_credit', label: 'Child Tax Credit', section: 'credits', condition: wantsChildCredit, declarativeCondition: dcDiscovery('child_credit') },
  { id: 'education_credits', label: 'Education Credits', section: 'credits', condition: wantsEducationCredit, declarativeCondition: dcDiscovery('education_credit') },
  { id: 'dependent_care', label: 'Dependent Care', section: 'credits', condition: (tr) => tr.incomeDiscovery['dependent_care'] === 'yes', declarativeCondition: dcDiscovery('dependent_care') },
  { id: 'savers_credit', label: "Saver's Credit", section: 'credits', condition: (tr) => tr.incomeDiscovery['savers_credit'] === 'yes', declarativeCondition: { type: 'all', conditions: [dcDiscovery('savers_credit'), { type: 'agi_lte', thresholds: { single: 36500, mfj: 73000, mfs: 36500, hoh: 54750, qss: 73000 } }] } },
  { id: 'clean_energy', label: 'Clean Energy Credit', section: 'credits', condition: (tr) => tr.incomeDiscovery['clean_energy'] === 'yes', declarativeCondition: dcDiscovery('clean_energy') },
  { id: 'ev_refueling', label: 'EV Charging Credit', section: 'credits', condition: (tr) => tr.incomeDiscovery['ev_refueling'] === 'yes', declarativeCondition: dcDiscovery('ev_refueling') },
  { id: 'ev_credit', label: 'EV Credit', section: 'credits', condition: (tr) => tr.incomeDiscovery['ev_credit'] === 'yes', declarativeCondition: { type: 'all', conditions: [dcDiscovery('ev_credit'), { type: 'agi_lte', thresholds: { single: 150000, mfj: 300000, mfs: 150000, hoh: 225000, qss: 300000 } }] } },
  { id: 'energy_efficiency', label: 'Home Improvement Credit', section: 'credits', condition: (tr) => tr.incomeDiscovery['energy_efficiency'] === 'yes', declarativeCondition: dcDiscovery('energy_efficiency') },
  { id: 'scholarship_credit', label: 'Scholarship Credit', section: 'credits', condition: (tr) => tr.incomeDiscovery['scholarship_credit'] === 'yes', declarativeCondition: dcDiscovery('scholarship_credit') },
  { id: 'adoption_credit', label: 'Adoption Credit', section: 'credits', condition: (tr) => tr.incomeDiscovery['adoption_credit'] === 'yes', declarativeCondition: dcDiscovery('adoption_credit') },
  { id: 'premium_tax_credit', label: 'Premium Tax Credit', section: 'credits', condition: (tr) => tr.incomeDiscovery['premium_tax_credit'] === 'yes', declarativeCondition: dcDiscovery('premium_tax_credit') },
  { id: 'elderly_disabled', label: 'Elderly/Disabled Credit', section: 'credits', condition: (tr) => tr.incomeDiscovery['elderly_disabled'] === 'yes', declarativeCondition: dcDiscovery('elderly_disabled') },
  { id: 'prior_year_amt_credit', label: 'Prior Year AMT Credit', section: 'credits', condition: (tr) => tr.incomeDiscovery['prior_year_amt_credit'] === 'yes', declarativeCondition: dcDiscovery('prior_year_amt_credit') },
  { id: 'foreign_tax_credit', label: 'Foreign Tax Credit', section: 'credits', condition: (tr) => tr.incomeDiscovery['foreign_tax_credit'] === 'yes', declarativeCondition: dcDiscovery('foreign_tax_credit') },
  { id: 'credits_summary', label: 'Credits Summary', section: 'credits' },

  // State Taxes
  { id: 'transition_state', label: 'State Taxes', section: 'state' },
  { id: 'state_overview', label: 'State Selection', section: 'state' },
  { id: 'state_details', label: 'State Details', section: 'state', condition: hasStateReturns, declarativeCondition: DC_STATE_RETURNS },
  { id: 'state_review', label: 'State Summary', section: 'state', condition: hasStateReturns, declarativeCondition: DC_STATE_RETURNS },

  // Review
  { id: 'transition_review', label: 'Review', section: 'review' },
  { id: 'review_schedule_c', label: 'Schedule C Review', section: 'review', condition: hasSelfeEmployment, declarativeCondition: DC_SELF_EMPLOYMENT },
  { id: 'amt_review', label: 'AMT Review', section: 'review' },
  { id: 'form8582_review', label: 'Passive Loss Review', section: 'review', condition: (tr) => ((tr.rentalProperties || []).length > 0 || (tr.incomeK1 || []).some(k => k.isPassiveActivity || k.rentalIncome)) },
  { id: 'review_form_1040', label: 'Form 1040 Review', section: 'review' },
  { id: 'tax_summary', label: 'Tax Summary', section: 'review' },
  { id: 'explain_taxes', label: 'Explain My Taxes', section: 'review' },

  // Finish
  { id: 'refund_payment', label: 'Refund & Payment', section: 'finish' },
  { id: 'filing_instructions', label: 'Filing Instructions', section: 'finish' },
  { id: 'export_pdf', label: 'Export & PDF', section: 'finish' },
];

// ─── Save State ─────────────────────────────────
export type SaveState = 'idle' | 'saving' | 'saved';

// ─── Store ──────────────────────────────────────
interface TaxReturnState {
  returnId: string | null;
  taxReturn: TaxReturn | null;
  calculation: CalculationResult | null;
  currentStepIndex: number;
  /** Highest step index the user has organically reached (for nav guard). */
  highestStepVisited: number;
  startTime: number | null;
  saveState: SaveState;
  /** Set when user jumps ahead of their furthest progress — cleared on navigation. */
  jumpAheadWarning: boolean;
  /** When set, the tool view is shown instead of the current wizard step. */
  activeToolId: string | null;
  /** Current view mode: wizard interview or forms mode PDF viewer */
  viewMode: 'wizard' | 'forms';
  /** Active form in Forms Mode */
  activeFormId: string;
  activeInstanceIndex: number;
  /** When set, PdfFormViewer will focus this lineId's field after loading. */
  pendingFocusLineId: string | null;
  /** Multi-select form keys ("formId:instanceIndex") for batch view/print/download */
  selectedFormKeys: Set<string>;

  setReturn: (taxReturn: TaxReturn) => void;
  setReturnId: (id: string) => void;
  setCalculation: (calc: CalculationResult | null) => void;
  updateField: (field: string, value: unknown) => void;
  /** Set a value at a deep dot-path (e.g., "directDeposit.routingNumber") */
  updateDeepField: (path: string, value: unknown) => void;
  setCurrentStep: (index: number) => void;
  setStartTime: (time: number) => void;
  setSaveState: (state: SaveState) => void;
  dismissJumpWarning: () => void;
  setActiveTool: (toolId: string | null) => void;
  setViewMode: (mode: 'wizard' | 'forms') => void;
  setActiveForm: (formId: string, instanceIndex: number) => void;
  /** Switch to Forms Mode and navigate to the given form, optionally focusing a line. */
  navigateToFormLine: (formId: string, lineId?: string) => void;
  clearPendingFocus: () => void;
  toggleFormSelection: (key: string) => void;
  selectAllForms: (keys: string[]) => void;
  clearFormSelection: () => void;

  getVisibleSteps: () => WizardStep[];
  getCurrentStep: () => WizardStep | null;
  goNext: () => void;
  goPrev: () => void;
  goToStep: (stepId: string) => void;
}

export const useTaxReturnStore = create<TaxReturnState>((set, get) => ({
  returnId: null,
  taxReturn: null,
  calculation: null,
  currentStepIndex: 0,
  highestStepVisited: 0,
  startTime: null,
  saveState: 'idle' as SaveState,
  jumpAheadWarning: false,
  activeToolId: null,
  viewMode: 'wizard' as const,
  activeFormId: 'f1040',
  activeInstanceIndex: 0,
  pendingFocusLineId: null,
  selectedFormKeys: new Set<string>(),

  setReturn: (taxReturn) => set({ taxReturn }),
  setReturnId: (id) => set({ returnId: id }),
  setCalculation: (calc) => set({ calculation: calc }),
  setSaveState: (state) => set({ saveState: state }),
  dismissJumpWarning: () => set({ jumpAheadWarning: false }),
  setActiveTool: (toolId) => set({ activeToolId: toolId }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveForm: (formId, instanceIndex) => set({ activeFormId: formId, activeInstanceIndex: instanceIndex }),
  navigateToFormLine: (formId, lineId) => set({ viewMode: 'forms', activeFormId: formId, activeInstanceIndex: 0, pendingFocusLineId: lineId ?? null }),
  clearPendingFocus: () => set({ pendingFocusLineId: null }),
  toggleFormSelection: (key) => set((state) => {
    const next = new Set(state.selectedFormKeys);
    if (next.has(key)) next.delete(key); else next.add(key);
    return { selectedFormKeys: next };
  }),
  selectAllForms: (keys) => set({ selectedFormKeys: new Set(keys) }),
  clearFormSelection: () => set({ selectedFormKeys: new Set<string>() }),

  updateField: (field, value) => {
    const { taxReturn } = get();
    if (!taxReturn) return;
    const updated = { ...taxReturn, [field]: value, updatedAt: new Date().toISOString() };
    set({ taxReturn: updated, saveState: 'saving' });
    // Auto-persist to localStorage (debounced — reads fresh state when timer fires)
    debouncedAutoSave(() => {
      set({ saveState: 'saved' });
      setTimeout(() => {
        // Only reset if still 'saved' (avoid clobbering an active 'saving' state)
        if (get().saveState === 'saved') set({ saveState: 'idle' });
      }, 1500);
    });
  },

  updateDeepField: (path, value) => {
    const { taxReturn } = get();
    if (!taxReturn) return;
    const updated = setDeepPath(
      { ...taxReturn, updatedAt: new Date().toISOString() },
      path,
      value,
    ) as TaxReturn;
    set({ taxReturn: updated, saveState: 'saving' });
    debouncedAutoSave(() => {
      set({ saveState: 'saved' });
      setTimeout(() => {
        if (get().saveState === 'saved') set({ saveState: 'idle' });
      }, 1500);
    });
  },

  setCurrentStep: (index) => set({ currentStepIndex: index }),
  setStartTime: (time) => set({ startTime: time }),

  getVisibleSteps: () => {
    const { taxReturn, calculation } = get();
    if (!taxReturn) return WIZARD_STEPS.filter((s) => !s.condition && !s.declarativeCondition);
    return WIZARD_STEPS.filter((s) => {
      // Prefer declarative condition when present
      if (s.declarativeCondition) return evaluateCondition(s.declarativeCondition, taxReturn, calculation);
      // Fall back to legacy imperative condition
      if (s.condition) return s.condition(taxReturn);
      // No condition = always visible
      return true;
    });
  },

  getCurrentStep: () => {
    const { currentStepIndex } = get();
    const visible = get().getVisibleSteps();
    return visible[currentStepIndex] || null;
  },

  goNext: () => {
    // Flush any pending debounced auto-save before navigating to prevent
    // the race condition where field edits are lost by the step position write.
    flushAutoSave();
    const { currentStepIndex, highestStepVisited, taxReturn } = get();
    const visible = get().getVisibleSteps();
    if (currentStepIndex < visible.length - 1) {
      const newIndex = currentStepIndex + 1;
      const newStep = visible[newIndex];
      const newHighest = Math.max(highestStepVisited, newIndex);
      set({ currentStepIndex: newIndex, highestStepVisited: newHighest, jumpAheadWarning: false });
      // Persist step position to localStorage
      if (taxReturn && newStep) {
        const updated = { ...taxReturn, currentStep: newIndex, currentStepId: newStep.id, highestStepVisited: newHighest, updatedAt: new Date().toISOString() };
        set({ taxReturn: updated });
        writeReturn(updated);
      }
    }
  },

  goPrev: () => {
    flushAutoSave();
    const { currentStepIndex, taxReturn } = get();
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      const visible = get().getVisibleSteps();
      const newStep = visible[newIndex];
      set({ currentStepIndex: newIndex });
      if (taxReturn && newStep) {
        const updated = { ...taxReturn, currentStep: newIndex, currentStepId: newStep.id, updatedAt: new Date().toISOString() };
        set({ taxReturn: updated });
        writeReturn(updated);
      }
    }
  },

  goToStep: (stepId) => {
    flushAutoSave();
    let visible = get().getVisibleSteps();
    let index = visible.findIndex((s) => s.id === stepId);

    // If step isn't visible, try to auto-enable its discovery flag so the step appears
    if (index < 0) {
      const { taxReturn } = get();
      if (taxReturn) {
        const stepDef = WIZARD_STEPS.find((s) => s.id === stepId);
        const dc = stepDef?.declarativeCondition;
        if (dc && dc.type === 'discovery_equals' && dc.incomeType) {
          const disc = { ...(taxReturn.incomeDiscovery || {}), [dc.incomeType]: dc.value };
          const updated = { ...taxReturn, incomeDiscovery: disc, updatedAt: new Date().toISOString() };
          set({ taxReturn: updated });
          writeReturn(updated);
          // Re-evaluate visible steps after enabling the discovery flag
          visible = get().getVisibleSteps();
          index = visible.findIndex((s) => s.id === stepId);
        }
      }
    }

    if (index >= 0) {
      const { taxReturn, highestStepVisited } = get();
      const isJumpingAhead = index > highestStepVisited;
      set({ currentStepIndex: index, jumpAheadWarning: isJumpingAhead, activeToolId: null, viewMode: 'wizard' });
      if (taxReturn) {
        const updated = { ...taxReturn, currentStep: index, currentStepId: stepId, updatedAt: new Date().toISOString() };
        set({ taxReturn: updated });
        writeReturn(updated);
      }
    }
  },
}));
