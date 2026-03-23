/**
 * Shared PDF text extraction utilities.
 *
 * Extracted from priorYearImporter.ts so both the prior-year importer and
 * competitor-return parser can share the same text-parsing infrastructure.
 *
 * All processing runs client-side. Data never leaves the browser.
 */

import * as pdfjsLib from 'pdfjs-dist';
import './pdfWorkerInit'; // Ensure worker is configured

// ─── Types ─────────────────────────────────────────

export interface TextBlock {
  text: string;
  x: number;
  y: number;
  page: number;
}

// ─── Text extraction ───────────────────────────────

/**
 * Extract positioned text blocks from the first N pages of a PDF.
 */
export async function extractTextBlocks(
  pdf: pdfjsLib.PDFDocumentProxy,
  maxPages: number = 2,
): Promise<TextBlock[]> {
  const blocks: TextBlock[] = [];

  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        blocks.push({
          text: item.str.trim(),
          x: item.transform[4],
          y: viewport.height - item.transform[5],
          page: i,
        });
      }
    }
  }

  return blocks;
}

// ─── Value finding ─────────────────────────────────

/**
 * Detect the X position of the value column on an IRS form page.
 * IRS forms have a consistent rightmost column where dollar amounts appear.
 * We detect it by finding the mode X position of large numbers (> 100).
 */
export function detectValueColumnX(blocks: TextBlock[], page: number): number {
  // Collect X positions of blocks that look like dollar values (> 100).
  // Only consider blocks in the right portion of the page (x > 200)
  // to exclude form labels like "Form 1040" and sidebar deduction amounts.
  const valueXPositions: number[] = [];
  for (const b of blocks) {
    if (b.page !== page) continue;
    if (b.x < 200) continue; // Skip left sidebar
    const num = parseDollarValue(b.text);
    if (num !== null && Math.abs(num) >= 100) {
      valueXPositions.push(Math.round(b.x / 20) * 20); // bucket by 20px
    }
  }

  if (valueXPositions.length === 0) return 540; // default for standard 1040

  // Find the most common X bucket — that's the value column
  const freq = new Map<number, number>();
  for (const x of valueXPositions) {
    freq.set(x, (freq.get(x) || 0) + 1);
  }

  let bestX = 540;
  let bestCount = 0;
  for (const [x, count] of freq) {
    if (count > bestCount || (count === bestCount && x > bestX)) {
      bestX = x;
      bestCount = count;
    }
  }

  return bestX;
}

/**
 * Find a numeric (dollar) value near a label matching any of the given keywords.
 * Searches rightward on the same line (±30px vertical tolerance).
 * Returns the rightmost candidate (IRS 1040 format: amount on far right).
 */
export function findLineValue(blocks: TextBlock[], keywords: string[]): number {
  // Find a label block matching any keyword
  const labelBlock = blocks.find(b =>
    keywords.some(kw => b.text.toLowerCase().includes(kw))
  );
  if (!labelBlock) return 0;

  // Look for a number to the right of the label on the same line (within ~30px vertically)
  const candidates: Array<{ value: number; distance: number }> = [];
  for (const block of blocks) {
    if (block === labelBlock || block.page !== labelBlock.page) continue;

    const parsed = parseDollarValue(block.text);
    if (parsed === null) continue;
    const num = parsed;

    const dy = Math.abs(block.y - labelBlock.y);
    const dx = block.x - labelBlock.x;

    // Must be roughly same line and to the right
    if (dy < 30 && dx > 0) {
      candidates.push({ value: num, distance: dx });
    }
  }

  if (candidates.length === 0) return 0;
  // Take the rightmost number (IRS 1040 has the dollar amount on the far right)
  candidates.sort((a, b) => b.distance - a.distance);
  return Math.round(candidates[0].value * 100) / 100;
}

/**
 * Column-aware line value extraction for IRS 1040.
 *
 * Unlike findLineValue() which just takes the rightmost number, this function:
 * 1. Detects the value column X position on the page
 * 2. Finds label blocks matching keywords
 * 3. Only reads values from the value column (±30px tolerance)
 * 4. Filters out obvious line numbers (single/double digit numbers at wrong X)
 *
 * This avoids the common failure where line numbers (1-38) are mistaken for values.
 */
export function findColumnValue(
  blocks: TextBlock[],
  keywords: string[],
  valueColumnX: number,
  /** When true, only use the tight column pass (8px). Disables the wider 15px
   *  fallback to prevent adjacent-line value contamination. Use for fields
   *  where labels are tightly packed (e.g., interest/dividends/IRA lines). */
  strictColumnOnly = false,
): number {
  // Find ALL label blocks matching any keyword (not just the first)
  const labelBlocks = blocks.filter(b =>
    keywords.some(kw => b.text.toLowerCase().includes(kw)),
  );
  if (labelBlocks.length === 0) return 0;

  // Try each matching label, prefer the one that yields a value in the column.
  // Tight 8px vertical tolerance prevents cross-line contamination — IRS form
  // lines are ~12px apart, so 8px captures same-line values (dy<2) without
  // bleeding into adjacent lines. Loosely-coupled values (label far from its
  // value box) fall through to the fallback pass below.
  for (const labelBlock of labelBlocks) {
    const candidates: Array<{ value: number; x: number; dy: number }> = [];

    for (const block of blocks) {
      if (block === labelBlock || block.page !== labelBlock.page) continue;

      const parsed = parseDollarValue(block.text);
      if (parsed === null) continue;
      // Skip likely line numbers (small integers 1-50) and SSNs/large form numbers
      if (Math.abs(parsed) <= 50 && block.text.trim().length <= 2) continue;
      if (Math.abs(parsed) > 10_000_000) continue;

      const dy = Math.abs(block.y - labelBlock.y);
      if (dy > 8) continue; // tight: prevents adjacent-line bleed

      // Must be in or near the value column
      const distFromColumn = Math.abs(block.x - valueColumnX);
      if (distFromColumn < 40) {
        candidates.push({ value: parsed, x: block.x, dy });
      }
    }

    if (candidates.length > 0) {
      // Take the candidate closest vertically to the label (most likely same line)
      candidates.sort((a, b) => a.dy - b.dy);
      return Math.round(candidates[0].value * 100) / 100;
    }
  }

  // Fallback: look for values in the outer value column on the same line.
  // Uses wider 15px vertical tolerance to catch loosely-coupled labels (e.g.,
  // "wages" label 12px above the value box). Requires x > 500 to exclude
  // inner-column subtotals that could be false positives.
  // Disabled for strictColumnOnly fields to prevent adjacent-line contamination.
  if (!strictColumnOnly) {
    for (const labelBlock of labelBlocks) {
      const candidates: Array<{ value: number; x: number; distance: number }> = [];
      for (const block of blocks) {
        if (block === labelBlock || block.page !== labelBlock.page) continue;
        if (block.x < 500) continue; // Only outer value column
        const parsed = parseDollarValue(block.text);
        if (parsed === null) continue;
        // Skip line numbers and SSNs
        if (Math.abs(parsed) <= 50 && block.text.trim().length <= 2) continue;
        if (Math.abs(parsed) > 10_000_000) continue;
        const dy = Math.abs(block.y - labelBlock.y);
        const dx = block.x - labelBlock.x;
        if (dy < 15 && dx > 0) {
          candidates.push({ value: parsed, x: block.x, distance: dx });
        }
      }

      if (candidates.length > 0) {
        // Prefer rightmost (value column is always far right)
        candidates.sort((a, b) => b.distance - a.distance);
        return Math.round(candidates[0].value * 100) / 100;
      }
    }
  }

  return 0;
}

// ─── Helpers ───────────────────────────────────────

/**
 * Parse a dollar-formatted string into a number.
 * Handles "$1,234.56", "(500)", "($1,234)", negative values, whitespace.
 */
export function parseDollarValue(raw: string): number | null {
  let cleaned = raw.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  // Accounting-format negatives: (500) or (1234.56) → -500 or -1234.56
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }
  // Reject strings with non-numeric characters (e.g., "1a", "2b", "Form")
  // Only allow digits, optional decimal point, optional leading minus
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

/**
 * Detect the tax year from a PDF by searching for a 4-digit year in the text.
 * Scans up to the first 5 pages to handle competitor bundles with cover pages.
 * Falls back to prior year if not found.
 */
export async function detectTaxYear(pdf: pdfjsLib.PDFDocumentProxy): Promise<number> {
  const pagesToScan = Math.min(pdf.numPages, 5);
  for (let i = 1; i <= pagesToScan; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      for (const item of textContent.items) {
        if ('str' in item) {
          // Look for a 4-digit year (e.g., "2024", "Form 1040 (2024)")
          const yearMatch = item.str.match(/\b(20[1-2]\d)\b/);
          if (yearMatch) {
            return parseInt(yearMatch[1], 10);
          }
        }
      }
    } catch {
      // Skip unreadable pages
    }
  }
  // Default to prior year
  return new Date().getFullYear() - 1;
}

/**
 * Normalize page text: collapse whitespace, lowercase.
 */
function normalizePageText(items: { str?: string }[]): string {
  return items
    .map(item => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Check if a page is an intro/cover page (not the actual form).
 * TurboTax, H&R Block, etc. insert summary pages that may mention "Form 1040"
 * but are not the form itself.
 */
function isIntroPage(text: string): boolean {
  const introMarkers = [
    'tax return summary',
    'return summary',
    'prepared for',
    'prepared by',
    'table of contents',
    'this is not an official',
    'electronic filing',
    'e-file confirmation',
    'filing instructions',
    'keep for your records',
    'print this page',
  ];
  // If the page has intro markers and does NOT have line-item labels
  // (like "Wages" on line 1a, "Filing status"), it's likely an intro page.
  const hasIntroMarker = introMarkers.some(m => text.includes(m));
  if (!hasIntroMarker) return false;

  // If it also has actual 1040 field labels, it's probably the real form
  const hasFormFields = text.includes('filing status') &&
    (text.includes('wages') || text.includes('adjusted gross'));
  return !hasFormFields;
}

/**
 * Check if page text matches a 1040-X (amended return) — excluded from detection.
 */
function is1040X(text: string): boolean {
  return text.includes('1040-x') || text.includes('1040x') || text.includes('amended u.s.');
}

/**
 * Scan all pages of a PDF to find the actual Form 1040 pages.
 * Competitor PDFs often bundle cover pages, state returns, and schedules.
 * Returns the 1-indexed page numbers for 1040 page 1 and page 2.
 * Returns null if no 1040 is found.
 *
 * Detection strategy (multi-pass):
 *   Pass 1 — strict: "Form 1040" + "individual income tax" (IRS standard)
 *   Pass 2 — relaxed: "Form 1040" or "1040-SR" + Treasury/IRS headers
 *   Pass 3 — OMB: unique OMB number 1545-0074 (printed on every 1040)
 *   Pass 4 — structural: page has "filing status" + income line labels
 *
 * In all passes, intro/cover pages and 1040-X are excluded.
 */
export async function find1040Pages(
  pdf: pdfjsLib.PDFDocumentProxy,
): Promise<{ page1: number; page2: number } | null> {
  // Quick path: if only 1-2 pages, assume it's the 1040
  if (pdf.numPages <= 2) {
    return { page1: 1, page2: Math.min(2, pdf.numPages) };
  }

  // Pre-extract text for all pages (text extraction is cheap for digital PDFs)
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      pageTexts.push(normalizePageText(textContent.items as { str?: string }[]));
    } catch {
      pageTexts.push('');
    }
  }

  const makeResult = (idx: number) => ({
    page1: idx + 1,
    page2: Math.min(idx + 2, pdf.numPages),
  });

  // Pass 1 — strict: original matching (both conditions)
  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i];
    if (is1040X(text) || isIntroPage(text)) continue;
    if (
      (text.includes('form 1040') || text.includes('form1040')) &&
      (text.includes('individual income tax') || text.includes('u.s. individual'))
    ) {
      return makeResult(i);
    }
  }

  // Pass 2 — relaxed: "Form 1040" (or 1040-SR) + Treasury/IRS header
  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i];
    if (is1040X(text) || isIntroPage(text)) continue;
    const hasForm = text.includes('form 1040') || text.includes('form1040') || text.includes('1040-sr');
    const hasTreasury = text.includes('department of the treasury') || text.includes('internal revenue service');
    if (hasForm && hasTreasury) {
      return makeResult(i);
    }
  }

  // Pass 3 — OMB number: 1545-0074 is printed on every Form 1040
  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i];
    if (is1040X(text) || isIntroPage(text)) continue;
    if (text.includes('1545-0074')) {
      return makeResult(i);
    }
  }

  // Pass 4 — structural: look for 1040 page-1 content markers
  // (e.g., "filing status" + "wages" + "adjusted gross income")
  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i];
    if (is1040X(text) || isIntroPage(text)) continue;
    const hasFilingStatus = text.includes('filing status');
    const hasIncomeLabels =
      (text.includes('wages') || text.includes('salaries')) &&
      (text.includes('adjusted gross') || text.includes('taxable income'));
    if (hasFilingStatus && hasIncomeLabels) {
      return makeResult(i);
    }
  }

  return null;
}

/**
 * Extract text blocks from specific page numbers (1-indexed).
 */
export async function extractTextBlocksFromPages(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumbers: number[],
): Promise<TextBlock[]> {
  const blocks: TextBlock[] = [];

  for (const pageNum of pageNumbers) {
    if (pageNum < 1 || pageNum > pdf.numPages) continue;

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        blocks.push({
          text: item.str.trim(),
          x: item.transform[4],
          y: viewport.height - item.transform[5],
          page: pageNum,
        });
      }
    }
  }

  return blocks;
}
