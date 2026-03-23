import { FilingStatus, Income1099B, ScheduleDResult } from '../types/index.js';
import { SCHEDULE_D } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Schedule D — Capital Gains and Losses.
 *
 * Separates transactions into short-term (held ≤ 1 year) and long-term (held > 1 year).
 * Net capital loss is deductible up to $3,000 ($1,500 MFS) against ordinary income.
 * Excess loss carries forward to future years, preserving ST/LT character.
 *
 * Carryforward from prior year preserves character:
 *   - ST carryforward applied as additional short-term loss
 *   - LT carryforward applied as additional long-term loss
 *
 * For backward compatibility, if only the legacy single `carryforward` value is
 * provided (no ST/LT split), it is treated entirely as short-term.
 *
 * When computing the new carryforward, short-term net losses absorb the deduction
 * first, then long-term net losses. This preserves character for future years.
 *
 * @authority
 *   IRC: Section 1(h) — maximum capital gains rate
 *   IRC: Section 1211(b) — limitation on capital losses for individuals
 *   IRC: Section 1212(b) — capital loss carryforward for individuals
 *   Form: Schedule D (Form 1040)
 *   Pub: Publication 550 — Investment Income and Expenses
 * @scope Capital gains/losses with $3k loss limit and carryforward
 * @limitations No Form 4797 (Section 1231/1245/1250 recapture)
 */
export function calculateScheduleD(
  transactions: Income1099B[],
  carryforward: number,
  filingStatus: FilingStatus,
  carryforwardST?: number,
  carryforwardLT?: number,
  capitalGainDistributions?: number,
): ScheduleDResult {
  let shortTermGain = 0;
  let shortTermLoss = 0;
  let longTermGain = 0;
  let longTermLoss = 0;

  for (const t of transactions) {
    // Wash sale adjustment (Box 1g): disallowed loss reduces the deductible loss.
    // 1099-B Box 1e always reports the ORIGINAL cost basis.  Box 1g (wash sale
    // disallowed) is a separate adjustment regardless of whether the basis was
    // reported to the IRS.  basisReportedToIRS only determines which Form 8949
    // box (A/D vs B/E) the transaction flows to — it does NOT mean the broker
    // pre-adjusted the basis.  Always apply the wash sale adjustment.
    //
    // IRS Form 8949 column (h) = proceeds − costBasis + washSaleAdj
    // Equivalently: proceeds − (costBasis − washSaleAdj)
    const proceeds = safeNum(t.proceeds);
    const costBasis = safeNum(t.costBasis);
    const washSaleAdj = safeNum(t.washSaleLossDisallowed);
    const adjustedBasis = washSaleAdj > 0
      ? round2(costBasis - washSaleAdj)
      : round2(costBasis);
    const gainOrLoss = round2(proceeds - adjustedBasis);

    if (t.isLongTerm) {
      if (gainOrLoss >= 0) {
        longTermGain += gainOrLoss;
      } else {
        longTermLoss += Math.abs(gainOrLoss);
      }
    } else {
      if (gainOrLoss >= 0) {
        shortTermGain += gainOrLoss;
      } else {
        shortTermLoss += Math.abs(gainOrLoss);
      }
    }
  }

  // Apply carryforward — preserve character (ST/LT)
  // If explicit ST/LT values provided, use them; otherwise fall back to legacy single value as ST
  const hasSplitCarryforward = carryforwardST !== undefined || carryforwardLT !== undefined;
  const cfST = hasSplitCarryforward ? Math.abs(carryforwardST || 0) : Math.abs(carryforward || 0);
  const cfLT = hasSplitCarryforward ? Math.abs(carryforwardLT || 0) : 0;

  if (cfST > 0) {
    shortTermLoss += cfST;
  }
  if (cfLT > 0) {
    longTermLoss += cfLT;
  }

  // Schedule D Line 13: Capital gain distributions from 1099-DIV Box 2a
  // These are always long-term (mutual fund distributions of realized LT gains)
  const capGainDist = Math.max(0, capitalGainDistributions || 0);
  if (capGainDist > 0) {
    longTermGain += capGainDist;
  }

  const netShortTerm = round2(shortTermGain - shortTermLoss);
  const netLongTerm = round2(longTermGain - longTermLoss);
  const netGainOrLoss = round2(netShortTerm + netLongTerm);

  // Capital loss deduction limit
  const lossLimit = filingStatus === FilingStatus.MarriedFilingSeparately
    ? SCHEDULE_D.CAPITAL_LOSS_LIMIT_MFS
    : SCHEDULE_D.CAPITAL_LOSS_LIMIT;

  let capitalLossDeduction = 0;
  let capitalLossCarryforwardTotal = 0;
  let outCarryforwardST = 0;
  let outCarryforwardLT = 0;

  if (netGainOrLoss < 0) {
    const totalLoss = Math.abs(netGainOrLoss);
    capitalLossDeduction = Math.min(totalLoss, lossLimit);
    capitalLossCarryforwardTotal = round2(totalLoss - capitalLossDeduction);

    // Determine carryforward character using IRS Capital Loss Carryover Worksheet logic.
    // The deduction is applied to ST net loss first, then LT net loss.
    const stNetLoss = netShortTerm < 0 ? Math.abs(netShortTerm) : 0;
    const ltNetLoss = netLongTerm < 0 ? Math.abs(netLongTerm) : 0;

    if (netShortTerm >= 0 && netLongTerm < 0) {
      // Only LT loss (ST gain partially offset it). All carryforward is LT.
      outCarryforwardST = 0;
      outCarryforwardLT = capitalLossCarryforwardTotal;
    } else if (netLongTerm >= 0 && netShortTerm < 0) {
      // Only ST loss (LT gain partially offset it). All carryforward is ST.
      outCarryforwardST = capitalLossCarryforwardTotal;
      outCarryforwardLT = 0;
    } else {
      // Both sides have net losses. Apply deduction to ST first, then LT.
      let deductionRemaining = capitalLossDeduction;

      const stApplied = Math.min(deductionRemaining, stNetLoss);
      outCarryforwardST = round2(stNetLoss - stApplied);
      deductionRemaining -= stApplied;

      const ltApplied = Math.min(deductionRemaining, ltNetLoss);
      outCarryforwardLT = round2(ltNetLoss - ltApplied);
    }
  }

  return {
    shortTermGain: round2(shortTermGain),
    shortTermLoss: round2(shortTermLoss),
    netShortTerm,
    longTermGain: round2(longTermGain),
    longTermLoss: round2(longTermLoss),
    netLongTerm,
    netGainOrLoss,
    capitalLossDeduction,
    capitalLossCarryforward: capitalLossCarryforwardTotal,
    capitalLossCarryforwardST: outCarryforwardST,
    capitalLossCarryforwardLT: outCarryforwardLT,
  };
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
