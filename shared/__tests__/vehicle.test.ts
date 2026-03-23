import { describe, it, expect } from 'vitest';
import { calculateVehicleDeduction, calculateVehicleDetailed, compareVehicleMethods } from '../src/engine/vehicle.js';

// ═══════════════════════════════════════════════════════════
// 1. Standard Mileage Method
// ═══════════════════════════════════════════════════════════

describe('Standard mileage method', () => {
  it('returns 0 when no method selected', () => {
    expect(calculateVehicleDeduction({ method: null })).toBe(0);
  });

  it('calculates $0.70/mile for business miles', () => {
    const result = calculateVehicleDeduction({
      method: 'standard_mileage',
      businessMiles: 10000,
    });
    // 10000 * $0.70 = $7,000
    expect(result).toBe(7000);
  });

  it('returns 0 when business miles is 0', () => {
    expect(calculateVehicleDeduction({ method: 'standard_mileage', businessMiles: 0 })).toBe(0);
  });

  it('handles undefined business miles', () => {
    expect(calculateVehicleDeduction({ method: 'standard_mileage' })).toBe(0);
  });

  it('returns detailed result with standardDeduction field', () => {
    const result = calculateVehicleDetailed({
      method: 'standard_mileage',
      businessMiles: 15000,
    });
    expect(result.method).toBe('standard_mileage');
    expect(result.standardDeduction).toBe(10500); // 15000 * 0.70
    expect(result.totalDeduction).toBe(10500);
    expect(result.businessUsePercentage).toBe(1); // no totalMiles means 100%
  });
});

// ═══════════════════════════════════════════════════════════
// 2. Actual Method — Legacy (single actualExpenses)
// ═══════════════════════════════════════════════════════════

describe('Actual method — legacy backward compat', () => {
  it('calculates proportion of actual expenses', () => {
    const result = calculateVehicleDeduction({
      method: 'actual',
      businessMiles: 8000,
      totalMiles: 20000,
      actualExpenses: 10000,
    });
    // Ratio = 8000/20000 = 0.4. 0.4 * 10000 = 4000
    expect(result).toBe(4000);
  });

  it('returns 0 when total miles is 0', () => {
    expect(calculateVehicleDeduction({
      method: 'actual',
      businessMiles: 5000,
      totalMiles: 0,
      actualExpenses: 10000,
    })).toBe(0);
  });

  it('returns 0 when business miles is 0', () => {
    expect(calculateVehicleDeduction({
      method: 'actual',
      businessMiles: 0,
      totalMiles: 20000,
      actualExpenses: 10000,
    })).toBe(0);
  });

  it('caps ratio at 100% when business exceeds total', () => {
    const result = calculateVehicleDeduction({
      method: 'actual',
      businessMiles: 25000,
      totalMiles: 20000,
      actualExpenses: 10000,
    });
    // Ratio capped at 1.0. 1.0 * 10000 = 10000
    expect(result).toBe(10000);
  });

  it('returns 0 when total miles undefined', () => {
    expect(calculateVehicleDeduction({
      method: 'actual',
      businessMiles: 5000,
      actualExpenses: 10000,
    })).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Actual Method — Granular Expense Categories
// ═══════════════════════════════════════════════════════════

describe('Actual method — granular expense categories', () => {
  it('sums expense categories and applies business percentage', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 15000,
      totalMiles: 20000,
      gas: 3000,
      insurance: 1800,
      repairs: 500,
    });
    // Total = 3000 + 1800 + 500 = 5300
    // Business % = 15000/20000 = 0.75
    // Business portion = 5300 * 0.75 = 3975
    expect(result.totalActualExpenses).toBe(5300);
    expect(result.businessUsePercentage).toBe(0.75);
    expect(result.businessPortionExpenses).toBe(3975);
    expect(result.totalDeduction).toBe(3975); // No depreciation
  });

  it('populates expense breakdown with business-portion amounts', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 20000,
      gas: 2000,
      tolls: 500,
      parking: 300,
    });
    // Business % = 50%
    expect(result.expenseBreakdown).toBeDefined();
    expect(result.expenseBreakdown!.gas).toBe(1000);
    expect(result.expenseBreakdown!.tolls).toBe(250);
    expect(result.expenseBreakdown!.parking).toBe(150);
    expect(result.expenseBreakdown!.repairs).toBe(0);
  });

  it('returns 0 when total miles is 0 with granular expenses', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 0,
      gas: 3000,
    });
    expect(result.totalDeduction).toBe(0);
    expect(result.businessUsePercentage).toBe(0);
  });

  it('handles all expense categories populated', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      gas: 1000,
      oilAndLubes: 200,
      repairs: 300,
      tires: 400,
      insurance: 500,
      registration: 100,
      licenses: 50,
      garageRent: 150,
      tolls: 250,
      parking: 350,
      leasePayments: 600,
      otherVehicleExpenses: 100,
    });
    // Total = 1000+200+300+400+500+100+50+150+250+350+600+100 = 4000
    // Business % = 100%
    expect(result.totalActualExpenses).toBe(4000);
    expect(result.businessPortionExpenses).toBe(4000);
    expect(result.businessUsePercentage).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 4. Depreciation (MACRS 5-Year)
// ═══════════════════════════════════════════════════════════

describe('Depreciation (MACRS 5-year)', () => {
  it('applies 100% bonus depreciation for first year (2025)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 15000,
      dateInService: '2025-01-15',
      vehicleWeight: 7000, // Heavy vehicle — no 280F limit
    });
    // Year 0 → 100% bonus → 15000 * 1.0 = 15000
    // Business % = 100% → 15000
    expect(result.depreciationComputed).toBe(15000);
    expect(result.depreciationBusinessPortion).toBe(15000);
    expect(result.depreciationAllowed).toBe(15000);
  });

  it('applies year 2 MACRS rate (placed in service 2024)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 30000,
      dateInService: '2024-06-01',
      vehicleWeight: 7000, // Heavy vehicle — no 280F limit
    });
    // Year index = 2025 - 2024 = 1 → MACRS rate = 0.32
    // 30000 * 0.32 = 9600
    expect(result.depreciationComputed).toBe(9600);
    expect(result.depreciationAllowed).toBe(9600);
  });

  it('applies year 3 MACRS rate (placed in service 2023)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 30000,
      dateInService: '2023-03-01',
      vehicleWeight: 7000,
    });
    // Year index = 2025 - 2023 = 2 → MACRS rate = 0.192
    // 30000 * 0.192 = 5760
    expect(result.depreciationComputed).toBe(5760);
  });

  it('returns 0 depreciation beyond year 6', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 30000,
      dateInService: '2018-01-01', // Year index = 7, beyond MACRS table
      vehicleWeight: 7000,
    });
    expect(result.depreciationComputed).toBe(0);
    expect(result.depreciationAllowed).toBe(0);
  });

  it('returns 0 when vehicleCost is 0', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 0,
      dateInService: '2025-01-01',
    });
    expect(result.depreciationComputed).toBe(0);
  });

  it('defaults to first year when dateInService is missing', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 10000,
      vehicleWeight: 7000,
    });
    // No dateInService → defaults to year 0 → 100% bonus
    expect(result.depreciationComputed).toBe(10000);
    expect(result.depreciationAllowed).toBe(10000);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. Section 280F Luxury Vehicle Limits
// ═══════════════════════════════════════════════════════════

describe('Section 280F luxury vehicle limits', () => {
  it('caps first-year depreciation at $20,200 (with bonus)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 50000,
      dateInService: '2025-03-01',
      // vehicleWeight NOT set → standard passenger vehicle → 280F applies
    });
    // 100% bonus = 50000 * 1.0 = 50000, business = 50000
    // 280F year1 limit = 20200
    expect(result.depreciationBusinessPortion).toBe(50000);
    expect(result.depreciationAllowed).toBe(20200);
    expect(result.section280FLimit).toBe(20200);
    expect(result.section280FApplied).toBe(true);
  });

  it('does not cap when depreciation is below limit', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 15000,
      dateInService: '2025-01-01',
    });
    // 100% bonus = 15000 * 1.0 = 15000 * 100% = 15000
    // 280F year1 limit = 20200 → not binding
    expect(result.depreciationAllowed).toBe(15000);
    expect(result.section280FApplied).toBe(false);
  });

  it('applies year 2 limit ($19,600)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 80000,
      dateInService: '2024-01-01',
    });
    // Year index = 1 → MACRS rate = 0.32 → 80000 * 0.32 = 25600
    // 280F year2 limit = 19600
    expect(result.depreciationBusinessPortion).toBe(25600);
    expect(result.depreciationAllowed).toBe(19600);
    expect(result.section280FLimit).toBe(19600);
    expect(result.section280FApplied).toBe(true);
  });

  it('applies year 3 limit ($11,800)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 80000,
      dateInService: '2023-01-01',
    });
    // Year index = 2 → MACRS rate = 0.192 → 80000 * 0.192 = 15360
    // 280F year3 limit = 11800
    expect(result.depreciationAllowed).toBe(11800);
    expect(result.section280FLimit).toBe(11800);
  });

  it('applies year 4+ limit ($7,060)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 80000,
      dateInService: '2021-01-01',
    });
    // Year index = 4 → MACRS rate = 0.1152 → 80000 * 0.1152 = 9216
    // 280F year4+ limit = 7060
    expect(result.depreciationAllowed).toBe(7060);
    expect(result.section280FLimit).toBe(7060);
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Heavy Vehicle (SUV Exception)
// ═══════════════════════════════════════════════════════════

describe('Heavy vehicle SUV exception (>6,000 lbs)', () => {
  it('bypasses Section 280F limits for vehicles over 6,000 lbs', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 60000,
      dateInService: '2025-01-01',
      vehicleWeight: 6500,
    });
    // 100% bonus = 60000, business = 60000
    // Heavy vehicle → no 280F limit → full depreciation
    expect(result.depreciationAllowed).toBe(60000);
    expect(result.section280FApplied).toBe(false);
    expect(result.section280FLimit).toBe(0);
  });

  it('does NOT bypass 280F at exactly 6,000 lbs (threshold is >6,000)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 50000,
      dateInService: '2025-01-01',
      vehicleWeight: 6000,
    });
    // Not heavy → 280F applies → capped at 20200
    expect(result.depreciationAllowed).toBe(20200);
    expect(result.section280FApplied).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. Combined Actual Expenses + Depreciation
// ═══════════════════════════════════════════════════════════

describe('Combined actual expenses + depreciation', () => {
  it('total = businessPortionExpenses + depreciationAllowed', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 15000,
      totalMiles: 20000,
      gas: 3000,
      insurance: 1800,
      repairs: 500,
      vehicleCost: 35000,
      dateInService: '2025-01-01',
      // No vehicleWeight → 280F applies
    });
    // Expenses: 3000 + 1800 + 500 = 5300
    // Business % = 15000/20000 = 0.75
    // Business portion expenses = 5300 * 0.75 = 3975
    // Depreciation: 35000 * 1.0 = 35000, * 0.75 = 26250
    // 280F year1 = 20200 → allowed = 20200
    // Total = 3975 + 20200 = 24175
    expect(result.businessPortionExpenses).toBe(3975);
    expect(result.depreciationAllowed).toBe(20200);
    expect(result.totalDeduction).toBe(24175);
  });

  it('real-world rideshare driver scenario', () => {
    // Uber driver: 2023 Honda Civic, 30k miles, 22k business
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 22000,
      totalMiles: 30000,
      gas: 4200,        // $350/mo
      oilAndLubes: 180,
      repairs: 800,
      tires: 400,
      insurance: 2400,  // $200/mo
      registration: 150,
      parking: 600,
      vehicleCost: 28000,
      dateInService: '2023-07-01',
      // Year index = 2025 - 2023 = 2 → MACRS rate 0.192
      // vehicleWeight not set → 280F applies
    });
    // Business % = 22000/30000 = 0.7333...
    const businessPct = 22000 / 30000;
    // Total expenses = 4200 + 180 + 800 + 400 + 2400 + 150 + 600 = 8730
    expect(result.totalActualExpenses).toBe(8730);
    // Business portion = 8730 * 0.7333 = 6402
    expect(result.businessPortionExpenses).toBe(Math.round(8730 * businessPct * 100) / 100);
    // Depreciation: 28000 * 0.192 = 5376, * businessPct = 3942.40
    // 280F year3 = 11800 → not binding (3942.40 < 11800)
    expect(result.section280FApplied).toBe(false);
    // Total = expenses + depreciation
    expect(result.totalDeduction).toBe(
      Math.round((8730 * businessPct + 28000 * 0.192 * businessPct) * 100) / 100,
    );
  });
});

// ═══════════════════════════════════════════════════════════
// 8. compareVehicleMethods
// ═══════════════════════════════════════════════════════════

describe('compareVehicleMethods', () => {
  it('returns both method calculations (legacy 3-arg signature)', () => {
    const result = compareVehicleMethods(10000, 20000, 12000);
    expect(result.standardMileage).toBe(7000);  // 10000 * 0.70
    expect(result.actual).toBe(6000);            // (10000/20000) * 12000
  });

  it('returns both method calculations (VehicleInfo signature)', () => {
    const result = compareVehicleMethods({
      method: null,
      businessMiles: 10000,
      totalMiles: 20000,
      gas: 8000,
      insurance: 4000,
    });
    expect(result.standardMileage).toBe(7000);
    // Actual: (8000 + 4000) * 0.5 = 6000
    expect(result.actual).toBe(6000);
  });
});

// ═══════════════════════════════════════════════════════════
// 9. Edge Cases
// ═══════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('handles invalid dateInService gracefully', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 10000,
      dateInService: 'not-a-date',
      vehicleWeight: 7000,
    });
    // Invalid date → defaults to year 0 → 100% bonus
    expect(result.depreciationComputed).toBe(10000);
  });

  it('handles partial expense categories (some zero, some filled)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 10000,
      gas: 2000,
      // All other categories default to 0
    });
    expect(result.totalActualExpenses).toBe(2000);
    expect(result.businessPortionExpenses).toBe(2000);
  });

  it('calculateVehicleDeduction wrapper returns correct number', () => {
    const detailed = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 20000,
      gas: 4000,
      vehicleCost: 20000,
      dateInService: '2025-01-01',
    });
    const simple = calculateVehicleDeduction({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 20000,
      gas: 4000,
      vehicleCost: 20000,
      dateInService: '2025-01-01',
    });
    expect(simple).toBe(detailed.totalDeduction);
  });

  it('prefers granular categories over legacy actualExpenses when both present', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 10000,
      actualExpenses: 9999, // Should be ignored
      gas: 500,
    });
    // Granular categories take priority
    expect(result.totalActualExpenses).toBe(500);
    expect(result.totalDeduction).toBe(500);
  });

  it('depreciation with partial business use reduces by business %', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 15000,
      totalMiles: 20000,
      vehicleCost: 40000,
      dateInService: '2025-01-01',
      // Business % = 75% (> 50%, so MACRS applies)
    });
    // 100% bonus = 40000, * 75% = 30000
    // 280F year1 = 20200 → binding
    expect(result.depreciationBusinessPortion).toBe(30000);
    expect(result.depreciationAllowed).toBe(20200);
    expect(result.section280FApplied).toBe(true);
  });
});
