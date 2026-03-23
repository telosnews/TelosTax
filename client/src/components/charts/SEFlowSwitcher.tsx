import { useState, lazy, Suspense } from 'react';
import { BarChart3, GitBranch } from 'lucide-react';
import SEWaterfall from './SEWaterfall';

const SEFlowSankey = lazy(() => import('./SEFlowSankey'));

type ViewMode = 'waterfall' | 'sankey';

interface ExpenseItem {
  label: string;
  amount: number;
  stepId: string;
}

interface SEFlowSwitcherProps {
  grossReceipts: number;
  returnsAndAllowances: number;
  otherBusinessIncome: number;
  cogs: number;
  totalExpenses: number;
  expenses: ExpenseItem[];
  homeOffice: number;
  vehicle: number;
  depreciation: number;
  netProfit: number;
  seHealthInsurance: number;
  seRetirement: number;
  seTaxDeductibleHalf: number;
  onBarClick?: (stepId: string) => void;
}

const VIEW_MODES: { id: ViewMode; label: string; icon: typeof BarChart3 }[] = [
  { id: 'waterfall', label: 'Waterfall', icon: BarChart3 },
  { id: 'sankey',    label: 'Flow',      icon: GitBranch },
];

export default function SEFlowSwitcher(props: SEFlowSwitcherProps) {
  const [view, setView] = useState<ViewMode>('waterfall');

  if (props.grossReceipts === 0) return null;

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mt-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
          Self-Employment Breakdown
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

      {view === 'waterfall' && (
        <SEWaterfall
          grossReceipts={props.grossReceipts}
          returnsAndAllowances={props.returnsAndAllowances}
          otherBusinessIncome={props.otherBusinessIncome}
          cogs={props.cogs}
          expenses={props.totalExpenses}
          homeOffice={props.homeOffice}
          vehicle={props.vehicle}
          depreciation={props.depreciation}
          netProfit={props.netProfit}
          seHealthInsurance={props.seHealthInsurance}
          seRetirement={props.seRetirement}
          seTaxDeductibleHalf={props.seTaxDeductibleHalf}
          onBarClick={props.onBarClick}
        />
      )}

      {view === 'sankey' && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading flow diagram...
            </div>
          }
        >
          <SEFlowSankey
            grossReceipts={props.grossReceipts}
            returnsAndAllowances={props.returnsAndAllowances}
            otherBusinessIncome={props.otherBusinessIncome}
            cogs={props.cogs}
            expenses={props.expenses}
            homeOffice={props.homeOffice}
            vehicle={props.vehicle}
            depreciation={props.depreciation}
            netProfit={props.netProfit}
            seHealthInsurance={props.seHealthInsurance}
            seRetirement={props.seRetirement}
            seTaxDeductibleHalf={props.seTaxDeductibleHalf}
            onNodeClick={props.onBarClick}
          />
        </Suspense>
      )}

      <p className="text-[11px] text-slate-500 text-center mt-1">
        Click any {view === 'sankey' ? 'node' : 'bar'} to jump to that section
      </p>
    </div>
  );
}
