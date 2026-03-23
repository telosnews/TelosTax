/**
 * PDF to Images — renders scanned PDF pages to canvas for OCR processing.
 *
 * Uses pdfjs-dist (Mozilla PDF.js) to render each page at 300 DPI
 * for optimal Tesseract.js OCR accuracy.
 *
 * This is the only remaining pdfjs-dist consumer in the import pipeline —
 * digital text extraction has moved to Syncfusion (see syncfusionExtractor.ts).
 * pdfjs-dist is kept here because it provides canvas rendering that
 * Syncfusion's extraction APIs don't support.
 *
 * All processing runs client-side. Data never leaves the browser.
 */

import * as pdfjsLib from 'pdfjs-dist';
import './pdfWorkerInit'; // Ensure worker is configured before any document loading

/**
 * Render PDF pages to canvas elements at the specified DPI.
 *
 * @param file - The PDF file to render
 * @param maxPages - Maximum number of pages to render (default: 3)
 * @param dpi - Target DPI for rendering (default: 300)
 * @returns Array of HTMLCanvasElement, one per page
 */
export async function renderPDFToImages(
  file: File,
  maxPages = 10,
  dpi = 300,
): Promise<HTMLCanvasElement[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  try {
    const pagesToRender = Math.min(pdf.numPages, maxPages);
    const scaleFactor = dpi / 72; // PDF default is 72 DPI

    const canvases: HTMLCanvasElement[] = [];

    for (let i = 1; i <= pagesToRender; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: scaleFactor });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error(`Failed to get 2D context for page ${i}`);
      }

      // pdfjs-dist v5: `canvas` is the recommended param; `canvasContext` is deprecated
      await page.render({ canvas, viewport }).promise;
      canvases.push(canvas);
    }

    return canvases;
  } finally {
    // Release PDF.js worker memory — without this, PDFDocumentProxy leaks
    await pdf.destroy().catch(() => {});
  }
}
