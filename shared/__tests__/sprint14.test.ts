import { describe, it, expect } from 'vitest';
import { calculateCancellationOfDebt, applyAttributeReduction } from '../src/engine/cancellationOfDebt.js';
import { calculateInvestmentInterest } from '../src/engine/investmentInterest.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { FilingStatus, TaxReturn, Income1099C, Form982Info } from '../src/types/index.js';
import { CANCELLATION_OF_DEBT } from '../src/constants/tax2025.js';

// ─── Helper: minimal valid TaxReturn ───────────────────
function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint14',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    income1099DA: [],
    income1099C: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    rentalProperties: [],
    otherIncome: 0,
    deductionMethod: 'standard',
    dependents: [],
    expenses: [],
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════
// 1099-DA: Digital Asset / Crypto Reporting
// ════════════════════════════════════════════════════════

describe('1099-DA: Digital Asset / Crypto → Schedule D', () => {
  it('short-term crypto gain adds to ordinary income via Schedule D', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099DA: [{
        id: 'da-1', brokerName: 'Coinbase', tokenName: 'Bitcoin', tokenSymbol: 'BTC',
        dateSold: '2025-06-15', proceeds: 15000, costBasis: 10000, isLongTerm: false,
      }],
    }));
    expect(result.scheduleD).toBeDefined();
    expect(result.scheduleD!.netShortTerm).toBe(5000);
    expect(result.form1040.scheduleDNetGain).toBe(5000);
  });

  it('long-term crypto gain gets preferential rate treatment', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099DA: [{
        id: 'da-1', brokerName: 'Kraken', tokenName: 'Ethereum', tokenSymbol: 'ETH',
        dateSold: '2025-09-01', proceeds: 20000, costBasis: 5000, isLongTerm: true,
      }],
    }));
    expect(result.scheduleD).toBeDefined();
    expect(result.scheduleD!.netLongTerm).toBe(15000);
    expect(result.form1040.preferentialTax).toBeGreaterThan(0);
  });

  it('crypto loss is deductible up to $3k limit', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099DA: [{
        id: 'da-1', brokerName: 'Gemini', tokenName: 'Solana', tokenSymbol: 'SOL',
        dateSold: '2025-04-01', proceeds: 1000, costBasis: 20000, isLongTerm: false,
      }],
    }));
    expect(result.scheduleD).toBeDefined();
    expect(result.form1040.capitalLossDeduction).toBe(3000);
    expect(result.scheduleD!.capitalLossCarryforward).toBe(16000); // 19000 loss - 3000 deduction
  });

  it('mixes 1099-B and 1099-DA transactions together', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099B: [{
        id: 'b-1', brokerName: 'Fidelity', description: '100 AAPL',
        dateSold: '2025-03-01', proceeds: 15000, costBasis: 10000, isLongTerm: true,
      }],
      income1099DA: [{
        id: 'da-1', brokerName: 'Coinbase', tokenName: 'Bitcoin', tokenSymbol: 'BTC',
        dateSold: '2025-06-15', proceeds: 8000, costBasis: 5000, isLongTerm: true,
      }],
    }));
    expect(result.scheduleD).toBeDefined();
    // 5000 stock LTCG + 3000 crypto LTCG = 8000
    expect(result.scheduleD!.netLongTerm).toBe(8000);
  });

  it('crypto wash sale loss adjustment works', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099DA: [{
        id: 'da-1', brokerName: 'Coinbase', tokenName: 'Bitcoin', tokenSymbol: 'BTC',
        dateSold: '2025-06-15', proceeds: 5000, costBasis: 10000, isLongTerm: false,
        washSaleLossDisallowed: 3000, isBasisReportedToIRS: false, // Non-covered: manual adjustment
      }],
    }));
    expect(result.scheduleD).toBeDefined();
    // Loss = 5000 - 10000 = -5000, but wash sale disallows 3000 → adjusted loss = -2000
    expect(result.scheduleD!.netShortTerm).toBe(-2000);
  });

  it('zero-cost-basis airdrop/mining income is fully taxable gain', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099DA: [{
        id: 'da-1', brokerName: 'Exchange', tokenName: 'Airdrop Token', tokenSymbol: 'AIR',
        dateSold: '2025-08-01', proceeds: 2000, costBasis: 0, isLongTerm: false,
        isBasisReportedToIRS: false,
      }],
    }));
    expect(result.scheduleD).toBeDefined();
    expect(result.scheduleD!.netShortTerm).toBe(2000);
  });

  it('1099-DA withholding flows to total withholding', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099DA: [{
        id: 'da-1', brokerName: 'Coinbase', tokenName: 'Bitcoin', tokenSymbol: 'BTC',
        dateSold: '2025-06-15', proceeds: 50000, costBasis: 20000, isLongTerm: true,
        federalTaxWithheld: 4500,
      }],
    }));
    // W-2 withholding (8000) + 1099-DA withholding (4500) = 12500
    expect(result.form1040.totalWithholding).toBe(12500);
  });

  it('no 1099-DA means no Schedule D triggered (if no 1099-B)', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099DA: [],
    }));
    expect(result.scheduleD).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════
// Cancellation of Debt: 1099-C / Form 982
// ════════════════════════════════════════════════════════

describe('Cancellation of Debt (1099-C)', () => {
  it('fully taxable when no Form 982 exclusion', () => {
    const forms: Income1099C[] = [{
      id: 'c-1', payerName: 'Chase Bank',
      dateOfCancellation: '2025-03-15',
      amountCancelled: 15000,
    }];
    const result = calculateCancellationOfDebt(forms);
    expect(result.totalCancelledDebt).toBe(15000);
    expect(result.taxableAmount).toBe(15000);
    expect(result.exclusionAmount).toBe(0);
  });

  it('insolvency exclusion limits exclusion to insolvency amount', () => {
    const forms: Income1099C[] = [{
      id: 'c-1', payerName: 'Bank', dateOfCancellation: '2025-01-01',
      amountCancelled: 20000,
    }];
    const form982: Form982Info = {
      isInsolvent: true,
      totalLiabilitiesBefore: 80000,
      totalAssetsBefore: 65000, // insolvency = 15000
    };
    const result = calculateCancellationOfDebt(forms, form982);
    expect(result.insolvencyAmount).toBe(15000);
    expect(result.exclusionAmount).toBe(15000);
    expect(result.taxableAmount).toBe(5000); // 20000 - 15000
  });

  it('insolvency fully excludes when insolvency exceeds cancelled debt', () => {
    const forms: Income1099C[] = [{
      id: 'c-1', payerName: 'Bank', dateOfCancellation: '2025-01-01',
      amountCancelled: 10000,
    }];
    const form982: Form982Info = {
      isInsolvent: true,
      totalLiabilitiesBefore: 100000,
      totalAssetsBefore: 50000, // insolvency = 50000
    };
    const result = calculateCancellationOfDebt(forms, form982);
    expect(result.exclusionAmount).toBe(10000);
    expect(result.taxableAmount).toBe(0);
  });

  it('bankruptcy exclusion fully excludes all cancelled debt', () => {
    const forms: Income1099C[] = [{
      id: 'c-1', payerName: 'Bank', dateOfCancellation: '2025-01-01',
      amountCancelled: 50000,
    }];
    const form982: Form982Info = {
      isInsolvent: false,
      totalLiabilitiesBefore: 0,
      totalAssetsBefore: 0,
      isBankruptcy: true,
    };
    const result = calculateCancellationOfDebt(forms, form982);
    expect(result.exclusionAmount).toBe(50000);
    expect(result.taxableAmount).toBe(0);
  });

  it('qualified principal residence exclusion', () => {
    const forms: Income1099C[] = [{
      id: 'c-1', payerName: 'Mortgage Lender', dateOfCancellation: '2025-06-01',
      amountCancelled: 100000,
    }];
    const form982: Form982Info = {
      isInsolvent: false,
      totalLiabilitiesBefore: 0,
      totalAssetsBefore: 0,
      isQualifiedPrincipalResidence: true,
    };
    const result = calculateCancellationOfDebt(forms, form982);
    expect(result.exclusionAmount).toBe(100000);
    expect(result.taxableAmount).toBe(0);
  });

  it('qualified farm debt exclusion', () => {
    const forms: Income1099C[] = [{
      id: 'c-1', payerName: 'Farm Credit', dateOfCancellation: '2025-09-01',
      amountCancelled: 30000,
    }];
    const form982: Form982Info = {
      isInsolvent: false,
      totalLiabilitiesBefore: 0,
      totalAssetsBefore: 0,
      isQualifiedFarmDebt: true,
    };
    const result = calculateCancellationOfDebt(forms, form982);
    expect(result.exclusionAmount).toBe(30000);
    expect(result.taxableAmount).toBe(0);
  });

  it('aggregates multiple 1099-C forms', () => {
    const forms: Income1099C[] = [
      { id: 'c-1', payerName: 'Bank A', dateOfCancellation: '2025-01-01', amountCancelled: 5000 },
      { id: 'c-2', payerName: 'Bank B', dateOfCancellation: '2025-06-01', amountCancelled: 8000 },
      { id: 'c-3', payerName: 'Bank C', dateOfCancellation: '2025-09-01', amountCancelled: 7000 },
    ];
    const result = calculateCancellationOfDebt(forms);
    expect(result.totalCancelledDebt).toBe(20000);
    expect(result.taxableAmount).toBe(20000);
  });

  it('returns zero for empty 1099-C array', () => {
    const result = calculateCancellationOfDebt([]);
    expect(result.totalCancelledDebt).toBe(0);
    expect(result.taxableAmount).toBe(0);
  });

  it('1099-C withholding flows to total withholding', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099C: [{
        id: 'c-1', payerName: 'Bank', dateOfCancellation: '2025-01-01',
        amountCancelled: 10000, federalTaxWithheld: 2400,
      }],
    }));
    // W-2 (8000) + 1099-C (2400) = 10400
    expect(result.form1040.totalWithholding).toBe(10400);
  });
});

// ════════════════════════════════════════════════════════
// Form 982 Part II: Attribute Reduction (IRC §108(b)(2))
// ════════════════════════════════════════════════════════

describe('Form 982 Part II — Attribute Reduction', () => {
  const baseResult = (exclusion: number) => calculateCancellationOfDebt(
    [{ id: 'c-1', payerName: 'Bank', dateOfCancellation: '2025-01-01', amountCancelled: exclusion }],
    { isInsolvent: false, totalLiabilitiesBefore: 0, totalAssetsBefore: 0, isBankruptcy: true },
  );

  it('reduces NOL first per mandatory order', () => {
    const result = applyAttributeReduction(baseResult(10000), {
      nol: 8000, capitalLoss: 5000, passiveActivityLoss: 3000,
    });
    expect(result.nolReduction).toBe(8000);
    expect(result.capitalLossReduction).toBe(2000); // remaining 2000
    expect(result.palReduction).toBe(0);
    expect(result.basisReduction).toBe(0);
  });

  it('allocates to capital loss after NOL is exhausted', () => {
    const result = applyAttributeReduction(baseResult(15000), {
      nol: 5000, capitalLoss: 7000, passiveActivityLoss: 2000,
    });
    expect(result.nolReduction).toBe(5000);
    expect(result.capitalLossReduction).toBe(7000);
    expect(result.palReduction).toBe(2000);
    expect(result.basisReduction).toBe(1000); // remainder
  });

  it('remainder goes to basis reduction (Line 8)', () => {
    const result = applyAttributeReduction(baseResult(50000), {
      nol: 3000, capitalLoss: 2000, passiveActivityLoss: 1000,
    });
    expect(result.nolReduction).toBe(3000);
    expect(result.capitalLossReduction).toBe(2000);
    expect(result.palReduction).toBe(1000);
    expect(result.basisReduction).toBe(44000); // 50000 - 3000 - 2000 - 1000
  });

  it('zero exclusion produces zero reductions', () => {
    const zeroResult = calculateCancellationOfDebt([], undefined);
    const result = applyAttributeReduction(zeroResult, {
      nol: 10000, capitalLoss: 5000, passiveActivityLoss: 2000,
    });
    expect(result.nolReduction).toBe(0);
    expect(result.capitalLossReduction).toBe(0);
    expect(result.palReduction).toBe(0);
    expect(result.basisReduction).toBe(0);
  });

  it('no attributes available — entire exclusion goes to basis', () => {
    const result = applyAttributeReduction(baseResult(20000), {
      nol: 0, capitalLoss: 0, passiveActivityLoss: 0,
    });
    expect(result.nolReduction).toBe(0);
    expect(result.capitalLossReduction).toBe(0);
    expect(result.palReduction).toBe(0);
    expect(result.basisReduction).toBe(20000);
  });

  it('GBC and MTC are always zero (not tracked)', () => {
    const result = applyAttributeReduction(baseResult(10000), {
      nol: 10000, capitalLoss: 5000, passiveActivityLoss: 3000,
    });
    expect(result.gbcReduction).toBe(0);
    expect(result.mtcReduction).toBe(0);
  });

  it('integrates with full Form 1040 calculation', () => {
    const calc = calculateForm1040(baseTaxReturn({
      income1099C: [{
        id: 'c-1', payerName: 'Bank', dateOfCancellation: '2025-01-01',
        amountCancelled: 25000,
      }],
      form982: {
        isInsolvent: true,
        totalLiabilitiesBefore: 100000,
        totalAssetsBefore: 70000, // insolvency = 30000, so exclusion = 25000 (all excluded)
      },
      // Add capital loss carryforward to test attribute reduction
      capitalLossCarryforwardST: 5000,
    }));

    expect(calc.form982).toBeDefined();
    expect(calc.form982!.exclusionAmount).toBe(25000);
    // Attribute reduction should have been computed
    // NOL should be 0 (no NOL in this scenario)
    expect(calc.form982!.nolReduction).toBe(0);
    // Capital loss carryforward of $5000 should be reduced
    expect(calc.form982!.capitalLossReduction).toBe(5000);
    // Remainder goes to basis: 25000 - 5000 = 20000
    expect(calc.form982!.basisReduction).toBe(20000);
  });
});

// ════════════════════════════════════════════════════════
// Investment Interest Expense (Form 4952)
// ════════════════════════════════════════════════════════

describe('Investment Interest Expense (Form 4952)', () => {
  it('deduction limited to net investment income', () => {
    const result = calculateInvestmentInterest(
      { investmentInterestPaid: 5000 },
      2000, // interest income
      3000, // ordinary dividends
      1500, // qualified dividends (subset of ordinary)
      0,    // net LTCG
    );
    // NII = interest (2000) + non-qualified dividends (3000 - 1500 = 1500) = 3500
    expect(result.netInvestmentIncome).toBe(3500);
    expect(result.deductibleAmount).toBe(3500);
    expect(result.carryforward).toBe(1500); // 5000 - 3500
  });

  it('full deduction when expense <= NII', () => {
    const result = calculateInvestmentInterest(
      { investmentInterestPaid: 1000 },
      5000, 3000, 1000, 0,
    );
    // NII = 5000 + (3000 - 1000) = 7000
    expect(result.deductibleAmount).toBe(1000);
    expect(result.carryforward).toBe(0);
  });

  it('includes prior year disallowed carryforward', () => {
    const result = calculateInvestmentInterest(
      { investmentInterestPaid: 3000, priorYearDisallowed: 2000 },
      4000, 0, 0, 0,
    );
    // Total expense = 3000 + 2000 = 5000, NII = 4000
    expect(result.totalExpense).toBe(5000);
    expect(result.deductibleAmount).toBe(4000);
    expect(result.carryforward).toBe(1000);
  });

  it('election to include qualified dividends in NII', () => {
    const result = calculateInvestmentInterest(
      { investmentInterestPaid: 5000, electToIncludeQualifiedDividends: true },
      1000, 4000, 3000, 0,
    );
    // Without election: NII = 1000 + (4000 - 3000) = 2000
    // With election: NII = 2000 + 3000 = 5000
    expect(result.netInvestmentIncome).toBe(5000);
    expect(result.deductibleAmount).toBe(5000);
    expect(result.carryforward).toBe(0);
  });

  it('election to include net LTCG in NII', () => {
    const result = calculateInvestmentInterest(
      { investmentInterestPaid: 8000, electToIncludeLTCG: true },
      1000, 2000, 500, 6000,
    );
    // NII = 1000 + (2000 - 500) + 6000 = 8500
    expect(result.netInvestmentIncome).toBe(8500);
    expect(result.deductibleAmount).toBe(8000);
    expect(result.carryforward).toBe(0);
  });

  it('returns zero for zero investment interest paid', () => {
    const result = calculateInvestmentInterest(
      { investmentInterestPaid: 0 },
      10000, 5000, 2000, 3000,
    );
    expect(result.deductibleAmount).toBe(0);
    expect(result.carryforward).toBe(0);
    expect(result.totalExpense).toBe(0);
  });

  it('zero NII means full carryforward', () => {
    const result = calculateInvestmentInterest(
      { investmentInterestPaid: 3000 },
      0, 0, 0, 0,
    );
    expect(result.deductibleAmount).toBe(0);
    expect(result.carryforward).toBe(3000);
  });
});

// ════════════════════════════════════════════════════════
// Form 1040 Integration
// ════════════════════════════════════════════════════════

describe('Sprint 14: Form 1040 Integration', () => {
  it('COD income adds to total income', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099C: [{
        id: 'c-1', payerName: 'Bank', dateOfCancellation: '2025-01-01',
        amountCancelled: 10000,
      }],
    }));
    expect(result.form1040.cancellationOfDebtIncome).toBe(10000);
    // totalIncome should be wages (60000) + COD (10000) = 70000
    expect(result.form1040.totalIncome).toBe(70000);
  });

  it('COD with insolvency exclusion only adds taxable portion', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099C: [{
        id: 'c-1', payerName: 'Bank', dateOfCancellation: '2025-01-01',
        amountCancelled: 20000,
      }],
      form982: {
        isInsolvent: true,
        totalLiabilitiesBefore: 50000,
        totalAssetsBefore: 40000, // insolvency = 10000
      },
    }));
    expect(result.form982).toBeDefined();
    expect(result.form982!.taxableAmount).toBe(10000); // 20000 - 10000 exclusion
    expect(result.form1040.cancellationOfDebtIncome).toBe(10000);
    expect(result.form1040.totalIncome).toBe(70000); // 60000 + 10000
  });

  it('investment interest deduction added to itemized deductions', () => {
    const result = calculateForm1040(baseTaxReturn({
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0, stateLocalIncomeTax: 8000, realEstateTax: 2000,
        personalPropertyTax: 0, mortgageInterest: 12000, mortgageInsurancePremiums: 0,
        charitableCash: 1000, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
      },
      investmentInterest: { investmentInterestPaid: 3000 },
      income1099INT: [{ id: 'int-1', payerName: 'Bank', amount: 5000 }],
    }));
    expect(result.investmentInterest).toBeDefined();
    expect(result.investmentInterest!.deductibleAmount).toBe(3000);
    expect(result.form1040.investmentInterestDeduction).toBe(3000);
    // Itemized = Schedule A total + investment interest
    // Schedule A: SALT (10000, under $40k cap) + mortgage (12000) + charitable (1000) = 23000
    // Plus investment interest: 23000 + 3000 = 26000
    expect(result.form1040.deductionUsed).toBe('itemized');
    expect(result.form1040.deductionAmount).toBe(26000);
  });

  it('investment interest election removes qualified dividends from preferential rates', () => {
    const baseResult = calculateForm1040(baseTaxReturn({
      income1099DIV: [{ id: 'd-1', payerName: 'Broker', ordinaryDividends: 10000, qualifiedDividends: 8000 }],
    }));
    // Without election, qualified dividends get preferential rates
    expect(baseResult.form1040.preferentialTax).toBeGreaterThan(0);

    const electedResult = calculateForm1040(baseTaxReturn({
      income1099DIV: [{ id: 'd-1', payerName: 'Broker', ordinaryDividends: 10000, qualifiedDividends: 8000 }],
      investmentInterest: {
        investmentInterestPaid: 5000,
        electToIncludeQualifiedDividends: true,
      },
    }));
    // With election, qualified dividends lose preferential treatment
    // The preferential tax should be 0 since all QD is elected into NII
    expect(electedResult.form1040.preferentialTax).toBe(0);
    // Tax should be higher because dividends now taxed at ordinary rates
    expect(electedResult.form1040.incomeTax).toBeGreaterThan(baseResult.form1040.incomeTax);
  });

  it('investment interest election removes LTCG from preferential rates', () => {
    const baseResult = calculateForm1040(baseTaxReturn({
      income1099B: [{
        id: 'b-1', brokerName: 'Broker', description: 'Stock',
        dateSold: '2025-06-01', proceeds: 20000, costBasis: 5000, isLongTerm: true,
      }],
    }));
    expect(baseResult.form1040.preferentialTax).toBeGreaterThan(0);

    const electedResult = calculateForm1040(baseTaxReturn({
      income1099B: [{
        id: 'b-1', brokerName: 'Broker', description: 'Stock',
        dateSold: '2025-06-01', proceeds: 20000, costBasis: 5000, isLongTerm: true,
      }],
      investmentInterest: {
        investmentInterestPaid: 10000,
        electToIncludeLTCG: true,
      },
    }));
    // With LTCG election, LTCG loses preferential rates
    expect(electedResult.form1040.preferentialTax).toBe(0);
    expect(electedResult.form1040.incomeTax).toBeGreaterThan(baseResult.form1040.incomeTax);
  });

  it('no COD, no impact on income', () => {
    const withCOD = calculateForm1040(baseTaxReturn({
      income1099C: [{ id: 'c-1', payerName: 'Bank', dateOfCancellation: '2025-01-01', amountCancelled: 5000 }],
    }));
    const withoutCOD = calculateForm1040(baseTaxReturn());
    expect(withCOD.form1040.totalIncome).toBe(withoutCOD.form1040.totalIncome + 5000);
  });

  it('crypto gains increase AGI (not just income)', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099DA: [{
        id: 'da-1', brokerName: 'Coinbase', tokenName: 'BTC', tokenSymbol: 'BTC',
        dateSold: '2025-06-01', proceeds: 25000, costBasis: 10000, isLongTerm: true,
      }],
    }));
    // AGI should include the 15000 crypto gain
    expect(result.form1040.agi).toBe(75000); // 60000 wages + 15000 crypto gain
  });

  it('COD does not affect AGI-dependent credit phase-outs differently than other income', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099C: [{
        id: 'c-1', payerName: 'Bank', dateOfCancellation: '2025-01-01',
        amountCancelled: 50000,
      }],
    }));
    // AGI = wages (60000) + COD (50000) = 110000
    expect(result.form1040.agi).toBe(110000);
  });
});

// ════════════════════════════════════════════════════════
// Constants Validation
// ════════════════════════════════════════════════════════

describe('Sprint 14: Constants', () => {
  it('cancellation of debt minimum reporting amount is $600', () => {
    expect(CANCELLATION_OF_DEBT.MIN_REPORTING_AMOUNT).toBe(600);
  });
});
