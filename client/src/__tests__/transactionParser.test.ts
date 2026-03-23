/**
 * Transaction Parser — Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { parseTransactionCSV } from '../services/transactionParser';

describe('parseTransactionCSV', () => {
  it('detects Chase format and parses correctly', () => {
    const csv = [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '01/15/2025,01/16/2025,NAVIENT STUDENT LN PYMT,Education,Sale,-300.00,',
      '01/20/2025,01/21/2025,GROCERY STORE,Food & Drink,Sale,-52.34,',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.detectedFormat).toBe('Chase');
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].description).toBe('NAVIENT STUDENT LN PYMT');
    expect(result.transactions[0].amount).toBe(300); // Flipped from -300
    expect(result.transactions[0].date).toBe('2025-01-15');
  });

  it('detects Bank of America format', () => {
    const csv = [
      'Date,Description,Amount,Running Bal.',
      '01/15/2025,GOODWILL DONATION,-25.00,1500.00',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    // BofA matches on date/description/amount — generic or BofA
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('GOODWILL DONATION');
    expect(result.transactions[0].amount).toBe(25);
  });

  it('detects Citi format with separate debit/credit columns', () => {
    const csv = [
      'Status,Date,Description,Debit,Credit',
      'Cleared,01/15/2025,WALGREENS PHARMACY RX,45.00,',
      'Cleared,01/20/2025,PAYMENT - THANK YOU,,500.00',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.detectedFormat).toBe('Citi');
    expect(result.transactions).toHaveLength(2);
    // Debit row: positive_is_debit → amount stays positive
    expect(result.transactions[0].amount).toBe(45);
    expect(result.transactions[0].description).toBe('WALGREENS PHARMACY RX');
    // Credit row: debit is empty, uses credit column → negative amount (refund)
    expect(result.transactions[1].amount).toBe(-500);
    expect(result.transactions[1].description).toBe('PAYMENT - THANK YOU');
  });

  it('falls back to generic format with column aliases', () => {
    const csv = [
      'Trans Date,Memo,Withdrawal',
      '01/15/2025,HSA BANK CONTRIBUTION,200.00',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.detectedFormat).toBe('Generic');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('HSA BANK CONTRIBUTION');
  });

  it('normalizes dates in various formats', () => {
    const csv = [
      'Date,Description,Amount',
      '2025-01-15,TXN ONE,-10.00',
      '1/5/25,TXN TWO,-20.00',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.transactions[0].date).toBe('2025-01-15');
    expect(result.transactions[1].date).toBe('2025-01-05');
  });

  it('handles currency formatting in amounts', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2025,TXN A,"-$1,234.56"',
      '01/16/2025,TXN B,-$50.00',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.transactions[0].amount).toBe(1234.56);
    expect(result.transactions[1].amount).toBe(50);
  });

  it('keeps rows with description but missing date, skips rows with no description', () => {
    const csv = [
      'Date,Description,Amount',
      ',MISSING DATE,-10.00',
      '01/15/2025,,-20.00',
      '01/15/2025,VALID TXN,-30.00',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    // "MISSING DATE" is kept (has description), empty description is skipped
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].description).toBe('MISSING DATE');
    expect(result.transactions[1].description).toBe('VALID TXN');
    expect(result.warnings.some((w) => w.includes('Skipped'))).toBe(true);
  });

  it('returns empty for no data rows', () => {
    const csv = 'Date,Description,Amount\n';
    const result = parseTransactionCSV(csv);
    expect(result.transactions).toHaveLength(0);
  });

  it('returns warning for unrecognizable format', () => {
    const csv = [
      'FooColumn,BarColumn,BazColumn',
      'abc,def,ghi',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.detectedFormat).toBe('unknown');
    expect(result.transactions).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('Could not detect'))).toBe(true);
  });

  it('sanitizes CSV injection characters but preserves hyphens', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2025,=CMD()|EVIL,-10.00',
      '01/16/2025,-AUTOPAY NAVIENT,-300.00',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.transactions).toHaveLength(2);
    // Leading = should be stripped
    expect(result.transactions[0].description).toBe('CMD()|EVIL');
    // Leading hyphen preserved (legitimate bank description)
    expect(result.transactions[1].description).toBe('-AUTOPAY NAVIENT');
  });

  it('strips BOM from CSV content', () => {
    const csv = '\uFEFFDate,Description,Amount\n01/15/2025,TEST TXN,-10.00';
    const result = parseTransactionCSV(csv);
    expect(result.transactions).toHaveLength(1);
  });

  it('tracks original row numbers correctly', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2025,TXN ONE,-10.00',
      '01/16/2025,TXN TWO,-20.00',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.transactions[0].originalRow).toBe(2); // Row 2 (1-indexed + header)
    expect(result.transactions[1].originalRow).toBe(3);
  });

  // ── Phase 1: Bank Signature Collision Fix ─────────

  it('detects Amex by unique headers, not misidentified as BofA', () => {
    const csv = [
      'Date,Description,Card Member,Amount,Extended Details,Account #',
      '01/15/2025,AMAZON MARKETPLACE,JOHN DOE,52.34,ONLINE PURCHASE,XXXX-XXXXXX-91234',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.detectedFormat).toBe('American Express');
    // Amex uses positive_is_debit, so 52.34 stays positive
    expect(result.transactions[0].amount).toBe(52.34);
  });

  it('detects Wells Fargo by unique headers', () => {
    const csv = [
      'Date,Description,Amount,Check Number',
      '01/15/2025,MORTGAGE PAYMENT,-1500.00,',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.detectedFormat).toBe('Wells Fargo');
    // Wells Fargo uses negative_is_debit, so -1500 flips to +1500
    expect(result.transactions[0].amount).toBe(1500);
  });

  it('falls back to BofA when no unique headers match', () => {
    // Generic date/description/amount with no Amex or Wells Fargo unique headers
    const csv = [
      'Date,Description,Amount,Running Bal.',
      '01/15/2025,GROCERY STORE,-50.00,1500.00',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.detectedFormat).toBe('Bank of America');
  });

  // ── Phase 2: MCC Column Support ────────────────

  it('parses MCC column from Amex CSV', () => {
    const csv = [
      'Date,Description,Card Member,Amount,Extended Details,Account #,MCC',
      '01/15/2025,CVS PHARMACY,JOHN DOE,45.00,PRESCRIPTION,XXXX-XXXXXX-91234,5912',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.detectedFormat).toBe('American Express');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].mccCode).toBe('5912');
    expect(result.transactions[0].description).toBe('CVS PHARMACY');
  });

  it('parses MCC column from generic CSV with alias', () => {
    // Use "Trans Date" (not "Date") so it falls through bank signatures to generic
    const csv = [
      'Trans Date,Memo,Withdrawal,Merchant Category Code',
      '01/15/2025,WALGREENS RX,25.00,5912',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.detectedFormat).toBe('Generic');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].mccCode).toBe('5912');
  });

  it('omits mccCode when MCC column is empty', () => {
    const csv = [
      'Date,Description,Card Member,Amount,Extended Details,Account #,MCC',
      '01/15/2025,GROCERY STORE,JOHN DOE,52.00,PURCHASE,XXXX-XXXXXX-91234,',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].mccCode).toBeUndefined();
  });

  it('omits mccCode when no MCC column exists', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2025,SOME PURCHASE,-10.00',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].mccCode).toBeUndefined();
  });

  it('rejects malformed MCC codes (non-4-digit)', () => {
    const csv = [
      'Date,Description,Card Member,Amount,Extended Details,Account #,MCC',
      '01/15/2025,CVS PHARMACY,JOHN DOE,45.00,RX,XXXX-XXXXXX-91234,ABCD',
      '01/16/2025,WALGREENS,JOHN DOE,20.00,RX,XXXX-XXXXXX-91234,59123',
      '01/17/2025,RITE AID,JOHN DOE,10.00,RX,XXXX-XXXXXX-91234,591',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.transactions).toHaveLength(3);
    // All malformed — no valid 4-digit MCC
    expect(result.transactions[0].mccCode).toBeUndefined();
    expect(result.transactions[1].mccCode).toBeUndefined();
    expect(result.transactions[2].mccCode).toBeUndefined();
  });

  it('extracts MCC from description when no MCC column', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2025,CVS PHARMACY MCC:5912 STORE 1234,-45.00',
    ].join('\n');

    const result = parseTransactionCSV(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].mccCode).toBe('5912');
  });

  it('returns empty result for empty string input', () => {
    const result = parseTransactionCSV('');
    expect(result.transactions).toHaveLength(0);
    expect(result.detectedFormat).toBe('empty');
  });
});
