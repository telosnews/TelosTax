/**
 * useDocumentImport — tests for the shared document import logic.
 *
 * Tests the isImageFile helper and file routing logic.
 * Imports directly from the hook file using vi.mock to avoid pdfjs-dist
 * browser dependency (same pattern as pdfImporter.test.ts).
 */

import { describe, it, expect, vi } from 'vitest';

// Mock all heavy dependencies that the hook imports transitively
vi.mock('../services/pdfImporter', () => ({
  extractFromPDF: vi.fn(),
  extractFromPDFWithOCR: vi.fn(),
  extractFromImage: vi.fn(),
  INCOME_DISCOVERY_KEYS: {},
}));

vi.mock('../services/duplicateDetection', () => ({
  checkForDuplicates: vi.fn(),
}));

vi.mock('../store/taxReturnStore', () => ({
  useTaxReturnStore: () => ({
    taxReturn: null,
    returnId: null,
    updateField: vi.fn(),
  }),
}));

vi.mock('../api/client', () => ({
  addIncomeItem: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Now import the hook module — mocks prevent pdfjs-dist from loading
import { isImageFile } from '../hooks/useDocumentImport';

// ═══════════════════════════════════════════════════════════════════════════════
// isImageFile helper
// ═══════════════════════════════════════════════════════════════════════════════

describe('isImageFile', () => {
  it('returns true for JPEG files', () => {
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    expect(isImageFile(file)).toBe(true);
  });

  it('returns true for PNG files', () => {
    const file = new File([''], 'scan.png', { type: 'image/png' });
    expect(isImageFile(file)).toBe(true);
  });

  it('returns true for TIFF files', () => {
    const file = new File([''], 'scan.tiff', { type: 'image/tiff' });
    expect(isImageFile(file)).toBe(true);
  });

  it('returns true for .tif extension', () => {
    const file = new File([''], 'scan.tif', { type: 'image/tiff' });
    expect(isImageFile(file)).toBe(true);
  });

  it('returns true for HEIC files', () => {
    const file = new File([''], 'IMG_1234.heic', { type: 'image/heic' });
    expect(isImageFile(file)).toBe(true);
  });

  it('returns true for HEIF files', () => {
    const file = new File([''], 'IMG_1234.heif', { type: 'image/heif' });
    expect(isImageFile(file)).toBe(true);
  });

  it('returns true for files with image/ MIME even without extension match', () => {
    const file = new File([''], 'camera-capture', { type: 'image/jpeg' });
    expect(isImageFile(file)).toBe(true);
  });

  it('returns false for PDF files', () => {
    const file = new File([''], 'form.pdf', { type: 'application/pdf' });
    expect(isImageFile(file)).toBe(false);
  });

  it('returns false for CSV files', () => {
    const file = new File([''], 'data.csv', { type: 'text/csv' });
    expect(isImageFile(file)).toBe(false);
  });

  it('returns false for files with no type and non-image extension', () => {
    const file = new File([''], 'document.pdf', { type: '' });
    expect(isImageFile(file)).toBe(false);
  });

  it('detects image by extension when MIME type is empty (iOS edge case)', () => {
    const file = new File([''], 'IMG_0001.jpeg', { type: '' });
    expect(isImageFile(file)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// File routing logic
// ═══════════════════════════════════════════════════════════════════════════════

describe('file routing', () => {
  it('image files should route to OCR confirm (not digital extraction)', () => {
    const jpegFile = new File([''], 'w2-photo.jpg', { type: 'image/jpeg' });
    expect(isImageFile(jpegFile)).toBe(true);
  });

  it('PDF files should route to digital extraction first', () => {
    const pdfFile = new File([''], 'w2-form.pdf', { type: 'application/pdf' });
    expect(isImageFile(pdfFile)).toBe(false);
  });

  it('HEIC camera files should route to OCR confirm', () => {
    const heicFile = new File([''], 'IMG_4521.HEIC', { type: 'image/heic' });
    expect(isImageFile(heicFile)).toBe(true);
  });

  it('uppercase extensions are handled', () => {
    const file = new File([''], 'photo.JPG', { type: '' });
    expect(isImageFile(file)).toBe(true);
  });
});
