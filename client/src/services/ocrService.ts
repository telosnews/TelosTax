/**
 * OCR Service — client-side OCR using Tesseract.js.
 *
 * Lazy-loads the Tesseract.js WASM worker on first use (~7 MB total assets).
 * Converts Tesseract word-level output to TextBlock format with line grouping,
 * so the entire existing extraction pipeline is reused.
 *
 * All processing runs client-side. Data never leaves the browser.
 * Static assets are self-hosted in /tesseract-data/ (no CDN calls).
 */

import type { TextBlock } from './pdfExtractHelpers';
import { normalizeOCRText } from './ocrTextMatching';

// ─── Types ─────────────────────────────────────────

export type OCRStage = 'loading' | 'recognizing' | 'complete';

/** Tesseract word bounding box (subset of Tesseract.js Word type) */
export interface TesseractWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

// ─── Lazy Worker Management ─────────────────────────

let workerInstance: any = null;
let workerInitPromise: Promise<any> | null = null;

// Mutable reference to the active progress callback. Updated on every
// getWorker() call so the Tesseract logger always reports to the current
// caller — prevents stale closure when the worker is reused across
// multiple OCR runs without termination.
let activeProgressCallback: ((stage: OCRStage, pct: number) => void) | undefined;

async function getWorker(
  onProgress?: (stage: OCRStage, pct: number) => void,
): Promise<any> {
  activeProgressCallback = onProgress;
  if (workerInstance) return workerInstance;
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = (async () => {
    try {
      activeProgressCallback?.('loading', 0);

      // Dynamic import to keep tesseract.js out of the main bundle
      const Tesseract = await import('tesseract.js');

      const worker = await Tesseract.createWorker('eng', undefined, {
        workerPath: '/tesseract-data/worker.min.js',
        corePath: '/tesseract-data/',
        langPath: '/tesseract-data/',
        workerBlobURL: false,
        logger: (m: { status: string; progress: number }) => {
          const { stage, pct } = normalizeProgress(m.status, m.progress);
          activeProgressCallback?.(stage, pct);
        },
      });

      workerInstance = worker;
      return worker;
    } finally {
      // Always clear the init promise so a failed init can be retried
      workerInitPromise = null;
    }
  })();

  return workerInitPromise;
}

/** Terminate the OCR worker to free memory. Call on panel unmount. */
export async function terminateWorker(): Promise<void> {
  if (workerInstance) {
    try {
      await workerInstance.terminate();
    } catch {
      // Ignore termination errors
    }
    workerInstance = null;
  }
  workerInitPromise = null;
  activeProgressCallback = undefined;
}

// ─── Pure Logic Functions (testable without WASM) ────

/**
 * Map a single Tesseract word to a TextBlock.
 * Filters out empty text and zero-width words.
 *
 * When scaleFactor > 1, coordinates are divided by it to normalize from
 * source pixel space (e.g. 300 DPI or photo resolution) to PDF-point
 * space (72 DPI, ~612×792 for letter). This ensures groupWordsToLines()
 * operates in point space where yTolerance=5 is correctly calibrated,
 * and findNearbyNumber(maxDistance=200) searches the expected range.
 */
export function mapTesseractWordToTextBlock(
  word: TesseractWord,
  page: number,
  scaleFactor = 1,
): TextBlock | null {
  const text = word.text.trim();
  if (!text) return null;

  const width = word.bbox.x1 - word.bbox.x0;
  const height = word.bbox.y1 - word.bbox.y0;

  if (width <= 0 || height <= 0) return null;

  const s = scaleFactor || 1;
  return {
    text,
    x: word.bbox.x0 / s,
    y: word.bbox.y0 / s,
    width: width / s,
    height: height / s,
    page,
  };
}

/**
 * Group word-level TextBlocks into line-level TextBlocks.
 *
 * Tesseract returns individual words. The existing findLabelBlock() and
 * findNearbyNumber() work better with line-level blocks that contain
 * multi-word labels like "wages, tips" as a single block.
 *
 * Groups words that are on the same page and have similar Y coordinates
 * (within yTolerance pixels), then sorts by X and concatenates text.
 */
export function groupWordsToLines(
  words: TextBlock[],
  yTolerance = 5,
): TextBlock[] {
  if (words.length === 0) return [];

  // Sort strictly by page, then y. x-sorting is handled later inside
  // mergeLineWords(). Mixing tolerance-based Y comparison with X sorting
  // violates strict weak ordering (A<B, B<C but C<A), which causes
  // non-deterministic results across JS engines.
  const sorted = [...words].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.y - b.y;
  });

  const lines: TextBlock[] = [];
  let currentLine: TextBlock[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const word = sorted[i];
    const prev = currentLine[0];

    // Same line if same page and Y within tolerance
    if (word.page === prev.page && Math.abs(word.y - prev.y) <= yTolerance) {
      currentLine.push(word);
    } else {
      // Flush current line
      lines.push(mergeLineWords(currentLine));
      currentLine = [word];
    }
  }

  // Flush last line
  if (currentLine.length > 0) {
    lines.push(mergeLineWords(currentLine));
  }

  return lines;
}

/** Merge an array of words on the same line into a single TextBlock. */
function mergeLineWords(words: TextBlock[]): TextBlock {
  if (words.length === 1) return words[0];

  // Sort by x to ensure left-to-right order
  const sorted = [...words].sort((a, b) => a.x - b.x);

  const text = sorted.map(w => w.text).join(' ');
  const x = sorted[0].x;
  const y = Math.min(...sorted.map(w => w.y));
  const rightEdge = Math.max(...sorted.map(w => w.x + w.width));
  const width = rightEdge - x;
  const height = Math.max(...sorted.map(w => w.height));

  return { text, x, y, width, height, page: sorted[0].page };
}

/**
 * Normalize Tesseract progress events into our stage/percentage model.
 */
export function normalizeProgress(
  status: string,
  progress: number,
): { stage: OCRStage; pct: number } {
  const s = status.toLowerCase();

  if (s.includes('loading') || s.includes('initializ')) {
    return { stage: 'loading', pct: Math.round(progress * 15) };
  }

  if (s.includes('recogniz')) {
    // Map 0-1 progress to 15-85%
    return { stage: 'recognizing', pct: 15 + Math.round(progress * 70) };
  }

  return { stage: 'complete', pct: 100 };
}

// ─── Tesseract v7 Result Traversal ─────────────────

/**
 * Extract flat word list from Tesseract.js v7 result.
 *
 * v7 nests words in: Page.blocks[] → Block.paragraphs[] → Paragraph.lines[] → Line.words[]
 * Earlier versions had a flat `Page.words[]` which no longer exists.
 */
function extractWordsFromResult(data: any): TesseractWord[] {
  const words: TesseractWord[] = [];
  const blocks = data.blocks || [];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        for (const word of line.words || []) {
          words.push(word);
        }
      }
    }
  }
  return words;
}

// ─── Image Conversion ─────────────────────────────

/**
 * Convert an ImageBitmap to an OffscreenCanvas (or regular canvas fallback).
 *
 * Tesseract.js v7 does NOT support ImageBitmap in its loadImage() function.
 * Supported types: HTMLCanvasElement, OffscreenCanvas, Blob, File, string.
 * We draw the bitmap onto a canvas so tesseract can read it via toBlob().
 */
function toRecognizableImage(
  image: ImageBitmap | HTMLCanvasElement,
): HTMLCanvasElement | OffscreenCanvas {
  if (image instanceof HTMLCanvasElement) return image;

  // ImageBitmap → draw onto OffscreenCanvas (or HTMLCanvasElement fallback)
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    return canvas;
  }

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  return canvas;
}

// ─── Public API ────────────────────────────────────

/**
 * Run OCR on a single image. Returns line-grouped TextBlocks.
 *
 * @param scaleFactor - Divides pixel coordinates by this value to normalize
 *   to PDF-point space. For photos: imageWidth / 612. Default 1 (no scaling).
 */
export async function recognizeImage(
  image: ImageBitmap | HTMLCanvasElement,
  onProgress?: (stage: OCRStage, pct: number) => void,
  scaleFactor = 1,
): Promise<TextBlock[]> {
  const worker = await getWorker(onProgress);
  onProgress?.('recognizing', 15);

  const result = await worker.recognize(toRecognizableImage(image), undefined, { blocks: true });

  const wordBlocks: TextBlock[] = [];
  for (const word of extractWordsFromResult(result.data)) {
    const block = mapTesseractWordToTextBlock(word, 1, scaleFactor);
    if (block) wordBlocks.push(block);
  }

  onProgress?.('complete', 100);

  // Group words into lines (yTolerance=5 now operates in point space),
  // then normalize OCR artifacts on each line's text so findLabelBlock()
  // can match labels like "lnterest Income" → "Interest Income"
  const lines = groupWordsToLines(wordBlocks);
  return lines.map(b => ({ ...b, text: normalizeOCRText(b.text) }));
}

/**
 * Run OCR on multiple images (multi-page). Returns line-grouped TextBlocks
 * with correct page numbering (1-indexed).
 *
 * @param scaleFactor - Divides pixel coordinates by this value to normalize
 *   to PDF-point space. For 300 DPI renders: 300/72 ≈ 4.17. Default 1.
 */
export async function recognizeImages(
  images: Array<ImageBitmap | HTMLCanvasElement>,
  onProgress?: (stage: OCRStage, pct: number) => void,
  scaleFactor = 1,
): Promise<TextBlock[]> {
  const worker = await getWorker(onProgress);

  const allWordBlocks: TextBlock[] = [];

  for (let i = 0; i < images.length; i++) {
    const pageNum = i + 1; // 1-indexed to match pdfImporter convention

    onProgress?.('recognizing', 15 + Math.round((i / images.length) * 70));

    const result = await worker.recognize(toRecognizableImage(images[i]), undefined, { blocks: true });

    for (const word of extractWordsFromResult(result.data)) {
      const block = mapTesseractWordToTextBlock(word, pageNum, scaleFactor);
      if (block) allWordBlocks.push(block);
    }
  }

  onProgress?.('complete', 100);

  // Group words into lines, then normalize OCR artifacts on each line's text
  const lines = groupWordsToLines(allWordBlocks);
  return lines.map(b => ({ ...b, text: normalizeOCRText(b.text) }));
}
