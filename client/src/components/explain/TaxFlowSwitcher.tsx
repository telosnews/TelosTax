/**
 * TaxFlowSwitcher — toggle between Waterfall and Sankey tax flow views.
 *
 * The Sankey diagram is lazy-loaded to avoid bloating the initial bundle.
 */

import { useState, lazy, Suspense } from 'react';
import { BarChart3, GitBranch } from 'lucide-react';
import type { Form1040Result, CalculationResult } from '@telostax/engine';
import TaxFlowDiagram from './TaxFlowDiagram';

const TaxSankeyDiagram = lazy(() => import('./TaxSankeyDiagram'));

type FlowView = 'waterfall' | 'sankey';

interface TaxFlowSwitcherProps {
  form1040: Form1040Result;
  calculation: CalculationResult;
}

const VIEW_MODES: { id: FlowView; label: string; icon: typeof BarChart3 }[] = [
  { id: 'waterfall', label: 'Waterfall', icon: BarChart3 },
  { id: 'sankey',    label: 'Flow',      icon: GitBranch },
];

export default function TaxFlowSwitcher({ form1040, calculation }: TaxFlowSwitcherProps) {
  const [view, setView] = useState<FlowView>('waterfall');

  return (
    <div>
      {/* Toggle buttons */}
      <div className="flex items-center justify-end mb-3">
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

      {/* Diagram */}
      {view === 'waterfall' ? (
        <TaxFlowDiagram form1040={form1040} />
      ) : (
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-[400px] text-slate-400 text-sm">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading flow diagram...
            </div>
          }
        >
          <TaxSankeyDiagram form1040={form1040} calculation={calculation} />
        </Suspense>
      )}
    </div>
  );
}
