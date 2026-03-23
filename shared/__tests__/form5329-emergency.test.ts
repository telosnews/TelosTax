import { describe, it, expect } from 'vitest';
import { calculateForm5329 } from '../src/engine/form5329.js';

describe('Form 5329 — Enhanced with SECURE 2.0 Emergency Distribution', () => {
  describe('Excess contribution penalties (backward compatibility)', () => {
    it('calculates 6% IRA excess penalty', () => {
      const result = calculateForm5329({ iraExcessContribution: 2000 });
      expect(result.iraExciseTax).toBe(120);
      expect(result.hsaExciseTax).toBe(0);
      expect(result.earlyDistributionPenalty).toBe(0);
      expect(result.emergencyExemption).toBe(0);
      expect(result.totalPenalty).toBe(120);
    });

    it('calculates 6% HSA excess penalty', () => {
      const result = calculateForm5329({ hsaExcessContribution: 500 });
      expect(result.hsaExciseTax).toBe(30);
      expect(result.totalPenalty).toBe(30);
    });

    it('calculates combined IRA + HSA excess', () => {
      const result = calculateForm5329({
        iraExcessContribution: 1000,
        hsaExcessContribution: 500,
      });
      expect(result.iraExciseTax).toBe(60);
      expect(result.hsaExciseTax).toBe(30);
      expect(result.totalPenalty).toBe(90);
    });

    it('returns zero for no excess', () => {
      const result = calculateForm5329({});
      expect(result.totalPenalty).toBe(0);
    });
  });

  describe('Coverdell ESA excess contribution penalties', () => {
    it('calculates 6% ESA excess penalty', () => {
      const result = calculateForm5329({ esaExcessContribution: 500 });
      expect(result.esaExciseTax).toBe(30);
      expect(result.totalPenalty).toBe(30);
    });

    it('calculates combined IRA + HSA + ESA excess', () => {
      const result = calculateForm5329({
        iraExcessContribution: 1000,
        hsaExcessContribution: 500,
        esaExcessContribution: 300,
      });
      expect(result.iraExciseTax).toBe(60);
      expect(result.hsaExciseTax).toBe(30);
      expect(result.esaExciseTax).toBe(18);
      expect(result.totalPenalty).toBe(108);
    });

    it('returns zero ESA penalty when no ESA excess', () => {
      const result = calculateForm5329({ iraExcessContribution: 1000 });
      expect(result.esaExciseTax).toBe(0);
    });
  });

  describe('Early distribution penalty (10%)', () => {
    it('calculates 10% penalty on code 1 distributions', () => {
      const result = calculateForm5329({}, [
        { id: '1', payerName: 'Fidelity', grossDistribution: 10000, taxableAmount: 10000, distributionCode: '1' },
      ]);
      expect(result.earlyDistributionPenalty).toBe(1000);
      expect(result.totalPenalty).toBe(1000);
    });

    it('ignores code 7 (normal distribution)', () => {
      const result = calculateForm5329({}, [
        { id: '1', payerName: 'Fidelity', grossDistribution: 10000, taxableAmount: 10000, distributionCode: '7' },
      ]);
      expect(result.earlyDistributionPenalty).toBe(0);
    });

    it('ignores code 2 (early with exception)', () => {
      const result = calculateForm5329({}, [
        { id: '1', payerName: 'Fidelity', grossDistribution: 5000, taxableAmount: 5000, distributionCode: '2' },
      ]);
      expect(result.earlyDistributionPenalty).toBe(0);
    });

    it('calculates penalty on multiple code 1 distributions', () => {
      const result = calculateForm5329({}, [
        { id: '1', payerName: 'Fidelity', grossDistribution: 5000, taxableAmount: 5000, distributionCode: '1' },
        { id: '2', payerName: 'Vanguard', grossDistribution: 3000, taxableAmount: 3000, distributionCode: '1' },
      ]);
      expect(result.earlyDistributionPenalty).toBe(800); // 10% of $8,000
    });
  });

  describe('SECURE 2.0 Emergency Distribution Exemption — IRC §72(t)(2)(I)', () => {
    it('exempts up to $1,000 from early distribution penalty', () => {
      const result = calculateForm5329(
        {},
        [{ id: '1', payerName: 'Fidelity', grossDistribution: 5000, taxableAmount: 5000, distributionCode: '1' }],
        { totalEmergencyDistributions: 1000 },
      );
      // Penalty on $5,000 - $1,000 exemption = $4,000 * 10% = $400
      expect(result.emergencyExemption).toBe(1000);
      expect(result.earlyDistributionPenalty).toBe(400);
      expect(result.totalPenalty).toBe(400);
    });

    it('caps emergency exemption at $1,000 annual limit', () => {
      const result = calculateForm5329(
        {},
        [{ id: '1', payerName: 'Fidelity', grossDistribution: 5000, taxableAmount: 5000, distributionCode: '1' }],
        { totalEmergencyDistributions: 3000 },
      );
      // Can only exempt $1,000 regardless of emergency amount claimed
      expect(result.emergencyExemption).toBe(1000);
      expect(result.earlyDistributionPenalty).toBe(400);
    });

    it('caps emergency exemption at actual early distributions', () => {
      const result = calculateForm5329(
        {},
        [{ id: '1', payerName: 'Fidelity', grossDistribution: 500, taxableAmount: 500, distributionCode: '1' }],
        { totalEmergencyDistributions: 1000 },
      );
      // Only $500 of early distributions, so only $500 can be exempted
      expect(result.emergencyExemption).toBe(500);
      expect(result.earlyDistributionPenalty).toBe(0);
      expect(result.totalPenalty).toBe(0);
    });

    it('exemption has no effect when no early distributions', () => {
      const result = calculateForm5329(
        {},
        [{ id: '1', payerName: 'Fidelity', grossDistribution: 5000, taxableAmount: 5000, distributionCode: '7' }],
        { totalEmergencyDistributions: 1000 },
      );
      expect(result.emergencyExemption).toBe(0);
      expect(result.earlyDistributionPenalty).toBe(0);
    });

    it('combines emergency exemption with excess contribution penalties', () => {
      const result = calculateForm5329(
        { iraExcessContribution: 2000 },
        [{ id: '1', payerName: 'Fidelity', grossDistribution: 3000, taxableAmount: 3000, distributionCode: '1' }],
        { totalEmergencyDistributions: 1000 },
      );
      // IRA excess: $2,000 * 6% = $120
      // Early dist: $3,000 - $1,000 exemption = $2,000 * 10% = $200
      expect(result.iraExciseTax).toBe(120);
      expect(result.emergencyExemption).toBe(1000);
      expect(result.earlyDistributionPenalty).toBe(200);
      expect(result.totalPenalty).toBe(320);
    });

    it('handles zero emergency distributions', () => {
      const result = calculateForm5329(
        {},
        [{ id: '1', payerName: 'Fidelity', grossDistribution: 5000, taxableAmount: 5000, distributionCode: '1' }],
        { totalEmergencyDistributions: 0 },
      );
      expect(result.emergencyExemption).toBe(0);
      expect(result.earlyDistributionPenalty).toBe(500);
    });

    it('handles no 1099-R data with emergency distributions', () => {
      const result = calculateForm5329(
        {},
        undefined,
        { totalEmergencyDistributions: 1000 },
      );
      expect(result.emergencyExemption).toBe(0);
      expect(result.earlyDistributionPenalty).toBe(0);
    });
  });
});
