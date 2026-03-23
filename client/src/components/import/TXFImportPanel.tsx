import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle, ChevronDown, ChevronUp, Copy, FileCheck } from 'lucide-react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { batchAddIncomeItems, getReturn } from '../../api/client';
import { parseTXF, TXFParseResult } from '../../services/txfParser';
import { MAX_TXF_SIZE } from '../../services/importHelpers';
import { checkBatchForDuplicates } from '../../services/duplicateDetection';
import { toast } from 'sonner';
import FileDropZone from './FileDropZone';

type TXFState = 'upload' | 'preview' | 'importing' | 'done';

interface TXFImportPanelProps {
  onBack: () => void;
}

/** Map from TXF incomeType to the ARRAY_FIELD_MAP key used by batchAddIncomeItems */
const IMPORT_TYPE_MAP: Record<string, { apiType: string; field: string; discoveryKey: string }> = {
  '1099b': { apiType: '1099b', field: 'income1099B', discoveryKey: '1099b' },
  'w2':    { apiType: 'w2',    field: 'w2Income',     discoveryKey: 'w2' },
  '1099int': { apiType: '1099int', field: 'income1099INT', discoveryKey: '1099int' },
  '1099div': { apiType: '1099div', field: 'income1099DIV', discoveryKey: '1099div' },
  '1099r':   { apiType: '1099r',   field: 'income1099R',   discoveryKey: '1099r' },
};

export default function TXFImportPanel({ onBack }: TXFImportPanelProps) {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  const [state, setState] = useState<TXFState>('upload');
  const [result, setResult] = useState<TXFParseResult | null>(null);
  const [importedCounts, setImportedCounts] = useState<Record<string, number>>({});
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast.error('Could not read file');
        return;
      }
      try {
        const parsed = parseTXF(text);
        if (parsed.errors.length > 0 && parsed.totalRecords === 0) {
          toast.error(parsed.errors[0]);
          return;
        }
        setResult(parsed);
        setState('preview');
        if (parsed.warnings.length > 0) {
          toast.warning(`${parsed.warnings.length} warning(s) during parsing`);
        }
      } catch (err) {
        toast.error('Failed to parse TXF file');
        console.error('TXF parse error:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  const toggleExpand = useCallback((type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // Duplicate detection per type
  const dupeChecks = useMemo(() => {
    if (!taxReturn || !result || state !== 'preview') return {};
    const checks: Record<string, { duplicateCount: number; totalCount: number }> = {};
    for (const [type, group] of Object.entries(result.groupedByType)) {
      const validItems = group.items
        .filter(i => i.errors.length === 0)
        .map(i => i.data);
      if (validItems.length > 0) {
        checks[type] = checkBatchForDuplicates(taxReturn, type, validItems);
      }
    }
    return checks;
  }, [taxReturn, result, state]);

  const totalDupes = useMemo(() =>
    Object.values(dupeChecks).reduce((sum, c) => sum + c.duplicateCount, 0),
  [dupeChecks]);

  const handleImport = useCallback(() => {
    if (!result || !returnId || !taxReturn) return;
    setState('importing');

    try {
      const counts: Record<string, number> = {};
      const discoveryUpdates: Record<string, string> = {};

      for (const [type, group] of Object.entries(result.groupedByType)) {
        const mapping = IMPORT_TYPE_MAP[type];
        if (!mapping) continue;

        const validItems = group.items
          .filter(i => i.errors.length === 0)
          .map(i => i.data);

        if (validItems.length === 0) continue;

        const { count } = batchAddIncomeItems(returnId, mapping.apiType, validItems);
        counts[type] = count;
        discoveryUpdates[mapping.discoveryKey] = 'yes';
      }

      // Update income discovery for all imported types
      const discovery = { ...taxReturn.incomeDiscovery, ...discoveryUpdates };
      updateField('incomeDiscovery', discovery);

      // Sync in-memory store with localStorage for each imported type
      const freshReturn = getReturn(returnId);
      for (const [type] of Object.entries(counts)) {
        const mapping = IMPORT_TYPE_MAP[type];
        if (!mapping) continue;
        updateField(mapping.field, (freshReturn as unknown as Record<string, unknown>)[mapping.field] || []);
      }

      setImportedCounts(counts);
      setState('done');

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      toast.success(`${total} item${total !== 1 ? 's' : ''} imported`);
    } catch (err) {
      toast.error('Import failed');
      console.error('TXF import error:', err);
      setState('preview');
    }
  }, [result, returnId, taxReturn, updateField]);

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to import options
      </button>

      {/* ─── State: UPLOAD ─────────────────────────────── */}
      {state === 'upload' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Import TXF File</h3>
          <p className="text-sm text-slate-400">
            Upload a TXF (Tax Exchange Format) file exported from your brokerage or tax software.
            TXF files can contain W-2, 1099-B, 1099-INT, 1099-DIV, and 1099-R data.
          </p>
          <FileDropZone
            accept=".txf"
            onFile={handleFile}
            label="Drop your TXF file here"
            sublabel="Supports TXF v041/v042 from Fidelity, Schwab, E*Trade, Interactive Brokers, and others"
            maxSizeMB={MAX_TXF_SIZE / (1024 * 1024)}
          />
        </div>
      )}

      {/* ─── State: PREVIEW ────────────────────────────── */}
      {state === 'preview' && result && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Preview TXF Import</h3>

          {/* Header info */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-telos-blue-500/20 text-telos-blue-400 border border-telos-blue-500/30">
              {result.header.version}
            </span>
            {result.header.programName && (
              <span className="text-xs text-slate-400">
                from {result.header.programName}
              </span>
            )}
            <span className="text-xs text-slate-400">
              {result.totalRecords} records parsed
            </span>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card bg-surface-800 border-slate-700 p-3 text-center">
              <div className="text-2xl font-bold text-telos-blue-400">{result.validCount}</div>
              <div className="text-xs text-slate-400">Ready to import</div>
            </div>
            <div className="card bg-surface-800 border-slate-700 p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">
                {Object.values(result.groupedByType).reduce((sum, g) =>
                  sum + g.items.filter(i => i.warnings.length > 0 && i.errors.length === 0).length, 0)}
              </div>
              <div className="text-xs text-slate-400">With warnings</div>
            </div>
            <div className="card bg-surface-800 border-slate-700 p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{result.errorCount}</div>
              <div className="text-xs text-slate-400">Will be skipped</div>
            </div>
          </div>

          {/* Duplicate warning */}
          {totalDupes > 0 && (
            <div className="rounded-xl border bg-amber-500/10 border-amber-500/30 p-4">
              <div className="flex items-start gap-2.5">
                <Copy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300 mb-1">
                    {totalDupes} possible duplicate{totalDupes !== 1 ? 's' : ''} detected
                  </p>
                  <p className="text-xs text-amber-300/80">
                    Some items match data you&apos;ve already entered. Re-importing would double-count that income.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Global warnings */}
          {result.warnings.length > 0 && (
            <div className="rounded-xl border bg-amber-500/10 border-amber-500/30 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-300/80 space-y-1">
                  {result.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Grouped by income type */}
          <div className="space-y-2">
            {Object.entries(result.groupedByType).map(([type, group]) => {
              const expanded = expandedTypes.has(type);
              const typeValidCount = group.items.filter(i => i.errors.length === 0).length;
              const typeWarningCount = group.items.filter(i => i.warnings.length > 0 && i.errors.length === 0).length;
              const typeErrorCount = group.items.filter(i => i.errors.length > 0).length;
              const typeDupes = dupeChecks[type]?.duplicateCount || 0;

              return (
                <div key={type} className="card bg-surface-800 border-slate-700">
                  <button
                    onClick={() => toggleExpand(type)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-700/50 transition-colors rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono px-2.5 py-1 rounded bg-telos-blue-600/15 text-telos-blue-400 border border-telos-blue-600/20">
                        {group.label.split(' ')[0]}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-slate-200">
                          {group.count} {group.label.split(' ').slice(1).join(' ')}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-green-400">{typeValidCount} valid</span>
                          {typeWarningCount > 0 && <span className="text-xs text-amber-400">{typeWarningCount} warnings</span>}
                          {typeErrorCount > 0 && <span className="text-xs text-red-400">{typeErrorCount} errors</span>}
                          {typeDupes > 0 && <span className="text-xs text-amber-400">{typeDupes} dupes</span>}
                        </div>
                      </div>
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {/* Expanded detail — first 15 items */}
                  {expanded && (
                    <div className="px-3 pb-3">
                      <div className="overflow-x-auto border border-slate-700 rounded-lg mt-1">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-surface-900 border-b border-slate-700">
                              <th className="px-3 py-2 text-left text-slate-400 font-medium">#</th>
                              <th className="px-3 py-2 text-left text-slate-400 font-medium">Description</th>
                              {type === '1099b' && (
                                <>
                                  <th className="px-3 py-2 text-right text-slate-400 font-medium">Proceeds</th>
                                  <th className="px-3 py-2 text-right text-slate-400 font-medium">Cost Basis</th>
                                  <th className="px-3 py-2 text-right text-slate-400 font-medium">Gain/Loss</th>
                                  <th className="px-3 py-2 text-center text-slate-400 font-medium">Term</th>
                                </>
                              )}
                              {type === 'w2' && (
                                <>
                                  <th className="px-3 py-2 text-right text-slate-400 font-medium">Wages</th>
                                  <th className="px-3 py-2 text-right text-slate-400 font-medium">Fed Withheld</th>
                                </>
                              )}
                              {(type === '1099int' || type === '1099div') && (
                                <th className="px-3 py-2 text-right text-slate-400 font-medium">Amount</th>
                              )}
                              {type === '1099r' && (
                                <>
                                  <th className="px-3 py-2 text-right text-slate-400 font-medium">Distribution</th>
                                  <th className="px-3 py-2 text-center text-slate-400 font-medium">Type</th>
                                </>
                              )}
                              <th className="px-3 py-2 text-center text-slate-400 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.slice(0, 15).map((item, i) => {
                              const hasError = item.errors.length > 0;
                              const hasWarning = item.warnings.length > 0;

                              return (
                                <tr
                                  key={i}
                                  className={`border-b border-slate-800 ${hasError ? 'bg-red-500/5' : hasWarning ? 'bg-amber-500/5' : ''}`}
                                >
                                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                                  <td className="px-3 py-2 text-slate-300 max-w-[200px] truncate">
                                    {item.label}
                                  </td>
                                  {type === '1099b' && (() => {
                                    const proceeds = (item.data.proceeds as number) || 0;
                                    const basis = (item.data.costBasis as number) || 0;
                                    const gl = proceeds - basis;
                                    return (
                                      <>
                                        <td className="px-3 py-2 text-right text-slate-300">${proceeds.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-right text-slate-300">${basis.toLocaleString()}</td>
                                        <td className={`px-3 py-2 text-right font-medium ${gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                          {gl >= 0 ? '+' : ''}${gl.toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-center text-slate-400">
                                          {item.data.isLongTerm ? 'LT' : 'ST'}
                                        </td>
                                      </>
                                    );
                                  })()}
                                  {type === 'w2' && (
                                    <>
                                      <td className="px-3 py-2 text-right text-slate-300">
                                        ${((item.data.wages as number) || 0).toLocaleString()}
                                      </td>
                                      <td className="px-3 py-2 text-right text-slate-300">
                                        ${((item.data.federalTaxWithheld as number) || 0).toLocaleString()}
                                      </td>
                                    </>
                                  )}
                                  {type === '1099int' && (
                                    <td className="px-3 py-2 text-right text-slate-300">
                                      ${((item.data.amount as number) || 0).toLocaleString()}
                                    </td>
                                  )}
                                  {type === '1099div' && (
                                    <td className="px-3 py-2 text-right text-slate-300">
                                      ${((item.data.ordinaryDividends as number) || 0).toLocaleString()}
                                    </td>
                                  )}
                                  {type === '1099r' && (
                                    <>
                                      <td className="px-3 py-2 text-right text-slate-300">
                                        ${((item.data.grossDistribution as number) || 0).toLocaleString()}
                                      </td>
                                      <td className="px-3 py-2 text-center text-slate-400">
                                        {item.data.isIRA ? 'IRA' : 'Pension'}
                                      </td>
                                    </>
                                  )}
                                  <td className="px-3 py-2 text-center">
                                    {hasError ? (
                                      <span className="text-red-400" title={item.errors.join(', ')}>Skip</span>
                                    ) : hasWarning ? (
                                      <span className="text-amber-400" title={item.warnings.join(', ')}>
                                        <AlertTriangle className="w-3.5 h-3.5 inline" />
                                      </span>
                                    ) : (
                                      <span className="text-green-400">OK</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {group.items.length > 15 && (
                          <div className="px-3 py-2 text-xs text-slate-400 bg-surface-900 text-center">
                            Showing first 15 of {group.items.length} items
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => { setResult(null); setState('upload'); }}
              className="px-4 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Start Over
            </button>
            <button
              onClick={handleImport}
              disabled={result.validCount === 0}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                totalDupes > 0
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-telos-orange-500 hover:bg-telos-orange-400 text-white'
              }`}
            >
              {totalDupes > 0
                ? `Import Anyway (${result.validCount})`
                : `Import ${result.validCount} Item${result.validCount !== 1 ? 's' : ''}`
              }
            </button>
          </div>
        </div>
      )}

      {/* ─── State: IMPORTING ──────────────────────────── */}
      {state === 'importing' && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-telos-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-300">Importing tax data...</p>
        </div>
      )}

      {/* ─── State: DONE ──────────────────────────────── */}
      {state === 'done' && (
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-200 mb-2">Import Complete</h3>
          <div className="space-y-1 mb-6">
            {Object.entries(importedCounts).map(([type, count]) => (
              <p key={type} className="text-sm text-slate-400">
                <span className="text-slate-300 font-medium">{count}</span>{' '}
                {IMPORT_TYPE_MAP[type]
                  ? type === '1099b' ? '1099-B transaction' + (count !== 1 ? 's' : '')
                    : type === 'w2' ? 'W-2' + (count !== 1 ? 's' : '')
                    : type === '1099int' ? '1099-INT interest record' + (count !== 1 ? 's' : '')
                    : type === '1099div' ? '1099-DIV dividend record' + (count !== 1 ? 's' : '')
                    : type === '1099r' ? '1099-R distribution' + (count !== 1 ? 's' : '')
                    : type
                  : type
                }
              </p>
            ))}
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setResult(null);
                setImportedCounts({});
                setState('upload');
              }}
              className="px-4 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
