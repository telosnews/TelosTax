/**
 * Syncfusion PDF Extractor — form field reading + structured text extraction.
 *
 * Replaces pdfjs-dist for the PDF import pipeline. Two key advantages:
 *
 * 1. **Form field reading** — Employer/institution-generated W-2s and 1099s
 *    store values in interactive form fields that pdfjs-dist's getTextContent()
 *    misses entirely. Syncfusion reads these via PdfDocument.form and injects
 *    them as TextBlocks at each field's position, so the existing proximity-
 *    based extraction pipeline picks them up automatically.
 *
 * 2. **Structured text extraction** — PdfDataExtractor.extractTextLines()
 *    provides word-level bounding boxes, replacing pdfjs-dist's text items.
 *
 * Tesseract.js is still used for OCR on scanned/image PDFs (unchanged).
 * pdf-lib is still used for PDF generation (unchanged).
 *
 * All processing runs client-side. Data never leaves the browser.
 */

import { PdfDocument, PdfTextBoxField, PdfCheckBoxField } from '@syncfusion/ej2-pdf';
import { PdfDataExtractor } from '@syncfusion/ej2-pdf-data-extract';
import { groupWordsToPhrases, type TextBlock } from './pdfExtractHelpers';

export interface SyncfusionExtractionResult {
  textBlocks: TextBlock[];
  pagesScanned: number;
  /** True when the PDF has very little text — likely a scanned document */
  isScanned: boolean;
  /** True when the PDF is password-protected and can't be read */
  isPasswordProtected: boolean;
  /** Number of form fields that had non-empty values */
  formFieldsWithValues: number;
}

/**
 * Extract text and form field values from a PDF using Syncfusion.
 *
 * Returns TextBlock[] compatible with the existing pdfExtractHelpers pipeline.
 * Form field values are injected as additional TextBlocks at each field's
 * position, so findLabelBlock() + findNearbyNumber() pick them up naturally.
 */
export function extractWithSyncfusion(
  pdfBytes: Uint8Array,
  maxPages = 30,
): SyncfusionExtractionResult {
  let doc: PdfDocument | null = null;

  try {
    doc = new PdfDocument(pdfBytes);
    const pageCount = doc.pageCount;
    const endPage = Math.min(pageCount, maxPages) - 1;

    // ── 1. Structured text extraction (replaces pdfjs-dist getTextContent) ──
    const extractor = new PdfDataExtractor(doc);
    const textLines = extractor.extractTextLines({
      startPageIndex: 0,
      endPageIndex: endPage,
    });

    const textBlocks: TextBlock[] = [];

    for (const line of textLines) {
      if (!line.text?.trim()) continue;

      // Prefer word-level blocks for finer granularity — matches the
      // per-item output pdfjs-dist's getTextContent() provides, which
      // findLabelBlock() + findNearbyNumber() in pdfExtractHelpers expect.
      if (line.words && line.words.length > 0) {
        for (const word of line.words) {
          if (!word.text?.trim()) continue;
          textBlocks.push({
            text: word.text.trim(),
            x: word.bounds?.x ?? 0,
            y: word.bounds?.y ?? 0,
            width: word.bounds?.width ?? 0,
            height: word.bounds?.height ?? line.bounds?.height ?? 10,
            page: (line.pageIndex ?? 0) + 1, // 0-based → 1-based
          });
        }
      } else {
        // Fallback: use the whole line as a single block
        textBlocks.push({
          text: line.text.trim(),
          x: line.bounds?.x ?? 0,
          y: line.bounds?.y ?? 0,
          width: line.bounds?.width ?? 0,
          height: line.bounds?.height ?? 10,
          page: (line.pageIndex ?? 0) + 1,
        });
      }
    }

    // ── 1b. Group words into phrases ──────────────────────────────────
    //
    // Syncfusion's word-level blocks split multi-word labels like
    // "Wages, tips, other compensation" into individual words. The
    // extraction pipeline's findLabelBlock() needs phrase-level text.
    //
    // groupWordsToPhrases() merges horizontally adjacent words on the
    // same line while preserving column boundaries (X-gap splitting),
    // so "1 Wages, tips, other compensation" stays separate from
    // "2 Federal income tax withheld" on the same row.
    const phraseBlocks = groupWordsToPhrases(textBlocks);

    // Replace word-level blocks with phrase-level blocks.
    // Form field values (step 2) are added individually — they're
    // already single-value blocks and should not be merged with labels.
    textBlocks.length = 0;
    textBlocks.push(...phraseBlocks);

    // ── 2. Form field values (new — pdfjs-dist misses these entirely) ──
    //
    // Employer/institution-generated PDFs (W-2s, 1099s from payroll software)
    // often store values in interactive form fields rather than the text stream.
    // We inject each non-empty field value as a TextBlock at the field's position
    // so the existing proximity pipeline picks it up.
    let formFieldsWithValues = 0;

    if (doc.form && doc.form.count > 0) {
      // Build page identity map for field → page index lookup
      const pageMap = new Map<unknown, number>();
      for (let p = 0; p <= endPage; p++) {
        try {
          pageMap.set(doc.getPage(p), p);
        } catch { /* ignore */ }
      }

      for (let i = 0; i < doc.form.count; i++) {
        try {
          const field = doc.form.fieldAt(i);
          if (!field) continue;

          let value = '';
          if (field instanceof PdfTextBoxField) {
            value = field.text || '';
          } else if (field instanceof PdfCheckBoxField) {
            // Only inject checked checkboxes — they represent "X" or "Yes"
            if (field.checked) value = 'X';
          }

          if (!value) continue;

          const bounds = field.bounds;
          if (!bounds) continue;

          // Determine page index from the field's page reference
          let pageIdx = 0;
          try {
            if (field.page) {
              pageIdx = pageMap.get(field.page) ?? 0;
            }
          } catch { /* default to page 0 */ }

          // Only add fields within the scanned page range
          if (pageIdx <= endPage) {
            formFieldsWithValues++;
            textBlocks.push({
              text: value,
              x: bounds.x ?? 0,
              y: bounds.y ?? 0,
              width: bounds.width ?? 0,
              height: bounds.height ?? 10,
              page: pageIdx + 1,
            });
          }
        } catch {
          // Skip fields that can't be read (corrupted, unsupported type, etc.)
        }
      }
    }

    const isScanned = textBlocks.length < 5;

    return {
      textBlocks,
      pagesScanned: endPage + 1,
      isScanned,
      isPasswordProtected: false,
      formFieldsWithValues,
    };
  } catch (err: unknown) {
    // Syncfusion throws on password-protected PDFs
    const msg = (err as Error)?.message || '';
    if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypt')) {
      return {
        textBlocks: [],
        pagesScanned: 0,
        isScanned: false,
        isPasswordProtected: true,
        formFieldsWithValues: 0,
      };
    }

    console.warn('[SyncfusionExtractor] Extraction failed:', err);
    return {
      textBlocks: [],
      pagesScanned: 0,
      isScanned: false,
      isPasswordProtected: false,
      formFieldsWithValues: 0,
    };
  } finally {
    if (doc) {
      try { doc.destroy(); } catch { /* ignore */ }
    }
  }
}
