/**
 * CSV Parser Unit Tests
 *
 * Tests broker format detection, column mapping, date/currency parsing,
 * row validation, and full integration parsing.
 */

import { describe, it, expect } from 'vitest';
import { parseCurrencyString, parseDateString, parseHoldingPeriod, inferHoldingPeriod } from '../services/importHelpers';
import { detectBrokerFormat, autoDetectColumnMapping, parseCSV, mapRowToIncome1099B, mapRowToIncome1099DA } from '../services/csvParser';

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseCurrencyString', () => {
  it('parses standard dollar amounts', () => {
    expect(parseCurrencyString('$1,234.56')).toBe(1234.56);
    expect(parseCurrencyString('1234.56')).toBe(1234.56);
    expect(parseCurrencyString('$0.00')).toBe(0);
  });

  it('handles negative amounts with parentheses', () => {
    expect(parseCurrencyString('($500.00)')).toBe(-500);
    expect(parseCurrencyString('(1,234.56)')).toBe(-1234.56);
  });

  it('handles negative amounts with minus sign', () => {
    expect(parseCurrencyString('-$500.00')).toBe(-500);
    expect(parseCurrencyString('-1234')).toBe(-1234);
  });

  it('handles blank/null/undefined', () => {
    expect(parseCurrencyString('')).toBe(0);
    expect(parseCurrencyString(null)).toBe(0);
    expect(parseCurrencyString(undefined)).toBe(0);
    expect(parseCurrencyString('$')).toBe(0);
  });

  it('handles whole numbers', () => {
    expect(parseCurrencyString('50000')).toBe(50000);
    expect(parseCurrencyString('$50,000')).toBe(50000);
  });

  it('rounds to 2 decimal places', () => {
    expect(parseCurrencyString('1234.567')).toBe(1234.57);
  });

  it('returns 0 for non-numeric strings', () => {
    expect(parseCurrencyString('abc')).toBe(0);
    expect(parseCurrencyString('N/A')).toBe(0);
  });
});

describe('parseDateString', () => {
  it('parses ISO format (YYYY-MM-DD)', () => {
    expect(parseDateString('2025-01-15')).toBe('2025-01-15');
    expect(parseDateString('2025-1-5')).toBe('2025-01-05');
  });

  it('parses US format (MM/DD/YYYY)', () => {
    expect(parseDateString('01/15/2025')).toBe('2025-01-15');
    expect(parseDateString('1/5/2025')).toBe('2025-01-05');
  });

  it('parses US format with dashes (MM-DD-YYYY)', () => {
    expect(parseDateString('01-15-2025')).toBe('2025-01-15');
  });

  it('parses 2-digit year', () => {
    expect(parseDateString('1/15/25')).toBe('2025-01-15');
    expect(parseDateString('6/1/99')).toBe('1999-06-01');
  });

  it('parses named month format', () => {
    expect(parseDateString('Jan 15, 2025')).toBe('2025-01-15');
    expect(parseDateString('December 25, 2024')).toBe('2024-12-25');
  });

  it('returns null for blank/null/undefined', () => {
    expect(parseDateString('')).toBeNull();
    expect(parseDateString(null)).toBeNull();
    expect(parseDateString(undefined)).toBeNull();
  });

  it('returns null for unparseable strings', () => {
    expect(parseDateString('Various')).toBeNull();
    expect(parseDateString('N/A')).toBeNull();
  });
});

describe('parseHoldingPeriod', () => {
  it('parses long-term values', () => {
    expect(parseHoldingPeriod('Long Term')).toBe(true);
    expect(parseHoldingPeriod('LT')).toBe(true);
    expect(parseHoldingPeriod('Long')).toBe(true);
    expect(parseHoldingPeriod('long-term')).toBe(true);
  });

  it('parses short-term values', () => {
    expect(parseHoldingPeriod('Short Term')).toBe(false);
    expect(parseHoldingPeriod('ST')).toBe(false);
    expect(parseHoldingPeriod('Short')).toBe(false);
  });

  it('returns null for unrecognized values', () => {
    expect(parseHoldingPeriod('')).toBeNull();
    expect(parseHoldingPeriod(null)).toBeNull();
    expect(parseHoldingPeriod('1 year')).toBeNull();
  });
});

describe('inferHoldingPeriod', () => {
  it('returns true for > 365 days', () => {
    expect(inferHoldingPeriod('2023-01-01', '2024-06-01')).toBe(true);
  });

  it('returns false for <= 365 days', () => {
    expect(inferHoldingPeriod('2024-06-01', '2025-01-01')).toBe(false);
  });

  it('returns false when dates are missing', () => {
    expect(inferHoldingPeriod(null, '2025-01-01')).toBe(false);
    expect(inferHoldingPeriod('2024-01-01', null)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BROKER DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectBrokerFormat', () => {
  it('detects Schwab format', () => {
    const headers = ['Description', 'Date Acquired', 'Date Sold', 'Proceeds', 'Cost Basis', 'Gain/Loss', 'Wash Sale Loss Disallowed'];
    const result = detectBrokerFormat(headers);
    expect(result.format).toBe('schwab');
    expect(result.mapping.proceeds).toBe('Proceeds');
    expect(result.mapping.costBasis).toBe('Cost Basis');
  });

  it('detects Fidelity format', () => {
    const headers = ['Symbol', 'Quantity', 'Date Acquired', 'Date Sold', 'Proceeds', 'Cost Basis', 'Gain/Loss ($)', 'Term'];
    const result = detectBrokerFormat(headers);
    expect(result.format).toBe('fidelity');
  });

  it('detects E*Trade format', () => {
    const headers = ['Record Type', 'Symbol', 'Date Acquired', 'Date Sold', 'Gross Proceeds', 'Adjusted Cost Basis'];
    const result = detectBrokerFormat(headers);
    expect(result.format).toBe('etrade');
    expect(result.mapping.proceeds).toBe('Gross Proceeds');
  });

  it('detects Robinhood format', () => {
    const headers = ['Asset Name', 'Date Acquired', 'Date Sold', 'Proceeds', 'Cost Basis', 'Holding Period'];
    const result = detectBrokerFormat(headers);
    expect(result.format).toBe('robinhood');
  });

  it('detects Coinbase format', () => {
    const headers = ['Asset', 'Transaction Type', 'Quantity', 'Spot Price', 'Subtotal', 'Timestamp'];
    const result = detectBrokerFormat(headers);
    expect(result.format).toBe('coinbase');
  });

  it('falls back to generic for unknown formats', () => {
    const headers = ['Sale Amount', 'Purchase Price', 'Sold On', 'Bought On', 'Stock Name'];
    const result = detectBrokerFormat(headers);
    expect(result.format).toBe('generic');
  });
});

describe('autoDetectColumnMapping', () => {
  it('maps common header names', () => {
    const headers = ['Sale Price', 'Purchase Price', 'Buy Date', 'Sell Date', 'Stock Name'];
    const mapping = autoDetectColumnMapping(headers);
    expect(mapping.proceeds).toBe('Sale Price');
    expect(mapping.costBasis).toBe('Purchase Price');
    expect(mapping.dateAcquired).toBe('Buy Date');
    expect(mapping.dateSold).toBe('Sell Date');
  });

  it('handles case-insensitive matching', () => {
    const headers = ['PROCEEDS', 'COST BASIS', 'DATE ACQUIRED', 'DATE SOLD'];
    const mapping = autoDetectColumnMapping(headers);
    expect(mapping.proceeds).toBe('PROCEEDS');
    expect(mapping.costBasis).toBe('COST BASIS');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROW MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

describe('mapRowToIncome1099B', () => {
  const baseMapping = {
    proceeds: 'Proceeds',
    costBasis: 'Cost Basis',
    dateAcquired: 'Date Acquired',
    dateSold: 'Date Sold',
    description: 'Description',
    holdingPeriod: 'Term',
  };

  it('maps a valid row correctly', () => {
    const row = {
      'Description': '100 shares AAPL',
      'Date Acquired': '01/15/2024',
      'Date Sold': '03/20/2025',
      'Proceeds': '$15,000.00',
      'Cost Basis': '$10,000.00',
      'Term': 'Long Term',
    };
    const result = mapRowToIncome1099B(row, baseMapping, 'Schwab');
    expect(result.errors).toHaveLength(0);
    expect(result.data.brokerName).toBe('Schwab');
    expect(result.data.description).toBe('100 shares AAPL');
    expect(result.data.proceeds).toBe(15000);
    expect(result.data.costBasis).toBe(10000);
    expect(result.data.isLongTerm).toBe(true);
    expect(result.data.dateAcquired).toBe('2024-01-15');
    expect(result.data.dateSold).toBe('2025-03-20');
  });

  it('marks row as error when proceeds and basis are both zero', () => {
    const row = {
      'Description': 'AAPL',
      'Date Sold': '01/01/2025',
      'Proceeds': '$0.00',
      'Cost Basis': '$0.00',
    };
    const result = mapRowToIncome1099B(row, baseMapping, 'Schwab');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('warns when no acquisition date', () => {
    const row = {
      'Description': 'AAPL',
      'Date Sold': '01/01/2025',
      'Proceeds': '$1,000',
      'Cost Basis': '$800',
    };
    const result = mapRowToIncome1099B(row, baseMapping, 'Schwab');
    expect(result.warnings).toContain('No acquisition date — defaulting to short-term');
    expect(result.data.isLongTerm).toBe(false);
  });

  it('infers long-term from dates when no holding period column', () => {
    const mappingNoTerm = { ...baseMapping, holdingPeriod: undefined };
    const row = {
      'Description': 'AAPL',
      'Date Acquired': '01/01/2023',
      'Date Sold': '06/01/2025',
      'Proceeds': '$1,000',
      'Cost Basis': '$800',
    };
    const result = mapRowToIncome1099B(row, mappingNoTerm, 'Schwab');
    expect(result.data.isLongTerm).toBe(true);
  });

  it('includes wash sale loss when present', () => {
    const mappingWithWash = { ...baseMapping, washSaleLoss: 'Wash Sale' };
    const row = {
      'Description': 'AAPL',
      'Date Sold': '01/01/2025',
      'Proceeds': '$1,000',
      'Cost Basis': '$800',
      'Wash Sale': '$200',
      'Term': 'ST',
    };
    const result = mapRowToIncome1099B(row, mappingWithWash, 'Schwab');
    expect(result.data.washSaleLossDisallowed).toBe(200);
  });
});

describe('mapRowToIncome1099DA', () => {
  const mapping = {
    tokenName: 'Asset',
    proceeds: 'Subtotal',
    costBasis: 'Cost Basis',
    dateSold: 'Timestamp',
    transactionId: 'Transaction ID',
  };

  it('maps a crypto transaction correctly', () => {
    const row = {
      'Asset': 'Bitcoin',
      'Subtotal': '$21,000.00',
      'Cost Basis': '$8,000.00',
      'Timestamp': '2025-02-01',
      'Transaction ID': '0xabc123',
    };
    const result = mapRowToIncome1099DA(row, mapping, 'Coinbase');
    expect(result.errors).toHaveLength(0);
    expect(result.data.tokenName).toBe('Bitcoin');
    expect(result.data.proceeds).toBe(21000);
    expect(result.data.costBasis).toBe(8000);
    expect(result.data.transactionId).toBe('0xabc123');
  });

  it('errors when no token name or description', () => {
    const row = {
      'Subtotal': '$1,000',
      'Cost Basis': '$500',
      'Timestamp': '2025-01-01',
    };
    const result = mapRowToIncome1099DA(row, mapping, 'Coinbase');
    expect(result.errors.some(e => e.includes('token name'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FULL INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseCSV — full integration', () => {
  it('parses a Schwab-style CSV into 1099-B records', () => {
    const csv = `Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Wash Sale Loss Disallowed,Term
100 AAPL,01/15/2024,03/20/2025,"$15,000.00","$10,000.00",,Long Term
50 MSFT,06/01/2024,01/10/2025,"$8,500.00","$7,200.00",,Short Term
200 GOOG,03/01/2023,02/01/2025,"$22,000.00","$18,000.00",,Long Term`;

    const result = parseCSV(csv, '1099b', 'Schwab');
    expect(result.detectedFormat).toBe('schwab');
    expect(result.rawRowCount).toBe(3);
    expect(result.validCount).toBe(3);
    expect(result.errorCount).toBe(0);

    const firstRow = result.mappedRows[0];
    expect(firstRow.data.brokerName).toBe('Schwab');
    expect(firstRow.data.description).toBe('100 AAPL');
    expect(firstRow.data.proceeds).toBe(15000);
    expect(firstRow.data.isLongTerm).toBe(true);
  });

  it('parses a Coinbase-style CSV into 1099-DA records', () => {
    const csv = `Asset,Transaction Type,Quantity,Spot Price,Subtotal,Cost Basis,Timestamp
Bitcoin,Sell,0.5,"$42,000.00","$21,000.00","$8,000.00",2025-02-01
Ethereum,Sell,2.0,"$3,000.00","$6,000.00","$4,500.00",2025-01-15`;

    const result = parseCSV(csv, '1099da', 'Coinbase');
    expect(result.detectedFormat).toBe('coinbase');
    expect(result.validCount).toBe(2);
    expect(result.mappedRows[0].data.tokenName).toBe('Bitcoin');
    expect(result.mappedRows[1].data.tokenName).toBe('Ethereum');
  });

  it('handles CSV with empty/invalid rows', () => {
    const csv = `Description,Date Sold,Proceeds,Cost Basis
AAPL,01/01/2025,"$1,000","$800"
,,,"$0"
MSFT,02/01/2025,"$500","$400"`;

    const result = parseCSV(csv, '1099b', 'Test');
    expect(result.rawRowCount).toBe(3);
    // Second row has 0 proceeds + 0 cost basis → error
    expect(result.errorCount).toBe(1);
    expect(result.validCount).toBe(2);
  });

  it('parses generic column headers via alias matching', () => {
    const csv = `Stock Name,Buy Date,Sell Date,Sale Price,Purchase Price
AAPL,2024-01-15,2025-03-20,15000,10000`;

    const result = parseCSV(csv, '1099b', 'MyBroker');
    expect(result.detectedFormat).toBe('generic');
    expect(result.validCount).toBe(1);
    expect(result.mappedRows[0].data.proceeds).toBe(15000);
    expect(result.mappedRows[0].data.costBasis).toBe(10000);
  });
});
