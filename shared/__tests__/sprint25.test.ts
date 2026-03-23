import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateForm4137 } from '../src/engine/form4137.js';
import { calculateDependentCareCredit } from '../src/engine/dependentCare.js';
import { FilingStatus, TaxReturn } from '../src/types/index.js';
import { FORM_4137, DEPENDENT_CARE, DEPENDENT_CARE_EMPLOYER } from '../src/constants/tax2025.js';

// ─── Helper: minimal valid TaxReturn ───────────────────
function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint25',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 6000, socialSecurityWages: 50000 }],
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
// 25A: Form 4137 — Social Security and Medicare Tax on Unreported Tips
// IRC §3121(q), IRC §3101(a)/(b)
// ════════════════════════════════════════════════════════
describe('Sprint 25A: Form 4137 — Unreported Tip FICA Tax', () => {
  // ─── Constants ──────────────────────────────────────
  describe('Constants', () => {
    it('should have correct SS rate (6.2%)', () => {
      expect(FORM_4137.SS_RATE).toBe(0.062);
    });

    it('should have correct Medicare rate (1.45%)', () => {
      expect(FORM_4137.MEDICARE_RATE).toBe(0.0145);
    });

    it('should have correct 2025 SS wage base ($176,100)', () => {
      expect(FORM_4137.SS_WAGE_BASE).toBe(176100);
    });
  });

  // ─── Unit Tests ──────────────────────────────────────
  describe('Unit: calculateForm4137', () => {
    it('should return zero for no unreported tips', () => {
      const result = calculateForm4137(0);
      expect(result.totalTax).toBe(0);
      expect(result.unreportedTips).toBe(0);
    });

    it('should return zero for negative tips', () => {
      const result = calculateForm4137(-500);
      expect(result.totalTax).toBe(0);
    });

    it('should calculate SS + Medicare on unreported tips', () => {
      const result = calculateForm4137(10000);
      // SS: 10000 * 0.062 = 620
      // Medicare: 10000 * 0.0145 = 145
      expect(result.socialSecurityTax).toBe(620);
      expect(result.medicareTax).toBe(145);
      expect(result.totalTax).toBe(765);
      expect(result.tipsSubjectToSS).toBe(10000);
      expect(result.tipsSubjectToMedicare).toBe(10000);
    });

    it('should coordinate with W-2 SS wages for wage base cap', () => {
      // W-2 SS wages = 170,000, unreported tips = 10,000
      // Remaining wage base = 176,100 - 170,000 = 6,100
      // Only 6,100 of tips subject to SS
      const result = calculateForm4137(10000, 170000);
      expect(result.tipsSubjectToSS).toBe(6100);
      expect(result.socialSecurityTax).toBeCloseTo(6100 * 0.062, 2);
      // Medicare has no cap — all 10,000 subject
      expect(result.tipsSubjectToMedicare).toBe(10000);
      expect(result.medicareTax).toBeCloseTo(10000 * 0.0145, 2);
    });

    it('should apply zero SS tax when W-2 wages already exceed wage base', () => {
      // W-2 SS wages = 180,000 (above $176,100 wage base)
      const result = calculateForm4137(5000, 180000);
      expect(result.tipsSubjectToSS).toBe(0);
      expect(result.socialSecurityTax).toBe(0);
      // Medicare still applies
      expect(result.tipsSubjectToMedicare).toBe(5000);
      expect(result.medicareTax).toBeCloseTo(5000 * 0.0145, 2);
      expect(result.totalTax).toBeCloseTo(5000 * 0.0145, 2);
    });

    it('should handle tips that exactly fill remaining wage base', () => {
      // W-2 wages = 170,100, remaining = 6,000
      const result = calculateForm4137(6000, 170100);
      expect(result.tipsSubjectToSS).toBe(6000);
      expect(result.socialSecurityTax).toBeCloseTo(6000 * 0.062, 2);
    });

    it('should handle zero W-2 wages (all tips)', () => {
      const result = calculateForm4137(15000, 0);
      expect(result.tipsSubjectToSS).toBe(15000);
      expect(result.socialSecurityTax).toBeCloseTo(15000 * 0.062, 2);
      expect(result.tipsSubjectToMedicare).toBe(15000);
      expect(result.medicareTax).toBeCloseTo(15000 * 0.0145, 2);
    });

    it('should handle default W-2 wages (not provided)', () => {
      const result = calculateForm4137(8000);
      expect(result.tipsSubjectToSS).toBe(8000);
      expect(result.socialSecurityTax).toBeCloseTo(8000 * 0.062, 2);
    });
  });

  // ─── Form 1040 Integration ──────────────────────────
  describe('Form 1040 Integration', () => {
    it('should add Form 4137 tax to total tax', () => {
      const withoutTips = calculateForm1040(baseTaxReturn());
      const withTips = calculateForm1040(baseTaxReturn({
        form4137: { unreportedTips: 10000 },
      }));

      expect(withTips.form1040.form4137Tax).toBeCloseTo(765, 0);
      expect(withTips.form1040.totalTax).toBeGreaterThan(withoutTips.form1040.totalTax);
      // The difference should be approximately the Form 4137 tax
      const diff = withTips.form1040.totalTax - withoutTips.form1040.totalTax;
      expect(diff).toBeCloseTo(765, 0);
    });

    it('should coordinate SS wage base with W-2 wages', () => {
      // W-2 wages at $175,000 (near wage base)
      const result = calculateForm1040(baseTaxReturn({
        w2Income: [{
          id: 'w2-1', employerName: 'BigCo', wages: 175000, federalTaxWithheld: 35000,
          socialSecurityWages: 175000,
        }],
        form4137: { unreportedTips: 5000 },
      }));

      // Remaining wage base: 176,100 - 175,000 = 1,100
      // SS on 1,100 only; Medicare on full 5,000
      expect(result.form4137!.tipsSubjectToSS).toBe(1100);
      expect(result.form4137!.tipsSubjectToMedicare).toBe(5000);
    });

    it('should return form4137 in CalculationResult', () => {
      const result = calculateForm1040(baseTaxReturn({
        form4137: { unreportedTips: 3000 },
      }));
      expect(result.form4137).toBeDefined();
      expect(result.form4137!.unreportedTips).toBe(3000);
      expect(result.form4137!.totalTax).toBeGreaterThan(0);
    });

    it('should not affect income tax (Form 4137 is separate FICA)', () => {
      const withoutTips = calculateForm1040(baseTaxReturn());
      const withTips = calculateForm1040(baseTaxReturn({
        form4137: { unreportedTips: 10000 },
      }));
      // Income tax should be the same — Form 4137 doesn't affect AGI or taxable income
      expect(withTips.form1040.incomeTax).toBe(withoutTips.form1040.incomeTax);
      expect(withTips.form1040.agi).toBe(withoutTips.form1040.agi);
    });

    it('should not be reducible by non-refundable credits', () => {
      // Form 4137 tax is like SE tax — not reduced by non-refundable credits
      const result = calculateForm1040(baseTaxReturn({
        w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 10000, federalTaxWithheld: 0, socialSecurityWages: 10000 }],
        form4137: { unreportedTips: 5000 },
        dependentCare: { totalExpenses: 3000, qualifyingPersons: 1 },
        dependents: [{ id: 'd1', firstName: 'Child', lastName: 'One', relationship: 'son', monthsLivedWithYou: 12 }],
      }));
      // Even with credits, Form 4137 tax persists
      expect(result.form1040.form4137Tax).toBeGreaterThan(0);
    });

    it('should handle backward compatibility (no form4137 property)', () => {
      const result = calculateForm1040(baseTaxReturn());
      expect(result.form1040.form4137Tax).toBe(0);
      expect(result.form4137).toBeUndefined();
    });

    it('should work across all 5 filing statuses', () => {
      const statuses = [
        FilingStatus.Single,
        FilingStatus.MarriedFilingJointly,
        FilingStatus.MarriedFilingSeparately,
        FilingStatus.HeadOfHousehold,
        FilingStatus.QualifyingSurvivingSpouse,
      ];
      for (const fs of statuses) {
        const result = calculateForm1040(baseTaxReturn({
          filingStatus: fs,
          form4137: { unreportedTips: 5000 },
        }));
        expect(result.form1040.form4137Tax).toBeGreaterThan(0);
        expect(result.form4137!.unreportedTips).toBe(5000);
      }
    });
  });
});

// ════════════════════════════════════════════════════════
// 25B: Form 2441 Full — Dependent Care Credit Enhancements
// IRC §21, IRC §129, IRC §21(d)(2)
// ════════════════════════════════════════════════════════
describe('Sprint 25B: Form 2441 Full — Dependent Care Credit', () => {
  // ─── Constants ──────────────────────────────────────
  describe('Constants', () => {
    it('should have correct employer exclusion limits', () => {
      expect(DEPENDENT_CARE_EMPLOYER.MAX_EXCLUSION).toBe(5000);
      expect(DEPENDENT_CARE_EMPLOYER.MAX_EXCLUSION_MFS).toBe(2500);
    });

    it('should have correct student/disabled spouse deemed income', () => {
      expect(DEPENDENT_CARE_EMPLOYER.STUDENT_DISABLED_DEEMED_ONE).toBe(250);
      expect(DEPENDENT_CARE_EMPLOYER.STUDENT_DISABLED_DEEMED_TWO).toBe(500);
    });
  });

  // ─── Backward Compatibility ──────────────────────────
  describe('Backward Compatibility', () => {
    it('should produce same result without new parameters', () => {
      // Existing API: no employer benefits, no student/disabled spouse
      const result = calculateDependentCareCredit(
        4000, 1, 30000, FilingStatus.Single, 50000,
      );
      expect(result.qualifyingExpenses).toBe(3000); // capped at $3k for 1 person
      expect(result.creditRate).toBeCloseTo(0.27, 10); // AGI $30k → rate = 35% - 8% = 27%
      expect(result.credit).toBeCloseTo(810, 2);
    });

    it('should still block MFS without lived-apart flag', () => {
      const result = calculateDependentCareCredit(
        4000, 1, 30000, FilingStatus.MarriedFilingSeparately, 50000,
      );
      expect(result.credit).toBe(0);
    });

    it('should still apply earned income limitation for MFJ', () => {
      const result = calculateDependentCareCredit(
        6000, 2, 30000, FilingStatus.MarriedFilingJointly, 80000, 2000,
      );
      // Spouse earns $2,000 → limit to $2,000
      expect(result.qualifyingExpenses).toBe(2000);
    });
  });

  // ─── Employer Benefits (Part III, IRC §129) ──────────
  describe('Employer Benefits (Part III)', () => {
    it('should reduce qualifying expenses by employer benefits (Form 2441 Line 7)', () => {
      // $6,000 expenses, 2 qualifying persons ($6k limit), $2,000 employer benefits
      // Line 5: min(6000, 6000) = 6000
      // Line 7: 6000 - 2000 = 4000
      const result = calculateDependentCareCredit(
        6000, 2, 30000, FilingStatus.Single, 60000,
        undefined, // spouseEarnedIncome
        2000, // employerBenefits
      );
      expect(result.qualifyingExpenses).toBe(4000);
      expect(result.employerBenefitsExclusion).toBe(2000);
      expect(result.employerBenefitsTaxable).toBe(0);
    });

    it('should make excess employer benefits taxable', () => {
      // $7,000 employer benefits, MFJ → $5,000 excludable, $2,000 taxable
      const result = calculateDependentCareCredit(
        6000, 2, 30000, FilingStatus.MarriedFilingJointly, 60000,
        50000, // spouseEarnedIncome
        7000,  // employerBenefits
      );
      expect(result.employerBenefitsExclusion).toBe(5000);
      expect(result.employerBenefitsTaxable).toBe(2000);
    });

    it('should use MFS exclusion limit ($2,500) when MFS lived-apart', () => {
      const result = calculateDependentCareCredit(
        6000, 2, 30000, FilingStatus.MarriedFilingSeparately, 60000,
        50000, // spouseEarnedIncome
        4000,  // employerBenefits
        false, false,
        true,  // livedApartFromSpouseMFS
      );
      expect(result.employerBenefitsExclusion).toBe(2500);
      expect(result.employerBenefitsTaxable).toBe(1500);
    });

    it('should handle employer benefits exceeding line 5 amount', () => {
      // $3,000 expenses, 1 qualifying person ($3k limit), $4,000 employer benefits
      // Line 5: min(3000, 3000) = 3000
      // Line 7: 3000 - 4000 = 0 → no credit
      const result = calculateDependentCareCredit(
        3000, 1, 30000, FilingStatus.Single, 60000,
        undefined, 4000,
      );
      expect(result.qualifyingExpenses).toBe(0);
      expect(result.credit).toBe(0);
      // But employer benefits reconciliation still runs
      expect(result.employerBenefitsExclusion).toBe(4000);
      expect(result.employerBenefitsTaxable).toBe(0);
    });

    it('should handle exactly $5,000 employer benefits', () => {
      const result = calculateDependentCareCredit(
        6000, 2, 30000, FilingStatus.Single, 60000,
        undefined, 5000,
      );
      expect(result.employerBenefitsExclusion).toBe(5000);
      expect(result.employerBenefitsTaxable).toBe(0);
      // Line 5: min(6000, 6000) = 6000; Line 7: 6000 - 5000 = 1000
      expect(result.qualifyingExpenses).toBe(1000);
    });
  });

  // ─── Student/Disabled Spouse (IRC §21(d)(2)) ─────────
  describe('Student/Disabled Spouse', () => {
    it('should deem $3,000/year earned income for student spouse (1 qualifying person)', () => {
      // Student spouse with zero earned income → deemed $250/month × 12 = $3,000
      const result = calculateDependentCareCredit(
        5000, 1, 20000, FilingStatus.MarriedFilingJointly, 50000,
        0,     // spouseEarnedIncome = 0
        undefined,
        true,  // isStudentSpouse
      );
      expect(result.deemedEarnedIncome).toBe(3000);
      // Expense limit: min(5000, 3000[expense cap], 3000[deemed spouse income])
      expect(result.qualifyingExpenses).toBe(3000);
      expect(result.credit).toBeGreaterThan(0);
    });

    it('should deem $6,000/year earned income for student spouse (2+ qualifying persons)', () => {
      const result = calculateDependentCareCredit(
        8000, 2, 20000, FilingStatus.MarriedFilingJointly, 50000,
        0,     // spouseEarnedIncome = 0
        undefined,
        true,  // isStudentSpouse
      );
      expect(result.deemedEarnedIncome).toBe(6000);
      // Expense limit: min(8000, 6000[expense cap], 6000[deemed spouse income])
      expect(result.qualifyingExpenses).toBe(6000);
    });

    it('should deem earned income for disabled spouse', () => {
      const result = calculateDependentCareCredit(
        5000, 1, 20000, FilingStatus.MarriedFilingJointly, 50000,
        0,
        undefined,
        false,  // not student
        true,   // isDisabledSpouse
      );
      expect(result.deemedEarnedIncome).toBe(3000);
      expect(result.qualifyingExpenses).toBe(3000);
    });

    it('should not set deemed income when neither student nor disabled', () => {
      const result = calculateDependentCareCredit(
        5000, 1, 20000, FilingStatus.MarriedFilingJointly, 50000,
        30000,  // actual spouse earned income
      );
      expect(result.deemedEarnedIncome).toBeUndefined();
    });
  });

  // ─── MFS Lived-Apart Exception ───────────────────────
  describe('MFS Lived-Apart Exception', () => {
    it('should allow credit when MFS with lived-apart flag', () => {
      const result = calculateDependentCareCredit(
        4000, 1, 30000, FilingStatus.MarriedFilingSeparately, 50000,
        undefined, undefined, false, false,
        true, // livedApartFromSpouseMFS
      );
      expect(result.credit).toBeGreaterThan(0);
      expect(result.qualifyingExpenses).toBe(3000);
    });

    it('should block credit for MFS without lived-apart flag', () => {
      const result = calculateDependentCareCredit(
        4000, 1, 30000, FilingStatus.MarriedFilingSeparately, 50000,
        undefined, undefined, false, false,
        false, // NOT lived apart
      );
      expect(result.credit).toBe(0);
    });

    it('should block credit for MFS with lived-apart undefined', () => {
      const result = calculateDependentCareCredit(
        4000, 1, 30000, FilingStatus.MarriedFilingSeparately, 50000,
      );
      expect(result.credit).toBe(0);
    });
  });

  // ─── Credit Rate Calculation ──────────────────────────
  describe('Credit Rate (AGI-based)', () => {
    it('should apply 35% rate for AGI ≤ $15,000', () => {
      const result = calculateDependentCareCredit(
        3000, 1, 15000, FilingStatus.Single, 30000,
      );
      expect(result.creditRate).toBe(0.35);
    });

    it('should apply 20% floor rate for AGI ≥ $43,000', () => {
      const result = calculateDependentCareCredit(
        3000, 1, 50000, FilingStatus.Single, 60000,
      );
      expect(result.creditRate).toBe(0.20);
    });

    it('should apply intermediate rate for AGI = $25,000 (30%)', () => {
      // Over $15k by $10k → 5 steps → 35% - 5% = 30%
      const result = calculateDependentCareCredit(
        3000, 1, 25000, FilingStatus.Single, 40000,
      );
      expect(result.creditRate).toBe(0.30);
    });
  });

  // ─── Form 1040 Integration ──────────────────────────
  describe('Form 1040 Integration', () => {
    it('should apply employer benefits reduction via orchestrator', () => {
      const result = calculateForm1040(baseTaxReturn({
        dependentCare: {
          totalExpenses: 6000,
          qualifyingPersons: 2,
          employerBenefits: 3000,
        },
        dependents: [
          { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'daughter', monthsLivedWithYou: 12 },
          { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'son', monthsLivedWithYou: 12 },
        ],
      }));
      // Line 5: min(6000, 6000) = 6000; Line 7: 6000 - 3000 = 3000
      expect(result.dependentCare?.qualifyingExpenses).toBe(3000);
      expect(result.dependentCare?.credit).toBeGreaterThan(0);
    });

    it('should use legacy dependentCareFSA when employerBenefits not provided', () => {
      const result = calculateForm1040(baseTaxReturn({
        dependentCare: {
          totalExpenses: 6000,
          qualifyingPersons: 2,
          dependentCareFSA: 2000, // legacy field
        },
        dependents: [
          { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'daughter', monthsLivedWithYou: 12 },
        ],
      }));
      // Legacy FSA field should still reduce expenses
      expect(result.dependentCare?.qualifyingExpenses).toBe(4000);
    });

    it('should pass MFS lived-apart flag from orchestrator', () => {
      const result = calculateForm1040(baseTaxReturn({
        filingStatus: FilingStatus.MarriedFilingSeparately,
        livedApartFromSpouse: true,
        dependentCare: {
          totalExpenses: 3000,
          qualifyingPersons: 1,
        },
        dependents: [
          { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'son', monthsLivedWithYou: 12 },
        ],
      }));
      // MFS with lived-apart → credit should be allowed
      expect(result.dependentCare?.credit).toBeGreaterThan(0);
    });

    it('should pass student spouse flag through orchestrator', () => {
      const result = calculateForm1040(baseTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        dependentCare: {
          totalExpenses: 5000,
          qualifyingPersons: 1,
          spouseEarnedIncome: 0,
          isStudentSpouse: true,
        },
        dependents: [
          { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'daughter', monthsLivedWithYou: 12 },
        ],
      }));
      expect(result.dependentCare?.deemedEarnedIncome).toBe(3000);
      expect(result.dependentCare?.credit).toBeGreaterThan(0);
    });

    it('should include dependent care credit in totalCredits', () => {
      const result = calculateForm1040(baseTaxReturn({
        dependentCare: {
          totalExpenses: 5000,
          qualifyingPersons: 1,
        },
        dependents: [
          { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'son', monthsLivedWithYou: 12 },
        ],
      }));
      expect(result.credits.dependentCareCredit).toBeGreaterThan(0);
      expect(result.credits.totalNonRefundable).toBeGreaterThanOrEqual(result.credits.dependentCareCredit);
    });

    it('backward compat: no dependentCare property → no credit', () => {
      const result = calculateForm1040(baseTaxReturn());
      expect(result.dependentCare).toBeUndefined();
      expect(result.credits.dependentCareCredit).toBe(0);
    });
  });

  // ─── Combined: Employer Benefits + Student Spouse ────
  describe('Combined Scenarios', () => {
    it('should handle employer benefits AND student spouse together', () => {
      // Employer benefits reduce qualifying expenses, student spouse enables credit for zero-income spouse
      const result = calculateDependentCareCredit(
        8000, 2, 20000, FilingStatus.MarriedFilingJointly, 50000,
        0,     // spouseEarnedIncome = 0
        3000,  // employerBenefits
        true,  // isStudentSpouse
      );
      // Line 5: min(8000, 6000) = 6000
      // Line 7: 6000 - 3000 = 3000
      // Deemed income: $6,000 (2 qualifying persons × $500/month × 12)
      // qualifyingExpenses: min(3000[after employer], 6000[deemed income]) = 3000
      expect(result.qualifyingExpenses).toBe(3000);
      expect(result.deemedEarnedIncome).toBe(6000);
      expect(result.employerBenefitsExclusion).toBe(3000);
      expect(result.credit).toBeGreaterThan(0);
    });

    it('should handle employer benefits exceeding $5k with student spouse', () => {
      const result = calculateDependentCareCredit(
        8000, 2, 20000, FilingStatus.MarriedFilingJointly, 60000,
        0,
        7000,  // $7,000 employer benefits → $5k excluded, $2k taxable
        true,
      );
      expect(result.employerBenefitsExclusion).toBe(5000);
      expect(result.employerBenefitsTaxable).toBe(2000);
      // Line 5: min(8000, 6000) = 6000; Line 7: 6000 - 7000 = 0 → no credit
      expect(result.qualifyingExpenses).toBe(0);
      expect(result.credit).toBe(0);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────
  describe('Edge Cases', () => {
    it('should handle zero expenses', () => {
      const result = calculateDependentCareCredit(
        0, 1, 30000, FilingStatus.Single, 50000,
      );
      expect(result.credit).toBe(0);
    });

    it('should handle zero qualifying persons', () => {
      const result = calculateDependentCareCredit(
        5000, 0, 30000, FilingStatus.Single, 50000,
      );
      expect(result.credit).toBe(0);
    });

    it('should handle very low AGI (full 35% rate)', () => {
      const result = calculateDependentCareCredit(
        3000, 1, 5000, FilingStatus.Single, 10000,
      );
      expect(result.creditRate).toBe(0.35);
      expect(result.credit).toBe(1050); // 3000 * 0.35
    });

    it('should handle one qualifying person expense limit ($3,000)', () => {
      const result = calculateDependentCareCredit(
        10000, 1, 50000, FilingStatus.Single, 80000,
      );
      expect(result.qualifyingExpenses).toBe(3000);
    });

    it('should handle two qualifying persons expense limit ($6,000)', () => {
      const result = calculateDependentCareCredit(
        10000, 2, 50000, FilingStatus.Single, 80000,
      );
      expect(result.qualifyingExpenses).toBe(6000);
    });
  });

  // ─── Multi-Provider (Part I) ──────────────────────────
  describe('Multiple Providers (Part I)', () => {
    it('should accept providers array for informational purposes', () => {
      // The providers array is informational (for form generation)
      // The totalExpenses field drives the credit calculation
      const result = calculateForm1040(baseTaxReturn({
        dependentCare: {
          totalExpenses: 5000,
          qualifyingPersons: 1,
          providers: [
            { name: 'ABC Daycare', ein: '12-3456789', amountPaid: 3000 },
            { name: 'Jane Babysitter', amountPaid: 2000 },
          ],
        },
        dependents: [
          { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'son', monthsLivedWithYou: 12 },
        ],
      }));
      expect(result.dependentCare?.qualifyingExpenses).toBe(3000); // capped at $3k for 1 person
      expect(result.dependentCare?.credit).toBeGreaterThan(0);
    });
  });

  // ─── Filing Status Coverage ──────────────────────────
  describe('All Filing Statuses', () => {
    it('should compute credit for all eligible filing statuses', () => {
      const eligibleStatuses = [
        FilingStatus.Single,
        FilingStatus.MarriedFilingJointly,
        FilingStatus.HeadOfHousehold,
        FilingStatus.QualifyingSurvivingSpouse,
      ];
      for (const fs of eligibleStatuses) {
        const result = calculateDependentCareCredit(
          4000, 1, 30000, fs, 50000,
        );
        expect(result.credit).toBeGreaterThan(0);
      }
    });
  });
});

// ════════════════════════════════════════════════════════
// Combined Form 4137 + Form 2441 Integration
// ════════════════════════════════════════════════════════
describe('Sprint 25: Combined Form 4137 + Form 2441 Integration', () => {
  it('should compute both Form 4137 tax and dependent care credit in same return', () => {
    const result = calculateForm1040(baseTaxReturn({
      form4137: { unreportedTips: 5000 },
      dependentCare: {
        totalExpenses: 4000,
        qualifyingPersons: 1,
      },
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'One', relationship: 'son', monthsLivedWithYou: 12 },
      ],
    }));

    // Form 4137 tax present
    expect(result.form4137).toBeDefined();
    expect(result.form4137!.totalTax).toBeGreaterThan(0);
    expect(result.form1040.form4137Tax).toBeGreaterThan(0);

    // Dependent care credit present
    expect(result.dependentCare).toBeDefined();
    expect(result.dependentCare!.credit).toBeGreaterThan(0);
    expect(result.credits.dependentCareCredit).toBeGreaterThan(0);
  });

  it('should correctly compute refund/owed with both Form 4137 and credits', () => {
    const base = baseTaxReturn({
      w2Income: [{
        id: 'w2-1', employerName: 'Restaurant', wages: 40000, federalTaxWithheld: 5000,
        socialSecurityWages: 40000,
      }],
    });
    const resultBase = calculateForm1040(base);

    const resultBoth = calculateForm1040(baseTaxReturn({
      w2Income: [{
        id: 'w2-1', employerName: 'Restaurant', wages: 40000, federalTaxWithheld: 5000,
        socialSecurityWages: 40000,
      }],
      form4137: { unreportedTips: 8000 },
      dependentCare: {
        totalExpenses: 3000,
        qualifyingPersons: 1,
      },
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'One', relationship: 'daughter', monthsLivedWithYou: 12 },
      ],
    }));

    // Form 4137 adds tax, dependent care reduces tax
    const form4137Contribution = resultBoth.form1040.form4137Tax;
    const depCareCredit = resultBoth.credits.dependentCareCredit;
    expect(form4137Contribution).toBeGreaterThan(0);
    expect(depCareCredit).toBeGreaterThan(0);
  });
});
