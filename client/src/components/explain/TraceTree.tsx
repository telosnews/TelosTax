/**
 * TraceTree — recursive, interactive trace explorer.
 *
 * Renders the engine's CalculationTrace tree as an expandable hierarchy.
 * Each node shows the computed value, formula, legal authority, inputs,
 * and nested children. Users can drill into any level.
 *
 * Entries that map to an IRS form are clickable — clicking navigates
 * to that form in Forms Mode.
 */

import { useState } from 'react';
import type { CalculationTrace } from '@telostax/engine';
import { ChevronRight, ChevronDown, Scale, Hash, BookOpen, FileText } from 'lucide-react';
import { resolveFormFromLineId } from '../../services/traceFormLinker';

interface TraceTreeProps {
  traces: CalculationTrace[];
  onNavigateToForm?: (lineId: string) => void;
}

export default function TraceTree({ traces, onNavigateToForm }: TraceTreeProps) {
  if (traces.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic text-center py-4">
        No trace data available. Traces are generated when the engine runs with tracing enabled.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {traces.map((trace) => (
        <TraceNode key={trace.lineId} trace={trace} depth={0} onNavigateToForm={onNavigateToForm} />
      ))}
    </div>
  );
}

function TraceNode({ trace, depth, onNavigateToForm }: { trace: CalculationTrace; depth: number; onNavigateToForm?: (lineId: string) => void }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasDetails = trace.inputs.length > 0 || (trace.children && trace.children.length > 0) || trace.formula || trace.authority;
  const indent = Math.min(depth * 12, 48); // Cap indentation
  const isLinkable = !!resolveFormFromLineId(trace.lineId);

  return (
    <div style={{ marginLeft: indent }}>
      {/* Node header */}
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`
          w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left
          transition-colors duration-150
          ${hasDetails ? 'hover:bg-surface-700/50 cursor-pointer' : 'cursor-default'}
          ${expanded && hasDetails ? 'bg-surface-800/50' : ''}
        `}
      >
        {/* Expand/collapse icon */}
        <div className="w-4 shrink-0">
          {hasDetails ? (
            expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-slate-600 ml-1" />
          )}
        </div>

        {/* Line ID badge — clickable if linkable */}
        {isLinkable && onNavigateToForm ? (
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onNavigateToForm(trace.lineId); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onNavigateToForm(trace.lineId); } }}
            className="text-[10px] font-mono text-telos-blue-400 bg-surface-900 px-1.5 py-0.5 rounded shrink-0 inline-flex items-center gap-1 cursor-pointer hover:underline hover:bg-surface-800 transition-colors"
          >
            <FileText className="w-2.5 h-2.5" />
            {trace.lineId}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-slate-600 bg-surface-900 px-1.5 py-0.5 rounded shrink-0">
            {trace.lineId}
          </span>
        )}

        {/* Label */}
        <span className="text-xs text-slate-300 flex-1 truncate">{trace.label}</span>

        {/* Value */}
        <span className="text-xs font-mono font-semibold text-white shrink-0">
          ${trace.value.toLocaleString()}
        </span>
      </button>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="ml-6 pl-3 border-l-2 border-slate-800 space-y-1.5 py-1.5">
          {/* Formula */}
          {trace.formula && (
            <div className="flex items-start gap-2">
              <Hash className="w-3 h-3 text-slate-600 mt-0.5 shrink-0" />
              <span className="text-xs text-slate-400 font-mono">{trace.formula}</span>
            </div>
          )}

          {/* Authority */}
          {trace.authority && (
            <div className="flex items-start gap-2">
              <Scale className="w-3 h-3 text-slate-600 mt-0.5 shrink-0" />
              <span className="text-xs text-slate-400 italic">{trace.authority}</span>
            </div>
          )}

          {/* Note */}
          {trace.note && (
            <div className="flex items-start gap-2">
              <BookOpen className="w-3 h-3 text-slate-600 mt-0.5 shrink-0" />
              <span className="text-xs text-slate-400">{trace.note}</span>
            </div>
          )}

          {/* Inputs */}
          {trace.inputs.length > 0 && (
            <div className="space-y-0.5 mt-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Inputs</p>
              {trace.inputs.map((input, i) => {
                const inputLinkable = !!resolveFormFromLineId(input.lineId) && !!onNavigateToForm;
                return inputLinkable ? (
                  <button
                    key={i}
                    onClick={() => onNavigateToForm(input.lineId)}
                    className="w-full flex justify-between items-center text-xs px-2 py-0.5 rounded bg-surface-900/30 hover:bg-surface-800/50 cursor-pointer transition-colors text-left group"
                  >
                    <span className="text-slate-400">
                      <span className="font-mono text-[10px] text-telos-blue-400 mr-1.5 group-hover:underline inline-flex items-center gap-0.5">
                        <FileText className="w-2.5 h-2.5 inline" />
                        {input.lineId}
                      </span>
                      {input.label}
                    </span>
                    <span className="text-slate-400 font-mono">${input.value.toLocaleString()}</span>
                  </button>
                ) : (
                  <div key={i} className="flex justify-between items-center text-xs px-2 py-0.5 rounded bg-surface-900/30">
                    <span className="text-slate-400">
                      <span className="font-mono text-[10px] text-slate-600 mr-1.5">{input.lineId}</span>
                      {input.label}
                    </span>
                    <span className="text-slate-400 font-mono">${input.value.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Children — recursive! */}
          {trace.children && trace.children.length > 0 && (
            <div className="space-y-0.5 mt-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Breakdown</p>
              {trace.children.map((child) => (
                <TraceNode key={child.lineId} trace={child} depth={depth + 1} onNavigateToForm={onNavigateToForm} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
