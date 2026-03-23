/**
 * IRS Fillable PDF Form Field Mapping Types
 *
 * These types define how CalculationResult and TaxReturn fields
 * map to AcroForm field names in official IRS fillable PDFs.
 */
import type { TaxReturn, CalculationResult } from './index.js';

/** How to format a value before inserting into a PDF field */
export type IRSFieldFormat =
  | 'string'          // Raw string (names, addresses)
  | 'dollarNoCents'   // Whole dollar, no $ or commas (e.g., "42470")
  | 'dollarCents'     // Dollars with cents (e.g., "42470.00")
  | 'integer'         // Integer number
  | 'ssn'             // SSN formatted XXX-XX-XXXX
  | 'ssnPartial'      // Last 4 of SSN
  | 'checkbox'        // Boolean check/uncheck
  | 'date';           // Date string

/** Describes how one CalculationResult/TaxReturn field maps to one IRS PDF field */
export interface IRSFieldMapping {
  /** The AcroForm field name in the IRS PDF (e.g., "topmostSubform[0].Page1[0].f1_01[0]") */
  pdfFieldName: string;

  /** Dot-path into CalculationResult or TaxReturn (e.g., "form1040.totalWages") */
  sourcePath: string;

  /** Which source object to read from */
  source: 'taxReturn' | 'calculationResult';

  /** How to format the value before inserting into the PDF field */
  format: IRSFieldFormat;

  /** For checkbox fields, function to determine if it should be checked */
  checkWhen?: (value: unknown, taxReturn: TaxReturn, calc: CalculationResult) => boolean;

  /** Custom transform to compute the value (overrides sourcePath resolution) */
  transform?: (taxReturn: TaxReturn, calc: CalculationResult) => string | boolean | undefined;

  // ── Forms Mode metadata ──

  /** Can the user edit this field in Forms Mode? Auto-classified when omitted. */
  editable?: boolean;

  /** Reverse-parse a display value back to a storage value (for transform-based editable fields) */
  inverseTransform?: (displayValue: string, tr: TaxReturn) => unknown;

  /** Validate user input — returns error message or undefined if valid */
  validate?: (value: string, tr: TaxReturn) => string | undefined;

  /** Human-readable label for tooltip in Forms Mode (e.g., "Line 1a: Total wages") */
  formLabel?: string;
}

/** Template definition for one IRS form */
export interface IRSFormTemplate {
  /** Form identifier (e.g., 'f1040', 'f1040s1') */
  formId: string;

  /** Display name for UI (e.g., 'Form 1040') */
  displayName: string;

  /** IRS Attachment Sequence Number for ordering */
  attachmentSequence: number;

  /** PDF file name in /irs-forms/ directory */
  pdfFileName: string;

  /** Whether this form should be included in the return */
  condition: (taxReturn: TaxReturn, calc: CalculationResult) => boolean;

  /** All field mappings for this form (used when instanceCount is absent or 1) */
  fields: IRSFieldMapping[];

  /**
   * Number of instances to generate. Default: 1.
   * When > 1, fieldsForInstance MUST be provided.
   * Used for forms that repeat (e.g., Form 8949 with many transactions,
   * Schedule C with multiple businesses, Schedule E with many properties).
   */
  instanceCount?: (taxReturn: TaxReturn, calc: CalculationResult) => number;

  /**
   * Return the field mappings for instance N (0-based index).
   * Required when instanceCount > 1. Each instance fills the same PDF template
   * with different data (e.g., different page of transactions).
   */
  fieldsForInstance?: (
    index: number,
    taxReturn: TaxReturn,
    calc: CalculationResult,
  ) => IRSFieldMapping[];
}
