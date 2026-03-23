import { useState, lazy, Suspense } from 'react';
import { BarChart2, BarChart3, GitBranch } from 'lucide-react';
import DeductionsBreakdownChart from './DeductionsBreakdownChart';
import DeductionsFlowWaterfall from './DeductionsFlowWaterfall';

const DeductionsFlowSankey = lazy(() => import('./DeductionsFlowSankey'));

type ViewMode = 'bar' | 'waterfall' | 'sankey';

interface DeductionsFlowSwitcherProps {
  totalIncome: number;
  adjustments: Array<{ label: string; amount: number; stepId: string }>;
  deductions: Array<{ label: string; amount: number; stepId: string }>;
  isItemized: boolean;
  totalAdjustments: number;
  agi: number;
  deductionAmount: number;
  deductionLabel: string;
  qbiDeduction: number;
  taxableIncome: number;
  onBarClick?: (stepId: string) => void;
}

const VIEW_MODES: { id: ViewMode; label: string; icon: typeof BarChart2 }[] = [
  { id: 'bar',       label: 'Summary',   icon: BarChart2 },
  { id: 'waterfall', label: 'Waterfall', icon: BarChart3 },
  { id: 'sankey',    label: 'Flow',      icon: GitBranch },
];

export default function DeductionsFlowSwitcher(props: DeductionsFlowSwitcherProps) {
  const [view, setView] = useState<ViewMode>('bar');

  if (props.deductionAmount === 0 && props.totalAdjustments === 0) return null;

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mt-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide">
          <span style={{ color: '#14B8A6' }}>Deductions</span>
          <span className="text-slate-400"> & </span>
          <span style={{ color: '#F59E0B' }}>Adjustments</span>
        </h4>
        <div className="flex items-center bg-surface-800 rounded-lg border border-slate-700/50 p-0.5">
          {VIEW_MODES.map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setView(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  view === m.id
                    ? 'bg-surface-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {view === 'bar' && (
        <DeductionsBreakdownChart
          adjustments={props.adjustments}
          deductions={props.deductions}
          isItemized={props.isItemized}
          deductionAmount={props.deductionAmount}
          deductionLabel={props.deductionLabel}
          onBarClick={props.onBarClick}
        />
      )}

      {view === 'waterfall' && (
        <DeductionsFlowWaterfall
          totalIncome={props.totalIncome}
          totalAdjustments={props.totalAdjustments}
          agi={props.agi}
          deductionAmount={props.deductionAmount}
          deductionLabel={props.deductionLabel}
          qbiDeduction={props.qbiDeduction}
          taxableIncome={props.taxableIncome}
          onBarClick={props.onBarClick}
        />
      )}

      {view === 'sankey' && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading flow diagram...
            </div>
          }
        >
          <DeductionsFlowSankey
            totalIncome={props.totalIncome}
            adjustments={props.adjustments}
            deductions={props.deductions}
            isItemized={props.isItemized}
            agi={props.agi}
            deductionAmount={props.deductionAmount}
            deductionLabel={props.deductionLabel}
            qbiDeduction={props.qbiDeduction}
            taxableIncome={props.taxableIncome}
            onNodeClick={props.onBarClick}
          />
        </Suspense>
      )}

      {view !== 'bar' && (
        <p className="text-[11px] text-slate-500 text-center mt-1">
          Click any {view === 'sankey' ? 'node' : 'bar'} to jump to that section
        </p>
      )}
    </div>
  );
}
