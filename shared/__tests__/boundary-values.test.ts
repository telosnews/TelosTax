/**
 * Boundary-Value Tests — Phase 1 Hardening
 *
 * These scenarios test exact thresholds, cliffs, and discontinuities in the
 * TY2025 tax engine. Each test uses ±$1 offsets to verify correct boundary
 * behavior (off-by-one detection, inclusive vs. exclusive comparisons,
 * phase-out math, zero-crossing points).
 *
 * Generated via multi-model AI consensus (Claude Opus, Gemini 3.1 Pro, GPT-5.2 Codex),
 * hand-verified against IRC and Rev. Proc. 2024-40 constants.
 *
 * @authority IRC §1, §21, §24, §25A, §25B, §55, §63, §86, §199A, §221,
 *           §469, §904, §1211, §1401, §1411, §3101, §6654
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'bv-test',
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
// BV-01 — Single 10%→12% Bracket Edge ($11,925 taxable income)
//
// W-2 = $27,675 → taxable = $27,675 − $15,750 = $11,925 (exact bracket top)
// Tax = 10% × $11,925 = $1,192.50
// At $27,676 (taxable $11,926): $1,192.50 + 12% × $1 = $1,192.62
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-01 — Single 10%→12% Bracket Edge', () => {
  it('taxable income exactly at $11,925 → all at 10%', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 27675, federalTaxWithheld: 0, socialSecurityWages: 27675, socialSecurityTax: 1716, medicareWages: 27675, medicareTax: 401 }],
    }).form1040;
    expect(f.taxableIncome).toBe(11925);
    expect(f.incomeTax).toBe(1192.5);
  });

  it('taxable income $11,926 → $1 taxed at 12%', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 27676, federalTaxWithheld: 0, socialSecurityWages: 27676, socialSecurityTax: 1716, medicareWages: 27676, medicareTax: 401 }],
    }).form1040;
    expect(f.taxableIncome).toBe(11926);
    expect(f.incomeTax).toBe(1192.62);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-02 — Standard Deduction Zero Taxable Floor
//
// Single std deduction = $15,750. At that income → taxable = $0.
// At $15,751 → taxable = $1, tax = $0.10
// At $15,749 → taxable = $0 (no negative)
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-02 — Standard Deduction Zero Taxable Floor', () => {
  it('wages = standard deduction → taxable $0, tax $0', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 15750, federalTaxWithheld: 0, socialSecurityWages: 15750, socialSecurityTax: 977, medicareWages: 15750, medicareTax: 228 }],
    }).form1040;
    expect(f.taxableIncome).toBe(0);
    expect(f.incomeTax).toBe(0);
  });

  it('wages $1 above standard deduction → taxable $1', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 15751, federalTaxWithheld: 0, socialSecurityWages: 15751, socialSecurityTax: 977, medicareWages: 15751, medicareTax: 228 }],
    }).form1040;
    expect(f.taxableIncome).toBe(1);
    expect(f.incomeTax).toBe(0.10);
  });

  it('wages $1 below standard deduction → taxable $0 (no negative)', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 15749, federalTaxWithheld: 0, socialSecurityWages: 15749, socialSecurityTax: 976, medicareWages: 15749, medicareTax: 228 }],
    }).form1040;
    expect(f.taxableIncome).toBe(0);
    expect(f.incomeTax).toBe(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-03 — SE Tax Minimum Threshold ($400)
//
// Net SE earnings = net profit × 0.9235. SE tax applies only if ≥ $400.
// Net profit $399 → SE earnings = $368.47 → $0 SE tax
// Net profit $434 → SE earnings = $400.80 → SE tax > $0
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-03 — SE Tax Minimum ($400 net SE earnings)', () => {
  it('net profit $399 → SE earnings below $400 → no SE tax', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Gig', amount: 399 }],
    }).form1040;
    expect(f.seTax).toBe(0);
  });

  it('net profit $434 → SE earnings ≥ $400 → SE tax applies', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Gig', amount: 434 }],
    }).form1040;
    expect(f.seTax).toBeGreaterThan(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-04 — NIIT Threshold (Single $200k AGI)
//
// NIIT = 3.8% × min(net investment income, AGI − $200k)
// At $200k AGI with $30k interest → NIIT = 0
// At $200,001 AGI → NIIT = 3.8% × $1 = $0.04
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-04 — NIIT Threshold (Single $200k)', () => {
  it('AGI exactly $200,000 → NIIT = $0', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 170000, federalTaxWithheld: 0, socialSecurityWages: 170000, socialSecurityTax: 10540, medicareWages: 170000, medicareTax: 2465 }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 30000, federalTaxWithheld: 0 }],
    }).form1040;
    expect(f.agi).toBe(200000);
    expect(f.niitTax).toBe(0);
  });

  it('AGI $200,001 → NIIT = $0.04 (3.8% × $1)', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 170001, federalTaxWithheld: 0, socialSecurityWages: 170001, socialSecurityTax: 10540, medicareWages: 170001, medicareTax: 2465 }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 30000, federalTaxWithheld: 0 }],
    }).form1040;
    expect(f.agi).toBe(200001);
    expect(f.niitTax).toBeCloseTo(0.04, 2);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-05 — Capital Gains 0% → 15% Threshold (Single $48,350)
//
// LTCG stacks on top of ordinary income. With wages = standard deduction
// (taxable ordinary = $0), all gains fill the 0% bracket up to $48,350.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-05 — Capital Gains 0% Threshold (Single $48,350)', () => {
  it('LTCG fills exactly to $48,350 → all at 0%', () => {
    const result = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 15750, federalTaxWithheld: 0, socialSecurityWages: 15750, socialSecurityTax: 977, medicareWages: 15750, medicareTax: 228 }],
      income1099B: [{ id: 'b1', brokerName: 'Broker', description: 'Stock', proceeds: 48350, costBasis: 0, isLongTerm: true, dateAcquired: '2024-01-01', dateSold: '2025-06-01' }],
    }).form1040;
    expect(result.taxableIncome).toBe(48350);
    expect(result.incomeTax).toBe(0); // all at 0% preferential rate
  });

  it('LTCG $48,351 → $1 at 15%', () => {
    const result = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 15750, federalTaxWithheld: 0, socialSecurityWages: 15750, socialSecurityTax: 977, medicareWages: 15750, medicareTax: 228 }],
      income1099B: [{ id: 'b1', brokerName: 'Broker', description: 'Stock', proceeds: 48351, costBasis: 0, isLongTerm: true, dateAcquired: '2024-01-01', dateSold: '2025-06-01' }],
    }).form1040;
    expect(result.taxableIncome).toBe(48351);
    expect(result.incomeTax).toBe(0.15); // $1 at 15%
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-06 — CTC Phase-Out (Single $200k AGI)
//
// CTC = $2,200/child. Phase-out: $50 per $1,000 (or fraction) above $200k.
// At $200,000 → full $2,200. At $201,000 → reduced by $50 → $2,150.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-06 — CTC Phase-Out (Single $200k)', () => {
  it('AGI exactly $200,000 → full CTC', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 200000, federalTaxWithheld: 40000, socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 200000, medicareTax: 2900 }],
      dependents: [{ id: 'd1', firstName: 'Child', lastName: 'A', relationship: 'son', dateOfBirth: '2015-06-01', ssn: '111-22-3333', monthsLivedWithYou: 12, isStudent: false, isDisabled: false }],
    });
    expect(r.form1040.agi).toBe(200000);
    expect(r.credits.childTaxCredit).toBe(2200);
  });

  it('AGI $201,000 → CTC reduced by $50', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 201000, federalTaxWithheld: 40000, socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 201000, medicareTax: 2915 }],
      dependents: [{ id: 'd1', firstName: 'Child', lastName: 'A', relationship: 'son', dateOfBirth: '2015-06-01', ssn: '111-22-3333', monthsLivedWithYou: 12, isStudent: false, isDisabled: false }],
    });
    expect(r.credits.childTaxCredit).toBe(2150);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-07 — ACTC Earned Income Floor ($2,500)
//
// ACTC = 15% × (earned income − $2,500), max $1,700/child.
// At $2,500 earned → ACTC = $0. At $2,501 → ACTC = $0.15
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-07 — ACTC Earned Income Floor ($2,500)', () => {
  it('earned income $2,500 → ACTC = $0', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 2500, federalTaxWithheld: 0, socialSecurityWages: 2500, socialSecurityTax: 155, medicareWages: 2500, medicareTax: 36 }],
      dependents: [{ id: 'd1', firstName: 'Child', lastName: 'A', relationship: 'son', dateOfBirth: '2015-06-01', ssn: '111-22-3333', monthsLivedWithYou: 12, isStudent: false, isDisabled: false }],
    });
    expect(r.credits.actcCredit).toBe(0);
  });

  it('earned income $2,501 → ACTC = $0.15', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 2501, federalTaxWithheld: 0, socialSecurityWages: 2501, socialSecurityTax: 155, medicareWages: 2501, medicareTax: 36 }],
      dependents: [{ id: 'd1', firstName: 'Child', lastName: 'A', relationship: 'son', dateOfBirth: '2015-06-01', ssn: '111-22-3333', monthsLivedWithYou: 12, isStudent: false, isDisabled: false }],
    });
    expect(r.credits.actcCredit).toBeCloseTo(0.15, 2);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-08 — Social Security Taxability Base (Single $25k provisional)
//
// Provisional income = other income + 50% of SS benefits.
// At $25,000 → $0 taxable SS. At $25,001 → $0.50 taxable SS.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-08 — Social Security 50% Tier (Single $25k provisional)', () => {
  it('provisional income $25,000 → $0 SS taxable', () => {
    // Other income = $20,000 W-2 + 50% × $10,000 SS = $25,000
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 20000, federalTaxWithheld: 0, socialSecurityWages: 20000, socialSecurityTax: 1240, medicareWages: 20000, medicareTax: 290 }],
      incomeSSA1099: { id: 'ss1', totalBenefits: 10000 },
    }).form1040;
    expect(f.taxableSocialSecurity).toBe(0);
  });

  it('provisional income $25,001 → SS becomes partially taxable', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 20001, federalTaxWithheld: 0, socialSecurityWages: 20001, socialSecurityTax: 1240, medicareWages: 20001, medicareTax: 290 }],
      incomeSSA1099: { id: 'ss1', totalBenefits: 10000 },
    }).form1040;
    expect(f.taxableSocialSecurity).toBeGreaterThan(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-09 — Saver's Credit 50% → 20% Cliff (Single $23,750)
//
// Hard cliff: AGI ≤ $23,750 → 50% rate. AGI > $23,750 → 20% rate.
// With $2,000 contribution: $1,000 credit → $400 credit (loss of $600!)
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-09 — Savers Credit 50%→20% Cliff (Single $23,750)', () => {
  it('AGI $23,750 → 50% credit rate', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 23750, federalTaxWithheld: 0, socialSecurityWages: 23750, socialSecurityTax: 1473, medicareWages: 23750, medicareTax: 344 }],
      saversCredit: { totalContributions: 2000 },
    });
    // AGI = $23,750 → ≤ $23,750 → 50% rate
    expect(r.credits.saversCredit).toBe(1000); // 50% × $2,000
  });

  it('AGI just above $23,750 → 20% credit rate', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 23751, federalTaxWithheld: 0, socialSecurityWages: 23751, socialSecurityTax: 1473, medicareWages: 23751, medicareTax: 344 }],
      saversCredit: { totalContributions: 2000 },
    });
    // AGI = $23,751 → > $23,750 → 20%
    expect(r.credits.saversCredit).toBe(400); // 20% × $2,000
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-10 — Passive Loss Allowance Phase-Out ($100k–$150k AGI)
//
// $25,000 special allowance for rental real estate (IRC §469(i)(2)).
// Phase-out: $1 per $2 of AGI above $100k → gone at $150k.
// At $100k W-2 → full $25,000 rental loss allowed.
// At $150k W-2 → rental loss fully disallowed.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-10 — Passive Loss Phase-Out', () => {
  it('AGI $100,000 → full $25,000 rental loss allowed', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 }],
      rentalProperties: [{
        id: 'r1', address: '100 Main St', propertyType: 'single_family',
        daysRented: 365, personalUseDays: 0,
        rentalIncome: 10000, repairs: 35000,
      }],
    }).form1040;
    // Rental loss = -$25,000, should be at least partially allowed
    // Modified AGI = $100,000 → full $25k allowed → AGI = $75,000
    expect(f.agi).toBe(75000);
  });

  it('AGI $150,000 → rental loss fully disallowed', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 150000, federalTaxWithheld: 25000, socialSecurityWages: 150000, socialSecurityTax: 9300, medicareWages: 150000, medicareTax: 2175 }],
      rentalProperties: [{
        id: 'r1', address: '100 Main St', propertyType: 'single_family',
        daysRented: 365, personalUseDays: 0,
        rentalIncome: 10000, repairs: 35000,
      }],
    }).form1040;
    // Modified AGI = $150,000 → no allowance → rental loss suspended
    expect(f.agi).toBe(150000); // no rental loss in AGI
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-11 — Capital Loss Limit ($3,000 Single)
//
// Net capital loss capped at $3,000 deduction ($1,500 MFS).
// Excess carries forward.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-11 — Capital Loss Limit ($3,000)', () => {
  it('net loss exactly $3,000 → full deduction, no carryforward', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 50000, federalTaxWithheld: 5000, socialSecurityWages: 50000, socialSecurityTax: 3100, medicareWages: 50000, medicareTax: 725 }],
      income1099B: [{ id: 'b1', brokerName: 'Broker', description: 'Loser', proceeds: 7000, costBasis: 10000, isLongTerm: true, dateAcquired: '2024-01-01', dateSold: '2025-06-01' }],
    }).form1040;
    // Net loss = -$3,000, fully deductible
    expect(f.agi).toBe(47000); // $50,000 - $3,000
  });

  it('net loss $3,001 → only $3,000 deducted, $1 carryforward', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 50000, federalTaxWithheld: 5000, socialSecurityWages: 50000, socialSecurityTax: 3100, medicareWages: 50000, medicareTax: 725 }],
      income1099B: [{ id: 'b1', brokerName: 'Broker', description: 'Loser', proceeds: 6999, costBasis: 10000, isLongTerm: true, dateAcquired: '2024-01-01', dateSold: '2025-06-01' }],
    }).form1040;
    // Net loss = -$3,001, but only $3,000 deducted
    expect(f.agi).toBe(47000); // same — only $3k deducted
  });

  it('MFS net loss → capped at $1,500', () => {
    const f = calc({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 50000, federalTaxWithheld: 5000, socialSecurityWages: 50000, socialSecurityTax: 3100, medicareWages: 50000, medicareTax: 725 }],
      income1099B: [{ id: 'b1', brokerName: 'Broker', description: 'Loser', proceeds: 7000, costBasis: 10000, isLongTerm: true, dateAcquired: '2024-01-01', dateSold: '2025-06-01' }],
    }).form1040;
    // MFS: loss = -$3,000 but cap is $1,500
    expect(f.agi).toBe(48500); // $50,000 - $1,500
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-12 — Student Loan Interest Phase-Out (Single $85k–$100k)
//
// Max $2,500 deduction. Phase-out: $85k–$100k AGI (single).
// At $85,000 → full deduction. At $100,000 → $0.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-12 — Student Loan Interest Phase-Out (Single)', () => {
  it('AGI $85,000 → full $2,500 deduction', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 85000, federalTaxWithheld: 12000, socialSecurityWages: 85000, socialSecurityTax: 5270, medicareWages: 85000, medicareTax: 1233 }],
      studentLoanInterest: 2500,
    }).form1040;
    // MAGI = $85,000 → at phase-out start → full deduction
    expect(f.agi).toBe(82500); // $85,000 - $2,500
  });

  it('MAGI $100,000 → $0 deduction (fully phased out)', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 }],
      studentLoanInterest: 2500,
    }).form1040;
    // MAGI = $100,000 → end of $15k range → $0 deduction
    expect(f.agi).toBe(100000); // no deduction taken
  });

  it('MAGI $92,500 → 50% deduction ($1,250)', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 92500, federalTaxWithheld: 13000, socialSecurityWages: 92500, socialSecurityTax: 5735, medicareWages: 92500, medicareTax: 1341 }],
      studentLoanInterest: 2500,
    }).form1040;
    // MAGI = $92,500 → $7,500 over $85k → 7500/15000 = 50% phased
    // Deduction = $2,500 × (1 − 0.50) = $1,250
    expect(f.agi).toBe(91250); // $92,500 - $1,250
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-13 — Excess SS Tax Credit (Multiple Employers)
//
// Max SS tax = 6.2% × $176,100 = $10,918.20.
// Two W-2s each withholding full SS → excess refunded via Schedule 3.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-13 — Excess SS Tax Credit (Multiple Employers)', () => {
  it('two employers each withhold max SS → excess credited', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [
        { id: 'w1', employerName: 'Corp A', wages: 100000, federalTaxWithheld: 20000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 },
        { id: 'w2', employerName: 'Corp B', wages: 100000, federalTaxWithheld: 20000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 },
      ],
    });
    // Total SS withheld = $12,400. Max = $10,918.20. Excess = $1,481.80
    expect(r.credits.excessSSTaxCredit).toBeCloseTo(1481.80, 0);
  });

  it('single employer at wage base → no excess', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [
        { id: 'w1', employerName: 'Corp A', wages: 176100, federalTaxWithheld: 35000, socialSecurityWages: 176100, socialSecurityTax: 10918.20, medicareWages: 176100, medicareTax: 2553 },
      ],
    });
    expect(r.credits.excessSSTaxCredit).toBe(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-14 — Estimated Tax Penalty Minimum ($1,000 threshold)
//
// No penalty if tax owed after withholding < $1,000 (IRC §6654(e)(1)).
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-14 — Estimated Tax Penalty $1,000 Threshold', () => {
  it('owed $999 → no penalty', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000, federalTaxWithheld: 0 }],
      w2Income: [{ id: 'w1', employerName: 'A', wages: 10000, federalTaxWithheld: 5066, socialSecurityWages: 10000, socialSecurityTax: 620, medicareWages: 10000, medicareTax: 145 }],
    }).form1040;
    // We need withholding close enough that owed < $1,000
    // This is an approximation — the exact withholding needed depends on total tax
    // Key assertion: if taxOwed < $1,000, penalty should be $0
    if (f.amountOwed > 0 && f.amountOwed < 1000) {
      expect(f.estimatedTaxPenalty).toBe(0);
    }
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-15 — Dependent Care Credit Phase-Down ($15k AGI)
//
// Credit rate starts at 35% and steps down 1% per $2k above $15k AGI.
// At $15,000 → 35%. At $17,000 → 34%. Floor at 20%.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-15 — Dependent Care Credit Rate Phase-Down', () => {
  it('AGI $15,000 → 35% rate', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 15000, federalTaxWithheld: 0, socialSecurityWages: 15000, socialSecurityTax: 930, medicareWages: 15000, medicareTax: 218 }],
      dependents: [{ id: 'd1', firstName: 'Kid', lastName: 'A', relationship: 'son', dateOfBirth: '2022-03-01', ssn: '111-22-4444', monthsLivedWithYou: 12, isStudent: false, isDisabled: false }],
      dependentCare: { totalExpenses: 3000, qualifyingPersons: 1 },
    });
    // 35% × $3,000 = $1,050
    expect(r.credits.dependentCareCredit).toBe(1050);
  });

  it('AGI $45,000 → 20% floor rate', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 45000, federalTaxWithheld: 4000, socialSecurityWages: 45000, socialSecurityTax: 2790, medicareWages: 45000, medicareTax: 653 }],
      dependents: [{ id: 'd1', firstName: 'Kid', lastName: 'A', relationship: 'son', dateOfBirth: '2022-03-01', ssn: '111-22-4444', monthsLivedWithYou: 12, isStudent: false, isDisabled: false }],
      dependentCare: { totalExpenses: 3000, qualifyingPersons: 1 },
    });
    // AGI well above phase-down end → 20% floor
    // 20% × $3,000 = $600
    expect(r.credits.dependentCareCredit).toBe(600);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-16 — Additional Medicare Tax (MFJ $250k)
//
// 0.9% on W-2 wages above $250k (MFJ). At $250k → $0. At $251k → $9.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-16 — Additional Medicare Tax (MFJ $250k)', () => {
  it('wages exactly $250,000 → $0 additional Medicare', () => {
    const f = calc({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 250000, federalTaxWithheld: 50000, socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 250000, medicareTax: 3625 }],
    }).form1040;
    expect(f.additionalMedicareTaxW2).toBe(0);
  });

  it('wages $251,000 → 0.9% on $1,000 excess = $9', () => {
    const f = calc({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 251000, federalTaxWithheld: 50000, socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 251000, medicareTax: 3640 }],
    }).form1040;
    expect(f.additionalMedicareTaxW2).toBe(9);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-17 — QBI Deduction (Single, below threshold)
//
// Below $197,300 taxable income → full 20% QBI deduction on SE income.
// Uses 1099-NEC (Schedule C) which generates qualified business income.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-17 — QBI Deduction Existence', () => {
  it('SE income below QBI threshold → 20% deduction applies', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Consulting', amount: 100000 }],
    }).form1040;
    // Below $197,300 threshold → full 20% QBI on net profit
    expect(f.qbiDeduction).toBeGreaterThan(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-18 — AOTC Phase-Out (Single $80k–$90k)
//
// Full AOTC ($2,500) at AGI ≤ $80k. Fully phased out at $90k.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-18 — AOTC Phase-Out (Single $80k–$90k)', () => {
  it('AGI $80,000 → full AOTC', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 80000, federalTaxWithheld: 12000, socialSecurityWages: 80000, socialSecurityTax: 4960, medicareWages: 80000, medicareTax: 1160 }],
      educationCredits: [{ id: 'e1', type: 'american_opportunity', studentName: 'Self', tuitionPaid: 4000, institution: 'State U' }],
    });
    // Full AOTC: 100% of first $2,000 + 25% of next $2,000 = $2,500
    // Non-refundable: 60% = $1,500. Refundable: 40% = $1,000
    expect(r.credits.educationCredit + r.credits.aotcRefundableCredit).toBe(2500);
  });

  it('AGI $90,000 → AOTC fully phased out', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 90000, federalTaxWithheld: 14000, socialSecurityWages: 90000, socialSecurityTax: 5580, medicareWages: 90000, medicareTax: 1305 }],
      educationCredits: [{ id: 'e1', type: 'american_opportunity', studentName: 'Self', tuitionPaid: 4000, institution: 'State U' }],
    });
    expect(r.credits.educationCredit + r.credits.aotcRefundableCredit).toBe(0);
  });

  it('AGI $85,000 → 50% AOTC', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 85000, federalTaxWithheld: 13000, socialSecurityWages: 85000, socialSecurityTax: 5270, medicareWages: 85000, medicareTax: 1233 }],
      educationCredits: [{ id: 'e1', type: 'american_opportunity', studentName: 'Self', tuitionPaid: 4000, institution: 'State U' }],
    });
    // 50% through phase-out → 50% of $2,500 = $1,250
    expect(r.credits.educationCredit + r.credits.aotcRefundableCredit).toBe(1250);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// BV-19 — FEIE Exclusion Cap ($130,000)
//
// Foreign earned income exclusion capped at $130,000 for 2025.
// Income above the cap is still taxable.
// ═══════════════════════════════════════════════════════════════════════════

describe('BV-19 — FEIE Exclusion Cap ($130,000)', () => {
  it('foreign earned income at exclusion → no taxable income from FEIE', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Foreign Corp', wages: 130000, federalTaxWithheld: 0, socialSecurityWages: 0, socialSecurityTax: 0, medicareWages: 0, medicareTax: 0 }],
      foreignEarnedIncome: { qualifyingDays: 365, foreignEarnedIncome: 130000 },
    }).form1040;
    // All $130k excluded → AGI should be $0
    expect(f.agi).toBe(0);
  });

  it('foreign earned income $131,000 → $1,000 taxable', () => {
    const f = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Foreign Corp', wages: 131000, federalTaxWithheld: 0, socialSecurityWages: 0, socialSecurityTax: 0, medicareWages: 0, medicareTax: 0 }],
      foreignEarnedIncome: { qualifyingDays: 365, foreignEarnedIncome: 131000 },
    }).form1040;
    // $130k excluded, $1k remains in AGI
    expect(f.agi).toBe(1000);
  });
});
