/**
 * Forms Mode — Store-to-PDF Field Population
 *
 * Populates Syncfusion PDF Viewer form fields from the Zustand store.
 * Handles both initial population and reactive updates for computed fields.
 *
 * Field name normalization: pdf-lib uses top-down XFA hierarchy
 * (topmostSubform[0].Page1[0].f1_14[0]) while Syncfusion reverses it
 * (f1_14[0].Page1[0].topmostSubform[0]) and flattens checkbox names
 * (c120Page10topmostSubform0). We normalize by reversing segments and
 * stripping non-alphanumeric characters to match both conventions.
 */
import type { PdfViewer } from '@syncfusion/ej2-pdfviewer';
import type { TaxReturn, CalculationResult } from '@telostax/engine';
import type { IRSFormTemplate } from '@telostax/engine';
import type { ClassifiedField } from '@telostax/engine';
import { resolveFieldValue } from './formFieldResolver';

/**
 * Normalize a field name by stripping all non-alphanumeric characters.
 * Used to match pdf-lib names against Syncfusion's different naming format.
 * Exported for use in PdfFormViewer's focusOut handler.
 */
export function normalizeSyncfusionName(name: string): string {
  if (typeof name !== 'string') return '';
  return name.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Convert a pdf-lib field name to its Syncfusion-compatible normalized key.
 * Reverses the dot-separated hierarchy then strips non-alphanumeric chars.
 *
 * pdf-lib:    topmostSubform[0].Page1[0].f1_14[0]
 * Reversed:   f1_14[0].Page1[0].topmostSubform[0]
 * Normalized: f1140Page10topmostSubform0
 *
 * This matches both Syncfusion's dotted text field names and its
 * flattened checkbox names (e.g., c120Page10topmostSubform0).
 * Exported so PdfFormViewer can key its fieldMap the same way.
 */
export function pdfLibToNormalizedKey(pdfLibName: string): string {
  const reversed = pdfLibName.split('.').reverse().join('.');
  return normalizeSyncfusionName(reversed);
}

/**
 * Build a lookup map from Syncfusion's formFieldCollections.
 * Indexed by normalized key for cross-library name matching.
 */
function buildFieldLookup(formFields: unknown[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const ff of formFields) {
    const name = (ff as Record<string, unknown>).name as string | undefined;
    if (name) {
      map.set(normalizeSyncfusionName(name), ff);
    }
  }
  return map;
}

/**
 * Look up a pdf-lib field name in the Syncfusion field map.
 */
function findPdfField(pdfFieldMap: Map<string, unknown>, pdfLibName: string): unknown | undefined {
  return pdfFieldMap.get(pdfLibToNormalizedKey(pdfLibName));
}

/**
 * Populate all form fields in the PDF viewer from the current tax data.
 * Called on `documentLoaded`.
 */
export function populateFormFields(
  viewer: PdfViewer,
  template: IRSFormTemplate,
  taxReturn: TaxReturn,
  calc: CalculationResult,
  classifiedFields: ClassifiedField[],
): void {
  const formFields = viewer.formFieldCollections;
  if (!formFields?.length) return;

  const pdfFieldMap = buildFieldLookup(formFields);

  for (const cf of classifiedFields) {
    const pdfField = findPdfField(pdfFieldMap, cf.mapping.pdfFieldName);
    if (!pdfField) continue;

    const { displayValue, isChecked } = resolveFieldValue(cf.mapping, taxReturn, calc);

    try {
      if (cf.mapping.format === 'checkbox') {
        viewer.formDesignerModule.updateFormField(pdfField as never, {
          isChecked,
          isReadOnly: !cf.isEditable,
          tooltip: cf.mapping.formLabel || '',
          style: 'Check',
        } as never);
      } else {
        const fieldUpdate: Record<string, unknown> = {
          value: displayValue,
          isReadOnly: !cf.isEditable,
          tooltip: cf.isEditable
            ? (cf.mapping.formLabel || '')
            : `Auto-calculated: ${cf.mapping.formLabel || 'computed field'}`,
        };

        if (cf.isEditable) {
          fieldUpdate.backgroundColor = '#FFFFFF';
          fieldUpdate.borderColor = '#3B82F6';
        } else {
          fieldUpdate.backgroundColor = '#FFF9DB';
          fieldUpdate.borderColor = '#94A3B8';
        }

        viewer.formDesignerModule.updateFormField(pdfField as never, fieldUpdate as never);
      }
    } catch {
      // Field may not exist in this PDF revision — skip silently
    }
  }
}

/**
 * Enforce read-only state on computed fields via direct DOM manipulation.
 * Syncfusion's updateFormField silently ignores isReadOnly when the value is
 * empty, leaving computed fields editable. This function patches the DOM
 * elements directly as a safety net.
 */
export function enforceReadOnlyDOM(
  viewer: PdfViewer,
  classifiedFields: ClassifiedField[],
): void {
  const formFields = viewer.formFieldCollections;
  if (!formFields?.length) return;

  const pdfFieldMap = buildFieldLookup(formFields);

  for (const cf of classifiedFields) {
    if (cf.isEditable) continue;

    const pdfField = findPdfField(pdfFieldMap, cf.mapping.pdfFieldName);
    if (!pdfField) continue;

    const fieldId = (pdfField as Record<string, unknown>).id as string | undefined;
    if (!fieldId) continue;

    // Find the input/textarea element Syncfusion rendered for this field
    const inputEl =
      document.getElementById(fieldId + '_input_element') ||
      document.getElementById(fieldId + '_content_html_element') ||
      document.querySelector(`[id="${fieldId}"] input`) ||
      document.querySelector(`[id="${fieldId}"] textarea`);

    if (inputEl && inputEl instanceof HTMLElement) {
      (inputEl as HTMLInputElement).readOnly = true;
      inputEl.style.pointerEvents = 'auto';
      inputEl.style.cursor = 'default';
      inputEl.style.backgroundColor = '#FFF9DB';
    }

    // Also style the wrapper element
    const wrapper = document.getElementById(fieldId);
    if (wrapper) {
      wrapper.style.backgroundColor = '#FFF9DB';
    }
  }
}

/**
 * Update only computed (read-only) fields after a recalculation.
 * Never overwrites editable fields to prevent cursor-reset mid-edit.
 */
export function updateComputedFields(
  viewer: PdfViewer,
  template: IRSFormTemplate,
  taxReturn: TaxReturn,
  calc: CalculationResult,
  classifiedFields: ClassifiedField[],
): void {
  const formFields = viewer.formFieldCollections;
  if (!formFields?.length) return;

  const pdfFieldMap = buildFieldLookup(formFields);

  for (const cf of classifiedFields) {
    if (cf.isEditable) continue;

    const pdfField = findPdfField(pdfFieldMap, cf.mapping.pdfFieldName);
    if (!pdfField) continue;

    const { displayValue, isChecked } = resolveFieldValue(cf.mapping, taxReturn, calc);

    try {
      if (cf.mapping.format === 'checkbox') {
        viewer.formDesignerModule.updateFormField(pdfField as never, {
          isChecked,
          style: 'Check',
        } as never);
      } else {
        viewer.formDesignerModule.updateFormField(pdfField as never, {
          value: displayValue,
        } as never);
      }
    } catch {
      // Silently skip
    }
  }
}
