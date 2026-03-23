/**
 * OCR Service + Text Matching Unit Tests
 *
 * Tests the pure logic functions from ocrService.ts and ocrTextMatching.ts
 * without loading the Tesseract WASM engine.
 *
 * Functions tested:
 * - mapTesseractWordToTextBlock()  (coordinate conversion)
 * - groupWordsToLines()            (word→line merging)
 * - normalizeProgress()            (stage mapping)
 * - levenshteinDistance()           (edit distance)
 * - fuzzyIncludes()                 (tolerant matching)
 * - normalizeOCRText()              (artifact cleanup)
 */

import { describe, it, expect } from 'vitest';
import {
  mapTesseractWordToTextBlock,
  groupWordsToLines,
  normalizeProgress,
  type TesseractWord,
} from '../services/ocrService';
import {
  levenshteinDistance,
  fuzzyIncludes,
  normalizeOCRText,
} from '../services/ocrTextMatching';
import { detectFormType, type TextBlock } from '../services/pdfExtractHelpers';

// ═══════════════════════════════════════════════════════════════════════════════
// mapTesseractWordToTextBlock
// ═══════════════════════════════════════════════════════════════════════════════

describe('mapTesseractWordToTextBlock', () => {
  it('converts a valid word to TextBlock', () => {
    const word: TesseractWord = {
      text: 'Wages',
      bbox: { x0: 10, y0: 20, x1: 110, y1: 40 },
      confidence: 95,
    };

    const result = mapTesseractWordToTextBlock(word, 1);
    expect(result).toEqual({
      text: 'Wages',
      x: 10,
      y: 20,
      width: 100,
      height: 20,
      page: 1,
    });
  });

  it('returns null for empty text', () => {
    const word: TesseractWord = {
      text: '   ',
      bbox: { x0: 0, y0: 0, x1: 50, y1: 20 },
      confidence: 50,
    };
    expect(mapTesseractWordToTextBlock(word, 1)).toBeNull();
  });

  it('returns null for zero-width bounding box', () => {
    const word: TesseractWord = {
      text: 'hello',
      bbox: { x0: 100, y0: 50, x1: 100, y1: 60 },
      confidence: 80,
    };
    expect(mapTesseractWordToTextBlock(word, 1)).toBeNull();
  });

  it('trims whitespace from text', () => {
    const word: TesseractWord = {
      text: '  75000.00  ',
      bbox: { x0: 200, y0: 100, x1: 300, y1: 120 },
      confidence: 90,
    };
    const result = mapTesseractWordToTextBlock(word, 2);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('75000.00');
    expect(result!.page).toBe(2);
  });

  it('applies scaleFactor to normalize coordinates', () => {
    // Simulates 300 DPI → 72 DPI normalization (scaleFactor ≈ 4.17)
    const word: TesseractWord = {
      text: 'Wages',
      bbox: { x0: 100, y0: 200, x1: 500, y1: 280 },
      confidence: 95,
    };

    const result = mapTesseractWordToTextBlock(word, 1, 4);
    expect(result).toEqual({
      text: 'Wages',
      x: 25,
      y: 50,
      width: 100,
      height: 20,
      page: 1,
    });
  });

  it('defaults scaleFactor to 1 (no scaling)', () => {
    const word: TesseractWord = {
      text: 'Tax',
      bbox: { x0: 10, y0: 20, x1: 110, y1: 40 },
      confidence: 90,
    };

    const withDefault = mapTesseractWordToTextBlock(word, 1);
    const withExplicit = mapTesseractWordToTextBlock(word, 1, 1);
    expect(withDefault).toEqual(withExplicit);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// groupWordsToLines
// ═══════════════════════════════════════════════════════════════════════════════

describe('groupWordsToLines', () => {
  function makeWord(text: string, x: number, y: number, page = 1): TextBlock {
    return { text, x, y, width: text.length * 8, height: 12, page };
  }

  it('merges words on the same Y coordinate into a single line', () => {
    const words: TextBlock[] = [
      makeWord('wages,', 30, 100),
      makeWord('tips', 90, 100),
    ];

    const lines = groupWordsToLines(words);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('wages, tips');
    expect(lines[0].x).toBe(30);
    expect(lines[0].y).toBe(100);
  });

  it('splits words on different Y coordinates into separate lines', () => {
    const words: TextBlock[] = [
      makeWord('Employer', 30, 100),
      makeWord('Wages', 30, 200),
    ];

    const lines = groupWordsToLines(words);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('Employer');
    expect(lines[1].text).toBe('Wages');
  });

  it('groups words within yTolerance', () => {
    // Default tolerance is 5px
    const words: TextBlock[] = [
      makeWord('Federal', 30, 100),
      makeWord('income', 100, 103), // 3px difference — within tolerance
      makeWord('tax', 170, 101),    // 1px difference — within tolerance
    ];

    const lines = groupWordsToLines(words);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Federal income tax');
  });

  it('respects custom yTolerance', () => {
    const words: TextBlock[] = [
      makeWord('Federal', 30, 100),
      makeWord('income', 100, 103),
    ];

    // With very tight tolerance, these should be separate lines
    const lines = groupWordsToLines(words, 1);
    expect(lines).toHaveLength(2);
  });

  it('handles empty input', () => {
    expect(groupWordsToLines([])).toEqual([]);
  });

  it('groups words by page', () => {
    const words: TextBlock[] = [
      makeWord('Page1Word', 30, 100, 1),
      makeWord('Page2Word', 30, 100, 2),
    ];

    const lines = groupWordsToLines(words);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('Page1Word');
    expect(lines[0].page).toBe(1);
    expect(lines[1].text).toBe('Page2Word');
    expect(lines[1].page).toBe(2);
  });

  it('preserves left-to-right order when merging', () => {
    const words: TextBlock[] = [
      makeWord('tips', 120, 100),
      makeWord('wages,', 30, 100),  // Added second but has smaller x
    ];

    const lines = groupWordsToLines(words);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('wages, tips'); // Should be sorted by x
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// normalizeProgress
// ═══════════════════════════════════════════════════════════════════════════════

describe('normalizeProgress', () => {
  it('maps loading status to loading stage', () => {
    const result = normalizeProgress('loading tesseract core', 0.5);
    expect(result.stage).toBe('loading');
    expect(result.pct).toBe(8); // Math.round(0.5 * 15) = 8
  });

  it('maps initializing status to loading stage', () => {
    const result = normalizeProgress('initializing api', 1.0);
    expect(result.stage).toBe('loading');
    expect(result.pct).toBe(15);
  });

  it('maps recognizing text to recognizing stage', () => {
    const result = normalizeProgress('recognizing text', 0.5);
    expect(result.stage).toBe('recognizing');
    expect(result.pct).toBe(50); // 15 + Math.round(0.5 * 70) = 50
  });

  it('maps unknown status to complete', () => {
    const result = normalizeProgress('done', 1);
    expect(result.stage).toBe('complete');
    expect(result.pct).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// levenshteinDistance
// ═══════════════════════════════════════════════════════════════════════════════

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('returns correct distance for single substitution', () => {
    expect(levenshteinDistance('kitten', 'sitten')).toBe(1);
  });

  it('returns correct distance for single insertion', () => {
    expect(levenshteinDistance('cat', 'cats')).toBe(1);
  });

  it('returns correct distance for single deletion', () => {
    expect(levenshteinDistance('cats', 'cat')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('handles realistic OCR typo: 1099-NFC → 1099-NEC', () => {
    expect(levenshteinDistance('1099-NFC', '1099-NEC')).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// fuzzyIncludes
// ═══════════════════════════════════════════════════════════════════════════════

describe('fuzzyIncludes', () => {
  it('returns true for exact substring match', () => {
    expect(fuzzyIncludes('this is a W-2 form', 'W-2')).toBe(true);
  });

  it('returns true for 1-character typo within threshold', () => {
    expect(fuzzyIncludes('form 1099-NFC received', '1099-NEC')).toBe(true);
  });

  it('returns true for 2-character typo within default threshold', () => {
    expect(fuzzyIncludes('Forrn 1099-NFC', '1099-NEC')).toBe(true);
  });

  it('returns false when distance exceeds threshold', () => {
    // "1099-XYZ" vs "1099-NEC" — distance 3 (exceeds default maxDistance=2)
    expect(fuzzyIncludes('form 1099-XYZ', '1099-NEC')).toBe(false);
  });

  it('returns false for very short needles with no exact match', () => {
    // Short needles (≤3 chars) require exact match to avoid false positives
    expect(fuzzyIncludes('abcdef', 'xyz')).toBe(false);
  });

  it('returns true for short needles with exact match', () => {
    expect(fuzzyIncludes('form W-2', 'W-2')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(fuzzyIncludes('FORM W-2', 'form w-2')).toBe(true);
  });

  it('handles empty inputs', () => {
    expect(fuzzyIncludes('', 'test')).toBe(false);
    expect(fuzzyIncludes('test', '')).toBe(false);
  });

  it('matches "wages, t1ps" against "wages, tips"', () => {
    expect(fuzzyIncludes('wages, t1ps and other', 'wages, tips')).toBe(true);
  });

  it('handles 2-char insertion in haystack (window larger than needle)', () => {
    // "1099-NECC" in haystack has an extra char vs "1099-NEC" — distance 1 with +1 window
    expect(fuzzyIncludes('form 1099-NECC received', '1099-NEC')).toBe(true);
  });

  it('handles 2-char deletion in haystack (window smaller than needle)', () => {
    // "1099-NE" vs "1099-NEC" — distance 1 with -1 window
    expect(fuzzyIncludes('form 1099-NE received', '1099-NEC')).toBe(true);
  });

  it('rejects when adjusted tolerance is exceeded for large window deltas', () => {
    // With maxDistance=2 and delta=2, adjustedMax = 0 — must be exact match at that window size
    // "1099-XXXYZ" (window +2) is distance 3 from "1099-NEC" — should fail even at +2 window
    expect(fuzzyIncludes('form 1099-XXXYZ here', '1099-NEC')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// normalizeOCRText
// ═══════════════════════════════════════════════════════════════════════════════

describe('normalizeOCRText', () => {
  it('normalizes Unicode dashes to ASCII hyphen', () => {
    // \u2013 is en-dash, \u2014 is em-dash
    expect(normalizeOCRText('1099\u2013INT')).toBe('1099-INT');
    expect(normalizeOCRText('1099\u2014NEC')).toBe('1099-NEC');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeOCRText('Form   W-2    Statement')).toBe('Form W-2 Statement');
  });

  it('fixes common OCR misreads', () => {
    expect(normalizeOCRText('Forrn W-2')).toBe('Form W-2');
    expect(normalizeOCRText('Fonn W-2')).toBe('Form W-2');
    expect(normalizeOCRText('lnterest Income')).toBe('Interest Income');
    expect(normalizeOCRText('Dlvidends')).toBe('Dividends');
  });

  it('normalizes Unicode quotes', () => {
    expect(normalizeOCRText('\u201CHello\u201D')).toBe('"Hello"');
    expect(normalizeOCRText('\u2018test\u2019')).toBe("'test'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// detectFormType with ocrMode (integration test)
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectFormType with ocrMode', () => {
  function makeBlocks(texts: string[]): TextBlock[] {
    return texts.map((text, i) => ({
      text,
      x: 0,
      y: i * 20,
      width: text.length * 8,
      height: 14,
      page: 1,
    }));
  }

  it('detects W-2 with OCR typos using fuzzy matching', () => {
    // "Forrn W-2" would be normalized to "Form W-2" by normalizeOCRText
    // "wage and tax statemnet" is 1 edit from "wage and tax statement"
    const blocks = makeBlocks([
      'Forrn W-2',
      'wage and tax statemnet',
      'employer name',
      'federal income tax withheld',
      'social security wages',
    ]);

    const result = detectFormType(blocks, true);
    expect(result.type).toBe('W-2');
    expect(result.confidence).toBe('low'); // OCR always caps at 'low'
  });

  it('detects 1099-NEC with OCR typo "1099-NFC"', () => {
    const blocks = makeBlocks([
      'Forrn 1099-NFC',
      'nonemployee compensation',
      'payer information',
      'recipient name',
    ]);

    const result = detectFormType(blocks, true);
    expect(result.type).toBe('1099-NEC');
    expect(result.confidence).toBe('low');
  });

  it('digital PDF path is unchanged when ocrMode is false', () => {
    const blocks = makeBlocks([
      'Form W-2',
      'wage and tax statement',
      'employer',
      'federal income tax withheld',
      'social security',
    ]);

    const result = detectFormType(blocks, false);
    expect(result.type).toBe('W-2');
    expect(result.confidence).toBe('high'); // Digital gets high confidence
  });

  it('digital PDF path is unchanged when ocrMode is undefined', () => {
    const blocks = makeBlocks([
      'Form 1099-INT',
      'interest income',
      'payer name',
      'interest amount',
    ]);

    const result = detectFormType(blocks);
    expect(result.type).toBe('1099-INT');
    expect(result.confidence).toBe('high');
  });
});
