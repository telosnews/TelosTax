/**
 * PDF.js Worker Initialization — shared side-effect module.
 *
 * Import this from any file that uses pdfjs-dist to ensure the worker
 * is configured before any document loading.
 *
 * Previously this lived in pdfImporter.ts as a side effect. After migrating
 * digital PDF extraction to Syncfusion, pdfjs-dist is only used for:
 * - pdfToImages.ts (canvas rendering for OCR)
 * - competitorReturnParser.ts (competitor PDF parsing)
 * - priorYearImporter.ts (prior year 1040 import)
 * - pdfTextUtils.ts (shared text extraction utilities)
 */

import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
