/**
 * Schedule K-1 — Partner/Shareholder Income Routing
 *
 * K-1 forms are issued by partnerships (Form 1065), S-Corporations (Form 1120-S),
 * and estates/trusts (Form 1041). This module routes K-1 line items to the
 * appropriate categories for Form 1040 calculation.
 *
 * Key routing rules:
 * - Ordinary business income: Partnership → SE income; S-Corp → NOT SE income
 * - Guaranteed payments: Always SE income
 * - Interest/dividends: Flows to Schedule B
 * - Capital gains: Flows to Schedule D
 * - Section 199A QBI: Flows to QBI deduction
 * - Rental income: Flows to Schedule E
 * - Box 13 deductions: Charitable → Schedule A; Investment interest → Form 4952
 * - Box 15 credits: Foreign tax → FTC; Other credits → nonrefundable credits
 *
 * @authority
 *   IRC: Sections 701-704 — partnership income and allocations
 *   IRC: Section 1366 — S corporation pass-through items
 *   IRC: Section 170 — charitable contributions (Box 13 Codes A-F)
 *   IRC: Section 163(d) — investment interest expense (Box 13 Code H)
 *   IRC: Section 901 — foreign tax credit (Box 15 Code L)
 */

import { IncomeK1 } from '../types/index.js';
import { round2 } from './utils.js';

export interface K1RoutingResult {
  // Income routed to various categories (Boxes 1-11)
  ordinaryBusinessIncome: number;   // Box 1 — ordinary income (taxed as ordinary)
  guaranteedPayments: number;       // Box 4 — guaranteed payments to partner
  interestIncome: number;           // Box 5 — interest
  ordinaryDividends: number;        // Box 6a — ordinary dividends
  qualifiedDividends: number;       // Box 6b — qualified dividends
  shortTermCapitalGain: number;     // Box 8 — short-term capital gain
  longTermCapitalGain: number;      // Box 9a — long-term capital gain
  netSection1231Gain: number;       // Box 10 — section 1231 gain (treated as LTCG if net gain)
  otherIncome: number;              // Box 11 — other income
  section199AQBI: number;           // Box 20, Code Z — QBI for Section 199A deduction
  selfEmploymentIncome: number;     // Box 14, Code A — SE earnings (partnerships only)
  section179Deduction: number;      // Box 12, Code A — Section 179 expense deduction
  rentalIncome: number;             // Box 2 — rental real estate income
  royalties: number;                // Box 7 — royalties
  federalTaxWithheld: number;       // Tax withheld

  // Box 13 — Partner's deductions
  charitableCash: number;              // Box 13, Codes A/B — cash charitable contributions
  charitableNonCash: number;           // Box 13, Codes C/D/E/F — non-cash charitable contributions
  investmentInterestExpense: number;   // Box 13, Code H — investment interest expense
  otherDeductions: number;             // Box 13, Codes I-L — other deductions

  // Box 15 — Partner's credits
  foreignTaxPaid: number;              // Box 15, Code L — foreign taxes paid/accrued
  otherCredits: number;                // Box 15, various codes — other partner credits

  // Aggregated totals for Form 1040
  totalOrdinaryIncome: number;      // All ordinary income (business + guaranteed + other + interest + ordinary divs)
  totalSEIncome: number;            // Income subject to SE tax
  totalPreferentialIncome: number;  // LTCG + qualified dividends for preferential rate
  totalIncome: number;              // All income from K-1
}

/**
 * Route a single K-1's items to the appropriate income categories.
 *
 * @authority
 *   IRC: Sections 701-704 — partnership income and allocations
 *   IRC: Section 1366 — S corporation pass-through items
 *   IRC: Section 179 — election to expense certain depreciable business assets
 *   IRC: Section 170 — charitable contributions (Box 13)
 *   IRC: Section 163(d) — investment interest expense (Box 13 Code H)
 *   IRC: Section 901 — foreign tax credit (Box 15 Code L)
 *   Form: Schedule K-1 (Form 1065 / Form 1120-S / Form 1041)
 * @scope K-1 income and deduction/credit routing to appropriate categories for Form 1040
 * @limitations Does not model full Form 4562 Section 179 computation
 */
export function routeK1Income(k1: IncomeK1): K1RoutingResult {
  // ── Income items (Boxes 1-11) ──
  const ordinaryBusinessIncome = k1.ordinaryBusinessIncome || 0;
  const guaranteedPayments = k1.guaranteedPayments || 0;
  const interestIncome = k1.interestIncome || 0;
  const ordinaryDividends = k1.ordinaryDividends || 0;
  const qualifiedDividends = Math.min(k1.qualifiedDividends || 0, ordinaryDividends);
  const shortTermCapitalGain = k1.shortTermCapitalGain || 0;
  const longTermCapitalGain = k1.longTermCapitalGain || 0;
  const netSection1231Gain = k1.netSection1231Gain || 0;
  const otherIncome = k1.otherIncome || 0;
  const section199AQBI = k1.section199AQBI || 0;
  const section179Deduction = Math.max(0, k1.section179Deduction || 0);
  const rentalIncome = k1.rentalIncome || 0;
  const royalties = k1.royalties || 0;
  const federalTaxWithheld = k1.federalTaxWithheld || 0;

  // ── Box 13 — Partner's deductions ──
  const charitableCash = Math.max(0, k1.box13CharitableCash || 0);
  const charitableNonCash = Math.max(0, k1.box13CharitableNonCash || 0);
  const investmentInterestExpense = Math.max(0, k1.box13InvestmentInterestExpense || 0);
  const otherDeductions = Math.max(0, k1.box13OtherDeductions || 0);

  // ── Box 15 — Partner's credits ──
  const foreignTaxPaid = Math.max(0, k1.box15ForeignTaxPaid || 0);
  const otherCredits = Math.max(0, k1.box15OtherCredits || 0);

  // SE income determination:
  // Partnerships: ordinary business income + guaranteed payments are SE income
  //   EXCEPT: passive activities — IRC §1402(a)(13) excludes limited/passive partners'
  //   distributive share from SE. Guaranteed payments (IRC §707(c)) remain SE income
  //   regardless of passive/active status.
  //   EXCEPT: Subchapter T cooperatives (Form 1120-C) — patronage dividends reported
  //   on 1099-PATR flow to Schedule F line 3a as part of net farm profit, NOT as
  //   partnership distributive share. SE tax comes from Schedule F/SE, not K-1 routing.
  // S-Corps: NO SE income (shareholders are employees and receive W-2s)
  // Estates/Trusts: NO SE income (beneficiary income is not self-employment)
  const isPartnership = k1.entityType === 'partnership';
  const isPassive = k1.isPassiveActivity === true;
  const isCooperative = k1.isCooperativePatronage === true;
  let selfEmploymentIncome = 0;
  if (isPartnership && !isCooperative) {
    if (isPassive) {
      // IRC §1402(a)(13): Passive/limited partners — only guaranteed payments are SE income
      selfEmploymentIncome = round2(guaranteedPayments);
    } else {
      // Active/general partners — ordinary income + guaranteed payments are SE income
      selfEmploymentIncome = round2(ordinaryBusinessIncome + guaranteedPayments);
    }
  }
  // If explicitly provided in Box 14 Code A, use that instead (more accurate)
  if (k1.selfEmploymentIncome !== undefined && k1.selfEmploymentIncome !== null) {
    selfEmploymentIncome = k1.selfEmploymentIncome;
  }

  // Section 1231 net gains are treated as long-term capital gains
  const effectiveLTCG = round2(longTermCapitalGain + Math.max(0, netSection1231Gain));

  const totalSEIncome = isPartnership ? selfEmploymentIncome : 0;

  const totalOrdinaryIncome = round2(
    ordinaryBusinessIncome + guaranteedPayments + otherIncome +
    interestIncome + ordinaryDividends + rentalIncome + royalties,
  );

  const totalPreferentialIncome = round2(qualifiedDividends + effectiveLTCG);

  const totalIncome = round2(
    totalOrdinaryIncome + shortTermCapitalGain + effectiveLTCG -
    (qualifiedDividends), // QD is already in ordinaryDividends, don't double count in preferential
  );

  return {
    ordinaryBusinessIncome,
    guaranteedPayments,
    interestIncome,
    ordinaryDividends,
    qualifiedDividends,
    shortTermCapitalGain,
    longTermCapitalGain,
    netSection1231Gain,
    otherIncome,
    section199AQBI,
    selfEmploymentIncome,
    section179Deduction,
    rentalIncome,
    royalties,
    federalTaxWithheld,
    charitableCash,
    charitableNonCash,
    investmentInterestExpense,
    otherDeductions,
    foreignTaxPaid,
    otherCredits,
    totalOrdinaryIncome,
    totalSEIncome,
    totalPreferentialIncome,
    totalIncome,
  };
}

/**
 * Aggregate multiple K-1s into a single routing result for Form 1040.
 *
 * @authority
 *   IRC: Sections 701-704 — partnership income and allocations
 *   IRC: Section 1366 — S corporation pass-through items
 *   IRC: Section 179 — election to expense certain depreciable business assets
 *   Form: Schedule K-1 (Form 1065 / Form 1120-S / Form 1041)
 * @scope K-1 income routing to appropriate categories for Form 1040
 * @limitations Does not model full Form 4562 Section 179 computation
 */
export function aggregateK1Income(k1s: IncomeK1[]): K1RoutingResult {
  if (!k1s || k1s.length === 0) {
    return {
      ordinaryBusinessIncome: 0,
      guaranteedPayments: 0,
      interestIncome: 0,
      ordinaryDividends: 0,
      qualifiedDividends: 0,
      shortTermCapitalGain: 0,
      longTermCapitalGain: 0,
      netSection1231Gain: 0,
      otherIncome: 0,
      section199AQBI: 0,
      selfEmploymentIncome: 0,
      section179Deduction: 0,
      rentalIncome: 0,
      royalties: 0,
      federalTaxWithheld: 0,
      charitableCash: 0,
      charitableNonCash: 0,
      investmentInterestExpense: 0,
      otherDeductions: 0,
      foreignTaxPaid: 0,
      otherCredits: 0,
      totalOrdinaryIncome: 0,
      totalSEIncome: 0,
      totalPreferentialIncome: 0,
      totalIncome: 0,
    };
  }

  const results = k1s.map(routeK1Income);

  const sumField = (field: keyof K1RoutingResult) =>
    round2(results.reduce((sum, r) => sum + (r[field] as number), 0));

  return {
    ordinaryBusinessIncome: sumField('ordinaryBusinessIncome'),
    guaranteedPayments: sumField('guaranteedPayments'),
    interestIncome: sumField('interestIncome'),
    ordinaryDividends: sumField('ordinaryDividends'),
    qualifiedDividends: sumField('qualifiedDividends'),
    shortTermCapitalGain: sumField('shortTermCapitalGain'),
    longTermCapitalGain: sumField('longTermCapitalGain'),
    netSection1231Gain: sumField('netSection1231Gain'),
    otherIncome: sumField('otherIncome'),
    section199AQBI: sumField('section199AQBI'),
    selfEmploymentIncome: sumField('selfEmploymentIncome'),
    section179Deduction: sumField('section179Deduction'),
    rentalIncome: sumField('rentalIncome'),
    royalties: sumField('royalties'),
    federalTaxWithheld: sumField('federalTaxWithheld'),
    charitableCash: sumField('charitableCash'),
    charitableNonCash: sumField('charitableNonCash'),
    investmentInterestExpense: sumField('investmentInterestExpense'),
    otherDeductions: sumField('otherDeductions'),
    foreignTaxPaid: sumField('foreignTaxPaid'),
    otherCredits: sumField('otherCredits'),
    totalOrdinaryIncome: sumField('totalOrdinaryIncome'),
    totalSEIncome: sumField('totalSEIncome'),
    totalPreferentialIncome: sumField('totalPreferentialIncome'),
    totalIncome: sumField('totalIncome'),
  };
}
