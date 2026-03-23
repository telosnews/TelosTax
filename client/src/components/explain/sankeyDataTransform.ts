/**
 * sankeyDataTransform — converts Form1040Result + CalculationResult into
 * the { nodes, links } structure expected by d3-sankey.
 *
 * All values are positive (Sankey requirement). Deductions, credits, and
 * payments are modeled as diversions that siphon flow away from the main
 * income stream.
 */

import type { Form1040Result, CalculationResult } from '@telostax/engine';

export interface SankeyNode {
  id: string;
  label: string;
  value: number;
  /** Original dollar amount for display — d3-sankey overwrites `value` with computed flow. */
  displayValue: number;
  column: number;
  colorKey: string;
  stepId?: string;
  category: 'income' | 'intermediate' | 'reduction' | 'tax' | 'payment' | 'result';
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

// Map nodes to wizard steps for click navigation
const STEP_MAP: Record<string, string> = {
  wages:          'w2_income',
  interest:       '1099int_income',
  dividends:      '1099div_income',
  capitalGains:   '1099b_income',
  seIncome:       'se_summary',
  rental:         'rental_income',
  retirement:     '1099r_income',
  socialSecurity: 'ssa1099_income',
  k1Income:       'k1_income',
  otherIncome:    'income_overview',
  totalIncome:    'income_overview',
  adjustments:    'deductions_summary',
  agi:            'income_overview',
  deductions:     'deduction_method',
  qbi:            'qbi_detail',
  taxableIncome:  'deduction_method',
  incomeTax:      'tax_summary',
  seTax:          'se_summary',
  niit:           'tax_summary',
  amt:            'amt_data',
  addlMedicare:   'tax_summary',
  credits:        'credits_overview',
  withholding:    'w2_income',
  estPayments:    'estimated_payments',
  refund:         'tax_summary',
  owed:           'tax_summary',
};

/** Helper: creates a SankeyNode with displayValue mirroring value. */
function node(n: Omit<SankeyNode, 'displayValue'>): SankeyNode {
  return { ...n, displayValue: n.value };
}

/**
 * Build Sankey nodes and links from a computed tax return.
 *
 * Layout columns (left-to-right):
 *   0: Income sources
 *   1: Total Income
 *   2: AGI (shown only if adjustments exist)
 *   3: Taxable Income
 *   4: Tax items + credits/payments
 *   5: Final result (Refund or Owed)
 */
export function buildSankeyData(
  f: Form1040Result,
  _calc: CalculationResult,
): SankeyData {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const hasAdjustments = f.totalAdjustments > 0;

  // Helper to assign columns — if no adjustments, shift columns 2+ down by 1
  const col = (base: number) => {
    if (!hasAdjustments && base >= 2) return base - 1;
    return base;
  };

  // ── Column 0: Income Sources ──────────────────────────────
  const sources: { id: string; label: string; value: number; stepId?: string }[] = [
    { id: 'wages',          label: 'W-2 Wages',          value: f.totalWages,                   stepId: STEP_MAP.wages },
    { id: 'interest',       label: 'Interest Income',    value: f.totalInterest,                stepId: STEP_MAP.interest },
    { id: 'dividends',      label: 'Dividend Income',    value: f.totalDividends,               stepId: STEP_MAP.dividends },
    { id: 'capitalGains',   label: 'Capital Gains',      value: Math.max(0, f.capitalGainOrLoss), stepId: STEP_MAP.capitalGains },
    { id: 'seIncome',       label: 'Self-Employment',    value: Math.max(0, f.scheduleCNetProfit), stepId: STEP_MAP.seIncome },
    { id: 'rental',         label: 'Rental Income',      value: Math.max(0, f.scheduleEIncome), stepId: STEP_MAP.rental },
    { id: 'retirement',     label: 'Retirement Income',  value: f.iraDistributionsTaxable + f.pensionDistributionsTaxable, stepId: STEP_MAP.retirement },
    { id: 'socialSecurity', label: 'Social Security',    value: f.taxableSocialSecurity,        stepId: STEP_MAP.socialSecurity },
    { id: 'k1Income',       label: 'K-1 Income',         value: Math.max(0, f.k1OrdinaryIncome), stepId: STEP_MAP.k1Income },
  ];

  // Filter to non-zero sources
  const activeSources = sources.filter(s => s.value > 0);

  // Group small sources (< 2% of totalIncome) into "Other Income"
  const threshold = f.totalIncome * 0.02;
  const significantSources = activeSources.filter(s => s.value >= threshold);
  const smallSources = activeSources.filter(s => s.value < threshold);
  const smallTotal = smallSources.reduce((sum, s) => sum + s.value, 0);

  // Add significant source nodes
  for (const s of significantSources) {
    nodes.push(node({
      id: s.id,
      label: s.label,
      value: s.value,
      column: 0,
      colorKey: 'income',
      stepId: s.stepId,
      category: 'income',
    }));
    links.push({ source: s.id, target: 'totalIncome', value: s.value });
  }

  // Compute residual = totalIncome - sum(all known sources)
  const knownTotal = activeSources.reduce((sum, s) => sum + s.value, 0);
  const residual = f.totalIncome - knownTotal;
  const otherAmount = smallTotal + Math.max(0, residual);

  if (otherAmount > 0) {
    nodes.push(node({
      id: 'otherIncome',
      label: 'Other Income',
      value: otherAmount,
      column: 0,
      colorKey: 'income',
      stepId: STEP_MAP.otherIncome,
      category: 'income',
    }));
    links.push({ source: 'otherIncome', target: 'totalIncome', value: otherAmount });
  }

  // ── Column 1: Total Income ────────────────────────────────
  nodes.push(node({
    id: 'totalIncome',
    label: 'Total Income',
    value: f.totalIncome,
    column: 1,
    colorKey: 'intermediate',
    stepId: STEP_MAP.totalIncome,
    category: 'intermediate',
  }));

  // ── Column 2: AGI (only if adjustments) ───────────────────
  if (hasAdjustments) {
    nodes.push(node({
      id: 'adjustments',
      label: 'Adjustments',
      value: f.totalAdjustments,
      column: 2,
      colorKey: 'adjustment',
      stepId: STEP_MAP.adjustments,
      category: 'reduction',
    }));

    nodes.push(node({
      id: 'agi',
      label: 'AGI',
      value: f.agi,
      column: 2,
      colorKey: 'intermediate',
      stepId: STEP_MAP.agi,
      category: 'intermediate',
    }));

    // Total Income flows to: AGI + Adjustments (diversion)
    links.push({ source: 'totalIncome', target: 'agi', value: f.agi });
    links.push({ source: 'totalIncome', target: 'adjustments', value: f.totalAdjustments });

    // AGI → Taxable Income + Deductions
    const deductionTotal = f.deductionAmount + f.qbiDeduction;
    links.push({ source: 'agi', target: 'taxableIncome', value: Math.max(0, f.taxableIncome) });
    if (deductionTotal > 0) {
      nodes.push(node({
        id: 'deductions',
        label: f.deductionUsed === 'standard' ? 'Standard Deduction' : 'Itemized Deductions',
        value: f.deductionAmount,
        column: col(3),
        colorKey: 'deduction',
        stepId: STEP_MAP.deductions,
        category: 'reduction',
      }));
      links.push({ source: 'agi', target: 'deductions', value: f.deductionAmount });

      if (f.qbiDeduction > 0) {
        nodes.push(node({
          id: 'qbi',
          label: 'QBI Deduction',
          value: f.qbiDeduction,
          column: col(3),
          colorKey: 'qbi',
          stepId: STEP_MAP.qbi,
          category: 'reduction',
        }));
        links.push({ source: 'agi', target: 'qbi', value: f.qbiDeduction });
      }
    }
  } else {
    // No adjustments — Total Income flows directly to Taxable Income + Deductions
    const deductionTotal = f.deductionAmount + f.qbiDeduction;
    links.push({ source: 'totalIncome', target: 'taxableIncome', value: Math.max(0, f.taxableIncome) });

    if (deductionTotal > 0) {
      nodes.push(node({
        id: 'deductions',
        label: f.deductionUsed === 'standard' ? 'Standard Deduction' : 'Itemized Deductions',
        value: f.deductionAmount,
        column: col(3),
        colorKey: 'deduction',
        stepId: STEP_MAP.deductions,
        category: 'reduction',
      }));
      links.push({ source: 'totalIncome', target: 'deductions', value: f.deductionAmount });

      if (f.qbiDeduction > 0) {
        nodes.push(node({
          id: 'qbi',
          label: 'QBI Deduction',
          value: f.qbiDeduction,
          column: col(3),
          colorKey: 'qbi',
          stepId: STEP_MAP.qbi,
          category: 'reduction',
        }));
        links.push({ source: 'totalIncome', target: 'qbi', value: f.qbiDeduction });
      }
    }
  }

  // ── Column 3: Taxable Income ──────────────────────────────
  nodes.push(node({
    id: 'taxableIncome',
    label: 'Taxable Income',
    value: Math.max(0, f.taxableIncome),
    column: col(3),
    colorKey: 'intermediate',
    stepId: STEP_MAP.taxableIncome,
    category: 'intermediate',
  }));

  // ── Column 4: Taxes, Credits, Payments ────────────────────
  const taxItems: { id: string; label: string; value: number; colorKey: string; stepId?: string; category: SankeyNode['category'] }[] = [
    { id: 'incomeTax',    label: 'Income Tax',            value: f.incomeTax,              colorKey: 'tax',    stepId: STEP_MAP.incomeTax,    category: 'tax' },
    { id: 'seTax',        label: 'Self-Employment Tax',   value: f.seTax,                  colorKey: 'surtax', stepId: STEP_MAP.seTax,        category: 'tax' },
    { id: 'niit',         label: 'Net Investment Tax',    value: f.niitTax,                colorKey: 'surtax', stepId: STEP_MAP.niit,         category: 'tax' },
    { id: 'amt',          label: 'AMT',                   value: f.amtAmount,              colorKey: 'surtax', stepId: STEP_MAP.amt,          category: 'tax' },
    { id: 'addlMedicare', label: 'Addl. Medicare Tax',    value: f.additionalMedicareTaxW2, colorKey: 'surtax', stepId: STEP_MAP.addlMedicare, category: 'tax' },
  ];

  const activeTaxItems = taxItems.filter(t => t.value > 0);

  // Taxable Income → each tax item
  for (const t of activeTaxItems) {
    nodes.push(node({
      id: t.id,
      label: t.label,
      value: t.value,
      column: col(4),
      colorKey: t.colorKey,
      stepId: t.stepId,
      category: t.category,
    }));
    links.push({ source: 'taxableIncome', target: t.id, value: t.value });
  }

  // ── Column 5: Credits, Withholding, Estimated Payments ────
  if (f.totalCredits > 0) {
    nodes.push(node({
      id: 'credits',
      label: 'Tax Credits',
      value: f.totalCredits,
      column: col(5),
      colorKey: 'credit',
      stepId: STEP_MAP.credits,
      category: 'payment',
    }));
  }

  if (f.totalWithholding > 0) {
    nodes.push(node({
      id: 'withholding',
      label: 'Withholding',
      value: f.totalWithholding,
      column: col(5),
      colorKey: 'payment',
      stepId: STEP_MAP.withholding,
      category: 'payment',
    }));
  }

  if (f.estimatedPayments > 0) {
    nodes.push(node({
      id: 'estPayments',
      label: 'Estimated Payments',
      value: f.estimatedPayments,
      column: col(5),
      colorKey: 'payment',
      stepId: STEP_MAP.estPayments,
      category: 'payment',
    }));
  }

  // ── Column 6: Final Result ──────────────────────────────────
  const isRefund = f.refundAmount > 0;
  const resultId = isRefund ? 'refund' : 'owed';
  const resultLabel = isRefund ? 'Your Refund' : 'Amount You Owe';
  const resultValue = isRefund ? f.refundAmount : f.amountOwed;

  nodes.push(node({
    id: resultId,
    label: resultLabel,
    value: Math.max(1, resultValue),
    column: col(6),
    colorKey: isRefund ? 'refund' : 'owed',
    stepId: STEP_MAP[resultId],
    category: 'result',
  }));

  // ── Link tax items → credits/payments/result proportionally ─
  // Instead of routing all gross flows through the result node (which
  // inflates its size to totalTax + totalPayments), split each tax
  // item's outflow so credits/payments absorb their share and only
  // the net amount reaches the result node.
  const totalTax = activeTaxItems.reduce((s, t) => s + t.value, 0);

  if (totalTax > 0) {
    // How much of each payment source offsets tax (applied in order)
    const effectiveCredits = Math.min(f.totalCredits, totalTax);
    const afterCredits = totalTax - effectiveCredits;
    const effectiveWH = Math.min(f.totalWithholding, afterCredits);
    const afterWH = afterCredits - effectiveWH;
    const effectiveEst = Math.min(f.estimatedPayments, afterWH);
    const netOwed = afterWH - effectiveEst; // > 0 for amount owed, 0 for refund

    // Excess payments that create refund flow
    const excessCredits = f.totalCredits - effectiveCredits;
    const excessWH = f.totalWithholding - effectiveWH;
    const excessEst = f.estimatedPayments - effectiveEst;

    // Each tax item splits outflow proportionally
    for (const t of activeTaxItems) {
      const ratio = t.value / totalTax;
      if (effectiveCredits > 0) {
        links.push({ source: t.id, target: 'credits', value: effectiveCredits * ratio });
      }
      if (effectiveWH > 0) {
        links.push({ source: t.id, target: 'withholding', value: effectiveWH * ratio });
      }
      if (effectiveEst > 0) {
        links.push({ source: t.id, target: 'estPayments', value: effectiveEst * ratio });
      }
      if (netOwed > 0) {
        links.push({ source: t.id, target: resultId, value: netOwed * ratio });
      }
    }

    // For refund: excess payments flow to refund node
    if (excessCredits > 0) links.push({ source: 'credits', target: resultId, value: excessCredits });
    if (excessWH > 0) links.push({ source: 'withholding', target: resultId, value: excessWH });
    if (excessEst > 0) links.push({ source: 'estPayments', target: resultId, value: excessEst });
  } else {
    // No tax items — all payments flow directly to refund
    if (f.totalCredits > 0) links.push({ source: 'credits', target: resultId, value: f.totalCredits });
    if (f.totalWithholding > 0) links.push({ source: 'withholding', target: resultId, value: f.totalWithholding });
    if (f.estimatedPayments > 0) links.push({ source: 'estPayments', target: resultId, value: f.estimatedPayments });
  }

  return { nodes, links };
}
