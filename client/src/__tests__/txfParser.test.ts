/**
 * TXF Parser Unit Tests
 *
 * Tests header parsing, record parsing, capital gains mapping,
 * W-2 grouping, 1099-INT/DIV composite key grouping, 1099-R
 * pension/IRA grouping, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { parseTXF } from '../services/txfParser';
import type { TXFParseResult } from '../services/txfParser';

// ─── Helpers ─────────────────────────────────────────

/** Build a minimal valid TXF string from records */
function buildTXF(records: string, header = 'V042\nATurboTax\nD01/15/2025'): string {
  return `${header}\n${records}`;
}

/** Build a single capital gain record (Format 4) */
function capGainRecord(opts: {
  code?: number;
  description?: string;
  dateAcquired?: string;
  dateSold?: string;
  costBasis?: number;
  proceeds?: number;
  washSale?: number;
}): string {
  const code = opts.code ?? 321;
  const lines = [
    'TS',
    `N${code}`,
    `P${opts.description ?? 'AAPL'}`,
    `D${opts.dateAcquired ?? '01/15/2024'}`,
    `D${opts.dateSold ?? '06/15/2025'}`,
    `$${opts.costBasis ?? 1000}`,
    `$${opts.proceeds ?? 1500}`,
  ];
  if (opts.washSale !== undefined) {
    lines.push(`$${opts.washSale}`);
  }
  lines.push('^');
  return lines.join('\n');
}

/** Build a W-2 record group */
function w2Records(opts: {
  employer?: string;
  wages?: number;
  fedWithheld?: number;
  ssTax?: number;
  medicareTax?: number;
  copyNumber?: number;
  spouse?: boolean;
}): string {
  const c = opts.copyNumber ?? 1;
  const isSpouse = opts.spouse ?? false;
  const wageCode = isSpouse ? 506 : 460;
  const fedCode = isSpouse ? 507 : 461;
  const ssCode = isSpouse ? 508 : 462;
  const medCode = isSpouse ? 510 : 480;

  const lines: string[] = [];

  // Wages record
  lines.push('TS', `N${wageCode}`, `C${c}`, `P${opts.employer ?? 'Acme Corp'}`, `$${opts.wages ?? 50000}`, '^');

  // Federal withholding
  if (opts.fedWithheld !== undefined) {
    lines.push('TS', `N${fedCode}`, `C${c}`, `P${opts.employer ?? 'Acme Corp'}`, `$${opts.fedWithheld}`, '^');
  }

  // Social Security tax
  if (opts.ssTax !== undefined) {
    lines.push('TS', `N${ssCode}`, `C${c}`, `P${opts.employer ?? 'Acme Corp'}`, `$${opts.ssTax}`, '^');
  }

  // Medicare tax
  if (opts.medicareTax !== undefined) {
    lines.push('TS', `N${medCode}`, `C${c}`, `P${opts.employer ?? 'Acme Corp'}`, `$${opts.medicareTax}`, '^');
  }

  return lines.join('\n');
}

/** Build a 1099-INT record (Format 3) */
function intRecord(opts: {
  payer?: string;
  amount?: number;
  copyNumber?: number;
  code?: number;
}): string {
  const c = opts.copyNumber ?? 1;
  const code = opts.code ?? 287;
  return ['TS', `N${code}`, `C${c}`, `$${opts.amount ?? 100}`, `P${opts.payer ?? 'Chase Bank'}`, '^'].join('\n');
}

/** Build a 1099-DIV record (Format 3) */
function divRecord(opts: {
  payer?: string;
  amount?: number;
  copyNumber?: number;
  code?: number;
}): string {
  const c = opts.copyNumber ?? 1;
  const code = opts.code ?? 286;
  return ['TS', `N${code}`, `C${c}`, `$${opts.amount ?? 200}`, `P${opts.payer ?? 'Vanguard'}`, '^'].join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEADER PARSING
// ═══════════════════════════════════════════════════════════════════════════════

describe('TXF Header Parsing', () => {
  it('parses a standard V042 header', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({ description: 'AAPL' }),
    ));
    expect(result.header.version).toBe('V042');
    expect(result.header.programName).toBe('TurboTax');
    expect(result.header.exportDate).toBe('01/15/2025');
  });

  it('parses V041 header', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({}),
      'V041\nAQuicken',
    ));
    expect(result.header.version).toBe('V041');
    expect(result.header.programName).toBe('Quicken');
    expect(result.header.exportDate).toBeUndefined();
  });

  it('rejects file without version header', () => {
    const result = parseTXF('Some random text\nNot a TXF file\n');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('missing version header');
    expect(result.totalRecords).toBe(0);
  });

  it('rejects empty file', () => {
    const result = parseTXF('');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.totalRecords).toBe(0);
  });

  it('handles header with no program name', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({}),
      'V042',
    ));
    expect(result.header.version).toBe('V042');
    expect(result.header.programName).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAPITAL GAINS (Format 4/5)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Capital Gains Parsing (1099-B)', () => {
  it('parses a short-term gain (code 321)', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({ code: 321, description: 'AAPL', costBasis: 1000, proceeds: 1500 }),
    ));
    const group = result.groupedByType['1099b'];
    expect(group).toBeDefined();
    expect(group.count).toBe(1);

    const item = group.items[0];
    expect(item.data.description).toBe('AAPL');
    expect(item.data.costBasis).toBe(1000);
    expect(item.data.proceeds).toBe(1500);
    expect(item.data.isLongTerm).toBe(false);
    expect(item.data.basisReportedToIRS).toBe(true);
    expect(item.errors).toHaveLength(0);
  });

  it('parses a long-term gain (code 323)', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({ code: 323, costBasis: 5000, proceeds: 8000 }),
    ));
    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.isLongTerm).toBe(true);
    expect(item.data.basisReportedToIRS).toBe(true);
  });

  it('parses Copy B (basis NOT reported, code 711)', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({ code: 711 }),
    ));
    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.isLongTerm).toBe(false);
    expect(item.data.basisReportedToIRS).toBe(false);
  });

  it('parses Copy B long-term (code 713)', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({ code: 713 }),
    ));
    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.isLongTerm).toBe(true);
    expect(item.data.basisReportedToIRS).toBe(false);
  });

  it('parses 28% rate collectibles (code 324) as long-term', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({ code: 324 }),
    ));
    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.isLongTerm).toBe(true);
    expect(item.data.basisReportedToIRS).toBe(true);
  });

  it('parses wash sale record (Format 5, code 682)', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({ code: 682, costBasis: 1000, proceeds: 800, washSale: 150 }),
    ));
    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.washSaleLossDisallowed).toBe(150);
    expect(item.data.basisReportedToIRS).toBe(true);
    expect(item.errors).toHaveLength(0);
  });

  it('warns when wash sale record has no wash sale amount', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({ code: 682, costBasis: 1000, proceeds: 800 }),
    ));
    const item = result.groupedByType['1099b'].items[0];
    expect(item.warnings.some(w => w.includes('wash sale'))).toBe(true);
  });

  it('parses multiple transactions', () => {
    const records = [
      capGainRecord({ code: 321, description: 'AAPL', costBasis: 1000, proceeds: 1500 }),
      capGainRecord({ code: 323, description: 'GOOGL', costBasis: 2000, proceeds: 3000 }),
      capGainRecord({ code: 711, description: 'TSLA', costBasis: 500, proceeds: 300 }),
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    expect(result.groupedByType['1099b'].count).toBe(3);
    expect(result.validCount).toBe(3);
  });

  it('handles "Various" date sentinel for mutual fund lots', () => {
    const txf = buildTXF([
      'TS', 'N323', 'PVFIAX Mutual Fund', 'DVarious', 'D06/15/2025', '$5000', '$6000', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.dateAcquired).toBe('');
    expect(item.data.dateSold).toBe('2025-06-15');
    expect(item.warnings.some(w => w.includes('Various'))).toBe(true);
  });

  it('warns on negative cost basis (potential field-order swap)', () => {
    const txf = buildTXF([
      'TS', 'N321', 'PMSFT', 'D01/01/2024', 'D06/01/2025', '$-500', '$1000', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    const item = result.groupedByType['1099b'].items[0];
    expect(item.warnings.some(w => w.includes('swapped'))).toBe(true);
  });

  it('warns when only one amount is provided', () => {
    const txf = buildTXF([
      'TS', 'N321', 'PAAPL', 'D01/01/2024', 'D06/01/2025', '$1500', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.proceeds).toBe(1500);
    expect(item.data.costBasis).toBe(0);
    expect(item.warnings.some(w => w.includes('one amount'))).toBe(true);
  });

  it('errors when no amounts are provided', () => {
    const txf = buildTXF([
      'TS', 'N321', 'PAAPL', 'D01/01/2024', 'D06/01/2025', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    const item = result.groupedByType['1099b'].items[0];
    expect(item.errors.some(e => e.includes('No dollar amounts'))).toBe(true);
  });

  it('skips detail records (TD)', () => {
    const txf = buildTXF([
      'TD', 'N321', 'PDetail record', 'D01/01/2024', 'D06/01/2025', '$1000', '$1500', '^',
      'TS', 'N321', 'PSummary record', 'D01/01/2024', 'D06/01/2025', '$2000', '$2500', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    expect(result.groupedByType['1099b'].count).toBe(1);
    expect(result.groupedByType['1099b'].items[0].data.description).toBe('Summary record');
  });

  it('parses dates in MM/DD/YYYY format', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({ dateAcquired: '03/15/2023', dateSold: '11/20/2025' }),
    ));
    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.dateAcquired).toBe('2023-03-15');
    expect(item.data.dateSold).toBe('2025-11-20');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// W-2 GROUPING
// ═══════════════════════════════════════════════════════════════════════════════

describe('W-2 Parsing', () => {
  it('groups W-2 records by copy number into a single item', () => {
    const result = parseTXF(buildTXF(
      w2Records({ employer: 'Acme Corp', wages: 75000, fedWithheld: 12000, ssTax: 4650, medicareTax: 1088 }),
    ));
    const group = result.groupedByType['w2'];
    expect(group).toBeDefined();
    expect(group.count).toBe(1);

    const item = group.items[0];
    expect(item.data.employerName).toBe('Acme Corp');
    expect(item.data.wages).toBe(75000);
    expect(item.data.federalTaxWithheld).toBe(12000);
    expect(item.data.socialSecurityTax).toBe(4650);
    expect(item.data.medicareTax).toBe(1088);
  });

  it('separates multiple W-2s by copy number', () => {
    const records = [
      w2Records({ employer: 'Acme Corp', wages: 75000, fedWithheld: 12000, copyNumber: 1 }),
      w2Records({ employer: 'Beta Inc', wages: 25000, fedWithheld: 3000, copyNumber: 2 }),
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    const group = result.groupedByType['w2'];
    expect(group.count).toBe(2);

    const names = group.items.map(i => i.data.employerName);
    expect(names).toContain('Acme Corp');
    expect(names).toContain('Beta Inc');
  });

  it('separates taxpayer and spouse W-2s', () => {
    const records = [
      w2Records({ employer: 'Acme Corp', wages: 75000, copyNumber: 1, spouse: false }),
      w2Records({ employer: 'Widget Co', wages: 50000, copyNumber: 1, spouse: true }),
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    const group = result.groupedByType['w2'];
    expect(group.count).toBe(2);
  });

  it('marks spouse W-2 with forSpouse flag and label suffix', () => {
    const records = [
      w2Records({ employer: 'Acme Corp', wages: 75000, copyNumber: 1, spouse: false }),
      w2Records({ employer: 'Widget Co', wages: 50000, copyNumber: 1, spouse: true }),
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    const group = result.groupedByType['w2'];

    const taxpayerW2 = group.items.find(i => i.data.employerName === 'Acme Corp');
    const spouseW2 = group.items.find(i => i.data.employerName === 'Widget Co');

    expect(taxpayerW2).toBeDefined();
    expect(taxpayerW2!.data.forSpouse).toBeUndefined();
    expect(taxpayerW2!.label).toBe('Acme Corp');

    expect(spouseW2).toBeDefined();
    expect(spouseW2!.data.forSpouse).toBe(true);
    expect(spouseW2!.label).toBe('Widget Co (Spouse)');
  });

  it('warns when wages are zero', () => {
    const result = parseTXF(buildTXF(
      w2Records({ employer: 'Acme Corp', wages: 0, fedWithheld: 100 }),
    ));
    const item = result.groupedByType['w2'].items[0];
    expect(item.warnings.some(w => w.includes('zero'))).toBe(true);
  });

  it('uses description from any record if wages record has none', () => {
    const txf = buildTXF([
      'TS', 'N461', 'C1', 'PFoo Corp', '$5000', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    const item = result.groupedByType['w2'].items[0];
    expect(item.data.employerName).toBe('Foo Corp');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-INT GROUPING
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-INT Parsing', () => {
  it('parses a basic interest record', () => {
    const result = parseTXF(buildTXF(
      intRecord({ payer: 'Chase Bank', amount: 500 }),
    ));
    const group = result.groupedByType['1099int'];
    expect(group).toBeDefined();
    expect(group.count).toBe(1);

    const item = group.items[0];
    expect(item.data.payerName).toBe('Chase Bank');
    expect(item.data.amount).toBe(500);
  });

  it('groups primary and sub-records by composite key', () => {
    const records = [
      intRecord({ payer: 'Chase Bank', amount: 500, copyNumber: 1, code: 287 }),
      intRecord({ payer: 'Chase Bank', amount: 50, copyNumber: 1, code: 288 }),  // US gov interest
      intRecord({ payer: 'Chase Bank', amount: 25, copyNumber: 1, code: 616 }),  // Fed withheld
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    const group = result.groupedByType['1099int'];
    expect(group.count).toBe(1);

    const item = group.items[0];
    expect(item.data.amount).toBe(500);
    expect(item.data.usBondInterest).toBe(50);
    expect(item.data.federalTaxWithheld).toBe(25);
  });

  it('separates accounts by copy number (same bank, different accounts)', () => {
    const records = [
      intRecord({ payer: 'Chase Bank', amount: 500, copyNumber: 1 }),
      intRecord({ payer: 'Chase Bank', amount: 300, copyNumber: 2 }),
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    const group = result.groupedByType['1099int'];
    expect(group.count).toBe(2);
  });

  it('separates different payers with same copy number', () => {
    const records = [
      intRecord({ payer: 'Chase Bank', amount: 500, copyNumber: 1 }),
      intRecord({ payer: 'Wells Fargo', amount: 300, copyNumber: 1 }),
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    const group = result.groupedByType['1099int'];
    expect(group.count).toBe(2);
  });

  it('normalizes payer names for grouping (Inc, LLC, etc.)', () => {
    const records = [
      intRecord({ payer: 'Chase Bank Inc.', amount: 500, copyNumber: 1, code: 287 }),
      intRecord({ payer: 'Chase Bank, Inc', amount: 50, copyNumber: 1, code: 288 }),
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    const group = result.groupedByType['1099int'];
    // Should be grouped together (same after normalization)
    expect(group.count).toBe(1);
    expect(group.items[0].data.usBondInterest).toBe(50);
  });

  it('handles sub-record without matching primary', () => {
    const records = intRecord({ payer: 'Chase Bank', amount: 75, copyNumber: 1, code: 288 });

    const result = parseTXF(buildTXF(records));
    const group = result.groupedByType['1099int'];
    expect(group.count).toBe(1);
    expect(group.items[0].warnings.some(w => w.includes('without matching'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-DIV GROUPING
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-DIV Parsing', () => {
  it('parses a basic dividend record', () => {
    const result = parseTXF(buildTXF(
      divRecord({ payer: 'Vanguard', amount: 1200 }),
    ));
    const group = result.groupedByType['1099div'];
    expect(group).toBeDefined();
    expect(group.count).toBe(1);

    const item = group.items[0];
    expect(item.data.payerName).toBe('Vanguard');
    expect(item.data.ordinaryDividends).toBe(1200);
  });

  it('groups primary and sub-records (qualified dividends, cap gains, foreign tax)', () => {
    const records = [
      divRecord({ payer: 'Vanguard', amount: 1200, copyNumber: 1, code: 286 }),
      divRecord({ payer: 'Vanguard', amount: 800, copyNumber: 1, code: 683 }),   // Qualified
      divRecord({ payer: 'Vanguard', amount: 150, copyNumber: 1, code: 488 }),   // Cap gain dist
      divRecord({ payer: 'Vanguard', amount: 30, copyNumber: 1, code: 485 }),    // Foreign tax
      divRecord({ payer: 'Vanguard', amount: 50, copyNumber: 1, code: 615 }),    // Fed withheld
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    const group = result.groupedByType['1099div'];
    expect(group.count).toBe(1);

    const item = group.items[0];
    expect(item.data.ordinaryDividends).toBe(1200);
    expect(item.data.qualifiedDividends).toBe(800);
    expect(item.data.capitalGainDistributions).toBe(150);
    expect(item.data.foreignTaxPaid).toBe(30);
    expect(item.data.federalTaxWithheld).toBe(50);
  });

  it('separates accounts by copy number', () => {
    const records = [
      divRecord({ payer: 'Vanguard', amount: 1200, copyNumber: 1 }),
      divRecord({ payer: 'Vanguard', amount: 300, copyNumber: 2 }),
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    expect(result.groupedByType['1099div'].count).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-R RETIREMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-R Parsing', () => {
  it('parses pension distribution records', () => {
    const txf = buildTXF([
      'TS', 'N475', 'C1', 'PFidelity Pension', '$25000', '^',
      'TS', 'N476', 'C1', 'PFidelity Pension', '$25000', '^',
      'TS', 'N529', 'C1', 'PFidelity Pension', '$5000', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    const group = result.groupedByType['1099r'];
    expect(group).toBeDefined();
    expect(group.count).toBe(1);

    const item = group.items[0];
    expect(item.data.payerName).toBe('Fidelity Pension');
    expect(item.data.grossDistribution).toBe(25000);
    expect(item.data.taxableAmount).toBe(25000);
    expect(item.data.federalTaxWithheld).toBe(5000);
    expect(item.data.isIRA).toBe(false);
  });

  it('parses IRA distribution records', () => {
    const txf = buildTXF([
      'TS', 'N477', 'C1', 'PSchwab IRA', '$10000', '^',
      'TS', 'N478', 'C1', 'PSchwab IRA', '$10000', '^',
      'TS', 'N532', 'C1', 'PSchwab IRA', '$2000', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    const group = result.groupedByType['1099r'];
    expect(group.count).toBe(1);

    const item = group.items[0];
    expect(item.data.payerName).toBe('Schwab IRA');
    expect(item.data.grossDistribution).toBe(10000);
    expect(item.data.isIRA).toBe(true);
  });

  it('separates pension and IRA by copy number', () => {
    const txf = buildTXF([
      'TS', 'N475', 'C1', 'PFidelity Pension', '$25000', '^',
      'TS', 'N477', 'C1', 'PSchwab IRA', '$10000', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    expect(result.groupedByType['1099r'].count).toBe(2);
  });

  it('defaults taxableAmount to grossDistribution when not provided', () => {
    const txf = buildTXF([
      'TS', 'N475', 'C1', 'PFidelity', '$25000', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    const item = result.groupedByType['1099r'].items[0];
    expect(item.data.taxableAmount).toBe(25000);
    expect(item.warnings.some(w => w.includes('defaulting to gross'))).toBe(true);
  });

  it('treats unmapped retirement codes (530, 531, etc.) as unsupported', () => {
    // Codes 530, 531, 533, 534, 623, 624, 625 are valid TXF spec codes but not
    // mapped in REF_CODES. They should appear in the "unsupported ref codes" warning
    // rather than silently creating empty groups.
    const txf = buildTXF([
      'TS', 'N530', 'C1', 'PFidelity Pension', '$1000', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    expect(result.groupedByType['1099r']).toBeUndefined();
    expect(result.warnings.some(w => w.includes('unsupported ref codes') && w.includes('530'))).toBe(true);
  });

  it('warns when distribution is zero', () => {
    const txf = buildTXF([
      'TS', 'N475', 'C1', 'PFidelity', '$0', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    const item = result.groupedByType['1099r'].items[0];
    expect(item.warnings.some(w => w.includes('zero'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-TYPE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Multi-Type TXF Files', () => {
  it('parses a file with multiple income types', () => {
    const records = [
      // Capital gain
      capGainRecord({ code: 321, description: 'AAPL', costBasis: 1000, proceeds: 1500 }),
      // W-2
      w2Records({ employer: 'Acme Corp', wages: 75000, fedWithheld: 12000 }),
      // 1099-INT
      intRecord({ payer: 'Chase Bank', amount: 500 }),
      // 1099-DIV
      divRecord({ payer: 'Vanguard', amount: 1200 }),
    ].join('\n');

    const result = parseTXF(buildTXF(records));

    expect(result.groupedByType['1099b']).toBeDefined();
    expect(result.groupedByType['w2']).toBeDefined();
    expect(result.groupedByType['1099int']).toBeDefined();
    expect(result.groupedByType['1099div']).toBeDefined();
    expect(result.validCount).toBe(4);
    expect(result.errorCount).toBe(0);
  });

  it('counts valid and error records correctly', () => {
    const records = [
      // Valid
      capGainRecord({ code: 321, description: 'AAPL', costBasis: 1000, proceeds: 1500 }),
      // Will have error (no amounts)
      ['TS', 'N321', 'PGOOGL', 'D01/01/2024', 'D06/01/2025', '^'].join('\n'),
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  it('handles file with only header and no records', () => {
    const result = parseTXF('V042\nATurboTax\nD01/15/2025\n');
    expect(result.errors.some(e => e.includes('No tax records'))).toBe(true);
    expect(result.totalRecords).toBe(0);
  });

  it('warns about unknown reference codes', () => {
    const txf = buildTXF([
      'TS', 'N999', 'PUnknown', '$100', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    expect(result.warnings.some(w => w.includes('unsupported ref codes'))).toBe(true);
    expect(result.warnings.some(w => w.includes('999'))).toBe(true);
  });

  it('handles Windows-style CRLF line endings', () => {
    const txf = 'V042\r\nATurboTax\r\nTS\r\nN321\r\nPAAPL\r\nD01/15/2024\r\nD06/15/2025\r\n$1000\r\n$1500\r\n^\r\n';
    const result = parseTXF(txf);
    expect(result.groupedByType['1099b']).toBeDefined();
    expect(result.groupedByType['1099b'].count).toBe(1);
  });

  it('handles file without trailing ^ delimiter', () => {
    const txf = 'V042\nTS\nN321\nPAAPL\nD01/15/2024\nD06/15/2025\n$1000\n$1500';
    const result = parseTXF(txf);
    expect(result.groupedByType['1099b']).toBeDefined();
    expect(result.groupedByType['1099b'].count).toBe(1);
  });

  it('handles extra whitespace in lines', () => {
    const txf = buildTXF([
      'TS', '  N321  ', '  PAAPL  ', '  D01/15/2024  ', '  D06/15/2025  ', '  $1000  ', '  $1500  ', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    expect(result.groupedByType['1099b']).toBeDefined();
  });

  it('skips blank lines gracefully', () => {
    const txf = buildTXF([
      '', 'TS', '', 'N321', '', 'PAAPL', 'D01/15/2024', '', 'D06/15/2025', '$1000', '', '$1500', '^', '',
    ].join('\n'));
    const result = parseTXF(txf);
    expect(result.groupedByType['1099b']).toBeDefined();
    expect(result.groupedByType['1099b'].count).toBe(1);
  });

  it('handles C line with valid copy numbers', () => {
    const txf = buildTXF([
      'TS', 'N460', 'C3', 'PThird Employer', '$30000', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    const group = result.groupedByType['w2'];
    expect(group).toBeDefined();
    expect(group.count).toBe(1);
  });

  it('reports totalRecords count correctly', () => {
    const records = [
      capGainRecord({ code: 321, description: 'AAPL' }),
      capGainRecord({ code: 323, description: 'GOOGL' }),
      w2Records({ employer: 'Acme', wages: 50000 }),
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    // 2 cap gain + 1 W-2 wage record = 3 total summary records
    expect(result.totalRecords).toBeGreaterThanOrEqual(3);
  });

  it('handles X (extra text) lines without error', () => {
    const txf = buildTXF([
      'TS', 'N321', 'PAAPL', 'D01/15/2024', 'D06/15/2025', '$1000', '$1500', 'XLot 1 of 3', '^',
    ].join('\n'));
    const result = parseTXF(txf);
    expect(result.groupedByType['1099b']).toBeDefined();
    expect(result.groupedByType['1099b'].items[0].errors).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════════

describe('TXFParseResult structure', () => {
  it('returns correct incomeType labels', () => {
    const records = [
      capGainRecord({ code: 321 }),
      w2Records({ employer: 'Acme', wages: 50000 }),
      intRecord({ payer: 'Chase', amount: 100 }),
      divRecord({ payer: 'Vanguard', amount: 200 }),
    ].join('\n');

    const result = parseTXF(buildTXF(records));
    expect(result.groupedByType['1099b'].label).toBe('1099-B Capital Gains/Losses');
    expect(result.groupedByType['w2'].label).toBe('W-2 Wages');
    expect(result.groupedByType['1099int'].label).toBe('1099-INT Interest');
    expect(result.groupedByType['1099div'].label).toBe('1099-DIV Dividends');
  });

  it('has no groups for income types not present in file', () => {
    const result = parseTXF(buildTXF(
      capGainRecord({ code: 321 }),
    ));
    expect(result.groupedByType['w2']).toBeUndefined();
    expect(result.groupedByType['1099int']).toBeUndefined();
  });
});
