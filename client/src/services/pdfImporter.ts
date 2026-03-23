/**
 * PDF Importer — extracts data from W-2 and 1099 PDFs.
 *
 * Uses Syncfusion (@syncfusion/ej2-pdf + ej2-pdf-data-extract) for:
 * - Form field reading — captures values from digitally-filled forms
 *   that traditional text extraction misses
 * - Structured text extraction — bounding boxes for proximity matching
 *
 * Uses Tesseract.js (lazy-loaded) for OCR on scanned/image PDFs.
 * Uses pdf-lib for PDF generation (unchanged).
 *
 * All processing runs client-side. Data never leaves the browser.
 *
 * LIMITATIONS:
 * - OCR accuracy on tax forms is ~60-70% — always requires user verification
 * - Accuracy depends on the PDF layout matching expected IRS patterns
 * - Always requires user review before importing
 */

import { extractWithSyncfusion } from './syncfusionExtractor';

// Re-export everything from the pure logic module so consumers can import
// from either file. Tests import directly from pdfExtractHelpers to avoid
// browser dependencies.
export {
  detectFormType,
  detectFormPages,
  extractW2Fields,
  extract1099INTFields,
  extract1099DIVFields,
  extract1099RFields,
  extract1099NECFields,
  extract1099MISCFields,
  extract1099GFields,
  extract1099BFields,
  extract1099KFields,
  extractSSA1099Fields,
  extract1099SAFields,
  extract1099QFields,
  extract1098Fields,
  extract1098TFields,
  extract1098EFields,
  extract1095AFields,
  extractK1Fields,
  extractW2GFields,
  extract1099CFields,
  extract1099SFields,
  generateImportTrace,
  FORM_TYPE_LABELS,
  INCOME_TYPE_STEP_MAP,
  INCOME_DISCOVERY_KEYS,
} from './pdfExtractHelpers';

export type {
  SupportedFormType,
  TextBlock,
  PDFExtractResult,
  ImportTrace,
  ImportTraceEntry,
  FormDetectionTrace,
  FormPageSpan,
} from './pdfExtractHelpers';

import {
  detectFormType,
  detectFormPages,
  extractW2Fields,
  extract1099INTFields,
  extract1099DIVFields,
  extract1099RFields,
  extract1099NECFields,
  extract1099MISCFields,
  extract1099GFields,
  extract1099BFields,
  extract1099KFields,
  extractSSA1099Fields,
  extract1099SAFields,
  extract1099QFields,
  extract1098Fields,
  extract1098TFields,
  extract1098EFields,
  extract1095AFields,
  extractK1Fields,
  extractW2GFields,
  extract1099CFields,
  extract1099SFields,
  generateImportTrace,
  FORM_TYPE_LABELS,
  type TextBlock,
  type PDFExtractResult,
  type FormPageSpan,
} from './pdfExtractHelpers';

export type { OCRStage } from './ocrService';

// ─── Shared Processing Logic ──────────────────────

/**
 * Process text blocks through the detection + extraction pipeline.
 * Shared by digital PDF, OCR, and image extraction paths.
 *
 * For multi-page documents, scans each page independently to skip non-IRS
 * intro/summary pages (common in TurboTax/H&R Block exports) and extract
 * only from the pages containing a supported IRS form.
 */
function processTextBlocks(
  textBlocks: TextBlock[],
  pagesScanned: number,
  meta?: { ocrUsed?: boolean },
): PDFExtractResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ocrUsed = meta?.ocrUsed ?? false;

  if (ocrUsed) {
    warnings.push('This data was extracted using OCR from a scanned document. Accuracy is limited — please carefully verify every value.');
  }

  // ── Per-page form detection for multi-page documents ──
  //
  // TurboTax and similar exports include intro/summary pages before the
  // actual IRS forms. Instead of pooling all text and hoping for the best,
  // scan each page independently and extract only from the form's pages.
  let type: ReturnType<typeof detectFormType>['type'] = null;
  let incomeType: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let matchedKeywords: string[] = [];
  let effectiveBlocks = textBlocks;
  let pageRangeInfo: {
    formPageRange?: { start: number; end: number };
    additionalForms?: Array<{ type: string; pages: string }>;
  } | undefined;

  const spans = detectFormPages(textBlocks, ocrUsed);

  if (spans.length > 0) {
    // Use the first detected form span
    const primary = spans[0];
    type = primary.type;
    incomeType = primary.incomeType;
    confidence = primary.confidence;
    matchedKeywords = primary.matchedKeywords;

    // Filter text blocks to only the primary form's pages
    effectiveBlocks = textBlocks.filter(
      b => b.page >= primary.startPage && b.page <= primary.endPage,
    );

    const skippedPages = pagesScanned - (primary.endPage - primary.startPage + 1);
    if (skippedPages > 0) {
      warnings.push(
        `Scanned ${pagesScanned} pages — found ${FORM_TYPE_LABELS[primary.type]} on ` +
        `page${primary.startPage === primary.endPage ? ` ${primary.startPage}` : `s ${primary.startPage}–${primary.endPage}`}` +
        `, skipped ${skippedPages} non-form page(s).`,
      );
    }

    // Warn about additional forms found on other pages
    if (spans.length > 1) {
      const others = spans.slice(1).map(s => {
        const label = FORM_TYPE_LABELS[s.type] || s.type;
        const pages = s.startPage === s.endPage ? `page ${s.startPage}` : `pages ${s.startPage}–${s.endPage}`;
        return `${label} (${pages})`;
      });
      warnings.push(`This PDF also contains: ${others.join(', ')}. Import each form separately for best results.`);
    }

    pageRangeInfo = {
      formPageRange: { start: primary.startPage, end: primary.endPage },
      additionalForms: spans.slice(1).map(s => ({
        type: s.type,
        pages: s.startPage === s.endPage ? `${s.startPage}` : `${s.startPage}–${s.endPage}`,
      })),
    };
  } else {
    // Single-page or no per-page match — fall back to legacy all-pages detection
    ({ type, incomeType, confidence, matchedKeywords } = detectFormType(textBlocks, ocrUsed));
  }

  // Scope raw OCR text to only the effective (form) pages for AI enhancement
  const rawOCRText = ocrUsed ? effectiveBlocks.map(b => b.text).join('\n') : undefined;

  if (!type) {
    return {
      formType: null,
      confidence: 'low',
      extractedData: {},
      incomeType: null,
      payerName: '',
      warnings,
      errors: ['Could not determine the form type. Supported forms: W-2, 1099-INT, 1099-DIV, 1099-R, 1099-NEC, 1099-MISC, 1099-G, 1099-B, 1099-K, SSA-1099, 1099-SA, 1099-Q, 1098, 1098-T, 1098-E, 1095-A, K-1, W-2G, 1099-C, 1099-S.'],
      textBlockCount: textBlocks.length,
      trace: generateImportTrace(null, 'low', matchedKeywords, {}, textBlocks.length, pagesScanned, pageRangeInfo),
      ocrUsed,
    };
  }

  if (confidence === 'low') {
    warnings.push('Low confidence in form type detection. Please verify the form type is correct.');
  }

  // Extract fields based on form type — using effectiveBlocks (scoped to form pages)
  let extractedData: Record<string, unknown> = {};
  let payerName = '';

  switch (type) {
    case 'W-2':
      extractedData = extractW2Fields(effectiveBlocks);
      payerName = (extractedData.employerName as string) || '';
      break;
    case '1099-INT':
      extractedData = extract1099INTFields(effectiveBlocks);
      payerName = (extractedData.payerName as string) || '';
      break;
    case '1099-DIV':
      extractedData = extract1099DIVFields(effectiveBlocks);
      payerName = (extractedData.payerName as string) || '';
      break;
    case '1099-R':
      extractedData = extract1099RFields(effectiveBlocks);
      payerName = (extractedData.payerName as string) || '';
      break;
    case '1099-NEC':
      extractedData = extract1099NECFields(effectiveBlocks);
      payerName = (extractedData.payerName as string) || '';
      break;
    case '1099-MISC':
      extractedData = extract1099MISCFields(effectiveBlocks);
      payerName = (extractedData.payerName as string) || '';
      break;
    case '1099-G':
      extractedData = extract1099GFields(effectiveBlocks);
      payerName = (extractedData.payerName as string) || '';
      break;
    case '1099-B':
      extractedData = extract1099BFields(effectiveBlocks);
      payerName = (extractedData.brokerName as string) || '';
      warnings.push('PDF import captures summary totals only. For individual transactions, use CSV or TXF import.');
      break;
    case '1099-K':
      extractedData = extract1099KFields(effectiveBlocks);
      payerName = (extractedData.platformName as string) || '';
      break;
    case 'SSA-1099':
      extractedData = extractSSA1099Fields(effectiveBlocks);
      payerName = 'Social Security Administration';
      break;
    case '1099-SA':
      extractedData = extract1099SAFields(effectiveBlocks);
      payerName = (extractedData.payerName as string) || '';
      break;
    case '1099-Q':
      extractedData = extract1099QFields(effectiveBlocks);
      payerName = (extractedData.payerName as string) || '';
      break;
    case '1098':
      extractedData = extract1098Fields(effectiveBlocks);
      payerName = (extractedData.lenderName as string) || '';
      break;
    case '1098-T':
      extractedData = extract1098TFields(effectiveBlocks);
      payerName = (extractedData.institutionName as string) || '';
      break;
    case '1098-E':
      extractedData = extract1098EFields(effectiveBlocks);
      payerName = (extractedData.lenderName as string) || '';
      break;
    case '1095-A':
      extractedData = extract1095AFields(effectiveBlocks);
      payerName = (extractedData.marketplaceName as string) || '';
      warnings.push('Monthly values may need manual entry. Annual totals are more reliable from OCR.');
      break;
    case 'K-1':
      extractedData = extractK1Fields(effectiveBlocks);
      payerName = (extractedData.entityName as string) || '';
      warnings.push('K-1 import captures the 10 most common boxes. Verify for additional entries.');
      break;
    case 'W-2G':
      extractedData = extractW2GFields(effectiveBlocks);
      payerName = (extractedData.payerName as string) || '';
      break;
    case '1099-C':
      extractedData = extract1099CFields(effectiveBlocks);
      payerName = (extractedData.payerName as string) || '';
      break;
    case '1099-S':
      extractedData = extract1099SFields(effectiveBlocks);
      payerName = (extractedData.settlementAgent as string) || '';
      break;
  }

  // Add warnings for missing important fields
  if (!payerName) {
    warnings.push('Could not extract payer/employer name. Please enter it manually.');
  }

  const numericFields = Object.entries(extractedData).filter(
    ([, v]) => typeof v === 'number' && v > 0,
  );
  if (numericFields.length === 0) {
    warnings.push('No numeric values were extracted. The PDF layout may not be in a recognized format.');
  }

  return {
    formType: type,
    confidence,
    extractedData,
    incomeType,
    payerName,
    warnings,
    errors,
    textBlockCount: effectiveBlocks.length,
    trace: generateImportTrace(type, confidence, matchedKeywords, extractedData, effectiveBlocks.length, pagesScanned, pageRangeInfo),
    ocrUsed,
    rawOCRText,
  };
}

// ─── Public API ────────────────────────────────────

/**
 * Extract data from a digitally-generated PDF file.
 *
 * Uses Syncfusion for both text extraction and form field reading.
 * Form field values (from employer/institution-filled W-2s and 1099s)
 * are injected as TextBlocks so the existing proximity pipeline captures
 * data that pdfjs-dist's text extraction would miss.
 *
 * Returns ocrAvailable: true when the PDF appears to be scanned.
 */
export async function extractFromPDF(file: File): Promise<PDFExtractResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);

    const { textBlocks, pagesScanned, isScanned, isPasswordProtected, formFieldsWithValues } =
      extractWithSyncfusion(pdfBytes);

    if (isPasswordProtected) {
      return {
        formType: null,
        confidence: 'low',
        extractedData: {},
        incomeType: null,
        payerName: '',
        warnings: [],
        errors: ['This PDF is password-protected. Please remove the password and try again.'],
        textBlockCount: 0,
      };
    }

    // Check for scanned/image PDF — offer OCR instead of dead-end error
    if (isScanned) {
      return {
        formType: null,
        confidence: 'low',
        extractedData: {},
        incomeType: null,
        payerName: '',
        warnings: [],
        errors: [],
        textBlockCount: textBlocks.length,
        ocrAvailable: true,
      };
    }

    const result = processTextBlocks(textBlocks, pagesScanned);

    // If Syncfusion found form field values, note it in the trace
    if (formFieldsWithValues > 0 && result.trace) {
      result.trace.formDetection.reasoning +=
        ` (${formFieldsWithValues} form field values also extracted)`;
    }

    return result;
  } catch (err: unknown) {
    const msg = (err as Error)?.message || 'Unknown error';
    return {
      formType: null,
      confidence: 'low',
      extractedData: {},
      incomeType: null,
      payerName: '',
      warnings: [],
      errors: [`Failed to read PDF: ${msg}`],
      textBlockCount: 0,
    };
  }
}

/**
 * Extract data from a scanned/image-based PDF using OCR.
 * Renders pages to canvas at 300 DPI, then runs Tesseract.js OCR.
 */
export async function extractFromPDFWithOCR(
  file: File,
  onProgress?: (stage: import('./ocrService').OCRStage, pct: number) => void,
): Promise<PDFExtractResult> {
  const canvases: HTMLCanvasElement[] = [];
  try {
    // Lazy-load OCR modules to keep them out of the main bundle
    const [{ renderPDFToImages }, { recognizeImages }] = await Promise.all([
      import('./pdfToImages'),
      import('./ocrService'),
    ]);

    const dpi = 300;
    onProgress?.('loading', 5);
    canvases.push(...await renderPDFToImages(file, 10, dpi));
    onProgress?.('loading', 10);

    // scaleFactor normalizes 300 DPI pixel coords → 72 DPI PDF-point space
    // BEFORE groupWordsToLines(), so yTolerance=5 operates in point space
    // and findNearbyNumber(maxDistance=200) searches the expected range.
    const textBlocks = await recognizeImages(canvases, onProgress, dpi / 72);

    if (textBlocks.length === 0) {
      return {
        formType: null,
        confidence: 'low',
        extractedData: {},
        incomeType: null,
        payerName: '',
        warnings: [],
        errors: ['OCR could not extract any text from this document. The image quality may be too low.'],
        textBlockCount: 0,
        ocrUsed: true,
      };
    }

    return processTextBlocks(textBlocks, canvases.length, { ocrUsed: true });
  } catch (err: any) {
    return {
      formType: null,
      confidence: 'low',
      extractedData: {},
      incomeType: null,
      payerName: '',
      warnings: [],
      errors: [`OCR failed: ${err.message || 'Unknown error'}`],
      textBlockCount: 0,
      ocrUsed: true,
    };
  } finally {
    // Release canvas pixel buffers (~33 MB each at 300 DPI)
    for (const canvas of canvases) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/**
 * Check if a file is HEIC/HEIF format (common on iPhones).
 */
function isHEIC(file: File): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  );
}

/**
 * Convert HEIC/HEIF file to JPEG blob via lazy-loaded heic2any.
 * Returns the original file as-is if not HEIC.
 */
async function ensureJPEG(file: File): Promise<Blob> {
  if (!isHEIC(file)) return file;

  try {
    const heic2any = (await import('heic2any')).default;
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    // heic2any may return a single blob or an array
    return Array.isArray(blob) ? blob[0] : blob;
  } catch {
    throw new Error(
      'Could not convert HEIC image. Please save this image as JPEG or PNG first.',
    );
  }
}

/**
 * Extract data from a photo/image file using OCR.
 * Supports .jpg, .jpeg, .png, .tiff, .heic, .heif.
 *
 * Uses createImageBitmap with imageOrientation and resizeWidth for
 * native off-thread EXIF rotation and downscaling (avoids main-thread blocking).
 */
export async function extractFromImage(
  file: File,
  onProgress?: (stage: import('./ocrService').OCRStage, pct: number) => void,
): Promise<PDFExtractResult> {
  let imageBitmap: ImageBitmap | null = null;
  try {
    // Lazy-load OCR module
    const { recognizeImage } = await import('./ocrService');

    onProgress?.('loading', 5);

    // Convert HEIC → JPEG if needed (lazy-loads heic2any only when required)
    const imageBlob = await ensureJPEG(file);

    // Create ImageBitmap with EXIF orientation auto-rotation.
    // For large photos (>2MB, likely 12MP+), also apply native off-thread downscaling
    // to 3000px to reduce memory. We use file size as a proxy for resolution to
    // avoid a double createImageBitmap call (which would decode the image twice).
    const bitmapOptions: ImageBitmapOptions = {
      imageOrientation: 'from-image',
    };
    if (imageBlob.size > 2 * 1024 * 1024) {
      (bitmapOptions as any).resizeWidth = 3000;
      (bitmapOptions as any).resizeQuality = 'high';
    }
    imageBitmap = await createImageBitmap(imageBlob, bitmapOptions);

    onProgress?.('loading', 10);

    // Normalize photo pixel coordinates to PDF-point space (letter page = 612pt wide).
    // Without this, findNearbyNumber(maxDistance=200) would search only ~40 points
    // on a 3000px-wide photo because coordinates are ~4.9× larger than expected.
    const PDF_LETTER_WIDTH = 612;
    const scaleFactor = imageBitmap.width > 0 ? imageBitmap.width / PDF_LETTER_WIDTH : 1;

    const textBlocks = await recognizeImage(imageBitmap, onProgress, scaleFactor);

    // Close bitmap immediately after OCR — free GPU/memory before processing results
    imageBitmap.close();
    imageBitmap = null;

    if (textBlocks.length === 0) {
      return {
        formType: null,
        confidence: 'low',
        extractedData: {},
        incomeType: null,
        payerName: '',
        warnings: [],
        errors: ['OCR could not extract any text from this image. Try a clearer photo with good lighting.'],
        textBlockCount: 0,
        ocrUsed: true,
      };
    }

    return processTextBlocks(textBlocks, 1, { ocrUsed: true });
  } catch (err: any) {
    return {
      formType: null,
      confidence: 'low',
      extractedData: {},
      incomeType: null,
      payerName: '',
      warnings: [],
      errors: [`OCR failed: ${err.message || 'Unknown error'}`],
      textBlockCount: 0,
      ocrUsed: true,
    };
  } finally {
    // Release ImageBitmap GPU/memory resources
    if (imageBitmap) {
      imageBitmap.close();
    }
  }
}
