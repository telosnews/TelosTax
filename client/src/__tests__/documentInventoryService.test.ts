/**
 * Document Inventory Service Unit Tests
 *
 * Tests the pure buildDocumentInventory() function that analyzes
 * a TaxReturn and returns a structured completeness inventory.
 */

import { describe, it, expect } from 'vitest';
import type { TaxReturn } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';
import { buildDocumentInventory } from '../services/documentInventoryService';

// ─── Helpers ─────────────────────────────────────

/** Minimal empty TaxReturn for testing. */
function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return',
    schemaVersion: 1,
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'basics',
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
    income1099DA: [],
    income1099C: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    income1099Q: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
    expenses: [],
    educationCredits: [],
    deductionMethod: 'standard',
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  } as TaxReturn;
}

// ─── Empty Return ──────────────────────────────

describe('buildDocumentInventory', () => {
  describe('empty return', () => {
    it('returns no income groups and 0% completeness', () => {
      const inv = buildDocumentInventory(makeTaxReturn());
      expect(inv.incomeGroups).toHaveLength(0);
      expect(inv.pendingGroups).toHaveLength(0);
      expect(inv.totalFormsEntered).toBe(0);
      expect(inv.totalFormsPending).toBe(0);
    });

    it('shows non-income sections with correct statuses', () => {
      const inv = buildDocumentInventory(makeTaxReturn());
      expect(inv.nonIncomeSections).toHaveLength(5);

      const personalInfo = inv.nonIncomeSections.find(s => s.id === 'personal_info');
      expect(personalInfo?.status).toBe('missing_required');
      expect(personalInfo?.issues.length).toBeGreaterThan(0);

      const filingStatus = inv.nonIncomeSections.find(s => s.id === 'filing_status');
      expect(filingStatus?.status).toBe('missing_required');
    });
  });

  // ─── Personal Info ──────────────────────────────

  describe('personal info section', () => {
    it('marks complete when all required fields are filled', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        firstName: 'John',
        lastName: 'Doe',
        addressStreet: '123 Main St',
        addressCity: 'Springfield',
        addressState: 'IL',
        addressZip: '62701',
      }));
      const section = inv.nonIncomeSections.find(s => s.id === 'personal_info');
      expect(section?.status).toBe('complete');
      expect(section?.issues).toHaveLength(0);
      expect(section?.summary).toContain('John Doe');
    });

    it('marks missing_required when address is incomplete', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        firstName: 'John',
        lastName: 'Doe',
      }));
      const section = inv.nonIncomeSections.find(s => s.id === 'personal_info');
      expect(section?.status).toBe('missing_required');
      expect(section?.issues.some(i => i.includes('address'))).toBe(true);
    });
  });

  // ─── Filing Status ──────────────────────────────

  describe('filing status section', () => {
    it('marks complete for Single', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        filingStatus: FilingStatus.Single,
      }));
      const section = inv.nonIncomeSections.find(s => s.id === 'filing_status');
      expect(section?.status).toBe('complete');
      expect(section?.summary.some(s => s.includes('Single'))).toBe(true);
    });

    it('marks missing_required for MFJ without spouse name', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
      }));
      const section = inv.nonIncomeSections.find(s => s.id === 'filing_status');
      expect(section?.status).toBe('missing_required');
      expect(section?.issues.some(i => i.includes('spouse'))).toBe(true);
    });

    it('marks complete for MFJ with spouse name', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        spouseFirstName: 'Jane',
        spouseLastName: 'Doe',
      }));
      const section = inv.nonIncomeSections.find(s => s.id === 'filing_status');
      expect(section?.status).toBe('complete');
    });
  });

  // ─── W-2 Income ──────────────────────────────

  describe('W-2 income', () => {
    it('shows complete W-2 with correct total', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { w2: 'yes' },
        w2Income: [{
          id: 'w2-1',
          employerName: 'Acme Corp',
          wages: 75000,
          federalTaxWithheld: 12000,
        }],
      }));
      expect(inv.incomeGroups).toHaveLength(1);
      const group = inv.incomeGroups[0];
      expect(group.formType).toBe('w2');
      expect(group.count).toBe(1);
      expect(group.keyTotal).toBe(75000);
      expect(group.entries[0].status).toBe('complete');
      expect(group.entries[0].label).toBe('Acme Corp');
    });

    it('marks W-2 missing wages as missing_required', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { w2: 'yes' },
        w2Income: [{
          id: 'w2-1',
          employerName: 'Acme Corp',
          wages: 0,
          federalTaxWithheld: 0,
        }],
      }));
      const entry = inv.incomeGroups[0].entries[0];
      expect(entry.status).toBe('missing_required');
      expect(entry.missingRequired.some(m => m.includes('Wages'))).toBe(true);
    });

    it('marks W-2 with only required fields as complete', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { w2: 'yes' },
        w2Income: [{
          id: 'w2-1',
          employerName: 'Acme Corp',
          wages: 50000,
          federalTaxWithheld: 0,
        }],
      }));
      // employerName and wages are filled; federalTaxWithheld=0 is optional → complete
      const entry = inv.incomeGroups[0].entries[0];
      expect(entry.status).toBe('complete');
    });

    it('handles multiple W-2s with mixed completeness', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { w2: 'yes' },
        w2Income: [
          { id: 'w2-1', employerName: 'Acme Corp', wages: 50000, federalTaxWithheld: 0 },
          { id: 'w2-2', employerName: '', wages: 25000, federalTaxWithheld: 0 },
        ],
      }));
      const group = inv.incomeGroups[0];
      expect(group.count).toBe(2);
      expect(group.keyTotal).toBe(75000);
      expect(group.entries[0].status).toBe('complete');
      expect(group.entries[1].status).toBe('missing_required'); // missing employerName
      expect(group.groupStatus).toBe('missing_required'); // worst of all entries
    });
  });

  // ─── 1099-INT ──────────────────────────────

  describe('1099-INT income', () => {
    it('shows complete 1099-INT with correct total', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099int': 'yes' },
        income1099INT: [{
          id: 'int-1',
          payerName: 'First Bank',
          amount: 500,
        }],
      }));
      const group = inv.incomeGroups[0];
      expect(group.formType).toBe('1099int');
      expect(group.keyTotal).toBe(500);
      expect(group.entries[0].status).toBe('complete');
    });
  });

  // ─── 1099-B ──────────────────────────────

  describe('1099-B income', () => {
    it('treats costBasis=0 as filled (gifted stock)', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099b': 'yes' },
        income1099B: [{
          id: 'b-1',
          brokerName: 'E*Trade',
          description: '100 shares AAPL',
          dateSold: '2025-06-15',
          proceeds: 10000,
          costBasis: 0,
          isLongTerm: true,
        }],
      }));
      const entry = inv.incomeGroups[0].entries[0];
      // costBasis=0 is valid (gifted stock) thanks to allowZero
      expect(entry.status).toBe('complete');
      expect(entry.missingRequired).toHaveLength(0);
    });

    it('marks missing_required when costBasis is undefined', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099b': 'yes' },
        income1099B: [{
          id: 'b-1',
          brokerName: 'E*Trade',
          description: '100 shares AAPL',
          dateSold: '2025-06-15',
          proceeds: 10000,
          costBasis: undefined as unknown as number, // Intentionally missing
          isLongTerm: true,
        }],
      }));
      const entry = inv.incomeGroups[0].entries[0];
      expect(entry.status).toBe('missing_required');
      expect(entry.missingRequired.some(m => m.includes('Cost basis'))).toBe(true);
    });

    it('shows complete 1099-B with net gain/loss total', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099b': 'yes' },
        income1099B: [{
          id: 'b-1',
          brokerName: 'E*Trade',
          description: '100 shares AAPL',
          dateSold: '2025-06-15',
          proceeds: 10000,
          costBasis: 8000,
          isLongTerm: true,
        }],
      }));
      const group = inv.incomeGroups[0];
      expect(group.keyTotal).toBe(2000); // proceeds - costBasis
      expect(group.entries[0].status).toBe('complete');
    });
  });

  // ─── 1099-R (allowZero: taxableAmount) ─────

  describe('1099-R income', () => {
    it('treats taxableAmount=0 as filled (rollover)', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099r': 'yes' },
        income1099R: [{
          id: 'r-1',
          payerName: 'Fidelity',
          grossDistribution: 50000,
          taxableAmount: 0, // Full rollover — taxable amount is legitimately zero
        }],
      }));
      const entry = inv.incomeGroups[0].entries[0];
      expect(entry.status).toBe('complete');
    });
  });

  // ─── 1099-DIV (allowZero: qualifiedDividends) ─

  describe('1099-DIV income', () => {
    it('treats qualifiedDividends=0 as filled', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099div': 'yes' },
        income1099DIV: [{
          id: 'div-1',
          payerName: 'Vanguard',
          ordinaryDividends: 500,
          qualifiedDividends: 0, // Non-qualified fund — zero qualified is valid
        }],
      }));
      const entry = inv.incomeGroups[0].entries[0];
      expect(entry.status).toBe('complete');
    });
  });

  // ─── SSA-1099 ──────────────────────────────

  describe('SSA-1099 income', () => {
    it('does not appear when null', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: {},
        incomeSSA1099: undefined,
      }));
      const ssaGroup = inv.incomeGroups.find(g => g.formType === 'ssa1099');
      expect(ssaGroup).toBeUndefined();
    });

    it('appears with totalBenefits and is complete', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { ssa1099: 'yes' },
        incomeSSA1099: {
          id: 'ssa-1',
          totalBenefits: 24000,
          federalTaxWithheld: 2400,
        },
      }));
      const group = inv.incomeGroups.find(g => g.formType === 'ssa1099');
      expect(group).toBeDefined();
      expect(group!.count).toBe(1);
      expect(group!.keyTotal).toBe(24000);
      expect(group!.entries[0].status).toBe('complete');
      expect(group!.entries[0].label).toBe('Social Security Administration');
    });
  });

  // ─── K-1 ──────────────────────────────

  describe('K-1 income', () => {
    it('shows complete K-1 with business income total', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { k1: 'yes' },
        incomeK1: [{
          id: 'k1-1',
          entityName: 'Acme Partners LP',
          entityType: 'partnership',
          ordinaryBusinessIncome: 30000,
          guaranteedPayments: 5000,
        }],
      }));
      const group = inv.incomeGroups.find(g => g.formType === 'k1');
      expect(group?.keyTotal).toBe(35000);
      expect(group?.entries[0].status).toBe('complete');
    });
  });

  // ─── Discovery Cross-Reference ──────────────────

  describe('discovery cross-reference', () => {
    it('shows pending when discovery=yes but no data', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099int': 'yes' },
        income1099INT: [],
      }));
      expect(inv.pendingGroups).toHaveLength(1);
      expect(inv.pendingGroups[0].formType).toBe('1099int');
      expect(inv.pendingGroups[0].groupStatus).toBe('not_entered');
      expect(inv.totalFormsPending).toBe(1);
    });

    it('shows in incomeGroups when data exists regardless of discovery', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099int': 'no' },
        income1099INT: [{ id: 'int-1', payerName: 'Bank', amount: 100 }],
      }));
      const group = inv.incomeGroups.find(g => g.formType === '1099int');
      expect(group).toBeDefined();
      expect(group!.count).toBe(1);
      expect(inv.pendingGroups).toHaveLength(0);
    });

    it('ignores discovery=later (not pending)', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { w2g: 'later' },
      }));
      expect(inv.pendingGroups).toHaveLength(0);
    });
  });

  // ─── Dependents ──────────────────────────────

  describe('dependents section', () => {
    it('shows complete with valid dependents', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        dependents: [{
          id: 'dep-1',
          firstName: 'Alice',
          lastName: 'Doe',
          relationship: 'daughter',
          monthsLivedWithYou: 12,
        }],
      }));
      const section = inv.nonIncomeSections.find(s => s.id === 'dependents');
      expect(section?.status).toBe('complete');
      expect(section?.summary[0]).toBe('1 dependent');
    });

    it('shows issues for dependents missing name', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        dependents: [
          { id: 'dep-1', firstName: 'Alice', lastName: 'Doe', relationship: 'daughter', monthsLivedWithYou: 12 },
          { id: 'dep-2', firstName: '', lastName: 'Doe', relationship: 'son', monthsLivedWithYou: 12 },
        ],
      }));
      const section = inv.nonIncomeSections.find(s => s.id === 'dependents');
      expect(section?.status).toBe('missing_required');
      expect(section?.issues.length).toBe(1);
      expect(section?.summary[0]).toBe('2 dependents');
    });
  });

  // ─── Deductions ──────────────────────────────

  describe('deductions section', () => {
    it('shows standard deduction as complete', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        deductionMethod: 'standard',
      }));
      const section = inv.nonIncomeSections.find(s => s.id === 'deductions');
      expect(section?.status).toBe('complete');
      expect(section?.summary).toContain('Standard deduction');
    });

    it('shows itemized with no amounts as missing', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        deductionMethod: 'itemized',
        itemizedDeductions: {
          medicalExpenses: 0,
          stateLocalIncomeTax: 0,
          realEstateTax: 0,
          personalPropertyTax: 0,
          mortgageInterest: 0,
          mortgageInsurancePremiums: 0,
          charitableCash: 0,
          charitableNonCash: 0,
          casualtyLoss: 0,
          otherDeductions: 0,
        },
      }));
      const section = inv.nonIncomeSections.find(s => s.id === 'deductions');
      expect(section?.status).toBe('missing_required');
      expect(section?.issues.some(i => i.includes('amounts'))).toBe(true);
    });
  });

  // ─── 1099-MISC ──────────────────────────────

  describe('1099-MISC income', () => {
    it('marks as missing_required when no income amounts are provided', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099misc': 'yes' },
        income1099MISC: [{
          id: 'misc-1',
          payerName: 'A Payer',
          rents: 0,
          royalties: 0,
          otherIncome: 0,
        }],
      }));
      const entry = inv.incomeGroups.find(g => g.formType === '1099misc')?.entries[0];
      expect(entry?.status).toBe('missing_required');
      expect(entry?.missingRequired[0]).toContain('At least one income amount');
    });

    it('marks complete when rents are provided', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099misc': 'yes' },
        income1099MISC: [{
          id: 'misc-2',
          payerName: 'Landlord Inc',
          rents: 12000,
          royalties: 0,
          otherIncome: 0,
        }],
      }));
      const entry = inv.incomeGroups.find(g => g.formType === '1099misc')?.entries[0];
      expect(entry?.status).toBe('complete');
    });

    it('calculates keyTotal as sum of rents + royalties + otherIncome', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099misc': 'yes' },
        income1099MISC: [{
          id: 'misc-3',
          payerName: 'Multi Source',
          rents: 5000,
          royalties: 2000,
          otherIncome: 1000,
        }],
      }));
      const group = inv.incomeGroups.find(g => g.formType === '1099misc');
      expect(group?.keyTotal).toBe(8000);
    });
  });

  // ─── Credits ──────────────────────────────

  describe('credits section', () => {
    it('shows education credits count', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        educationCredits: [
          { id: 'edu-1', type: 'american_opportunity', studentName: 'Alice', institution: 'MIT', tuitionPaid: 10000 },
          { id: 'edu-2', type: 'lifetime_learning', studentName: 'Bob', institution: 'UC', tuitionPaid: 5000 },
        ],
      }));
      const section = inv.nonIncomeSections.find(s => s.id === 'credits');
      expect(section?.status).toBe('complete'); // credits are always "complete"
      expect(section?.summary.some(s => s.includes('2 education credits'))).toBe(true);
    });
  });

  // ─── Overall Completeness ──────────────────────

  describe('overall completeness', () => {
    it('calculates correct percentage for mixed return', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        firstName: 'John',
        lastName: 'Doe',
        addressStreet: '123 Main',
        addressCity: 'Springfield',
        addressState: 'IL',
        addressZip: '62701',
        filingStatus: FilingStatus.Single,
        deductionMethod: 'standard',
        incomeDiscovery: { w2: 'yes' },
        w2Income: [{
          id: 'w2-1',
          employerName: 'Acme Corp',
          wages: 50000,
          federalTaxWithheld: 0,
        }],
      }));
      // 1 complete W-2 + 5 non-income sections (personal=complete, filing=complete,
      // dependents=complete, deductions=complete, credits=complete) = 6 complete / 6 total = 100%
      expect(inv.overallCompleteness).toBe(100);
    });

    it('returns >0% for empty return (dependents/deductions/credits default complete)', () => {
      const inv = buildDocumentInventory(makeTaxReturn());
      // Non-income sections: personal=missing, filing=missing, dependents=complete,
      // deductions=complete, credits=complete = 3/5 = 60%
      expect(inv.overallCompleteness).toBe(60);
    });
  });

  // ─── Other Form Types ──────────────────────────

  describe('1099-C (cancelled debt)', () => {
    it('shows complete 1099-C', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099c': 'yes' },
        income1099C: [{
          id: 'c-1',
          payerName: 'Big Bank',
          amountCancelled: 5000,
          dateOfCancellation: '2025-03-15',
        }],
      }));
      const group = inv.incomeGroups.find(g => g.formType === '1099c');
      expect(group?.entries[0].status).toBe('complete');
      expect(group?.keyTotal).toBe(5000);
    });
  });

  describe('rental income', () => {
    it('marks missing_required when address is missing', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { rental: 'yes' },
        rentalProperties: [{
          id: 'r-1',
          address: '',
          propertyType: 'single_family',
          daysRented: 365,
          personalUseDays: 0,
          rentalIncome: 12000,
        }],
      }));
      const entry = inv.incomeGroups.find(g => g.formType === 'rental')?.entries[0];
      expect(entry?.status).toBe('missing_required');
      expect(entry?.missingRequired.some(m => m.includes('address'))).toBe(true);
    });
  });

  describe('W-2G (gambling)', () => {
    it('shows complete W-2G', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { w2g: 'yes' },
        incomeW2G: [{
          id: 'w2g-1',
          payerName: 'Las Vegas Casino',
          grossWinnings: 1500,
        }],
      }));
      const group = inv.incomeGroups.find(g => g.formType === 'w2g');
      expect(group?.entries[0].status).toBe('complete');
      expect(group?.keyTotal).toBe(1500);
    });
  });

  describe('otherIncome (plain number)', () => {
    it('shows other income when value > 0', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { other: 'yes' },
        otherIncome: 1000,
      }));
      const group = inv.incomeGroups.find(g => g.formType === 'other');
      expect(group).toBeDefined();
      expect(group!.count).toBe(1);
      expect(group!.keyTotal).toBe(1000);
      expect(group!.groupStatus).toBe('complete');
    });

    it('shows pending when discovery=yes but value is 0', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { other: 'yes' },
        otherIncome: 0,
      }));
      const group = inv.incomeGroups.find(g => g.formType === 'other');
      expect(group).toBeDefined();
      expect(group!.groupStatus).toBe('not_entered');
      expect(inv.pendingGroups.some(g => g.formType === 'other')).toBe(true);
    });
  });

  // ─── 1099-Q ──────────────────────────────

  describe('1099-Q (education distributions)', () => {
    it('shows complete 1099-Q', () => {
      const inv = buildDocumentInventory(makeTaxReturn({
        incomeDiscovery: { '1099q': 'yes' },
        income1099Q: [{
          id: 'q-1',
          payerName: 'College 529 Plan',
          grossDistribution: 15000,
          earnings: 3000,
          basisReturn: 12000,
          qualifiedExpenses: 15000,
          distributionType: 'qualified',
        }],
      }));
      const group = inv.incomeGroups.find(g => g.formType === '1099q');
      expect(group?.entries[0].status).toBe('complete');
      expect(group?.keyTotal).toBe(15000);
    });
  });
});
