import { CleanEnergyInfo, CleanEnergyResult } from '../types/index.js';
import { CLEAN_ENERGY } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Residential Clean Energy Credit (Form 5695, Part I).
 *
 * The credit is 30% of qualifying clean energy expenditures:
 *   - Solar electric (photovoltaic) systems
 *   - Solar water heating systems
 *   - Small wind energy systems
 *   - Geothermal heat pump systems
 *   - Battery/energy storage (≥3 kWh capacity)
 *   - Fuel cell systems (capped at $500/0.5 kW)
 *
 * No maximum for solar, wind, geothermal, or battery.
 * Fuel cell credit is capped at $500 per 0.5 kW of capacity.
 *
 * This is a non-refundable credit. Unused credit can be carried forward
 * to future years. The carryforward is added to the current year credit
 * before applying the tax limitation (in the orchestrator).
 *
 * Available through tax year 2032 (26% in 2033, 22% in 2034).
 *
 * @authority
 *   IRC: Section 25D — residential clean energy credit
 *   IRC: Section 25D(c) — carryforward of unused credit
 *   IRA: Section 13302 — extension and modification of residential clean energy credit
 *   Form: Form 5695, Part I
 * @scope Residential clean energy credit (30% of qualified costs) with prior-year carryforward
 * @limitations Does not validate property eligibility or certification requirements
 */
export function calculateCleanEnergyCredit(info: CleanEnergyInfo): CleanEnergyResult {
  const zero: CleanEnergyResult = {
    totalExpenditures: 0,
    currentYearCredit: 0,
    priorYearCarryforward: 0,
    totalAvailableCredit: 0,
    credit: 0,
    carryforwardToNextYear: 0,
  };

  if (!info) return zero;

  const solar = Math.max(0, info.solarElectric || 0) + Math.max(0, info.solarWaterHeating || 0);
  const wind = Math.max(0, info.smallWindEnergy || 0);
  const geothermal = Math.max(0, info.geothermalHeatPump || 0);
  const battery = Math.max(0, info.batteryStorage || 0);

  // Fuel cell: capped at $500 per 0.5 kW of capacity
  let fuelCell = Math.max(0, info.fuelCell || 0);
  if (info.fuelCellKW && info.fuelCellKW > 0) {
    const fuelCellCap = round2((info.fuelCellKW / 0.5) * CLEAN_ENERGY.FUEL_CELL_CAP_PER_HALF_KW);
    fuelCell = Math.min(fuelCell, fuelCellCap);
  }

  const totalExpenditures = round2(solar + wind + geothermal + battery + fuelCell);

  // Current year credit = 30% of qualified expenditures
  const currentYearCredit = totalExpenditures > 0 ? round2(totalExpenditures * CLEAN_ENERGY.RATE) : 0;

  // Prior year carryforward — IRC §25D(c)
  const priorYearCarryforward = round2(Math.max(0, info.priorYearCarryforward || 0));

  // Total available = current year + carryforward
  const totalAvailableCredit = round2(currentYearCredit + priorYearCarryforward);

  if (totalAvailableCredit <= 0) return zero;

  // The credit is non-refundable and limited by tax liability.
  // The tax limitation is applied in the orchestrator (form1040.ts).
  // Here we report the total available; carryforwardToNextYear will be
  // computed after the orchestrator applies the tax limitation.
  // Initially, credit = totalAvailableCredit (full amount).
  // The orchestrator will reduce this and set carryforwardToNextYear.
  return {
    totalExpenditures,
    currentYearCredit,
    priorYearCarryforward,
    totalAvailableCredit,
    credit: totalAvailableCredit,
    carryforwardToNextYear: 0,
  };
}
