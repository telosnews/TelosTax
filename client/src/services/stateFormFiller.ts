/**
 * State Form Filler Service
 *
 * Loads official state fillable PDF templates, fills their AcroForm fields
 * with calculated tax return data, and returns the filled PDF bytes.
 *
 * Mirrors the federal irsFormFiller.ts pattern but adds StateCalculationResult
 * as a third data source.
 */
import { PDFDocument, PDFButton } from 'pdf-lib';
import type { TaxReturn, CalculationResult, StateCalculationResult } from '@telostax/engine';
import type { StateFieldMapping, StateFormTemplate } from '@telostax/engine';
import { STATE_FORM_REGISTRY } from '@telostax/engine';

// ─── Template Cache ─────────────────────────────────────────────
const stateTemplateCache = new Map<string, Uint8Array>();

async function loadStateTemplate(fileName: string): Promise<Uint8Array> {
  if (stateTemplateCache.has(fileName)) return stateTemplateCache.get(fileName)!;
  const response = await fetch(`/state-forms/${fileName}`);
  if (!response.ok) {
    throw new Error(`Failed to load state form template: ${fileName} (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  stateTemplateCache.set(fileName, bytes);
  return bytes;
}

// ─── Value Resolution ───────────────────────────────────────────

/**
 * Walk a dot-path (e.g., "stateTaxableIncome") into an object.
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
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
 */
function formatValue(value: unknown, format: StateFieldMapping['format']): string {
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

// ─── Form Filling ───────────────────────────────────────────────

/**
 * Fill a single state PDF form with data.
 */
export async function fillStateForm(
  template: StateFormTemplate,
  taxReturn: TaxReturn,
  calc: CalculationResult,
  stateResult: StateCalculationResult,
  options: { flatten?: boolean } = { flatten: true },
): Promise<Uint8Array> {
  const templateBytes = await loadStateTemplate(template.pdfFileName);
  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();

  // Build leaf-name index for robust field lookup (same as irsFormFiller)
  const leafIndex = new Map<string, string>();
  for (const field of form.getFields()) {
    const fullName = field.getName();
    const leaf = fullName.split('.').pop()!;
    if (!leafIndex.has(leaf)) {
      leafIndex.set(leaf, fullName);
    }
  }

  function resolveFieldName(name: string): string {
    try { form.getField(name); return name; } catch { /* fall through */ }
    const leaf = name.split('.').pop()!;
    return leafIndex.get(leaf) ?? name;
  }

  for (const mapping of template.fields) {
    // Resolve the value — either via transform or sourcePath
    let rawValue: unknown;
    if (mapping.transform) {
      rawValue = mapping.transform(taxReturn, calc, stateResult);
    } else {
      const source = mapping.source === 'taxReturn'
        ? taxReturn
        : mapping.source === 'stateResult'
          ? stateResult
          : calc;
      rawValue = resolvePath(source as unknown as Record<string, unknown>, mapping.sourcePath);
    }

    // Fill the field (resolve name through leaf index for robustness)
    const resolvedName = resolveFieldName(mapping.pdfFieldName);
    if (mapping.format === 'checkbox') {
      try {
        const cb = form.getCheckBox(resolvedName);
        let shouldCheck = false;
        if (mapping.transform) {
          shouldCheck = Boolean(rawValue);
        } else if (mapping.checkWhen) {
          shouldCheck = mapping.checkWhen(rawValue, taxReturn, calc, stateResult);
        } else {
          shouldCheck = Boolean(rawValue);
        }
        if (shouldCheck) cb.check();
      } catch {
        // Field may not exist in this PDF version — silently skip
      }
    } else {
      try {
        const tf = form.getTextField(resolvedName);
        const formatted = typeof rawValue === 'string' && mapping.transform
          ? rawValue  // transform already returned a formatted string
          : formatValue(rawValue, mapping.format);
        if (formatted) {
          tf.setMaxLength(undefined);
          tf.setText(formatted);
        }
      } catch {
        // Field may not exist in this PDF version — silently skip
      }
    }
  }

  // Remove all button fields (navigation, reset, print, red overlay text like
  // "Please sign after printing", "Disclaimer Notice", "Do Not Call", etc.)
  for (const field of form.getFields()) {
    if (field instanceof PDFButton) {
      form.removeField(field);
    }
  }

  if (options.flatten) form.flatten();
  return doc.save();
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Generate a filled state form PDF for a given state result.
 * Returns null if no form template exists for the state.
 */
export async function generateStateFormPDF(
  taxReturn: TaxReturn,
  calc: CalculationResult,
  stateResult: StateCalculationResult,
): Promise<Uint8Array | null> {
  const templates = STATE_FORM_REGISTRY[stateResult.stateCode];
  if (!templates || templates.length === 0) return null;

  // Filter to applicable templates
  const applicable = templates.filter(t => t.condition(taxReturn, calc, stateResult));
  if (applicable.length === 0) return null;

  // Fill each applicable form
  const filledPDFs: Uint8Array[] = [];
  for (const template of applicable) {
    const filled = await fillStateForm(template, taxReturn, calc, stateResult);
    filledPDFs.push(filled);
  }

  // If only one form, return directly
  if (filledPDFs.length === 1) return filledPDFs[0];

  // Merge multiple forms into a single PDF
  const merged = await PDFDocument.create();
  for (const pdfBytes of filledPDFs) {
    const src = await PDFDocument.load(pdfBytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }

  return merged.save();
}
