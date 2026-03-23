import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { CalculationTrace } from '@telostax/engine';
import { formatCurrency } from '../../utils/format';

export default function TraceDisclosure({ trace }: { trace: CalculationTrace }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex items-center gap-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
      >
        <Info className="w-3 h-3" />
        <span>How?</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-1 ml-4 pl-2 border-l-2 border-slate-700 space-y-1">
          {/* Formula */}
          {trace.formula && (
            <p className="text-xs text-slate-400 font-mono">{trace.formula}</p>
          )}

          {/* Authority */}
          {trace.authority && (
            <p className="text-xs text-slate-600 italic">{trace.authority}</p>
          )}

          {/* Inputs */}
          {trace.inputs.length > 0 && (
            <div className="space-y-0.5">
              {trace.inputs.map((input, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-slate-400">{input.label}</span>
                  <span className="text-slate-400 font-mono">
                    {formatCurrency(input.value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Children (e.g., bracket breakdown) */}
          {trace.children && trace.children.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {trace.children.map((child, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-slate-400">
                    {child.label}
                    {child.formula && (
                      <span className="text-slate-600 ml-1 font-mono">({child.formula})</span>
                    )}
                  </span>
                  <span className="text-slate-400 font-mono">
                    {formatCurrency(child.value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Note */}
          {trace.note && (
            <p className="text-xs text-slate-400 italic mt-1">{trace.note}</p>
          )}
        </div>
      )}
    </div>
  );
}
