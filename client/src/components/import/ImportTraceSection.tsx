/**
 * ImportTraceSection — collapsible panel showing extraction trace details.
 *
 * Explains how the PDF importer detected the form type and which fields
 * were successfully extracted, with confidence reasoning.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Search, CheckCircle2, XCircle } from 'lucide-react';
import type { ImportTrace } from '../../services/pdfExtractHelpers';

interface ImportTraceSectionProps {
  trace: ImportTrace;
}

const CONFIDENCE_STYLES = {
  high: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-red-500/20 text-red-400 border-red-500/30',
} as const;

export default function ImportTraceSection({ trace }: ImportTraceSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const foundCount = trace.fields.filter(f => f.status === 'found').length;
  const totalCount = trace.fields.length;

  return (
    <div className="rounded-lg bg-surface-800/50 border border-slate-700/40">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-700/30 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">
            Extraction Details
          </span>
          <span className="text-[10px] text-slate-400">
            {foundCount}/{totalCount} fields
          </span>
        </div>
        {isOpen
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        }
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-3 pb-3 space-y-3">
          {/* Form detection */}
          <div className="rounded-md bg-surface-900/50 border border-slate-700/30 p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <h5 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Form Detection</h5>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${CONFIDENCE_STYLES[trace.formDetection.confidence]}`}>
                {trace.formDetection.confidence}
              </span>
            </div>
            <p className="text-xs text-slate-400">{trace.formDetection.reasoning}</p>
            {trace.formDetection.matchedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {trace.formDetection.matchedKeywords.map((kw, i) => (
                  <span key={i} className="text-[10px] bg-telos-blue-500/10 text-telos-blue-400 border border-telos-blue-500/20 rounded px-1.5 py-0.5">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Field trace */}
          <div className="rounded-md bg-surface-900/50 border border-slate-700/30 p-2.5">
            <h5 className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              Field Extraction ({foundCount} of {totalCount})
            </h5>
            <div className="space-y-1">
              {trace.fields.map((entry) => (
                <div key={entry.field} className="flex items-start gap-2">
                  {entry.status === 'found' ? (
                    <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3 h-3 text-slate-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`text-xs ${entry.status === 'found' ? 'text-slate-300' : 'text-slate-400'}`}>
                        {entry.label}
                      </span>
                      {entry.value && (
                        <span className="text-xs font-medium text-slate-200 shrink-0">
                          {entry.value}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-600">{entry.reasoning}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scan stats */}
          <p className="text-[10px] text-slate-600 text-center">
            {trace.textBlockCount} text blocks scanned across {trace.pagesScanned} page{trace.pagesScanned !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
