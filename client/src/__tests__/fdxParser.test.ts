/**
 * FDX Parser Unit Tests
 *
 * Tests v5/v6 format detection, form-specific field mapping,
 * 1099-B securityDetails expansion, state/local extraction,
 * edge cases, and error handling.
 */

import { describe, it, expect } from 'vitest';
import { parseFDX } from '../services/fdxParser';

// ─── Helpers ─────────────────────────────────────────

/** Build a v6 TaxStatement with forms array */
function v6Statement(forms: Record<string, unknown>[], opts?: { taxYear?: number; issuerName?: string }): Record<string, unknown> {
  const stmt: Record<string, unknown> = { forms };
  if (opts?.taxYear) stmt.taxYear = opts.taxYear;
  if (opts?.issuerName) {
    stmt.issuer = { partyType: 'BUSINESS', businessName: { name1: opts.issuerName } };
  }
  return stmt;
}

/** Build a v5 taxDataList */
function v5DataList(forms: Record<string, unknown>[]): Record<string, unknown> {
  return { taxDataList: forms };
}

/** Build a W-2 TaxData entry */
function w2Form(opts: {
  employer?: string;
  wages?: number;
  fedWithheld?: number;
  ssTax?: number;
  medicareTax?: number;
  state?: string;
  stateTaxWithheld?: number;
}): Record<string, unknown> {
  const form: Record<string, unknown> = {
    taxFormType: 'TaxW2',
    wages: opts.wages ?? 75000,
    federalTaxWithheld: opts.fedWithheld ?? 12000,
    socialSecurityTaxWithheld: opts.ssTax ?? 4650,
    medicareTaxWithheld: opts.medicareTax ?? 1088,
  };
  if (opts.employer) {
    form.issuer = { partyType: 'BUSINESS', businessName: { name1: opts.employer } };
  }
  if (opts.state || opts.stateTaxWithheld) {
    form.stateAndLocal = [{
      stateCode: opts.state || 'CA',
      state: { taxWithheld: opts.stateTaxWithheld || 3000, taxableIncome: opts.wages || 75000 },
    }];
  }
  return { taxW2: form };
}

/** Build a 1099-B TaxData entry with securityDetails */
function b1099Form(transactions: Array<{
  name?: string;
  dateAcquired?: string;
  dateSold?: string;
  proceeds?: number;
  costBasis?: number;
  longOrShort?: string;
  basisReported?: boolean;
  washSale?: number;
  various?: boolean;
}>): Record<string, unknown> {
  return {
    tax1099B: {
      taxFormType: 'Tax1099B',
      issuer: { partyType: 'BUSINESS', businessName: { name1: 'Schwab' } },
      securityDetails: transactions.map(t => ({
        securityName: t.name ?? 'AAPL',
        dateAcquired: t.dateAcquired ?? '2024-01-15',
        dateOfSale: t.dateSold ?? '2025-06-15',
        salesPrice: t.proceeds ?? 1500,
        costBasis: t.costBasis ?? 1000,
        longOrShort: t.longOrShort ?? 'SHORT',
        basisReported: t.basisReported ?? true,
        washSaleLossDisallowed: t.washSale,
        variousDatesAcquired: t.various,
      })),
    },
  };
}

/** Build a 1099-INT TaxData entry */
function int1099Form(opts: { payer?: string; amount?: number; usBond?: number; fedWithheld?: number }): Record<string, unknown> {
  const form: Record<string, unknown> = {
    taxFormType: 'Tax1099Int',
    interestIncome: opts.amount ?? 500,
    federalTaxWithheld: opts.fedWithheld ?? 0,
  };
  if (opts.payer) {
    form.issuer = { partyType: 'BUSINESS', businessName: { name1: opts.payer } };
  }
  if (opts.usBond) form.usBondInterest = opts.usBond;
  return { tax1099Int: form };
}

/** Build a 1099-DIV TaxData entry */
function div1099Form(opts: { payer?: string; ordinary?: number; qualified?: number; capGain?: number; foreignTax?: number }): Record<string, unknown> {
  const form: Record<string, unknown> = {
    taxFormType: 'Tax1099Div',
    ordinaryDividends: opts.ordinary ?? 1200,
    qualifiedDividends: opts.qualified ?? 800,
    federalTaxWithheld: 0,
  };
  if (opts.payer) {
    form.issuer = { partyType: 'BUSINESS', businessName: { name1: opts.payer } };
  }
  if (opts.capGain) form.totalCapitalGain = opts.capGain;
  if (opts.foreignTax) form.foreignTaxPaid = opts.foreignTax;
  return { tax1099Div: form };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('FDX Version Detection', () => {
  it('detects v6 TaxStatement format', () => {
    const result = parseFDX(v6Statement([w2Form({ employer: 'Acme' })], { taxYear: 2025 }));
    expect(result.version).toBe('v6');
    expect(result.taxYear).toBe(2025);
    expect(result.errors).toHaveLength(0);
  });

  it('detects v5 taxDataList format', () => {
    const result = parseFDX(v5DataList([w2Form({ employer: 'Acme' })]));
    expect(result.version).toBe('v5');
    expect(result.errors).toHaveLength(0);
  });

  it('extracts issuer name from v6 statement', () => {
    const result = parseFDX(v6Statement(
      [w2Form({})],
      { taxYear: 2025, issuerName: 'Fidelity Investments' },
    ));
    expect(result.issuerName).toBe('Fidelity Investments');
  });

  it('handles taxStatements batch export', () => {
    const batch = {
      taxStatements: [
        v6Statement([w2Form({ employer: 'Acme' })], { taxYear: 2025 }),
        v6Statement([int1099Form({ payer: 'Chase' })]),
      ],
    };
    const result = parseFDX(batch);
    expect(result.version).toBe('v6');
    expect(result.totalForms).toBe(2);
    expect(result.taxYear).toBe(2025);
  });

  it('handles bare form object (single TaxData)', () => {
    const result = parseFDX(w2Form({ employer: 'Acme' }));
    expect(result.version).toBe('unknown');
    expect(result.groupedByType['w2']).toBeDefined();
  });

  it('rejects null input', () => {
    const result = parseFDX(null);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects non-object input', () => {
    const result = parseFDX('not json');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects object with no recognizable form data', () => {
    const result = parseFDX({ someRandomField: 123 });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('could not find');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// W-2 MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

describe('FDX W-2 Parsing', () => {
  it('maps W-2 fields correctly', () => {
    const result = parseFDX(v6Statement([
      w2Form({ employer: 'Acme Corp', wages: 85000, fedWithheld: 12750, ssTax: 5270, medicareTax: 1233 }),
    ]));

    const group = result.groupedByType['w2'];
    expect(group).toBeDefined();
    expect(group.count).toBe(1);

    const item = group.items[0];
    expect(item.data.employerName).toBe('Acme Corp');
    expect(item.data.wages).toBe(85000);
    expect(item.data.federalTaxWithheld).toBe(12750);
    expect(item.data.socialSecurityTax).toBe(5270);
    expect(item.data.medicareTax).toBe(1233);
  });

  it('extracts state withholding from stateAndLocal array', () => {
    const result = parseFDX(v6Statement([
      w2Form({ employer: 'Acme', wages: 75000, state: 'IL', stateTaxWithheld: 4200 }),
    ]));

    const item = result.groupedByType['w2'].items[0];
    expect(item.data.state).toBe('IL');
    expect(item.data.stateTaxWithheld).toBe(4200);
    expect(item.data.stateWages).toBe(75000);
  });

  it('warns when wages are zero', () => {
    const result = parseFDX(v6Statement([w2Form({ employer: 'Acme', wages: 0 })]));
    const item = result.groupedByType['w2'].items[0];
    expect(item.warnings.some(w => w.includes('zero'))).toBe(true);
  });

  it('handles multiple W-2s', () => {
    const result = parseFDX(v6Statement([
      w2Form({ employer: 'Acme Corp', wages: 75000 }),
      w2Form({ employer: 'Beta Inc', wages: 25000 }),
    ]));

    expect(result.groupedByType['w2'].count).toBe(2);
    expect(result.validCount).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-B MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

describe('FDX 1099-B Parsing', () => {
  it('maps securityDetails to individual transactions', () => {
    const result = parseFDX(v6Statement([
      b1099Form([
        { name: 'AAPL', proceeds: 9500, costBasis: 7200, longOrShort: 'LONG', basisReported: true },
        { name: 'MSFT', proceeds: 10500, costBasis: 9800, longOrShort: 'SHORT' },
      ]),
    ]));

    const group = result.groupedByType['1099b'];
    expect(group).toBeDefined();
    expect(group.count).toBe(2);

    const aapl = group.items.find(i => i.data.description === 'AAPL');
    expect(aapl).toBeDefined();
    expect(aapl!.data.proceeds).toBe(9500);
    expect(aapl!.data.costBasis).toBe(7200);
    expect(aapl!.data.isLongTerm).toBe(true);
    expect(aapl!.data.basisReportedToIRS).toBe(true);
    expect(aapl!.data.brokerName).toBe('Schwab');

    const msft = group.items.find(i => i.data.description === 'MSFT');
    expect(msft).toBeDefined();
    expect(msft!.data.isLongTerm).toBe(false);
  });

  it('handles wash sale amount', () => {
    const result = parseFDX(v6Statement([
      b1099Form([{ name: 'TSLA', proceeds: 800, costBasis: 1000, washSale: 150 }]),
    ]));

    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.washSaleLossDisallowed).toBe(150);
  });

  it('handles "Various" dates acquired', () => {
    const result = parseFDX(v6Statement([
      b1099Form([{ name: 'VFIAX', various: true, proceeds: 6000, costBasis: 5000 }]),
    ]));

    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.dateAcquired).toBe('');
    expect(item.warnings.some(w => w.includes('Various'))).toBe(true);
  });

  it('warns when 1099-B has no securityDetails', () => {
    const result = parseFDX(v6Statement([{
      tax1099B: { taxFormType: 'Tax1099B', securityDetails: [] },
    }]));

    expect(result.groupedByType['1099b']).toBeUndefined();
    expect(result.warnings.some(w => w.includes('no securityDetails'))).toBe(true);
  });

  it('infers holding period from dates when longOrShort not provided', () => {
    const result = parseFDX(v6Statement([{
      tax1099B: {
        taxFormType: 'Tax1099B',
        securityDetails: [{
          securityName: 'AAPL',
          dateAcquired: '2023-01-15',
          dateOfSale: '2025-06-15',
          salesPrice: 1500,
          costBasis: 1000,
          // no longOrShort field
        }],
      },
    }]));

    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.isLongTerm).toBe(true); // >365 days
  });

  it('derives basisReported from checkboxOnForm8949', () => {
    const result = parseFDX(v6Statement([{
      tax1099B: {
        taxFormType: 'Tax1099B',
        securityDetails: [
          { securityName: 'AAPL', dateOfSale: '2025-06-15', salesPrice: 1500, costBasis: 1000, checkboxOnForm8949: 'A' },
          { securityName: 'MSFT', dateOfSale: '2025-06-15', salesPrice: 2000, costBasis: 1800, checkboxOnForm8949: 'B' },
        ],
      },
    }]));

    const group = result.groupedByType['1099b'];
    const aapl = group.items.find(i => i.data.description === 'AAPL');
    const msft = group.items.find(i => i.data.description === 'MSFT');
    expect(aapl!.data.basisReportedToIRS).toBe(true);  // A = reported
    expect(msft!.data.basisReportedToIRS).toBe(false);  // B = not reported
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-INT MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

describe('FDX 1099-INT Parsing', () => {
  it('maps interest fields correctly', () => {
    const result = parseFDX(v6Statement([
      int1099Form({ payer: 'Chase Bank', amount: 500, usBond: 50, fedWithheld: 25 }),
    ]));

    const group = result.groupedByType['1099int'];
    expect(group).toBeDefined();
    const item = group.items[0];
    expect(item.data.payerName).toBe('Chase Bank');
    expect(item.data.amount).toBe(500);
    expect(item.data.usBondInterest).toBe(50);
    expect(item.data.federalTaxWithheld).toBe(25);
  });

  it('warns when interest is zero', () => {
    const result = parseFDX(v6Statement([int1099Form({ amount: 0 })]));
    const item = result.groupedByType['1099int'].items[0];
    expect(item.warnings.some(w => w.includes('zero'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-DIV MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

describe('FDX 1099-DIV Parsing', () => {
  it('maps dividend fields correctly', () => {
    const result = parseFDX(v6Statement([
      div1099Form({ payer: 'Vanguard', ordinary: 1200, qualified: 800, capGain: 150, foreignTax: 30 }),
    ]));

    const group = result.groupedByType['1099div'];
    expect(group).toBeDefined();
    const item = group.items[0];
    expect(item.data.payerName).toBe('Vanguard');
    expect(item.data.ordinaryDividends).toBe(1200);
    expect(item.data.qualifiedDividends).toBe(800);
    expect(item.data.capitalGainDistributions).toBe(150);
    expect(item.data.foreignTaxPaid).toBe(30);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-R MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

describe('FDX 1099-R Parsing', () => {
  it('maps pension distribution', () => {
    const result = parseFDX(v6Statement([{
      tax1099R: {
        taxFormType: 'Tax1099R',
        issuer: { partyType: 'BUSINESS', businessName: { name1: 'Fidelity' } },
        grossDistribution: 25000,
        taxableAmount: 25000,
        federalTaxWithheld: 5000,
        iraSepSimple: false,
        distributionCodes: ['7'],
      },
    }]));

    const group = result.groupedByType['1099r'];
    expect(group).toBeDefined();
    const item = group.items[0];
    expect(item.data.payerName).toBe('Fidelity');
    expect(item.data.grossDistribution).toBe(25000);
    expect(item.data.federalTaxWithheld).toBe(5000);
    expect(item.data.isIRA).toBe(false);
    expect(item.data.distributionCode).toBe('7');
  });

  it('maps IRA distribution', () => {
    const result = parseFDX(v6Statement([{
      tax1099R: {
        taxFormType: 'Tax1099R',
        issuer: { partyType: 'BUSINESS', businessName: { name1: 'Schwab' } },
        grossDistribution: 10000,
        taxableAmount: 10000,
        iraSepSimple: true,
      },
    }]));

    const item = result.groupedByType['1099r'].items[0];
    expect(item.data.isIRA).toBe(true);
  });

  it('defaults taxable to gross when not determined', () => {
    const result = parseFDX(v6Statement([{
      tax1099R: {
        taxFormType: 'Tax1099R',
        grossDistribution: 15000,
        taxableAmount: 0,
        taxableAmountNotDetermined: true,
      },
    }]));

    const item = result.groupedByType['1099r'].items[0];
    expect(item.data.taxableAmount).toBe(15000);
    expect(item.warnings.some(w => w.includes('not determined'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// OTHER FORM TYPES
// ═══════════════════════════════════════════════════════════════════════════════

describe('FDX Other Form Types', () => {
  it('maps 1099-NEC', () => {
    const result = parseFDX(v6Statement([{
      tax1099Nec: {
        taxFormType: 'Tax1099Nec',
        issuer: { partyType: 'BUSINESS', businessName: { name1: 'Client Inc' }, tin: '12-3456789' },
        nonEmployeeCompensation: 5000,
        federalTaxWithheld: 0,
      },
    }]));

    const item = result.groupedByType['1099nec'].items[0];
    expect(item.data.payerName).toBe('Client Inc');
    expect(item.data.amount).toBe(5000);
    expect(item.data.payerEin).toBe('12-3456789');
  });

  it('maps 1099-MISC', () => {
    const result = parseFDX(v6Statement([{
      tax1099Misc: {
        taxFormType: 'Tax1099Misc',
        issuer: { partyType: 'BUSINESS', businessName: { name1: 'Landlord' } },
        rents: 12000,
        otherIncome: 500,
      },
    }]));

    const item = result.groupedByType['1099misc'].items[0];
    expect(item.data.rents).toBe(12000);
    expect(item.data.otherIncome).toBe(500);
  });

  it('maps 1099-G', () => {
    const result = parseFDX(v6Statement([{
      tax1099G: {
        taxFormType: 'Tax1099G',
        issuer: { partyType: 'BUSINESS', businessName: { name1: 'State of Illinois' } },
        unemploymentCompensation: 8000,
        federalTaxWithheld: 800,
      },
    }]));

    const item = result.groupedByType['1099g'].items[0];
    expect(item.data.payerName).toBe('State of Illinois');
    expect(item.data.unemploymentCompensation).toBe(8000);
  });

  it('maps 1099-K', () => {
    const result = parseFDX(v6Statement([{
      tax1099K: {
        taxFormType: 'Tax1099K',
        pseName: 'Stripe',
        grossAmount: 50000,
        cardNotPresent: 45000,
      },
    }]));

    const item = result.groupedByType['1099k'].items[0];
    expect(item.data.payerName).toBe('Stripe');
    expect(item.data.grossAmount).toBe(50000);
  });

  it('maps 1099-SA', () => {
    const result = parseFDX(v6Statement([{
      tax1099Sa: {
        taxFormType: 'Tax1099Sa',
        issuer: { partyType: 'BUSINESS', businessName: { name1: 'HSA Bank' } },
        grossDistribution: 2000,
        distributionCode: '1',
      },
    }]));

    const item = result.groupedByType['1099sa'].items[0];
    expect(item.data.payerName).toBe('HSA Bank');
    expect(item.data.grossDistribution).toBe(2000);
    expect(item.data.distributionCode).toBe('1');
  });

  it('maps 1099-Q', () => {
    const result = parseFDX(v6Statement([{
      tax1099Q: {
        taxFormType: 'Tax1099Q',
        issuer: { partyType: 'BUSINESS', businessName: { name1: 'CollegeSavings' } },
        grossDistribution: 5000,
        earnings: 1500,
        basis: 3500,
      },
    }]));

    const item = result.groupedByType['1099q'].items[0];
    expect(item.data.payerName).toBe('CollegeSavings');
    expect(item.data.grossDistribution).toBe(5000);
    expect(item.data.earnings).toBe(1500);
    expect(item.data.basisReturn).toBe(3500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-TYPE & EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Multi-Type & Edge Cases', () => {
  it('parses file with multiple form types', () => {
    const result = parseFDX(v6Statement([
      w2Form({ employer: 'Acme' }),
      b1099Form([{ name: 'AAPL' }]),
      int1099Form({ payer: 'Chase' }),
      div1099Form({ payer: 'Vanguard' }),
    ], { taxYear: 2025 }));

    expect(result.groupedByType['w2']).toBeDefined();
    expect(result.groupedByType['1099b']).toBeDefined();
    expect(result.groupedByType['1099int']).toBeDefined();
    expect(result.groupedByType['1099div']).toBeDefined();
    expect(result.validCount).toBe(4);
    expect(result.errorCount).toBe(0);
  });

  it('skips unsupported form types with warning', () => {
    const result = parseFDX(v6Statement([
      { tax1098: { taxFormType: 'Tax1098', mortgageInterest: 5000 } },
      w2Form({ employer: 'Acme' }),
    ]));

    expect(result.skippedCount).toBe(1);
    expect(result.warnings.some(w => w.includes('Unsupported form type'))).toBe(true);
    expect(result.groupedByType['w2']).toBeDefined();
  });

  it('handles empty forms array', () => {
    const result = parseFDX(v6Statement([]));
    expect(result.errors.some(e => e.includes('No tax forms'))).toBe(true);
  });

  it('handles form with missing/null values gracefully', () => {
    const result = parseFDX(v6Statement([{
      taxW2: {
        taxFormType: 'TaxW2',
        wages: null,
        federalTaxWithheld: undefined,
      },
    }]));

    const item = result.groupedByType['w2'].items[0];
    expect(item.data.wages).toBe(0);
    expect(item.data.federalTaxWithheld).toBe(0);
    expect(item.data.employerName).toBe('Unknown employer');
  });

  it('extracts issuer name from individual name', () => {
    const result = parseFDX(v6Statement([{
      tax1099Nec: {
        taxFormType: 'Tax1099Nec',
        issuer: { partyType: 'INDIVIDUAL', individualName: { first: 'John', last: 'Smith' } },
        nonEmployeeCompensation: 3000,
      },
    }]));

    const item = result.groupedByType['1099nec'].items[0];
    expect(item.data.payerName).toBe('John Smith');
  });

  it('counts valid and error records correctly', () => {
    const result = parseFDX(v6Statement([
      b1099Form([
        { name: 'AAPL', proceeds: 1500, costBasis: 1000 },
        { name: 'BAD', proceeds: 0, costBasis: 0 },
      ]),
    ]));

    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(1);
  });

  it('handles string amounts from non-standard exports', () => {
    const result = parseFDX(v6Statement([{
      taxW2: {
        taxFormType: 'TaxW2',
        issuer: { partyType: 'BUSINESS', businessName: { name1: 'Acme' } },
        wages: '$85,000.50',
        federalTaxWithheld: '12,750',
      },
    }]));

    const item = result.groupedByType['w2'].items[0];
    expect(item.data.wages).toBe(85000.50);
    expect(item.data.federalTaxWithheld).toBe(12750);
  });

  it('handles non-object form content gracefully (e.g., taxW2: "bad")', () => {
    const result = parseFDX(v6Statement([
      { taxW2: 'not an object' },
      w2Form({ employer: 'Acme', wages: 50000 }),
    ]));

    expect(result.skippedCount).toBe(1);
    expect(result.warnings.some(w => w.includes('Invalid taxW2 payload'))).toBe(true);
    expect(result.groupedByType['w2']).toBeDefined();
    expect(result.groupedByType['w2'].items[0].data.wages).toBe(50000);
  });

  it('uses correctedCostBasis when costBasis is zero', () => {
    const result = parseFDX(v6Statement([{
      tax1099B: {
        taxFormType: 'Tax1099B',
        issuer: { partyType: 'BUSINESS', businessName: { name1: 'Schwab' } },
        securityDetails: [{
          securityName: 'GIFT',
          salesPrice: 1000,
          costBasis: 0,
          correctedCostBasis: 200,
          dateOfSale: '2025-06-15',
          dateAcquired: '2020-01-01',
          longOrShort: 'LONG',
        }],
      },
    }]));

    const item = result.groupedByType['1099b'].items[0];
    expect(item.data.costBasis).toBe(200);
  });

  it('sets isPension flag on 1099-R', () => {
    const result = parseFDX(v6Statement([{
      tax1099R: {
        taxFormType: 'Tax1099R',
        issuer: { partyType: 'BUSINESS', businessName: { name1: 'PensionFund' } },
        grossDistribution: 30000,
        taxableAmount: 30000,
        distributionCode: '7',
      },
    }]));

    const item = result.groupedByType['1099r'].items[0];
    expect(item.data.isPension).toBe(true);
    expect(item.data.isIRA).toBe(false);
  });

  it('handles string amounts in state/local withholding via num()', () => {
    const result = parseFDX(v6Statement([{
      tax1099Int: {
        taxFormType: 'Tax1099Int',
        issuer: { partyType: 'BUSINESS', businessName: { name1: 'Bank' } },
        interestIncome: 500,
        stateAndLocal: [{
          stateCode: 'CA',
          state: {
            taxWithheld: '50.00',
            taxableIncome: '500',
          },
        }],
      },
    }]));

    const item = result.groupedByType['1099int'].items[0];
    expect(item.data.stateTaxWithheld).toBe(50);
    expect(item.data.stateWages).toBe(500);
  });
});
