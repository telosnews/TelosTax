/**
 * MCC Tax Map — Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { lookupMCC, extractMCCFromDescription, MCC_TAX_MAP } from '../services/mccTaxMap';

describe('lookupMCC', () => {
  it('returns entry for known pharmacy MCC', () => {
    const entry = lookupMCC('5912');
    expect(entry).toBeDefined();
    expect(entry!.description).toBe('Drug Stores and Pharmacies');
    expect(entry!.taxCategories).toContain('medical');
    expect(entry!.confidenceBoost).toBe(0.25);
  });

  it('returns entry for known hospital MCC', () => {
    const entry = lookupMCC('8062');
    expect(entry).toBeDefined();
    expect(entry!.taxCategories).toContain('medical');
    expect(entry!.confidenceBoost).toBe(0.3);
  });

  it('returns entry for child care MCC', () => {
    const entry = lookupMCC('8351');
    expect(entry).toBeDefined();
    expect(entry!.taxCategories).toContain('childcare');
  });

  it('returns entry for charitable organizations MCC', () => {
    const entry = lookupMCC('8398');
    expect(entry).toBeDefined();
    expect(entry!.taxCategories).toContain('charitable');
  });

  it('returns entry for tax preparation MCC', () => {
    const entry = lookupMCC('7276');
    expect(entry).toBeDefined();
    expect(entry!.taxCategories).toContain('tax_prep');
  });

  it('returns undefined for unknown MCC', () => {
    expect(lookupMCC('9999')).toBeUndefined();
    expect(lookupMCC('')).toBeUndefined();
    expect(lookupMCC('0000')).toBeUndefined();
  });

  it('looks up airline MCC in range 3000-3299', () => {
    const entry = lookupMCC('3021'); // United Airlines
    expect(entry).toBeDefined();
    expect(entry!.taxCategories).toContain('business_travel');
  });

  it('looks up hotel MCC in range 3501-3999', () => {
    const entry = lookupMCC('3509'); // Hilton
    expect(entry).toBeDefined();
    expect(entry!.taxCategories).toContain('business_travel');
  });

  it('does not match code outside ranges', () => {
    expect(lookupMCC('3300')).toBeUndefined(); // just past airline range
    expect(lookupMCC('3500')).toBeUndefined(); // just before hotel range
    expect(lookupMCC('4000')).toBeUndefined(); // just past hotel range
  });

  it('all entries have valid structure', () => {
    for (const [code, entry] of Object.entries(MCC_TAX_MAP)) {
      expect(code).toMatch(/^\d{4}$/);
      expect(entry.description).toBeTruthy();
      expect(entry.taxCategories.length).toBeGreaterThan(0);
      expect(entry.confidenceBoost).toBeGreaterThan(0);
      expect(entry.confidenceBoost).toBeLessThanOrEqual(1);
    }
  });
});

describe('extractMCCFromDescription', () => {
  it('extracts MCC with colon format', () => {
    expect(extractMCCFromDescription('WALGREENS MCC:5912 STORE 1234')).toBe('5912');
  });

  it('extracts MCC with space format', () => {
    expect(extractMCCFromDescription('WALGREENS MCC 5912 STORE 1234')).toBe('5912');
  });

  it('extracts MCC with colon-space format', () => {
    expect(extractMCCFromDescription('PURCHASE MCC: 5912')).toBe('5912');
  });

  it('is case insensitive', () => {
    expect(extractMCCFromDescription('walgreens mcc:5912')).toBe('5912');
    expect(extractMCCFromDescription('WALGREENS Mcc 5912')).toBe('5912');
  });

  it('returns undefined when no MCC present', () => {
    expect(extractMCCFromDescription('WALGREENS STORE 1234')).toBeUndefined();
    expect(extractMCCFromDescription('')).toBeUndefined();
  });

  it('does not match partial numbers', () => {
    // 5 digits — \b after 4th digit fails because 5th digit is not a boundary
    expect(extractMCCFromDescription('MCC:59123')).toBeUndefined();
    // 3 digits — too short
    expect(extractMCCFromDescription('MCC:591')).toBeUndefined();
  });
});
