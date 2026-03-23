/**
 * Forms Mode — Shared Field Value Resolution
 *
 * Extracts the value-resolution logic from irsFormFiller.ts into a reusable
 * module. Used by both the PDF export pipeline and the live Forms Mode viewer.
 */
import type { TaxReturn, CalculationResult } from '@telostax/engine';
import type { IRSFieldMapping } from '@telostax/engine';

/**
 * Walk a dot-path (e.g., "form1040.totalWages") into an object.
 */
export function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Format a value for insertion into a PDF text field.
 * IRS convention: whole dollar amounts, no $ signs, no commas, blank for zero.
 */
export function formatValue(value: unknown, format: IRSFieldMapping['format']): string {
  if (value === undefined || value === null) return '';

  switch (format) {
    case 'string':
      return String(value);
    case 'dollarNoCents': {
      const num = Number(value);
      if (isNaN(num) || num === 0) return '';
      return Math.round(num).toString();
    }
    case 'dollarCents': {
      const num = Number(value);
      if (isNaN(num) || num === 0) return '';
      return num.toFixed(2);
    }
    case 'integer': {
      const num = Number(value);
      if (isNaN(num) || num === 0) return '';
      return Math.round(num).toString();
    }
    case 'ssn':
    case 'ssnPartial':
    case 'date':
      return String(value);
    case 'checkbox':
      return '';
    default:
      return String(value);
  }
}

/**
 * Resolve the display value for a single field mapping.
 * Returns { rawValue, displayValue, isChecked } for use in both PDF export and Forms Mode.
 */
export function resolveFieldValue(
  mapping: IRSFieldMapping,
  taxReturn: TaxReturn,
  calc: CalculationResult,
): { rawValue: unknown; displayValue: string; isChecked: boolean } {
  let rawValue: unknown;

  if (mapping.transform) {
    rawValue = mapping.transform(taxReturn, calc);
  } else {
    const source = mapping.source === 'taxReturn' ? taxReturn : calc;
    rawValue = resolvePath(source as unknown as Record<string, unknown>, mapping.sourcePath);
  }

  if (mapping.format === 'checkbox') {
    let isChecked = false;
    if (mapping.transform) {
      isChecked = Boolean(rawValue);
    } else if (mapping.checkWhen) {
      isChecked = mapping.checkWhen(rawValue, taxReturn, calc);
    } else {
      isChecked = Boolean(rawValue);
    }
    return { rawValue, displayValue: isChecked ? 'Checked' : '', isChecked };
  }

  const displayValue = typeof rawValue === 'string' && mapping.transform
    ? rawValue
    : formatValue(rawValue, mapping.format);

  return { rawValue, displayValue, isChecked: false };
}
