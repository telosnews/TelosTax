/**
 * CompetitorImportPanel — "Switch from Another Provider" import flow.
 *
 * Accepts a completed 1040 PDF from TurboTax, H&R Block, TaxAct, etc.
 * and extracts personal info + financials for pre-filling or YoY comparison.
 *
 * State machine: upload → extracting → review → importing → done
 */

import { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  Shield,
  User,
  DollarSign,
  Users,
} from 'lucide-react';
import FileDropZone from './FileDropZone';
import CurrencyInput from '../common/CurrencyInput';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { FilingStatus } from '@telostax/engine';
import type { TaxReturn, PriorYearSummary, Dependent } from '@telostax/engine';
import {
  parseCompetitorReturn,
  type CompetitorExtractResult,
  type ExtractedField,
  type Confidence,
} from '../../services/competitorReturnParser';
import {
  COMPETITOR_PROVIDERS,
  getProvider,
  type CompetitorProvider,
} from '../../data/competitorProviders';

// ─── Types ─────────────────────────────────────────

type PanelState = 'upload' | 'extracting' | 'review' | 'importing' | 'done';
type ImportMode = 'current-year' | 'prior-year';

interface CompetitorImportPanelProps {
  onBack: () => void;
}

// ─── Helpers ───────────────────────────────────────

const FILING_STATUS_LABELS: Record<number, string> = {
  [FilingStatus.Single]: 'Single',
  [FilingStatus.MarriedFilingJointly]: 'Married Filing Jointly',
  [FilingStatus.MarriedFilingSeparately]: 'Married Filing Separately',
  [FilingStatus.HeadOfHousehold]: 'Head of Household',
  [FilingStatus.QualifyingSurvivingSpouse]: 'Qualifying Surviving Spouse',
};

const FINANCIAL_LABELS: Record<string, string> = {
  wages: 'Wages (Line 1a)',
  interest: 'Taxable Interest (Line 2b)',
  dividends: 'Ordinary Dividends (Line 3b)',
  iraDistrib: 'IRA Distributions (Line 4b)',
  pensions: 'Pensions & Annuities (Line 5b)',
  socialSecurity: 'Social Security (Line 6b)',
  capitalGain: 'Capital Gain/Loss (Line 7)',
  totalIncome: 'Total Income (Line 9)',
  agi: 'Adjusted Gross Income (Line 11)',
  deduction: 'Standard/Itemized Deduction (Line 12)',
  taxableIncome: 'Taxable Income (Line 15)',
  totalTax: 'Total Tax (Line 24)',
  estimatedPmts: 'Estimated Payments (Line 26)',
  totalPayments: 'Total Payments (Line 33)',
  refund: 'Refund (Line 35a)',
  amountOwed: 'Amount Owed (Line 37)',
};

function confidenceBadge(c: Confidence) {
  switch (c) {
    case 'high': return <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">High</span>;
    case 'medium': return <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">Medium</span>;
    case 'low': return <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">Low</span>;
  }
}

function fmt$(v: number): string {
  return v < 0
    ? `-$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ─────────────────────────────────────

export default function CompetitorImportPanel({ onBack }: CompetitorImportPanelProps) {
  const updateField = useTaxReturnStore(s => s.updateField);
  const taxReturn = useTaxReturnStore(s => s.taxReturn);

  // State machine
  const [state, setState] = useState<PanelState>('upload');
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [showInstructions, setShowInstructions] = useState(false);

  // Extraction result
  const [result, setResult] = useState<CompetitorExtractResult | null>(null);

  // Review state
  const [importMode, setImportMode] = useState<ImportMode>('current-year');
  const [editablePersonal, setEditablePersonal] = useState<Record<string, string>>({});
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, boolean>>({});
  const [editableFinancials, setEditableFinancials] = useState<Record<string, number>>({});

  // ── File handler ──
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setState('extracting');

    try {
      const extractResult = await parseCompetitorReturn(file);
      setResult(extractResult);

      // Initialize editable state from extraction
      const personal: Record<string, string> = {};
      const overrides: Record<string, boolean> = {};

      for (const [key, field] of Object.entries(extractResult.personalInfo)) {
        if (!field || typeof field !== 'object' || !('value' in field)) continue;
        const ef = field as ExtractedField<unknown>;
        const val = ef.value;
        if (val === null || val === undefined) continue;

        if (key === 'filingStatus') {
          personal[key] = String(val);
        } else {
          personal[key] = String(val);
        }

        // Determine if this field should be auto-checked for overwrite
        const currentVal = taxReturn?.[key as keyof typeof taxReturn];
        if (!currentVal || currentVal === '' || String(currentVal) === String(val)) {
          overrides[key] = true; // Auto-check: field is empty or values match
        } else {
          overrides[key] = false; // Don't auto-check: field has a different value
        }
      }

      setEditablePersonal(personal);
      setFieldOverrides(overrides);
      setEditableFinancials({ ...extractResult.financials });

      // Detect appropriate import mode based on tax year
      if (extractResult.detectedTaxYear < new Date().getFullYear()) {
        setImportMode('prior-year');
      } else {
        setImportMode('current-year');
      }

      // If provider was auto-detected but user hadn't selected one, update
      if (!selectedProvider && extractResult.detectedProvider) {
        setSelectedProvider(extractResult.detectedProvider);
      }

      setState('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setState('upload');
    }
  }, [taxReturn, selectedProvider]);

  // ── Import handler ──
  const handleImport = useCallback(() => {
    if (!result) return;
    setState('importing');

    try {
      if (importMode === 'current-year') {
        // Write personal info fields (only checked overrides)
        const fieldMap: Record<string, string> = {
          firstName: 'firstName',
          lastName: 'lastName',
          addressStreet: 'addressStreet',
          addressCity: 'addressCity',
          addressState: 'addressState',
          addressZip: 'addressZip',
          spouseFirstName: 'spouseFirstName',
          spouseLastName: 'spouseLastName',
        };

        for (const [extractKey, storeKey] of Object.entries(fieldMap)) {
          if (fieldOverrides[extractKey] && editablePersonal[extractKey]) {
            updateField(storeKey, editablePersonal[extractKey]);
          }
        }

        // Filing status
        if (fieldOverrides['filingStatus'] && editablePersonal['filingStatus']) {
          const fsNum = parseInt(editablePersonal['filingStatus']);
          if (!isNaN(fsNum) && fsNum >= 1 && fsNum <= 5) {
            updateField('filingStatus', fsNum);
          }
        }

        // Dependents
        if (result.dependents.length > 0) {
          const deps: Dependent[] = result.dependents.map((d, i) => ({
            id: `imported-dep-${i}`,
            firstName: d.firstName,
            lastName: d.lastName,
            ssnLastFour: d.ssnLastFour,
            relationship: d.relationship || '',
            monthsLivedWithYou: 12,
          }));
          // Merge with existing dependents (don't overwrite)
          const existing = taxReturn?.dependents || [];
          updateField('dependents', [...existing, ...deps]);
        }
      } else {
        // Prior-year mode: write as PriorYearSummary
        const f = editableFinancials;
        const opt = (v: number) => v > 0 ? v : undefined;

        const summary: PriorYearSummary = {
          source: 'competitor-pdf',
          taxYear: result.detectedTaxYear,
          providerName: result.detectedProvider
            ? getProvider(result.detectedProvider).name
            : undefined,
          totalIncome: f.totalIncome || 0,
          agi: f.agi || 0,
          taxableIncome: f.taxableIncome || 0,
          deductionAmount: f.deduction || 0,
          totalTax: f.totalTax || 0,
          totalCredits: 0,
          totalPayments: f.totalPayments || 0,
          refundAmount: f.refund || 0,
          amountOwed: f.amountOwed || 0,
          effectiveTaxRate: f.totalIncome > 0 ? f.totalTax / f.totalIncome : 0,
          totalWages: opt(f.wages),
          totalInterest: opt(f.interest),
          totalDividends: opt(f.dividends),
          capitalGainOrLoss: f.capitalGain !== 0 ? f.capitalGain : undefined,
          estimatedTaxPayments: opt(f.estimatedPmts),
          iraDistributions: opt(f.iraDistrib),
          pensionsAnnuities: opt(f.pensions),
          socialSecurityBenefits: opt(f.socialSecurity),
        };

        updateField('priorYearSummary', summary);
        if (f.totalTax > 0) {
          updateField('priorYearTax', f.totalTax);
        }
      }

      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setState('review');
    }
  }, [result, importMode, editablePersonal, fieldOverrides, editableFinancials, updateField, taxReturn]);

  // ── Reset handler ──
  const handleReset = () => {
    setState('upload');
    setResult(null);
    setError(null);
    setEditablePersonal({});
    setFieldOverrides({});
    setEditableFinancials({});
  };

  const provider = selectedProvider ? getProvider(selectedProvider) : null;

  return (
    <div className="mt-4 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={state === 'review' ? handleReset : onBack}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-medium text-slate-200">Switch from Another Provider</h3>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="card bg-red-500/10 border-red-500/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300">{error}</p>
              <button
                onClick={() => { setError(null); setState('upload'); }}
                className="text-sm text-red-400 hover:text-red-300 underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOAD STATE ── */}
      {state === 'upload' && (
        <div className="space-y-4">
          {/* Provider selector */}
          <div className="card bg-surface-800 border-slate-700">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Which tax software did you use?
              <span className="text-slate-500 font-normal ml-1">(optional)</span>
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setShowInstructions(!!e.target.value && e.target.value !== 'other');
              }}
              className="input-field w-full"
            >
              <option value="">Select your provider...</option>
              {COMPETITOR_PROVIDERS.filter(p => p.id !== 'other').map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="other">Other / I&apos;m not sure</option>
            </select>

            {/* Collapsible instructions */}
            {provider && provider.id !== 'other' && (
              <div className="mt-3">
                <button
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="flex items-center gap-1.5 text-sm text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
                >
                  {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  How to download your return from {provider.name}
                </button>

                {showInstructions && (
                  <ol className="mt-2 ml-6 space-y-1.5">
                    {provider.instructions.map((step, i) => (
                      <li key={i} className="text-sm text-slate-400 list-decimal">
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>

          {/* File drop zone */}
          <FileDropZone
            accept=".pdf"
            onFile={handleFile}
            label="Drop your completed 1040 PDF here"
            sublabel="Must be a digitally-generated PDF (not scanned)"
            maxSizeMB={25}
          />

          {/* Privacy note */}
          <div className="flex items-start gap-2 text-sm text-slate-500">
            <Shield className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Your PDF is processed entirely in your browser. No data is uploaded to any server.</span>
          </div>
        </div>
      )}

      {/* ── EXTRACTING STATE ── */}
      {state === 'extracting' && (
        <div className="card bg-surface-800 border-slate-700 text-center py-8">
          <Loader2 className="w-8 h-8 text-telos-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-300">Analyzing your tax return...</p>
          <p className="text-sm text-slate-500 mt-1">Extracting personal info and financial data</p>
        </div>
      )}

      {/* ── REVIEW STATE ── */}
      {state === 'review' && result && (
        <div className="space-y-4">
          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="card bg-amber-500/10 border-amber-500/30">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-amber-300 mb-1 last:mb-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Detection info */}
          <div className="flex flex-wrap gap-2">
            {result.detectedProvider && (
              <span className="text-xs px-2 py-1 rounded bg-telos-blue-600/15 text-telos-blue-400 border border-telos-blue-600/20">
                Detected: {getProvider(result.detectedProvider).name}
              </span>
            )}
            <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 border border-slate-600">
              Tax Year: {result.detectedTaxYear}
            </span>
          </div>

          {/* Import mode toggle */}
          <div className="card bg-surface-800 border-slate-700">
            <p className="text-sm font-medium text-slate-300 mb-2">How would you like to use this data?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setImportMode('current-year')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  importMode === 'current-year'
                    ? 'bg-telos-blue-600/15 border-telos-blue-500/40 text-telos-blue-300'
                    : 'bg-surface-700 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <p className="text-sm font-medium">Pre-fill this year&apos;s return</p>
                <p className="text-xs mt-0.5 opacity-70">Import name, address, filing status</p>
              </button>
              <button
                onClick={() => setImportMode('prior-year')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  importMode === 'prior-year'
                    ? 'bg-telos-blue-600/15 border-telos-blue-500/40 text-telos-blue-300'
                    : 'bg-surface-700 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <p className="text-sm font-medium">Import as prior year</p>
                <p className="text-xs mt-0.5 opacity-70">Year-over-year comparison</p>
              </button>
            </div>
          </div>

          {/* ── Personal Info Section (current-year mode) ── */}
          {importMode === 'current-year' && (
            <div className="card bg-surface-800 border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-telos-blue-400" />
                <h4 className="text-base font-medium text-slate-200">Personal Information</h4>
              </div>

              <div className="space-y-3">
                {/* Name fields */}
                {(['firstName', 'lastName'] as const).map(key => {
                  const field = result.personalInfo[key];
                  if (!field?.value) return null;
                  const currentVal = taxReturn?.[key] || '';
                  const hasDifferent = currentVal && currentVal !== field.value;

                  return (
                    <div key={key} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={fieldOverrides[key] ?? false}
                        onChange={(e) => setFieldOverrides(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="accent-telos-blue-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                          {confidenceBadge(field.confidence)}
                        </div>
                        <input
                          type="text"
                          value={editablePersonal[key] || ''}
                          onChange={(e) => setEditablePersonal(prev => ({ ...prev, [key]: e.target.value }))}
                          className="input-field w-full mt-1"
                        />
                        {hasDifferent && (
                          <p className="text-xs text-amber-400 mt-0.5">
                            Current: &quot;{currentVal}&quot; → Import: &quot;{field.value}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Address fields */}
                {(['addressStreet', 'addressCity', 'addressState', 'addressZip'] as const).map(key => {
                  const field = result.personalInfo[key];
                  if (!field?.value) return null;
                  const currentVal = taxReturn?.[key] || '';
                  const hasDifferent = currentVal && currentVal !== field.value;

                  return (
                    <div key={key} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={fieldOverrides[key] ?? false}
                        onChange={(e) => setFieldOverrides(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="accent-telos-blue-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-slate-400 capitalize">
                            {key.replace('address', '').replace(/([A-Z])/g, ' $1').trim()}
                          </label>
                          {confidenceBadge(field.confidence)}
                        </div>
                        <input
                          type="text"
                          value={editablePersonal[key] || ''}
                          onChange={(e) => setEditablePersonal(prev => ({ ...prev, [key]: e.target.value }))}
                          className="input-field w-full mt-1"
                        />
                        {hasDifferent && (
                          <p className="text-xs text-amber-400 mt-0.5">
                            Current: &quot;{currentVal}&quot; → Import: &quot;{field.value}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Filing status */}
                {result.personalInfo.filingStatus.value !== null && (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={fieldOverrides['filingStatus'] ?? false}
                      onChange={(e) => setFieldOverrides(prev => ({ ...prev, filingStatus: e.target.checked }))}
                      className="accent-telos-blue-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-400">Filing Status</label>
                        {confidenceBadge(result.personalInfo.filingStatus.confidence)}
                      </div>
                      <select
                        value={editablePersonal['filingStatus'] || ''}
                        onChange={(e) => setEditablePersonal(prev => ({ ...prev, filingStatus: e.target.value }))}
                        className="input-field w-full mt-1"
                      >
                        {Object.entries(FILING_STATUS_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                      {taxReturn?.filingStatus && taxReturn.filingStatus !== result.personalInfo.filingStatus.value && (
                        <p className="text-xs text-amber-400 mt-0.5">
                          Current: &quot;{FILING_STATUS_LABELS[taxReturn.filingStatus]}&quot; → Import: &quot;{FILING_STATUS_LABELS[result.personalInfo.filingStatus.value!]}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Spouse info */}
                {result.personalInfo.spouseFirstName && (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={fieldOverrides['spouseFirstName'] ?? false}
                      onChange={(e) => setFieldOverrides(prev => ({
                        ...prev,
                        spouseFirstName: e.target.checked,
                        spouseLastName: e.target.checked,
                      }))}
                      className="accent-telos-blue-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-400">Spouse Name</label>
                        {confidenceBadge(result.personalInfo.spouseFirstName.confidence)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <input
                          type="text"
                          value={editablePersonal['spouseFirstName'] || ''}
                          onChange={(e) => setEditablePersonal(prev => ({ ...prev, spouseFirstName: e.target.value }))}
                          placeholder="First name"
                          className="input-field"
                        />
                        <input
                          type="text"
                          value={editablePersonal['spouseLastName'] || ''}
                          onChange={(e) => setEditablePersonal(prev => ({ ...prev, spouseLastName: e.target.value }))}
                          placeholder="Last name"
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Dependents Section (current-year mode) ── */}
          {importMode === 'current-year' && result.dependents.length > 0 && (
            <div className="card bg-surface-800 border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-telos-blue-400" />
                <h4 className="text-base font-medium text-slate-200">
                  Dependents ({result.dependents.length})
                </h4>
              </div>

              <div className="space-y-2">
                {result.dependents.map((dep, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-surface-700 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm text-slate-200">
                        {dep.firstName} {dep.lastName}
                      </p>
                      <div className="flex gap-3 text-xs text-slate-500">
                        {dep.relationship && <span>{dep.relationship}</span>}
                        {dep.ssnLastFour && <span>SSN: •••-••-{dep.ssnLastFour}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-500 mt-2">
                Dependents will be added to your return. You can edit them later in the Personal Info step.
              </p>
            </div>
          )}

          {/* ── Financial Summary Section (both modes) ── */}
          <div className="card bg-surface-800 border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-telos-blue-400" />
              <h4 className="text-base font-medium text-slate-200">
                {importMode === 'current-year' ? 'Financial Reference' : 'Financial Summary'}
              </h4>
            </div>

            {importMode === 'current-year' && (
              <p className="text-xs text-slate-500 mb-3 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                These totals are shown as a reference while you enter income. They are not written to your return.
              </p>
            )}

            <div className="space-y-2">
              {Object.entries(FINANCIAL_LABELS).map(([key, label]) => {
                const val = editableFinancials[key];
                if (val === undefined || (val === 0 && !['totalIncome', 'agi', 'totalTax'].includes(key))) return null;

                return (
                  <div key={key} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-700/50 last:border-0">
                    <span className="text-sm text-slate-400">{label}</span>
                    {importMode === 'prior-year' ? (
                      <CurrencyInput
                        value={val}
                        onChange={(v) => setEditableFinancials(prev => ({ ...prev, [key]: v }))}
                        className="w-36 text-right"
                      />
                    ) : (
                      <span className="text-sm font-mono text-slate-200">{fmt$(val)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Import Button ── */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleReset}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="btn-primary"
            >
              {importMode === 'current-year' ? 'Import Personal Info' : 'Import as Prior Year'}
            </button>
          </div>
        </div>
      )}

      {/* ── IMPORTING STATE ── */}
      {state === 'importing' && (
        <div className="card bg-surface-800 border-slate-700 text-center py-8">
          <Loader2 className="w-8 h-8 text-telos-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-300">Importing data...</p>
        </div>
      )}

      {/* ── DONE STATE ── */}
      {state === 'done' && (
        <div className="card bg-emerald-500/10 border-emerald-500/30 text-center py-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-lg font-medium text-emerald-300">
            {importMode === 'current-year' ? 'Personal info imported!' : 'Prior year data imported!'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {importMode === 'current-year'
              ? 'Your name, address, and filing status have been pre-filled. Review them in the Personal Info step.'
              : 'Your prior-year data is available for year-over-year comparison on the Review page.'}
          </p>

          <div className="flex justify-center gap-3 mt-4">
            <button onClick={handleReset} className="btn-secondary">
              Import Another
            </button>
            <button onClick={onBack} className="btn-primary">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
