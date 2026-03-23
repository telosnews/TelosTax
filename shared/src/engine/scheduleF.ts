import { ScheduleFInfo, ScheduleFResult } from '../types/index.js';
import { SE_TAX } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Schedule F (Profit or Loss from Farming).
 *
 * Schedule F is structurally similar to Schedule C — farm income minus farm
 * expenses yields net farm profit (or loss). Net farm profit flows to:
 *   - Form 1040 total income (Schedule 1, Line 6)
 *   - Schedule SE for self-employment tax (same as Schedule C)
 *
 * Income categories (Part I — Farm Income, Cash Method):
 *   - Sales of livestock and other resale items (Line 1)
 *   - Cost or basis of items in Line 1 (Line 2, subtracted)
 *   - Sales of livestock, produce, grains, and other farm products you raised (Line 4)
 *   - Cooperative distributions (1099-PATR) (Line 5a/5b)
 *   - Agricultural program payments (Line 6a/6b)
 *   - CCC loans (Line 7a/7b)
 *   - Crop insurance proceeds (Line 8a/8b)
 *   - Custom hire (machine work) income (Line 9)
 *   - Other farm income (Line 10)
 *
 * Expenses (Part II — Farm Expenses):
 *   22 expense categories (Lines 12-32) matching Schedule F line items.
 *
 * @authority
 *   IRC: Section 61 — gross income defined (farm income is gross income)
 *   IRC: Section 162 — trade or business expenses (farm expenses deductible)
 *   IRC: Section 175 — soil and water conservation expenditures
 *   IRC: Section 180 — expenditures for fertilizer
 *   Form: Schedule F (Form 1040), Lines 1-36
 * @scope Cash method Schedule F computation (income − expenses = net profit/loss)
 * @limitations Does not model accrual method, commodity credit loans in detail,
 *   or Form 4562 depreciation
 */

/**
 * Calculate Schedule F (Profit or Loss from Farming).
 *
 * @param info - Farm income and expense detail
 * @returns ScheduleFResult with gross income, total expenses, and net farm profit/loss
 */
export function calculateScheduleF(info: ScheduleFInfo): ScheduleFResult {
  // ─── Part I: Farm Income ────────────────────────────────
  // Line 3: Gross income from sales of livestock (Line 1 − Line 2)
  const livestockSalesNet = round2(
    Math.max(0, (info.salesOfLivestock || 0)) - Math.max(0, (info.costOfLivestock || 0)),
  );

  const grossIncome = round2(
    livestockSalesNet +
    Math.max(0, info.salesOfProducts || 0) +
    Math.max(0, info.cooperativeDistributionsTaxable ?? info.cooperativeDistributions ?? 0) +
    Math.max(0, info.agriculturalProgramPayments || 0) +
    Math.max(0, info.cccLoans || 0) +
    Math.max(0, info.cropInsuranceProceeds || 0) +
    Math.max(0, info.customHireIncome || 0) +
    Math.max(0, info.otherFarmIncome || 0),
  );

  // ─── Part II: Farm Expenses ─────────────────────────────
  const totalExpenses = round2(
    Math.max(0, info.carAndTruck || 0) +
    Math.max(0, info.chemicals || 0) +
    Math.max(0, info.conservation || 0) +
    Math.max(0, info.customHireExpense || 0) +
    Math.max(0, info.depreciation || 0) +
    Math.max(0, info.employeeBenefit || 0) +
    Math.max(0, info.feed || 0) +
    Math.max(0, info.fertilizers || 0) +
    Math.max(0, info.freight || 0) +
    Math.max(0, info.gasolineFuel || 0) +
    Math.max(0, info.insurance || 0) +
    Math.max(0, info.interest || 0) +
    Math.max(0, info.labor || 0) +
    Math.max(0, info.pension || 0) +
    Math.max(0, info.rentLease || 0) +
    Math.max(0, info.repairs || 0) +
    Math.max(0, info.seeds || 0) +
    Math.max(0, info.storage || 0) +
    Math.max(0, info.supplies || 0) +
    Math.max(0, info.taxes || 0) +
    Math.max(0, info.utilities || 0) +
    Math.max(0, info.veterinary || 0) +
    Math.max(0, info.otherExpenses || 0),
  );

  // ─── Net Farm Profit (or Loss) ──────────────────────────
  // Line 36: Gross income − total expenses
  // Can be negative (farm loss deductible against other income)
  const netFarmProfit = round2(grossIncome - totalExpenses);

  // ─── Farm Optional Method (Schedule SE Part II §A) ─────
  // Allows reporting min(2/3 × gross farm income, $7,240) as net SE earnings.
  // Eligible when gross farm income ≤ $10,860 or net farm profit < $7,840.
  // Used to build Social Security credits even with low/negative farm income.
  let farmOptionalMethodAmount: number | undefined;
  if (info.useFarmOptionalMethod) {
    const twoThirdsGross = round2(Math.max(0, grossIncome) * (2 / 3));
    farmOptionalMethodAmount = round2(Math.min(twoThirdsGross, SE_TAX.FARM_OPTIONAL_METHOD_MAX));
  }

  return {
    grossIncome,
    totalExpenses,
    netFarmProfit,
    farmOptionalMethodAmount,
  };
}
