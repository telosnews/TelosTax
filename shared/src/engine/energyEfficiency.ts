import { EnergyEfficiencyInfo, EnergyEfficiencyResult } from '../types/index.js';
import { ENERGY_EFFICIENCY } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Energy Efficient Home Improvement Credit (Form 5695, Part II).
 *
 * 30% credit on qualifying energy efficiency improvements, subject to annual limits:
 *
 * Category A — Heat pump items ($2,000 annual limit):
 *   - Heat pumps (space heating/cooling)
 *   - Heat pump water heaters
 *   - Biomass stoves and boilers
 *
 * Category B — Non-heat-pump items ($1,200 annual limit, with sub-limits):
 *   - Central air conditioning
 *   - Non-HP water heaters (gas, oil, propane)
 *   - Furnaces/boilers (gas, propane, oil)
 *   - Insulation and air sealing materials
 *   - Windows/skylights ($600 limit)
 *   - Doors ($500 limit)
 *   - Electrical panel upgrades ($600 limit)
 *   - Home energy audits ($150 limit)
 *
 * Overall aggregate annual limit: $3,200
 * (i.e. up to $2,000 from heat pump + up to $1,200 from non-HP = $3,200 max)
 *
 * @authority
 *   IRC: Section 25C — energy efficient home improvement credit
 *   IRA: Section 13301 — extension, increase, and modifications of nonbusiness energy property credit
 *   Form: Form 5695, Part II
 * @scope Energy efficient home improvement credit with annual limits
 * @limitations None
 */
export function calculateEnergyEfficiencyCredit(info: EnergyEfficiencyInfo): EnergyEfficiencyResult {
  const zero: EnergyEfficiencyResult = { totalExpenditures: 0, credit: 0 };

  if (!info) return zero;

  const c = ENERGY_EFFICIENCY;

  // Category A: Heat pump items — $2,000 annual limit
  const heatPumpExpenses = Math.max(0, info.heatPump || 0);
  const heatPumpCredit = round2(Math.min(heatPumpExpenses * c.RATE, c.HEAT_PUMP_ANNUAL_LIMIT));

  // Category B: Non-heat-pump items — $1,200 annual limit with sub-limits
  // Apply individual sub-limits first
  const windowsExpense = Math.max(0, info.windows || 0);
  const windowsCredit = round2(Math.min(windowsExpense * c.RATE, c.WINDOWS_LIMIT));

  const doorsExpense = Math.max(0, info.doors || 0);
  const doorsCredit = round2(Math.min(doorsExpense * c.RATE, c.DOORS_LIMIT));

  const electricalExpense = Math.max(0, info.electricalPanel || 0);
  const electricalCredit = round2(Math.min(electricalExpense * c.RATE, c.ELECTRICAL_PANEL_LIMIT));

  const auditExpense = Math.max(0, info.homeEnergyAudit || 0);
  const auditCredit = round2(Math.min(auditExpense * c.RATE, c.HOME_ENERGY_AUDIT_LIMIT));

  // Uncapped non-HP items (30% credit, no individual sub-limit within category B)
  const centralACExpense = Math.max(0, info.centralAC || 0);
  const waterHeaterExpense = Math.max(0, info.waterHeater || 0);
  const furnaceExpense = Math.max(0, info.furnaceBoiler || 0);
  const insulationExpense = Math.max(0, info.insulation || 0);
  const uncappedNonHPCredit = round2(
    (centralACExpense + waterHeaterExpense + furnaceExpense + insulationExpense) * c.RATE,
  );

  // Total non-HP credit, subject to aggregate $1,200 non-HP limit
  const totalNonHPCredit = round2(Math.min(
    windowsCredit + doorsCredit + electricalCredit + auditCredit + uncappedNonHPCredit,
    c.NON_HP_ANNUAL_LIMIT,
  ));

  // Overall aggregate annual limit: $3,200
  const totalCredit = round2(Math.min(heatPumpCredit + totalNonHPCredit, c.AGGREGATE_ANNUAL_LIMIT));

  // Total expenditures (before limits, for informational display)
  const totalExpenditures = round2(
    heatPumpExpenses + windowsExpense + doorsExpense + electricalExpense +
    auditExpense + centralACExpense + waterHeaterExpense + furnaceExpense + insulationExpense,
  );

  if (totalCredit <= 0) return zero;

  return {
    totalExpenditures,
    credit: totalCredit,
  };
}
