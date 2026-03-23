/**
 * PDF Extract Helpers — pure logic for form type detection and field extraction.
 *
 * This module contains NO pdfjs-dist dependency, so it can be unit-tested
 * in Node.js without browser APIs. The main pdfImporter.ts re-exports
 * everything from here and adds the PDF loading/parsing layer.
 */

import { normalizeOCRText, fuzzyIncludes } from './ocrTextMatching';

// ─── Types ─────────────────────────────────────────

export type SupportedFormType = 'W-2' | '1099-INT' | '1099-DIV' | '1099-R' | '1099-NEC' | '1099-MISC' | '1099-G' | '1099-B' | '1099-K' | 'SSA-1099' | '1099-SA' | '1099-Q'
  | '1098' | '1098-T' | '1098-E' | '1095-A' | 'K-1' | 'W-2G' | '1099-C' | '1099-S';

export interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface PDFExtractResult {
  formType: SupportedFormType | null;
  confidence: 'high' | 'medium' | 'low';
  extractedData: Record<string, unknown>;
  incomeType: string | null;     // The API type key: 'w2', '1099int', etc.
  payerName: string;
  warnings: string[];
  errors: string[];
  textBlockCount: number;
  trace?: ImportTrace;
  ocrUsed?: boolean;             // true when OCR was used (lower confidence)
  ocrAvailable?: boolean;        // true when PDF appears scanned and OCR can be tried
  rawOCRText?: string;           // Raw OCR text for AI enhancement (only when ocrUsed)
  aiEnhanced?: boolean;          // Set after AI enhancement applied
}

// ─── Import Trace Types ───────────────────────────

export interface ImportTraceEntry {
  field: string;                              // Key: "wages", "employerName", "formType"
  label: string;                              // Human-readable: "Wages (Box 1)"
  status: 'found' | 'not_found';
  value?: string;                             // Formatted value for display
  reasoning: string;                          // Brief explanation
}

export interface FormDetectionTrace {
  detectedType: SupportedFormType | null;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
  reasoning: string;
}

export interface ImportTrace {
  formDetection: FormDetectionTrace;
  fields: ImportTraceEntry[];
  summary: string;                            // One-line summary: "Found 7 of 9 fields"
  textBlockCount: number;
  pagesScanned: number;
  formPageRange?: { start: number; end: number };              // Pages used for extraction
  additionalForms?: Array<{ type: string; pages: string }>;    // Other forms found in the PDF
}

// ─── Per-Page Form Scanning ──────────────────────────

export interface FormPageSpan {
  type: SupportedFormType;
  incomeType: string;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
  startPage: number;   // 1-based inclusive
  endPage: number;     // 1-based inclusive (includes continuation pages)
}

// ─── Form Type Detection ───────────────────────────

interface FormSignature {
  type: SupportedFormType;
  incomeType: string;
  primaryKeywords: string[];
  secondaryKeywords: string[];
}

// ORDERING MATTERS: Forms with keywords that are substrings of other forms
// must come first to prevent false matches. Key ordering rules:
//   • K-1 before 1099-INT — K-1 box labels include "interest income"
//   • W-2G before W-2     — "form w-2" is a prefix of "form w-2g"
//   • 1098-T/E before 1098 — "1098" substring-matches "1098-t"/"1098-e"
const FORM_SIGNATURES: FormSignature[] = [
  {
    type: 'K-1',
    incomeType: 'k1',
    primaryKeywords: ['schedule k-1', 'form 1065', 'form 1120-s', 'form 1041'],
    secondaryKeywords: ['ordinary business income', 'guaranteed payments', "partner's share", 'net rental real estate'],
  },
  {
    type: 'W-2G',
    incomeType: 'w2g',
    primaryKeywords: ['w-2g', 'certain gambling winnings'],
    secondaryKeywords: ['reportable winnings', 'gross winnings', 'type of wager', 'winnings'],
  },
  {
    type: 'W-2',
    incomeType: 'w2',
    primaryKeywords: ['wage and tax statement', 'form w-2'],
    secondaryKeywords: ['employer', 'wages', 'federal income tax withheld', 'social security'],
  },
  {
    type: '1099-NEC',
    incomeType: '1099nec',
    primaryKeywords: ['1099-nec', 'nonemployee compensation'],
    secondaryKeywords: ['payer', 'compensation', 'recipient'],
  },
  {
    type: '1099-INT',
    incomeType: '1099int',
    primaryKeywords: ['1099-int', 'interest income'],
    secondaryKeywords: ['payer', 'interest', 'early withdrawal'],
  },
  {
    type: '1099-DIV',
    incomeType: '1099div',
    primaryKeywords: ['1099-div', 'dividends and distributions'],
    secondaryKeywords: ['ordinary dividends', 'qualified dividends', 'capital gain'],
  },
  {
    type: '1099-R',
    incomeType: '1099r',
    primaryKeywords: ['1099-r', 'distributions from pensions'],
    secondaryKeywords: ['gross distribution', 'taxable amount', 'distribution code'],
  },
  {
    type: '1099-MISC',
    incomeType: '1099misc',
    primaryKeywords: ['1099-misc', 'miscellaneous information'],
    secondaryKeywords: ['rents', 'royalties', 'other income', 'payer'],
  },
  {
    type: '1099-G',
    incomeType: '1099g',
    primaryKeywords: ['1099-g', 'certain government payments'],
    secondaryKeywords: ['unemployment', 'state tax refund', 'payer'],
  },
  {
    type: '1099-B',
    incomeType: '1099b',
    primaryKeywords: ['1099-b', 'proceeds from broker'],
    secondaryKeywords: ["broker's name", 'cost basis', 'short-term', 'long-term', 'date sold'],
  },
  {
    type: '1099-K',
    incomeType: '1099k',
    primaryKeywords: ['1099-k', 'payment card and third party'],
    secondaryKeywords: ['payment settlement', 'gross amount', 'card not present', 'third party network'],
  },
  {
    type: 'SSA-1099',
    incomeType: 'ssa1099',
    primaryKeywords: ['ssa-1099', 'social security benefit statement'],
    secondaryKeywords: ['social security administration', 'net benefits', 'benefits paid'],
  },
  {
    type: '1099-SA',
    incomeType: '1099sa',
    primaryKeywords: ['1099-sa', 'distributions from an hsa'],
    secondaryKeywords: ['health savings', 'gross distribution', 'distribution code', 'archer msa'],
  },
  {
    type: '1099-Q',
    incomeType: '1099q',
    primaryKeywords: ['1099-q', 'payments from qualified education'],
    secondaryKeywords: ['education program', 'gross distribution', 'earnings', 'basis'],
  },
  {
    type: '1098-T',
    incomeType: '1098t',
    primaryKeywords: ['1098-t', 'tuition statement'],
    secondaryKeywords: ['qualified tuition', 'scholarships', 'institution'],
  },
  {
    type: '1098-E',
    incomeType: '1098e',
    primaryKeywords: ['1098-e', 'student loan interest statement'],
    secondaryKeywords: ['student loan', 'interest received by lender'],
  },
  {
    type: '1098',
    incomeType: '1098',
    primaryKeywords: ['form 1098', 'mortgage interest statement'],
    secondaryKeywords: ['mortgage interest received', 'outstanding mortgage', 'mortgage insurance'],
  },
  {
    type: '1095-A',
    incomeType: '1095a',
    primaryKeywords: ['1095-a', 'health insurance marketplace'],
    secondaryKeywords: ['enrollment premium', 'slcsp', 'advance payment'],
  },
  {
    type: '1099-C',
    incomeType: '1099c',
    primaryKeywords: ['1099-c', 'cancellation of debt'],
    secondaryKeywords: ['amount of debt', 'discharged', 'identifiable event'],
  },
  {
    type: '1099-S',
    incomeType: '1099s',
    primaryKeywords: ['1099-s', 'proceeds from real estate'],
    secondaryKeywords: ['gross proceeds', 'date of closing', 'transferor'],
  },
];

// ─── Form Type Detection ──────────────────────────

/**
 * Detect form type from extracted text blocks.
 *
 * When `ocrMode` is true, uses fuzzy matching (Levenshtein distance ≤ 2)
 * for keyword detection instead of exact substring matching.
 * This compensates for OCR character recognition errors like "1099-NFC"
 * instead of "1099-NEC". Confidence is capped at 'low' for OCR results.
 *
 * When `ocrMode` is false/undefined, behavior is identical to pre-OCR
 * (exact substring matching via String.includes).
 */
export function detectFormType(textBlocks: TextBlock[], ocrMode?: boolean): {
  type: SupportedFormType | null;
  incomeType: string | null;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
} {
  let allText = textBlocks.map(b => b.text.toLowerCase()).join(' ');

  // OCR-specific preprocessing: normalize common artifacts
  if (ocrMode) {
    allText = normalizeOCRText(allText);

    // OCR fuzzy matching is lossy — "form 1099" matches "form 1065" at
    // distance 2, and "w-2 " matches "w-2g" at distance 1. Instead of
    // returning the first match, collect all matches and return the one
    // with the highest score (primary matches × 10 + secondary matches).
    let bestMatch: { type: SupportedFormType; incomeType: string; confidence: 'low'; matchedKeywords: string[] } | null = null;
    let bestScore = 0;

    for (const sig of FORM_SIGNATURES) {
      const matchedPrimary = sig.primaryKeywords.filter((kw: string) => fuzzyIncludes(allText, kw, 2));
      const matchedSecondary = sig.secondaryKeywords.filter((kw: string) => fuzzyIncludes(allText, kw, 2));
      const matched = [...matchedPrimary, ...matchedSecondary];

      if (matchedPrimary.length > 0) {
        const score = matchedPrimary.length * 10 + matchedSecondary.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { type: sig.type, incomeType: sig.incomeType, confidence: 'low', matchedKeywords: matched };
        }
      }
    }

    return bestMatch ?? { type: null, incomeType: null, confidence: 'low', matchedKeywords: [] };
  }

  // Digital PDF path: exact substring matching (unchanged)
  for (const sig of FORM_SIGNATURES) {
    const matchedPrimary = sig.primaryKeywords.filter(kw => allText.includes(kw));
    const matchedSecondary = sig.secondaryKeywords.filter(kw => allText.includes(kw));
    const matched = [...matchedPrimary, ...matchedSecondary];

    if (matchedPrimary.length > 0 && matchedSecondary.length >= 2) {
      return { type: sig.type, incomeType: sig.incomeType, confidence: 'high', matchedKeywords: matched };
    }
    if (matchedPrimary.length > 0) {
      return { type: sig.type, incomeType: sig.incomeType, confidence: 'medium', matchedKeywords: matched };
    }
  }

  return { type: null, incomeType: null, confidence: 'low', matchedKeywords: [] };
}

// ─── Per-Page Form Detection ─────────────────────────

/**
 * Scan a multi-page PDF page-by-page and return contiguous form spans.
 *
 * Each span represents one detected IRS form across one or more consecutive
 * pages. Pages that don't match any form before the first detected form are
 * skipped (intro/summary pages). Pages that don't match any form after a
 * detected form are treated as continuation pages (e.g., K-1 page 2, 1099-B
 * continuation sheets) and merged into the preceding span.
 *
 * Returns spans sorted by startPage. An empty array means no supported form
 * was detected on any page.
 */
export function detectFormPages(
  textBlocks: TextBlock[],
  ocrMode?: boolean,
): FormPageSpan[] {
  // Group blocks by page
  const pageMap = new Map<number, TextBlock[]>();
  for (const block of textBlocks) {
    let arr = pageMap.get(block.page);
    if (!arr) {
      arr = [];
      pageMap.set(block.page, arr);
    }
    arr.push(block);
  }

  const pages = [...pageMap.keys()].sort((a, b) => a - b);
  if (pages.length <= 1) return []; // Single-page — caller should use legacy detection

  // Detect form type on each page independently
  interface PageDetection {
    page: number;
    type: SupportedFormType | null;
    incomeType: string | null;
    confidence: 'high' | 'medium' | 'low';
    matchedKeywords: string[];
  }

  const detections: PageDetection[] = pages.map(page => {
    const blocks = pageMap.get(page)!;
    const result = detectFormType(blocks, ocrMode);
    return { page, ...result };
  });

  // Build contiguous form spans
  const spans: FormPageSpan[] = [];
  let currentSpan: FormPageSpan | null = null;

  for (const det of detections) {
    if (det.type !== null) {
      if (currentSpan && det.type === currentSpan.type) {
        // Same form type — extend the current span
        currentSpan.endPage = det.page;
        currentSpan.matchedKeywords = [
          ...new Set([...currentSpan.matchedKeywords, ...det.matchedKeywords]),
        ];
        // Upgrade confidence if this page had higher confidence
        if (det.confidence === 'high') currentSpan.confidence = 'high';
        else if (det.confidence === 'medium' && currentSpan.confidence === 'low')
          currentSpan.confidence = 'medium';
      } else {
        // Different form type — close current span, start new one
        if (currentSpan) spans.push(currentSpan);
        currentSpan = {
          type: det.type,
          incomeType: det.incomeType!,
          confidence: det.confidence,
          matchedKeywords: [...det.matchedKeywords],
          startPage: det.page,
          endPage: det.page,
        };
      }
    } else {
      // No form detected on this page
      if (currentSpan) {
        // Treat as continuation page of the preceding form
        currentSpan.endPage = det.page;
      }
      // If no current span, this is a leading intro page — skip it
    }
  }

  // Don't forget to push the last span
  if (currentSpan) spans.push(currentSpan);

  return spans;
}

// ─── Word-to-Phrase Grouping ─────────────────────────

/**
 * Group word-level TextBlocks into phrase-level TextBlocks.
 *
 * PDF text extractors (Syncfusion, pdfjs-dist) produce individual words
 * as separate TextBlocks. The extraction pipeline's findLabelBlock() needs
 * multi-word phrases like "wages, tips" to match keywords.
 *
 * Groups words that are:
 * 1. On the same page
 * 2. On the same Y line (within yTolerance)
 * 3. Horizontally adjacent (X gap < xGapThreshold)
 *
 * The X-gap splitting preserves column structure on IRS forms — labels
 * in the left column stay separate from labels in the right column.
 */
export function groupWordsToPhrases(
  words: TextBlock[],
  yTolerance = 5,
  xGapThreshold = 15,
): TextBlock[] {
  if (words.length === 0) return [];

  // Sort strictly by page, then Y (no tolerance in sort — avoids violating
  // strict weak ordering like groupWordsToLines in ocrService.ts)
  const sorted = [...words].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.y - b.y;
  });

  // Step 1: Group into rows by Y tolerance
  const rows: TextBlock[][] = [];
  let currentRow: TextBlock[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const word = sorted[i];
    if (word.page === currentRow[0].page && Math.abs(word.y - currentRow[0].y) <= yTolerance) {
      currentRow.push(word);
    } else {
      rows.push(currentRow);
      currentRow = [word];
    }
  }
  rows.push(currentRow);

  // Step 2: Within each row, sort by X and split into phrases by X gap
  const phrases: TextBlock[] = [];
  for (const row of rows) {
    const xSorted = [...row].sort((a, b) => a.x - b.x);
    let phraseWords: TextBlock[] = [xSorted[0]];

    for (let i = 1; i < xSorted.length; i++) {
      const word = xSorted[i];
      const prev = phraseWords[phraseWords.length - 1];
      const gap = word.x - (prev.x + prev.width);

      // IRS box-number boundary detection: when we encounter a standalone
      // 1-2 digit number (e.g., "1", "2a", "14") after an existing phrase
      // of 2+ words, force a phrase break. This prevents header text from
      // merging with box labels (e.g., "PAYER name address ZIP 1 Unemployment
      // compensation" should split at "1" into two phrases).
      const isBoxNumBoundary = phraseWords.length >= 2 &&
        /^\d{1,2}[a-z]?$/i.test(word.text.trim());

      if (gap < xGapThreshold && !isBoxNumBoundary) {
        phraseWords.push(word);
      } else {
        phrases.push(mergePhraseWords(phraseWords));
        phraseWords = [word];
      }
    }
    phrases.push(mergePhraseWords(phraseWords));
  }

  return phrases;
}

/** Merge an array of words into a single phrase TextBlock. */
function mergePhraseWords(words: TextBlock[]): TextBlock {
  if (words.length === 1) return words[0];

  const text = words.map(w => w.text).join(' ');
  const x = words[0].x;
  const y = Math.min(...words.map(w => w.y));
  const rightEdge = Math.max(...words.map(w => w.x + w.width));
  const width = rightEdge - x;
  const height = Math.max(...words.map(w => w.height));

  return { text, x, y, width, height, page: words[0].page };
}

// ─── Field Extraction ──────────────────────────────

/** Regex for "pure numeric" text — digits with optional $, comma, period, minus. */
const PURE_NUMERIC_RE = /^-?[\d,]+\.?\d*$/;

/**
 * Find the nearest numeric value near a label text.
 * Searches to the right and below the label.
 *
 * Only considers blocks whose text is a pure number (after stripping $ and whitespace).
 * This prevents parsing labels like "2 Federal income tax withheld" as the number 2.
 *
 * Uses closest-point distance from the label (not just right edge) so values
 * under wide merged labels are still found. Adds a below-bias: on IRS forms,
 * box values are always below their labels, so values above get a 20px penalty.
 */
function findNearbyNumber(textBlocks: TextBlock[], labelBlock: TextBlock, maxDistance = 400): number {
  const candidates: Array<{ value: number; distance: number }> = [];
  const rejected: Array<{ text: string; value: number; reason: string; dx: number; dy: number; dist: number }> = [];

  const labelLeft = labelBlock.x;
  const labelRight = labelBlock.x + labelBlock.width;

  for (const block of textBlocks) {
    if (block === labelBlock) continue;

    // Extract number from text — must be purely numeric (not a label containing a digit).
    // Fallback: mixed-content blocks with a leading dollar amount (e.g., "$5000.00 11/23/2024"
    // from W-2G where value and date merge into one block).
    const cleaned = block.text.replace(/[$,\s]/g, '');
    let num: number;

    if (PURE_NUMERIC_RE.test(cleaned)) {
      // Guard against merged multi-value blocks (e.g., K-1 Part III where "32500 17500"
      // from adjacent boxes on the same line merge into one block). After space removal
      // this becomes "3250017500" — a bogus number. Detect by checking the raw text:
      // if it has multiple space-separated pure-numeric tokens, pick the one closest
      // to the label's X position instead of using the merged value.
      const rawTokens = block.text.replace(/[$,]/g, '').trim().split(/\s+/);
      if (rawTokens.length > 1 && rawTokens.every(t => PURE_NUMERIC_RE.test(t))) {
        // Estimate each token's X position based on character offset within the block,
        // then pick the token whose estimated position is closest to the label.
        const fullText = block.text.replace(/[$,]/g, '').trim();
        let bestToken = rawTokens[0];
        let bestDist = Infinity;
        let charPos = 0;
        for (const token of rawTokens) {
          const tokenX = block.x + (charPos / fullText.length) * block.width;
          const dist = Math.abs(tokenX - labelBlock.x);
          if (dist < bestDist) { bestDist = dist; bestToken = token; }
          charPos += token.length + 1; // +1 for the space
        }
        num = parseFloat(bestToken);
      } else {
        num = parseFloat(cleaned);
      }
    } else {
      // Mixed content — try multiple extraction strategies:
      // 1. Dollar amount: "$5000.00 11/23/2024" → 5000.00
      const dollarMatch = block.text.match(/\$\s*([\d,]+\.?\d*)/);
      // 2. Leading number: "8400.00 Form" → 8400.00 (phrase grouping merged value with text)
      //    Require either a decimal point OR 3+ digits to exclude IRS box labels like "2 Federal..."
      const leadingMatch = block.text.match(/^-?([\d,]+\.\d+)\s+[A-Za-z]/) ||
                           block.text.match(/^-?(\d{3}[\d,]*)\s+[A-Za-z]/);
      // 3. Number followed by a date: "5000.00 11/23/2024" → 5000.00
      //    (phrase grouping can merge a value with an adjacent date)
      const dateTrailingMatch = block.text.match(/^-?([\d,]+\.?\d+)\s+\d{1,2}[\/\-]\d{1,2}/);
      if (dollarMatch) {
        num = parseFloat(dollarMatch[1].replace(/,/g, ''));
      } else if (leadingMatch) {
        num = parseFloat(leadingMatch[1].replace(/,/g, ''));
      } else if (dateTrailingMatch) {
        num = parseFloat(dateTrailingMatch[1].replace(/,/g, ''));
      } else {
        continue;
      }
    }

    if (isNaN(num)) continue;

    // Calculate X distance from nearest point on label (not just right edge).
    // This handles wide merged labels where values sit directly underneath.
    let dx: number;
    if (block.x >= labelLeft && block.x <= labelRight) {
      dx = 0; // value is within the label's x-span
    } else if (block.x < labelLeft) {
      dx = block.x - labelLeft;
    } else {
      dx = block.x - labelRight;
    }

    const dy = block.y - labelBlock.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Only consider blocks that are to the right, below, or under the label
    if (!(distance < maxDistance && (dx >= -20 || dy > 0))) {
      rejected.push({ text: block.text.substring(0, 40), value: num, reason: distance >= maxDistance ? `dist=${Math.round(distance)}>max` : `dx=${Math.round(dx)},dy=${Math.round(dy)} wrong dir`, dx: Math.round(dx), dy: Math.round(dy), dist: Math.round(distance) });
      continue;
    }
    if (distance < maxDistance && (dx >= -20 || dy > 0)) {
      // Below-bias: on IRS forms, box values are always below their labels.
      // Values DIRECTLY ABOVE the label (within its x-span, dx===0) are almost
      // certainly from the box above — apply heavy penalty (100px) so they lose
      // to any value below or to the right. Values above but offset to the right
      // get a lighter 20px penalty (they may be in the same row's value column).
      let belowBias = 0;
      if (dy < 0) {
        belowBias = dx === 0 ? 100 : 50;
      }

      // Intervening-label guard: if another IRS box label (e.g. "3 Interest on...")
      // sits between this label and the candidate number vertically, the number
      // belongs to that other box — skip it.
      // Direction-aware thresholds:
      //   - ABOVE the label (dy < 0): aggressive 10px — value in wrong direction
      //   - BELOW + within label's x-span (dx=0): relaxed 120px — dense grid forms
      //     like W-2G stack multiple box labels vertically before the form field
      //     value, so intervening labels in the same column are just neighbors
      //   - BELOW + offset (dx≠0): moderate 30px — standard IRS layout
      const minY = Math.min(labelBlock.y, block.y);
      const maxY = Math.max(labelBlock.y, block.y);
      const labelMidX = labelBlock.x + labelBlock.width / 2;
      const yThreshold = dy < 0 ? 10 : (dx === 0 ? 120 : 30);
      const hasInterveningLabel = (maxY - minY > yThreshold) && textBlocks.some(b => {
        if (b === labelBlock || b === block) return false;
        if (b.y <= minY || b.y >= maxY) return false;
        // Must be in the same horizontal region (not an address on the far left)
        if (Math.abs(b.x - labelMidX) > 150) return false;
        // IRS box labels: 1-2 digit number + optional letter + space
        // (excludes 3+ digit addresses like "456 Financial Drive")
        return /^\d{1,2}[a-z]?\s/i.test(b.text.trim());
      });
      if (hasInterveningLabel) {
        rejected.push({ text: block.text.substring(0, 40), value: num, reason: 'intervening label', dx: Math.round(dx), dy: Math.round(dy), dist: Math.round(distance) });
        continue;
      }

      candidates.push({ value: num, distance: distance + belowBias });
    }
  }

  if (candidates.length === 0) {
    if (rejected.length > 0) {
      console.debug(`[PDFExtract] Label "${labelBlock.text.substring(0, 40)}" — ${rejected.length} numeric blocks REJECTED:`, rejected);
    }
    return 0;
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return Math.round(candidates[0].value * 100) / 100;
}

/**
 * Find a text block containing a keyword.
 *
 * Iterates keywords in order (most-specific first), then scans blocks for
 * each keyword. This ensures "employer's name" is matched before the more
 * generic "employer" — preventing the EIN label from being selected when
 * the actual employer-name label exists.
 */
function findLabelBlock(textBlocks: TextBlock[], keywords: string[]): TextBlock | null {
  for (const kw of keywords) {
    let fallback: TextBlock | null = null;
    const kwCompact = kw.replace(/\s+/g, '');
    for (const block of textBlocks) {
      const blockLower = block.text.toLowerCase();
      const blockCompact = blockLower.replace(/\s+/g, '');
      // Match normally OR via compact form (collapses letter-spaced IRS labels
      // like "4 F e d e r a l i n c o m e t a x w i t h h e l d")
      if (blockLower.includes(kw) || blockCompact.includes(kwCompact)) {
        // Reject merged form headers — wide blocks (>300px) containing multiple
        // header terms (payer, address, city, ZIP, OMB etc.) that happen to also
        // include a box keyword. These mega-blocks span the full form width and
        // make proximity-based value matching impossible.
        if (isMergedHeader(block)) continue;

        // Prefer blocks that start with an IRS box number (e.g. "1 Interest income")
        // over form titles (e.g. "Interest Income") — box labels are more precise.
        if (/^\d{1,2}[a-z]?\s/i.test(block.text.trim())) {
          return block;
        }
        if (!fallback) fallback = block;
      }
    }
    if (fallback) return fallback;
  }
  return null;
}

/** Detect merged form headers — wide blocks containing multiple header/boilerplate terms. */
function isMergedHeader(block: TextBlock): boolean {
  if (block.width < 250) return false;
  const lower = block.text.toLowerCase();
  const compact = lower.replace(/\s+/g, '');
  const headerTerms = ['payer', 'address', 'city', 'state', 'zip', 'omb', 'street', 'employer', 'filer', 'borrower'];
  const matchCount = headerTerms.filter(t => lower.includes(t) || compact.includes(t)).length;
  return matchCount >= 3;
}

/**
 * Extract name from the top area of the PDF (typically payer/employer info).
 */
function extractPayerName(textBlocks: TextBlock[], keywords: string[]): string {
  /** Reject blocks that look like IRS labels/boilerplate rather than actual names.
   *  Strategy: use STRUCTURAL patterns (not word blocklists) so real company names
   *  like "Vanguard Retirement Plan Services" aren't falsely rejected. */
  const isLabelText = (text: string): boolean => {
    const lower = text.toLowerCase();
    const compact = lower.replace(/\s+/g, '');
    const trimmed = text.trim();

    // 1. Spaced-out text: if more than 3 single-char "words", it's letter-spaced label text
    const words = trimmed.split(/\s+/);
    if (words.filter(w => w.length === 1).length > 3) return true;

    // 2. Core IRS field labels that would NEVER be a company name on their own
    //    (these are form structure terms, not content descriptors)
    const coreLabels = /\b(employer'?s?|payer'?s?|recipient'?s?|filer'?s?|borrower'?s?|lender'?s?|student'?s?)\b.*\b(name|tin|address|identification)\b/;
    if (coreLabels.test(lower) || coreLabels.test(compact)) return true;

    // 3. Standalone IRS structural terms (would never be an entity name alone)
    const structuralPattern = /\b(address|zip\s*code|postal\s*code|telephone|province|city or town|corrected|if checked|void|identification|department of the treasury|internal revenue|nonemployee compensation|account\s*number|recipient(?!'s)|consumer products|resale|parachute|negligence|penalty|sanction|furnished|taxable|important tax)\b/;
    if (structuralPattern.test(lower) || structuralPattern.test(compact)) return true;

    // 4. Text ending with preposition/conjunction — clearly a fragment, not a name
    //    "Retirement or", "Distributions From", "Broker and", "qualified tuition and related"
    if (/\b(or|and|from|of|the|in|to|for|a|an|this|your|its?)\s*,?\s*$/i.test(trimmed)) return true;

    // 5. Text starting with IRS instruction verbs — "Report this", "Attach this", "See instructions"
    if (/^(report|attach|see|check|enter|include|if\b|do not|you\b|this\b)/i.test(trimmed)) return true;

    // 6. Specific IRS boilerplate phrases from various form descriptions
    if (/^(not determined|total distribution|copy [a-z]|miscellaneous|certain government)/i.test(trimmed)) return true;
    if (/^qualified\s+tuition/i.test(trimmed)) return true;
    if (/^(distributions?\s+from\s+pensions|pensions,?\s+annuities)/i.test(trimmed)) return true;

    // 7. Very short single-word text (≤8 chars) — almost never a real entity name
    //    Catches fragments like "Total", "Plans", "Copy", "etc."
    if (trimmed.length <= 8 && !/\s/.test(trimmed) && /^[a-z]+\.?$/i.test(trimmed)) return true;

    // 8. IRS box prefix like "c Employer's..." or "2b Taxable amount"
    if (/^[a-z]\s/i.test(text)) return true;
    if (/^\d{1,2}[a-z]?\s+[A-Z]/i.test(trimmed)) return true;

    return false;
  };

  // Look for the label first
  const labelBlock = findLabelBlock(textBlocks, keywords);
  if (labelBlock) {
    // Find text below/near the label that looks like a name
    // Widened search: 150px horizontal, 80px vertical (real W-2 boxes are tall)
    const candidates = textBlocks.filter(b =>
      b !== labelBlock &&
      Math.abs(b.x - labelBlock.x) < 150 &&
      b.y > labelBlock.y &&
      b.y < labelBlock.y + 80 &&
      b.text.length > 2 &&
      !/^\d/.test(b.text) &&
      !b.text.includes('Box') &&
      !b.text.includes('$') &&
      !b.text.toLowerCase().includes('form') &&
      !/\bOMB\b/i.test(b.text) &&
      !isLabelText(b.text),
    );
    if (candidates.length > 0) {
      return candidates[0].text;
    }
  }

  // Fallback: look for company-like text in the top portion
  const topBlocks = textBlocks
    .filter(b => b.page === 1 && b.y < 200 && b.text.length > 3)
    .filter(b => b !== labelBlock) // exclude the label we already found
    .filter(b => !/^\d|form|copy|department|internal|treasury|statement|corrected|void/i.test(b.text))
    .filter(b => !b.text.includes('$'))
    .filter(b => !/\bOMB\b/i.test(b.text))
    .filter(b => !/\btotaling\b/i.test(b.text))
    .filter(b => !/\brequirement\b/i.test(b.text))
    .filter(b => !isLabelText(b.text));

  return topBlocks.length > 0 ? topBlocks[0].text : '';
}

/**
 * Extract a number associated with a box label (e.g., "Box 1", "1 Wages").
 */
function extractBoxValue(textBlocks: TextBlock[], boxKeywords: string[]): number {
  const label = findLabelBlock(textBlocks, boxKeywords);
  if (!label) {
    console.debug(`[PDFExtract] No label found for keywords: ${boxKeywords.join(', ')}`);
    return 0;
  }
  const value = findNearbyNumber(textBlocks, label);
  if (value === 0) {
    console.debug(`[PDFExtract] Label "${label.text}" at (${Math.round(label.x)},${Math.round(label.y)}) page=${label.page} w=${Math.round(label.width)} — no value found. Keywords: ${boxKeywords[0]}`);
    // Dump ALL blocks sorted by Y position so we can see the full layout
    const allBlocks = textBlocks
      .map(b => ({ text: b.text.substring(0, 60), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), p: b.page }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    console.debug(`[PDFExtract] ALL ${allBlocks.length} text blocks:`, allBlocks);
  }
  return value;
}

/**
 * Find the nearest raw text value near a label.
 * Like findNearbyNumber but preserves the string — use for tax codes, not amounts.
 * Uses closest-point distance and below-bias (same as findNearbyNumber).
 */
function findNearbyText(textBlocks: TextBlock[], labelBlock: TextBlock, maxDistance = 400): string {
  const candidates: Array<{ text: string; distance: number }> = [];

  const labelLeft = labelBlock.x;
  const labelRight = labelBlock.x + labelBlock.width;

  for (const block of textBlocks) {
    if (block === labelBlock) continue;

    // Skip blocks that look like IRS box labels (e.g., "5 Transaction type",
    // "7 W i n n i n g s..." where letter-spaced labels also start with a digit).
    // These are digit-prefixed labels for other boxes, not values.
    if (/^\d{1,2}[a-z]?\s+[A-Za-z]/i.test(block.text.trim()) && block.text.trim().length > 3) continue;

    // Skip standalone currency symbols, punctuation, or very short non-text noise
    const trimmed = block.text.trim();
    if (/^[$€£¥%#.,;:]+$/.test(trimmed)) continue;

    // Skip blocks that look like dollar amounts (e.g., "5000.00", "$1,200.00")
    // — findNearbyText is for text values like wager types, not numbers
    if (/^\$?[\d,]+\.\d{2}\b/.test(trimmed)) continue;

    let dx: number;
    if (block.x >= labelLeft && block.x <= labelRight) {
      dx = 0;
    } else if (block.x < labelLeft) {
      dx = block.x - labelLeft;
    } else {
      dx = block.x - labelRight;
    }

    const dy = block.y - labelBlock.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < maxDistance && (dx >= -20 || dy > 0)) {
      let belowBias = 0;
      if (dy < 0) {
        belowBias = dx === 0 ? 100 : 50;
      }
      candidates.push({ text: block.text.trim(), distance: distance + belowBias });
    }
  }

  if (candidates.length === 0) return '';
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0].text;
}

/**
 * Extract a text (non-numeric) value associated with a box label.
 * Use for distribution codes, category codes, etc. — not dollar amounts.
 */
function extractBoxText(textBlocks: TextBlock[], boxKeywords: string[]): string {
  const label = findLabelBlock(textBlocks, boxKeywords);
  if (!label) return '';
  return findNearbyText(textBlocks, label);
}

// ─── Form-Specific Extractors ──────────────────────

const US_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]);

export function extractW2Fields(textBlocks: TextBlock[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    employerName: extractPayerName(textBlocks, ["employer's name", 'employer name', 'employer']),
    wages: extractBoxValue(textBlocks, ['wages, tips', '1 wages', 'box 1']),
    federalTaxWithheld: extractBoxValue(textBlocks, ['federal income tax withheld', '2 federal', 'box 2']),
    socialSecurityWages: extractBoxValue(textBlocks, ['social security wages', '3 social security wages', 'box 3']),
    socialSecurityTax: extractBoxValue(textBlocks, ['social security tax', '4 social security tax', 'box 4']),
    medicareWages: extractBoxValue(textBlocks, ['medicare wages', '5 medicare wages', 'box 5']),
    medicareTax: extractBoxValue(textBlocks, ['medicare tax', '6 medicare tax', 'box 6']),
  };

  // ── Boxes 15-17 (State section): Positional extraction ──
  //
  // The W-2 state section has boxes 15-20 on the same Y line with tiny X gaps
  // (5-15px), which causes groupWordsToPhrases to merge labels into one huge
  // phrase. The keyword→findNearbyNumber pipeline fails because the merged
  // label is wider than maxDistance=200. Instead, find the 2-letter state code
  // directly, then pick up numeric values to its right on the same line.
  const page1Blocks = textBlocks.filter(b => b.page === 1);
  const maxY = page1Blocks.length > 0 ? Math.max(...page1Blocks.map(b => b.y)) : 0;

  let stateBlock: TextBlock | null = null;
  for (const block of page1Blocks) {
    if (block.y < maxY * 0.55) continue; // Bottom ~45% of the form
    const text = block.text.trim().toUpperCase();
    if (text.length === 2 && US_STATE_CODES.has(text)) {
      fields.state = text;
      stateBlock = block;
      break;
    }
  }

  if (stateBlock) {
    // Find pure numeric values on the same line as the state code, to its right.
    // On W-2s: first number = state wages (Box 16), second = state tax (Box 17).
    const sameLineNumbers = textBlocks.filter(b => {
      if (b.page !== stateBlock!.page) return false;
      if (Math.abs(b.y - stateBlock!.y) > 10) return false;
      if (b.x <= stateBlock!.x + stateBlock!.width) return false;
      const cleaned = b.text.replace(/[$,\s]/g, '');
      return PURE_NUMERIC_RE.test(cleaned);
    }).sort((a, b) => a.x - b.x);

    if (sameLineNumbers.length > 0) {
      fields.stateWages = parseFloat(sameLineNumbers[0].text.replace(/[$,\s]/g, ''));
    }
    if (sameLineNumbers.length > 1) {
      fields.stateTaxWithheld = parseFloat(sameLineNumbers[1].text.replace(/[$,\s]/g, ''));
    }
  } else {
    // Fallback: keyword approach (works when phrases are well-separated)
    fields.stateWages = extractBoxValue(textBlocks, ['state wages', '16 state wages', 'box 16']);
    fields.stateTaxWithheld = extractBoxValue(textBlocks, ['state income tax', '17 state income tax', 'box 17']);

    const rawState = extractBoxText(textBlocks, ['15 state', "employer's state", 'state id']);
    const stateCode = rawState.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2);
    if (US_STATE_CODES.has(stateCode)) {
      fields.state = stateCode;
    }
  }

  // Box 12a-12d: Best-effort extraction of code + amount pairs
  const box12: { code: string; amount: number }[] = [];
  for (const suffix of ['12a', '12b', '12c', '12d']) {
    const raw = extractBoxText(textBlocks, [suffix, `box ${suffix}`]);
    if (raw) {
      // Expect format like "D 5000.00" or "DD 12000" or just a code letter
      const match = raw.match(/^([A-Z]{1,2})\s+[\$]?([\d,]+\.?\d*)/);
      if (match) {
        box12.push({ code: match[1], amount: parseFloat(match[2].replace(/,/g, '')) });
      }
    }
  }
  if (box12.length > 0) {
    fields.box12 = box12;
  }

  // Box 13: Best-effort checkbox detection
  const box13: Record<string, boolean> = {};
  const box13Text = extractBoxText(textBlocks, ['13', 'statutory', 'retirement']);
  if (box13Text) {
    const lower = box13Text.toLowerCase();
    if (lower.includes('statutory') && (lower.includes('x') || lower.includes('yes') || lower.includes('checked'))) {
      box13.statutoryEmployee = true;
    }
    if (lower.includes('retirement') && (lower.includes('x') || lower.includes('yes') || lower.includes('checked'))) {
      box13.retirementPlan = true;
    }
  }
  if (Object.keys(box13).length > 0) {
    fields.box13 = box13;
  }

  return fields;
}

export function extract1099INTFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    payerName: extractPayerName(textBlocks, ["payer's name", 'payer name', 'payer']),
    amount: extractBoxValue(textBlocks, ['interest income', '1 interest', 'box 1']),
    earlyWithdrawalPenalty: extractBoxValue(textBlocks, ['early withdrawal penalty', '2 early withdrawal', 'box 2']),
    usBondInterest: extractBoxValue(textBlocks, ['u.s. savings bond', '3 interest on u.s.', 'box 3']),
    federalTaxWithheld: extractBoxValue(textBlocks, ['federal income tax withheld', '4 federal', 'box 4']),
    taxExemptInterest: extractBoxValue(textBlocks, ['tax-exempt interest', '8 tax-exempt', 'box 8']),
  };
}

export function extract1099DIVFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    payerName: extractPayerName(textBlocks, ["payer's name", 'payer name', 'payer']),
    ordinaryDividends: extractBoxValue(textBlocks, ['ordinary dividends', '1a ordinary', 'box 1a']),
    qualifiedDividends: extractBoxValue(textBlocks, ['qualified dividends', '1b qualified', 'box 1b']),
    capitalGainDistributions: extractBoxValue(textBlocks, ['capital gain distributions', 'capital gain distr', '2a total capital', '2a capital', 'box 2a']),
    federalTaxWithheld: extractBoxValue(textBlocks, ['federal income tax withheld', '4 federal', 'box 4']),
    foreignTaxPaid: extractBoxValue(textBlocks, ['foreign tax paid', '7 foreign', 'box 7']),
  };
}

export function extract1099RFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    payerName: extractPayerName(textBlocks, ["payer's name", 'payer name', 'payer']),
    grossDistribution: extractBoxValue(textBlocks, ['gross distribution', '1 gross', 'box 1']),
    taxableAmount: extractBoxValue(textBlocks, ['taxable amount', '2a taxable', 'box 2a']),
    federalTaxWithheld: extractBoxValue(textBlocks, ['federal income tax withheld', '4 federal', 'box 4']),
    distributionCode: extractBoxText(textBlocks, ['distribution code', '7 distribution code', 'box 7']),
  };
}

export function extract1099NECFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    payerName: extractPayerName(textBlocks, ["payer's name", 'payer name', 'payer']),
    amount: extractBoxValue(textBlocks, ['nonemployee compensation', '1 nonemployee', 'box 1']),
  };
}

export function extract1099MISCFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    payerName: extractPayerName(textBlocks, ["payer's name", 'payer name', 'payer']),
    rents: extractBoxValue(textBlocks, ['rents', '1 rents', 'box 1']),
    royalties: extractBoxValue(textBlocks, ['royalties', '2 royalties', 'box 2']),
    otherIncome: extractBoxValue(textBlocks, ['other income', '3 other income', 'box 3']),
    federalTaxWithheld: extractBoxValue(textBlocks, ['federal income tax withheld', '4 federal', 'box 4']),
    stateTaxWithheld: extractBoxValue(textBlocks, ['state tax withheld', '16 state tax', 'box 16']),
  };
}

export function extract1099GFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    payerName: extractPayerName(textBlocks, ["payer's name", 'payer name', 'payer']),
    unemploymentCompensation: extractBoxValue(textBlocks, ['unemployment compensation', '1 unemployment', 'box 1']),
    federalTaxWithheld: extractBoxValue(textBlocks, ['federal income tax withheld', '4 federal', 'box 4']),
  };
}

export function extract1099BFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    brokerName: extractPayerName(textBlocks, ["payer's name", 'payer name', "broker's name"]),
    description: 'Consolidated Summary (PDF Import)',
    proceeds: extractBoxValue(textBlocks, ['total proceeds', '1d proceeds', '1d total']),
    costBasis: extractBoxValue(textBlocks, ['total cost', 'cost or other basis', '1e cost', '1e total']),
    isLongTerm: false,
    dateSold: '',
    federalTaxWithheld: extractBoxValue(textBlocks, ['federal income tax withheld', '4 federal', 'box 4']),
  };
}

export function extract1099KFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    platformName: extractPayerName(textBlocks, ["filer's name", "payer's name", 'payer name', 'filer']),
    grossAmount: extractBoxValue(textBlocks, ['gross amount', '1a gross amount', 'box 1a']),
    cardNotPresent: extractBoxValue(textBlocks, ['card not present', '1b card not present', 'box 1b']),
    federalTaxWithheld: extractBoxValue(textBlocks, ['federal income tax withheld', '4 federal', 'box 4']),
  };
}

export function extractSSA1099Fields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    totalBenefits: extractBoxValue(textBlocks, ['net benefits', '5 net benefits', 'box 5']),
    federalTaxWithheld: extractBoxValue(textBlocks, ['federal income tax withheld', '6 voluntary federal', 'box 6']),
  };
}

export function extract1099SAFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    payerName: extractPayerName(textBlocks, ["trustee's name", "payer's name", 'trustee', 'payer']),
    grossDistribution: extractBoxValue(textBlocks, ['gross distribution', '1 gross distribution', 'box 1']),
    distributionCode: extractBoxText(textBlocks, ['distribution code', '3 distribution code', 'box 3']),
    federalTaxWithheld: extractBoxValue(textBlocks, ['federal income tax withheld', 'tax withheld']),
  };
}

export function extract1099QFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    payerName: extractPayerName(textBlocks, ["trustee's name", "payer's name", 'trustee', 'payer']),
    grossDistribution: extractBoxValue(textBlocks, ['gross distribution', '1 gross distribution', 'box 1']),
    earnings: extractBoxValue(textBlocks, ['earnings', '2 earnings', 'box 2']),
    basisReturn: extractBoxValue(textBlocks, ['basis', '3 basis', 'box 3']),
    distributionType: 'qualified',
    qualifiedExpenses: 0,
  };
}

export function extract1098Fields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    lenderName: extractPayerName(textBlocks, ["recipient's name", "lender's name", 'lender name', 'recipient']),
    mortgageInterest: extractBoxValue(textBlocks, ['mortgage interest received', '1 mortgage interest', 'box 1']),
    outstandingPrincipal: extractBoxValue(textBlocks, ['outstanding mortgage principal', '2 outstanding', 'box 2']),
    mortgageInsurance: extractBoxValue(textBlocks, ['mortgage insurance premiums', '5 mortgage insurance', 'box 5']),
  };
}

export function extract1098TFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    institutionName: extractPayerName(textBlocks, ["filer's name", 'institution name', 'institution']),
    tuitionPayments: extractBoxValue(textBlocks, ['payments received', '1 payments received', 'box 1']),
    scholarships: extractBoxValue(textBlocks, ['scholarships or grants', '5 scholarships', 'box 5']),
  };
}

export function extract1098EFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    lenderName: extractPayerName(textBlocks, ["recipient's name", "lender's name", 'lender name', 'recipient']),
    interestPaid: extractBoxValue(textBlocks, ['student loan interest', '1 student loan interest', 'box 1']),
  };
}

export function extract1095AFields(textBlocks: TextBlock[]): Record<string, unknown> {
  // Policy issuer name is Box 3 — use specific keywords first to avoid matching
  // the header "Health Insurance Marketplace Statement"
  const fields: Record<string, unknown> = {
    marketplaceName: extractPayerName(textBlocks, ["policy issuer", "issuer's name", 'issuer name']),
    annualEnrollmentPremium: 0,
    annualSLCSP: 0,
    annualAdvancePTC: 0,
  };

  // 1095-A annual totals are a TABLE row (Line 33) with 3 numbers left-to-right:
  //   Column A = Enrollment Premium, Column B = SLCSP, Column C = Advance PTC
  // Simple label→nearby-value fails here; use positional extraction instead.
  const annualLabel = findLabelBlock(textBlocks, ['annual total', '33 annual', 'annual']);
  if (annualLabel) {
    // Find all numbers on the same line, to the right of the label
    const sameLineNumbers = textBlocks.filter(b => {
      if (b.page !== annualLabel.page) return false;
      if (Math.abs(b.y - annualLabel.y) > 10) return false;
      if (b.x <= annualLabel.x + annualLabel.width) return false;
      const cleaned = b.text.replace(/[$,\s]/g, '');
      return PURE_NUMERIC_RE.test(cleaned);
    }).sort((a, b) => a.x - b.x);

    if (sameLineNumbers.length > 0) {
      fields.annualEnrollmentPremium = parseFloat(sameLineNumbers[0].text.replace(/[$,\s]/g, ''));
    }
    if (sameLineNumbers.length > 1) {
      fields.annualSLCSP = parseFloat(sameLineNumbers[1].text.replace(/[$,\s]/g, ''));
    }
    if (sameLineNumbers.length > 2) {
      fields.annualAdvancePTC = parseFloat(sameLineNumbers[2].text.replace(/[$,\s]/g, ''));
    }
  }

  return fields;
}

export function extractK1Fields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    entityName: extractPayerName(textBlocks, ["partnership's name", "corporation's name", "estate's name", "trust's name", 'entity name']),
    ordinaryBusinessIncome: extractBoxValue(textBlocks, ['ordinary business income', '1 ordinary business', 'box 1']),
    rentalIncome: extractBoxValue(textBlocks, ['net rental real estate', '2 net rental', 'box 2']),
    guaranteedPayments: extractBoxValue(textBlocks, ['guaranteed payments', '4 guaranteed', 'box 4']),
    interestIncome: extractBoxValue(textBlocks, ['interest income', '5 interest', 'box 5']),
    ordinaryDividends: extractBoxValue(textBlocks, ['ordinary dividends', '6a ordinary', 'box 6a']),
    royalties: extractBoxValue(textBlocks, ['royalties', '7 royalties', 'box 7']),
    shortTermCapitalGain: extractBoxValue(textBlocks, ['short-term capital gain', '8 net short-term', 'box 8']),
    longTermCapitalGain: extractBoxValue(textBlocks, ['long-term capital gain', '9a net long-term', 'box 9a']),
    selfEmploymentIncome: extractBoxValue(textBlocks, ['self-employment', '14a self-employment', '14 code a']),
  };
}

export function extractW2GFields(textBlocks: TextBlock[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    payerName: extractPayerName(textBlocks, ["payer's name", 'payer name', 'payer']),
    grossWinnings: extractBoxValue(textBlocks, ['reportable winnings', 'gross winnings', '1 reportable', '1 gross winnings', 'box 1']),
    federalTaxWithheld: extractBoxValue(textBlocks, ['federal income tax withheld', '4 federal income tax', '4 federal', 'income tax withheld', 'federal income tax', 'box 4']),
  };

  // Box 3: Type of Wager — extract and clean address prefixes
  let wagerType = extractBoxText(textBlocks, ['type of wager', '3 type of wager', 'box 3']);
  // Strip leading address fragments (e.g., "Las Vegas, NV 89109 Slot Machine" → "Slot Machine")
  wagerType = wagerType.replace(/^[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(-\d{4})?\s*/, '');
  fields.typeOfWager = wagerType;

  // State section (Boxes 13-15): Use the same approach as W-2 — find a standalone
  // 2-letter state code in the bottom portion, then pick up nearby numbers.
  // W-2G layout: Box 13 = State, Box 14 = State winnings, Box 15 = State tax withheld
  const page1Blocks = textBlocks.filter(b => b.page === 1);
  const maxY = page1Blocks.length > 0 ? Math.max(...page1Blocks.map(b => b.y)) : 0;

  let stateBlock: TextBlock | null = null;
  for (const block of page1Blocks) {
    // State code is in the bottom ~40% of the form
    if (block.y < maxY * 0.6) continue;
    const text = block.text.trim().toUpperCase();
    if (text.length === 2 && US_STATE_CODES.has(text)) {
      fields.stateCode = text;
      stateBlock = block;
      break;
    }
  }

  if (stateBlock) {
    // Find pure numeric values on the same line as the state code, to its right.
    // On W-2G: first number = state winnings (Box 14), second = state tax (Box 15).
    const sameLineNumbers = textBlocks.filter(b => {
      if (b.page !== stateBlock!.page) return false;
      if (Math.abs(b.y - stateBlock!.y) > 10) return false;
      if (b.x <= stateBlock!.x + stateBlock!.width) return false;
      const cleaned = b.text.replace(/[$,\s]/g, '');
      return PURE_NUMERIC_RE.test(cleaned);
    }).sort((a, b) => a.x - b.x);

    // Skip the first number (state winnings, Box 14) and take the second (state tax, Box 15)
    if (sameLineNumbers.length > 1) {
      fields.stateTaxWithheld = parseFloat(sameLineNumbers[1].text.replace(/[$,\s]/g, ''));
    } else if (sameLineNumbers.length === 1) {
      // If only one number, it could be either — use keyword fallback
      fields.stateTaxWithheld = extractBoxValue(textBlocks, ['15 state income tax withheld', '15 state tax', 'state income tax withheld', 'box 15']);
    }
  } else {
    // Fallback: keyword approach
    fields.stateTaxWithheld = extractBoxValue(textBlocks, ['15 state income tax withheld', '15 state tax', 'state income tax withheld', 'state tax withheld', 'box 15']);
    const rawState = extractBoxText(textBlocks, ['13 state', 'state/payer']);
    const stateMatch = rawState.match(/\b([A-Z]{2})\b/i);
    const stateCode = stateMatch ? stateMatch[1].toUpperCase() : '';
    if (US_STATE_CODES.has(stateCode)) {
      fields.stateCode = stateCode;
    }
  }

  return fields;
}

export function extract1099CFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    payerName: extractPayerName(textBlocks, ["creditor's name", "payer's name", 'creditor', 'payer']),
    amountCancelled: extractBoxValue(textBlocks, ['amount of debt discharged', 'amount of debt', '2 amount of debt', 'box 2']),
    interestIncluded: extractBoxValue(textBlocks, ['interest if included', '3 interest', 'box 3']),
    debtDescription: extractBoxText(textBlocks, ['description of debt', '4 debt description', 'box 4']),
    identifiableEventCode: extractBoxText(textBlocks, ['identifiable event code', '6 identifiable', 'box 6']),
  };
}

export function extract1099SFields(textBlocks: TextBlock[]): Record<string, unknown> {
  return {
    settlementAgent: extractPayerName(textBlocks, ["filer's name", "transferee's name", 'settlement agent', 'filer']),
    grossProceeds: extractBoxValue(textBlocks, ['gross proceeds', '2 gross proceeds', 'box 2']),
    closingDate: extractBoxText(textBlocks, ['date of closing', '1 date of closing', 'box 1']),
    buyerRealEstateTax: extractBoxValue(textBlocks, ["buyer's part of real estate tax", "6 buyer's part", '6 real estate tax', 'box 6']),
  };
}

// ─── Utility: Form type display helpers ────────────

export const FORM_TYPE_LABELS: Record<SupportedFormType, string> = {
  'W-2': 'W-2 Wage and Tax Statement',
  '1099-INT': '1099-INT Interest Income',
  '1099-DIV': '1099-DIV Dividends',
  '1099-R': '1099-R Retirement Distributions',
  '1099-NEC': '1099-NEC Nonemployee Compensation',
  '1099-MISC': '1099-MISC Miscellaneous Income',
  '1099-G': '1099-G Government Payments',
  '1099-B': '1099-B Broker Proceeds',
  '1099-K': '1099-K Payment Card Transactions',
  'SSA-1099': 'SSA-1099 Social Security Benefits',
  '1099-SA': '1099-SA HSA Distributions',
  '1099-Q': '1099-Q Education Program Payments',
  '1098': '1098 Mortgage Interest Statement',
  '1098-T': '1098-T Tuition Statement',
  '1098-E': '1098-E Student Loan Interest',
  '1095-A': '1095-A Health Insurance Marketplace',
  'K-1': 'Schedule K-1 Partner/Shareholder Income',
  'W-2G': 'W-2G Gambling Winnings',
  '1099-C': '1099-C Cancellation of Debt',
  '1099-S': '1099-S Proceeds from Real Estate',
};

export const INCOME_TYPE_STEP_MAP: Record<string, string> = {
  w2: 'w2_income',
  '1099int': '1099int_income',
  '1099div': '1099div_income',
  '1099r': '1099r_income',
  '1099nec': '1099nec_income',
  '1099misc': '1099misc_income',
  '1099g': '1099g_income',
  '1099b': '1099b_income',
  '1099k': '1099k_income',
  ssa1099: 'ssa1099_income',
  '1099sa': '1099sa_income',
  '1099q': '1099q_income',
  '1098': 'mortgage_interest_ded',
  '1098t': 'education_credits',
  '1098e': 'student_loan_ded',
  '1095a': 'premium_tax_credit',
  k1: 'k1_income',
  w2g: 'w2g_income',
  '1099c': '1099c_income',
  '1099s': 'home_sale',
};

export const INCOME_DISCOVERY_KEYS: Record<string, string> = {
  w2: 'w2',
  '1099int': '1099int',
  '1099div': '1099div',
  '1099r': '1099r',
  '1099nec': '1099nec',
  '1099misc': '1099misc',
  '1099g': '1099g',
  '1099b': '1099b',
  '1099k': '1099k',
  ssa1099: 'ssa1099',
  '1099sa': '1099sa',
  '1099q': '1099q',
  '1098': 'ded_mortgage',
  '1098t': 'education_credit',
  '1098e': 'ded_student_loan',
  '1095a': 'premium_tax_credit',
  k1: 'k1',
  w2g: 'w2g',
  '1099c': '1099c',
  '1099s': 'home_sale',
};

// ─── Import Trace Generation ─────────────────────

/** Human-readable field labels per form type (for trace entries). */
const FIELD_LABELS: Record<SupportedFormType, Record<string, string>> = {
  'W-2': {
    employerName: 'Employer Name',
    wages: 'Wages, Tips (Box 1)',
    federalTaxWithheld: 'Federal Tax Withheld (Box 2)',
    socialSecurityWages: 'Social Security Wages (Box 3)',
    socialSecurityTax: 'Social Security Tax (Box 4)',
    medicareWages: 'Medicare Wages (Box 5)',
    medicareTax: 'Medicare Tax (Box 6)',
    stateTaxWithheld: 'State Tax Withheld (Box 17)',
    stateWages: 'State Wages (Box 16)',
  },
  '1099-INT': {
    payerName: 'Payer Name',
    amount: 'Interest Income (Box 1)',
    earlyWithdrawalPenalty: 'Early Withdrawal Penalty (Box 2)',
    usBondInterest: 'U.S. Savings Bond Interest (Box 3)',
    federalTaxWithheld: 'Federal Tax Withheld (Box 4)',
    taxExemptInterest: 'Tax-Exempt Interest (Box 8)',
  },
  '1099-DIV': {
    payerName: 'Payer Name',
    ordinaryDividends: 'Ordinary Dividends (Box 1a)',
    qualifiedDividends: 'Qualified Dividends (Box 1b)',
    capitalGainDistributions: 'Capital Gain Distributions (Box 2a)',
    federalTaxWithheld: 'Federal Tax Withheld (Box 4)',
    foreignTaxPaid: 'Foreign Tax Paid (Box 7)',
  },
  '1099-R': {
    payerName: 'Payer Name',
    grossDistribution: 'Gross Distribution (Box 1)',
    taxableAmount: 'Taxable Amount (Box 2a)',
    federalTaxWithheld: 'Federal Tax Withheld (Box 4)',
  },
  '1099-NEC': {
    payerName: 'Payer Name',
    amount: 'Nonemployee Compensation (Box 1)',
  },
  '1099-MISC': {
    payerName: 'Payer Name',
    rents: 'Rents (Box 1)',
    royalties: 'Royalties (Box 2)',
    otherIncome: 'Other Income (Box 3)',
    federalTaxWithheld: 'Federal Tax Withheld (Box 4)',
    stateTaxWithheld: 'State Tax Withheld (Box 16)',
  },
  '1099-G': {
    payerName: 'Payer Name',
    unemploymentCompensation: 'Unemployment Compensation (Box 1)',
    federalTaxWithheld: 'Federal Tax Withheld (Box 4)',
  },
  '1099-B': {
    brokerName: 'Broker Name',
    description: 'Description',
    proceeds: 'Total Proceeds (Box 1d)',
    costBasis: 'Total Cost Basis (Box 1e)',
    isLongTerm: 'Long-Term',
    dateSold: 'Date Sold',
    federalTaxWithheld: 'Federal Tax Withheld (Box 4)',
  },
  '1099-K': {
    platformName: 'Platform / Filer Name',
    grossAmount: 'Gross Amount (Box 1a)',
    cardNotPresent: 'Card Not Present (Box 1b)',
    federalTaxWithheld: 'Federal Tax Withheld (Box 4)',
  },
  'SSA-1099': {
    totalBenefits: 'Net Benefits (Box 5)',
    federalTaxWithheld: 'Federal Tax Withheld (Box 6)',
  },
  '1099-SA': {
    payerName: 'Trustee / Payer Name',
    grossDistribution: 'Gross Distribution (Box 1)',
    distributionCode: 'Distribution Code (Box 3)',
    federalTaxWithheld: 'Federal Tax Withheld',
  },
  '1099-Q': {
    payerName: 'Trustee / Payer Name',
    grossDistribution: 'Gross Distribution (Box 1)',
    earnings: 'Earnings (Box 2)',
    basisReturn: 'Basis (Box 3)',
    distributionType: 'Distribution Type',
    qualifiedExpenses: 'Qualified Expenses',
  },
  '1098': {
    lenderName: 'Lender Name',
    mortgageInterest: 'Mortgage Interest Received (Box 1)',
    outstandingPrincipal: 'Outstanding Mortgage Principal (Box 2)',
    mortgageInsurance: 'Mortgage Insurance Premiums (Box 5)',
  },
  '1098-T': {
    institutionName: 'Institution Name',
    tuitionPayments: 'Tuition Payments (Box 1)',
    scholarships: 'Scholarships / Grants (Box 5)',
  },
  '1098-E': {
    lenderName: 'Lender Name',
    interestPaid: 'Student Loan Interest Paid (Box 1)',
  },
  '1095-A': {
    marketplaceName: 'Marketplace Name',
    annualEnrollmentPremium: 'Annual Enrollment Premium',
    annualSLCSP: 'Annual SLCSP Premium',
    annualAdvancePTC: 'Annual Advance PTC',
  },
  'K-1': {
    entityName: 'Entity Name',
    ordinaryBusinessIncome: 'Ordinary Business Income (Box 1)',
    rentalIncome: 'Net Rental Income (Box 2)',
    guaranteedPayments: 'Guaranteed Payments (Box 4)',
    interestIncome: 'Interest Income (Box 5)',
    ordinaryDividends: 'Ordinary Dividends (Box 6a)',
    royalties: 'Royalties (Box 7)',
    shortTermCapitalGain: 'Short-Term Capital Gain (Box 8)',
    longTermCapitalGain: 'Long-Term Capital Gain (Box 9a)',
    selfEmploymentIncome: 'Self-Employment Income (Box 14A)',
  },
  'W-2G': {
    payerName: 'Payer Name',
    grossWinnings: 'Gross Winnings (Box 1)',
    federalTaxWithheld: 'Federal Tax Withheld (Box 4)',
    typeOfWager: 'Type of Wager (Box 3)',
    stateCode: 'State (Box 13)',
    stateTaxWithheld: 'State Tax Withheld (Box 15)',
  },
  '1099-C': {
    payerName: 'Creditor Name',
    amountCancelled: 'Amount of Debt Cancelled (Box 2)',
    interestIncluded: 'Interest Included (Box 3)',
    debtDescription: 'Debt Description (Box 4)',
    identifiableEventCode: 'Identifiable Event Code (Box 6)',
  },
  '1099-S': {
    settlementAgent: 'Settlement Agent / Filer',
    grossProceeds: 'Gross Proceeds (Box 2)',
    closingDate: 'Date of Closing (Box 1)',
    buyerRealEstateTax: "Buyer's Real Estate Tax (Box 6)",
  },
};

function formatTraceValue(value: unknown): string {
  if (typeof value === 'number') {
    return value === 0 ? '$0' : `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return String(value);
}

/**
 * Generate a human-readable import trace explaining what was extracted
 * and how the form was detected.
 */
export function generateImportTrace(
  formType: SupportedFormType | null,
  confidence: 'high' | 'medium' | 'low',
  matchedKeywords: string[],
  extractedData: Record<string, unknown>,
  textBlockCount: number,
  pagesScanned: number,
  pageRangeInfo?: {
    formPageRange?: { start: number; end: number };
    additionalForms?: Array<{ type: string; pages: string }>;
  },
): ImportTrace {
  // ── Form detection trace ──
  let detectionReasoning: string;
  if (!formType) {
    detectionReasoning = 'No primary form keywords matched. Could not determine form type.';
  } else if (confidence === 'high') {
    detectionReasoning = `Matched primary keyword + ${matchedKeywords.length - 1} secondary keywords: "${matchedKeywords.join('", "')}"`;
  } else if (confidence === 'medium') {
    detectionReasoning = `Matched primary keyword "${matchedKeywords[0]}" but fewer than 2 secondary keywords`;
  } else {
    detectionReasoning = 'Low confidence — keyword match was weak';
  }

  const formDetection: FormDetectionTrace = {
    detectedType: formType,
    confidence,
    matchedKeywords,
    reasoning: detectionReasoning,
  };

  // ── Field-level trace ──
  const fieldLabels = formType ? FIELD_LABELS[formType] || {} : {};
  const fields: ImportTraceEntry[] = Object.entries(extractedData).map(([key, value]) => {
    const label = fieldLabels[key] || key;
    const isName = typeof value === 'string';
    const isFound = isName ? (value as string).length > 0 : (value as number) !== 0;

    return {
      field: key,
      label,
      status: isFound ? 'found' as const : 'not_found' as const,
      value: isFound ? formatTraceValue(value) : undefined,
      reasoning: isFound
        ? isName
          ? 'Matched label text and extracted nearby name'
          : 'Found numeric value near matching box label'
        : isName
          ? 'No name text found near label — enter manually'
          : 'No numeric value near label — check browser console for diagnostics',
    };
  });

  const found = fields.filter(f => f.status === 'found').length;
  const total = fields.length;
  const summary = formType
    ? `Extracted ${found} of ${total} fields from ${FORM_TYPE_LABELS[formType]}`
    : `Could not identify form type (${textBlockCount} text blocks scanned)`;

  return {
    formDetection,
    fields,
    summary,
    textBlockCount,
    pagesScanned,
    ...(pageRangeInfo?.formPageRange && { formPageRange: pageRangeInfo.formPageRange }),
    ...(pageRangeInfo?.additionalForms?.length && { additionalForms: pageRangeInfo.additionalForms }),
  };
}
