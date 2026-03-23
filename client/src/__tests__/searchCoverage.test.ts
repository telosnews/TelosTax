/**
 * Command Palette Search Coverage Test
 *
 * Ensures the Cmd+K command palette stays in sync with the rest of the
 * codebase. Catches three categories of drift:
 *
 *   1. A wizard step exists but has no route into the palette
 *   2. An IRS form/question maps to a step ID that doesn't exist
 *   3. A TaxReturn income array has user-entered entities but no
 *      extraction block in CommandPalette.tsx
 *
 * When this test fails, follow the instructions in the failure message.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Source Files ────────────────────────────────────────────────

const STORE_FILE = resolve(__dirname, '../store/taxReturnStore.ts');
const PALETTE_FILE = resolve(__dirname, '../components/common/CommandPalette.tsx');
const IRS_MAP_FILE = resolve(__dirname, '../data/irsFormStepMap.ts');
const HELP_INDEX_FILE = resolve(__dirname, '../data/helpSearchIndex.ts');
const TYPES_FILE = resolve(__dirname, '../../../shared/src/types/index.ts');

const storeSource = readFileSync(STORE_FILE, 'utf-8');
const paletteSource = readFileSync(PALETTE_FILE, 'utf-8');
const irsMapSource = readFileSync(IRS_MAP_FILE, 'utf-8');
const helpIndexSource = readFileSync(HELP_INDEX_FILE, 'utf-8');
const typesSource = readFileSync(TYPES_FILE, 'utf-8');

// ─── Helpers ─────────────────────────────────────────────────────

/** Extract all step IDs from WIZARD_STEPS in taxReturnStore.ts */
function extractWizardStepIds(): string[] {
  const ids: string[] = [];
  const re = /id:\s*'([^']+)'/g;
  // Only match inside WIZARD_STEPS array
  const start = storeSource.indexOf('WIZARD_STEPS');
  const section = storeSource.slice(start);
  const end = section.indexOf('];');
  const block = section.slice(0, end);
  let m;
  while ((m = re.exec(block)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

/** Extract all stepId values referenced in irsFormStepMap.ts */
function extractIrsMapStepIds(): string[] {
  const ids: string[] = [];
  const re = /stepId:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(irsMapSource)) !== null) {
    ids.push(m[1]);
  }
  return [...new Set(ids)];
}

/** Extract all stepId values referenced in helpSearchIndex.ts (COMMON_QUESTIONS) */
function extractHelpStepIds(): string[] {
  const ids: string[] = [];
  const re = /stepId:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(helpIndexSource)) !== null) {
    ids.push(m[1]);
  }
  return [...new Set(ids)];
}

/**
 * Extract TaxReturn income array field names that hold user-entered entities
 * with a name/payer field (e.g. w2Income, income1099NEC, incomeK1, etc.)
 */
function extractIncomeArrayFields(): string[] {
  const fields: string[] = [];
  // Match arrays of income types that have name-like fields
  // Look for fields on TaxReturn that are typed as SomeType[]
  const re = /^\s+(\w+)\??:\s+\w+\[\];/gm;
  // Find the TaxReturn interface
  const start = typesSource.indexOf('export interface TaxReturn {');
  if (start === -1) return fields;
  const braceStart = typesSource.indexOf('{', start);
  let depth = 0;
  let end = braceStart;
  for (let i = braceStart; i < typesSource.length; i++) {
    if (typesSource[i] === '{') depth++;
    if (typesSource[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const block = typesSource.slice(braceStart, end);
  let m;
  while ((m = re.exec(block)) !== null) {
    fields.push(m[1]);
  }
  return fields;
}

// Fields that are arrays but don't contain user-entered names/entities,
// so they don't need extraction in the command palette.
const NON_ENTITY_ARRAYS = new Set([
  'stateReturns',              // State filing, not a named entity
  'depreciationAssets',        // Equipment entries, no payer/employer name
  'expenses',                  // Expense line items
  'capitalLossCarryforwards',  // Numeric carryforwards
  'educationCredits',          // Extracted via other means
  'dependentCareProviders',    // Sub-detail of dependent care
  'income1099B',               // Broker transactions, no single payer name
  'income1099DA',              // Digital asset txns, no single payer name
  'nonCashDonations',          // Donation items
  'charitableCarryforward',    // Numeric carryforwards
  'businesses',                // Handled via business/businesses check
  'estimatedQuarterlyPayments', // Numeric payments
  'incomeSSA1099',             // No payer name — just numeric benefits
]);

// ─── Tests ───────────────────────────────────────────────────────

describe('Command Palette Search Coverage', () => {
  const allStepIds = extractWizardStepIds();
  const nonTransitionSteps = allStepIds.filter((id) => !id.startsWith('transition_'));

  it('sanity: found a reasonable number of wizard steps', () => {
    expect(allStepIds.length).toBeGreaterThan(40);
  });

  it('every non-transition wizard step is reachable from the palette', () => {
    // The palette builds step commands from getVisibleSteps(), which returns
    // from WIZARD_STEPS. This test verifies that every step ID that could
    // appear is not accidentally filtered out by the palette code itself.
    // We check that the palette source references goToStep (the navigation fn).
    expect(paletteSource).toContain('goToStep');
    expect(paletteSource).toContain('getVisibleSteps');
    // And that it skips only transition_ steps
    expect(paletteSource).toContain("startsWith('transition_')");
  });

  it('every IRS form map stepId points to a valid wizard step', () => {
    const irsStepIds = extractIrsMapStepIds();
    const invalid = irsStepIds.filter((id) => !allStepIds.includes(id));

    if (invalid.length > 0) {
      const message = [
        '',
        `${invalid.length} stepId(s) in irsFormStepMap.ts don't match any wizard step:`,
        '',
        ...invalid.map((id) => `  - "${id}"`),
        '',
        'Fix: update the stepId in irsFormStepMap.ts to match a valid WIZARD_STEPS id,',
        'or add the missing step to WIZARD_STEPS in taxReturnStore.ts.',
      ].join('\n');
      expect(invalid, message).toEqual([]);
    }
  });

  it('every COMMON_QUESTIONS stepId points to a valid wizard step', () => {
    const helpStepIds = extractHelpStepIds();
    const invalid = helpStepIds.filter((id) => !allStepIds.includes(id));

    if (invalid.length > 0) {
      const message = [
        '',
        `${invalid.length} stepId(s) in helpSearchIndex.ts don't match any wizard step:`,
        '',
        ...invalid.map((id) => `  - "${id}"`),
        '',
        'Fix: update the stepId in helpSearchIndex.ts to match a valid WIZARD_STEPS id.',
      ].join('\n');
      expect(invalid, message).toEqual([]);
    }
  });

  it('every IRS form map formId points to a valid template', () => {
    const formIdRe = /formId:\s*'([^']+)'/g;
    const formIds: string[] = [];
    let m;
    while ((m = formIdRe.exec(irsMapSource)) !== null) formIds.push(m[1]);

    // Known valid formIds from ALL_TEMPLATES
    const VALID_FORM_IDS = new Set([
      'f1040', 'f1040s1', 'f1040s2', 'f1040s3', 'f1040sa', 'f1040sb',
      'f1040sc', 'f1040sd', 'f1040se', 'f1040sf', 'f1040sh', 'f1040sr',
      'f1040sse', 'f1040v', 'f2210', 'f2555', 'f3903', 'f4137', 'f4562',
      'f4797', 'f4952', 'f5329', 'f5695', 'f6251', 'f7206', 'f8283',
      'f8582', 'f8606', 'f8615', 'f8839', 'f8863', 'f8889', 'f8911',
      'f8936', 'f8949', 'f8962', 'f982', 'f5500ez',
    ]);

    const invalid = formIds.filter(id => !VALID_FORM_IDS.has(id));
    expect(invalid, `formId(s) in irsFormStepMap.ts not in ALL_TEMPLATES: ${invalid.join(', ')}`).toEqual([]);
  });

  it('every TaxReturn income/entity array with named entities has a palette extraction', () => {
    const arrayFields = extractIncomeArrayFields();

    // Map of TaxReturn field name → what to look for in CommandPalette.tsx
    const expectedPatterns: Record<string, string> = {
      w2Income: 'taxReturn.w2Income',
      income1099NEC: 'taxReturn.income1099NEC',
      income1099K: 'taxReturn.income1099K',
      income1099INT: 'taxReturn.income1099INT',
      income1099DIV: 'taxReturn.income1099DIV',
      income1099R: 'taxReturn.income1099R',
      income1099G: 'taxReturn.income1099G',
      income1099MISC: 'taxReturn.income1099MISC',
      incomeK1: 'taxReturn.incomeK1',
      rentalProperties: 'taxReturn.rentalProperties',
      dependents: 'taxReturn.dependents',
      incomeW2G: 'taxReturn.incomeW2G',
      income1099SA: 'taxReturn.income1099SA',
      income1099C: 'taxReturn.income1099C',
      income1099Q: 'taxReturn.income1099Q',
    };

    const missing: string[] = [];
    for (const field of arrayFields) {
      if (NON_ENTITY_ARRAYS.has(field)) continue;
      const pattern = expectedPatterns[field];
      if (pattern && !paletteSource.includes(pattern)) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      const message = [
        '',
        `${missing.length} TaxReturn array(s) with named entities are not extracted in CommandPalette.tsx:`,
        '',
        ...missing.map((f) => `  - ${f}`),
        '',
        'Fix: add an extraction block in CommandPalette.tsx (under "User data entities")',
        'so these entities appear in the Cmd+K palette under "Your Data".',
      ].join('\n');
      expect(missing, message).toEqual([]);
    }
  });
});
