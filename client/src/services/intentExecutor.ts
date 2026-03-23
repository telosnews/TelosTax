/**
 * Intent Executor
 *
 * Translates LLM-returned ChatAction objects into calls to the existing
 * client API functions (addIncomeItem, updateField, upsertItemized, etc.).
 *
 * Each action is executed independently; partial failures don't block other
 * actions. Returns a summary of what was applied and what failed.
 */

import type { ChatAction } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';
import {
  addIncomeItem,
  updateReturn,
  upsertItemized,
  upsertBusiness,
  getReturn,
  writeReturn,
} from '../api/client';
import { deleteItemWithUndo } from '../utils/deleteWithUndo';
import { useTaxReturnStore, WIZARD_STEPS } from '../store/taxReturnStore';

// ─── Result Types ─────────────────────────────────

export interface ActionResult {
  action: ChatAction;
  success: boolean;
  summary: string;
  error?: string;
}

export interface ExecutionResult {
  results: ActionResult[];
  successCount: number;
  failureCount: number;
}

// ─── Filing Status Mapping ────────────────────────

const FILING_STATUS_MAP: Record<string, FilingStatus> = {
  single: FilingStatus.Single,
  married_filing_jointly: FilingStatus.MarriedFilingJointly,
  married_jointly: FilingStatus.MarriedFilingJointly,
  mfj: FilingStatus.MarriedFilingJointly,
  married_filing_separately: FilingStatus.MarriedFilingSeparately,
  married_separately: FilingStatus.MarriedFilingSeparately,
  mfs: FilingStatus.MarriedFilingSeparately,
  head_of_household: FilingStatus.HeadOfHousehold,
  hoh: FilingStatus.HeadOfHousehold,
  qualifying_surviving_spouse: FilingStatus.QualifyingSurvivingSpouse,
  qualifying_widow: FilingStatus.QualifyingSurvivingSpouse,
  qss: FilingStatus.QualifyingSurvivingSpouse,
};

// ─── Income Type Labels (for summaries) ───────────

const INCOME_TYPE_LABELS: Record<string, string> = {
  w2: 'W-2',
  '1099nec': '1099-NEC',
  '1099k': '1099-K',
  '1099int': '1099-INT',
  '1099div': '1099-DIV',
  '1099r': '1099-R',
  '1099g': '1099-G',
  '1099misc': '1099-MISC',
  '1099b': '1099-B',
  '1099da': '1099-DA',
  '1099sa': '1099-SA',
  '1099oid': '1099-OID',
  '1099q': '1099-Q',
  '1099c': '1099-C',
  w2g: 'W-2G',
  k1: 'K-1',
  'rental-properties': 'Rental property',
  '1098': '1098',
  '1098t': '1098-T',
  '1098e': '1098-E',
  '1095a': '1095-A',
  '1099s': '1099-S',
};

// ─── Income Discovery Key Mapping ─────────────────

const INCOME_DISCOVERY_KEYS: Record<string, string> = {
  w2: 'w2',
  '1099nec': '1099nec',
  '1099k': '1099k',
  '1099int': '1099int',
  '1099div': '1099div',
  '1099r': '1099r',
  '1099g': '1099g',
  '1099misc': '1099misc',
  '1099b': '1099b',
  '1099da': '1099da',
  '1099sa': '1099sa',
  '1099oid': '1099oid',
  '1099q': '1099q',
  '1099c': '1099c',
  w2g: 'w2g',
  k1: 'k1',
  'rental-properties': 'rental',
  '1098': 'ded_mortgage',
  '1098t': 'education_credit',
  '1098e': 'ded_student_loan',
  '1095a': 'premium_tax_credit',
  '1099s': 'home_sale',
};

// ─── Single Action Executors ──────────────────────

function executeAddIncome(
  action: Extract<ChatAction, { type: 'add_income' }>,
  returnId: string,
): ActionResult {
  try {
    const { incomeType, fields } = action;
    const label = INCOME_TYPE_LABELS[incomeType] || incomeType;

    // Add the income item (writes to localStorage immediately)
    addIncomeItem(returnId, incomeType, fields);

    // Also set income discovery to 'yes' so the wizard step becomes visible.
    // Write directly to localStorage (not via debounced store.updateField)
    // so the final store refresh picks up both the income data AND the flag.
    const discoveryKey = INCOME_DISCOVERY_KEYS[incomeType];
    if (discoveryKey) {
      const tr = getReturn(returnId);
      const existingDiscovery = tr.incomeDiscovery || {};
      updateReturn(returnId, {
        incomeDiscovery: { ...existingDiscovery, [discoveryKey]: 'yes' },
      });
    }

    // Build a human-readable summary
    const name =
      (fields.employerName as string) ||
      (fields.payerName as string) ||
      (fields.platformName as string) ||
      (fields.brokerName as string) ||
      '';
    const amount =
      (fields.wages as number) ||
      (fields.amount as number) ||
      (fields.grossAmount as number) ||
      (fields.proceeds as number) ||
      0;

    const parts = [`Added ${label}`];
    if (name) parts.push(`from ${name}`);
    if (amount) parts.push(`($${amount.toLocaleString()})`);

    return { action, success: true, summary: parts.join(' ') };
  } catch (err: any) {
    return {
      action,
      success: false,
      summary: `Failed to add income`,
      error: err.message,
    };
  }
}

function executeSetFilingStatus(
  action: Extract<ChatAction, { type: 'set_filing_status' }>,
  returnId: string,
): ActionResult {
  try {
    const normalized = action.status.toLowerCase().replace(/[\s-]+/g, '_');
    const enumVal = FILING_STATUS_MAP[normalized];

    if (enumVal === undefined) {
      return {
        action,
        success: false,
        summary: `Unknown filing status: "${action.status}"`,
        error: `Unrecognized filing status value`,
      };
    }

    updateReturn(returnId, { filingStatus: enumVal });

    const labels: Record<number, string> = {
      [FilingStatus.Single]: 'Single',
      [FilingStatus.MarriedFilingJointly]: 'Married Filing Jointly',
      [FilingStatus.MarriedFilingSeparately]: 'Married Filing Separately',
      [FilingStatus.HeadOfHousehold]: 'Head of Household',
      [FilingStatus.QualifyingSurvivingSpouse]:
        'Qualifying Surviving Spouse',
    };

    return {
      action,
      success: true,
      summary: `Set filing status to ${labels[enumVal]}`,
    };
  } catch (err: any) {
    return {
      action,
      success: false,
      summary: `Failed to set filing status`,
      error: err.message,
    };
  }
}

function executeAddDependent(
  action: Extract<ChatAction, { type: 'add_dependent' }>,
  returnId: string,
): ActionResult {
  try {
    addIncomeItem(returnId, 'dependents', action.fields);

    const name =
      (action.fields.firstName as string) || 'dependent';

    return {
      action,
      success: true,
      summary: `Added dependent: ${name}`,
    };
  } catch (err: any) {
    return {
      action,
      success: false,
      summary: `Failed to add dependent`,
      error: err.message,
    };
  }
}

function executeSetDeductionMethod(
  action: Extract<ChatAction, { type: 'set_deduction_method' }>,
  returnId: string,
): ActionResult {
  try {
    updateReturn(returnId, { deductionMethod: action.method });

    const label =
      action.method === 'standard'
        ? 'Standard Deduction'
        : 'Itemized Deductions';
    return {
      action,
      success: true,
      summary: `Set deduction method to ${label}`,
    };
  } catch (err: any) {
    return {
      action,
      success: false,
      summary: `Failed to set deduction method`,
      error: err.message,
    };
  }
}

function executeUpdateItemized(
  action: Extract<ChatAction, { type: 'update_itemized' }>,
  returnId: string,
): ActionResult {
  try {
    upsertItemized(returnId, action.fields);

    // Also switch to itemized if not already
    const tr = getReturn(returnId);
    if (tr.deductionMethod !== 'itemized') {
      updateReturn(returnId, { deductionMethod: 'itemized' });
    }

    const fieldNames = Object.keys(action.fields);
    const total = Object.values(action.fields).reduce(
      (sum, v) => sum + (typeof v === 'number' ? v : 0),
      0,
    );
    return {
      action,
      success: true,
      summary: `Updated ${fieldNames.length} itemized deduction${fieldNames.length === 1 ? '' : 's'} ($${total.toLocaleString()})`,
    };
  } catch (err: any) {
    return {
      action,
      success: false,
      summary: `Failed to update itemized deductions`,
      error: err.message,
    };
  }
}

function executeSetIncomeDiscovery(
  action: Extract<ChatAction, { type: 'set_income_discovery' }>,
  returnId: string,
): ActionResult {
  try {
    const tr = getReturn(returnId);
    const existing = tr.incomeDiscovery || {};
    updateReturn(returnId, {
      incomeDiscovery: { ...existing, [action.incomeType]: action.value },
    });

    const label =
      INCOME_TYPE_LABELS[action.incomeType] || action.incomeType;
    const verb = action.value === 'yes' ? 'enabled' : 'disabled';
    return {
      action,
      success: true,
      summary: `${label} income ${verb}`,
    };
  } catch (err: any) {
    return {
      action,
      success: false,
      summary: `Failed to update income discovery`,
      error: err.message,
    };
  }
}

/**
 * Fields the LLM IS allowed to write via update_field (allowlist).
 * Only the fields listed in the system prompt's update_field documentation
 * are permitted. All other fields are rejected.
 */
const WRITABLE_BY_AI = new Set([
  'hsaDeduction', 'studentLoanInterest', 'iraContribution', 'iraContributionSpouse',
  'educatorExpenses', 'estimatedPaymentsMade', 'otherIncome',
  'alimonyPaid', 'alimonyReceived', 'gamblingLosses',
  'nolCarryforward', 'capitalLossCarryforward',
  'capitalLossCarryforwardST', 'capitalLossCarryforwardLT',
  'isLegallyBlind', 'isActiveDutyMilitary', 'nontaxableCombatPay',
  'movingExpenses', 'digitalAssetActivity', 'livedApartFromSpouse',
  'isDeceasedSpouseReturn',
]);

function executeUpdateField(
  action: Extract<ChatAction, { type: 'update_field' }>,
  returnId: string,
): ActionResult {
  try {
    // Guard: only allow writes to explicitly permitted fields
    if (!WRITABLE_BY_AI.has(action.field)) {
      return {
        action,
        success: false,
        summary: `Field "${action.field}" cannot be updated via update_field`,
        error: `Field not in allowlist: ${action.field}`,
      };
    }

    updateReturn(returnId, { [action.field]: action.value });

    return {
      action,
      success: true,
      summary: `Updated ${action.field}`,
    };
  } catch (err: any) {
    return {
      action,
      success: false,
      summary: `Failed to update field "${action.field}"`,
      error: err.message,
    };
  }
}

function executeNavigate(
  action: Extract<ChatAction, { type: 'navigate' }>,
): ActionResult {
  try {
    // Validate stepId against known wizard steps
    const allStepIds = WIZARD_STEPS.map((s) => s.id);
    if (!allStepIds.includes(action.stepId)) {
      return {
        action,
        success: false,
        summary: `Unknown step: "${action.stepId}"`,
        error: `Invalid stepId`,
      };
    }

    useTaxReturnStore.getState().goToStep(action.stepId);

    return {
      action,
      success: true,
      summary: `Navigated to ${action.stepId}`,
    };
  } catch (err: any) {
    return {
      action,
      success: false,
      summary: `Failed to navigate to "${action.stepId}"`,
      error: err.message,
    };
  }
}

function executeAddBusinessExpense(
  action: Extract<ChatAction, { type: 'add_business_expense' }>,
  returnId: string,
): ActionResult {
  try {
    addIncomeItem(returnId, 'expenses', {
      category: action.category,
      amount: action.amount,
      description: action.description || '',
    });

    return {
      action,
      success: true,
      summary: `Added business expense: ${action.category} ($${action.amount.toLocaleString()})`,
    };
  } catch (err: any) {
    return {
      action,
      success: false,
      summary: `Failed to add business expense`,
      error: err.message,
    };
  }
}

function executeUpdateHomeOffice(
  action: { type: 'update_home_office'; fields: Record<string, unknown> },
  returnId: string,
): ActionResult {
  try {
    const { fields } = action;
    const current = useTaxReturnStore.getState().taxReturn;
    const homeOffice = { ...(current?.homeOffice || {}), ...fields };
    updateReturn(returnId, { homeOffice });

    const method = fields.method as string | undefined;
    const summary = method === 'simplified'
      ? `Home office: simplified method, ${fields.squareFeet || '?'} sq ft`
      : method === 'actual'
        ? 'Home office: actual method'
        : 'Home office updated';
    return { action: action as any, success: true, summary };
  } catch (err: any) {
    return { action: action as any, success: false, summary: 'Failed to update home office', error: err.message };
  }
}

function executeUpdateVehicle(
  action: { type: 'update_vehicle'; fields: Record<string, unknown> },
  returnId: string,
): ActionResult {
  try {
    const { fields } = action;
    const current = useTaxReturnStore.getState().taxReturn;
    const vehicle = { ...(current?.vehicle || {}), ...fields };
    updateReturn(returnId, { vehicle });

    const method = fields.method as string | undefined;
    const summary = method === 'mileage'
      ? `Vehicle: standard mileage, ${fields.businessMiles || '?'} business miles`
      : method === 'actual'
        ? 'Vehicle: actual expenses method'
        : 'Vehicle expenses updated';
    return { action: action as any, success: true, summary };
  } catch (err: any) {
    return { action: action as any, success: false, summary: 'Failed to update vehicle', error: err.message };
  }
}

function executeUpdateBusiness(
  action: { type: 'update_business'; fields: Record<string, unknown> },
  returnId: string,
): ActionResult {
  try {
    const { fields } = action;
    const current = useTaxReturnStore.getState().taxReturn;
    const businesses = [...(current?.businesses || [])];

    if (businesses.length === 0) {
      // Create a new business
      businesses.push({
        id: `biz-${Date.now()}`,
        accountingMethod: 'cash',
        didStartThisYear: false,
        ...fields,
      } as any);
    } else {
      // Update the first business
      Object.assign(businesses[0], fields);
    }
    updateReturn(returnId, { businesses });

    const name = fields.businessName as string | undefined;
    const summary = name ? `Business set up: ${name}` : 'Business info updated';
    return { action: action as any, success: true, summary };
  } catch (err: any) {
    return { action: action as any, success: false, summary: 'Failed to update business', error: err.message };
  }
}

function executeUpdateSERetirement(
  action: { type: 'update_se_retirement'; fields: Record<string, unknown> },
  returnId: string,
): ActionResult {
  try {
    const { fields } = action;
    const current = useTaxReturnStore.getState().taxReturn;
    const sed = {
      healthInsurancePremiums: 0,
      sepIraContributions: 0,
      solo401kContributions: 0,
      otherRetirementContributions: 0,
      ...(current?.selfEmploymentDeductions || {}),
      ...fields,
    };
    // Sync backward-compat total
    const empDef = (sed.solo401kEmployeeDeferral as number) || 0;
    const empCon = (sed.solo401kEmployerContribution as number) || 0;
    sed.solo401kContributions = empDef + empCon;

    updateReturn(returnId, { selfEmploymentDeductions: sed });

    const parts: string[] = [];
    if (fields.solo401kEmployeeDeferral) parts.push(`Solo 401(k) deferral: $${(fields.solo401kEmployeeDeferral as number).toLocaleString()}`);
    if (fields.solo401kEmployerContribution) parts.push(`Solo 401(k) employer: $${(fields.solo401kEmployerContribution as number).toLocaleString()}`);
    if (fields.sepIraContributions) parts.push(`SEP-IRA: $${(fields.sepIraContributions as number).toLocaleString()}`);
    if (fields.healthInsurancePremiums) parts.push(`SE health insurance: $${(fields.healthInsurancePremiums as number).toLocaleString()}`);
    const summary = parts.length > 0 ? `SE retirement: ${parts.join(', ')}` : 'SE retirement updated';
    return { action: action as any, success: true, summary };
  } catch (err: any) {
    return { action: action as any, success: false, summary: 'Failed to update SE retirement', error: err.message };
  }
}

function executeRemoveItem(
  action: Extract<ChatAction, { type: 'remove_item' }>,
  returnId: string,
): ActionResult {
  try {
    const { itemType, match } = action;
    const label = INCOME_TYPE_LABELS[itemType] || itemType;

    // Look up the array from the current return
    const tr = getReturn(returnId);
    const FIELD_MAP: Record<string, string> = {
      w2: 'w2Income', '1099nec': 'income1099NEC', '1099k': 'income1099K',
      '1099int': 'income1099INT', '1099div': 'income1099DIV', '1099r': 'income1099R',
      '1099g': 'income1099G', '1099misc': 'income1099MISC', '1099b': 'income1099B',
      '1099da': 'income1099DA', '1099sa': 'income1099SA', '1099oid': 'income1099OID',
      '1099q': 'income1099Q', '1099c': 'income1099C', w2g: 'incomeW2G',
      k1: 'incomeK1', 'rental-properties': 'rentalProperties',
      'royalty-properties': 'royaltyProperties', dependents: 'dependents',
      expenses: 'expenses', businesses: 'businesses',
      'education-credits': 'educationCredits', 'depreciation-assets': 'depreciationAssets',
      form4797: 'form4797Properties',
    };

    const fieldName = FIELD_MAP[itemType];
    if (!fieldName) {
      return { action, success: false, summary: `Unknown item type: "${itemType}"`, error: 'Invalid itemType' };
    }

    const arr = (tr as any)[fieldName] as any[] | undefined;
    if (!arr || arr.length === 0) {
      return { action, success: false, summary: `No ${label} items to remove`, error: 'Array is empty' };
    }

    // Find matching items by comparing match criteria against each item
    const matchKeys = Object.keys(match);
    const matches = arr.filter((item) =>
      matchKeys.every((key) => {
        const expected = match[key];
        const actual = item[key];
        if (actual === undefined || actual === null) return false;
        // Approximate numeric matching (within 1%) for privacy-rounded amounts
        if (typeof expected === 'number' && typeof actual === 'number') {
          return expected === 0 ? actual === 0 : Math.abs(actual - expected) / Math.abs(expected) < 0.02;
        }
        // Case-insensitive string matching
        if (typeof expected === 'string' && typeof actual === 'string') {
          return actual.toLowerCase().includes(expected.toLowerCase());
        }
        return actual === expected;
      }),
    );

    if (matches.length === 0) {
      return { action, success: false, summary: `No matching ${label} found`, error: 'No items matched the criteria' };
    }

    // Require at least 2 match criteria when multiple items match to prevent ambiguous deletions
    if (matches.length > 1 && matchKeys.length < 2) {
      const names = matches.map((m) =>
        m.employerName || m.payerName || m.platformName || m.brokerName || m.entityName || m.firstName || m.description || '(unnamed)',
      );
      return {
        action,
        success: false,
        summary: `Found ${matches.length} matching ${label}s — can you specify which one? (${names.join(', ')})`,
        error: 'Ambiguous match: provide additional criteria to identify the item',
      };
    }

    // Remove the first match (with undo toast)
    const target = matches[0];
    const name = target.employerName || target.payerName || target.platformName ||
      target.brokerName || target.entityName || target.firstName || target.description || '';

    deleteItemWithUndo({
      returnId,
      fieldName,
      item: target,
      label: `${label}${name ? ` (${name})` : ''}`,
    });

    const parts = [`Removed ${label}`];
    if (name) parts.push(`(${name})`);

    return { action, success: true, summary: parts.join(' ') };
  } catch (err: any) {
    return { action, success: false, summary: 'Failed to remove item', error: err.message };
  }
}

// ─── Main Executor ────────────────────────────────

/**
 * Execute an array of ChatActions against the current tax return.
 *
 * Each action is executed independently — a failure in one action does
 * not prevent subsequent actions from being attempted.
 *
 * After all data mutations, refreshes the store from localStorage
 * to keep the UI in sync.
 */
export function executeActions(
  actions: ChatAction[],
  returnId: string,
): ExecutionResult {
  const results: ActionResult[] = [];

  for (const action of actions) {
    let result: ActionResult;

    switch (action.type) {
      case 'add_income':
        result = executeAddIncome(action, returnId);
        break;
      case 'set_filing_status':
        result = executeSetFilingStatus(action, returnId);
        break;
      case 'add_dependent':
        result = executeAddDependent(action, returnId);
        break;
      case 'set_deduction_method':
        result = executeSetDeductionMethod(action, returnId);
        break;
      case 'update_itemized':
        result = executeUpdateItemized(action, returnId);
        break;
      case 'set_income_discovery':
        result = executeSetIncomeDiscovery(action, returnId);
        break;
      case 'update_field':
        result = executeUpdateField(action, returnId);
        break;
      case 'navigate':
        result = executeNavigate(action);
        break;
      case 'add_business_expense':
        result = executeAddBusinessExpense(action, returnId);
        break;
      case 'update_home_office':
        result = executeUpdateHomeOffice(action, returnId);
        break;
      case 'update_vehicle':
        result = executeUpdateVehicle(action, returnId);
        break;
      case 'update_business':
        result = executeUpdateBusiness(action, returnId);
        break;
      case 'update_se_retirement':
        result = executeUpdateSERetirement(action, returnId);
        break;
      case 'remove_item':
        result = executeRemoveItem(action, returnId);
        break;
      case 'no_action':
        result = {
          action,
          success: true,
          summary: 'No action needed',
        };
        break;
      default:
        result = {
          action,
          success: false,
          summary: `Unknown action type: ${(action as any).type}`,
          error: 'Unrecognized action type',
        };
    }

    results.push(result);
  }

  // After data mutations, refresh the store from localStorage
  // so the UI reflects the changes
  const hasMutations = results.some(
    (r) =>
      r.success &&
      r.action.type !== 'no_action' &&
      r.action.type !== 'navigate',
  );

  if (hasMutations) {
    try {
      const freshReturn = getReturn(returnId);
      useTaxReturnStore.getState().setReturn(freshReturn);
    } catch {
      // Return may have been deleted or ID is invalid — non-fatal
    }
  }

  return {
    results,
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
  };
}

/**
 * Generate a human-readable summary string from an ExecutionResult.
 */
export function summarizeExecution(result: ExecutionResult): string {
  if (result.results.length === 0) return 'No actions to apply.';

  const summaries = result.results
    .filter((r) => r.action.type !== 'no_action')
    .map((r) => (r.success ? `\u2713 ${r.summary}` : `\u2717 ${r.summary}`));

  if (summaries.length === 0) return 'No actions to apply.';

  return summaries.join('\n');
}
