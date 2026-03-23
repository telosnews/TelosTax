/**
 * InlineCSVImport — an inline CSV import panel pre-set to a single target type.
 *
 * Embeds directly within 1099-B or 1099-DA step pages. Handles the full
 * CSV import workflow: select broker → upload → map columns → preview → import.
 *
 * Uses the same CSVImportPanel logic but streamlined for inline use —
 * the target type is pre-selected so users skip that step.
 */

import { useState, useCallback } from 'react';
import { X, CheckCircle2, Loader2, AlertTriangle, BarChart3, FileSpreadsheet } from 'lucide-react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { batchAddIncomeItems, getReturn } from '../../api/client';
import { parseCSV, ColumnMapping, CSVParseResult } from '../../services/csvParser';
import { MAX_CSV_SIZE } from '../../services/importHelpers';
import { toast } from 'sonner';
import FileDropZone from './FileDropZone';
import ColumnMappingEditor from './ColumnMappingEditor';

type InlineCSVState = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

interface InlineCSVImportProps {
  /** Pre-selected target type */
  targetType: '1099b' | '1099da';
  /** Human-readable label */
  formLabel: string;
  /** Called when user closes the inline import */
  onClose: () => void;
  /** Called after successful import so the parent step can refresh */
  onImported?: () => void;
}

export default function InlineCSVImport({ targetType, formLabel, onClose, onImported }: InlineCSVImportProps) {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  const [state, setState] = useState<InlineCSVState>('upload');
  const [brokerName, setBrokerName] = useState('');
  const [result, setResult] = useState<CSVParseResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast.error('Could not read file');
        return;
      }
      try {
        const parsed = parseCSV(text, targetType, brokerName || undefined);
        setResult(parsed);
        if (!brokerName && parsed.detectedFormat !== 'generic') {
          setBrokerName(parsed.detectedFormat.charAt(0).toUpperCase() + parsed.detectedFormat.slice(1));
        }
        setState('mapping');
      } catch (err) {
        toast.error('Failed to parse CSV file');
        console.error('CSV parse error:', err);
      }
    };
    reader.readAsText(file);
  }, [targetType, brokerName]);

  const handleMappingChange = useCallback((newMapping: ColumnMapping) => {
    if (!result) return;
    setResult({ ...result, mapping: newMapping });
  }, [result]);

  const handleImport = useCallback(() => {
    if (!result || !returnId || !taxReturn) return;
    setState('importing');

    try {
      const items = result.mappedRows
        .filter(r => r.errors.length === 0)
        .map(r => r.data);

      if (items.length === 0) {
        toast.error('No valid rows to import');
        setState('preview');
        return;
      }

      const type = targetType === '1099da' ? '1099da' : '1099b';
      const { count } = batchAddIncomeItems(returnId, type, items);

      // Auto-set income discovery
      const discoveryKey = targetType === '1099da' ? '1099da' : '1099b';
      const discovery = { ...taxReturn.incomeDiscovery, [discoveryKey]: 'yes' };
      updateField('incomeDiscovery', discovery);

      // Sync in-memory store with what batchAddIncomeItems wrote to localStorage
      const field = type === '1099da' ? 'income1099DA' : 'income1099B';
      const freshReturn = getReturn(returnId);
      updateField(field, (freshReturn as any)[field] || []);

      setImportedCount(count);
      setState('done');
      toast.success(`${count} transactions imported`);
      onImported?.();
    } catch (err) {
      toast.error('Import failed');
      console.error('Import error:', err);
      setState('preview');
    }
  }, [result, returnId, taxReturn, targetType, updateField, onImported]);

  const existingCount = taxReturn
    ? (targetType === '1099da'
        ? (taxReturn.income1099DA || []).length
        : (taxReturn.income1099B || []).length)
    : 0;

  return (
    <div className="card bg-surface-800/80 border-telos-blue-500/30 mt-2 mb-4 relative">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-300 transition-colors rounded-md hover:bg-surface-700"
        aria-label="Close import"
      >
        <X className="w-4 h-4" />
      </button>

      {/* ─── UPLOAD ─────────────────────────────── */}
      {state === 'upload' && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-200 pr-8">
            Import {formLabel} from CSV
          </h4>
          <p className="text-xs text-slate-400">
            Supports Schwab, Fidelity, E*Trade, Robinhood, Coinbase, and generic CSV formats.
          </p>

          {/* Broker name */}
          <div>
            <label className="label text-xs">Broker / Exchange Name (optional)</label>
            <input
              className="input-field text-sm"
              value={brokerName}
              onChange={(e) => setBrokerName(e.target.value)}
              placeholder="e.g. Schwab, Fidelity, Coinbase"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">We'll auto-detect if you leave this blank</p>
          </div>

          <FileDropZone
            accept=".csv"
            onFile={handleFile}
            label={`Drop your ${formLabel} CSV here`}
            sublabel="Supports major brokerage export formats"
            maxSizeMB={MAX_CSV_SIZE / (1024 * 1024)}
          />
        </div>
      )}

      {/* ─── MAPPING ────────────────────────────── */}
      {state === 'mapping' && result && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-200 pr-8">Column Mapping</h4>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Detected format:</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-telos-blue-500/20 text-telos-blue-400 border border-telos-blue-500/30">
              {result.detectedFormat === 'generic' ? 'Generic' : result.detectedFormat.charAt(0).toUpperCase() + result.detectedFormat.slice(1)}
            </span>
            <span className="text-[10px] text-slate-400">{result.rawRowCount} rows</span>
          </div>

          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <ColumnMappingEditor
              headers={result.headers}
              mapping={result.mapping}
              targetType={targetType}
              onChange={handleMappingChange}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setResult(null); setState('upload'); }}
              className="px-3 py-1.5 text-xs font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Start Over
            </button>
            <button
              onClick={() => setState('preview')}
              className="px-3 py-1.5 text-xs font-medium bg-telos-orange-500 hover:bg-telos-orange-400 text-white rounded-lg transition-colors"
            >
              Preview
            </button>
          </div>
        </div>
      )}

      {/* ─── PREVIEW ────────────────────────────── */}
      {state === 'preview' && result && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-200 pr-8">Preview Import</h4>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface-900/50 border border-slate-700 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-telos-blue-400">{result.validCount}</div>
              <div className="text-[10px] text-slate-400">Ready</div>
            </div>
            <div className="bg-surface-900/50 border border-slate-700 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-amber-400">{result.warningCount}</div>
              <div className="text-[10px] text-slate-400">Warnings</div>
            </div>
            <div className="bg-surface-900/50 border border-slate-700 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-red-400">{result.skippedCount}</div>
              <div className="text-[10px] text-slate-400">Skipped</div>
            </div>
          </div>

          {existingCount > 0 && (
            <div className="bg-telos-blue-600/10 border border-telos-blue-600/30 rounded-lg p-2 text-xs text-telos-blue-300">
              You already have <strong>{existingCount}</strong> {formLabel} transactions.
              These <strong>{result.validCount}</strong> new ones will be added.
            </div>
          )}

          {/* Compact preview table */}
          <div className="overflow-x-auto border border-slate-700 rounded-lg max-h-60 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0">
                <tr className="bg-surface-800 border-b border-slate-700">
                  <th className="px-2 py-1.5 text-left text-slate-400">#</th>
                  <th className="px-2 py-1.5 text-left text-slate-400">Description</th>
                  <th className="px-2 py-1.5 text-right text-slate-400">Proceeds</th>
                  <th className="px-2 py-1.5 text-right text-slate-400">Basis</th>
                  <th className="px-2 py-1.5 text-right text-slate-400">G/L</th>
                  <th className="px-2 py-1.5 text-center text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.mappedRows.slice(0, 15).map((row, i) => {
                  const proceeds = (row.data.proceeds as number) || 0;
                  const basis = (row.data.costBasis as number) || 0;
                  const gl = proceeds - basis;
                  const hasError = row.errors.length > 0;
                  const hasWarning = row.warnings.length > 0;

                  return (
                    <tr key={i} className={`border-b border-slate-800 ${hasError ? 'bg-red-500/5' : hasWarning ? 'bg-amber-500/5' : ''}`}>
                      <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                      <td className="px-2 py-1 text-slate-300 max-w-[140px] truncate">
                        {(row.data.description || row.data.tokenName || '') as string}
                      </td>
                      <td className="px-2 py-1 text-right text-slate-300">${proceeds.toLocaleString()}</td>
                      <td className="px-2 py-1 text-right text-slate-300">${basis.toLocaleString()}</td>
                      <td className={`px-2 py-1 text-right font-medium ${gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {gl >= 0 ? '+' : ''}${gl.toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {hasError ? (
                          <span className="text-red-400">Skip</span>
                        ) : hasWarning ? (
                          <AlertTriangle className="w-3 h-3 inline text-amber-400" />
                        ) : (
                          <span className="text-green-400">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {result.rawRowCount > 15 && (
              <div className="px-2 py-1.5 text-[10px] text-slate-400 bg-surface-800 text-center">
                Showing first 15 of {result.rawRowCount} rows
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setState('mapping')}
              className="px-3 py-1.5 text-xs font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={result.validCount === 0}
              className="px-3 py-1.5 text-xs font-medium bg-telos-orange-500 hover:bg-telos-orange-400 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Import {result.validCount} Transaction{result.validCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ─── IMPORTING ──────────────────────────── */}
      {state === 'importing' && (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 text-telos-blue-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-300">Importing transactions...</p>
        </div>
      )}

      {/* ─── DONE ───────────────────────────────── */}
      {state === 'done' && (
        <div className="text-center py-6">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-200 mb-1">Import Complete</p>
          <p className="text-xs text-slate-400 mb-3">
            {importedCount} {formLabel} transaction{importedCount !== 1 ? 's' : ''} imported.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => { setResult(null); setImportedCount(0); setState('upload'); }}
              className="px-3 py-1.5 text-xs font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Import More
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium bg-telos-blue-600 hover:bg-telos-blue-500 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
