/**
 * Document → Chat Actions — converts PDFExtractResult into a ChatResponse.
 *
 * Used in two scenarios:
 * 1. Private mode (no LLM) — generates a synthetic response with add_income actions.
 * 2. Fallback when LLM is unavailable.
 *
 * The extraction pipeline (pdfImporter) does the hard work; this module just
 * shapes the result into the chat action format.
 */

import type { ChatAction, ChatResponse } from '@telostax/engine';
import type { PDFExtractResult } from './pdfImporter';
import { FORM_TYPE_LABELS, INCOME_TYPE_STEP_MAP } from './pdfImporter';

/**
 * Build a ChatResponse from a PDFExtractResult.
 * Returns proposed add_income actions and a human-readable summary.
 */
export function buildActionsFromExtraction(result: PDFExtractResult): ChatResponse {
  const actions: ChatAction[] = [];

  if (result.incomeType && Object.keys(result.extractedData).length > 0) {
    actions.push({
      type: 'add_income',
      incomeType: result.incomeType,
      fields: result.extractedData as Record<string, unknown>,
    });
  }

  const formLabel = result.formType
    ? FORM_TYPE_LABELS[result.formType] || result.formType
    : 'document';
  const payerInfo = result.payerName ? ` from **${result.payerName}**` : '';
  const confidenceNote =
    result.confidence !== 'high'
      ? ` (${result.confidence} confidence — please verify the values)`
      : '';

  const warningText =
    result.warnings.length > 0
      ? '\n\n**Warnings:**\n' + result.warnings.map((w) => `- ${w}`).join('\n')
      : '';

  const message =
    actions.length > 0
      ? `I extracted data from your **${formLabel}**${payerInfo}${confidenceNote}. Review the proposed changes below and click "Apply All" to add this to your return.${warningText}`
      : `I couldn't extract usable data from this document.${
          result.errors.length > 0 ? ' ' + result.errors.join(' ') : ''
        }`;

  const suggestedStep =
    result.incomeType ? INCOME_TYPE_STEP_MAP[result.incomeType] || null : null;

  return {
    message,
    actions,
    suggestedStep,
    followUpChips:
      actions.length > 0
        ? ['What step should I go to next?', 'Import another document']
        : ['Try importing again', 'Enter this data manually'],
  };
}

/**
 * Build a text summary of extraction results for the LLM context.
 * Sent as part of the user message in BYOK modes so the LLM
 * can propose actions and answer follow-up questions.
 */
export function buildExtractionContextText(result: PDFExtractResult): string {
  const lines: string[] = [];

  const formLabel = result.formType
    ? FORM_TYPE_LABELS[result.formType] || result.formType
    : 'Unknown form';
  lines.push(`Form type: ${formLabel} (${result.confidence} confidence)`);

  if (result.payerName) {
    lines.push(`Payer/Employer: ${result.payerName}`);
  }

  if (result.ocrUsed) {
    lines.push('Note: This was a scanned document — OCR was used, values may need verification.');
  }

  if (Object.keys(result.extractedData).length > 0) {
    lines.push('');
    lines.push('Extracted fields:');
    for (const [key, value] of Object.entries(result.extractedData)) {
      if (value === undefined || value === null || value === '') continue;
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      const formatted = typeof value === 'number' ? `$${value.toLocaleString()}` : String(value);
      lines.push(`  ${label}: ${formatted}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const w of result.warnings) {
      lines.push(`  - ${w}`);
    }
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const e of result.errors) {
      lines.push(`  - ${e}`);
    }
  }

  return lines.join('\n');
}
