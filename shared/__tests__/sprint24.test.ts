import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateEstimatedTaxPenalty } from '../src/engine/estimatedTaxPenalty.js';
import { calculateForeignTaxCredit } from '../src/engine/foreignTaxCredit.js';
import { FilingStatus, TaxReturn, AnnualizedIncomeInfo, ForeignTaxCreditCategory } from '../src/types/index.js';
import { ESTIMATED_TAX_PENALTY } from '../src/constants/tax2025.js';

// ─── Helper: minimal valid TaxReturn ───────────────────
function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint24',
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
    income1099Q: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
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
// 24A: Form 2210 Annualized Income Installment Method
// IRC §6654(d)(2), Form 2210 Schedule AI
// ════════════════════════════════════════════════════════
describe('Sprint 24A: Form 2210 Annualized Income Method', () => {

  describe('Constants', () => {
    it('should have correct annualization factors', () => {
      expect(ESTIMATED_TAX_PENALTY.ANNUALIZATION_FACTORS).toEqual([4, 2.4, 1.5, 1]);
    });

    it('should have correct quarterly installment percentages', () => {
      expect(ESTIMATED_TAX_PENALTY.QUARTERLY_INSTALLMENT_PERCENTAGES).toEqual([0.25, 0.50, 0.75, 1.00]);
    });

    it('should have day-count matrix with correct row totals', () => {
      // Q1=365, Q2=304, Q3=212, Q4=90
      const matrix = ESTIMATED_TAX_PENALTY.DAYS_MATRIX;
      expect(matrix[0].reduce((a: number, b: number) => a + b, 0)).toBe(365);
      expect(matrix[1].reduce((a: number, b: number) => a + b, 0)).toBe(304);
      expect(matrix[2].reduce((a: number, b: number) => a + b, 0)).toBe(212);
      expect(matrix[3].reduce((a: number, b: number) => a + b, 0)).toBe(90);
    });

    it('should have period rates for all 4 rate periods', () => {
      expect(ESTIMATED_TAX_PENALTY.PERIOD_RATES).toHaveLength(4);
      // TY2025: all periods = 7%
      for (const rate of ESTIMATED_TAX_PENALTY.PERIOD_RATES) {
        expect(rate).toBe(0.07);
      }
    });
  });

  describe('Backward compatibility (no annualized data)', () => {
    it('should return same result when no annualized data provided', () => {
      const result = calculateEstimatedTaxPenalty(
        20000, // currentYearTax
        5000,  // totalPayments
        18000, // priorYearTax
        80000, // agi
        FilingStatus.Single,
      );

      expect(result.penalty).toBeGreaterThan(0);
      expect(result.usedAnnualizedMethod).toBe(false);
      expect(result.regularPenalty).toBe(result.penalty);
    });

    it('should still apply safe harbor when no penalty needed', () => {
      const result = calculateEstimatedTaxPenalty(
        5000,  // currentYearTax
        4500,  // totalPayments — owed < $1000
        5000,  // priorYearTax
        80000, // agi
        FilingStatus.Single,
      );

      expect(result.penalty).toBe(0);
    });
  });

  describe('Seasonal earner — Q4 heavy income', () => {
    it('should produce lower penalty for Q4-heavy earner using annualized method', () => {
      // Scenario: taxpayer earns most income in Q4 (e.g., December bonus)
      // Q1: $5k cumulative, Q2: $10k, Q3: $15k, Q4: $100k (full year)
      // Without annualized method: underpaid all year → full penalty
      // With annualized: early quarters had low income → lower required installments
      const currentYearTax = 15000;
      const totalPayments = 2000; // Low withholding early in year
      const priorYearTax = 14000;

      const regularResult = calculateEstimatedTaxPenalty(
        currentYearTax, totalPayments, priorYearTax, 100000,
        FilingStatus.Single,
      );

      const annualizedResult = calculateEstimatedTaxPenalty(
        currentYearTax, totalPayments, priorYearTax, 100000,
        FilingStatus.Single,
        {
          cumulativeIncome: [5000, 10000, 15000, 100000],
        },
      );

      // Annualized method should produce lower penalty
      expect(annualizedResult.penalty).toBeLessThan(regularResult.penalty);
      expect(annualizedResult.usedAnnualizedMethod).toBe(true);
      expect(annualizedResult.regularPenalty).toBe(regularResult.penalty);
    });
  });

  describe('Equal quarters — minimal benefit', () => {
    it('should compute annualized penalty for evenly distributed income', () => {
      // Income spread evenly: $25k each quarter
      const currentYearTax = 15000;
      const totalPayments = 2000;
      const priorYearTax = 14000;

      const result = calculateEstimatedTaxPenalty(
        currentYearTax, totalPayments, priorYearTax, 100000,
        FilingStatus.Single,
        {
          cumulativeIncome: [25000, 50000, 75000, 100000],
        },
      );

      // Equal income → annualized method may still produce slightly different
      // result due to per-quarter carryover mechanics. The key test is that
      // the penalty is ≤ regular method penalty.
      expect(result.penalty).toBeLessThanOrEqual(result.regularPenalty!);
    });
  });

  describe('Front-loaded income', () => {
    it('should compute penalty for front-loaded income (Q1 heavy)', () => {
      // Q1: $80k, Q2: $90k, Q3: $95k, Q4: $100k
      // Front-loaded → annualized method makes early quarters require MORE
      // But per-quarter min(annualized, regular) means it never exceeds regular
      const currentYearTax = 15000;
      const totalPayments = 2000;
      const priorYearTax = 14000;

      const result = calculateEstimatedTaxPenalty(
        currentYearTax, totalPayments, priorYearTax, 100000,
        FilingStatus.Single,
        {
          cumulativeIncome: [80000, 90000, 95000, 100000],
        },
      );

      // Annualized penalty should never exceed regular penalty
      expect(result.penalty).toBeLessThanOrEqual(result.regularPenalty!);
      // Penalty should be > 0 since we're underpaid
      expect(result.penalty).toBeGreaterThan(0);
    });
  });

  describe('Zero early quarters', () => {
    it('should handle zero income in early quarters', () => {
      const currentYearTax = 10000;
      const totalPayments = 1000;
      const priorYearTax = 9000;

      const result = calculateEstimatedTaxPenalty(
        currentYearTax, totalPayments, priorYearTax, 80000,
        FilingStatus.Single,
        {
          cumulativeIncome: [0, 0, 0, 80000],
        },
      );

      // Zero early income → annualized method should produce lower penalty
      expect(result.usedAnnualizedMethod).toBe(true);
      expect(result.penalty).toBeLessThan(result.regularPenalty!);
    });
  });

  describe('No annualized data → fallback to regular', () => {
    it('should return regular penalty when annualized data is undefined', () => {
      const result = calculateEstimatedTaxPenalty(
        20000, 5000, 18000, 80000,
        FilingStatus.Single,
        undefined,
      );

      expect(result.usedAnnualizedMethod).toBe(false);
      expect(result.regularPenalty).toBe(result.penalty);
    });
  });

  describe('Quarterly withholding support', () => {
    it('should use quarterly withholding when provided', () => {
      // Most withholding in Q4 (to match Q4 income)
      const currentYearTax = 15000;
      const totalPayments = 12000; // Total for year
      const priorYearTax = 14000;

      const result = calculateEstimatedTaxPenalty(
        currentYearTax, totalPayments, priorYearTax, 100000,
        FilingStatus.Single,
        {
          cumulativeIncome: [5000, 10000, 15000, 100000],
          cumulativeWithholding: [500, 1000, 1500, 12000],
        },
      );

      // Should compute without error, using the provided withholding schedule
      expect(result.penalty).toBeGreaterThanOrEqual(0);
    });
  });

  describe('form1040 integration', () => {
    it('should pass annualized income through to penalty calculation', () => {
      // Create a scenario that triggers estimated tax penalty
      const result = calculateForm1040(baseTaxReturn({
        w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 100000, federalTaxWithheld: 5000 }],
        priorYearTax: 15000,
        annualizedIncome: {
          cumulativeIncome: [5000, 10000, 15000, 100000],
        },
      }));

      // Check that the penalty was computed
      if (result.estimatedTaxPenalty && result.estimatedTaxPenalty.penalty > 0) {
        // If annualized produced lower result, it should be flagged
        expect(result.estimatedTaxPenalty.usedAnnualizedMethod !== undefined).toBe(true);
      }
    });

    it('should produce same result without annualized data as before', () => {
      const withoutAI = calculateForm1040(baseTaxReturn({
        w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 100000, federalTaxWithheld: 5000 }],
        priorYearTax: 15000,
      }));

      const withoutAI2 = calculateForm1040(baseTaxReturn({
        w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 100000, federalTaxWithheld: 5000 }],
        priorYearTax: 15000,
        annualizedIncome: undefined,
      }));

      expect(withoutAI.form1040.estimatedTaxPenalty).toBe(withoutAI2.form1040.estimatedTaxPenalty);
    });
  });

  describe('MFJ filing status', () => {
    it('should work with MFJ and annualized income', () => {
      const result = calculateEstimatedTaxPenalty(
        25000, 3000, 22000, 150000,
        FilingStatus.MarriedFilingJointly,
        {
          cumulativeIncome: [10000, 20000, 30000, 150000],
        },
      );

      // MFJ with Q4-heavy income should benefit from annualized method
      expect(result.penalty).toBeGreaterThanOrEqual(0);
      expect(result.usedAnnualizedMethod).toBe(true);
    });
  });
});

// ════════════════════════════════════════════════════════
// 24B: Form 1116 Full Limitation Categories
// IRC §904(d) — Separate categories for FTC
// ════════════════════════════════════════════════════════
describe('Sprint 24B: Form 1116 FTC Categories', () => {

  describe('Backward compatibility (no categories)', () => {
    it('should return same result as before when no categories provided', () => {
      const result = calculateForeignTaxCredit(
        200, 5000, 50000, 8000,
        FilingStatus.Single,
      );

      expect(result.foreignTaxPaid).toBe(200);
      expect(result.creditAllowed).toBe(200); // Below $300 simplified limit
      expect(result.categoryResults).toBeUndefined();
    });

    it('should apply simplified election for small amounts without categories', () => {
      const result = calculateForeignTaxCredit(
        250, 3000, 50000, 8000,
        FilingStatus.Single,
      );

      expect(result.creditAllowed).toBe(250);
    });

    it('should apply limitation formula without categories', () => {
      const result = calculateForeignTaxCredit(
        5000, 10000, 50000, 8000,
        FilingStatus.Single,
      );

      // Limitation = 8000 × (10000/50000) = $1,600
      expect(result.creditAllowed).toBe(1600);
    });
  });

  describe('Single category', () => {
    it('should produce same result as no-category for single general category', () => {
      const result = calculateForeignTaxCredit(
        5000, 10000, 50000, 8000,
        FilingStatus.Single,
        [{ category: 'general', foreignTaxPaid: 5000, foreignSourceIncome: 10000 }],
      );

      expect(result.creditAllowed).toBe(1600); // 8000 × (10000/50000)
      expect(result.categoryResults).toHaveLength(1);
      expect(result.categoryResults![0].category).toBe('general');
      expect(result.categoryResults![0].limitation).toBe(1600);
      expect(result.categoryResults![0].creditAllowed).toBe(1600);
    });

    it('should handle single passive category', () => {
      const result = calculateForeignTaxCredit(
        1000, 8000, 50000, 8000,
        FilingStatus.Single,
        [{ category: 'passive', foreignTaxPaid: 1000, foreignSourceIncome: 8000 }],
      );

      // Limitation = 8000 × (8000/50000) = $1,280
      // Credit = min(1000, 1280) = $1,000
      expect(result.creditAllowed).toBe(1000);
      expect(result.categoryResults![0].limitation).toBe(1280);
    });
  });

  describe('Multiple categories — separate limitations', () => {
    it('should compute separate limitation for general and passive', () => {
      // General: $3000 tax, $20k income
      // Passive: $1000 tax, $5k income
      // Worldwide: $50k, US tax: $8000
      const result = calculateForeignTaxCredit(
        4000, 25000, 50000, 8000,
        FilingStatus.Single,
        [
          { category: 'general', foreignTaxPaid: 3000, foreignSourceIncome: 20000 },
          { category: 'passive', foreignTaxPaid: 1000, foreignSourceIncome: 5000 },
        ],
      );

      expect(result.categoryResults).toHaveLength(2);

      // General: limitation = 8000 × (20000/50000) = $3,200; credit = min(3000, 3200) = $3,000
      const general = result.categoryResults!.find(c => c.category === 'general')!;
      expect(general.limitation).toBe(3200);
      expect(general.creditAllowed).toBe(3000);

      // Passive: limitation = 8000 × (5000/50000) = $800; credit = min(1000, 800) = $800
      const passive = result.categoryResults!.find(c => c.category === 'passive')!;
      expect(passive.limitation).toBe(800);
      expect(passive.creditAllowed).toBe(800);

      // Total: $3,000 + $800 = $3,800
      expect(result.creditAllowed).toBe(3800);
      expect(result.foreignTaxPaid).toBe(4000);
    });

    it('should prevent cross-category sheltering', () => {
      // High-tax general income cannot shelter low-tax passive income
      // General: $5000 tax on $10k income → high effective rate
      // Passive: $100 tax on $10k income → low effective rate
      const result = calculateForeignTaxCredit(
        5100, 20000, 50000, 8000,
        FilingStatus.Single,
        [
          { category: 'general', foreignTaxPaid: 5000, foreignSourceIncome: 10000 },
          { category: 'passive', foreignTaxPaid: 100, foreignSourceIncome: 10000 },
        ],
      );

      // General: limitation = 8000 × (10000/50000) = $1,600; credit = min(5000, 1600) = $1,600
      // (excess $3,400 in general cannot be used for passive)
      const general = result.categoryResults!.find(c => c.category === 'general')!;
      expect(general.creditAllowed).toBe(1600);

      // Passive: limitation = 8000 × (10000/50000) = $1,600; credit = min(100, 1600) = $100
      const passive = result.categoryResults!.find(c => c.category === 'passive')!;
      expect(passive.creditAllowed).toBe(100);

      // Total: $1,600 + $100 = $1,700 (NOT $1,700 + excess from general)
      expect(result.creditAllowed).toBe(1700);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero foreign tax in one category', () => {
      const result = calculateForeignTaxCredit(
        1000, 10000, 50000, 8000,
        FilingStatus.Single,
        [
          { category: 'general', foreignTaxPaid: 1000, foreignSourceIncome: 10000 },
          { category: 'passive', foreignTaxPaid: 0, foreignSourceIncome: 5000 },
        ],
      );

      expect(result.categoryResults).toHaveLength(2);
      expect(result.categoryResults![1].creditAllowed).toBe(0);
      expect(result.creditAllowed).toBe(1000); // Only general
    });

    it('should handle zero worldwide income', () => {
      const result = calculateForeignTaxCredit(
        500, 500, 0, 0,
        FilingStatus.Single,
        [{ category: 'general', foreignTaxPaid: 500, foreignSourceIncome: 500 }],
      );

      expect(result.creditAllowed).toBe(0);
    });

    it('should cap foreign income to worldwide income', () => {
      // Foreign income can't exceed worldwide (data entry error guard)
      const result = calculateForeignTaxCredit(
        1000, 60000, 50000, 8000,
        FilingStatus.Single,
        [{ category: 'general', foreignTaxPaid: 1000, foreignSourceIncome: 60000 }],
      );

      // Should cap at worldwide income
      // Limitation = 8000 × (50000/50000) = $8,000; credit = min(1000, 8000) = $1,000
      expect(result.creditAllowed).toBe(1000);
    });

    it('should handle zero foreign tax paid overall', () => {
      const result = calculateForeignTaxCredit(
        0, 0, 50000, 8000,
        FilingStatus.Single,
      );

      expect(result.foreignTaxPaid).toBe(0);
      expect(result.creditAllowed).toBe(0);
    });
  });

  describe('form1040 integration with categories', () => {
    it('should pass categories through to FTC calculation', () => {
      const result = calculateForm1040(baseTaxReturn({
        income1099DIV: [{
          id: 'div-1', payerName: 'Intl Fund', ordinaryDividends: 5000,
          qualifiedDividends: 3000, foreignTaxPaid: 400,
        }],
        foreignTaxCreditCategories: [
          { category: 'passive', foreignTaxPaid: 400, foreignSourceIncome: 5000 },
        ],
      }));

      // Should have FTC credit applied
      expect(result.foreignTaxCredit).toBeDefined();
      if (result.foreignTaxCredit) {
        expect(result.foreignTaxCredit.categoryResults).toBeDefined();
        expect(result.foreignTaxCredit.categoryResults).toHaveLength(1);
      }
    });

    it('should fall back to simplified when no categories', () => {
      const result = calculateForm1040(baseTaxReturn({
        income1099DIV: [{
          id: 'div-1', payerName: 'Intl Fund', ordinaryDividends: 5000,
          qualifiedDividends: 3000, foreignTaxPaid: 200,
        }],
      }));

      // Should use simplified election (≤ $300)
      expect(result.foreignTaxCredit).toBeDefined();
      if (result.foreignTaxCredit) {
        expect(result.foreignTaxCredit.categoryResults).toBeUndefined();
        expect(result.foreignTaxCredit.creditAllowed).toBe(200);
      }
    });

    it('should compute multi-category FTC reducing total tax', () => {
      const withoutFTC = calculateForm1040(baseTaxReturn({
        income1099DIV: [{
          id: 'div-1', payerName: 'Intl Fund', ordinaryDividends: 10000,
          qualifiedDividends: 5000,
        }],
      }));

      const withFTC = calculateForm1040(baseTaxReturn({
        income1099DIV: [{
          id: 'div-1', payerName: 'Intl Fund', ordinaryDividends: 10000,
          qualifiedDividends: 5000, foreignTaxPaid: 800,
        }],
        foreignTaxCreditCategories: [
          { category: 'general', foreignTaxPaid: 300, foreignSourceIncome: 4000 },
          { category: 'passive', foreignTaxPaid: 500, foreignSourceIncome: 6000 },
        ],
      }));

      // FTC should reduce total tax
      expect(withFTC.form1040.taxAfterCredits).toBeLessThan(withoutFTC.form1040.taxAfterCredits);
    });
  });

  describe('MFJ with categories', () => {
    it('should compute correct limitations for MFJ with categories', () => {
      const result = calculateForeignTaxCredit(
        2000, 15000, 80000, 12000,
        FilingStatus.MarriedFilingJointly,
        [
          { category: 'general', foreignTaxPaid: 1200, foreignSourceIncome: 10000 },
          { category: 'passive', foreignTaxPaid: 800, foreignSourceIncome: 5000 },
        ],
      );

      // General: limitation = 12000 × (10000/80000) = $1,500; credit = min(1200, 1500) = $1,200
      const general = result.categoryResults!.find(c => c.category === 'general')!;
      expect(general.creditAllowed).toBe(1200);

      // Passive: limitation = 12000 × (5000/80000) = $750; credit = min(800, 750) = $750
      const passive = result.categoryResults!.find(c => c.category === 'passive')!;
      expect(passive.creditAllowed).toBe(750);

      expect(result.creditAllowed).toBe(1950);
    });
  });
});
