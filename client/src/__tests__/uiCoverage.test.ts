/**
 * TaxReturn UI Coverage Test
 *
 * Ensures every user-facing field on the TaxReturn interface is referenced
 * in at least one step component. This prevents the recurring problem of
 * fields being added to the engine/types but never wired to the UI.
 *
 * When this test fails, you have two options:
 *   1. Add UI controls for the field in the appropriate step component
 *   2. Add the field to SYSTEM_FIELDS or LEGACY_FIELDS below (with a comment)
 *
 * DO NOT add fields to PENDING_UI as a long-term solution — that set should
 * shrink over time, not grow.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TYPES_FILE = resolve(__dirname, '../../../shared/src/types/index.ts');
const STEPS_DIR = resolve(__dirname, '../components/steps');

// ─── Exclusion Lists ────────────────────────────────────────────

/** System-managed metadata — never needs UI controls. */
const SYSTEM_FIELDS = new Set([
  'id',
  'schemaVersion',
  'taxYear',
  'status',
  'currentStep',
  'currentStepId',
  'currentSection',
  'createdAt',
  'updatedAt',
]);

/** Fields superseded by newer fields — kept for backward compat only. */
const LEGACY_FIELDS = new Set([
  'capitalLossCarryforward',   // Superseded by capitalLossCarryforwardST / capitalLossCarryforwardLT
  'business',                  // Superseded by businesses[] (multi-business support)
  'estimatedPaymentsMade',     // Kept in sync; UI uses estimatedQuarterlyPayments
  'kiddieTax',                 // Superseded by kiddieTaxEntries[] (multi-child support)
]);

/** Managed by toggle patterns in overview steps, not direct field inputs. */
const DISCOVERY_FIELDS = new Set([
  'incomeDiscovery',           // PillToggle in IncomeOverviewStep / DeductionsOverviewStep / CreditsOverviewStep
]);

const EXCLUDED_FIELDS = new Set([
  ...SYSTEM_FIELDS,
  ...LEGACY_FIELDS,
  ...DISCOVERY_FIELDS,
]);

// ─── Parser ─────────────────────────────────────────────────────

/**
 * Extracts top-level field names from the TaxReturn interface.
 * Uses brace-depth tracking to skip fields in inline object types
 * (e.g. the nested fields inside `amtData?: { ... }`).
 */
function extractTaxReturnFields(source: string): string[] {
  const start = source.indexOf('export interface TaxReturn {');
  if (start === -1) throw new Error('Could not find TaxReturn interface in types file');

  const braceStart = source.indexOf('{', start);
  const fields: string[] = [];
  let depth = 0;
  let lineStart = braceStart;

  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) break; // End of TaxReturn interface
    } else if (ch === '\n') {
      // Only extract fields at depth 1 (directly inside TaxReturn)
      if (depth === 1) {
        const line = source.slice(lineStart, i);
        const match = line.match(/^\s+(\w+)\??:/);
        if (match) fields.push(match[1]);
      }
      lineStart = i + 1;
    }
  }

  return fields;
}

/**
 * Reads and concatenates all step component source files.
 */
function readAllStepCode(): string {
  const files = readdirSync(STEPS_DIR).filter((f) => f.endsWith('.tsx'));
  return files.map((f) => readFileSync(join(STEPS_DIR, f), 'utf-8')).join('\n');
}

// ─── Tests ──────────────────────────────────────────────────────

describe('TaxReturn UI Coverage', () => {
  const typesSource = readFileSync(TYPES_FILE, 'utf-8');
  const allFields = extractTaxReturnFields(typesSource);
  const stepCode = readAllStepCode();

  it('sanity: TaxReturn has a reasonable number of fields', () => {
    // If this fails, the parser is broken
    expect(allFields.length).toBeGreaterThan(50);
  });

  it('every user-facing TaxReturn field is referenced in at least one step component', () => {
    const unwired: string[] = [];

    for (const field of allFields) {
      if (EXCLUDED_FIELDS.has(field)) continue;

      // Check for actual data-binding patterns (not just the word in help text):
      //   .fieldName    — property access (taxReturn.fieldName, hs.fieldName)
      //   'fieldName'   — string key in updateField('fieldName', ...)
      //   "fieldName"   — string key in updateReturn(id, { "fieldName": ... })
      const dotPattern = new RegExp(`\\.${field}\\b`);
      const quotePattern = new RegExp(`['"]${field}['"]`);
      if (!dotPattern.test(stepCode) && !quotePattern.test(stepCode)) {
        unwired.push(field);
      }
    }

    if (unwired.length > 0) {
      const message = [
        '',
        `${unwired.length} TaxReturn field(s) have no UI in any step component:`,
        '',
        ...unwired.map((f) => `  - ${f}`),
        '',
        'To fix, pick one:',
        '  1. Add UI controls in the appropriate step component',
        '  2. Add to SYSTEM_FIELDS or LEGACY_FIELDS in uiCoverage.test.ts',
        '     (with a comment explaining why the field needs no UI)',
      ].join('\n');

      expect.soft(unwired, message).toEqual([]);
    }
  });

  it('exclusion lists contain no stale entries', () => {
    const stale = [...EXCLUDED_FIELDS].filter((f) => !allFields.includes(f));

    expect(
      stale,
      `These fields are in the exclusion lists but no longer exist on TaxReturn — remove them:\n${stale.map((f) => `  - ${f}`).join('\n')}`,
    ).toEqual([]);
  });

  it('all excluded fields have a category', () => {
    // Guard against someone adding a field to EXCLUDED_FIELDS directly
    // instead of using one of the named sets
    const allNamed = new Set([...SYSTEM_FIELDS, ...LEGACY_FIELDS, ...DISCOVERY_FIELDS]);
    const uncategorized = [...EXCLUDED_FIELDS].filter((f) => !allNamed.has(f));

    expect(
      uncategorized,
      'Fields in EXCLUDED_FIELDS must belong to SYSTEM_FIELDS, LEGACY_FIELDS, or DISCOVERY_FIELDS',
    ).toEqual([]);
  });
});
