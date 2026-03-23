import { describe, it, expect } from 'vitest';
import { migrateReturn, needsMigration, CURRENT_SCHEMA_VERSION } from '../src/migrations/index.js';

describe('Schema Migration System', () => {
  describe('needsMigration', () => {
    it('returns true for objects with no schemaVersion', () => {
      expect(needsMigration({ id: 'test-1' })).toBe(true);
    });

    it('returns true for objects with old schemaVersion', () => {
      expect(needsMigration({ id: 'test-1', schemaVersion: 0 })).toBe(true);
    });

    it('returns false for objects at current version', () => {
      expect(needsMigration({ id: 'test-1', schemaVersion: CURRENT_SCHEMA_VERSION })).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(needsMigration(null)).toBe(false);
      expect(needsMigration(undefined)).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(needsMigration('string')).toBe(false);
      expect(needsMigration(42)).toBe(false);
    });
  });

  describe('migrateReturn', () => {
    it('returns null for null/undefined input', () => {
      expect(migrateReturn(null)).toBeNull();
      expect(migrateReturn(undefined)).toBeNull();
    });

    it('returns null for non-object input', () => {
      expect(migrateReturn('not an object')).toBeNull();
    });

    it('returns object unchanged if already at current version', () => {
      const data = { id: 'test-1', schemaVersion: CURRENT_SCHEMA_VERSION, taxYear: 2025 };
      const result = migrateReturn(data);
      expect(result).toBe(data); // same reference
      expect(result!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('v1 migration', () => {
    it('upgrades a v0 (no schemaVersion) return to v1', () => {
      const legacy = {
        id: 'legacy-return',
        taxYear: 2025,
        status: 'in_progress',
        firstName: 'Jane',
        // Missing many array fields that createReturn() normally initializes
      };

      const result = migrateReturn(legacy)!;
      expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('backfills all required array fields', () => {
      const legacy = { id: 'test-1', taxYear: 2025 };
      const result = migrateReturn(legacy)!;

      // All required arrays should exist and be empty
      expect(result.dependents).toEqual([]);
      expect(result.w2Income).toEqual([]);
      expect(result.income1099NEC).toEqual([]);
      expect(result.income1099K).toEqual([]);
      expect(result.income1099INT).toEqual([]);
      expect(result.income1099DIV).toEqual([]);
      expect(result.income1099R).toEqual([]);
      expect(result.income1099G).toEqual([]);
      expect(result.income1099MISC).toEqual([]);
      expect(result.income1099B).toEqual([]);
      expect(result.rentalProperties).toEqual([]);
      expect(result.incomeK1).toEqual([]);
      expect(result.income1099SA).toEqual([]);
      expect(result.incomeW2G).toEqual([]);
      expect(result.income1099DA).toEqual([]);
      expect(result.income1099C).toEqual([]);
      expect(result.income1099Q).toEqual([]);
      expect(result.businesses).toEqual([]);
      expect(result.expenses).toEqual([]);
      expect(result.educationCredits).toEqual([]);
    });

    it('backfills scalar defaults', () => {
      const legacy = { id: 'test-1' };
      const result = migrateReturn(legacy)!;

      expect(result.otherIncome).toBe(0);
      expect(result.deductionMethod).toBe('standard');
      expect(result.incomeDiscovery).toEqual({});
    });

    it('preserves existing data during migration', () => {
      const legacy = {
        id: 'test-1',
        taxYear: 2025,
        firstName: 'Jane',
        lastName: 'Doe',
        w2Income: [{ id: 'w2-1', employer: 'Acme', wages: 95000 }],
        deductionMethod: 'itemized',
        otherIncome: 500,
      };

      const result = migrateReturn(legacy)!;

      // Original data preserved
      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Doe');
      expect(result.w2Income).toHaveLength(1);
      expect((result.w2Income as any[])[0].employer).toBe('Acme');
      expect(result.deductionMethod).toBe('itemized'); // Not overwritten
      expect(result.otherIncome).toBe(500); // Not overwritten

      // Missing fields backfilled
      expect(result.income1099NEC).toEqual([]);
      expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('does not re-migrate an already-current return', () => {
      const data = {
        id: 'test-1',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        taxYear: 2025,
        w2Income: [{ id: 'w2-1', wages: 50000 }],
      };

      const result = migrateReturn(data)!;
      expect(result).toBe(data); // Same reference — no work done
    });
  });

  describe('v3 migration: estimatedQuarterlyPayments', () => {
    it('distributes estimatedPaymentsMade evenly across 4 quarters', () => {
      const data = {
        id: 'test-v3-1',
        schemaVersion: 2,
        estimatedPaymentsMade: 4000,
        w2Income: [],
        income1099NEC: [],
        income1099K: [],
        income1099INT: [],
        income1099DIV: [],
        income1099R: [],
        income1099G: [],
        income1099MISC: [],
        income1099B: [],
        rentalProperties: [],
        incomeK1: [],
        income1099SA: [],
        incomeW2G: [],
        income1099DA: [],
        income1099C: [],
        income1099Q: [],
        dependents: [],
        businesses: [],
        expenses: [],
        educationCredits: [],
        otherIncome: 0,
        deductionMethod: 'standard',
        incomeDiscovery: {},
      };

      const result = migrateReturn(data)!;
      expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.estimatedQuarterlyPayments).toEqual([1000, 1000, 1000, 1000]);
      // Original total preserved
      expect(result.estimatedPaymentsMade).toBe(4000);
    });

    it('handles odd-cent amounts with rounding remainder in Q1', () => {
      const data = {
        id: 'test-v3-2',
        schemaVersion: 2,
        estimatedPaymentsMade: 1001,
        w2Income: [], income1099NEC: [], income1099K: [], income1099INT: [],
        income1099DIV: [], income1099R: [], income1099G: [], income1099MISC: [],
        income1099B: [], rentalProperties: [], incomeK1: [], income1099SA: [],
        incomeW2G: [], income1099DA: [], income1099C: [], income1099Q: [],
        dependents: [], businesses: [], expenses: [], educationCredits: [],
        otherIncome: 0, deductionMethod: 'standard', incomeDiscovery: {},
      };

      const result = migrateReturn(data)!;
      const quarters = result.estimatedQuarterlyPayments as number[];
      expect(quarters).toHaveLength(4);
      // Sum should be close to original (within rounding)
      const sum = quarters.reduce((s: number, q: number) => s + q, 0);
      expect(Math.abs(sum - 1001)).toBeLessThan(0.02);
    });

    it('does not create quarterly array when no estimated payments', () => {
      const data = {
        id: 'test-v3-3',
        schemaVersion: 2,
        w2Income: [], income1099NEC: [], income1099K: [], income1099INT: [],
        income1099DIV: [], income1099R: [], income1099G: [], income1099MISC: [],
        income1099B: [], rentalProperties: [], incomeK1: [], income1099SA: [],
        incomeW2G: [], income1099DA: [], income1099C: [], income1099Q: [],
        dependents: [], businesses: [], expenses: [], educationCredits: [],
        otherIncome: 0, deductionMethod: 'standard', incomeDiscovery: {},
      };

      const result = migrateReturn(data)!;
      expect(result.estimatedQuarterlyPayments).toBeUndefined();
    });

    it('does not overwrite existing quarterly array', () => {
      const data = {
        id: 'test-v3-4',
        schemaVersion: 2,
        estimatedPaymentsMade: 4000,
        estimatedQuarterlyPayments: [500, 1000, 1500, 1000],
        w2Income: [], income1099NEC: [], income1099K: [], income1099INT: [],
        income1099DIV: [], income1099R: [], income1099G: [], income1099MISC: [],
        income1099B: [], rentalProperties: [], incomeK1: [], income1099SA: [],
        incomeW2G: [], income1099DA: [], income1099C: [], income1099Q: [],
        dependents: [], businesses: [], expenses: [], educationCredits: [],
        otherIncome: 0, deductionMethod: 'standard', incomeDiscovery: {},
      };

      const result = migrateReturn(data)!;
      // Should preserve existing quarterly array, not redistribute
      expect(result.estimatedQuarterlyPayments).toEqual([500, 1000, 1500, 1000]);
    });

    it('does not create quarterly array when estimatedPaymentsMade is 0', () => {
      const data = {
        id: 'test-v3-5',
        schemaVersion: 2,
        estimatedPaymentsMade: 0,
        w2Income: [], income1099NEC: [], income1099K: [], income1099INT: [],
        income1099DIV: [], income1099R: [], income1099G: [], income1099MISC: [],
        income1099B: [], rentalProperties: [], incomeK1: [], income1099SA: [],
        incomeW2G: [], income1099DA: [], income1099C: [], income1099Q: [],
        dependents: [], businesses: [], expenses: [], educationCredits: [],
        otherIncome: 0, deductionMethod: 'standard', incomeDiscovery: {},
      };

      const result = migrateReturn(data)!;
      expect(result.estimatedQuarterlyPayments).toBeUndefined();
    });
  });

  describe('CURRENT_SCHEMA_VERSION', () => {
    it('is a positive integer', () => {
      expect(CURRENT_SCHEMA_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true);
    });
  });
});
