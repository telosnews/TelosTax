import { useState } from 'react';
import { PieChart, BarChart2 } from 'lucide-react';
import CreditsDonut from './CreditsDonut';
import CategoryBarChart from './CategoryBarChart';

type ViewMode = 'donut' | 'bar';

interface CreditItem {
  label: string;
  value: number;
  stepId: string;
  refundable: boolean;
}

interface CreditsChartSwitcherProps {
  items: CreditItem[];
  onSliceClick?: (stepId: string) => void;
}

const VIEW_MODES: { id: ViewMode; label: string; icon: typeof PieChart }[] = [
  { id: 'donut', label: 'Donut', icon: PieChart },
  { id: 'bar',   label: 'Bar',   icon: BarChart2 },
];

export default function CreditsChartSwitcher({ items, onSliceClick }: CreditsChartSwitcherProps) {
  const [view, setView] = useState<ViewMode>('donut');

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mt-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
          Credits Breakdown
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

      {/* Legend — shown for both views */}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-telos-orange-400" />
          <span className="text-[10px] text-slate-400">Nonrefundable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
          <span className="text-[10px] text-slate-400">Refundable</span>
        </div>
      </div>

      {view === 'donut' && (
        <CreditsDonut items={items} onSliceClick={onSliceClick} />
      )}

      {view === 'bar' && (
        <CategoryBarChart
          items={items.map(i => ({ label: i.label, value: i.value, stepId: i.stepId }))}
          onBarClick={onSliceClick}
          colors={items
            .sort((a, b) => b.value - a.value)
            .map(i => i.refundable ? '#34D399' : '#FB923C')}
        />
      )}

      <p className="text-[11px] text-slate-500 text-center mt-1">
        Click any {view === 'donut' ? 'slice' : 'bar'} to jump to that section
      </p>
    </div>
  );
}
