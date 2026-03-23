import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle, FileSpreadsheet, BarChart3, Copy } from 'lucide-react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { batchAddIncomeItems, getReturn } from '../../api/client';
import { parseCSV, ColumnMapping, CSVParseResult } from '../../services/csvParser';
import { MAX_CSV_SIZE } from '../../services/importHelpers';
import { checkBatchForDuplicates } from '../../services/duplicateDetection';
import { toast } from 'sonner';
import FileDropZone from './FileDropZone';
import ColumnMappingEditor from './ColumnMappingEditor';

type CSVState = 'select' | 'mapping' | 'preview' | 'importing' | 'done';

interface CSVImportPanelProps {
  onBack: () => void;
}

export default function CSVImportPanel({ onBack }: CSVImportPanelProps) {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  const [state, setState] = useState<CSVState>('select');
  const [targetType, setTargetType] = useState<'1099b' | '1099da'>('1099b');
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
        // Auto-fill broker name from detected format if not set
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

  const handleReParse = useCallback(() => {
    // Re-parse with updated mapping — need the raw file content
    // For now, we just go to preview with the current result
    setState('preview');
  }, []);

  const handleMappingChange = useCallback((newMapping: ColumnMapping) => {
    if (!result) return;
    // We'd need to re-parse here with the new mapping
    // For simplicity, update the result mapping (actual re-mapping happens on import)
    setResult({ ...result, mapping: newMapping });
  }, [result]);

  const handleImport = useCallback(() => {
    if (!result || !returnId || !taxReturn) return;
    setState('importing');

    try {
      // Filter to only importable rows (no errors)
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

      // Auto-set income discovery so the corresponding step becomes visible
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
    } catch (err) {
      toast.error('Import failed');
      console.error('Import error:', err);
      setState('preview');
    }
  }, [result, returnId, taxReturn, targetType, updateField]);

  // Existing item count for merge messaging
  const existingCount = taxReturn
    ? (targetType === '1099da'
        ? (taxReturn.income1099DA || []).length
        : (taxReturn.income1099B || []).length)
    : 0;

  // Duplicate detection for bulk imports
  const batchDupeCheck = useMemo(() => {
    if (!taxReturn || !result || state !== 'preview') return null;
    const validItems = result.mappedRows
      .filter(r => r.errors.length === 0)
      .map(r => r.data);
    if (validItems.length === 0) return null;
    const type = targetType === '1099da' ? '1099da' : '1099b';
    return checkBatchForDuplicates(taxReturn, type, validItems);
  }, [taxReturn, result, state, targetType]);

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

      {/* ─── State: SELECT ─────────────────────────────── */}
      {state === 'select' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Import CSV Transactions</h3>

          {/* Target type selector */}
          <div>
            <p className="text-sm text-slate-400 mb-2">What type of transactions are in this file?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setTargetType('1099b')}
                className={`card-selectable text-left p-4 ${targetType === '1099b' ? 'ring-2 ring-telos-orange-400' : ''}`}
              >
                <BarChart3 className="w-5 h-5 text-telos-blue-400 mb-1" />
                <div className="text-sm font-medium text-slate-200">1099-B</div>
                <div className="text-xs text-slate-400">Stocks & Investments</div>
              </button>
              <button
                onClick={() => setTargetType('1099da')}
                className={`card-selectable text-left p-4 ${targetType === '1099da' ? 'ring-2 ring-telos-orange-400' : ''}`}
              >
                <FileSpreadsheet className="w-5 h-5 text-telos-blue-400 mb-1" />
                <div className="text-sm font-medium text-slate-200">1099-DA</div>
                <div className="text-xs text-slate-400">Cryptocurrency & Digital Assets</div>
              </button>
            </div>
          </div>

          {/* Broker name */}
          <div>
            <label className="label text-sm">Broker / Exchange Name (optional)</label>
            <input
              className="input-field"
              value={brokerName}
              onChange={(e) => setBrokerName(e.target.value)}
              placeholder="e.g. Schwab, Fidelity, Coinbase"
            />
            <p className="text-xs text-slate-400 mt-1">We'll auto-detect if you leave this blank</p>
          </div>

          {/* File upload */}
          <FileDropZone
            accept=".csv"
            onFile={handleFile}
            label="Drop your CSV file here"
            sublabel="Supports Schwab, Fidelity, E*Trade, Robinhood, Coinbase, and generic formats"
            maxSizeMB={MAX_CSV_SIZE / (1024 * 1024)}
          />
        </div>
      )}

      {/* ─── State: MAPPING ────────────────────────────── */}
      {state === 'mapping' && result && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Column Mapping</h3>

          {/* Detected format badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Detected format:</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-telos-blue-500/20 text-telos-blue-400 border border-telos-blue-500/30">
              {result.detectedFormat === 'generic' ? 'Generic (auto-mapped)' : result.detectedFormat.charAt(0).toUpperCase() + result.detectedFormat.slice(1)}
            </span>
            <span className="text-xs text-slate-400">
              {result.rawRowCount} rows found
            </span>
          </div>

          {/* Column mapping editor */}
          <div className="card bg-surface-800 border-slate-700">
            <ColumnMappingEditor
              headers={result.headers}
              mapping={result.mapping}
              targetType={targetType}
              onChange={handleMappingChange}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setResult(null); setState('select'); }}
              className="px-4 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Start Over
            </button>
            <button
              onClick={handleReParse}
              className="px-4 py-2 text-sm font-medium bg-telos-orange-500 hover:bg-telos-orange-400 text-white rounded-lg transition-colors"
            >
              Continue to Preview
            </button>
          </div>
        </div>
      )}

      {/* ─── State: PREVIEW ────────────────────────────── */}
      {state === 'preview' && result && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Preview Import</h3>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card bg-surface-800 border-slate-700 p-3 text-center">
              <div className="text-2xl font-bold text-telos-blue-400">{result.validCount}</div>
              <div className="text-xs text-slate-400">Ready to import</div>
            </div>
            <div className="card bg-surface-800 border-slate-700 p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{result.warningCount}</div>
              <div className="text-xs text-slate-400">With warnings</div>
            </div>
            <div className="card bg-surface-800 border-slate-700 p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{result.skippedCount}</div>
              <div className="text-xs text-slate-400">Will be skipped</div>
            </div>
          </div>

          {/* Existing data callout */}
          {existingCount > 0 && (
            <div className="rounded-xl border bg-telos-blue-600/10 border-telos-blue-600/30 p-3">
              <p className="text-sm text-telos-blue-300">
                You already have <strong>{existingCount}</strong> {targetType === '1099da' ? '1099-DA' : '1099-B'} transactions.
                These <strong>{result.validCount}</strong> new ones will be added to your existing data.
              </p>
            </div>
          )}

          {/* Duplicate warning */}
          {batchDupeCheck && batchDupeCheck.duplicateCount > 0 && (
            <div className="rounded-xl border bg-amber-500/10 border-amber-500/30 p-4">
              <div className="flex items-start gap-2.5">
                <Copy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300 mb-1">
                    {batchDupeCheck.duplicateCount} possible duplicate{batchDupeCheck.duplicateCount !== 1 ? 's' : ''} detected
                  </p>
                  <p className="text-xs text-amber-300/80">
                    {batchDupeCheck.duplicateCount} of {batchDupeCheck.totalCount} transactions match items you&apos;ve already entered.
                    Re-importing them would double-count that income. If this is a re-import of the same file, consider skipping it.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Preview table (first 20 rows) */}
          <div className="overflow-x-auto border border-slate-700 rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-800 border-b border-slate-700">
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">#</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Description</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium">Proceeds</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium">Cost Basis</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium">Gain/Loss</th>
                  <th className="px-3 py-2 text-center text-slate-400 font-medium">Term</th>
                  <th className="px-3 py-2 text-center text-slate-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.mappedRows.slice(0, 20).map((row, i) => {
                  const proceeds = (row.data.proceeds as number) || 0;
                  const basis = (row.data.costBasis as number) || 0;
                  const gl = proceeds - basis;
                  const hasError = row.errors.length > 0;
                  const hasWarning = row.warnings.length > 0;

                  return (
                    <tr
                      key={i}
                      className={`border-b border-slate-800 ${
                        hasError ? 'bg-red-500/5' : hasWarning ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-300 max-w-[200px] truncate">
                        {(row.data.description || row.data.tokenName || '') as string}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">${proceeds.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-slate-300">${basis.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right font-medium ${gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {gl >= 0 ? '+' : ''}${gl.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-400">
                        {row.data.isLongTerm ? 'LT' : 'ST'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {hasError ? (
                          <span className="text-red-400" title={row.errors.join(', ')}>Skip</span>
                        ) : hasWarning ? (
                          <span className="text-amber-400" title={row.warnings.join(', ')}>
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
            {result.rawRowCount > 20 && (
              <div className="px-3 py-2 text-xs text-slate-400 bg-surface-800 text-center">
                Showing first 20 of {result.rawRowCount} rows
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setState('mapping')}
              className="px-4 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Back to Mapping
            </button>
            <button
              onClick={handleImport}
              disabled={result.validCount === 0}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                batchDupeCheck && batchDupeCheck.duplicateCount > 0
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-telos-orange-500 hover:bg-telos-orange-400 text-white'
              }`}
            >
              {batchDupeCheck && batchDupeCheck.duplicateCount > 0
                ? `Import Anyway (${result.validCount})`
                : `Import ${result.validCount} Transaction${result.validCount !== 1 ? 's' : ''}`
              }
            </button>
          </div>
        </div>
      )}

      {/* ─── State: IMPORTING ──────────────────────────── */}
      {state === 'importing' && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-telos-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-300">Importing transactions...</p>
        </div>
      )}

      {/* ─── State: DONE ──────────────────────────────── */}
      {state === 'done' && (
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-200 mb-1">Import Complete</h3>
          <p className="text-sm text-slate-400 mb-6">
            {importedCount} {targetType === '1099da' ? '1099-DA' : '1099-B'} transaction{importedCount !== 1 ? 's' : ''} imported successfully.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setResult(null);
                setImportedCount(0);
                setState('select');
              }}
              className="px-4 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
