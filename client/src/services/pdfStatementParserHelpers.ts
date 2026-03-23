/**
 * PDF Statement Parser — Pure Helper Functions
 *
 * Text-processing logic for bank statement parsing, extracted from pdfStatementParser.ts
 * so it can be unit tested without pdfjs-dist (which requires DOMMatrix / browser APIs).
 *
 * Zero dependencies on pdfjs-dist. All processing runs client-side.
 */

import type { NormalizedTransaction } from './deductionFinderTypes';
import { parseCurrencyString, parseDateString } from './importHelpers';
import { extractMCCFromDescription } from './mccTaxMap';

// ─── Types ──────────────────────────────────────────

export interface TextItem {
  text: string;
  x: number;
  y: number;
  page: number;
}

export interface TextLine {
  text: string;
  page: number;
  y: number;
}

// ─── Constants ──────────────────────────────────────

/** Y-coordinate tolerance for grouping text items into lines (in PDF points). */
const Y_TOLERANCE = 3;

/** Date patterns commonly found in bank statements. */
const DATE_REGEX = /\b(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})|\d{4}-\d{2}-\d{2}|\d{1,2}-\d{1,2}-(?:\d{4}|\d{2}))\b/;

/** Amount patterns — matches dollar amounts with optional negative/parenthetical. */
const AMOUNT_REGEX = /[-]?\$?[\d,]+\.\d{2}\b|\([\$\d,]+\.\d{2}\)/;

// ─── Line Grouping ──────────────────────────────────

/** Group text items into lines by Y-coordinate proximity within each page. */
export function groupIntoLines(items: TextItem[]): TextLine[] {
  if (items.length === 0) return [];

  // Sort by page, then Y (top to bottom), then X (left to right)
  const sorted = [...items].sort((a, b) =>
    a.page !== b.page ? a.page - b.page :
    Math.abs(a.y - b.y) <= Y_TOLERANCE ? a.x - b.x :
    a.y - b.y,
  );

  const lines: TextLine[] = [];
  let currentLine: TextItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const prev = currentLine[0];

    if (item.page === prev.page && Math.abs(item.y - prev.y) <= Y_TOLERANCE) {
      currentLine.push(item);
    } else {
      lines.push(flushLine(currentLine));
      currentLine = [item];
    }
  }
  lines.push(flushLine(currentLine));

  return lines;
}

function flushLine(items: TextItem[]): TextLine {
  // Sort left-to-right within line
  items.sort((a, b) => a.x - b.x);
  return {
    text: items.map((i) => i.text).join(' '),
    page: items[0].page,
    y: items[0].y,
  };
}

// ─── Transaction Parsing ────────────────────────────

/** Parse lines looking for transaction rows (date + description + amount). */
export function parseTransactionLines(
  lines: TextLine[],
  warnings: string[],
): NormalizedTransaction[] {
  const transactions: NormalizedTransaction[] = [];
  let skippedCount = 0;

  for (const line of lines) {
    const txn = parseTransactionLine(line.text, line.page);
    if (txn) {
      transactions.push(txn);
    } else if (looksLikeTransaction(line.text)) {
      skippedCount++;
    }
  }

  if (skippedCount > 0) {
    warnings.push(`${skippedCount} line(s) looked like transactions but couldn't be fully parsed`);
  }

  return transactions;
}

/** Try to extract a transaction from a single text line.
 *  Returns null if the line doesn't contain a date + amount pattern. */
export function parseTransactionLine(text: string, page: number = 1): NormalizedTransaction | null {
  // Find date
  const dateMatch = text.match(DATE_REGEX);
  if (!dateMatch) return null;

  const date = parseDateString(dateMatch[1]);
  if (!date) return null;

  // Find amount — take the last match in the line (rightmost)
  const amountMatches = [...text.matchAll(new RegExp(AMOUNT_REGEX.source, 'g'))];
  if (amountMatches.length === 0) return null;

  const lastAmountMatch = amountMatches[amountMatches.length - 1];
  const amount = parseCurrencyString(lastAmountMatch[0]);
  if (amount === 0) return null;

  // Description is between the date and the amount
  const dateEnd = dateMatch.index! + dateMatch[0].length;
  const amountStart = lastAmountMatch.index!;

  // If amount comes before date, this isn't a transaction line
  if (amountStart <= dateEnd) return null;

  let description = text.slice(dateEnd, amountStart).trim();
  // Clean up common separators
  description = description.replace(/^[\s\-*·]+/, '').replace(/[\s\-*·]+$/, '').trim();

  if (!description || description.length < 2) return null;

  // Normalize: positive = expense (most statement amounts are positive for charges)
  const normalizedAmount = Math.abs(amount);

  const mccCode = extractMCCFromDescription(description);

  const txn: NormalizedTransaction = {
    date,
    description,
    amount: normalizedAmount,
    originalRow: page * 1000,
  };
  if (mccCode) txn.mccCode = mccCode;

  return txn;
}

/** Heuristic: does this line look like it could be a transaction?
 *  Used to count "almost parsed" lines for the warning count. */
function looksLikeTransaction(text: string): boolean {
  return DATE_REGEX.test(text) && /\d+\.\d{2}/.test(text);
}
