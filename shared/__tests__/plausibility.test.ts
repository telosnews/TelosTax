import { describe, it, expect } from 'vitest';
import { checkPlausibility, PlausibilityWarning } from '../src/engine/plausibility.js';
import type { TaxReturn } from '../src/types/index.js';

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    filingStatus: 1,
    firstName: 'Test', lastName: 'User',
    dateOfBirth: '1990-01-01',
    w2Income: [],
    income1099NEC: [], income1099K: [], income1099INT: [], income1099DIV: [],
    income1099R: [], income1099G: [], income1099MISC: [], income1099B: [], income1099DA: [],
    income1099SA: [], incomeK1: [], rentalProperties: [],
    dependents: [], expenses: [],
    incomeDiscovery: {},
    ...overrides,
  } as unknown as TaxReturn;
}

// ─── 1. Normal values ───────────────────────────────────────────────────────

describe('Returns empty array for normal values', () => {
  it('returns no warnings for a typical return', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 75_000 }] as any,
    });
    expect(checkPlausibility(tr)).toEqual([]);
  });
});

// ─── 2. W-2 warnings ───────────────────────────────────────────────────────

describe('W-2 warnings', () => {
  it('warns when W-2 wages exceed $1,000,000', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 1_500_000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].category).toBe('income');
    expect(warnings[0].field).toContain('w2Income');
  });
});

// ─── 3. Self-employment warnings ────────────────────────────────────────────

describe('Self-employment warnings', () => {
  it('warns when 1099-NEC exceeds $500,000', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ amount: 750_000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].category).toBe('income');
  });
});

// ─── 4. Interest income warnings ───────────────────────────────────────────

describe('Interest income warnings', () => {
  it('warns when interest exceeds $100,000', () => {
    const tr = makeTaxReturn({
      income1099INT: [{ amount: 150_000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 5. Dividend income warnings ───────────────────────────────────────────

describe('Dividend income warnings', () => {
  it('warns when dividends exceed $200,000', () => {
    const tr = makeTaxReturn({
      income1099DIV: [{ ordinaryDividends: 300_000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 6. Retirement distribution warnings ────────────────────────────────────

describe('Retirement distribution warnings', () => {
  it('warns when 1099-R exceeds $500,000', () => {
    const tr = makeTaxReturn({
      income1099R: [{ grossDistribution: 750_000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 7. Charitable deduction warnings (AGI-dependent) ───────────────────────

describe('Charitable deduction warnings (AGI-dependent)', () => {
  it('warns when charitable exceeds 50% of AGI', () => {
    const tr = makeTaxReturn({
      itemizedDeductions: { charitableCash: 60_000 } as any,
    });
    const warnings = checkPlausibility(tr, 100_000);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].category).toBe('deduction');
  });

  it('does not warn when AGI is zero', () => {
    const tr = makeTaxReturn({
      itemizedDeductions: { charitableCash: 60_000 } as any,
    });
    const warnings = checkPlausibility(tr, 0);
    const charitableWarnings = warnings.filter(w => w.field.includes('charitable'));
    expect(charitableWarnings).toHaveLength(0);
  });
});

// ─── 8. Medical expense warnings (AGI-dependent) ────────────────────────────

describe('Medical expense warnings (AGI-dependent)', () => {
  it('warns when medical exceeds 30% of AGI', () => {
    const tr = makeTaxReturn({
      itemizedDeductions: { medicalExpenses: 40_000 } as any,
    });
    const warnings = checkPlausibility(tr, 100_000);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 9. SALT warnings ──────────────────────────────────────────────────────

describe('SALT warnings', () => {
  it('warns when SALT entered exceeds $50,000', () => {
    const tr = makeTaxReturn({
      itemizedDeductions: {
        stateLocalIncomeTax: 30_000,
        realEstateTax: 25_000,
      } as any,
    });
    const warnings = checkPlausibility(tr);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 10. Home office area warnings ──────────────────────────────────────────

describe('Home office area warnings', () => {
  it('warns when office area exceeds 50% of home', () => {
    const tr = makeTaxReturn({
      homeOffice: { squareFeet: 800, totalHomeSquareFeet: 1200, method: 'simplified' } as any,
    });
    const warnings = checkPlausibility(tr);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 11. Vehicle mileage warnings ──────────────────────────────────────────

describe('Vehicle mileage warnings', () => {
  it('warns when business miles exceed 40,000', () => {
    const tr = makeTaxReturn({
      vehicle: { businessMiles: 50_000, method: 'standard' } as any,
    });
    const warnings = checkPlausibility(tr);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 12. W-2 Cross-field: FICA consistency ────────────────────────────────

describe('W-2 cross-field FICA validation', () => {
  it('warns when Box 3 SS wages exceed SS wage base', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 180_000, socialSecurityWages: 180_000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    const ssWarnings = warnings.filter(w => w.field.includes('socialSecurityWages'));
    expect(ssWarnings.length).toBeGreaterThanOrEqual(1);
    expect(ssWarnings[0].message).toContain('wage base');
  });

  it('does not warn when Box 3 is at the wage base', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 176_100, socialSecurityWages: 176_100 }] as any,
    });
    const warnings = checkPlausibility(tr);
    const ssWarnings = warnings.filter(w => w.field.includes('socialSecurityWages'));
    expect(ssWarnings).toHaveLength(0);
  });

  it('warns when Box 4 SS tax exceeds 6.2% of Box 3', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 50_000, socialSecurityWages: 50_000, socialSecurityTax: 5000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    const ssTaxWarnings = warnings.filter(w => w.field.includes('socialSecurityTax'));
    expect(ssTaxWarnings.length).toBeGreaterThanOrEqual(1);
    expect(ssTaxWarnings[0].message).toContain('6.2%');
  });

  it('does not warn when Box 4 equals 6.2% of Box 3', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 50_000, socialSecurityWages: 50_000, socialSecurityTax: 3100 }] as any,
    });
    const warnings = checkPlausibility(tr);
    const ssTaxWarnings = warnings.filter(w => w.field.includes('socialSecurityTax'));
    expect(ssTaxWarnings).toHaveLength(0);
  });

  it('warns when Box 6 Medicare tax exceeds expected maximum', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 50_000, medicareWages: 50_000, medicareTax: 1000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    const medWarnings = warnings.filter(w => w.field.includes('medicareTax'));
    expect(medWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('does not warn when Box 6 equals 1.45% of Box 5', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 50_000, medicareWages: 50_000, medicareTax: 725 }] as any,
    });
    const warnings = checkPlausibility(tr);
    const medWarnings = warnings.filter(w => w.field.includes('medicareTax'));
    expect(medWarnings).toHaveLength(0);
  });

  it('allows Additional Medicare Tax for high earners (Box 5 > $200K)', () => {
    // $300K medicare wages: regular 1.45% = $4,350 + 0.9% on $100K = $900 = $5,250 total
    const tr = makeTaxReturn({
      w2Income: [{ wages: 300_000, medicareWages: 300_000, medicareTax: 5250 }] as any,
    });
    const warnings = checkPlausibility(tr);
    const medWarnings = warnings.filter(w => w.field.includes('medicareTax'));
    expect(medWarnings).toHaveLength(0);
  });

  it('warns when Box 1 wages exceed Box 5 Medicare wages', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 60_000, medicareWages: 50_000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    const wageWarnings = warnings.filter(w => w.message.includes('Box 1') && w.message.includes('Box 5'));
    expect(wageWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('does not warn when Box 5 >= Box 1 (normal case)', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 50_000, medicareWages: 55_000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    const wageWarnings = warnings.filter(w => w.message?.includes('Box 1') && w.message?.includes('Box 5'));
    expect(wageWarnings).toHaveLength(0);
  });

  it('does not warn about FICA when optional fields are not provided', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 75_000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    const ficaWarnings = warnings.filter(w =>
      w.field.includes('socialSecurity') || w.field.includes('medicare')
    );
    expect(ficaWarnings).toHaveLength(0);
  });
});

// ─── 13. Multiple warnings ─────────────────────────────────────────────────

describe('Multiple warnings', () => {
  it('returns multiple warnings when multiple thresholds exceeded', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 1_500_000 }] as any,
      income1099NEC: [{ amount: 750_000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── 13. Warning structure ──────────────────────────────────────────────────

describe('Warning structure', () => {
  it('warnings have correct structure', () => {
    const tr = makeTaxReturn({
      w2Income: [{ wages: 1_500_000 }] as any,
    });
    const warnings = checkPlausibility(tr);
    expect(warnings.length).toBeGreaterThanOrEqual(1);

    const w = warnings[0];
    expect(w).toHaveProperty('category');
    expect(w).toHaveProperty('field');
    expect(w).toHaveProperty('stepId');
    expect(w).toHaveProperty('message');
    expect(w).toHaveProperty('severity', 'warn');
    expect(w).toHaveProperty('value');
    expect(w).toHaveProperty('threshold');
  });
});
