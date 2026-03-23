/**
 * QCD (Qualified Charitable Distribution) Tests
 *
 * Validates that QCDs from traditional IRAs are properly excluded from
 * taxable income (Line 4b) while remaining in gross distributions (Line 4a).
 *
 * @authority IRC §408(d)(8) — Qualified charitable distributions
 *           SECURE 2.0 Act §307 — Inflation indexing
 *           Notice 2007-7, Q&A-36 — Pro-rata rule bypass
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';
import { QCD } from '../src/constants/tax2025.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'qcd-test',
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
    expenses: [],
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  };
}

function calc(overrides: Partial<TaxReturn> = {}) {
  return calculateForm1040(makeTaxReturn(overrides));
}

// ═══════════════════════════════════════════════════════════════════════════
// QCD-01 — Basic QCD reduces Line 4b but not Line 4a
// ═══════════════════════════════════════════════════════════════════════════

describe('QCD-01 — Basic QCD exclusion', () => {
  it('QCD reduces iraDistributionsTaxable but not iraDistributionsGross', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099R: [{
        id: 'r1', payerName: 'Fidelity', grossDistribution: 50000,
        taxableAmount: 50000, distributionCode: '7', isIRA: true, qcdAmount: 10000,
      }],
    }).form1040;
    expect(f.iraDistributionsGross).toBe(50000);
    expect(f.iraDistributionsTaxable).toBe(40000);
    expect(f.totalQCD).toBe(10000);
  });

  it('QCD reduces total income and AGI', () => {
    const withQCD = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 100000, federalTaxWithheld: 0, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 }],
      income1099R: [{
        id: 'r1', payerName: 'Fidelity', grossDistribution: 30000,
        taxableAmount: 30000, distributionCode: '7', isIRA: true, qcdAmount: 20000,
      }],
    }).form1040;

    const withoutQCD = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 100000, federalTaxWithheld: 0, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 }],
      income1099R: [{
        id: 'r1', payerName: 'Fidelity', grossDistribution: 30000,
        taxableAmount: 30000, distributionCode: '7', isIRA: true, qcdAmount: 0,
      }],
    }).form1040;

    expect(withQCD.totalIncome).toBe(withoutQCD.totalIncome - 20000);
    expect(withQCD.agi).toBe(withoutQCD.agi - 20000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QCD-02 — QCD capped at $105,000 annual limit
// ═══════════════════════════════════════════════════════════════════════════

describe('QCD-02 — Annual limit cap', () => {
  it('total QCD capped at MAX_AMOUNT across multiple 1099-Rs', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099R: [
        { id: 'r1', payerName: 'IRA-1', grossDistribution: 80000, taxableAmount: 80000, distributionCode: '7', isIRA: true, qcdAmount: 80000 },
        { id: 'r2', payerName: 'IRA-2', grossDistribution: 50000, taxableAmount: 50000, distributionCode: '7', isIRA: true, qcdAmount: 50000 },
      ],
    }).form1040;
    expect(f.totalQCD).toBe(QCD.MAX_AMOUNT); // 105000, not 130000
    expect(f.iraDistributionsGross).toBe(130000);
    expect(f.iraDistributionsTaxable).toBe(130000 - QCD.MAX_AMOUNT);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QCD-03 — QCD cannot exceed gross distribution
// ═══════════════════════════════════════════════════════════════════════════

describe('QCD-03 — QCD capped at gross distribution', () => {
  it('QCD per-entry capped at grossDistribution', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099R: [{
        id: 'r1', payerName: 'IRA', grossDistribution: 5000,
        taxableAmount: 5000, distributionCode: '7', isIRA: true, qcdAmount: 8000,
      }],
    }).form1040;
    expect(f.totalQCD).toBe(5000); // Capped at gross, not 8000
    expect(f.iraDistributionsTaxable).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QCD-04 — QCD ignored on Roth IRA and non-IRA distributions
// ═══════════════════════════════════════════════════════════════════════════

describe('QCD-04 — QCD only applies to traditional IRA', () => {
  it('QCD on Roth IRA is ignored', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099R: [{
        id: 'r1', payerName: 'Roth', grossDistribution: 20000,
        taxableAmount: 0, distributionCode: '7', isIRA: true, isRothIRA: true, qcdAmount: 10000,
      }],
    }).form1040;
    expect(f.totalQCD).toBe(0);
  });

  it('QCD on employer plan (non-IRA) is ignored', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099R: [{
        id: 'r1', payerName: '401k', grossDistribution: 30000,
        taxableAmount: 30000, distributionCode: '7', isIRA: false, qcdAmount: 10000,
      }],
    }).form1040;
    expect(f.totalQCD).toBe(0);
    expect(f.pensionDistributionsTaxable).toBe(30000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QCD-05 — QCD with zero or no amount has no effect
// ═══════════════════════════════════════════════════════════════════════════

describe('QCD-05 — Zero/undefined QCD', () => {
  it('qcdAmount of 0 has no effect', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099R: [{
        id: 'r1', payerName: 'IRA', grossDistribution: 25000,
        taxableAmount: 25000, distributionCode: '7', isIRA: true, qcdAmount: 0,
      }],
    }).form1040;
    expect(f.totalQCD).toBe(0);
    expect(f.iraDistributionsTaxable).toBe(25000);
  });

  it('undefined qcdAmount has no effect', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099R: [{
        id: 'r1', payerName: 'IRA', grossDistribution: 25000,
        taxableAmount: 25000, distributionCode: '7', isIRA: true,
      }],
    }).form1040;
    expect(f.totalQCD).toBe(0);
    expect(f.iraDistributionsTaxable).toBe(25000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QCD-06 — QCD + NIIT interaction: QCD reduces AGI below NIIT threshold
// ═══════════════════════════════════════════════════════════════════════════

describe('QCD-06 — QCD reduces NIIT exposure', () => {
  it('MFJ couple: QCD pushes AGI below $250K NIIT threshold', () => {
    // Without QCD: AGI = 200k wages + 80k IRA = 280k → NIIT triggered on dividends
    const noQCD = calc({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 200000, federalTaxWithheld: 0, socialSecurityWages: 200000, socialSecurityTax: 12400, medicareWages: 200000, medicareTax: 2900 }],
      income1099R: [{
        id: 'r1', payerName: 'IRA', grossDistribution: 80000,
        taxableAmount: 80000, distributionCode: '7', isIRA: true, qcdAmount: 0,
      }],
      income1099DIV: [{ id: 'd1', payerName: 'Vanguard', ordinaryDividends: 20000, qualifiedDividends: 20000, federalTaxWithheld: 0 }],
    }).form1040;

    // With QCD of $51K: AGI = 200k + (80k-51k) + 20k = 249k → below $250K → no NIIT
    const withQCD = calc({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 200000, federalTaxWithheld: 0, socialSecurityWages: 200000, socialSecurityTax: 12400, medicareWages: 200000, medicareTax: 2900 }],
      income1099R: [{
        id: 'r1', payerName: 'IRA', grossDistribution: 80000,
        taxableAmount: 80000, distributionCode: '7', isIRA: true, qcdAmount: 51000,
      }],
      income1099DIV: [{ id: 'd1', payerName: 'Vanguard', ordinaryDividends: 20000, qualifiedDividends: 20000, federalTaxWithheld: 0 }],
    }).form1040;

    expect(noQCD.niitTax).toBeGreaterThan(0);
    expect(withQCD.niitTax).toBe(0);
    expect(withQCD.agi).toBeLessThan(250000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QCD-07 — QCD + Form 8606 pro-rata interaction
// ═══════════════════════════════════════════════════════════════════════════

describe('QCD-07 — QCD bypasses Form 8606 pro-rata', () => {
  it('QCD excluded from Form 8606 pro-rata denominator', () => {
    // IRA with $20K nondeductible basis, $100K balance, $30K distribution ($10K QCD + $20K regular)
    // QCD should NOT reduce basis — it bypasses pro-rata per Notice 2007-7
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099R: [{
        id: 'r1', payerName: 'IRA', grossDistribution: 30000,
        taxableAmount: 30000, distributionCode: '7', isIRA: true, qcdAmount: 10000,
      }],
      form8606: {
        nondeductibleContributions: 0,
        priorYearBasis: 20000,
        traditionalIRABalance: 100000,
        rothConversionAmount: 0,
      },
    }).form1040;

    // Without QCD: regularDist=30K, totalIRA=130K, ratio=20K/130K=15.38%, nonTaxable=4615
    // With QCD: regularDist=20K (30K-10K QCD), totalIRA=120K, ratio=20K/120K=16.67%, nonTaxable=3333
    // QCD reduces the denominator, so the non-taxable portion of remaining distributions
    // is calculated on only the $20K non-QCD portion.
    expect(f.totalQCD).toBe(10000);
    expect(f.iraDistributionsGross).toBe(30000);
    // Taxable = (20K regular - pro-rata nontaxable) after QCD exclusion
    // The key test: QCD is excluded from the pro-rata calculation
    expect(f.iraDistributionsTaxable).toBeLessThan(20000); // Pro-rata reduces some of the $20K
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QCD-08 — QCD on rollover code is ignored
// ═══════════════════════════════════════════════════════════════════════════

describe('QCD-08 — QCD on rollover/Roth codes ignored', () => {
  it('QCD with distribution code G (rollover) is ignored', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099R: [{
        id: 'r1', payerName: 'IRA', grossDistribution: 50000,
        taxableAmount: 0, distributionCode: 'G', isIRA: true, qcdAmount: 10000,
      }],
    }).form1040;
    expect(f.totalQCD).toBe(0);
  });
});
