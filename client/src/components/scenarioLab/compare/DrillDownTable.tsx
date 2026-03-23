/**
 * DrillDownTable — expandable per-line diff table for Compare view.
 *
 * Shows per-category breakdown with per-scenario values and delta coloring.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CalculationResult } from '@telostax/engine';
import { formatCurrency, formatPercent } from '../../../utils/format';
import type { Scenario } from '../types';

interface DrillDownTableProps {
  scenarios: Scenario[];
  baseResult: CalculationResult;
  scenarioResults: Map<string, CalculationResult>;
}

interface DrillDownSection {
  label: string;
  rows: DrillDownRow[];
}

interface DrillDownRow {
  label: string;
  getValue: (r: CalculationResult) => number;
  format?: 'dollar' | 'percent';
}

function buildSections(): DrillDownSection[] {
  return [
    {
      label: 'Income',
      rows: [
        { label: 'Wages', getValue: r => r.form1040.totalWages },
        { label: 'Interest', getValue: r => r.form1040.totalInterest },
        { label: 'Dividends', getValue: r => r.form1040.totalDividends },
        { label: 'Capital Gains', getValue: r => r.form1040.capitalGainOrLoss },
        { label: 'Schedule C', getValue: r => r.form1040.scheduleCNetProfit },
        { label: 'Other Income', getValue: r => r.form1040.additionalIncome },
        { label: 'Total Income', getValue: r => r.form1040.totalIncome },
      ],
    },
    {
      label: 'Adjustments',
      rows: [
        { label: 'SE Deduction', getValue: r => r.form1040.seDeduction },
        { label: 'IRA Deduction', getValue: r => r.form1040.iraDeduction },
        { label: 'HSA Deduction', getValue: r => r.form1040.hsaDeduction },
        { label: 'Student Loan Interest', getValue: r => r.form1040.studentLoanInterest },
        { label: 'Total Adjustments', getValue: r => r.form1040.totalAdjustments },
      ],
    },
    {
      label: 'Deductions',
      rows: [
        { label: 'AGI', getValue: r => r.form1040.agi },
        { label: 'Deduction Amount', getValue: r => r.form1040.deductionAmount },
        { label: 'QBI Deduction', getValue: r => r.form1040.qbiDeduction },
        { label: 'Taxable Income', getValue: r => r.form1040.taxableIncome },
      ],
    },
    {
      label: 'Tax',
      rows: [
        { label: 'Income Tax', getValue: r => r.form1040.incomeTax },
        { label: 'SE Tax', getValue: r => r.form1040.seTax },
        { label: 'NIIT', getValue: r => r.form1040.niitTax },
        { label: 'AMT', getValue: r => r.form1040.amtAmount },
        { label: 'Total Tax', getValue: r => r.form1040.totalTax },
      ],
    },
    {
      label: 'Credits & Final',
      rows: [
        { label: 'Total Credits', getValue: r => r.form1040.totalCredits },
        { label: 'Tax After Credits', getValue: r => r.form1040.taxAfterCredits },
        { label: 'Withholding', getValue: r => r.form1040.totalWithholding },
        { label: 'Effective Rate', getValue: r => r.form1040.effectiveTaxRate, format: 'percent' },
      ],
    },
  ];
}

const COLOR_CLASSES: Record<string, string> = {
  orange: 'text-telos-orange-400',
  blue: 'text-telos-blue-400',
  violet: 'text-violet-400',
  emerald: 'text-emerald-400',
};

export default function DrillDownTable({ scenarios, baseResult, scenarioResults }: DrillDownTableProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const sections = buildSections();

  const toggle = (label: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-slate-700/50 bg-surface-800 overflow-hidden overflow-x-auto">
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Detailed Drill-Down</h3>
      </div>

      {sections.map(section => {
        const isExpanded = expandedSections.has(section.label);
        return (
          <div key={section.label}>
            <button
              onClick={() => toggle(section.label)}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 transition-colors text-left border-b border-slate-800/50"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              <span className="text-xs font-medium text-slate-300">{section.label}</span>
            </button>

            {isExpanded && (
              <div className="divide-y divide-slate-800/30">
                {/* Header row */}
                <div className="grid px-4 py-1.5 bg-surface-900/50" style={{ gridTemplateColumns: `140px 100px ${scenarios.map(() => '100px').join(' ')}` }}>
                  <span className="text-[10px] text-slate-600">Line Item</span>
                  <span className="text-[10px] text-slate-600 text-right">Baseline</span>
                  {scenarios.map(s => (
                    <span key={s.id} className={`text-[10px] text-right ${COLOR_CLASSES[s.color] ?? 'text-slate-400'}`}>
                      {s.name}
                    </span>
                  ))}
                </div>

                {/* Data rows */}
                {section.rows.map(row => {
                  const baseVal = row.getValue(baseResult);
                  return (
                    <div key={row.label} className="grid px-4 py-1.5" style={{ gridTemplateColumns: `140px 100px ${scenarios.map(() => '100px').join(' ')}` }}>
                      <span className="text-[11px] text-slate-400">{row.label}</span>
                      <span className="text-[11px] text-slate-500 text-right font-mono tabular-nums">
                        {row.format === 'percent' ? formatPercent(baseVal) : formatCurrency(baseVal)}
                      </span>
                      {scenarios.map(s => {
                        const result = scenarioResults.get(s.id);
                        if (!result) return <span key={s.id} />;
                        const val = row.getValue(result);
                        const diff = val - baseVal;
                        const hasDiff = Math.abs(diff) >= 1;
                        return (
                          <span key={s.id} className={`text-[11px] text-right font-mono tabular-nums ${
                            hasDiff ? (COLOR_CLASSES[s.color] ?? 'text-white') : 'text-slate-500'
                          }`}>
                            {row.format === 'percent' ? formatPercent(val) : formatCurrency(val)}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
