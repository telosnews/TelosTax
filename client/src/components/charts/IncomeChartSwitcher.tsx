import { useState } from 'react';
import { PieChart, BarChart2 } from 'lucide-react';
import IncomeDonut from './IncomeDonut';
import CategoryBarChart from './CategoryBarChart';

type ViewMode = 'donut' | 'bar';

interface IncomeChartSwitcherProps {
  items: Array<{ label: string; value: number; stepId: string }>;
  onSliceClick?: (stepId: string) => void;
}

const VIEW_MODES: { id: ViewMode; label: string; icon: typeof PieChart }[] = [
  { id: 'donut', label: 'Donut', icon: PieChart },
  { id: 'bar',   label: 'Bar',   icon: BarChart2 },
];

export default function IncomeChartSwitcher({ items, onSliceClick }: IncomeChartSwitcherProps) {
  const [view, setView] = useState<ViewMode>('donut');

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mt-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
          Income Breakdown
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

      {view === 'donut' && (
        <IncomeDonut items={items} onSliceClick={onSliceClick} />
      )}

      {view === 'bar' && (
        <CategoryBarChart items={items} onBarClick={onSliceClick} />
      )}

      <p className="text-[11px] text-slate-500 text-center mt-1">
        Click any {view === 'donut' ? 'slice' : 'bar'} to jump to that section
      </p>
    </div>
  );
}
