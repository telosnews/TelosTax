/**
 * Date Field Validation Coverage Test
 *
 * Ensures every `<input type="date">` in a step component is wrapped in a
 * `<FormField>` that passes a `warning={...}` prop — so the user always
 * sees an inline amber warning when a date is out of range.
 *
 * When this test fails you have two options:
 *   1. Add a `warning={validateXxx(...)}` prop to the enclosing <FormField>
 *      (preferred — see dateValidation.ts for existing validators)
 *   2. Add the field to EXEMPT_DATE_FIELDS below with a comment explaining
 *      why no validation is needed
 *
 * This test runs as static analysis — it reads source files, not rendered
 * components — so it stays fast and doesn't require a DOM environment.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STEPS_DIR = resolve(__dirname, '../components/steps');

// ─── Exclusion List ──────────────────────────────────────────────
// Date fields that intentionally have no warning. Each entry must
// include a comment explaining why.

const EXEMPT_DATE_FIELDS: Array<{ file: string; label: string }> = [
  // Example:
  // { file: 'SomeStep.tsx', label: 'Some Date' },  // Not user-editable, display only
];

// ─── Helpers ─────────────────────────────────────────────────────

interface DateField {
  file: string;
  line: number;
  formFieldLabel: string;
  hasWarning: boolean;
}

/**
 * Scans a step component source for `type="date"` inputs and checks
 * whether the enclosing `<FormField>` has a `warning=` prop.
 */
function extractDateFields(fileName: string, source: string): DateField[] {
  const fields: DateField[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // Look for date inputs
    if (!lines[i].includes('type="date"') && !lines[i].includes("type='date'")) continue;

    // Walk backwards from the date input to find the enclosing <FormField
    let formFieldLabel = '(unknown)';
    let hasWarning = false;
    // Collect the FormField opening tag which may span multiple lines
    let formFieldChunk = '';

    for (let j = i; j >= Math.max(0, i - 15); j--) {
      formFieldChunk = lines[j] + '\n' + formFieldChunk;
      if (lines[j].includes('<FormField')) {
        // Extract label from the accumulated chunk
        const labelMatch = formFieldChunk.match(/label=["']([^"']+)["']/);
        if (labelMatch) formFieldLabel = labelMatch[1];

        // Check if the FormField opening tag (which may span lines up to
        // the closing >) includes a warning= prop
        const closingBracket = source.indexOf('>', source.indexOf('<FormField', lineOffset(lines, j)));
        const tagSource = source.slice(lineOffset(lines, j), closingBracket + 1);
        hasWarning = /warning=\{/.test(tagSource);
        break;
      }
    }

    fields.push({
      file: fileName,
      line: i + 1,
      formFieldLabel,
      hasWarning,
    });
  }

  return fields;
}

/** Returns the character offset of a given line number. */
function lineOffset(lines: string[], lineIndex: number): number {
  let offset = 0;
  for (let i = 0; i < lineIndex; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }
  return offset;
}

// ─── Tests ───────────────────────────────────────────────────────

describe('Date Field Validation Coverage', () => {
  const stepFiles = readdirSync(STEPS_DIR).filter((f) => f.endsWith('.tsx'));
  const allDateFields: DateField[] = [];

  for (const file of stepFiles) {
    const source = readFileSync(join(STEPS_DIR, file), 'utf-8');
    allDateFields.push(...extractDateFields(file, source));
  }

  it('sanity: found date fields in step components', () => {
    expect(allDateFields.length).toBeGreaterThan(10);
  });

  it('every date input has a warning= prop on its enclosing FormField', () => {
    const exemptSet = new Set(
      EXEMPT_DATE_FIELDS.map((e) => `${e.file}::${e.label}`),
    );

    const unvalidated = allDateFields.filter(
      (f) => !f.hasWarning && !exemptSet.has(`${f.file}::${f.formFieldLabel}`),
    );

    if (unvalidated.length > 0) {
      const message = [
        '',
        `${unvalidated.length} date input(s) are missing a warning= validation prop:`,
        '',
        ...unvalidated.map(
          (f) => `  - ${f.file}:${f.line} — <FormField label="${f.formFieldLabel}">`,
        ),
        '',
        'To fix, pick one:',
        '  1. Add warning={validateXxx(...)} to the <FormField> (see dateValidation.ts)',
        '  2. Add to EXEMPT_DATE_FIELDS in dateValidationCoverage.test.ts',
        '     (with a comment explaining why no validation is needed)',
      ].join('\n');

      expect(unvalidated, message).toEqual([]);
    }
  });

  it('exempt list contains no stale entries', () => {
    const allKeys = new Set(
      allDateFields.map((f) => `${f.file}::${f.formFieldLabel}`),
    );
    const stale = EXEMPT_DATE_FIELDS.filter(
      (e) => !allKeys.has(`${e.file}::${e.label}`),
    );

    expect(
      stale,
      `These exemptions no longer match any date field — remove them:\n${stale.map((e) => `  - ${e.file}::${e.label}`).join('\n')}`,
    ).toEqual([]);
  });
});
