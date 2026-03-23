/**
 * Transaction Parser — Dedup & Hash Tests
 */

import { describe, it, expect } from 'vitest';
import { parseTransactionCSV, deduplicateTransactions, transactionHash } from '../services/transactionParser';
import type { NormalizedTransaction } from '../services/deductionFinderTypes';

// ─── Helpers ─────────────────────────────────────

function makeTxn(date: string, desc: string, amount: number): NormalizedTransaction {
  return { date, description: desc, amount, originalRow: 1 };
}

// ─── Deduplication Tests ─────────────────────────

describe('transactionHash', () => {
  it('generates consistent hash for same transaction', () => {
    const txn = makeTxn('2025-01-15', 'AMAZON PURCHASE', 42.99);
    expect(transactionHash(txn)).toBe('2025-01-15|AMAZON PURCHASE|42.99');
  });

  it('uppercases description for case-insensitive matching', () => {
    const t1 = makeTxn('2025-01-15', 'Amazon Purchase', 42.99);
    const t2 = makeTxn('2025-01-15', 'AMAZON PURCHASE', 42.99);
    expect(transactionHash(t1)).toBe(transactionHash(t2));
  });

  it('different amounts produce different hashes', () => {
    const t1 = makeTxn('2025-01-15', 'STORE', 42.99);
    const t2 = makeTxn('2025-01-15', 'STORE', 43.99);
    expect(transactionHash(t1)).not.toBe(transactionHash(t2));
  });
});

describe('deduplicateTransactions', () => {
  it('removes exact duplicates', () => {
    const txns = [
      makeTxn('2025-01-15', 'AMAZON PURCHASE', 42.99),
      makeTxn('2025-01-15', 'AMAZON PURCHASE', 42.99),
      makeTxn('2025-01-16', 'STARBUCKS', 5.50),
    ];
    const { unique, duplicateCount } = deduplicateTransactions(txns);
    expect(unique).toHaveLength(2);
    expect(duplicateCount).toBe(1);
  });

  it('keeps near-duplicates with different amounts', () => {
    const txns = [
      makeTxn('2025-01-15', 'AMAZON', 42.99),
      makeTxn('2025-01-15', 'AMAZON', 43.99),
    ];
    const { unique, duplicateCount } = deduplicateTransactions(txns);
    expect(unique).toHaveLength(2);
    expect(duplicateCount).toBe(0);
  });

  it('keeps near-duplicates with different dates', () => {
    const txns = [
      makeTxn('2025-01-15', 'AMAZON', 42.99),
      makeTxn('2025-01-16', 'AMAZON', 42.99),
    ];
    const { unique, duplicateCount } = deduplicateTransactions(txns);
    expect(unique).toHaveLength(2);
    expect(duplicateCount).toBe(0);
  });

  it('returns zero duplicates for unique transactions', () => {
    const txns = [
      makeTxn('2025-01-15', 'AMAZON', 42.99),
      makeTxn('2025-01-16', 'STARBUCKS', 5.50),
    ];
    const { unique, duplicateCount } = deduplicateTransactions(txns);
    expect(unique).toHaveLength(2);
    expect(duplicateCount).toBe(0);
  });

  it('handles empty input', () => {
    const { unique, duplicateCount } = deduplicateTransactions([]);
    expect(unique).toHaveLength(0);
    expect(duplicateCount).toBe(0);
  });

  it('case-insensitive: AMAZON and amazon are duplicates', () => {
    const txns = [
      makeTxn('2025-01-15', 'AMAZON', 42.99),
      makeTxn('2025-01-15', 'amazon', 42.99),
    ];
    const { unique, duplicateCount } = deduplicateTransactions(txns);
    expect(unique).toHaveLength(1);
    expect(duplicateCount).toBe(1);
  });
});

// ─── CSV Parsing with Dedup ─────────────────────

describe('parseTransactionCSV with dedup', () => {
  it('deduplicates within a single CSV', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2025,AMAZON PURCHASE,-42.99',
      '01/15/2025,AMAZON PURCHASE,-42.99',
      '01/16/2025,STARBUCKS,-5.50',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.transactions).toHaveLength(2);
    expect(result.warnings.some((w) => w.includes('duplicate'))).toBe(true);
  });

  it('no dedup warning when no duplicates', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2025,AMAZON,-42.99',
      '01/16/2025,STARBUCKS,-5.50',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.transactions).toHaveLength(2);
    expect(result.warnings.some((w) => w.includes('duplicate'))).toBe(false);
  });
});
