import { describe, test, expect } from 'vitest';
import { NAICS_CODES, findNAICSByCode, searchNAICS, type NAICSEntry } from '../src/constants/naicsCodes';

describe('NAICS code constants', () => {
  test('has at least 250 entries', () => {
    expect(NAICS_CODES.length).toBeGreaterThanOrEqual(250);
  });

  test('all entries have valid 6-digit codes', () => {
    for (const entry of NAICS_CODES) {
      expect(entry.code).toMatch(/^\d{6}$/);
    }
  });

  test('all entries have non-empty descriptions', () => {
    for (const entry of NAICS_CODES) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  test('no duplicate codes', () => {
    const codes = NAICS_CODES.map((e) => e.code);
    const unique = new Set(codes);
    expect(codes.length).toBe(unique.size);
  });

  test('isSSTB is a boolean on every entry', () => {
    for (const entry of NAICS_CODES) {
      expect(typeof entry.isSSTB).toBe('boolean');
    }
  });
});

describe('SSTB classifications', () => {
  // IRC §199A(d)(2) SSTB categories
  const sstbCases: [string, boolean][] = [
    // Health care
    ['621111', true],  // Physicians
    ['621210', true],  // Dentists
    ['621310', true],  // Chiropractors
    ['621610', true],  // Home health care
    // Law
    ['541110', true],  // Lawyers
    ['541199', true],  // Other legal services
    // Accounting
    ['541211', true],  // CPAs
    ['541213', true],  // Tax prep
    // Consulting
    ['541611', true],  // Admin management consulting
    ['541613', true],  // Marketing consulting
    ['541618', true],  // Other management consulting
    // Athletics
    ['711211', true],  // Sports teams
    // Financial services / brokerage
    ['523110', true],  // Investment banking
    ['523930', true],  // Investment advice
    ['524210', true],  // Insurance agencies
    // Performing arts
    ['711130', true],  // Musical groups
    ['711510', true],  // Independent artists & performers
    // NOT SSTB
    ['541511', false], // Computer programming
    ['541512', false], // Computer systems design
    ['541330', false], // Engineering
    ['541310', false], // Architecture
    ['541430', false], // Graphic design
    ['541620', false], // Environmental consulting (NOT SSTB per Treas. Reg)
    ['541690', false], // Other scientific consulting (NOT SSTB)
    ['238210', false], // Electrical contractors
    ['722511', false], // Full-service restaurants
    ['531210', false], // Real estate agents
  ];

  test.each(sstbCases)('code %s → isSSTB=%s', (code, expected) => {
    const entry = findNAICSByCode(code);
    expect(entry).toBeDefined();
    expect(entry!.isSSTB).toBe(expected);
  });

  test('nursing care facilities (623xxx) are NOT SSTB', () => {
    const nursing = findNAICSByCode('623110');
    expect(nursing).toBeDefined();
    expect(nursing!.isSSTB).toBe(false);
  });

  test('child day care (624410) is NOT SSTB', () => {
    const daycare = findNAICSByCode('624410');
    expect(daycare).toBeDefined();
    expect(daycare!.isSSTB).toBe(false);
  });
});

describe('findNAICSByCode', () => {
  test('returns exact match', () => {
    const result = findNAICSByCode('541511');
    expect(result).toBeDefined();
    expect(result!.description).toContain('Computer Programming');
  });

  test('returns undefined for non-existent code', () => {
    expect(findNAICSByCode('000000')).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    expect(findNAICSByCode('')).toBeUndefined();
  });
});

describe('searchNAICS', () => {
  test('searches by description substring', () => {
    const results = searchNAICS('software');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.code === '511210')).toBe(true); // Software publishers
  });

  test('searches by code number', () => {
    const results = searchNAICS('541511');
    expect(results.length).toBe(1);
    expect(results[0].code).toBe('541511');
  });

  test('search is case-insensitive', () => {
    const lower = searchNAICS('plumbing');
    const upper = searchNAICS('PLUMBING');
    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBeGreaterThan(0);
  });

  test('returns empty for short queries', () => {
    expect(searchNAICS('')).toEqual([]);
    expect(searchNAICS('a')).toEqual([]);
  });

  test('returns all matches for broad queries', () => {
    // searchNAICS returns all matches — UI component handles display capping
    const results = searchNAICS('services');
    expect(results.length).toBeGreaterThan(20); // broad query, many matches
  });

  test('finds consulting codes (mix of SSTB and non-SSTB)', () => {
    const results = searchNAICS('consulting');
    const sstb = results.filter((r) => r.isSSTB);
    const nonSSTB = results.filter((r) => !r.isSSTB);
    // Management consulting is SSTB, environmental consulting is not
    expect(sstb.length).toBeGreaterThan(0);
    expect(nonSSTB.length).toBeGreaterThan(0);
  });
});
