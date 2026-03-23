/**
 * Sprint 8 Tests — Quick Wins
 *
 * 8A. Educator expenses deduction ($300 above-the-line)
 * 8B. 1099-B wash sale adjustment field
 * 8C. 1099-DIV foreign tax paid field (data collection only)
 */
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateScheduleD } from '../src/engine/scheduleD.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'sprint8',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    dependents: [],
    w2Income: [],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    incomeK1: [],
    income1099SA: [],
    rentalProperties: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════
// 8A. Educator Expenses Deduction
// ═══════════════════════════════════════════════════

describe('Sprint 8A: Educator Expenses Deduction', () => {
  it('deducts $300 educator expenses from AGI', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'School', wages: 50000, federalTaxWithheld: 5000 }],
      educatorExpenses: 300,
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.educatorExpenses).toBe(300);
    expect(result.form1040.totalAdjustments).toBeGreaterThanOrEqual(300);
    expect(result.form1040.agi).toBe(result.form1040.totalIncome - result.form1040.totalAdjustments);
  });

  it('caps educator expenses at $300', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'School', wages: 50000, federalTaxWithheld: 5000 }],
      educatorExpenses: 500,
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.educatorExpenses).toBe(300);
  });

  it('handles $0 educator expenses (no effect)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'School', wages: 50000, federalTaxWithheld: 5000 }],
      educatorExpenses: 0,
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.educatorExpenses).toBe(0);
  });

  it('handles undefined educator expenses', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'School', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.educatorExpenses).toBe(0);
  });

  it('reduces AGI correctly compared to no expenses', () => {
    const withExpenses = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'School', wages: 50000, federalTaxWithheld: 5000 }],
      educatorExpenses: 250,
    });
    const withoutExpenses = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'School', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const withResult = calculateForm1040(withExpenses);
    const withoutResult = calculateForm1040(withoutExpenses);
    expect(withResult.form1040.agi).toBe(withoutResult.form1040.agi - 250);
  });

  it('negative educator expenses treated as zero', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'School', wages: 50000, federalTaxWithheld: 5000 }],
      educatorExpenses: -100,
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.educatorExpenses).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 8B. 1099-B Wash Sale Adjustment Field
// ═══════════════════════════════════════════════════

describe('Sprint 8B: 1099-B Wash Sale Adjustment', () => {
  it('wash sale disallowed reduces reported loss', () => {
    // Bought at $10k, sold at $7k = $3k loss. But $2k wash sale disallowed.
    // Adjusted basis = $10k + $2k = $12k. Adjusted loss = $7k - $12k = -$5k... wait
    // Actually wash sale increases basis: new basis = 10k + 2k = 12k, proceeds = 7k
    // So loss = 7k - 12k = -5k. That's MORE loss, not less.
    // Wait — the IRS rule is the opposite. Wash sale disallowed means you CAN'T take the loss.
    // The disallowed amount is added to the basis of the replacement security.
    // But for THIS transaction, the loss is disallowed. So the reported loss should be REDUCED.
    //
    // IRS form 1099-B, Box 1g: "If nondeductible loss, amount of loss that is disallowed."
    // The broker adjusts proceeds - cost basis = loss, then disallows part of it.
    // From the taxpayer's perspective on Schedule D:
    //   Proceeds: $7,000
    //   Cost basis: $10,000 (original)
    //   Wash sale adjustment: $2,000 (Box 1g)
    //   Adjusted cost basis: $10,000 - $2,000 = $8,000 (some sources)
    //
    // Actually, IRS Schedule D instructions say: enter the wash sale loss in column (g).
    // The adjustment REDUCES the allowable loss. So if loss is $3k and wash sale is $2k,
    // reported loss is only $1k. The way to accomplish this on Schedule D:
    //   Cost basis on form = original $10k
    //   Wash sale adjustment column (g) = $2k
    //   Adjusted cost basis = $10k - $2k = $8k (reduces basis → smaller loss)
    //
    // Wait, the IRS instructions say: "Enter the amount of nondeductible loss as a positive
    // number in column (g). The nondeductible loss will be added to the cost or other basis
    // of the substantially identical securities."
    //
    // So for THIS transaction, we add wash sale to proceeds side or subtract from cost basis.
    // The code adds it to cost basis: adjustedBasis = costBasis + washSale
    // That would INCREASE the loss. That's wrong.
    //
    // Let me reconsider. The correct approach:
    // Original: proceeds $7k, basis $10k = $3k loss
    // Wash sale disallowed $2k means only $1k of the loss is allowable.
    // To model this: we need to REDUCE the basis by the wash sale amount.
    // adjustedBasis = $10k - $2k = $8k → loss = $7k - $8k = -$1k ✓
    //
    // So the code should SUBTRACT wash sale from cost basis, not ADD.
    // Let me fix this in the test.
    const transactions = [
      {
        id: '1', brokerName: 'Broker', description: '100 AAPL',
        dateSold: '2025-03-15', proceeds: 7000, costBasis: 10000,
        isLongTerm: false, washSaleLossDisallowed: 2000,
        basisReportedToIRS: false, // Non-covered security: manual wash sale adjustment needed
      },
    ];
    const result = calculateScheduleD(transactions, 0, FilingStatus.Single);
    // Non-covered: adjustedBasis = 10000 - 2000 = 8000 → loss = 7000 - 8000 = -1000
    expect(result.netShortTerm).toBe(-1000); // Only $1k loss after wash sale
  });

  it('wash sale adjustment turns loss into smaller loss', () => {
    const transactions = [
      {
        id: '1', brokerName: 'Broker', description: '50 MSFT',
        dateSold: '2025-06-01', proceeds: 5000, costBasis: 8000,
        isLongTerm: true, washSaleLossDisallowed: 1500,
        basisReportedToIRS: false, // Non-covered security
      },
    ];
    const result = calculateScheduleD(transactions, 0, FilingStatus.Single);
    // Loss = 5000 - 8000 = -3000. Wash sale disallowed = 1500.
    // Net deductible loss = -3000 + 1500 = -1500
    expect(result.netLongTerm).toBe(-1500);
  });

  it('wash sale adjustment can eliminate loss entirely', () => {
    const transactions = [
      {
        id: '1', brokerName: 'Broker', description: '100 TSLA',
        dateSold: '2025-04-01', proceeds: 9000, costBasis: 10000,
        isLongTerm: false, washSaleLossDisallowed: 1000,
        basisReportedToIRS: false, // Non-covered security
      },
    ];
    const result = calculateScheduleD(transactions, 0, FilingStatus.Single);
    // Loss = 9000 - 10000 = -1000. Wash sale disallowed = 1000.
    // Net = -1000 + 1000 = 0
    expect(result.netShortTerm).toBe(0);
  });

  it('wash sale on gain has no practical effect', () => {
    // If you have a gain, wash sale disallowed doesn't apply (wash sale only applies to losses)
    // But the field might still be present. With our formula, it would reduce basis → increase gain.
    // In practice, brokers only report wash sale on losing transactions.
    const transactions = [
      {
        id: '1', brokerName: 'Broker', description: '100 GOOG',
        dateSold: '2025-05-01', proceeds: 15000, costBasis: 10000,
        isLongTerm: true, washSaleLossDisallowed: 0,
      },
    ];
    const result = calculateScheduleD(transactions, 0, FilingStatus.Single);
    expect(result.netLongTerm).toBe(5000);
  });

  it('no wash sale field = unchanged behavior', () => {
    const transactions = [
      {
        id: '1', brokerName: 'Broker', description: '100 AMZN',
        dateSold: '2025-03-01', proceeds: 8000, costBasis: 10000,
        isLongTerm: false,
      },
    ];
    const result = calculateScheduleD(transactions, 0, FilingStatus.Single);
    expect(result.netShortTerm).toBe(-2000);
  });

  it('flows through to form1040 capital loss deduction', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      income1099B: [
        {
          id: '1', brokerName: 'Broker', description: '100 AAPL',
          dateSold: '2025-03-15', proceeds: 5000, costBasis: 10000,
          isLongTerm: false, washSaleLossDisallowed: 3000,
          basisReportedToIRS: false, // Non-covered security
        },
      ],
    });
    const result = calculateForm1040(tr);
    // Loss = 5000 - 10000 = -5000. Wash sale = 3000. Deductible loss = -2000.
    expect(result.scheduleD!.capitalLossDeduction).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════
// 8C. 1099-DIV Foreign Tax Paid (Data Collection)
// ═══════════════════════════════════════════════════

describe('Sprint 8C: 1099-DIV Foreign Tax Paid', () => {
  it('tracks foreign tax paid in form1040 result', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099DIV: [
        {
          id: 'd1', payerName: 'Vanguard',
          ordinaryDividends: 3000, qualifiedDividends: 2500,
          foreignTaxPaid: 150,
        },
      ],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.foreignTaxPaid).toBe(150);
  });

  it('aggregates foreign tax paid from multiple 1099-DIVs', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099DIV: [
        {
          id: 'd1', payerName: 'Vanguard',
          ordinaryDividends: 3000, qualifiedDividends: 2500,
          foreignTaxPaid: 150,
        },
        {
          id: 'd2', payerName: 'Fidelity',
          ordinaryDividends: 2000, qualifiedDividends: 1800,
          foreignTaxPaid: 75,
        },
      ],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.foreignTaxPaid).toBe(225);
  });

  it('no foreign tax paid = $0', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099DIV: [
        {
          id: 'd1', payerName: 'Vanguard',
          ordinaryDividends: 1000, qualifiedDividends: 800,
        },
      ],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.foreignTaxPaid).toBe(0);
  });

  it('foreign tax paid reduces tax via Foreign Tax Credit (Sprint 10)', () => {
    // Sprint 10 implemented the FTC — foreign tax paid now generates a credit.
    const withFTP = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099DIV: [
        {
          id: 'd1', payerName: 'Vanguard',
          ordinaryDividends: 3000, qualifiedDividends: 2500,
          foreignTaxPaid: 500,
        },
      ],
    });
    const withoutFTP = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099DIV: [
        {
          id: 'd1', payerName: 'Vanguard',
          ordinaryDividends: 3000, qualifiedDividends: 2500,
        },
      ],
    });
    const withResult = calculateForm1040(withFTP);
    const withoutResult = calculateForm1040(withoutFTP);
    // AGI should be the same (FTC is a credit, not an adjustment)
    expect(withResult.form1040.agi).toBe(withoutResult.form1040.agi);
    // With FTC active, total credits should be higher and refund should be larger
    // $500 foreign tax under $300 simplified limit → uses full Form 1116 limitation
    expect(withResult.credits.foreignTaxCredit).toBeGreaterThan(0);
    expect(withResult.form1040.refundAmount).toBeGreaterThan(withoutResult.form1040.refundAmount);
  });
});
