/**
 * Forms Mode — Field Editability Classifier
 *
 * Determines which PDF form fields can be edited by the user in Forms Mode
 * and which are read-only (auto-calculated). Uses a rule-based approach:
 *
 * 1. source === 'calculationResult' → read-only (computed by engine)
 * 2. source === 'taxReturn' + non-empty sourcePath + no transform → editable
 * 3. Has transform + has inverseTransform → editable
 * 4. Explicit editable: true override → editable
 * 5. Everything else → read-only
 */
import type { IRSFieldMapping } from '../types/irsFormMappings.js';

export interface ClassifiedField {
  mapping: IRSFieldMapping;
  isEditable: boolean;
  /** Dot-path to write back to TaxReturn (undefined for read-only fields) */
  writePath: string | undefined;
  /** Why this field is read-only (undefined if editable) */
  readOnlyReason: string | undefined;
}

/**
 * Classify an array of field mappings into editable / read-only.
 */
export function classifyFields(fields: IRSFieldMapping[]): ClassifiedField[] {
  return fields.map(classifyField);
}

/**
 * Classify a single field mapping.
 */
export function classifyField(mapping: IRSFieldMapping): ClassifiedField {
  // Rule 4: explicit override
  if (mapping.editable === true) {
    const writePath = mapping.sourcePath || undefined;
    return { mapping, isEditable: true, writePath, readOnlyReason: undefined };
  }

  // Rule 1: calculation results are always read-only
  if (mapping.source === 'calculationResult') {
    return {
      mapping,
      isEditable: false,
      writePath: undefined,
      readOnlyReason: 'Computed by tax engine',
    };
  }

  // Rule 3: has transform + inverseTransform → editable
  if (mapping.transform && mapping.inverseTransform) {
    return {
      mapping,
      isEditable: true,
      writePath: mapping.sourcePath || undefined,
      readOnlyReason: undefined,
    };
  }

  // Rule 2: taxReturn source + non-empty sourcePath + no transform → editable
  if (mapping.source === 'taxReturn' && mapping.sourcePath && !mapping.transform) {
    return {
      mapping,
      isEditable: true,
      writePath: mapping.sourcePath,
      readOnlyReason: undefined,
    };
  }

  // Everything else → read-only
  let reason = 'Read-only';
  if (mapping.source === 'taxReturn' && mapping.transform && !mapping.inverseTransform) {
    reason = 'Derived from multiple fields';
  } else if (!mapping.sourcePath) {
    reason = 'No direct data path';
  }

  return { mapping, isEditable: false, writePath: undefined, readOnlyReason: reason };
}
