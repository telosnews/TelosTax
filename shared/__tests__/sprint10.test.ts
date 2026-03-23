import { describe, it, expect } from 'vitest';
import { calculateEVCredit } from '../src/engine/evCredit.js';
import { calculateEnergyEfficiencyCredit } from '../src/engine/energyEfficiency.js';
import { calculateForeignTaxCredit } from '../src/engine/foreignTaxCredit.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { FilingStatus, TaxReturn } from '../src/types/index.js';

function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint10',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    filingStatus: FilingStatus.Single,
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
    incomeW2G: [],
    rentalProperties: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ════════════════════════════════════════════════════
// 16. Foreign Tax Credit (Form 1116)
// ════════════════════════════════════════════════════

describe('16. Foreign Tax Credit (Form 1116)', () => {
  it('returns zero when no foreign tax paid', () => {
    const result = calculateForeignTaxCredit(0, 0, 100000, 15000, FilingStatus.Single);
    expect(result.foreignTaxPaid).toBe(0);
    expect(result.creditAllowed).toBe(0);
  });

  it('simplified election — Single, $200 foreign tax (under $300 limit)', () => {
    // Foreign tax $200 ≤ $300 limit, foreign income $5000 ≥ $200 → full credit
    const result = calculateForeignTaxCredit(200, 5000, 100000, 15000, FilingStatus.Single);
    expect(result.foreignTaxPaid).toBe(200);
    // Credit = min(200, 15000) = 200
    expect(result.creditAllowed).toBe(200);
  });

  it('simplified election — MFJ, $500 foreign tax (under $600 limit)', () => {
    const result = calculateForeignTaxCredit(500, 10000, 200000, 30000, FilingStatus.MarriedFilingJointly);
    expect(result.foreignTaxPaid).toBe(500);
    expect(result.creditAllowed).toBe(500);
  });

  it('simplified election — limited to US tax liability', () => {
    // Foreign tax $250, but US tax liability is only $100
    const result = calculateForeignTaxCredit(250, 5000, 100000, 100, FilingStatus.Single);
    expect(result.foreignTaxPaid).toBe(250);
    expect(result.creditAllowed).toBe(100); // Limited to tax liability
  });

  it('full limitation — credit limited by foreign income ratio', () => {
    // Foreign tax $1000 (above $300 limit → full Form 1116)
    // US tax $20,000, foreign income $50,000 of $200,000 worldwide
    // Limit = 20000 × (50000 / 200000) = 5000
    // Credit = min(1000, 5000) = 1000
    const result = calculateForeignTaxCredit(1000, 50000, 200000, 20000, FilingStatus.Single);
    expect(result.foreignTaxPaid).toBe(1000);
    expect(result.creditAllowed).toBe(1000);
  });

  it('full limitation — foreign tax exceeds Form 1116 limit', () => {
    // Foreign tax $5000, foreign income $10,000 of $200,000 worldwide
    // US tax $20,000
    // Limit = 20000 × (10000 / 200000) = 1000
    // Credit = min(5000, 1000) = 1000
    const result = calculateForeignTaxCredit(5000, 10000, 200000, 20000, FilingStatus.Single);
    expect(result.foreignTaxPaid).toBe(5000);
    expect(result.creditAllowed).toBe(1000);
  });

  it('zero worldwide income returns zero credit', () => {
    const result = calculateForeignTaxCredit(200, 200, 0, 0, FilingStatus.Single);
    expect(result.foreignTaxPaid).toBe(200);
    expect(result.creditAllowed).toBe(0);
  });

  it('integrates via form1040 — 1099-DIV foreign tax flows to credit', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 80000, federalTaxWithheld: 12000 }],
      income1099DIV: [{
        id: 'd1',
        payerName: 'Vanguard Intl Fund',
        ordinaryDividends: 5000,
        qualifiedDividends: 3000,
        foreignTaxPaid: 200,
      }],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.foreignTaxPaid).toBe(200);
    // Credit should be > 0 (simplified election, $200 ≤ $300)
    expect(result.credits.foreignTaxCredit).toBeGreaterThan(0);
    expect(result.credits.foreignTaxCredit).toBeLessThanOrEqual(200);
  });
});

// ════════════════════════════════════════════════════
// 17. EV Credit (Form 8936) — Clean Vehicle Credit
// ════════════════════════════════════════════════════

describe('17. EV Credit (Form 8936)', () => {
  describe('new vehicle', () => {
    it('full credit — meets both mineral and battery reqs', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 45000,
        purchasePrice: 42000,
        isNewVehicle: true,
        finalAssemblyUS: true,
        meetsMineralReq: true,
        meetsBatteryComponentReq: true,
      }, 100000, FilingStatus.Single);
      expect(result.credit).toBe(7500); // $3750 + $3750
    });

    it('partial credit — meets only mineral req', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 45000,
        purchasePrice: 42000,
        isNewVehicle: true,
        finalAssemblyUS: true,
        meetsMineralReq: true,
        meetsBatteryComponentReq: false,
      }, 100000, FilingStatus.Single);
      expect(result.credit).toBe(3750);
    });

    it('partial credit — meets only battery req', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 45000,
        purchasePrice: 42000,
        isNewVehicle: true,
        finalAssemblyUS: true,
        meetsMineralReq: false,
        meetsBatteryComponentReq: true,
      }, 100000, FilingStatus.Single);
      expect(result.credit).toBe(3750);
    });

    it('zero — not assembled in US', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 45000,
        purchasePrice: 42000,
        isNewVehicle: true,
        finalAssemblyUS: false,
        meetsMineralReq: true,
        meetsBatteryComponentReq: true,
      }, 100000, FilingStatus.Single);
      expect(result.credit).toBe(0);
    });

    it('zero — MSRP exceeds $55,000 cap (sedan)', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 60000,
        purchasePrice: 58000,
        isNewVehicle: true,
        finalAssemblyUS: true,
        meetsMineralReq: true,
        meetsBatteryComponentReq: true,
      }, 100000, FilingStatus.Single);
      expect(result.credit).toBe(0);
    });

    it('zero — AGI exceeds income limit (Single $150k)', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 45000,
        purchasePrice: 42000,
        isNewVehicle: true,
        finalAssemblyUS: true,
        meetsMineralReq: true,
        meetsBatteryComponentReq: true,
      }, 160000, FilingStatus.Single);
      expect(result.credit).toBe(0);
    });

    it('under income limit — MFJ $300k', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 45000,
        purchasePrice: 42000,
        isNewVehicle: true,
        finalAssemblyUS: true,
        meetsMineralReq: true,
        meetsBatteryComponentReq: true,
      }, 250000, FilingStatus.MarriedFilingJointly);
      expect(result.credit).toBe(7500);
    });

    it('under income limit — HoH $225k', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 45000,
        purchasePrice: 42000,
        isNewVehicle: true,
        finalAssemblyUS: true,
        meetsMineralReq: true,
        meetsBatteryComponentReq: true,
      }, 200000, FilingStatus.HeadOfHousehold);
      expect(result.credit).toBe(7500);
    });

    it('zero — neither mineral nor battery req met', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 45000,
        purchasePrice: 42000,
        isNewVehicle: true,
        finalAssemblyUS: true,
        meetsMineralReq: false,
        meetsBatteryComponentReq: false,
      }, 100000, FilingStatus.Single);
      expect(result.credit).toBe(0);
    });
  });

  describe('used (previously owned) vehicle', () => {
    it('credit = 30% of purchase price (under $4,000 max)', () => {
      // 30% × $10,000 = $3,000
      const result = calculateEVCredit({
        vehicleMSRP: 50000,
        purchasePrice: 10000,
        isNewVehicle: false,
        finalAssemblyUS: true,
        meetsMineralReq: false,
        meetsBatteryComponentReq: false,
      }, 60000, FilingStatus.Single);
      expect(result.credit).toBe(3000);
    });

    it('credit capped at $4,000', () => {
      // 30% × $20,000 = $6,000 → capped at $4,000
      const result = calculateEVCredit({
        vehicleMSRP: 50000,
        purchasePrice: 20000,
        isNewVehicle: false,
        finalAssemblyUS: true,
        meetsMineralReq: false,
        meetsBatteryComponentReq: false,
      }, 60000, FilingStatus.Single);
      expect(result.credit).toBe(4000);
    });

    it('zero — purchase price exceeds $25,000 cap', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 50000,
        purchasePrice: 26000,
        isNewVehicle: false,
        finalAssemblyUS: true,
        meetsMineralReq: false,
        meetsBatteryComponentReq: false,
      }, 60000, FilingStatus.Single);
      expect(result.credit).toBe(0);
    });

    it('zero — AGI exceeds $75,000 Single limit', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 50000,
        purchasePrice: 15000,
        isNewVehicle: false,
        finalAssemblyUS: true,
        meetsMineralReq: false,
        meetsBatteryComponentReq: false,
      }, 80000, FilingStatus.Single);
      expect(result.credit).toBe(0);
    });

    it('under income limit — MFJ $150k', () => {
      const result = calculateEVCredit({
        vehicleMSRP: 50000,
        purchasePrice: 15000,
        isNewVehicle: false,
        finalAssemblyUS: true,
        meetsMineralReq: false,
        meetsBatteryComponentReq: false,
      }, 140000, FilingStatus.MarriedFilingJointly);
      // 30% × 15000 = 4500 → capped at 4000
      expect(result.credit).toBe(4000);
    });
  });

  it('integrates via form1040 — EV credit reduces tax', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 100000, federalTaxWithheld: 15000 }],
      evCredit: {
        vehicleMSRP: 45000,
        purchasePrice: 42000,
        isNewVehicle: true,
        finalAssemblyUS: true,
        meetsMineralReq: true,
        meetsBatteryComponentReq: true,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.evCredit).toBe(7500);
    expect(result.evCredit?.credit).toBe(7500);
  });
});

// ════════════════════════════════════════════════════
// 18. Energy Efficient Home Improvement (5695 Part II)
// ════════════════════════════════════════════════════

describe('18. Energy Efficient Home Improvement (Form 5695 Part II)', () => {
  it('returns zero for empty info', () => {
    const result = calculateEnergyEfficiencyCredit({});
    expect(result.credit).toBe(0);
    expect(result.totalExpenditures).toBe(0);
  });

  it('heat pump only — 30% up to $2,000 limit', () => {
    // $5,000 heat pump → 30% = $1,500 (under $2,000 limit)
    const result = calculateEnergyEfficiencyCredit({ heatPump: 5000 });
    expect(result.credit).toBe(1500);
    expect(result.totalExpenditures).toBe(5000);
  });

  it('heat pump — hits $2,000 limit', () => {
    // $10,000 heat pump → 30% = $3,000 → capped at $2,000
    const result = calculateEnergyEfficiencyCredit({ heatPump: 10000 });
    expect(result.credit).toBe(2000);
  });

  it('windows — sub-limit $600', () => {
    // $5,000 windows → 30% = $1,500 → capped at $600
    const result = calculateEnergyEfficiencyCredit({ windows: 5000 });
    expect(result.credit).toBe(600);
  });

  it('doors — sub-limit $500', () => {
    // $3,000 doors → 30% = $900 → capped at $500
    const result = calculateEnergyEfficiencyCredit({ doors: 3000 });
    expect(result.credit).toBe(500);
  });

  it('electrical panel — sub-limit $600', () => {
    // $3,000 electrical → 30% = $900 → capped at $600
    const result = calculateEnergyEfficiencyCredit({ electricalPanel: 3000 });
    expect(result.credit).toBe(600);
  });

  it('home energy audit — sub-limit $150', () => {
    // $1,000 audit → 30% = $300 → capped at $150
    const result = calculateEnergyEfficiencyCredit({ homeEnergyAudit: 1000 });
    expect(result.credit).toBe(150);
  });

  it('non-HP category B items — aggregate $1,200 limit', () => {
    // windows $600 + doors $500 + electrical $600 + audit $150 = $1,850 total sub-limit credits
    // But non-HP aggregate cap = $1,200
    const result = calculateEnergyEfficiencyCredit({
      windows: 5000,     // 30% = 1500, capped at $600
      doors: 3000,       // 30% = 900, capped at $500
      electricalPanel: 3000, // 30% = 900, capped at $600
      homeEnergyAudit: 1000, // 30% = 300, capped at $150
    });
    // Total sub-limit credits: 600 + 500 + 600 + 150 = 1850
    // Non-HP aggregate cap: $1,200
    expect(result.credit).toBe(1200);
  });

  it('insulation (uncapped non-HP item) — counts toward $1,200 non-HP limit', () => {
    // $6,000 insulation → 30% = $1,800 → subject to $1,200 non-HP cap
    const result = calculateEnergyEfficiencyCredit({ insulation: 6000 });
    expect(result.credit).toBe(1200);
  });

  it('heat pump + non-HP — aggregate $3,200 limit', () => {
    // Heat pump $2,000 (at cap) + non-HP $1,200 (at cap) = $3,200 (at aggregate cap)
    const result = calculateEnergyEfficiencyCredit({
      heatPump: 10000,    // $2,000 credit (capped)
      insulation: 6000,   // $1,200 credit (non-HP cap)
    });
    expect(result.credit).toBe(3200);
  });

  it('central AC, furnace, water heater — standard 30% with non-HP cap', () => {
    // $2,000 AC + $1,000 furnace + $500 water heater = $3,500 total
    // 30% = $1,050, under $1,200 non-HP cap
    const result = calculateEnergyEfficiencyCredit({
      centralAC: 2000,
      furnaceBoiler: 1000,
      waterHeater: 500,
    });
    expect(result.credit).toBe(1050);
  });

  it('integrates via form1040 — credit reduces tax', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 80000, federalTaxWithheld: 12000 }],
      energyEfficiency: { heatPump: 8000 },
    });
    const result = calculateForm1040(tr);
    // 30% × $8,000 = $2,400 → capped at $2,000
    expect(result.credits.energyEfficiencyCredit).toBe(2000);
    expect(result.energyEfficiency?.credit).toBe(2000);
  });
});

// ════════════════════════════════════════════════════
// 19. Estate/Trust K-1 (Form 1041)
// ════════════════════════════════════════════════════

describe('19. Estate/Trust K-1 (Form 1041)', () => {
  it('estate K-1 ordinary income flows to total income', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 50000, federalTaxWithheld: 8000 }],
      incomeK1: [{
        id: 'k1',
        entityName: 'Smith Family Trust',
        entityType: 'estate',
        ordinaryBusinessIncome: 10000,
      }],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.k1OrdinaryIncome).toBe(10000);
    expect(result.form1040.totalIncome).toBeGreaterThan(59000);
  });

  it('trust K-1 does NOT generate self-employment income', () => {
    const tr = baseTaxReturn({
      incomeK1: [{
        id: 'k1',
        entityName: 'Irrevocable Trust',
        entityType: 'trust',
        ordinaryBusinessIncome: 30000,
        selfEmploymentIncome: 30000, // should be ignored for trusts
      }],
    });
    const result = calculateForm1040(tr);
    // K-1 SE income should be 0 — trusts don't generate SE income
    expect(result.form1040.k1SEIncome).toBe(0);
    expect(result.scheduleSE).toBeUndefined();
  });

  it('estate K-1 does NOT generate self-employment income', () => {
    const tr = baseTaxReturn({
      incomeK1: [{
        id: 'k1',
        entityName: 'Decedent Estate',
        entityType: 'estate',
        ordinaryBusinessIncome: 20000,
        selfEmploymentIncome: 20000,
      }],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.k1SEIncome).toBe(0);
  });

  it('estate K-1 with dividends and capital gains routes correctly', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 50000, federalTaxWithheld: 8000 }],
      incomeK1: [{
        id: 'k1',
        entityName: 'Trust Fund',
        entityType: 'trust',
        ordinaryDividends: 3000,
        qualifiedDividends: 2000,
        longTermCapitalGain: 5000,
        interestIncome: 1000,
      }],
    });
    const result = calculateForm1040(tr);
    // K-1 interest, dividends should be included in totals
    expect(result.form1040.totalInterest).toBe(1000);
    expect(result.form1040.totalDividends).toBe(3000);
  });

  it('partnership K-1 still generates SE income (backward compat)', () => {
    const tr = baseTaxReturn({
      incomeK1: [{
        id: 'k1',
        entityName: 'ABC Partners',
        entityType: 'partnership',
        ordinaryBusinessIncome: 40000,
        selfEmploymentIncome: 40000,
      }],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.k1SEIncome).toBe(40000);
    expect(result.scheduleSE).toBeDefined();
  });
});

// ════════════════════════════════════════════════════
// 20. Excess Social Security Tax Credit
// ════════════════════════════════════════════════════

describe('20. Excess Social Security Tax Credit', () => {
  it('no excess — single employer under max', () => {
    const tr = baseTaxReturn({
      w2Income: [{
        id: 'w1',
        employerName: 'ACME',
        wages: 100000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 100000,
        socialSecurityTax: 6200, // 6.2% × $100k = $6,200
      }],
    });
    const result = calculateForm1040(tr);
    expect(result.credits.excessSSTaxCredit).toBe(0);
  });

  it('excess — two employers, combined SS tax exceeds max ($10,918.20)', () => {
    const tr = baseTaxReturn({
      w2Income: [
        {
          id: 'w1',
          employerName: 'Employer A',
          wages: 150000,
          federalTaxWithheld: 20000,
          socialSecurityWages: 150000,
          socialSecurityTax: 9300, // 6.2% × $150k = $9,300
        },
        {
          id: 'w2',
          employerName: 'Employer B',
          wages: 100000,
          federalTaxWithheld: 15000,
          socialSecurityWages: 100000,
          socialSecurityTax: 6200, // 6.2% × $100k = $6,200
        },
      ],
    });
    const result = calculateForm1040(tr);
    // Total SS tax: $9,300 + $6,200 = $15,500
    // Max SS tax: $10,918.20
    // Excess: $15,500 - $10,918.20 = $4,581.80
    expect(result.credits.excessSSTaxCredit).toBe(4581.80);
    // This is a refundable credit
    expect(result.credits.totalRefundable).toBeGreaterThanOrEqual(4581.80);
  });

  it('no excess — two employers but combined under max', () => {
    const tr = baseTaxReturn({
      w2Income: [
        {
          id: 'w1',
          employerName: 'Employer A',
          wages: 60000,
          federalTaxWithheld: 9000,
          socialSecurityWages: 60000,
          socialSecurityTax: 3720,
        },
        {
          id: 'w2',
          employerName: 'Employer B',
          wages: 50000,
          federalTaxWithheld: 7500,
          socialSecurityWages: 50000,
          socialSecurityTax: 3100,
        },
      ],
    });
    const result = calculateForm1040(tr);
    // Total: $3,720 + $3,100 = $6,820 ≤ $10,918.20
    expect(result.credits.excessSSTaxCredit).toBe(0);
  });

  it('three employers — large excess', () => {
    const tr = baseTaxReturn({
      w2Income: [
        { id: 'w1', employerName: 'A', wages: 176100, federalTaxWithheld: 25000, socialSecurityTax: 10918.20 },
        { id: 'w2', employerName: 'B', wages: 176100, federalTaxWithheld: 25000, socialSecurityTax: 10918.20 },
        { id: 'w3', employerName: 'C', wages: 176100, federalTaxWithheld: 25000, socialSecurityTax: 10918.20 },
      ],
    });
    const result = calculateForm1040(tr);
    // Total: 3 × $10,918.20 = $32,754.60
    // Excess: $32,754.60 - $10,918.20 = $21,836.40
    expect(result.credits.excessSSTaxCredit).toBe(21836.40);
  });
});

// ════════════════════════════════════════════════════
// 21. Gambling Income (W-2G)
// ════════════════════════════════════════════════════

describe('21. Gambling Income (W-2G)', () => {
  it('gambling income adds to total income', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 50000, federalTaxWithheld: 8000 }],
      incomeW2G: [
        { id: 'g1', payerName: 'Vegas Casino', grossWinnings: 5000, federalTaxWithheld: 1200 },
        { id: 'g2', payerName: 'Atlantic City', grossWinnings: 3000, federalTaxWithheld: 720 },
      ],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.totalGamblingIncome).toBe(8000);
    // Total income should include $50k wages + $8k gambling
    expect(result.form1040.totalIncome).toBeGreaterThanOrEqual(58000);
  });

  it('W-2G withholding counts in total withholding', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 50000, federalTaxWithheld: 8000 }],
      incomeW2G: [
        { id: 'g1', payerName: 'Casino', grossWinnings: 10000, federalTaxWithheld: 2400 },
      ],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.totalWithholding).toBe(10400); // $8,000 + $2,400
  });

  it('gambling losses — itemized deduction limited to winnings', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 80000, federalTaxWithheld: 12000 }],
      incomeW2G: [
        { id: 'g1', payerName: 'Casino', grossWinnings: 5000 },
      ],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 5000,
        realEstateTax: 3000,
        personalPropertyTax: 0,
        mortgageInterest: 8000,
        mortgageInsurancePremiums: 0,
        charitableCash: 3000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      gamblingLosses: 7000, // $7k losses but only $5k winnings → capped at $5k
    });
    const result = calculateForm1040(tr);
    // Gambling loss deduction should be min(7000, 5000) = 5000, added to itemized deduction
    // Base itemized: SALT $8k (under $40k cap) + mortgage $8k + charitable $3k = $19k
    // Plus gambling loss $5k = $24k
    expect(result.form1040.itemizedDeduction).toBeGreaterThanOrEqual(24000);
  });

  it('gambling losses with standard deduction — no benefit', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 50000, federalTaxWithheld: 8000 }],
      incomeW2G: [
        { id: 'g1', payerName: 'Casino', grossWinnings: 3000 },
      ],
      deductionMethod: 'standard',
      gamblingLosses: 3000,
    });
    const result = calculateForm1040(tr);
    // Standard deduction used — gambling losses don't reduce anything
    expect(result.form1040.deductionUsed).toBe('standard');
  });

  it('no gambling income — W-2G is empty', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 50000, federalTaxWithheld: 8000 }],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.totalGamblingIncome).toBe(0);
  });
});

// ════════════════════════════════════════════════════
// 22. Alimony (pre-2019 divorce agreements)
// ════════════════════════════════════════════════════

describe('22. Alimony Deduction (pre-2019)', () => {
  it('pre-2019 divorce — full above-the-line deduction', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 100000, federalTaxWithheld: 15000 }],
      alimony: {
        totalPaid: 24000,
        recipientSSNLastFour: '1234',
        divorceDate: '2017-06-15',
      },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.alimonyDeduction).toBe(24000);
    // AGI should be reduced by alimony deduction
    expect(result.form1040.totalAdjustments).toBeGreaterThanOrEqual(24000);
  });

  it('post-2018 divorce — no deduction (TCJA)', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 100000, federalTaxWithheld: 15000 }],
      alimony: {
        totalPaid: 24000,
        recipientSSNLastFour: '5678',
        divorceDate: '2020-03-01',
      },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.alimonyDeduction).toBe(0);
  });

  it('exactly on TCJA cutoff date (2019-01-01) — no deduction', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 80000, federalTaxWithheld: 12000 }],
      alimony: {
        totalPaid: 12000,
        divorceDate: '2019-01-01',
      },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.alimonyDeduction).toBe(0);
  });

  it('day before cutoff (2018-12-31) — full deduction', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 80000, federalTaxWithheld: 12000 }],
      alimony: {
        totalPaid: 12000,
        divorceDate: '2018-12-31',
      },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.alimonyDeduction).toBe(12000);
  });

  it('no alimony — zero deduction', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 80000, federalTaxWithheld: 12000 }],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.alimonyDeduction).toBe(0);
  });

  it('zero paid — zero deduction', () => {
    const tr = baseTaxReturn({
      alimony: {
        totalPaid: 0,
        divorceDate: '2017-01-01',
      },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.alimonyDeduction).toBe(0);
  });
});

// ════════════════════════════════════════════════════
// Integration: Combined Sprint 10 scenario
// ════════════════════════════════════════════════════

describe('Sprint 10 — Integration scenario', () => {
  it('taxpayer with gambling, alimony, EV credit, and foreign tax credit', () => {
    const tr = baseTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [
        {
          id: 'w1',
          employerName: 'TechCorp',
          wages: 120000,
          federalTaxWithheld: 20000,
          socialSecurityWages: 120000,
          socialSecurityTax: 7440,
        },
      ],
      income1099DIV: [{
        id: 'd1',
        payerName: 'Intl Fund',
        ordinaryDividends: 4000,
        qualifiedDividends: 3000,
        foreignTaxPaid: 400,
      }],
      incomeW2G: [
        { id: 'g1', payerName: 'Lucky Casino', grossWinnings: 8000, federalTaxWithheld: 1920 },
      ],
      alimony: {
        totalPaid: 18000,
        recipientSSNLastFour: '9999',
        divorceDate: '2016-07-01',
      },
      evCredit: {
        vehicleMSRP: 50000,
        purchasePrice: 48000,
        isNewVehicle: true,
        finalAssemblyUS: true,
        meetsMineralReq: true,
        meetsBatteryComponentReq: true,
      },
    });

    const result = calculateForm1040(tr);

    // Gambling income included
    expect(result.form1040.totalGamblingIncome).toBe(8000);
    // Gambling withholding included
    expect(result.form1040.totalWithholding).toBe(21920); // 20000 + 1920

    // Pre-2019 alimony deduction
    expect(result.form1040.alimonyDeduction).toBe(18000);

    // EV credit
    expect(result.credits.evCredit).toBe(7500);

    // Foreign tax credit (simplified election: $400 ≤ $600 MFJ)
    expect(result.credits.foreignTaxCredit).toBeGreaterThan(0);
    expect(result.credits.foreignTaxCredit).toBeLessThanOrEqual(400);

    // No excess SS (single employer, $7,440 ≤ $10,918.20)
    expect(result.credits.excessSSTaxCredit).toBe(0);

    // Overall sanity: refund or owed
    expect(result.form1040.amountOwed + result.form1040.refundAmount).toBeGreaterThan(0);
  });

  it('backward compatibility — return without any Sprint 10 data', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 75000, federalTaxWithheld: 10000 }],
    });
    const result = calculateForm1040(tr);

    // Sprint 10 fields should be zero/default
    expect(result.form1040.totalGamblingIncome).toBe(0);
    expect(result.form1040.alimonyDeduction).toBe(0);
    expect(result.credits.evCredit).toBe(0);
    expect(result.credits.energyEfficiencyCredit).toBe(0);
    expect(result.credits.foreignTaxCredit).toBe(0);
    expect(result.credits.excessSSTaxCredit).toBe(0);

    // Original calculation should still work
    expect(result.form1040.totalWages).toBe(75000);
    expect(result.form1040.agi).toBeGreaterThan(0);
  });
});
