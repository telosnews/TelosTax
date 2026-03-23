/**
 * State Fillable PDF Form Field Mapping Types
 *
 * These types define how StateCalculationResult, CalculationResult, and TaxReturn
 * fields map to AcroForm field names in official state fillable PDFs.
 *
 * Mirrors the federal IRSFieldMapping / IRSFormTemplate pattern but adds
 * `stateResult` as a third data source.
 */
import type { TaxReturn, CalculationResult, StateCalculationResult } from './index.js';
import type { IRSFieldFormat } from './irsFormMappings.js';

/** Describes how one field maps to a state PDF AcroForm field */
export interface StateFieldMapping {
  /** The AcroForm field name in the state PDF */
  pdfFieldName: string;

  /** Dot-path into the source object (e.g., "stateTaxableIncome", "firstName") */
  sourcePath: string;

  /** Which source object to read from */
  source: 'taxReturn' | 'calculationResult' | 'stateResult';

  /** How to format the value before inserting into the PDF field */
  format: IRSFieldFormat;

  /** For checkbox fields, function to determine if it should be checked */
  checkWhen?: (
    value: unknown,
    taxReturn: TaxReturn,
    calc: CalculationResult,
    stateResult: StateCalculationResult,
  ) => boolean;

  /** Custom transform to compute the value (overrides sourcePath resolution) */
  transform?: (
    taxReturn: TaxReturn,
    calc: CalculationResult,
    stateResult: StateCalculationResult,
  ) => string | boolean | undefined;
}

/** Template definition for one state form */
export interface StateFormTemplate {
  /** Form identifier (e.g., 'pa-40') */
  formId: string;

  /** Two-letter state code (e.g., 'PA') */
  stateCode: string;

  /** Display name for UI (e.g., 'PA-40 Pennsylvania Income Tax Return') */
  displayName: string;

  /** PDF file name in /state-forms/ directory */
  pdfFileName: string;

  /** Whether this form should be included for a given return */
  condition: (
    taxReturn: TaxReturn,
    calc: CalculationResult,
    stateResult: StateCalculationResult,
  ) => boolean;

  /** All field mappings for this form */
  fields: StateFieldMapping[];
}
