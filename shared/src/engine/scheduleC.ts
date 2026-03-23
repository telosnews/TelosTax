import { TaxReturn, ScheduleCResult, ScheduleCBusinessResult, CostOfGoodsSold, BusinessInfo } from '../types/index.js';
import { calculateHomeOfficeDeduction, calculateHomeOfficeDetailed } from './homeOffice.js';
import { calculateVehicleDetailed } from './vehicle.js';
import { calculateForm4562 } from './form4562.js';
import { round2 } from './utils.js';

/**
 * Calculate Schedule C (Profit or Loss from Business).
 * Full Lines 1-31 pipeline including gross receipts, returns & allowances,
 * cost of goods sold, and tiered meals limitation (50%/80%/100%).
 *
 * Supports multiple businesses (Sprint 15+). When multiple businesses are
 * defined, expenses are routed by businessId and per-business results are
 * included. Home office and vehicle deductions are applied once at the
 * aggregate level (not per-business).
 *
 * Backward compatibility: If `businesses` is empty but `business` is defined,
 * the single business is treated as a one-element array. Old data without
 * COGS, returns & allowances, or meals split continues to work unchanged.
 *
 * @authority
 *   IRC: Section 162 — trade or business expenses
 *   IRC: Section 274(n)(1) — 50% limitation on meal expenses (standard)
 *   IRC: Section 274(n)(3) — 80% limitation for DOT hours-of-service workers
 *   IRC: Section 280A(c) — home office deduction
 *   IRC: Section 274(d) — substantiation for vehicle expenses
 *   Form: Schedule C (Form 1040), Lines 1-31 + Part III (COGS)
 *   Pub: Publication 334 — Tax Guide for Small Business
 *   Pub: Publication 463 — Travel, Gift, and Car Expenses (meals limitation)
 * @scope Business profit/loss with home office, vehicle, and Form 4562 depreciation deductions
 */
export function calculateScheduleC(taxReturn: TaxReturn): ScheduleCResult {
  // ─── Schedule C Lines 1-7: Gross Income Pipeline ─────────

  // Line 1: Gross receipts — sum of all 1099-NEC and 1099-K gross amounts
  const necIncome = taxReturn.income1099NEC.reduce((sum, i) => sum + (i.amount || 0), 0);
  const kIncome = taxReturn.income1099K.reduce((sum, i) => sum + (i.grossAmount || 0), 0);
  const grossReceipts = round2(necIncome + kIncome);

  // Line 2: Returns and allowances — 1099-K adjustments + direct returns/allowances
  const kAdjustments = taxReturn.income1099K.reduce(
    (sum, i) => sum + (i.returnsAndAllowances || 0), 0,
  );
  const returnsAndAllowances = round2(kAdjustments + (taxReturn.returnsAndAllowances || 0));

  // Line 3: Net receipts
  const netReceipts = round2(grossReceipts - returnsAndAllowances);

  // Line 4: Cost of goods sold (Part III)
  const costOfGoodsSold = computeCOGS(taxReturn.costOfGoodsSold);

  // Line 5: Gross profit
  const grossProfit = round2(netReceipts - costOfGoodsSold);

  // Line 6: Other business income (placeholder for future — barter, scrap, etc.)
  const otherBusinessIncome = 0;

  // Line 7: Gross income
  const grossIncome = round2(grossProfit + otherBusinessIncome);

  // ─── Lines 8-27: Expenses ───────────────────────────────
  const lineItems: Record<string, number> = {};
  let totalExpenses = 0;

  // When a vehicle object with a method is present, the vehicle deduction
  // (computed separately below) subsumes Line 9 (car/truck expenses).
  // Suppress Line 9 expense entries to prevent double-counting.
  const hasVehicleMethod = taxReturn.vehicle?.method != null;
  let suppressedLine9Amount = 0;

  // When depreciation assets are present, the Form 4562 computation
  // (computed separately below) subsumes Line 13 (depreciation).
  // Suppress Line 13 expense entries to prevent double-counting.
  const hasDepreciationAssets = (taxReturn.depreciationAssets?.length || 0) > 0;
  let suppressedLine13Amount = 0;

  // Line 19 (Pension & Profit-Sharing Plans) is only for contributions to
  // plans for COMMON-LAW EMPLOYEES — not the owner. A sole proprietor's own
  // retirement contributions (SEP-IRA, Solo 401(k), SIMPLE IRA) deduct on
  // Schedule 1 Line 16, not Schedule C Line 19 (IRS Publication 560).
  //
  // Suppress Line 19 when the filer has no employees (no Line 26 wages) to
  // prevent double-deduction with Schedule 1 Line 16.
  const hasEmployeeWages = taxReturn.expenses.some(e => e.scheduleCLine === 26 && (e.amount || 0) > 0);
  let suppressedLine19Amount = 0;

  for (const expense of taxReturn.expenses) {
    const line = expense.scheduleCLine;
    const amount = expense.amount || 0;
    const category = expense.category || '';

    // Line 24 — Travel & Meals split with meal limitation tiers (IRC §274(n))
    //   meals      → 50% (standard business meals — IRC §274(n)(1))
    //   meals_dot  → 80% (DOT hours-of-service workers — IRC §274(n)(3))
    //   meals_full → 100% (employer convenience, recreational, sold to customers)
    if (line === 24) {
      if (category === 'meals') {
        // Line 24b: Standard meals — deductible at 50%
        const deductibleMeals = round2(amount * 0.5);
        lineItems['24b'] = round2((lineItems['24b'] || 0) + deductibleMeals);
        totalExpenses += deductibleMeals;
      } else if (category === 'meals_dot') {
        // Line 24b: DOT hours-of-service meals — deductible at 80% (IRC §274(n)(3))
        const deductibleMeals = round2(amount * 0.8);
        lineItems['24b'] = round2((lineItems['24b'] || 0) + deductibleMeals);
        totalExpenses += deductibleMeals;
      } else if (category === 'meals_full') {
        // Line 24b: Fully deductible meals — 100% (employer convenience, recreational, etc.)
        lineItems['24b'] = round2((lineItems['24b'] || 0) + amount);
        totalExpenses += amount;
      } else if (category === 'travel') {
        // Line 24a: Travel — 100% deductible
        lineItems['24a'] = round2((lineItems['24a'] || 0) + amount);
        totalExpenses += amount;
      } else {
        // Legacy 'travel_meals' or unknown — treat as travel (100% deductible)
        // for backward compatibility with existing data
        lineItems['24a'] = round2((lineItems['24a'] || 0) + amount);
        totalExpenses += amount;
      }
    } else if (line === 16) {
      // Line 16 — Interest split (16a mortgage / 16b other)
      if (category === 'interest_mortgage') {
        lineItems['16a'] = round2((lineItems['16a'] || 0) + amount);
      } else if (category === 'interest_other') {
        lineItems['16b'] = round2((lineItems['16b'] || 0) + amount);
      } else {
        // Legacy 'interest' or unknown — default to 16b (other interest)
        lineItems['16b'] = round2((lineItems['16b'] || 0) + amount);
      }
      totalExpenses += amount;
    } else if (line === 20) {
      // Line 20 — Rent/Lease split (20a equipment / 20b property)
      if (category === 'rent_equipment') {
        lineItems['20a'] = round2((lineItems['20a'] || 0) + amount);
      } else if (category === 'rent_property') {
        lineItems['20b'] = round2((lineItems['20b'] || 0) + amount);
      } else {
        // Legacy 'rent_lease' or unknown — default to 20b (other business property)
        lineItems['20b'] = round2((lineItems['20b'] || 0) + amount);
      }
      totalExpenses += amount;
    } else if (line === 9 && hasVehicleMethod) {
      // Suppress Line 9 (car/truck) — vehicle deduction covers these costs.
      suppressedLine9Amount += amount;
    } else if (line === 13 && hasDepreciationAssets) {
      // Suppress Line 13 (depreciation) — Form 4562 asset registry covers this.
      suppressedLine13Amount += amount;
    } else if (line === 19 && !hasEmployeeWages) {
      // Suppress Line 19 (pension/profit-sharing) — owner's retirement contributions
      // belong on Schedule 1 Line 16, not Schedule C. Only allow when employees exist.
      suppressedLine19Amount += amount;
    } else {
      const key = String(line);
      lineItems[key] = round2((lineItems[key] || 0) + amount);
      totalExpenses += amount;
    }
  }
  totalExpenses = round2(totalExpenses);
  suppressedLine9Amount = round2(suppressedLine9Amount);
  const line9Suppressed = suppressedLine9Amount > 0;
  suppressedLine13Amount = round2(suppressedLine13Amount);
  const line13Suppressed = suppressedLine13Amount > 0;
  suppressedLine19Amount = round2(suppressedLine19Amount);
  const line19Suppressed = suppressedLine19Amount > 0;

  // ─── Tentative profit (before home office) ──────────────
  const tentativeProfit = round2(grossIncome - totalExpenses);

  // ─── Form 4562 depreciation (Line 13) ──────────────────
  const form4562Result = hasDepreciationAssets
    ? calculateForm4562(taxReturn.depreciationAssets!, tentativeProfit)
    : undefined;
  const depreciationDeduction = form4562Result?.totalDepreciation || 0;

  // ─── Home office deduction (Form 8829) ──────────────────
  const homeOfficeResult = taxReturn.homeOffice
    ? calculateHomeOfficeDetailed(taxReturn.homeOffice, tentativeProfit)
    : undefined;
  const homeOfficeDeduction = homeOfficeResult?.totalDeduction || 0;

  // ─── Vehicle deduction (Schedule C Line 9 / Form 4562) ──
  const vehicleResult = taxReturn.vehicle
    ? calculateVehicleDetailed(taxReturn.vehicle)
    : undefined;
  const vehicleDeduction = vehicleResult?.totalDeduction || 0;

  // ─── Net profit (loss) — Line 31 ───────────────────────
  const netProfit = round2(tentativeProfit - depreciationDeduction - homeOfficeDeduction - vehicleDeduction);

  // ─── Multi-business breakdown ───────────────────────────
  // Resolve business list: use `businesses` array, falling back to single `business`
  const businesses = (taxReturn.businesses && taxReturn.businesses.length > 0)
    ? taxReturn.businesses
    : (taxReturn.business ? [taxReturn.business] : []);

  let businessResults: ScheduleCBusinessResult[] | undefined;

  if (businesses.length > 1) {
    // Route income to businesses by businessId on 1099-NEC and 1099-K items
    const bizIncomeMap = computePerBusinessIncome(taxReturn, businesses, grossIncome);
    const anyAssigned = [...bizIncomeMap.values()].some(v => v > 0);

    // Compute per-business expenses (with tiered meals limitation)
    businessResults = businesses.map(biz => {
      const bizExpenses = taxReturn.expenses
        .filter(e => e.businessId === biz.id)
        .reduce((sum, e) => {
          if (e.scheduleCLine === 9 && hasVehicleMethod) {
            return sum; // Suppress Line 9 — vehicle deduction covers this
          }
          if (e.scheduleCLine === 13 && hasDepreciationAssets) {
            return sum; // Suppress Line 13 — Form 4562 asset registry covers this
          }
          if (e.scheduleCLine === 19 && !hasEmployeeWages) {
            return sum; // Suppress Line 19 — owner retirement goes on Schedule 1 Line 16
          }
          if (e.scheduleCLine === 24 && e.category === 'meals') {
            return sum + round2((e.amount || 0) * 0.5);   // 50% standard
          }
          if (e.scheduleCLine === 24 && e.category === 'meals_dot') {
            return sum + round2((e.amount || 0) * 0.8);   // 80% DOT
          }
          // meals_full (100%) falls through to default
          return sum + (e.amount || 0);
        }, 0);

      const bizGross = anyAssigned ? (bizIncomeMap.get(biz.id) || 0) : 0;

      return {
        businessId: biz.id,
        businessName: biz.businessName,
        grossIncome: round2(bizGross),
        totalExpenses: round2(bizExpenses),
        netProfit: round2(bizGross - bizExpenses),
      };
    });

    // If no income was assigned to any business via businessId, fall back to
    // expense-ratio heuristic for backward compatibility with pre-routing data
    if (!anyAssigned) {
      const totalBizExpenses = businessResults.reduce((s, b) => s + b.totalExpenses, 0);
      if (totalBizExpenses > 0) {
        businessResults = businessResults.map(biz => ({
          ...biz,
          grossIncome: round2(grossIncome * (biz.totalExpenses / totalBizExpenses)),
          netProfit: round2(grossIncome * (biz.totalExpenses / totalBizExpenses) - biz.totalExpenses),
        }));
      } else {
        // All expenses are zero — split gross equally
        const share = round2(grossIncome / businesses.length);
        businessResults = businessResults.map(biz => ({
          ...biz,
          grossIncome: share,
          netProfit: share,
        }));
      }
    }
  }

  return {
    grossReceipts,
    returnsAndAllowances,
    netReceipts,
    costOfGoodsSold,
    grossProfit,
    otherBusinessIncome,
    grossIncome,
    totalExpenses,
    tentativeProfit,
    homeOfficeDeduction,
    vehicleDeduction,
    netProfit,
    lineItems,
    businessResults,
    homeOfficeResult,
    vehicleResult,
    ...(depreciationDeduction > 0 ? { depreciationDeduction } : {}),
    ...(form4562Result ? { form4562Result } : {}),
    ...(line9Suppressed ? { line9Suppressed, suppressedLine9Amount } : {}),
    ...(line13Suppressed ? { line13Suppressed, suppressedLine13Amount } : {}),
    ...(line19Suppressed ? { line19Suppressed, suppressedLine19Amount } : {}),
  };
}

/**
 * Route 1099-NEC and 1099-K income to specific businesses by businessId.
 * Unassigned income (no businessId) is distributed proportionally among businesses
 * based on their share of assigned income.
 *
 * @returns Map of businessId → gross income for that business
 */
function computePerBusinessIncome(
  taxReturn: TaxReturn,
  businesses: BusinessInfo[],
  aggregateGrossIncome: number,
): Map<string, number> {
  const bizIncome = new Map<string, number>();
  for (const biz of businesses) {
    bizIncome.set(biz.id, 0);
  }

  let assignedTotal = 0;

  // Route 1099-NEC by businessId
  for (const nec of taxReturn.income1099NEC) {
    if (nec.businessId && bizIncome.has(nec.businessId)) {
      bizIncome.set(nec.businessId, round2((bizIncome.get(nec.businessId) || 0) + (nec.amount || 0)));
      assignedTotal += (nec.amount || 0);
    }
  }

  // Route 1099-K by businessId (net of returns & allowances)
  for (const k of taxReturn.income1099K) {
    if (k.businessId && bizIncome.has(k.businessId)) {
      const netK = (k.grossAmount || 0) - (k.returnsAndAllowances || 0);
      bizIncome.set(k.businessId, round2((bizIncome.get(k.businessId) || 0) + netK));
      assignedTotal += netK;
    }
  }

  assignedTotal = round2(assignedTotal);

  // Distribute unassigned income proportionally by assigned income shares
  const unassigned = round2(aggregateGrossIncome - assignedTotal);
  if (unassigned > 0 && assignedTotal > 0) {
    for (const [bizId, income] of bizIncome) {
      const share = round2(unassigned * (income / assignedTotal));
      bizIncome.set(bizId, round2(income + share));
    }
  }
  // If unassigned > 0 and assignedTotal === 0, leave all at 0 — caller falls back to expense-ratio

  return bizIncome;
}

/**
 * Compute Cost of Goods Sold — Schedule C Part III (Lines 35-42).
 *
 * Line 40 = beginningInventory + purchases + costOfLabor + materialsAndSupplies + otherCosts
 * Line 42 = Line 40 - endingInventory (COGS, floored at 0)
 *
 * @authority
 *   Form: Schedule C Part III
 *   Pub: Publication 334 — Chapter 6 (How to Figure Cost of Goods Sold)
 */
export function computeCOGS(cogs?: CostOfGoodsSold): number {
  if (!cogs) return 0;

  const line40 = round2(
    (cogs.beginningInventory || 0) +
    (cogs.purchases || 0) +
    (cogs.costOfLabor || 0) +
    (cogs.materialsAndSupplies || 0) +
    (cogs.otherCosts || 0),
  );

  const line42 = round2(line40 - (cogs.endingInventory || 0));

  // COGS cannot be negative — floor at 0
  return Math.max(0, line42);
}
