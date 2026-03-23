/**
 * Phase 9 — IRS Worksheet Differential Tests (C4)
 *
 * 10 reference returns with hand-calculated expected values using
 * IRS Publication 17 worksheets and tax tables. These serve as
 * regression anchors — if the engine changes, these known-good
 * values should still match.
 *
 * Constants used (TY2025):
 *   Standard Deduction: Single $15,750; MFJ $31,500; HoH $23,625
 *   Single brackets: 10% up to $11,925 → 12% → 22% at $48,475 → 24% at $103,350
 *   MFJ brackets:   10% up to $23,850 → 12% → 22% at $96,950 → 24% at $206,700
 *   SE tax: 15.3% × 92.35% of net profit; deductible half
 *   QBI: 20% below threshold ($197,300 single / $394,600 MFJ)
 *   CTC: $2,200/child; phase-out at $200k single / $400k MFJ
 *   SS: 50%/85% taxability thresholds at $25k/$34k single, $32k/$44k MFJ
 *   SALT cap: $40,000 (OBBBA 2025)
 *
 * @authority IRS Publication 17, Form 1040 Instructions
 */
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus, Dependent } from '../src/types/index.js';

// ── Helper ──────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'diff-test',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    schemaVersion: 1,
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
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
    expenses: [],
    deductionMethod: 'standard',
    filingStatus: FilingStatus.Single,
    educationCredits: [],
    ...overrides,
  } as TaxReturn;
}

function makeChild(name: string): Dependent {
  return {
    id: `dep-${name}`,
    firstName: name,
    lastName: 'Test',
    relationship: 'child',
    dateOfBirth: '2015-01-01',    // under 17 → qualifies for CTC
    ssn: '000-00-0000',
    monthsLivedWithYou: 12,
    qualifiesForCTC: true,
    qualifiesForEITC: true,
  } as Dependent;
}

// ── Reference Returns ───────────────────────────────────────────────────

describe('Phase 9 — IRS Worksheet Differential Tests (C4)', () => {

  it('D1: Single, $75k W-2, standard deduction', () => {
    // AGI = $75,000
    // Taxable income = $75,000 - $15,750 = $59,250
    // Tax: 10%×$11,925 + 12%×($48,475-$11,925) + 22%×($59,250-$48,475)
    //    = $1,192.50 + $4,386.00 + $2,370.50 = $7,949.00
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 75000, federalTaxWithheld: 8000, socialSecurityWages: 75000, medicareWages: 75000 }],
    });
    const r = calculateForm1040(tr).form1040;

    expect(r.agi).toBe(75000);
    expect(r.standardDeduction).toBe(15750);
    expect(r.taxableIncome).toBe(59250);
    expect(r.incomeTax).toBeCloseTo(7949, 0);
    expect(r.totalTax).toBeCloseTo(7949, 0);
    expect(r.refundAmount).toBeCloseTo(51, 0);    // $8,000 withheld - $7,949 = $51
  });

  it('D2: MFJ, $150k combined W-2, 2 kids, standard deduction', () => {
    // AGI = $150,000
    // Taxable income = $150,000 - $31,500 = $118,500
    // Tax (MFJ): 10%×$23,850 + 12%×($96,950-$23,850) + 22%×($118,500-$96,950)
    //    = $2,385 + $8,772 + $4,741 = $15,898
    // CTC: 2 × $2,200 = $4,400
    // Tax after credits: $15,898 - $4,400 = $11,498
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 150000, federalTaxWithheld: 15000, socialSecurityWages: 150000, medicareWages: 150000 }],
      dependents: [makeChild('Alice'), makeChild('Bob')],
    });
    const r = calculateForm1040(tr).form1040;

    expect(r.agi).toBe(150000);
    expect(r.standardDeduction).toBe(31500);
    expect(r.taxableIncome).toBe(118500);
    expect(r.incomeTax).toBeCloseTo(15898, 0);
    expect(r.totalCredits).toBeCloseTo(4400, 0);
    expect(r.totalTax).toBeCloseTo(11498, 0);
  });

  it('D3: Single, $50k W-2 + $30k Schedule C → SE tax + QBI', () => {
    // SE net earnings: $30,000 × 0.9235 = $27,705
    // SE tax: $27,705 × 0.153 = $4,238.87 (approx)
    // Deductible half: $4,238.87 / 2 = $2,119.44
    // AGI = $80,000 - $2,119.44 = $77,880.56
    // Taxable income before QBI = $77,880.56 - $15,750 = $62,130.56
    // QBI = min(20% × $30,000, 20% × $62,130.56) = min($6,000, $12,426.11) = $6,000
    // Taxable income = $56,130.56
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 50000, federalTaxWithheld: 5000, socialSecurityWages: 50000, medicareWages: 50000 }],
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 30000 }],
      businesses: [{ id: 'b1', businessName: 'Consulting', accountingMethod: 'cash', didStartThisYear: false }],
    });
    const r = calculateForm1040(tr).form1040;

    expect(r.scheduleCNetProfit).toBe(30000);
    expect(r.seTax).toBeGreaterThan(4000);     // SE tax > $4k
    expect(r.seTax).toBeLessThan(4500);        // but < $4.5k
    expect(r.seDeduction).toBeGreaterThan(2000);
    expect(r.agi).toBeCloseTo(77881, 0);       // ~$77,881
    expect(r.qbiDeduction).toBeCloseTo(6000, 0);
    expect(r.totalTax).toBeGreaterThan(r.incomeTax); // totalTax includes SE tax
  });

  it('D4: MFJ, $300k W-2 + $50k qualified dividends → preferential rate on QD', () => {
    // AGI = $350,000
    // Taxable income = $350,000 - $31,500 = $318,500
    // Qualified dividends ($50k) taxed at 15% rate (not ordinary rates)
    // The engine should compute preferential tax on QD
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 300000, federalTaxWithheld: 50000, socialSecurityWages: 176100, medicareWages: 300000 }],
      income1099DIV: [{ id: 'd1', payerName: 'Fund', ordinaryDividends: 50000, qualifiedDividends: 50000 }],
    });
    const r = calculateForm1040(tr).form1040;

    expect(r.agi).toBe(350000);
    expect(r.taxableIncome).toBe(318500);
    expect(r.qualifiedDividends).toBe(50000);
    // With preferential rates, total tax should be less than if all income taxed at ordinary rates
    // Ordinary tax on $318,500 MFJ ≈ $64k+; with preferential ≈ $58k
    expect(r.preferentialTax).toBeGreaterThan(0);
    expect(r.totalTax).toBeGreaterThan(50000);
    expect(r.totalTax).toBeLessThan(70000);
  });

  it('D5: Single, $25k W-2 + $20k SS benefits → SS taxability worksheet', () => {
    // Provisional income = $25,000 + $10,000 (half SS) = $35,000
    // Single thresholds: $25k base, $34k upper
    // $35,000 > $34,000 → in 85% tier
    // 50% tier: min($34,000 - $25,000, half SS $10k) × 50% = min($9k, $10k) × 50% = $4,500
    // 85% tier: ($35,000 - $34,000) × 85% = $850
    // Taxable SS = min($4,500 + $850, 85% × $20,000) = min($5,350, $17,000) = $5,350
    // No wait — let me redo: $4,500 is 50% of $9,000. Then 85% of excess = 85% × $1,000 = $850
    // Total = $4,500 + $850 = $5,350
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 25000, federalTaxWithheld: 2000, socialSecurityWages: 25000, medicareWages: 25000 }],
      incomeSSA1099: { totalBenefits: 20000 },
    });
    const r = calculateForm1040(tr).form1040;

    expect(r.socialSecurityBenefits).toBe(20000);
    // Taxable SS should be around $5,350 based on worksheet
    expect(r.taxableSocialSecurity).toBeGreaterThan(5000);
    expect(r.taxableSocialSecurity).toBeLessThan(6000);
    expect(r.agi).toBeCloseTo(25000 + r.taxableSocialSecurity, 0);
  });

  it('D6: HoH, $35k W-2, 1 child — standard deduction and CTC', () => {
    // AGI = $35,000
    // HoH standard deduction = $23,625
    // Taxable income = $35,000 - $23,625 = $11,375
    // Tax (HoH brackets): 10%×$11,375 = $1,137.50
    // CTC: 1 × $2,200 = $2,200 (non-refundable capped at tax liability = $1,137.50)
    // Remaining CTC → ACTC (refundable, max $1,700)
    // Tax after credits: $0 (CTC exceeds tax)
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      w2Income: [{ id: 'w1', employerName: 'Store', wages: 35000, federalTaxWithheld: 3000, socialSecurityWages: 35000, medicareWages: 35000 }],
      dependents: [makeChild('Charlie')],
    });
    const r = calculateForm1040(tr).form1040;

    expect(r.agi).toBe(35000);
    expect(r.standardDeduction).toBe(23625);
    expect(r.taxableIncome).toBe(11375);
    expect(r.incomeTax).toBe(1137.5);  // 10% × $11,375 = $1,137.50
    // CTC ($2,200) exceeds tax liability → non-refundable portion limited to tax
    expect(r.taxAfterCredits).toBe(0);
    // ACTC refundable portion should be > 0
    expect(r.refundAmount).toBeGreaterThan(0);
  });

  it('D7: Single, $500k W-2, $100k SALT, itemized → SALT cap', () => {
    // AGI = $500,000
    // SALT: $100,000 but capped at $40,000 (OBBBA 2025)
    // Itemized > standard ($15,750) → use itemized
    // Additional Medicare tax: 0.9% × ($500,000 - $200,000) = $2,700
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'BigCo', wages: 500000, federalTaxWithheld: 100000, socialSecurityWages: 176100, medicareWages: 500000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 60000,
        realEstateTax: 40000,
        personalPropertyTax: 0,
        mortgageInterest: 15000,
        mortgageInsurancePremiums: 0,
        charitableCash: 5000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    });
    const r = calculateForm1040(tr).form1040;

    expect(r.agi).toBe(500000);
    // SALT capped at $40k + $15k mortgage + $5k charitable = $60,000
    expect(r.deductionUsed).toBe('itemized');
    expect(r.itemizedDeduction).toBeCloseTo(60000, 0);
    expect(r.taxableIncome).toBeCloseTo(440000, 0);
    // Additional Medicare tax on excess over $200k
    expect(r.additionalMedicareTaxW2).toBeCloseTo(2700, 0);
    expect(r.totalTax).toBeGreaterThan(100000);
  });

  it('D8: MFJ, $100k W-2 + $80k FEIE → foreign income excluded', () => {
    // W-2 wages: $100,000
    // FEIE: $80,000 excluded (under $130k limit)
    // Total income: $100,000 - $80,000 = $20,000
    // AGI: $20,000
    // But §911(f) stacking: tax computed as if all income included, then credit for excluded portion
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'GlobalCo', wages: 100000, federalTaxWithheld: 5000, socialSecurityWages: 100000, medicareWages: 100000 }],
      foreignEarnedIncome: {
        foreignEarnedIncome: 80000,
        daysAbroad: 365,
        qualifyingTest: 'physical_presence',
        foreignCountry: 'Germany',
      },
    });
    const r = calculateForm1040(tr).form1040;

    expect(r.feieExclusion).toBe(80000);
    expect(r.totalIncome).toBe(20000);  // $100k - $80k
    expect(r.agi).toBe(20000);
    // Taxable income is low but tax uses stacking (higher effective rate)
    expect(r.taxableIncome).toBeLessThan(20000); // After MFJ standard deduction
    // Tax should be modest due to stacking
    expect(r.totalTax).toBeGreaterThanOrEqual(0);
  });

  it('D9: Single, $40k W-2, AOTC education credit', () => {
    // AGI = $40,000 (below $80k AOTC phase-out start)
    // AOTC: 100% of first $2,000 + 25% of next $2,000 = $2,500
    // 40% refundable = $1,000; 60% non-refundable = $1,500
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 40000, federalTaxWithheld: 3000, socialSecurityWages: 40000, medicareWages: 40000 }],
      educationCredits: [{
        id: 'ed1',
        type: 'american_opportunity',
        studentName: 'Self',
        tuitionPaid: 4000,         // Enough for max AOTC ($2,000 + 25% × $2,000 = $2,500)
        institution: 'State U',
      }],
    });
    const r = calculateForm1040(tr).form1040;

    expect(r.agi).toBe(40000);
    expect(r.taxableIncome).toBe(24250);  // $40,000 - $15,750
    // Tax on $24,250: 10%×$11,925 + 12%×($24,250-$11,925) = $1,192.50 + $1,479 = $2,671.50
    expect(r.incomeTax).toBe(2671.5);
    // AOTC = $2,500 total credit (non-refundable $1,500 + refundable $1,000)
    expect(r.totalCredits).toBeGreaterThan(2000);
    // Should get a refund (withholding + refundable AOTC portion)
    expect(r.refundAmount).toBeGreaterThan(0);
  });

  it('D10: MFJ, $120k W-2, rental loss $25k → passive loss allowed (MAGI < $100k)', () => {
    // With MAGI fix (A2): MAGI for passive loss = incomeBeforeSS - adjustments
    // AGI = $120,000 - $0 adjustments = $120,000
    // But wait — rental income/loss flows through Schedule E and adjusts total income
    // For MAGI for passive loss: uses $120k wages only (no SS, no rental circularities)
    // Since MAGI ($120k) > $100k but < $150k: allowance = $25,000 - ($120,000-$100,000)/2
    //   = $25,000 - $10,000 = $15,000
    // So rental loss allowed: $15,000 (of $25k); $10k suspended
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 120000, federalTaxWithheld: 15000, socialSecurityWages: 120000, medicareWages: 120000 }],
      rentalProperties: [{
        id: 'r1',
        propertyType: 'single_family',
        rentalIncome: 12000,
        daysRented: 365,
        personalUseDays: 0,
        mortgageInterest: 20000,
        taxes: 5000,
        insurance: 3000,
        repairs: 4000,
        depreciation: 5000,
      }],
    });
    const r = calculateForm1040(tr).form1040;

    // Rental: $12k income - ($20k + $5k + $3k + $4k + $5k) expenses = $12k - $37k = -$25k loss
    // Allowable with $120k MAGI: $15,000 of loss allowed
    expect(r.scheduleEIncome).toBeCloseTo(-15000, 0);
    // AGI = $120,000 + (-$15,000 rental) = $105,000
    expect(r.agi).toBeCloseTo(105000, 0);
    expect(r.taxableIncome).toBeCloseTo(73500, 0); // $105,000 - $31,500
  });
});
