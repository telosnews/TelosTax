import { InvestmentInterestInfo, InvestmentInterestResult } from '../types/index.js';
import { round2 } from './utils.js';

/**
 * Calculate Investment Interest Expense deduction (Form 4952).
 *
 * Investment interest = interest paid on debt used to purchase investment property
 * (typically margin interest from brokerage accounts).
 *
 * Deduction limited to net investment income (NII). Excess carries forward.
 *
 * Net Investment Income = interest + ordinary (non-qualified) dividends
 *   + (optionally) qualified dividends and net LTCG if taxpayer elects
 *
 * If taxpayer elects to include qualified dividends/LTCG in NII, those amounts
 * lose preferential rate treatment and are taxed at ordinary rates.
 *
 * @authority
 *   IRC: Section 163(d) — limitation on investment interest
 *   Form: Form 4952
 * @scope Investment interest expense deduction limited to NII
 * @limitations None
 *
 * @param info - Investment interest expense data
 * @param interestIncome - Total interest income (from 1099-INT + K-1)
 * @param ordinaryDividends - Total ordinary dividends (from 1099-DIV + K-1)
 * @param qualifiedDividends - Total qualified dividends (subset of ordinary)
 * @param netLTCG - Net long-term capital gains (Schedule D + K-1)
 */
export function calculateInvestmentInterest(
  info: InvestmentInterestInfo,
  interestIncome: number,
  ordinaryDividends: number,
  qualifiedDividends: number,
  netLTCG: number,
): InvestmentInterestResult {
  // Total investment interest expense (current year + prior year carryforward)
  const totalExpense = round2(
    Math.max(0, info.investmentInterestPaid) + Math.max(0, info.priorYearDisallowed || 0),
  );

  if (totalExpense <= 0) {
    return {
      totalExpense: 0,
      netInvestmentIncome: 0,
      deductibleAmount: 0,
      carryforward: 0,
    };
  }

  // Net investment income: interest + non-qualified portion of ordinary dividends
  // The non-qualified portion = ordinary dividends - qualified dividends
  const nonQualifiedDividends = round2(Math.max(0, ordinaryDividends - qualifiedDividends));
  let netInvestmentIncome = round2(
    Math.max(0, interestIncome) + nonQualifiedDividends,
  );

  // Optional elections: include qualified dividends and/or net LTCG
  // (these lose preferential rate treatment if elected)
  if (info.electToIncludeQualifiedDividends) {
    netInvestmentIncome = round2(netInvestmentIncome + Math.max(0, qualifiedDividends));
  }
  if (info.electToIncludeLTCG) {
    netInvestmentIncome = round2(netInvestmentIncome + Math.max(0, netLTCG));
  }

  // Deductible amount = lesser of total expense or NII
  const deductibleAmount = round2(Math.min(totalExpense, netInvestmentIncome));
  const carryforward = round2(totalExpense - deductibleAmount);

  return {
    totalExpense,
    netInvestmentIncome,
    deductibleAmount,
    carryforward,
  };
}
