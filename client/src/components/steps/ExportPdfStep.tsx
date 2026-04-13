import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import {
  FileJson, FileText, FileSpreadsheet, Loader2, CheckCircle2,
  AlertTriangle, AlertCircle, ChevronDown, ChevronRight,
  XCircle, PartyPopper, Download, Trash2, Lock, Eye, EyeOff,
  Smartphone, Calendar,
} from 'lucide-react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040, FilingStatus, assessEstimatedPaymentNeed } from '@telostax/engine';
import type { CalculationResult } from '@telostax/engine';
import { downloadPDF, downloadIRSFormsPDF, deleteReturn } from '../../api/client';
import { generateEstimatedTaxVouchersPDF } from '../../services/irsFormFiller';
import { exportReturnToFile } from '../../services/fileTransfer';
import { toast } from 'sonner';
import { checkExportReadiness } from '../../services/exportReadiness';
import { useWarnings } from '../../hooks/useWarnings';
import { getTotalWarningCount } from '../../services/warningService';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/** Convert a tax return object into CSV rows for portable export */
function taxReturnToCSV(taxReturn: any, calcResult?: CalculationResult): string {
  const rows: string[][] = [['Section', 'Field', 'Value']];

  const add = (section: string, field: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    rows.push([section, field, String(value)]);
  };

  // Personal Info
  add('Personal', 'First Name', taxReturn.firstName);
  add('Personal', 'Last Name', taxReturn.lastName);
  add('Personal', 'Filing Status', taxReturn.filingStatus);
  add('Personal', 'Tax Year', taxReturn.taxYear);

  // W-2 Income
  (taxReturn.w2Income || []).forEach((w: any, i: number) => {
    add(`W-2 #${i + 1}`, 'Employer', w.employerName);
    add(`W-2 #${i + 1}`, 'Wages', w.wages);
    add(`W-2 #${i + 1}`, 'Federal Withheld', w.federalTaxWithheld);
    if (w.stateTaxWithheld) add(`W-2 #${i + 1}`, 'State Withheld', w.stateTaxWithheld);
  });

  // 1099-NEC
  (taxReturn.income1099NEC || []).forEach((n: any, i: number) => {
    add(`1099-NEC #${i + 1}`, 'Payer', n.payerName);
    add(`1099-NEC #${i + 1}`, 'Amount', n.amount);
  });

  // 1099-K
  (taxReturn.income1099K || []).forEach((k: any, i: number) => {
    add(`1099-K #${i + 1}`, 'Platform', k.payerName);
    add(`1099-K #${i + 1}`, 'Gross Amount', k.grossAmount);
  });

  // 1099-INT
  (taxReturn.income1099INT || []).forEach((n: any, i: number) => {
    add(`1099-INT #${i + 1}`, 'Payer', n.payerName);
    add(`1099-INT #${i + 1}`, 'Interest', n.amount);
  });

  // 1099-DIV
  (taxReturn.income1099DIV || []).forEach((d: any, i: number) => {
    add(`1099-DIV #${i + 1}`, 'Payer', d.payerName);
    add(`1099-DIV #${i + 1}`, 'Ordinary Dividends', d.ordinaryDividends);
    if (d.qualifiedDividends) add(`1099-DIV #${i + 1}`, 'Qualified Dividends', d.qualifiedDividends);
  });

  // 1099-R
  (taxReturn.income1099R || []).forEach((r: any, i: number) => {
    add(`1099-R #${i + 1}`, 'Payer', r.payerName);
    add(`1099-R #${i + 1}`, 'Gross Distribution', r.grossDistribution);
    add(`1099-R #${i + 1}`, 'Taxable Amount', r.taxableAmount);
  });

  // 1099-G
  (taxReturn.income1099G || []).forEach((g: any, i: number) => {
    add(`1099-G #${i + 1}`, 'Unemployment', g.unemploymentCompensation);
    if (g.federalTaxWithheld) add(`1099-G #${i + 1}`, 'Withheld', g.federalTaxWithheld);
  });

  // 1099-MISC
  (taxReturn.income1099MISC || []).forEach((m: any, i: number) => {
    add(`1099-MISC #${i + 1}`, 'Payer', m.payerName);
    add(`1099-MISC #${i + 1}`, 'Other Income', m.otherIncome);
  });

  // Business
  if (taxReturn.businessInfo) {
    add('Business', 'Name', taxReturn.businessInfo.name);
    add('Business', 'EIN', taxReturn.businessInfo.ein);
  }

  // Expenses
  if (taxReturn.expenses) {
    Object.entries(taxReturn.expenses).forEach(([key, val]) => {
      if (val && Number(val) > 0) add('Expenses', key, val);
    });
  }

  // Deductions
  add('Deductions', 'Method', taxReturn.deductionMethod);
  if (taxReturn.itemizedDeductions) {
    Object.entries(taxReturn.itemizedDeductions).forEach(([key, val]) => {
      if (val && Number(val) > 0) add('Itemized Deductions', key, val);
    });
  }

  // Above-the-line
  if (taxReturn.hsaContribution) add('Adjustments', 'HSA Contribution', taxReturn.hsaContribution);
  if (taxReturn.studentLoanInterest) add('Adjustments', 'Student Loan Interest', taxReturn.studentLoanInterest);
  if (taxReturn.iraContribution) add('Adjustments', 'IRA Contribution', taxReturn.iraContribution);
  if (taxReturn.estimatedPayments) add('Adjustments', 'Estimated Payments', taxReturn.estimatedPayments);

  // State tax data
  if (calcResult?.stateResults) {
    for (const sr of calcResult.stateResults) {
      if (sr.totalStateTax <= 0 && sr.localTax <= 0) continue;
      const section = `State ${sr.stateCode}`;
      add(section, 'State', sr.stateName);
      add(section, 'Residency', sr.residencyType);
      add(section, 'Taxable Income', sr.stateTaxableIncome);
      add(section, 'State Income Tax', sr.stateIncomeTax);
      add(section, 'Credits', sr.stateCredits);
      add(section, 'Local Tax', sr.localTax);
      add(section, 'Total Tax', sr.totalStateTax);
      add(section, 'Withholding', sr.stateWithholding);
      add(section, 'Refund/Owed', sr.stateRefundOrOwed);
      add(section, 'Effective Rate', `${(sr.effectiveStateRate * 100).toFixed(2)}%`);
    }
  }

  // Escape CSV values and join
  return rows.map(row =>
    row.map(cell => {
      const s = String(cell);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(',')
  ).join('\n');
}

export default function ExportPdfStep() {
  const { returnId, taxReturn, goToStep } = useTaxReturnStore();
  const navigate = useNavigate();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfDone, setPdfDone] = useState(false);
  const [irsLoading, setIrsLoading] = useState(false);
  const [irsDone, setIrsDone] = useState(false);
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const [blockersExpanded, setBlockersExpanded] = useState(true);
  const [esLoading, setEsLoading] = useState(false);
  const [esDone, setEsDone] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  // Export password protection
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const pendingExportRef = useRef<'irs' | 'summary' | 'json' | 'csv' | 'transfer' | '1040es' | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const exportModalRef = useRef<HTMLDivElement>(null);

  // Focus trap: lock keyboard inside the export password modal
  const dismissPasswordModal = useCallback(() => {
    setShowPasswordModal(false);
    setExportPassword('');
  }, []);
  useFocusTrap(exportModalRef, showPasswordModal, dismissPasswordModal);

  // ── Pre-export readiness ─────────────────────────────────────
  const readiness = useMemo(
    () => taxReturn ? checkExportReadiness(taxReturn) : { ready: false, blockers: [], blockerCount: 0 },
    [taxReturn],
  );
  const advisoryWarnings = useWarnings();
  const advisoryCount = getTotalWarningCount(advisoryWarnings);
  const hasBlockers = !readiness.ready;

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const promptExportPassword = (type: 'irs' | 'summary' | 'json' | 'csv' | 'transfer' | '1040es') => {
    pendingExportRef.current = type;
    setExportPassword('');
    setShowExportPassword(false);
    setShowPasswordModal(true);
    setTimeout(() => passwordInputRef.current?.focus(), 100);
  };

  /** Encrypt raw text/bytes with AES-256-GCM using the Web Crypto API. */
  const encryptForExport = async (data: string, password: string): Promise<Blob> => {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data));
    const payload = JSON.stringify({
      v: 1,
      salt: Array.from(salt),
      iv: Array.from(iv),
      ct: Array.from(new Uint8Array(ciphertext)),
    });
    return new Blob([payload], { type: 'application/octet-stream' });
  };

  const executeExport = async (password?: string) => {
    const type = pendingExportRef.current;
    setShowPasswordModal(false);
    pendingExportRef.current = null;
    if (!returnId || !type) return;

    const pw = password && password.length > 0 ? password : undefined;

    if (type === 'irs') {
      setIrsLoading(true);
      setIrsDone(false);
      try {
        const blob = await downloadIRSFormsPDF(returnId, pw);
        triggerDownload(blob, `telostax-filing-packet-${taxReturn?.taxYear || 2025}-${returnId}.pdf`);
        setIrsDone(true);
        toast.success(pw ? 'Password-protected filing packet downloaded' : 'Filing packet downloaded');
      } catch (err) {
        console.error('Filing packet generation failed:', err);
        const msg = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to generate filing packet: ${msg}`);
      } finally {
        setIrsLoading(false);
      }
    } else if (type === 'summary') {
      setPdfLoading(true);
      setPdfDone(false);
      try {
        const blob = await downloadPDF(returnId, pw);
        triggerDownload(blob, `telostax-return-${taxReturn?.taxYear || 2025}-${returnId}.pdf`);
        setPdfDone(true);
        toast.success(pw ? 'Password-protected PDF downloaded' : 'PDF downloaded');
      } catch (err) {
        console.error('Summary PDF generation failed:', err);
        const msg = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to generate PDF: ${msg}`);
      } finally {
        setPdfLoading(false);
      }
    } else if (type === 'json') {
      if (!taxReturn) return;
      if (pw) {
        const blob = await encryptForExport(JSON.stringify(taxReturn, null, 2), pw);
        triggerDownload(blob, `telostax-return-${taxReturn.taxYear}-${returnId}.json.enc`);
        toast.success('Encrypted JSON exported');
      } else {
        const blob = new Blob([JSON.stringify(taxReturn, null, 2)], { type: 'application/json' });
        triggerDownload(blob, `telostax-return-${taxReturn.taxYear}-${returnId}.json`);
        toast.success('JSON exported');
      }
    } else if (type === 'csv') {
      if (!taxReturn) return;
      const csv = taxReturnToCSV(taxReturn, calcResult ?? undefined);
      if (pw) {
        const blob = await encryptForExport(csv, pw);
        triggerDownload(blob, `telostax-return-${taxReturn.taxYear}-${returnId}.csv.enc`);
        toast.success('Encrypted CSV exported');
      } else {
        const blob = new Blob([csv], { type: 'text/csv' });
        triggerDownload(blob, `telostax-return-${taxReturn.taxYear}-${returnId}.csv`);
        toast.success('CSV exported');
      }
    } else if (type === 'transfer') {
      if (!taxReturn || !pw) return;
      const blob = await exportReturnToFile(taxReturn, pw);
      const name = taxReturn.firstName && taxReturn.lastName
        ? `${taxReturn.firstName}-${taxReturn.lastName}` : returnId;
      triggerDownload(blob, `${name}-${taxReturn.taxYear}.telostax`);
      toast.success('Transfer file saved — import it on your other device');
    } else if (type === '1040es') {
      if (!taxReturn || !calcResult) return;
      setEsLoading(true);
      setEsDone(false);
      try {
        const pdfBytes = await generateEstimatedTaxVouchersPDF(taxReturn, calcResult);
        const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
        triggerDownload(blob, `telostax-1040es-vouchers-2026-${returnId}.pdf`);
        setEsDone(true);
        toast.success('Estimated tax vouchers downloaded');
      } catch {
        toast.error('Failed to generate estimated tax vouchers.');
      } finally {
        setEsLoading(false);
      }
    }
  };

  const handleDeleteEverything = () => {
    if (!returnId) return;
    deleteReturn(returnId);
    toast.success('All data has been permanently deleted.');
    navigate('/');
  };

  // ── Tax calculation for hero number ──────────────────────────
  const calcResult = useMemo(() => {
    if (!taxReturn) return null;
    try {
      return calculateForm1040({
        ...taxReturn,
        filingStatus: taxReturn.filingStatus || FilingStatus.Single,
      });
    } catch {
      return null;
    }
  }, [taxReturn]);

  const f = calcResult?.form1040;
  const isRefund = f ? f.refundAmount > 0 : false;
  const heroAmount = f ? (isRefund ? f.refundAmount : f.amountOwed) : 0;
  const firstName = taxReturn?.firstName || '';

  const taxableStates = calcResult?.stateResults?.filter(sr => sr.totalStateTax > 0 || sr.localTax > 0) || [];
  const hasStates = taxableStates.length > 0;
  const totalStateTax = taxableStates.reduce((s, sr) => s + sr.totalStateTax, 0);

  const estimatedRec = useMemo(() => {
    if (!taxReturn || !calcResult) return null;
    try { return assessEstimatedPaymentNeed(taxReturn, calcResult); } catch { return null; }
  }, [taxReturn, calcResult]);

  return (
    <div>
      {/* ── Celebration Hero (only when return is complete with no warnings) ──── */}
      {readiness.ready && advisoryCount === 0 && f && (
        <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-surface-800 via-surface-900 to-surface-800 px-6 py-8 text-center mb-6">
          <div className={`absolute inset-0 opacity-20 ${isRefund ? 'bg-gradient-to-br from-emerald-500/30 via-transparent to-telos-blue-600/20' : 'bg-gradient-to-br from-amber-500/20 via-transparent to-telos-orange-500/10'}`} />
          <div className="relative">
            <div className="flex justify-center mb-3">
              <div className={`rounded-full p-3 ${isRefund ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                <PartyPopper className={`w-8 h-8 ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {firstName ? `You did it, ${firstName}!` : 'You did it!'}
            </h1>
            <p className="text-slate-400 text-sm mb-5">
              {hasStates ? 'Your 2025 federal and state tax returns are complete.' : 'Your 2025 federal tax return is complete.'}
            </p>
            {heroAmount > 0 && (
              <div className={`inline-block rounded-xl px-8 py-4 ${isRefund ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">
                  {isRefund ? 'Estimated Federal Refund' : 'Estimated Federal Tax Owed'}
                </p>
                <p className={`text-4xl font-bold tabular-nums ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
                  ${heroAmount.toLocaleString()}
                </p>
              </div>
            )}
            {hasStates && (
              <div className="inline-block rounded-lg px-4 py-2 mt-2 bg-surface-700/50 border border-slate-700">
                <span className="text-xs text-slate-400">Total State Tax: </span>
                <span className="text-sm font-semibold text-white">${totalStateTax.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-center gap-6 mt-5 text-sm">
              <div>
                <p className="text-slate-400 text-xs">Effective Rate</p>
                <p className="text-white font-semibold">{(f.effectiveTaxRate * 100).toFixed(1)}%</p>
              </div>
              <div className="w-px bg-slate-700" />
              <div>
                <p className="text-slate-400 text-xs">Total Tax</p>
                <p className="text-white font-semibold">${f.totalTax.toLocaleString()}</p>
              </div>
              <div className="w-px bg-slate-700" />
              <div>
                <p className="text-slate-400 text-xs">Taxable Income</p>
                <p className="text-white font-semibold">${f.taxableIncome.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Almost done header (no blockers, but has warnings) ── */}
      {readiness.ready && advisoryCount > 0 && (
        <SectionIntro
          icon={<Download className="w-8 h-8" />}
          title="Almost There"
          description="Your return is ready to export, but has advisory warnings you may want to review first."
        />
      )}

      {/* ── Incomplete return header ──────────────────────────── */}
      {!readiness.ready && (
        <>
          <SectionIntro
            icon={<Download className="w-8 h-8" />}
            title="Export Your Return"
            description="Fix the issues below to unlock all downloads."
          />

          {/* Blockers — collapsible */}
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 mb-4">
            <button
              onClick={() => setBlockersExpanded(!blockersExpanded)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-xs font-medium text-red-300">
                  {readiness.blockerCount} missing required {readiness.blockerCount === 1 ? 'field' : 'fields'}
                </span>
              </div>
              {blockersExpanded
                ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              }
            </button>
            {blockersExpanded && (
              <div className="mt-2 space-y-1 pt-2 border-t border-red-500/10">
                {readiness.blockers.map((b, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                      <span className="text-xs text-slate-400 truncate">{b.message}</span>
                    </div>
                    <button
                      onClick={() => goToStep(b.stepId)}
                      className="shrink-0 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
                    >
                      Fix →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Advisory warnings (collapsible, both states) ──────── */}
      {advisoryCount > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-4">
          <button
            onClick={() => setWarningsExpanded(!warningsExpanded)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-medium text-amber-300">
                {advisoryCount} advisory {advisoryCount === 1 ? 'warning' : 'warnings'}
              </span>
            </div>
            {warningsExpanded
              ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            }
          </button>
          {warningsExpanded && (
            <div className="mt-2 space-y-2 pt-2 border-t border-amber-500/10">
              {advisoryWarnings.map((group) => (
                <div key={group.stepId}>
                  <div className="text-[10px] font-medium text-amber-300/60 uppercase tracking-wider mb-1">{group.stepLabel}</div>
                  {group.warnings.map((w, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">{w.message}</span>
                      <button
                        onClick={() => goToStep(group.stepId)}
                        className="shrink-0 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
                      >
                        Fix →
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Downloads ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <button onClick={() => promptExportPassword('irs')} disabled={irsLoading || hasBlockers} className={`card-selectable w-full text-left flex items-center gap-3 py-3 ${hasBlockers ? 'opacity-40 cursor-not-allowed' : ''}`}>
          {irsLoading ? (
            <Loader2 className="w-5 h-5 text-telos-blue-400 animate-spin shrink-0" />
          ) : irsDone ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <FileText className="w-5 h-5 text-telos-blue-400 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">
              {irsLoading ? 'Generating...' : irsDone ? 'Filing Packet Downloaded' : 'Download Complete Return'}
            </p>
            <p className="text-xs text-slate-400">Cover page with filing instructions + all applicable IRS forms filled with your data{hasStates ? ' plus state tax summary' : ''}</p>
          </div>
        </button>

        <button onClick={() => promptExportPassword('summary')} disabled={pdfLoading || hasBlockers} className={`card-selectable w-full text-left flex items-center gap-3 py-3 ${hasBlockers ? 'opacity-40 cursor-not-allowed' : ''}`}>
          {pdfLoading ? (
            <Loader2 className="w-5 h-5 text-telos-blue-400 animate-spin shrink-0" />
          ) : pdfDone ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <FileText className="w-5 h-5 text-slate-400 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">
              {pdfLoading ? 'Generating...' : pdfDone ? 'Summary Downloaded' : 'Download Tax Summary'}
            </p>
            <p className="text-xs text-slate-400">Clean summary of your return — Form 1040, Schedule C, Schedule SE{hasStates ? ' plus state tax summary' : ''}</p>
          </div>
        </button>

        <button onClick={() => promptExportPassword('json')} className="card-selectable w-full text-left flex items-center gap-3 py-3">
          <FileJson className="w-5 h-5 text-telos-blue-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">Export as JSON</p>
            <p className="text-xs text-slate-400">Machine-readable format. Import into other tax tools or keep as a backup.</p>
          </div>
        </button>

        <button onClick={() => promptExportPassword('csv')} className="card-selectable w-full text-left flex items-center gap-3 py-3">
          <FileSpreadsheet className="w-5 h-5 text-telos-blue-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">Export as CSV</p>
            <p className="text-xs text-slate-400">Open in Excel or Google Sheets. All income, deductions, and adjustments.</p>
          </div>
        </button>

        <button onClick={() => promptExportPassword('transfer')} className="card-selectable w-full text-left flex items-center gap-3 py-3">
          <Smartphone className="w-5 h-5 text-telos-orange-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">Transfer to Another Device</p>
            <p className="text-xs text-slate-400">Save an encrypted .telostax file you can import on any other device or browser.</p>
          </div>
        </button>

        {estimatedRec?.recommended && (
          <button onClick={() => promptExportPassword('1040es')} disabled={esLoading || hasBlockers} className={`card-selectable w-full text-left flex items-center gap-3 py-3 ${hasBlockers ? 'opacity-40 cursor-not-allowed' : ''}`}>
            {esLoading ? (
              <Loader2 className="w-5 h-5 text-telos-orange-400 animate-spin shrink-0" />
            ) : esDone ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <Calendar className="w-5 h-5 text-telos-orange-400 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200">
                {esLoading ? 'Generating...' : esDone ? 'Vouchers Downloaded' : 'Download 2026 Estimated Tax Vouchers'}
              </p>
              <p className="text-xs text-slate-400">
                Form 1040-ES payment vouchers — ${estimatedRec.quarterlyAmount.toLocaleString()}/quarter. Mail separately from your tax return.
              </p>
            </div>
          </button>
        )}
      </div>

      {/* ── Disclaimer ─────────────────────────────────────────── */}
      <div className="card mt-6 bg-amber-500/10 border-amber-500/20">
        <p className="text-sm text-amber-300/90 leading-relaxed">
          <strong>Important:</strong> TelosTax is for informational purposes only and does not constitute tax advice.
          Please review your return with a qualified tax professional before filing with the IRS.
          Your data is stored locally and never leaves your device.
        </p>
        <p className="text-xs text-slate-400 mt-2">
          <a href="/terms" className="underline hover:text-slate-400">Terms of Service</a>{' · '}
          <a href="/privacy" className="underline hover:text-slate-400">Privacy Policy</a>
        </p>
      </div>

      {/* ── Delete data ──────────────────────────────────────── */}
      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete all my data
        </button>
      ) : (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-300 font-medium mb-1">Permanently delete everything?</p>
          <p className="text-xs text-slate-400 mb-3">
            This will instantly and permanently delete your entire tax return, all income data,
            deductions, and personal information. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteEverything}
              className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              Yes, delete everything
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <StepNavigation continueLabel="Done" showBack onContinue={() => setShowCompletion(true)} />

      {/* ── Completion Screen ───────────────────────────────── */}
      {showCompletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/95 px-4">
          <div className="max-w-lg w-full text-center space-y-6">
            <div className="relative">
              <div className="flex justify-center mb-4">
                <div className={`rounded-full p-5 ${isRefund ? 'bg-emerald-500/15' : 'bg-amber-500/15'} ring-4 ${isRefund ? 'ring-emerald-500/10' : 'ring-amber-500/10'}`}>
                  <PartyPopper className={`w-12 h-12 ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`} />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {firstName ? `Congrats, ${firstName}!` : 'Congratulations!'}
              </h1>
              <p className="text-slate-400 mb-6">
                Your 2025 tax return is complete and exported.
              </p>
            </div>

            {f && heroAmount > 0 && (
              <div className={`rounded-xl px-8 py-5 ${isRefund ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">
                  {isRefund ? 'Estimated Federal Refund' : 'Estimated Federal Tax Owed'}
                </p>
                <p className={`text-5xl font-bold tabular-nums ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
                  ${heroAmount.toLocaleString()}
                </p>
              </div>
            )}

            {f && (
              <div className="flex justify-center gap-6 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Effective Rate</p>
                  <p className="text-white font-semibold">{(f.effectiveTaxRate * 100).toFixed(1)}%</p>
                </div>
                <div className="w-px bg-slate-700" />
                <div>
                  <p className="text-slate-500 text-xs">Total Tax</p>
                  <p className="text-white font-semibold">${f.totalTax.toLocaleString()}</p>
                </div>
                <div className="w-px bg-slate-700" />
                <div>
                  <p className="text-slate-500 text-xs">Taxable Income</p>
                  <p className="text-white font-semibold">${f.taxableIncome.toLocaleString()}</p>
                </div>
              </div>
            )}

            <div className="pt-2 space-y-3">
              <button
                onClick={() => navigate('/')}
                className="btn-primary px-8 py-3 text-base"
              >
                Return to Dashboard
              </button>
              <button
                onClick={() => setShowCompletion(false)}
                className="block mx-auto text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Back to Export
              </button>
            </div>

            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Remember to review your return with a qualified tax professional before filing.
              Your data remains safely stored on this device.
            </p>
          </div>
        </div>
      )}

      {/* ── Export Password Modal ────────────────────────────── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowPasswordModal(false)}>
          <div ref={exportModalRef} role="dialog" aria-modal="true" aria-label="Password-protect export" className="w-full max-w-sm rounded-xl bg-surface-800 border border-slate-700 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-telos-blue-400" />
              <h3 className="text-sm font-semibold text-white">Password-Protect Export</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              {pendingExportRef.current === 'transfer'
                ? 'A password is required to encrypt your .telostax transfer file. You\u2019ll need this password to import it on another device.'
                : 'This file contains sensitive tax data (SSN, income). Add a password to encrypt it, or skip to download without protection.'}
            </p>
            <form onSubmit={(e) => { e.preventDefault(); executeExport(exportPassword); }}>
              <div className="relative mb-4">
                <input
                  ref={passwordInputRef}
                  type={showExportPassword ? 'text' : 'password'}
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-900 border border-slate-600 rounded-lg text-white text-sm focus:border-telos-blue-500 focus:ring-1 focus:ring-telos-blue-500 focus:outline-none pr-10"
                  placeholder="Enter password (optional)"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowExportPassword(!showExportPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-300"
                  tabIndex={-1}
                  aria-label={showExportPassword ? 'Hide password' : 'Show password'}
                >
                  {showExportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="submit"
                className="btn-primary w-full flex items-center justify-center gap-1.5 text-sm"
                disabled={!exportPassword}
              >
                <Lock className="w-3.5 h-3.5" />
                Download Protected
              </button>
              {pendingExportRef.current !== 'transfer' && (
                <button
                  type="button"
                  onClick={() => executeExport()}
                  className="w-full mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors text-center py-1"
                >
                  Skip, download without password
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
