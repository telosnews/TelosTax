import { FilingStatus, TaxBracket, BracketDetail, CalculationTrace } from '../types/index.js';
import { TAX_BRACKETS_2025 } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate progressive federal income tax for a given taxable income and filing status.
 * Returns both the total tax and a breakdown by bracket.
 *
 * @authority
 *   IRC: Section 1(a)-(d), (j) — tax rate tables by filing status
 *   Rev. Proc: 2024-40, Section 3.01 — inflation-adjusted bracket thresholds
 *   Form: Form 1040, Line 16
 * @scope Progressive tax bracket computation
 * @limitations None
 */
export function calculateProgressiveTax(
  taxableIncome: number,
  filingStatus: FilingStatus,
): { tax: number; brackets: BracketDetail[]; marginalRate: number } {
  const brackets = TAX_BRACKETS_2025[filingStatus];
  if (!brackets) {
    throw new Error(`Unknown filing status: ${filingStatus}`);
  }

  const income = Math.max(0, taxableIncome);
  const details: BracketDetail[] = [];
  let totalTax = 0;
  let marginalRate = 0;

  for (const bracket of brackets) {
    if (income <= bracket.min) break;

    const taxableAtRate = Math.min(income, bracket.max) - bracket.min;
    const taxAtRate = round2(taxableAtRate * bracket.rate);

    details.push({
      rate: bracket.rate,
      taxableAtRate,
      taxAtRate,
    });

    totalTax += taxAtRate;
    marginalRate = bracket.rate;
  }

  return {
    tax: round2(totalTax),
    brackets: details,
    marginalRate,
  };
}

/**
 * Get the marginal tax rate for a given taxable income.
 *
 * @authority
 *   IRC: Section 1(a)-(d), (j) — tax rate tables by filing status
 *   Rev. Proc: 2024-40, Section 3.01 — inflation-adjusted bracket thresholds
 *   Form: Form 1040, Line 16
 * @scope Progressive tax bracket computation
 * @limitations None
 */
export function getMarginalRate(taxableIncome: number, filingStatus: FilingStatus): number {
  const brackets = TAX_BRACKETS_2025[filingStatus];
  const income = Math.max(0, taxableIncome);

  for (let i = brackets.length - 1; i >= 0; i--) {
    if (income > brackets[i].min) return brackets[i].rate;
  }
  return brackets[0].rate;
}

/**
 * Calculate progressive tax with a trace tree for each bracket.
 * Used when tracing is enabled to provide per-bracket audit trail.
 *
 * Inspired by IRS Direct File Fact Graph's StepwiseMultiply CompNode.
 */
export function traceProgressiveTax(
  taxableIncome: number,
  filingStatus: FilingStatus,
): { tax: number; brackets: BracketDetail[]; marginalRate: number; traces: CalculationTrace[] } {
  const result = calculateProgressiveTax(taxableIncome, filingStatus);
  const bracketTraces: CalculationTrace[] = result.brackets
    .filter((b) => b.taxAtRate > 0)
    .map((b) => ({
      lineId: `bracket.${(b.rate * 100).toFixed(0)}pct`,
      label: `${(b.rate * 100).toFixed(0)}% bracket`,
      value: b.taxAtRate,
      formula: `$${b.taxableAtRate.toLocaleString()} × ${(b.rate * 100).toFixed(0)}%`,
      authority: 'IRC §1(a)-(d)',
      inputs: [
        { lineId: 'bracket.taxableAtRate', label: `Income taxed at ${(b.rate * 100).toFixed(0)}%`, value: b.taxableAtRate },
      ],
    }));
  return { ...result, traces: bracketTraces };
}
