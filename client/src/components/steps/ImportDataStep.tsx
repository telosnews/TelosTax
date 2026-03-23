import { useState } from 'react';
import { FileInput, FileSpreadsheet, FileText, FileCode2, ArrowRightLeft, AlertTriangle, Info } from 'lucide-react';
import SectionIntro from '../common/SectionIntro';
import StepNavigation from '../layout/StepNavigation';
import CSVImportPanel from '../import/CSVImportPanel';
import PDFImportPanel from '../import/PDFImportPanel';
import TXFImportPanel from '../import/TXFImportPanel';
import FDXImportPanel from '../import/FDXImportPanel';
import CompetitorImportPanel from '../import/CompetitorImportPanel';

type ImportMode = 'idle' | 'csv' | 'pdf' | 'txf' | 'fdx' | 'competitor';

export default function ImportDataStep() {
  const [mode, setMode] = useState<ImportMode>('idle');

  return (
    <div>
      <SectionIntro
        icon={<FileInput className="w-8 h-8" />}
        title="Import Your Tax Documents"
        description="Skip manual data entry — import your tax forms directly from digital PDFs, brokerage CSV exports, or financial data files."
      />

      {/* ─── Mode: IDLE — show option cards ─────────── */}
      {mode === 'idle' && (
        <div className="space-y-4 mt-4">

          {/* ── Competitor Import Section ───────────── */}
          <button
            onClick={() => setMode('competitor')}
            className="card-selectable w-full text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <ArrowRightLeft className="w-8 h-8 text-telos-orange-400 shrink-0" />
              <div className="text-lg font-medium text-slate-200">Switch from Another Provider</div>
            </div>

            <div className="ml-10">
              <div className="flex flex-wrap gap-2 mb-2">
                {['TurboTax', 'H&R Block', 'TaxAct', 'FreeTaxUSA', 'Cash App Taxes'].map((name) => (
                  <span key={name} className="text-sm px-2.5 py-1 rounded bg-telos-orange-600/15 text-telos-orange-400 border border-telos-orange-600/20">
                    {name}
                  </span>
                ))}
              </div>
              <p className="text-sm text-slate-400">
                Pre-fill your return from a completed 1040 PDF from your previous tax software.
              </p>
            </div>
          </button>

          {/* ── PDF Import Section ─────────────────── */}
          <button
            onClick={() => setMode('pdf')}
            className="card-selectable w-full text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-8 h-8 text-telos-blue-400 shrink-0" />
              <div className="text-lg font-medium text-slate-200">PDF and Image Import</div>
            </div>

            <div className="ml-10">
              {/* Supported forms */}
              <p className="text-base text-slate-300 font-medium mb-2">Supported IRS Forms</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {['W-2', '1099-INT', '1099-DIV', '1099-R', '1099-NEC', '1099-MISC', '1099-G', '1099-B', '1099-K', 'SSA-1099', '1099-SA', '1099-Q', '1098', '1098-T', '1098-E', '1095-A', 'K-1', 'W-2G', '1099-C', '1099-S'].map((form) => (
                  <span key={form} className="text-sm font-mono px-2.5 py-1 rounded bg-telos-blue-600/15 text-telos-blue-400 border border-telos-blue-600/20">
                    {form}
                  </span>
                ))}
              </div>

              {/* File type */}
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-slate-300">File type:</span> PDF files, scanned documents, and photos (.pdf, .jpg, .png)
              </p>

              {/* Limitations */}
              <p className="text-sm text-slate-400 flex items-start gap-1.5 mt-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                Scanned documents and photos can be processed with OCR, then enhanced with AI for improved accuracy. Always review imported values.
              </p>
            </div>
          </button>

          {/* ── CSV Import Section ─────────────────── */}
          <button
            onClick={() => setMode('csv')}
            className="card-selectable w-full text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <FileSpreadsheet className="w-8 h-8 text-telos-blue-400 shrink-0" />
              <div className="text-lg font-medium text-slate-200">CSV Import</div>
            </div>

            <div className="ml-10">
              {/* Supported forms */}
              <p className="text-base text-slate-300 font-medium mb-2">Supported IRS Forms</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {['1099-B', '1099-DA'].map((form) => (
                  <span key={form} className="text-sm font-mono px-2.5 py-1 rounded bg-telos-blue-600/15 text-telos-blue-400 border border-telos-blue-600/20">
                    {form}
                  </span>
                ))}
              </div>

              {/* Brokerages */}
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-slate-300">Auto-detects:</span> Schwab, Fidelity, E*Trade, Robinhood, Coinbase
              </p>
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-slate-300">File type:</span> CSV exports (.csv) from your brokerage's tax reporting section
              </p>

              {/* Tip */}
              <p className="text-sm text-slate-400 flex items-start gap-1.5 mt-2">
                <Info className="w-4 h-4 text-telos-blue-400 shrink-0 mt-0.5" />
                Other brokerages can be imported using manual column mapping.
              </p>
            </div>
          </button>

          {/* ── Financial Data Import (TXF + FDX) ──── */}
          <div className="card bg-surface-800 border-slate-700">
            <div className="flex items-center gap-3 mb-3 p-4 pb-0">
              <FileCode2 className="w-8 h-8 text-telos-blue-400 shrink-0" />
              <div className="text-lg font-medium text-slate-200">Financial Data Import</div>
            </div>

            <div className="ml-10 px-4 pb-4">
              <p className="text-base text-slate-300 font-medium mb-2">Supported IRS Forms</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {['W-2', '1099-B', '1099-INT', '1099-DIV', '1099-R', '1099-NEC', '1099-MISC', '1099-G', '1099-K', '1099-SA', '1099-Q'].map((form) => (
                  <span key={form} className="text-sm font-mono px-2.5 py-1 rounded bg-telos-blue-600/15 text-telos-blue-400 border border-telos-blue-600/20">
                    {form}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {/* TXF sub-card */}
                <button
                  onClick={() => setMode('txf')}
                  className="card-selectable text-left p-3"
                >
                  <p className="text-sm font-medium text-slate-200 mb-1">TXF File (.txf)</p>
                  <p className="text-xs text-slate-400">
                    Tax Exchange Format — exported from Fidelity, Schwab, E*Trade, Interactive Brokers, TurboTax
                  </p>
                </button>

                {/* FDX sub-card */}
                <button
                  onClick={() => setMode('fdx')}
                  className="card-selectable text-left p-3"
                >
                  <p className="text-sm font-medium text-slate-200 mb-1">FDX File (.json)</p>
                  <p className="text-xs text-slate-400">
                    Financial Data Exchange — modern JSON format from participating financial institutions
                  </p>
                </button>
              </div>

              {/* Tip */}
              <p className="text-sm text-slate-400 flex items-start gap-1.5 mt-3">
                <Info className="w-4 h-4 text-telos-blue-400 shrink-0 mt-0.5" />
                Check your brokerage or tax software&apos;s export/download section for TXF or FDX files.
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-400 mt-2 text-center">
            This step is optional — you can skip it and enter data manually on the following pages.
          </p>
        </div>
      )}

      {/* ─── Mode: CSV ─────────────────────────────── */}
      {mode === 'csv' && (
        <CSVImportPanel onBack={() => setMode('idle')} />
      )}

      {/* ─── Mode: PDF ─────────────────────────────── */}
      {mode === 'pdf' && (
        <PDFImportPanel onBack={() => setMode('idle')} />
      )}

      {/* ─── Mode: TXF ─────────────────────────────── */}
      {mode === 'txf' && (
        <TXFImportPanel onBack={() => setMode('idle')} />
      )}

      {/* ─── Mode: FDX ─────────────────────────────── */}
      {mode === 'fdx' && (
        <FDXImportPanel onBack={() => setMode('idle')} />
      )}

      {/* ─── Mode: Competitor ────────────────────── */}
      {mode === 'competitor' && (
        <CompetitorImportPanel onBack={() => setMode('idle')} />
      )}

      <StepNavigation showBack />
    </div>
  );
}
