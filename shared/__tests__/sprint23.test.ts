import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { validateHeadOfHousehold } from '../src/engine/filingStatusValidation.js';
import { FilingStatus, TaxReturn, Form4797Property } from '../src/types/index.js';

// ─── Helper: minimal valid TaxReturn ───────────────────
function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint23',
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
// 23A: Form 4797 → form1040.ts Integration
// IRC §§1231, 1245, 1250 routing through orchestrator
// ════════════════════════════════════════════════════════
describe('Sprint 23A: Form 4797 Integration', () => {

  describe('§1245 recapture → ordinary income → AGI', () => {
    it('should add §1245 recapture to total income', () => {
      // Equipment sold: cost $50k, depreciation $30k, sold for $60k
      // Adjusted basis = 50k - 30k = 20k, gain = 60k - 20k = 40k
      // §1245 recapture = min(40k, 30k) = $30k ordinary income
      // §1231 gain = 40k - 30k = $10k → LTCG
      const result = calculateForm1040(baseTaxReturn({
        form4797Properties: [{
          id: 'equip-1',
          description: 'Office Equipment',
          dateAcquired: '2020-01-01',
          dateSold: '2025-06-15',
          salesPrice: 60000,
          costBasis: 50000,
          depreciationAllowed: 30000,
          isSection1245: true,
        }],
      }));

      expect(result.form4797).toBeDefined();
      expect(result.form4797!.totalOrdinaryIncome).toBe(30000);
      expect(result.form4797!.netSection1231GainOrLoss).toBe(10000);
      expect(result.form4797!.section1231IsGain).toBe(true);
      // Ordinary income flows to total income
      expect(result.form1040.form4797OrdinaryIncome).toBe(30000);
      // §1231 gain flows as LTCG
      expect(result.form1040.form4797Section1231GainOrLoss).toBe(10000);
      // Total income should include both:
      // wages 60k + 30k ordinary + 10k §1231 gain
      expect(result.form1040.totalIncome).toBe(100000);
    });

    it('should increase AGI by §1245 recapture amount', () => {
      const withoutForm4797 = calculateForm1040(baseTaxReturn());
      const withForm4797 = calculateForm1040(baseTaxReturn({
        form4797Properties: [{
          id: 'equip-1',
          description: 'Machinery',
          dateAcquired: '2022-01-01',
          dateSold: '2025-06-15',
          salesPrice: 30000,
          costBasis: 25000,
          depreciationAllowed: 10000,
          isSection1245: true,
        }],
      }));

      // Gain = 30k - (25k - 10k) = 15k; §1245 ordinary = min(15k, 10k) = 10k; §1231 = 5k
      const expectedIncrease = 15000; // 10k ordinary + 5k LTCG
      expect(withForm4797.form1040.agi).toBe(withoutForm4797.form1040.agi + expectedIncrease);
    });
  });

  describe('§1250 rental sale with 25% rate zone', () => {
    it('should route unrecaptured §1250 gain to 25% rate zone', () => {
      // Rental building: cost $200k, straight-line depreciation $50k, sold for $230k
      // Adjusted basis = 200k - 50k = 150k, gain = 230k - 150k = 80k
      // §1250 excess = 0 (straight-line only), unrecaptured = min(80k, 50k) = 50k
      // §1231 gain = 80k (full remaining gain after ordinary recapture)
      const result = calculateForm1040(baseTaxReturn({
        form4797Properties: [{
          id: 'rental-1',
          description: 'Rental Building',
          dateAcquired: '2015-01-01',
          dateSold: '2025-06-15',
          salesPrice: 230000,
          costBasis: 200000,
          depreciationAllowed: 50000,
          isSection1250: true,
          straightLineDepreciation: 50000,
        }],
      }));

      expect(result.form4797).toBeDefined();
      expect(result.form4797!.totalOrdinaryIncome).toBe(0); // no excess depreciation
      expect(result.form4797!.unrecapturedSection1250Gain).toBe(50000);
      expect(result.form4797!.netSection1231GainOrLoss).toBe(80000);
      expect(result.form4797!.section1231IsGain).toBe(true);
      // section1250Tax should be non-zero (25% on 50k unrecaptured)
      expect(result.form1040.section1250Tax).toBeGreaterThan(0);
    });

    it('should combine Form 4797 unrecaptured gain with direct input', () => {
      const result = calculateForm1040(baseTaxReturn({
        unrecapturedSection1250Gain: 5000,  // Direct input (e.g., K-1)
        form4797Properties: [{
          id: 'rental-1',
          description: 'Rental Building',
          dateAcquired: '2018-01-01',
          dateSold: '2025-06-15',
          salesPrice: 130000,
          costBasis: 100000,
          depreciationAllowed: 20000,
          isSection1250: true,
          straightLineDepreciation: 20000,
        }],
        // Need LTCG to be seen as preferential income:
        income1099DIV: [{
          id: 'div-1', payerName: 'Fund', ordinaryDividends: 1000, qualifiedDividends: 1000,
        }],
      }));

      // Form 4797 produces 20k unrecaptured + 5k direct = 25k total
      // The capitalGains calculation should see 25k total unrecaptured
      expect(result.form4797!.unrecapturedSection1250Gain).toBe(20000);
      // section1250Tax should reflect combined amount
      expect(result.form1040.section1250Tax).toBeGreaterThan(0);
    });
  });

  describe('§1231 loss → ordinary loss', () => {
    it('should deduct §1231 net loss from total income', () => {
      // Property sold at a loss: cost $100k, depreciation $0, sold for $80k
      // Adjusted basis = 100k, loss = 80k - 100k = -20k → ordinary loss
      const result = calculateForm1040(baseTaxReturn({
        form4797Properties: [{
          id: 'prop-1',
          description: 'Business Property',
          dateAcquired: '2020-01-01',
          dateSold: '2025-06-15',
          salesPrice: 80000,
          costBasis: 100000,
          depreciationAllowed: 0,
          isSection1245: true,
        }],
      }));

      expect(result.form4797!.netSection1231GainOrLoss).toBe(-20000);
      expect(result.form4797!.section1231IsGain).toBe(false);
      expect(result.form1040.form4797Section1231GainOrLoss).toBe(-20000);
      // Total income should be reduced: wages 60k - 20k loss = 40k
      expect(result.form1040.totalIncome).toBe(40000);
    });

    it('should handle mixed §1231 netting (gain > loss)', () => {
      // Two properties: one gain, one loss, net positive
      const result = calculateForm1040(baseTaxReturn({
        form4797Properties: [
          {
            id: 'gain-1',
            description: 'Equipment A',
            dateAcquired: '2020-01-01',
            dateSold: '2025-06-15',
            salesPrice: 50000,
            costBasis: 30000,
            depreciationAllowed: 0,
          },
          {
            id: 'loss-1',
            description: 'Equipment B',
            dateAcquired: '2021-01-01',
            dateSold: '2025-06-15',
            salesPrice: 10000,
            costBasis: 25000,
            depreciationAllowed: 0,
          },
        ],
      }));

      // Property A: gain = 50k - 30k = 20k → §1231 gain
      // Property B: loss = 10k - 25k = -15k → §1231 loss
      // Net: 20k - 15k = 5k → net §1231 gain → LTCG
      expect(result.form4797!.netSection1231GainOrLoss).toBe(5000);
      expect(result.form4797!.section1231IsGain).toBe(true);
      expect(result.form1040.form4797Section1231GainOrLoss).toBe(5000);
    });
  });

  describe('NIIT interaction', () => {
    it('should include §1231 gain in NIIT investment income', () => {
      // High-income taxpayer with §1231 gain — should trigger NIIT
      const result = calculateForm1040(baseTaxReturn({
        w2Income: [{ id: 'w2-1', employerName: 'BigCo', wages: 250000, federalTaxWithheld: 50000 }],
        form4797Properties: [{
          id: 'prop-1',
          description: 'Equipment',
          dateAcquired: '2019-01-01',
          dateSold: '2025-06-15',
          salesPrice: 80000,
          costBasis: 50000,
          depreciationAllowed: 0,
        }],
      }));

      // §1231 gain = 30k, treated as LTCG → investment income for NIIT
      expect(result.form4797!.netSection1231GainOrLoss).toBe(30000);
      // AGI = 250k + 30k = 280k, above Single NIIT threshold of $200k
      expect(result.form1040.niitTax).toBeGreaterThan(0);
    });

    it('should NOT include §1245/§1250 ordinary recapture in NIIT', () => {
      // Two scenarios: same total gain ($30k), different character
      // Scenario A: All gain is §1245 ordinary recapture (NOT NII)
      //   costBasis $50k, dep $30k, adjBasis $20k, sold $50k → gain $30k, §1245 ordinary $30k, §1231 $0
      // Scenario B: All gain is §1231 LTCG (IS NII)
      //   costBasis $50k, dep $0, sold $80k → gain $30k, ordinary $0, §1231 $30k
      const withRecapture = calculateForm1040(baseTaxReturn({
        w2Income: [{ id: 'w2-1', employerName: 'BigCo', wages: 250000, federalTaxWithheld: 50000 }],
        form4797Properties: [{
          id: 'equip-1',
          description: 'Equipment',
          dateAcquired: '2019-01-01',
          dateSold: '2025-06-15',
          salesPrice: 50000,
          costBasis: 50000,
          depreciationAllowed: 30000, // adjBasis=20k, gain=30k, all §1245 recapture
          isSection1245: true,
        }],
      }));

      const withoutRecapture = calculateForm1040(baseTaxReturn({
        w2Income: [{ id: 'w2-1', employerName: 'BigCo', wages: 250000, federalTaxWithheld: 50000 }],
        form4797Properties: [{
          id: 'equip-1',
          description: 'Equipment',
          dateAcquired: '2019-01-01',
          dateSold: '2025-06-15',
          salesPrice: 80000,
          costBasis: 50000,
          depreciationAllowed: 0, // adjBasis=50k, gain=30k, all §1231
        }],
      }));

      // Both have $30k gain, same AGI ($280k), same AGI excess ($80k)
      // With §1245: NII = 0 (recapture is NOT investment income), NIIT = 0
      // Without: NII = $30k (§1231 gain IS investment income), NIIT = 0.038 × min(30k, 80k) = $1,140
      expect(withRecapture.form1040.niitTax).toBe(0);
      expect(withoutRecapture.form1040.niitTax).toBe(1140);
    });
  });

  describe('Form 4797 + Schedule D combined', () => {
    it('should combine Form 4797 §1231 gain with Schedule D LTCG for preferential rates', () => {
      const result = calculateForm1040(baseTaxReturn({
        income1099B: [{
          id: 'stock-1',
          brokerName: 'Broker',
          description: '100 shares AAPL',
          dateAcquired: '2020-01-01',
          dateSold: '2025-06-15',
          proceeds: 30000,
          costBasis: 20000,
          isLongTerm: true,
        }],
        form4797Properties: [{
          id: 'prop-1',
          description: 'Business Property',
          dateAcquired: '2018-01-01',
          dateSold: '2025-06-15',
          salesPrice: 60000,
          costBasis: 40000,
          depreciationAllowed: 0,
        }],
      }));

      // Schedule D: $10k LTCG from stock
      // Form 4797: $20k §1231 gain → LTCG
      // Both should get preferential rate treatment
      expect(result.form1040.preferentialTax).toBeGreaterThan(0);
      // Total preferential income: 10k stock + 20k §1231 = 30k at 0/15/20%
      expect(result.form1040.totalIncome).toBe(60000 + 10000 + 20000); // wages + stock + §1231
    });
  });

  describe('K-1 §1231 + direct Form 4797 §1231 combined', () => {
    it('should combine K-1 §1231 gain with Form 4797 §1231 gain', () => {
      const result = calculateForm1040(baseTaxReturn({
        incomeK1: [{
          id: 'k1-1',
          entityName: 'Partnership ABC',
          entityType: 'partnership',
          netSection1231Gain: 15000,
        }],
        form4797Properties: [{
          id: 'prop-1',
          description: 'Business Equipment',
          dateAcquired: '2019-01-01',
          dateSold: '2025-06-15',
          salesPrice: 50000,
          costBasis: 40000,
          depreciationAllowed: 0,
        }],
      }));

      // K-1 §1231 gain: $15k (→ LTCG through k1 routing)
      // Form 4797 §1231 gain: $10k
      // Both contribute to preferential LTCG
      expect(result.form4797!.netSection1231GainOrLoss).toBe(10000);
      expect(result.form1040.totalIncome).toBe(60000 + 15000 + 10000);
    });
  });

  describe('No Form 4797 properties — backward compatibility', () => {
    it('should produce no Form 4797 result when no properties provided', () => {
      const result = calculateForm1040(baseTaxReturn());
      expect(result.form4797).toBeUndefined();
      expect(result.form1040.form4797OrdinaryIncome).toBe(0);
      expect(result.form1040.form4797Section1231GainOrLoss).toBe(0);
    });

    it('should produce no Form 4797 result when empty array', () => {
      const result = calculateForm1040(baseTaxReturn({
        form4797Properties: [],
      }));
      expect(result.form4797).toBeUndefined();
      expect(result.form1040.form4797OrdinaryIncome).toBe(0);
    });
  });

  describe('Complex multi-property scenario', () => {
    it('should handle mixed §1245 + §1250 + undesignated properties', () => {
      const result = calculateForm1040(baseTaxReturn({
        form4797Properties: [
          // §1245: equipment, gain with full recapture
          {
            id: 'equip-1',
            description: 'Machinery',
            dateAcquired: '2020-01-01',
            dateSold: '2025-06-15',
            salesPrice: 40000,
            costBasis: 35000,
            depreciationAllowed: 15000,
            isSection1245: true,
          },
          // §1250: rental building, straight-line depreciation
          {
            id: 'rental-1',
            description: 'Rental Building',
            dateAcquired: '2015-01-01',
            dateSold: '2025-06-15',
            salesPrice: 300000,
            costBasis: 250000,
            depreciationAllowed: 40000,
            isSection1250: true,
            straightLineDepreciation: 40000,
          },
          // Loss property
          {
            id: 'loss-1',
            description: 'Warehouse',
            dateAcquired: '2022-01-01',
            dateSold: '2025-06-15',
            salesPrice: 50000,
            costBasis: 70000,
            depreciationAllowed: 0,
          },
        ],
      }));

      // Equip: gain = 40k - (35k-15k) = 20k; §1245 ordinary = min(20k, 15k) = 15k; §1231 = 5k
      // Rental: gain = 300k - (250k-40k) = 90k; ordinary = 0; unrecap = min(90k, 40k) = 40k; §1231 = 90k
      // Warehouse: loss = 50k - 70k = -20k; §1231 loss
      expect(result.form4797!.totalOrdinaryIncome).toBe(15000);
      expect(result.form4797!.unrecapturedSection1250Gain).toBe(40000);
      // Net §1231: 5k + 90k - 20k = 75k → gain → LTCG
      expect(result.form4797!.netSection1231GainOrLoss).toBe(75000);
      expect(result.form4797!.section1231IsGain).toBe(true);

      // Total income: wages 60k + 15k ordinary + 75k LTCG = 150k
      expect(result.form1040.totalIncome).toBe(150000);
      // section1250Tax should be non-zero from 40k unrecaptured
      expect(result.form1040.section1250Tax).toBeGreaterThan(0);
    });
  });

  describe('All filing statuses with Form 4797', () => {
    const filingStatuses = [
      FilingStatus.Single,
      FilingStatus.MarriedFilingJointly,
      FilingStatus.MarriedFilingSeparately,
      FilingStatus.HeadOfHousehold,
      FilingStatus.QualifyingSurvivingSpouse,
    ];

    for (const fs of filingStatuses) {
      it(`should compute correctly for ${FilingStatus[fs]}`, () => {
        const result = calculateForm1040(baseTaxReturn({
          filingStatus: fs,
          dependents: fs === FilingStatus.HeadOfHousehold
            ? [{ id: 'd1', firstName: 'Child', lastName: 'Test', relationship: 'son', monthsLivedWithYou: 12 }]
            : [],
          form4797Properties: [{
            id: 'prop-1',
            description: 'Equipment',
            dateAcquired: '2020-01-01',
            dateSold: '2025-06-15',
            salesPrice: 50000,
            costBasis: 30000,
            depreciationAllowed: 10000,
            isSection1245: true,
          }],
        }));

        // Gain = 50k - (30k-10k) = 30k; §1245 ordinary = 10k; §1231 = 20k
        expect(result.form4797!.totalOrdinaryIncome).toBe(10000);
        expect(result.form4797!.netSection1231GainOrLoss).toBe(20000);
        expect(result.form1040.totalIncome).toBe(90000); // 60k + 10k + 20k
        expect(result.form1040.totalTax).toBeGreaterThan(0);
      });
    }
  });
});

// ════════════════════════════════════════════════════════
// 23B: Head of Household Filing Status Validation
// IRC §2(b)
// ════════════════════════════════════════════════════════
describe('Sprint 23B: Head of Household Validation', () => {

  describe('validateHeadOfHousehold — direct', () => {
    it('should pass when all requirements met', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Child', lastName: 'Test',
          relationship: 'son', monthsLivedWithYou: 12,
        }],
        paidOverHalfHouseholdCost: true,
      }) as TaxReturn);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid for non-HoH filing statuses', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.Single,
      }) as TaxReturn);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should error when no dependents claimed', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [],
        paidOverHalfHouseholdCost: true,
      }) as TaxReturn);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some(e => e.includes('qualifying person'))).toBe(true);
    });

    it('should error when dependents lived < 7 months (not parent)', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Child', lastName: 'Test',
          relationship: 'son', monthsLivedWithYou: 5,
        }],
        paidOverHalfHouseholdCost: true,
      }) as TaxReturn);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('more than half the year'))).toBe(true);
    });

    it('should pass when dependent lived exactly 7 months', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Child', lastName: 'Test',
          relationship: 'daughter', monthsLivedWithYou: 7,
        }],
        paidOverHalfHouseholdCost: true,
      }) as TaxReturn);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow dependent parent exception (does not need to live with taxpayer)', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Mom', lastName: 'Test',
          relationship: 'parent', monthsLivedWithYou: 0,
        }],
        paidOverHalfHouseholdCost: true,
      }) as TaxReturn);

      expect(result.isValid).toBe(true);
      // Should have a warning about parent not living with taxpayer
      expect(result.warnings.some(w => w.includes('dependent parent'))).toBe(true);
    });

    it('should allow "mother" as parent relationship', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Mom', lastName: 'Test',
          relationship: 'mother', monthsLivedWithYou: 0,
        }],
        paidOverHalfHouseholdCost: true,
      }) as TaxReturn);

      expect(result.isValid).toBe(true);
    });

    it('should allow "father" as parent relationship', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Dad', lastName: 'Test',
          relationship: 'father', monthsLivedWithYou: 2,
        }],
        paidOverHalfHouseholdCost: true,
      }) as TaxReturn);

      expect(result.isValid).toBe(true);
    });

    it('should error when paidOverHalfHouseholdCost is false', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Child', lastName: 'Test',
          relationship: 'son', monthsLivedWithYou: 12,
        }],
        paidOverHalfHouseholdCost: false,
      }) as TaxReturn);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('more than half the cost'))).toBe(true);
    });

    it('should warn when paidOverHalfHouseholdCost is undefined', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Child', lastName: 'Test',
          relationship: 'son', monthsLivedWithYou: 12,
        }],
        // paidOverHalfHouseholdCost not set
      }) as TaxReturn);

      // Valid (no error) but should have a warning
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('household maintenance costs'))).toBe(true);
    });

    it('should warn when spouse info present without livedApart flag', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Child', lastName: 'Test',
          relationship: 'son', monthsLivedWithYou: 12,
        }],
        paidOverHalfHouseholdCost: true,
        spouseFirstName: 'Jane',
        spouseLastName: 'Doe',
        // livedApartFromSpouse not set
      }) as TaxReturn);

      expect(result.isValid).toBe(true); // Warning, not error
      expect(result.warnings.some(w => w.includes('Spouse information'))).toBe(true);
    });

    it('should not warn about spouse if livedApart is true', () => {
      const result = validateHeadOfHousehold(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Child', lastName: 'Test',
          relationship: 'son', monthsLivedWithYou: 12,
        }],
        paidOverHalfHouseholdCost: true,
        spouseFirstName: 'Jane',
        spouseLastName: 'Doe',
        livedApartFromSpouse: true,
      }) as TaxReturn);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('Spouse information'))).toBe(false);
    });
  });

  describe('HoH validation via form1040 integration', () => {
    it('should include hohValidation in calculation result for HoH filers', () => {
      const result = calculateForm1040(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Child', lastName: 'Test',
          relationship: 'daughter', monthsLivedWithYou: 12,
        }],
        paidOverHalfHouseholdCost: true,
      }));

      expect(result.hohValidation).toBeDefined();
      expect(result.hohValidation!.isValid).toBe(true);
      expect(result.hohValidation!.errors).toHaveLength(0);
    });

    it('should not include hohValidation for non-HoH filers', () => {
      const result = calculateForm1040(baseTaxReturn({
        filingStatus: FilingStatus.Single,
      }));

      expect(result.hohValidation).toBeUndefined();
    });

    it('should not block calculation even when HoH is invalid', () => {
      const result = calculateForm1040(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [], // No qualifying person — invalid
        paidOverHalfHouseholdCost: false,
      }));

      // Calculation should still complete (non-blocking)
      expect(result.hohValidation).toBeDefined();
      expect(result.hohValidation!.isValid).toBe(false);
      expect(result.hohValidation!.errors.length).toBeGreaterThanOrEqual(1);
      // Tax should still be computed using HoH brackets
      expect(result.form1040.totalTax).toBeGreaterThan(0);
      expect(result.form1040.totalIncome).toBeGreaterThan(0);
    });

    it('should use HoH brackets for tax calculation regardless of validation', () => {
      // HoH has wider brackets than Single
      const hohResult = calculateForm1040(baseTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'd1', firstName: 'Child', lastName: 'Test',
          relationship: 'son', monthsLivedWithYou: 12,
        }],
        paidOverHalfHouseholdCost: true,
      }));
      const singleResult = calculateForm1040(baseTaxReturn({
        filingStatus: FilingStatus.Single,
      }));

      // At $60k wages, HoH should have lower tax than Single due to wider brackets
      expect(hohResult.form1040.incomeTax).toBeLessThan(singleResult.form1040.incomeTax);
    });
  });
});
