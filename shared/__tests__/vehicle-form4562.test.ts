/**
 * Tests for Vehicle Form 4562 Part V enhancements:
 *
 * 1. Prior depreciation — reduces depreciable basis
 * 2. Business use <= 50% — straight-line depreciation, no bonus (IRC §280F(b)(1))
 * 3. Form 4562 Part V output — mileage breakdown and documentation fields
 * 4. Validation warnings — IRS compliance advisories
 *
 * @authority
 *   IRC: Section 280F(b)(1) — listed property not predominantly used in business
 *   IRC: Section 274(d) — substantiation requirements (written records)
 *   IRC: Section 168(b)(1) — MACRS 200% declining balance
 *   IRS Pub: 946 — How to Depreciate Property (Table A-1, A-8)
 *   Form: Form 4562, Part V — Listed Property
 */

import { describe, it, expect } from 'vitest';
import { calculateVehicleDetailed, calculateVehicleDeduction } from '../src/engine/vehicle.js';

// ═════════════════════════════════════════════════════════════
// 1. Prior Depreciation
// ═════════════════════════════════════════════════════════════

describe('Prior depreciation reduces depreciable basis', () => {
  it('vehicle with $5,000 prior depreciation → reduced basis', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 30000,
      priorDepreciation: 5000,
      dateInService: '2025-01-01',
      vehicleWeight: 7000, // Heavy → no 280F
    });
    // Depreciable basis = 30000 - 5000 = 25000
    // Year 0, 100% bonus → 25000 * 1.0 = 25000
    // Business 100% → 25000
    expect(result.depreciationComputed).toBe(25000);
    expect(result.depreciationAllowed).toBe(25000);
  });

  it('vehicle with prior depreciation exceeding cost → $0 depreciation', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 20000,
      priorDepreciation: 25000, // Exceeds cost
      dateInService: '2025-01-01',
      vehicleWeight: 7000,
    });
    // Depreciable basis = max(0, 20000 - 25000) = 0
    expect(result.depreciationComputed).toBe(0);
    expect(result.depreciationAllowed).toBe(0);
  });

  it('vehicle with prior depreciation equal to cost → $0 depreciation', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 15000,
      priorDepreciation: 15000,
      dateInService: '2024-01-01',
      vehicleWeight: 7000,
    });
    expect(result.depreciationComputed).toBe(0);
    expect(result.depreciationAllowed).toBe(0);
  });

  it('prior depreciation + Section 280F interaction', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 50000,
      priorDepreciation: 10000,
      dateInService: '2025-01-01',
      // No vehicleWeight → 280F applies
    });
    // Depreciable basis = 50000 - 10000 = 40000
    // Year 0, 100% bonus → 40000 * 1.0 = 40000
    // Business 100% → 40000
    // 280F year1 with bonus = 20200 → capped
    expect(result.depreciationComputed).toBe(40000);
    expect(result.depreciationBusinessPortion).toBe(40000);
    expect(result.depreciationAllowed).toBe(20200);
    expect(result.section280FApplied).toBe(true);
  });

  it('prior depreciation with year 2 MACRS rate', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 40000,
      priorDepreciation: 8000,
      dateInService: '2024-01-01',
      vehicleWeight: 7000,
    });
    // Depreciable basis = 40000 - 8000 = 32000
    // Year 1 → MACRS rate 0.32 → 32000 * 0.32 = 10240
    expect(result.depreciationComputed).toBe(10240);
    expect(result.depreciationAllowed).toBe(10240);
  });

  it('no prior depreciation (undefined) → full basis', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 20000,
      dateInService: '2025-01-01',
      vehicleWeight: 7000,
    });
    // No priorDepreciation → depreciable basis = 20000
    expect(result.depreciationComputed).toBe(20000);
    expect(result.depreciationAllowed).toBe(20000);
  });
});

// ═════════════════════════════════════════════════════════════
// 2. Business use ≤ 50% → Straight-line depreciation
// ═════════════════════════════════════════════════════════════

describe('Business use ≤ 50% — straight-line depreciation (IRC §280F(b)(1))', () => {
  it('50% business use → straight-line rates (not MACRS 200% DB)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 20000,
      vehicleCost: 40000,
      dateInService: '2025-01-01',
      vehicleWeight: 7000, // Heavy → no 280F, isolate rate difference
    });
    // Business % = 50% (≤ 50% → straight-line)
    // Straight-line year 0 rate = 0.10
    // 40000 * 0.10 = 4000, * 50% = 2000
    expect(result.depreciationComputed).toBe(4000);
    expect(result.depreciationBusinessPortion).toBe(2000);
    expect(result.depreciationAllowed).toBe(2000);
    expect(result.depreciationMethod).toBe('straight_line');
  });

  it('50% business use → no bonus depreciation', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 20000,
      vehicleCost: 40000,
      dateInService: '2025-01-01',
      vehicleWeight: 7000,
    });
    // If bonus applied: 40000 * 1.0 = 40000 * 50% = 20000
    // Actual: straight-line → 40000 * 0.10 = 4000 * 50% = 2000
    expect(result.depreciationAllowed).toBe(2000);
    expect(result.depreciationAllowed).not.toBe(20000);
  });

  it('25% business use → straight-line, year 0', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 5000,
      totalMiles: 20000,
      vehicleCost: 40000,
      dateInService: '2025-01-01',
      vehicleWeight: 7000,
    });
    // Straight-line year 0 = 0.10 → 40000 * 0.10 = 4000
    // * 25% = 1000
    expect(result.depreciationComputed).toBe(4000);
    expect(result.depreciationBusinessPortion).toBe(1000);
    expect(result.depreciationAllowed).toBe(1000);
    expect(result.depreciationMethod).toBe('straight_line');
  });

  it('51% business use → normal MACRS (boundary test)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10200,
      totalMiles: 20000,
      vehicleCost: 40000,
      dateInService: '2025-01-01',
      vehicleWeight: 7000,
    });
    // Business % = 10200/20000 = 0.51 (> 0.50 → MACRS)
    // 100% bonus → 40000 * 1.0 = 40000 * 51% = 20400
    expect(result.depreciationComputed).toBe(40000);
    expect(result.depreciationBusinessPortion).toBe(20400);
    expect(result.depreciationAllowed).toBe(20400);
    expect(result.depreciationMethod).toBe('macrs_200db');
  });

  it('straight-line year 2 rate (≤ 50% use, placed 2024)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 8000,
      totalMiles: 20000,
      vehicleCost: 30000,
      dateInService: '2024-06-01',
      vehicleWeight: 7000,
    });
    // Business % = 40% (≤ 50% → straight-line)
    // Year index = 2025 - 2024 = 1 → straight-line rate = 0.20
    // 30000 * 0.20 = 6000, * 40% = 2400
    expect(result.depreciationComputed).toBe(6000);
    expect(result.depreciationBusinessPortion).toBe(2400);
    expect(result.depreciationAllowed).toBe(2400);
    expect(result.depreciationMethod).toBe('straight_line');
  });

  it('Section 280F limits still apply to straight-line method', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 20000,
      vehicleCost: 200000,
      dateInService: '2024-01-01',
      // No vehicleWeight → 280F applies
    });
    // Business % = 50% (≤ 50% → straight-line)
    // Year index = 1 → straight-line rate = 0.20
    // 200000 * 0.20 = 40000, * 50% = 20000
    // 280F no-bonus year2 = 19600 → capped
    expect(result.depreciationBusinessPortion).toBe(20000);
    expect(result.depreciationAllowed).toBe(19600);
    expect(result.section280FApplied).toBe(true);
    expect(result.depreciationMethod).toBe('straight_line');
  });

  it('≤ 50% use with 280F uses no-bonus year 1 limit ($12,200)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 20000,
      vehicleCost: 300000,
      dateInService: '2025-01-01',
      // No vehicleWeight → 280F applies
    });
    // Business % = 50% → straight-line
    // Year 0 straight-line rate = 0.10 → 300000 * 0.10 = 30000
    // * 50% = 15000
    // 280F no-bonus year1 = 12200 (NOT 20200 bonus limit)
    expect(result.depreciationBusinessPortion).toBe(15000);
    expect(result.depreciationAllowed).toBe(12200);
    expect(result.section280FLimit).toBe(12200);
    expect(result.section280FApplied).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
// 3. Form 4562 Part V output
// ═════════════════════════════════════════════════════════════

describe('Form 4562 Part V — Listed Property output', () => {
  it('populated with correct values from VehicleInfo', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 15000,
      totalMiles: 25000,
      commuteMiles: 5000,
      otherMiles: 5000,
      gas: 3000,
      availableForPersonalUse: true,
      hasAnotherVehicle: true,
      writtenEvidence: true,
      writtenEvidenceContemporaneous: true,
    });
    expect(result.form4562PartV).toBeDefined();
    expect(result.form4562PartV!.totalMiles).toBe(25000);
    expect(result.form4562PartV!.businessMiles).toBe(15000);
    expect(result.form4562PartV!.commuteMiles).toBe(5000);
    expect(result.form4562PartV!.otherMiles).toBe(5000);
    expect(result.form4562PartV!.availableForPersonalUse).toBe(true);
    expect(result.form4562PartV!.hasAnotherVehicle).toBe(true);
    expect(result.form4562PartV!.writtenEvidence).toBe(true);
    expect(result.form4562PartV!.writtenEvidenceContemporaneous).toBe(true);
  });

  it('otherMiles auto-calculated when not provided', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 12000,
      totalMiles: 20000,
      commuteMiles: 3000,
      gas: 2000,
      // otherMiles NOT provided → calculated as 20000 - 12000 - 3000 = 5000
    });
    expect(result.form4562PartV).toBeDefined();
    expect(result.form4562PartV!.otherMiles).toBe(5000);
  });

  it('otherMiles uses explicit value when provided', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 12000,
      totalMiles: 20000,
      commuteMiles: 3000,
      otherMiles: 4000, // Explicitly set (doesn't need to match arithmetic)
      gas: 2000,
    });
    expect(result.form4562PartV!.otherMiles).toBe(4000);
  });

  it('default values when Part V fields are undefined', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 20000,
      gas: 1000,
      // No Part V fields set
    });
    expect(result.form4562PartV).toBeDefined();
    expect(result.form4562PartV!.availableForPersonalUse).toBe(true);  // Conservative default
    expect(result.form4562PartV!.hasAnotherVehicle).toBe(false);
    expect(result.form4562PartV!.writtenEvidence).toBe(false);
    expect(result.form4562PartV!.writtenEvidenceContemporaneous).toBe(false);
  });

  it('standard mileage method also includes Part V when totalMiles > 0', () => {
    const result = calculateVehicleDetailed({
      method: 'standard_mileage',
      businessMiles: 10000,
      totalMiles: 15000,
      commuteMiles: 2000,
      writtenEvidence: true,
    });
    expect(result.form4562PartV).toBeDefined();
    expect(result.form4562PartV!.totalMiles).toBe(15000);
    expect(result.form4562PartV!.businessMiles).toBe(10000);
    expect(result.form4562PartV!.commuteMiles).toBe(2000);
    expect(result.form4562PartV!.otherMiles).toBe(3000); // 15000 - 10000 - 2000
  });

  it('no Part V when standard mileage and totalMiles = 0', () => {
    const result = calculateVehicleDetailed({
      method: 'standard_mileage',
      businessMiles: 10000,
      // totalMiles not set → 0
    });
    expect(result.form4562PartV).toBeUndefined();
  });

  it('Part V with legacy actual expenses path', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 8000,
      totalMiles: 20000,
      actualExpenses: 10000, // Legacy path
      writtenEvidence: true,
      hasAnotherVehicle: true,
    });
    expect(result.form4562PartV).toBeDefined();
    expect(result.form4562PartV!.totalMiles).toBe(20000);
    expect(result.form4562PartV!.businessMiles).toBe(8000);
    expect(result.form4562PartV!.writtenEvidence).toBe(true);
    expect(result.form4562PartV!.hasAnotherVehicle).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
// 4. Validation warnings
// ═════════════════════════════════════════════════════════════

describe('Validation warnings', () => {
  it('writtenEvidence: false → warning emitted', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 15000,
      totalMiles: 20000,
      gas: 3000,
      writtenEvidence: false,
    });
    expect(result.warnings).toBeDefined();
    expect(result.warnings).toContain(
      'IRS requires written records to substantiate business use (IRC §274(d))',
    );
  });

  it('writtenEvidence: undefined → no warning (not explicitly false)', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 15000,
      totalMiles: 20000,
      gas: 3000,
      // writtenEvidence not set
    });
    const hasSubstantiationWarning = (result.warnings || []).some(
      (w) => w.includes('written records'),
    );
    expect(hasSubstantiationWarning).toBe(false);
  });

  it('businessUsePercentage ≤ 50% and actual method → warning emitted', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 20000,
      gas: 3000,
    });
    expect(result.warnings).toBeDefined();
    expect(result.warnings).toContain(
      'Business use ≤50%: limited to straight-line depreciation; no bonus depreciation (IRC §280F(b)(1))',
    );
  });

  it('businessUsePercentage > 50% → no straight-line warning', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 15000,
      totalMiles: 20000,
      gas: 3000,
    });
    const hasStraightLineWarning = (result.warnings || []).some(
      (w) => w.includes('straight-line'),
    );
    expect(hasStraightLineWarning).toBe(false);
  });

  it('commuteMiles > 0 with 0 business miles → commute warning', () => {
    // This hits the early return since businessMiles = 0
    // Warnings are only built in the actual method path with valid miles
    // So we need a standard_mileage scenario to test this
    const result = calculateVehicleDetailed({
      method: 'standard_mileage',
      businessMiles: 0,
      totalMiles: 10000,
      commuteMiles: 5000,
    });
    expect(result.warnings).toBeDefined();
    expect(result.warnings).toContain(
      'Commuting expenses are not deductible (IRC §162)',
    );
  });

  it('no warnings when everything is compliant', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 15000,
      totalMiles: 20000,
      gas: 3000,
      writtenEvidence: true,
    });
    expect(result.warnings).toBeUndefined();
  });

  it('multiple warnings can be emitted simultaneously', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 10000,
      totalMiles: 20000,
      gas: 3000,
      writtenEvidence: false,
    });
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThanOrEqual(2);
    expect(result.warnings).toContain(
      'IRS requires written records to substantiate business use (IRC §274(d))',
    );
    expect(result.warnings).toContain(
      'Business use ≤50%: limited to straight-line depreciation; no bonus depreciation (IRC §280F(b)(1))',
    );
  });
});

// ═════════════════════════════════════════════════════════════
// 5. Backward compatibility
// ═════════════════════════════════════════════════════════════

describe('Backward compatibility — no VehicleInfo Part V fields', () => {
  it('existing vehicle with no Part V fields → still works', () => {
    const result = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 35000,
      dateInService: '2025-01-01',
      gas: 3000,
    });
    expect(result.totalDeduction).toBeGreaterThan(0);
    expect(result.depreciationAllowed).toBeGreaterThan(0);
    // Part V is populated with defaults
    expect(result.form4562PartV).toBeDefined();
    expect(result.form4562PartV!.totalMiles).toBe(20000);
    expect(result.form4562PartV!.businessMiles).toBe(20000);
  });

  it('existing calculateVehicleDeduction wrapper still returns correct number', () => {
    const simple = calculateVehicleDeduction({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 35000,
      dateInService: '2025-01-01',
    });
    const detailed = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 35000,
      dateInService: '2025-01-01',
    });
    expect(simple).toBe(detailed.totalDeduction);
  });

  it('priorDepreciation defaults to 0 when not provided', () => {
    const withoutPrior = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 30000,
      dateInService: '2025-01-01',
      vehicleWeight: 7000,
    });
    const withZeroPrior = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 20000,
      totalMiles: 20000,
      vehicleCost: 30000,
      priorDepreciation: 0,
      dateInService: '2025-01-01',
      vehicleWeight: 7000,
    });
    expect(withoutPrior.depreciationAllowed).toBe(withZeroPrior.depreciationAllowed);
  });

  it('depreciationMethod field present in result', () => {
    const macrsResult = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 15000,
      totalMiles: 20000,
      vehicleCost: 30000,
      dateInService: '2025-01-01',
    });
    expect(macrsResult.depreciationMethod).toBe('macrs_200db');

    const slResult = calculateVehicleDetailed({
      method: 'actual',
      businessMiles: 8000,
      totalMiles: 20000,
      vehicleCost: 30000,
      dateInService: '2025-01-01',
    });
    expect(slResult.depreciationMethod).toBe('straight_line');
  });
});
