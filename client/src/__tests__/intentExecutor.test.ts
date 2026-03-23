/**
 * Intent Executor Unit Tests
 *
 * Tests the mapping from ChatAction types to client API calls.
 * Mocks the Zustand store and client API functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatAction } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';

// ─── Mocks ────────────────────────────────────────

// Mock the client API module
vi.mock('../api/client', () => ({
  addIncomeItem: vi.fn(() => ({ id: 'mock-id-1' })),
  updateReturn: vi.fn(() => ({
    id: 'return-1',
    filingStatus: 1,
    dependents: [],
    incomeDiscovery: {},
    deductionMethod: 'standard',
  })),
  upsertItemized: vi.fn(() => ({})),
  upsertBusiness: vi.fn(() => ({})),
  getReturn: vi.fn(() => ({
    id: 'return-1',
    filingStatus: 1,
    dependents: [],
    incomeDiscovery: {},
    deductionMethod: 'standard',
    w2Income: [],
  })),
  writeReturn: vi.fn(),
}));

// Mock the Zustand store
const mockUpdateField = vi.fn();
const mockGoToStep = vi.fn();
const mockSetReturn = vi.fn();

vi.mock('../store/taxReturnStore', () => ({
  useTaxReturnStore: {
    getState: vi.fn(() => ({
      taxReturn: {
        id: 'return-1',
        incomeDiscovery: {},
        deductionMethod: 'standard',
      },
      updateField: mockUpdateField,
      goToStep: mockGoToStep,
      setReturn: mockSetReturn,
    })),
  },
  WIZARD_STEPS: [
    { id: 'welcome', label: 'Welcome', section: 'my_info' },
    { id: 'filing_status', label: 'Filing Status', section: 'my_info' },
    { id: 'w2_income', label: 'W-2 Income', section: 'income' },
    { id: 'income_overview', label: 'Income Overview', section: 'income' },
    { id: 'tax_summary', label: 'Tax Summary', section: 'review' },
  ],
}));

// Now import the module under test (after mocks are set up)
import { executeActions, summarizeExecution } from '../services/intentExecutor';
import { addIncomeItem, updateReturn, upsertItemized, getReturn } from '../api/client';

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════
// ADD INCOME
// ═══════════════════════════════════════════════════

describe('add_income action', () => {
  it('calls addIncomeItem with correct type and fields', () => {
    const actions: ChatAction[] = [
      {
        type: 'add_income',
        incomeType: 'w2',
        fields: { employerName: 'Acme Corp', wages: 75000, federalTaxWithheld: 12000 },
      },
    ];

    const result = executeActions(actions, 'return-1');

    expect(addIncomeItem).toHaveBeenCalledWith('return-1', 'w2', {
      employerName: 'Acme Corp',
      wages: 75000,
      federalTaxWithheld: 12000,
    });
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(0);
  });

  it('sets income discovery to yes via updateReturn when adding income', () => {
    const actions: ChatAction[] = [
      {
        type: 'add_income',
        incomeType: '1099nec',
        fields: { payerName: 'Client LLC', amount: 5000 },
      },
    ];

    executeActions(actions, 'return-1');

    // Should write discovery flag directly to localStorage via updateReturn
    expect(updateReturn).toHaveBeenCalledWith('return-1', {
      incomeDiscovery: { '1099nec': 'yes' },
    });
  });

  it('produces a readable summary with employer name and amount', () => {
    const actions: ChatAction[] = [
      {
        type: 'add_income',
        incomeType: 'w2',
        fields: { employerName: 'Acme Corp', wages: 75000 },
      },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].summary).toContain('W-2');
    expect(result.results[0].summary).toContain('Acme Corp');
    expect(result.results[0].summary).toContain('75,000');
  });

  it('handles 1099-INT with payer name', () => {
    const actions: ChatAction[] = [
      {
        type: 'add_income',
        incomeType: '1099int',
        fields: { payerName: 'Chase Bank', amount: 250 },
      },
    ];

    const result = executeActions(actions, 'return-1');

    expect(addIncomeItem).toHaveBeenCalledWith('return-1', '1099int', {
      payerName: 'Chase Bank',
      amount: 250,
    });
    expect(result.results[0].summary).toContain('1099-INT');
    expect(result.results[0].summary).toContain('Chase Bank');
  });

  it('handles addIncomeItem errors gracefully', () => {
    vi.mocked(addIncomeItem).mockImplementationOnce(() => {
      throw new Error('Unknown item type: invalid');
    });

    const actions: ChatAction[] = [
      {
        type: 'add_income',
        incomeType: 'invalid',
        fields: {},
      },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(1);
    expect(result.results[0].error).toContain('Unknown item type');
  });
});

// ═══════════════════════════════════════════════════
// SET FILING STATUS
// ═══════════════════════════════════════════════════

describe('set_filing_status action', () => {
  it('maps "single" to FilingStatus.Single via updateReturn', () => {
    const actions: ChatAction[] = [
      { type: 'set_filing_status', status: 'single' },
    ];

    executeActions(actions, 'return-1');

    expect(updateReturn).toHaveBeenCalledWith('return-1', { filingStatus: FilingStatus.Single });
  });

  it('maps "married_filing_jointly" to FilingStatus.MarriedFilingJointly', () => {
    const actions: ChatAction[] = [
      { type: 'set_filing_status', status: 'married_filing_jointly' },
    ];

    executeActions(actions, 'return-1');

    expect(updateReturn).toHaveBeenCalledWith('return-1', {
      filingStatus: FilingStatus.MarriedFilingJointly,
    });
  });

  it('handles abbreviations like "mfj"', () => {
    const actions: ChatAction[] = [
      { type: 'set_filing_status', status: 'mfj' },
    ];

    executeActions(actions, 'return-1');

    expect(updateReturn).toHaveBeenCalledWith('return-1', {
      filingStatus: FilingStatus.MarriedFilingJointly,
    });
  });

  it('handles "head_of_household"', () => {
    const actions: ChatAction[] = [
      { type: 'set_filing_status', status: 'head_of_household' },
    ];

    executeActions(actions, 'return-1');

    expect(updateReturn).toHaveBeenCalledWith('return-1', {
      filingStatus: FilingStatus.HeadOfHousehold,
    });
  });

  it('handles case and whitespace variations', () => {
    const actions: ChatAction[] = [
      { type: 'set_filing_status', status: 'Married Filing Separately' },
    ];

    executeActions(actions, 'return-1');

    expect(updateReturn).toHaveBeenCalledWith('return-1', {
      filingStatus: FilingStatus.MarriedFilingSeparately,
    });
  });

  it('fails gracefully for unknown filing status', () => {
    const actions: ChatAction[] = [
      { type: 'set_filing_status', status: 'cohabiting' },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.failureCount).toBe(1);
    expect(result.results[0].summary).toContain('Unknown filing status');
  });

  it('produces readable summary', () => {
    const actions: ChatAction[] = [
      { type: 'set_filing_status', status: 'single' },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].summary).toBe('Set filing status to Single');
  });
});

// ═══════════════════════════════════════════════════
// ADD DEPENDENT
// ═══════════════════════════════════════════════════

describe('add_dependent action', () => {
  it('calls addIncomeItem with type "dependents"', () => {
    const actions: ChatAction[] = [
      {
        type: 'add_dependent',
        fields: {
          firstName: 'Alice',
          lastName: 'Doe',
          relationship: 'child',
          monthsLivedWithYou: 12,
        },
      },
    ];

    executeActions(actions, 'return-1');

    expect(addIncomeItem).toHaveBeenCalledWith('return-1', 'dependents', {
      firstName: 'Alice',
      lastName: 'Doe',
      relationship: 'child',
      monthsLivedWithYou: 12,
    });
  });

  it('produces summary with dependent name', () => {
    const actions: ChatAction[] = [
      {
        type: 'add_dependent',
        fields: { firstName: 'Alice' },
      },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].summary).toBe('Added dependent: Alice');
  });

  it('uses fallback name if firstName missing', () => {
    const actions: ChatAction[] = [
      {
        type: 'add_dependent',
        fields: { relationship: 'child' },
      },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].summary).toBe('Added dependent: dependent');
  });
});

// ═══════════════════════════════════════════════════
// SET DEDUCTION METHOD
// ═══════════════════════════════════════════════════

describe('set_deduction_method action', () => {
  it('sets deduction method to standard via updateReturn', () => {
    const actions: ChatAction[] = [
      { type: 'set_deduction_method', method: 'standard' },
    ];

    executeActions(actions, 'return-1');

    expect(updateReturn).toHaveBeenCalledWith('return-1', { deductionMethod: 'standard' });
  });

  it('sets deduction method to itemized via updateReturn', () => {
    const actions: ChatAction[] = [
      { type: 'set_deduction_method', method: 'itemized' },
    ];

    executeActions(actions, 'return-1');

    expect(updateReturn).toHaveBeenCalledWith('return-1', { deductionMethod: 'itemized' });
  });

  it('produces readable summary for standard', () => {
    const actions: ChatAction[] = [
      { type: 'set_deduction_method', method: 'standard' },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].summary).toBe('Set deduction method to Standard Deduction');
  });

  it('produces readable summary for itemized', () => {
    const actions: ChatAction[] = [
      { type: 'set_deduction_method', method: 'itemized' },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].summary).toBe('Set deduction method to Itemized Deductions');
  });
});

// ═══════════════════════════════════════════════════
// UPDATE ITEMIZED
// ═══════════════════════════════════════════════════

describe('update_itemized action', () => {
  it('calls upsertItemized with correct fields', () => {
    const actions: ChatAction[] = [
      {
        type: 'update_itemized',
        fields: { stateLocalIncomeTax: 5000, mortgageInterest: 12000 },
      },
    ];

    executeActions(actions, 'return-1');

    expect(upsertItemized).toHaveBeenCalledWith('return-1', {
      stateLocalIncomeTax: 5000,
      mortgageInterest: 12000,
    });
  });

  it('automatically switches to itemized deduction method via updateReturn', () => {
    const actions: ChatAction[] = [
      {
        type: 'update_itemized',
        fields: { charitableCash: 3000 },
      },
    ];

    executeActions(actions, 'return-1');

    expect(updateReturn).toHaveBeenCalledWith('return-1', { deductionMethod: 'itemized' });
  });

  it('produces summary with field count and total', () => {
    const actions: ChatAction[] = [
      {
        type: 'update_itemized',
        fields: { stateLocalIncomeTax: 5000, mortgageInterest: 12000 },
      },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].summary).toContain('2 itemized deductions');
    expect(result.results[0].summary).toContain('$17,000');
  });

  it('uses singular "deduction" for single field', () => {
    const actions: ChatAction[] = [
      {
        type: 'update_itemized',
        fields: { charitableCash: 1000 },
      },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].summary).toContain('1 itemized deduction ');
  });
});

// ═══════════════════════════════════════════════════
// SET INCOME DISCOVERY
// ═══════════════════════════════════════════════════

describe('set_income_discovery action', () => {
  it('updates income discovery with yes via updateReturn', () => {
    const actions: ChatAction[] = [
      { type: 'set_income_discovery', incomeType: 'w2', value: 'yes' },
    ];

    executeActions(actions, 'return-1');

    expect(updateReturn).toHaveBeenCalledWith('return-1', {
      incomeDiscovery: { w2: 'yes' },
    });
  });

  it('updates income discovery with no via updateReturn', () => {
    const actions: ChatAction[] = [
      { type: 'set_income_discovery', incomeType: '1099int', value: 'no' },
    ];

    executeActions(actions, 'return-1');

    expect(updateReturn).toHaveBeenCalledWith('return-1', {
      incomeDiscovery: { '1099int': 'no' },
    });
  });

  it('produces summary with enable/disable language', () => {
    const enableAction: ChatAction[] = [
      { type: 'set_income_discovery', incomeType: 'w2', value: 'yes' },
    ];
    const disableAction: ChatAction[] = [
      { type: 'set_income_discovery', incomeType: '1099nec', value: 'no' },
    ];

    const enableResult = executeActions(enableAction, 'return-1');
    const disableResult = executeActions(disableAction, 'return-1');

    expect(enableResult.results[0].summary).toContain('enabled');
    expect(disableResult.results[0].summary).toContain('disabled');
  });
});

// ═══════════════════════════════════════════════════
// UPDATE FIELD
// ═══════════════════════════════════════════════════

describe('update_field action', () => {
  it('calls updateReturn with allowed field and value', () => {
    const actions: ChatAction[] = [
      { type: 'update_field', field: 'otherIncome', value: 500 },
    ];

    executeActions(actions, 'return-1');

    expect(updateReturn).toHaveBeenCalledWith('return-1', { otherIncome: 500 });
  });

  it('rejects fields not in allowlist', () => {
    const actions: ChatAction[] = [
      { type: 'update_field', field: 'occupation', value: 'Software Engineer' },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain('not in allowlist');
  });

  it('produces summary with field name', () => {
    const actions: ChatAction[] = [
      { type: 'update_field', field: 'otherIncome', value: 500 },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].summary).toBe('Updated otherIncome');
  });
});

// ═══════════════════════════════════════════════════
// NAVIGATE
// ═══════════════════════════════════════════════════

describe('navigate action', () => {
  it('calls goToStep with the step ID', () => {
    const actions: ChatAction[] = [
      { type: 'navigate', stepId: 'w2_income' },
    ];

    executeActions(actions, 'return-1');

    expect(mockGoToStep).toHaveBeenCalledWith('w2_income');
  });

  it('produces summary with step ID', () => {
    const actions: ChatAction[] = [
      { type: 'navigate', stepId: 'filing_status' },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].summary).toBe('Navigated to filing_status');
  });

  it('does not trigger store refresh (navigation-only)', () => {
    const actions: ChatAction[] = [
      { type: 'navigate', stepId: 'w2_income' },
    ];

    executeActions(actions, 'return-1');

    // getReturn would only be called for data mutations, not navigation
    expect(getReturn).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════
// ADD BUSINESS EXPENSE
// ═══════════════════════════════════════════════════

describe('add_business_expense action', () => {
  it('calls addIncomeItem with type "expenses"', () => {
    const actions: ChatAction[] = [
      {
        type: 'add_business_expense',
        category: 'advertising',
        amount: 500,
        description: 'Google Ads campaign',
      },
    ];

    executeActions(actions, 'return-1');

    expect(addIncomeItem).toHaveBeenCalledWith('return-1', 'expenses', {
      category: 'advertising',
      amount: 500,
      description: 'Google Ads campaign',
    });
  });

  it('uses empty description when not provided', () => {
    const actions: ChatAction[] = [
      {
        type: 'add_business_expense',
        category: 'office',
        amount: 200,
      },
    ];

    executeActions(actions, 'return-1');

    expect(addIncomeItem).toHaveBeenCalledWith('return-1', 'expenses', {
      category: 'office',
      amount: 200,
      description: '',
    });
  });

  it('produces summary with category and amount', () => {
    const actions: ChatAction[] = [
      {
        type: 'add_business_expense',
        category: 'supplies',
        amount: 1500,
      },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.results[0].summary).toContain('supplies');
    expect(result.results[0].summary).toContain('$1,500');
  });
});

// ═══════════════════════════════════════════════════
// NO ACTION
// ═══════════════════════════════════════════════════

describe('no_action', () => {
  it('returns success with no-op summary', () => {
    const actions: ChatAction[] = [{ type: 'no_action' }];

    const result = executeActions(actions, 'return-1');

    expect(result.successCount).toBe(1);
    expect(result.results[0].summary).toBe('No action needed');
  });
});

// ═══════════════════════════════════════════════════
// MULTIPLE ACTIONS
// ═══════════════════════════════════════════════════

describe('Multiple actions', () => {
  it('executes multiple actions in sequence', () => {
    const actions: ChatAction[] = [
      { type: 'set_filing_status', status: 'single' },
      {
        type: 'add_income',
        incomeType: 'w2',
        fields: { employerName: 'Acme Corp', wages: 75000 },
      },
      { type: 'navigate', stepId: 'w2_income' },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);
    expect(result.results).toHaveLength(3);
  });

  it('continues executing after a failure', () => {
    vi.mocked(addIncomeItem).mockImplementationOnce(() => {
      throw new Error('Failed');
    });

    const actions: ChatAction[] = [
      {
        type: 'add_income',
        incomeType: 'w2',
        fields: { employerName: 'Bad', wages: 0 },
      },
      { type: 'set_filing_status', status: 'single' },
    ];

    const result = executeActions(actions, 'return-1');

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    // Second action still executed via updateReturn
    expect(updateReturn).toHaveBeenCalledWith('return-1', { filingStatus: FilingStatus.Single });
  });

  it('refreshes store from localStorage after data mutations', () => {
    const actions: ChatAction[] = [
      {
        type: 'add_income',
        incomeType: 'w2',
        fields: { employerName: 'Acme Corp', wages: 50000 },
      },
    ];

    executeActions(actions, 'return-1');

    // Should have called getReturn to refresh store
    expect(getReturn).toHaveBeenCalledWith('return-1');
    expect(mockSetReturn).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════
// EMPTY ACTIONS
// ═══════════════════════════════════════════════════

describe('Empty and edge cases', () => {
  it('handles empty action array', () => {
    const result = executeActions([], 'return-1');

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('handles unknown action types gracefully', () => {
    const actions = [{ type: 'unknown_type' }] as unknown as ChatAction[];

    const result = executeActions(actions, 'return-1');

    expect(result.failureCount).toBe(1);
    expect(result.results[0].summary).toContain('Unknown action type');
  });
});

// ═══════════════════════════════════════════════════
// SUMMARIZE EXECUTION
// ═══════════════════════════════════════════════════

describe('summarizeExecution', () => {
  it('produces checkmark for successful actions', () => {
    const actions: ChatAction[] = [
      { type: 'set_filing_status', status: 'single' },
    ];
    const result = executeActions(actions, 'return-1');
    const summary = summarizeExecution(result);

    expect(summary).toContain('\u2713');
    expect(summary).toContain('Single');
  });

  it('produces X for failed actions', () => {
    vi.mocked(addIncomeItem).mockImplementationOnce(() => {
      throw new Error('fail');
    });

    const actions: ChatAction[] = [
      { type: 'add_income', incomeType: 'invalid', fields: {} },
    ];
    const result = executeActions(actions, 'return-1');
    const summary = summarizeExecution(result);

    expect(summary).toContain('\u2717');
  });

  it('returns "No actions" for empty results', () => {
    const result = executeActions([], 'return-1');
    const summary = summarizeExecution(result);

    expect(summary).toBe('No actions to apply.');
  });

  it('filters out no_action from summary', () => {
    const actions: ChatAction[] = [{ type: 'no_action' }];
    const result = executeActions(actions, 'return-1');
    const summary = summarizeExecution(result);

    expect(summary).toBe('No actions to apply.');
  });

  it('joins multiple results with newlines', () => {
    const actions: ChatAction[] = [
      { type: 'set_filing_status', status: 'single' },
      { type: 'set_deduction_method', method: 'standard' },
    ];
    const result = executeActions(actions, 'return-1');
    const summary = summarizeExecution(result);

    const lines = summary.split('\n');
    expect(lines).toHaveLength(2);
  });
});
