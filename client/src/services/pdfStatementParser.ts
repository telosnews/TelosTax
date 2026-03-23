/**
 * PDF Statement Parser — Bank/Credit Card Statement PDF Parser
 *
 * Extracts transactions from PDF bank and credit card statements using
 * pdfjs-dist (already installed). Groups text items into lines by Y-coordinate,
 * then parses each line for date + description + amount patterns.
 *
 * Reuses parseDateString, parseCurrencyString from importHelpers.
 * All processing runs client-side. Data never leaves the browser.
 */

import * as pdfjsLib from 'pdfjs-dist';
import './pdfWorkerInit';
import type { ParseResult } from './deductionFinderTypes';
import { groupIntoLines, parseTransactionLines } from './pdfStatementParserHelpers';
import type { TextItem } from './pdfStatementParserHelpers';

// ─── Public API ─────────────────────────────────────

export async function parsePDFStatement(file: File): Promise<ParseResult> {
  const warnings: string[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const items = await extractAllTextItems(pdf);
    const lines = groupIntoLines(items);
    const transactions = parseTransactionLines(lines, warnings);

    if (transactions.length === 0) {
      warnings.push('No transactions could be extracted from this PDF. Try exporting as CSV from your bank instead.');
    }

    return {
      transactions,
      warnings,
      detectedFormat: 'PDF Statement',
    };
  } catch (err) {
    return {
      transactions: [],
      warnings: [`Failed to parse PDF: ${err instanceof Error ? err.message : 'Unknown error'}`],
      detectedFormat: 'error',
    };
  }
}

// ─── Text Extraction ────────────────────────────────

async function extractAllTextItems(pdf: pdfjsLib.PDFDocumentProxy): Promise<TextItem[]> {
  const items: TextItem[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        items.push({
          text: item.str.trim(),
          x: item.transform[4],
          y: Math.round((viewport.height - item.transform[5]) * 10) / 10,
          page: i,
        });
      }
    }
  }

  return items;
}

// Re-export helpers for consumers that imported from this module
export { groupIntoLines, parseTransactionLines, parseTransactionLine } from './pdfStatementParserHelpers';
