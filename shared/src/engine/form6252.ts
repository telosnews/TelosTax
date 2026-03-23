import { InstallmentSaleInfo, InstallmentSaleResult } from '../types/index.js';
import { round2 } from './utils.js';

/**
 * Calculate Form 6252 — Installment Sale Income.
 *
 * The installment method defers gain recognition to the years payments
 * are received. Each year's reportable income = payments × gross profit ratio.
 *
 * Depreciation recapture (§1245/§1250) is recognized in full in the year
 * of sale, reducing the capital gain portion available for installment deferral.
 *
 * @authority
 *   IRC §453 — Installment method
 *   IRC §453(d) — Election out of installment method
 *   IRC §453(e) — Related party rules
 *   Form: Form 6252
 * @scope Single-year installment income computation
 * @limitations No multi-year tracking across returns; no §453A interest charge
 *   on deferred tax for large installment sales (>$5M); no related party
 *   disposition rules.
 */
export function calculateForm6252(info: InstallmentSaleInfo): InstallmentSaleResult {
  const sellingPrice = Math.max(0, info.sellingPrice);
  const mortgagesAssumed = Math.max(0, info.mortgagesAssumedByBuyer || 0);
  const basis = Math.max(0, info.costOrBasis);
  const depreciation = Math.max(0, info.depreciationAllowed || 0);
  const expenses = Math.max(0, info.sellingExpenses || 0);
  const payments = Math.max(0, info.paymentsReceivedThisYear);

  // Line 5: Contract price = selling price - mortgages assumed (but not below 0)
  const contractPrice = round2(Math.max(0, sellingPrice - mortgagesAssumed));

  // Line 6: Gross profit = selling price - adjusted basis - selling expenses
  const adjustedBasis = round2(basis - depreciation);
  const grossProfit = round2(Math.max(0, sellingPrice - adjustedBasis - expenses));

  // Line 7: Gross profit ratio (percentage)
  const grossProfitRatio = contractPrice > 0 ? round2(grossProfit / contractPrice) : 0;

  // Depreciation recapture — reported in full in year of sale (not deferred)
  const ordinaryIncomeRecapture = round2(depreciation);

  // Line 8: Installment sale income = payments × gross profit ratio
  const installmentSaleIncome = round2(payments * Math.min(1, grossProfitRatio));

  return {
    contractPrice,
    grossProfit,
    grossProfitRatio,
    ordinaryIncomeRecapture,
    installmentSaleIncome,
    totalReportableIncome: installmentSaleIncome,
  };
}
