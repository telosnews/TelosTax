/**
 * YoY Comparison Card — "LookBack" feature
 *
 * Shows year-over-year comparison between current and prior-year tax returns.
 * Two states:
 * 1. No prior-year data: compact upload area accepting .json or .pdf
 * 2. Has prior-year data: comparison grid with delta indicators
 */

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import {
  TrendingUp, TrendingDown, ArrowRight, FileInput, X, Trash2, History, Copy,
} from 'lucide-react';
import type { PriorYearSummary, TaxReturn } from '@telostax/engine';
import type { Form1040Result } from '@telostax/engine';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { importPriorYearJSON, importPriorYear1040PDF } from '../../services/priorYearImporter';
import { buildTemplateItems, type TemplateImportManifest } from '../../services/priorYearTemplateBuilder';
import PriorYearTemplatePanel from '../import/PriorYearTemplatePanel';
import YoYWaterfall from './YoYWaterfall';
import YoYPairedBars from './YoYPairedBars';

interface YoYComparisonCardProps {
  priorYear?: PriorYearSummary;
  current: Form1040Result;
}

// ─── Metric row ────────────────────────────────────

function MetricRow({ label, prior, current, format = 'dollar' }: {
  label: string;
  prior: number;
  current: number;
  format?: 'dollar' | 'percent';
}) {
  const delta = current - prior;
  const isUp = delta > 0;
  const isZero = Math.abs(delta) < 0.5;
  const DeltaIcon = isUp ? TrendingUp : TrendingDown;

  const fmt = (v: number) =>
    format === 'percent'
      ? `${(v * 100).toFixed(1)}%`
      : `$${Math.round(v).toLocaleString()}`;

  const deltaFmt = (v: number) =>
    format === 'percent'
      ? `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
      : `${v > 0 ? '+' : ''}$${Math.round(v).toLocaleString()}`;

  return (
    <div className="flex items-center justify-between text-sm py-1.5">
      <span className="text-slate-400 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 text-right">
        <span className="text-slate-400 w-24 text-right">{fmt(prior)}</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        <span className="text-white w-24 text-right font-medium">{fmt(current)}</span>
        {!isZero && (
          <span className={`flex items-center gap-0.5 w-28 justify-end text-xs ${isUp ? 'text-amber-400' : 'text-emerald-400'}`}>
            <DeltaIcon className="w-3 h-3" />
            {deltaFmt(delta)}
          </span>
        )}
        {isZero && <span className="w-28 text-right text-xs text-slate-600">—</span>}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────

export default function YoYComparisonCard({ priorYear, current }: YoYComparisonCardProps) {
  const { updateField } = useTaxReturnStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawReturn, setRawReturn] = useState<TaxReturn | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [templateManifest, setTemplateManifest] = useState<TemplateImportManifest | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setWarnings([]);
    setLoading(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      let result;
      if (ext === 'json') {
        result = await importPriorYearJSON(file);
      } else if (ext === 'pdf') {
        result = await importPriorYear1040PDF(file);
      } else {
        setError('Please select a TelosTax JSON export (.json) or a 1040 PDF (.pdf).');
        setLoading(false);
        return;
      }

      if (result.errors.length > 0) {
        setError(result.errors.join(' '));
        setLoading(false);
        return;
      }

      setWarnings(result.warnings);

      // Save the summary
      updateField('priorYearSummary', result.summary);

      // Store raw return for template builder (JSON imports only)
      if (result.rawReturn) {
        setRawReturn(result.rawReturn);
      }

      // Auto-populate carryforward fields if they're empty
      const { carryforwardSuggestions: cf } = result;
      const store = useTaxReturnStore.getState();
      const tr = store.taxReturn;
      if (tr) {
        if (cf.capitalLossCarryforwardST && !tr.capitalLossCarryforwardST) {
          updateField('capitalLossCarryforwardST', cf.capitalLossCarryforwardST);
        }
        if (cf.capitalLossCarryforwardLT && !tr.capitalLossCarryforwardLT) {
          updateField('capitalLossCarryforwardLT', cf.capitalLossCarryforwardLT);
        }
        if (cf.priorYearTax && !tr.priorYearTax) {
          updateField('priorYearTax', cf.priorYearTax);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  }, [updateField]);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleClear = () => {
    updateField('priorYearSummary', undefined);
    setWarnings([]);
    setError(null);
    setRawReturn(null);
    setShowTemplate(false);
    setTemplateManifest(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleShowTemplate = () => {
    if (!rawReturn) return;
    const manifest = buildTemplateItems(rawReturn);
    setTemplateManifest(manifest);
    setShowTemplate(true);
  };

  // ─── No prior-year data: show upload area ────────
  if (!priorYear) {
    return (
      <div className="card mt-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-slate-400" />
          <h3 className="font-medium text-slate-200">Year-over-Year Comparison</h3>
        </div>
        <p className="text-sm text-slate-400 mb-3">
          Import last year's return to see how your taxes changed.
        </p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !loading && inputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
            ${dragging
              ? 'border-telos-blue-400 bg-telos-blue-500/10'
              : 'border-slate-700 hover:border-slate-600 bg-surface-800/50'
            }
            ${loading ? 'opacity-50 cursor-wait' : ''}
          `}
        >
          <FileInput className={`w-6 h-6 mx-auto mb-2 ${dragging ? 'text-telos-blue-400' : 'text-slate-400'}`} />
          <p className="text-sm text-slate-300 font-medium">
            {loading ? 'Importing...' : 'Drop a prior-year file here'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            TelosTax JSON export or IRS 1040 PDF
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.pdf"
            onChange={handleChange}
            className="hidden"
            disabled={loading}
          />
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        {warnings.map((w, i) => (
          <p key={i} className="mt-1 text-xs text-amber-400">{w}</p>
        ))}
      </div>
    );
  }

  // ─── Template panel mode ──────────────────────────
  if (showTemplate && templateManifest) {
    return (
      <div className="rounded-xl border p-6 mt-4 bg-telos-blue-600/5 border-telos-blue-600/20">
        <PriorYearTemplatePanel
          manifest={templateManifest}
          onBack={() => setShowTemplate(false)}
          onDone={() => setShowTemplate(false)}
        />
      </div>
    );
  }

  // ─── Has prior-year data: show comparison ────────
  const priorRefund = priorYear.refundAmount > 0;
  const currentRefund = current.refundAmount > 0;
  const priorHero = priorRefund ? priorYear.refundAmount : priorYear.amountOwed;
  const currentHero = currentRefund ? current.refundAmount : current.amountOwed;

  // Determine hero message
  let heroMessage: string;
  if (priorRefund && currentRefund) {
    const delta = current.refundAmount - priorYear.refundAmount;
    heroMessage = delta >= 0
      ? `Your refund increased by $${Math.round(delta).toLocaleString()}`
      : `Your refund decreased by $${Math.round(Math.abs(delta)).toLocaleString()}`;
  } else if (!priorRefund && !currentRefund) {
    const delta = current.amountOwed - priorYear.amountOwed;
    heroMessage = delta <= 0
      ? `You owe $${Math.round(Math.abs(delta)).toLocaleString()} less than last year`
      : `You owe $${Math.round(delta).toLocaleString()} more than last year`;
  } else if (priorRefund && !currentRefund) {
    heroMessage = `You went from a $${Math.round(priorHero).toLocaleString()} refund to owing $${Math.round(currentHero).toLocaleString()}`;
  } else {
    heroMessage = `You went from owing $${Math.round(priorHero).toLocaleString()} to a $${Math.round(currentHero).toLocaleString()} refund`;
  }

  return (
    <div className="rounded-xl border p-6 mt-4 bg-telos-blue-600/5 border-telos-blue-600/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-telos-blue-400" />
          <h3 className="font-medium text-telos-blue-300">
            vs. {priorYear.taxYear} Return
            <span className="text-xs text-slate-400 ml-2 font-normal">
              ({priorYear.source === 'telostax-json' ? 'JSON import' : 'PDF import'})
            </span>
          </h3>
        </div>
        <button
          onClick={handleClear}
          className="text-slate-400 hover:text-red-400 transition-colors p-1"
          title="Remove prior-year data"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Hero delta */}
      <div className="text-center py-3 mb-3 rounded-lg bg-slate-800/50">
        <p className="text-sm text-slate-300 font-medium">{heroMessage}</p>
        <div className="flex items-center justify-center gap-3 mt-2">
          <div>
            <p className="text-xs text-slate-400">{priorYear.taxYear}</p>
            <p className={`text-lg font-bold ${priorRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
              {priorRefund ? '+' : '-'}${Math.round(priorHero).toLocaleString()}
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400" />
          <div>
            <p className="text-xs text-slate-400">2025</p>
            <p className={`text-lg font-bold ${currentRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
              {currentRefund ? '+' : '-'}${Math.round(currentHero).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* YoY Waterfall — "Why did your result change?" */}
      <YoYWaterfall priorYear={priorYear} current={current} />

      {/* YoY Paired Bars — side-by-side metric comparison */}
      <YoYPairedBars priorYear={priorYear} current={current} />

      {/* Metric comparison grid */}
      <div className="space-y-0 divide-y divide-slate-700/50">
        <MetricRow label="Total Income" prior={priorYear.totalIncome} current={current.totalIncome} />
        {/* Income breakdown — show when we have prior-year detail */}
        {priorYear.totalWages != null && (
          <MetricRow label="  Wages" prior={priorYear.totalWages} current={current.totalWages} />
        )}
        {priorYear.totalInterest != null && (
          <MetricRow label="  Interest" prior={priorYear.totalInterest} current={current.totalInterest} />
        )}
        {priorYear.totalDividends != null && (
          <MetricRow label="  Dividends" prior={priorYear.totalDividends} current={current.totalDividends} />
        )}
        {priorYear.capitalGainOrLoss != null && (
          <MetricRow label="  Capital Gains" prior={priorYear.capitalGainOrLoss} current={current.capitalGainOrLoss} />
        )}
        {priorYear.scheduleCNetProfit != null && (
          <MetricRow label="  Sched C" prior={priorYear.scheduleCNetProfit} current={current.scheduleCNetProfit} />
        )}
        <MetricRow label="AGI" prior={priorYear.agi} current={current.agi} />
        <MetricRow label="Deductions" prior={priorYear.deductionAmount} current={current.deductionAmount} />
        <MetricRow label="Taxable Income" prior={priorYear.taxableIncome} current={current.taxableIncome} />
        <MetricRow label="Total Tax" prior={priorYear.totalTax} current={current.totalTax} />
        <MetricRow label="Effective Rate" prior={priorYear.effectiveTaxRate} current={current.effectiveTaxRate} format="percent" />
      </div>

      {/* Import as Template button (JSON imports only) */}
      {rawReturn && (
        <button
          onClick={handleShowTemplate}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg
            text-sm text-telos-blue-400 border border-telos-blue-600/30
            hover:bg-telos-blue-600/10 hover:border-telos-blue-600/50 transition-colors"
        >
          <Copy className="w-4 h-4" />
          Import as Template
          <span className="text-xs text-slate-500 ml-1">
            (pre-fill payer names with $0 amounts)
          </span>
        </button>
      )}

      {warnings.length > 0 && (
        <div className="mt-3">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400">{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
