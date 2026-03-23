/**
 * Prior Year Importer Unit Tests
 *
 * Tests JSON import (full engine run), PDF AcroForm extraction (mocked),
 * carryforward suggestion extraction, and edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TaxReturn } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';

// Mock pdfjs-dist so we can test PDF import without a real PDF
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { importPriorYearJSON, importPriorYear1040PDF } from '../services/priorYearImporter';
import * as pdfjsLib from 'pdfjs-dist';

// ─── Helpers ─────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'prior-year-return',
    schemaVersion: 1,
    taxYear: 2024,
    status: 'completed',
    currentStep: 0,
    currentSection: 'finish',
    filingStatus: FilingStatus.Single,
    dependents: [],
    w2Income: [{
      id: 'w2-1',
      employerName: 'Acme Corp',
      wages: 75000,
      federalTaxWithheld: 12000,
    }],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [{ id: 'int-1', payerName: 'Bank', amount: 500 }],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    rentalProperties: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    businesses: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-12-31T00:00:00Z',
    ...overrides,
  } as TaxReturn;
}

function makeFile(content: string, name = 'return.json'): File {
  return new File([content], name, { type: 'application/json' });
}

// ─── JSON Import Tests ───────────────────────────

describe('importPriorYearJSON', () => {
  it('imports a valid TelosTax JSON export', async () => {
    const tr = makeTaxReturn();
    const file = makeFile(JSON.stringify(tr));

    const result = await importPriorYearJSON(file);

    expect(result.summary.source).toBe('telostax-json');
    expect(result.summary.taxYear).toBe(2024);
    expect(result.summary.totalIncome).toBeGreaterThan(0);
    expect(result.summary.agi).toBeGreaterThan(0);
    expect(result.summary.taxableIncome).toBeGreaterThan(0);
    expect(result.summary.deductionAmount).toBeGreaterThan(0);
    expect(result.summary.effectiveTaxRate).toBeGreaterThan(0);
    expect(result.summary.effectiveTaxRate).toBeLessThan(1);
    expect(result.errors).toHaveLength(0);
  });

  it('includes detailed breakdown fields from JSON import', async () => {
    const tr = makeTaxReturn();
    const file = makeFile(JSON.stringify(tr));

    const result = await importPriorYearJSON(file);

    expect(result.summary.totalWages).toBe(75000);
    expect(result.summary.totalInterest).toBe(500);
  });

  it('extracts filing status as string', async () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.MarriedFilingJointly });
    const file = makeFile(JSON.stringify(tr));

    const result = await importPriorYearJSON(file);

    expect(result.summary.filingStatus).toBe('MarriedFilingJointly');
  });

  it('warns when importing a current-year return', async () => {
    const tr = makeTaxReturn({ taxYear: 2025 });
    const file = makeFile(JSON.stringify(tr));

    const result = await importPriorYearJSON(file);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('2025');
  });

  it('throws on invalid JSON', async () => {
    const file = makeFile('not json at all');

    await expect(importPriorYearJSON(file)).rejects.toThrow('Invalid JSON');
  });

  it('throws on missing required fields', async () => {
    const file = makeFile(JSON.stringify({ foo: 'bar' }));

    await expect(importPriorYearJSON(file)).rejects.toThrow('Missing required fields');
  });

  it('throws on missing id field', async () => {
    const file = makeFile(JSON.stringify({ taxYear: 2024, schemaVersion: 1 }));

    await expect(importPriorYearJSON(file)).rejects.toThrow('Missing required fields');
  });

  it('computes refund when withholding exceeds tax', async () => {
    const tr = makeTaxReturn({
      w2Income: [{
        id: 'w2-1',
        employerName: 'Employer',
        wages: 50000,
        federalTaxWithheld: 15000,
      }],
    });
    const file = makeFile(JSON.stringify(tr));

    const result = await importPriorYearJSON(file);

    expect(result.summary.refundAmount).toBeGreaterThan(0);
    expect(result.summary.amountOwed).toBe(0);
  });

  it('computes amount owed when withholding is insufficient', async () => {
    const tr = makeTaxReturn({
      w2Income: [{
        id: 'w2-1',
        employerName: 'Employer',
        wages: 200000,
        federalTaxWithheld: 5000,
      }],
    });
    const file = makeFile(JSON.stringify(tr));

    const result = await importPriorYearJSON(file);

    expect(result.summary.amountOwed).toBeGreaterThan(0);
    expect(result.summary.refundAmount).toBe(0);
  });

  it('extracts capital loss carryforward suggestions', async () => {
    const tr = makeTaxReturn({
      income1099B: [{
        id: 'b-1',
        brokerName: 'Schwab',
        description: 'AAPL',
        proceeds: 5000,
        costBasis: 25000,
        isLongTerm: false,
        dateAcquired: '2024-06-01',
        dateSold: '2024-09-01',
      }],
    });
    const file = makeFile(JSON.stringify(tr));

    const result = await importPriorYearJSON(file);

    // Should suggest ST carryforward since the loss is short-term
    expect(result.carryforwardSuggestions.capitalLossCarryforwardST).toBeGreaterThan(0);
  });

  it('extracts prior-year tax for safe harbor', async () => {
    const tr = makeTaxReturn();
    const file = makeFile(JSON.stringify(tr));

    const result = await importPriorYearJSON(file);

    expect(result.carryforwardSuggestions.priorYearTax).toBeGreaterThan(0);
  });

  it('handles zero-income return gracefully', async () => {
    const tr = makeTaxReturn({
      w2Income: [],
      income1099INT: [],
    });
    const file = makeFile(JSON.stringify(tr));

    const result = await importPriorYearJSON(file);

    expect(result.summary.totalIncome).toBe(0);
    expect(result.summary.effectiveTaxRate).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('handles self-employment income', async () => {
    const tr = makeTaxReturn({
      w2Income: [],
      income1099INT: [],
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 100000 }],
      businesses: [{
        id: 'biz-1',
        businessName: 'Consulting',
        businessEin: '',
        principalBusinessCode: '',
        businessDescription: 'Consulting services',
        accountingMethod: 'cash' as const,
        didStartThisYear: false,
      }],
    });
    const file = makeFile(JSON.stringify(tr));

    const result = await importPriorYearJSON(file);

    expect(result.summary.scheduleCNetProfit).toBeGreaterThan(0);
    expect(result.summary.seTax).toBeGreaterThan(0);
  });
});

// ─── PDF Import Tests ────────────────────────────

describe('importPriorYear1040PDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockPdf(annotations: Array<{ fieldName: string; fieldValue: string }>, headerText = 'Form 1040 (2024)') {
    const mockPage = {
      getAnnotations: vi.fn().mockResolvedValue(
        annotations.map(a => ({
          subtype: 'Widget',
          fieldName: a.fieldName,
          fieldValue: a.fieldValue,
        }))
      ),
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: headerText, transform: [0, 0, 0, 0, 100, 700], width: 200, height: 14 }],
      }),
      getViewport: vi.fn().mockReturnValue({ height: 792 }),
    };

    const mockDoc = {
      numPages: 2,
      getPage: vi.fn().mockResolvedValue(mockPage),
    };

    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: Promise.resolve(mockDoc),
    } as unknown as ReturnType<typeof pdfjsLib.getDocument>);

    return mockDoc;
  }

  it('extracts data from AcroForm fields', async () => {
    const P1 = 'topmostSubform[0].Page1[0]';
    const P2 = 'topmostSubform[0].Page2[0]';

    mockPdf([
      { fieldName: `${P1}.f1_47[0]`, fieldValue: '75,000' },
      { fieldName: `${P1}.f1_69[0]`, fieldValue: '76,500' },
      { fieldName: `${P1}.f1_71[0]`, fieldValue: '76,500' },
      { fieldName: `${P2}.f2_02[0]`, fieldValue: '14,600' },
      { fieldName: `${P2}.f2_06[0]`, fieldValue: '61,900' },
      { fieldName: `${P2}.f2_15[0]`, fieldValue: '9,256' },
      { fieldName: `${P2}.f2_28[0]`, fieldValue: '12,000' },
      { fieldName: `${P2}.f2_30[0]`, fieldValue: '2,744' },
      { fieldName: `${P2}.f2_35[0]`, fieldValue: '' },
    ]);

    const file = new File(['fake-pdf'], 'return.pdf', { type: 'application/pdf' });
    const result = await importPriorYear1040PDF(file);

    expect(result.summary.source).toBe('1040-pdf');
    expect(result.summary.taxYear).toBe(2024);
    expect(result.summary.totalWages).toBe(75000);
    expect(result.summary.totalIncome).toBe(76500);
    expect(result.summary.agi).toBe(76500);
    expect(result.summary.deductionAmount).toBe(14600);
    expect(result.summary.taxableIncome).toBe(61900);
    expect(result.summary.totalTax).toBe(9256);
    expect(result.summary.totalPayments).toBe(12000);
    expect(result.summary.refundAmount).toBe(2744);
    expect(result.summary.amountOwed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('detects tax year from header text', async () => {
    mockPdf([
      { fieldName: 'topmostSubform[0].Page1[0].f1_69[0]', fieldValue: '50000' },
    ], 'Department of the Treasury Form 1040 2023');

    const file = new File(['fake-pdf'], 'return.pdf', { type: 'application/pdf' });
    const result = await importPriorYear1040PDF(file);

    expect(result.summary.taxYear).toBe(2023);
  });

  it('computes effective tax rate', async () => {
    mockPdf([
      { fieldName: 'topmostSubform[0].Page1[0].f1_69[0]', fieldValue: '100000' },
      { fieldName: 'topmostSubform[0].Page2[0].f2_15[0]', fieldValue: '15000' },
    ]);

    const file = new File(['fake-pdf'], 'return.pdf', { type: 'application/pdf' });
    const result = await importPriorYear1040PDF(file);

    expect(result.summary.effectiveTaxRate).toBeCloseTo(0.15);
  });

  it('throws when no data can be extracted', async () => {
    mockPdf([]);

    const file = new File(['fake-pdf'], 'return.pdf', { type: 'application/pdf' });

    await expect(importPriorYear1040PDF(file)).rejects.toThrow('Could not extract any data');
  });

  it('provides priorYearTax in carryforward suggestions', async () => {
    mockPdf([
      { fieldName: 'topmostSubform[0].Page1[0].f1_69[0]', fieldValue: '80000' },
      { fieldName: 'topmostSubform[0].Page2[0].f2_15[0]', fieldValue: '10500' },
    ]);

    const file = new File(['fake-pdf'], 'return.pdf', { type: 'application/pdf' });
    const result = await importPriorYear1040PDF(file);

    expect(result.carryforwardSuggestions.priorYearTax).toBe(10500);
  });

  it('falls back to text extraction when AcroForm fields are empty', async () => {
    const mockPage = {
      getAnnotations: vi.fn().mockResolvedValue([]),
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          { str: 'Form 1040 (2024)', transform: [0, 0, 0, 0, 100, 700], width: 200, height: 14 },
          { str: 'Total income', transform: [0, 0, 0, 0, 50, 400], width: 80, height: 10 },
          { str: '85,000', transform: [0, 0, 0, 0, 400, 400], width: 50, height: 10 },
          { str: 'Adjusted gross income', transform: [0, 0, 0, 0, 50, 380], width: 120, height: 10 },
          { str: '85,000', transform: [0, 0, 0, 0, 400, 380], width: 50, height: 10 },
          { str: 'Total tax', transform: [0, 0, 0, 0, 50, 300], width: 60, height: 10 },
          { str: '12,000', transform: [0, 0, 0, 0, 400, 300], width: 50, height: 10 },
        ],
      }),
      getViewport: vi.fn().mockReturnValue({ height: 792 }),
    };

    const mockDoc = {
      numPages: 2,
      getPage: vi.fn().mockResolvedValue(mockPage),
    };

    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: Promise.resolve(mockDoc),
    } as unknown as ReturnType<typeof pdfjsLib.getDocument>);

    const file = new File(['fake-pdf'], 'return.pdf', { type: 'application/pdf' });
    const result = await importPriorYear1040PDF(file);

    expect(result.summary.totalIncome).toBe(85000);
    expect(result.summary.totalTax).toBe(12000);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('text extraction')]));
  });

  it('handles dollar signs and commas in field values', async () => {
    mockPdf([
      { fieldName: 'topmostSubform[0].Page1[0].f1_69[0]', fieldValue: '$125,450' },
      { fieldName: 'topmostSubform[0].Page2[0].f2_15[0]', fieldValue: '$18,234' },
    ]);

    const file = new File(['fake-pdf'], 'return.pdf', { type: 'application/pdf' });
    const result = await importPriorYear1040PDF(file);

    expect(result.summary.totalIncome).toBe(125450);
    expect(result.summary.totalTax).toBe(18234);
  });

  it('rejects files over the size limit', async () => {
    const hugeFile = new File(['x'.repeat(26 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' });

    await expect(importPriorYear1040PDF(hugeFile)).rejects.toThrow('too large');
  });

  it('warns when importing a current-year PDF', async () => {
    mockPdf([
      { fieldName: 'topmostSubform[0].Page1[0].f1_69[0]', fieldValue: '50000' },
      { fieldName: 'topmostSubform[0].Page2[0].f2_15[0]', fieldValue: '7500' },
    ], 'Form 1040 (2025)');

    const file = new File(['fake-pdf'], 'return.pdf', { type: 'application/pdf' });
    const result = await importPriorYear1040PDF(file);

    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('2025')]));
  });
});
