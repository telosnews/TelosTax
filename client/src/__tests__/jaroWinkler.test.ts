/**
 * Jaro-Winkler String Similarity — Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { jaroWinklerSimilarity } from '../services/jaroWinkler';

describe('jaroWinklerSimilarity', () => {
  it('identical strings return 1.0', () => {
    expect(jaroWinklerSimilarity('NAVIENT', 'NAVIENT')).toBe(1.0);
    expect(jaroWinklerSimilarity('', '')).toBe(1.0);
  });

  it('completely different strings return low score', () => {
    expect(jaroWinklerSimilarity('GOOGLE', 'NAVIENT')).toBeLessThan(0.5);
    expect(jaroWinklerSimilarity('ABC', 'XYZ')).toBeLessThan(0.5);
  });

  it('empty vs non-empty returns 0', () => {
    expect(jaroWinklerSimilarity('', 'NAVIENT')).toBe(0.0);
    expect(jaroWinklerSimilarity('NAVIENT', '')).toBe(0.0);
  });

  it('single character transposition scores high', () => {
    const score = jaroWinklerSimilarity('NAVIINT', 'NAVIENT');
    expect(score).toBeGreaterThan(0.85);
  });

  it('WALGRENS matches WALGREENS with high similarity', () => {
    const score = jaroWinklerSimilarity('WALGRENS', 'WALGREENS');
    expect(score).toBeGreaterThan(0.88);
  });

  it('common merchant typo: STAPLES vs STPLES', () => {
    const score = jaroWinklerSimilarity('STPLES', 'STAPLES');
    expect(score).toBeGreaterThan(0.85);
  });

  it('similar-length different strings score low', () => {
    const score = jaroWinklerSimilarity('AMAZON', 'GOOGLE');
    expect(score).toBeLessThan(0.6);
  });

  it('prefix boost: shared prefix scores higher than shared suffix', () => {
    const prefixScore = jaroWinklerSimilarity('NAVXX', 'NAVYY');
    const suffixScore = jaroWinklerSimilarity('XXENT', 'YYENT');
    expect(prefixScore).toBeGreaterThan(suffixScore);
  });

  it('case sensitivity: function is case-sensitive', () => {
    const score = jaroWinklerSimilarity('navient', 'NAVIENT');
    // Different case chars don't match — score will be lower
    expect(score).toBeLessThan(1.0);
  });

  it('known benchmark: MARTHA vs MARHTA ≈ 0.961', () => {
    const score = jaroWinklerSimilarity('MARTHA', 'MARHTA');
    expect(score).toBeGreaterThan(0.95);
    expect(score).toBeLessThan(0.97);
  });
});
