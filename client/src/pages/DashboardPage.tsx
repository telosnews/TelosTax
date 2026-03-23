import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReturns, createReturn, deleteReturn, getReturn, wipeAllData, exportAllData, importReturn } from '../api/client';
import { Plus, FileText, Trash2, CircleDollarSign, Code2, Lock, ArrowRight, Download, Upload, Eye, EyeOff, Loader2, Hourglass, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { importReturnFromFile } from '../services/fileTransfer';
import { TaxReturn, evaluateCondition } from '@telostax/engine';
import { WIZARD_STEPS, SECTIONS, useTaxReturnStore } from '../store/taxReturnStore';
import ErrorBoundary from '../components/common/ErrorBoundary';
import LockForm from '../components/common/LockScreen';
import { useFocusTrap } from '../hooks/useFocusTrap';

const FILING_STATUS_LABELS: Record<number, string> = {
  1: 'Single',
  2: 'Married Filing Jointly',
  3: 'Married Filing Separately',
  4: 'Head of Household',
  5: 'Qualifying Surviving Spouse',
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    in_progress: 'bg-telos-blue-500/20 text-telos-blue-400 border-telos-blue-500/30',
    review: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    completed: 'bg-telos-orange-500/20 text-telos-orange-400 border-telos-orange-500/30',
  };
  const labels: Record<string, string> = {
    in_progress: 'In Progress',
    review: 'Review',
    completed: 'Completed',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${styles[status] || styles.in_progress}`}>
      {labels[status] || status}
    </span>
  );
}

/** Compute progress info for a return using the wizard step definitions. */
function getReturnProgress(ret: TaxReturn) {
  const visible = WIZARD_STEPS.filter((s) => {
    if (s.declarativeCondition) return evaluateCondition(s.declarativeCondition, ret);
    if (s.condition) return s.condition(ret);
    return true;
  });
  const totalSteps = visible.length;

  // Prefer stepId (safe with dynamic steps) → fall back to numeric index
  let currentIndex = 0;
  if ((ret as any).currentStepId) {
    const idx = visible.findIndex((s) => s.id === (ret as any).currentStepId);
    currentIndex = idx >= 0 ? idx : 0;
  } else if (typeof (ret as any).currentStep === 'number') {
    currentIndex = Math.min((ret as any).currentStep, totalSteps - 1);
  }

  const currentStepDef = visible[currentIndex];
  const sectionLabel = currentStepDef
    ? SECTIONS.find((s) => s.id === currentStepDef.section)?.label || ''
    : '';
  const pct = totalSteps <= 1 ? 100 : Math.round((currentIndex / (totalSteps - 1)) * 100);
  return { currentIndex, totalSteps, sectionLabel, pct, stepLabel: currentStepDef?.label || '' };
}

function DeleteConfirmation({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div
      role="alert"
      aria-label="Confirm deletion"
      className="card mt-1 bg-red-500/10 border-red-500/30 animate-in slide-in-from-top-2 fade-in duration-200"
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
    >
      <div className="flex items-start gap-3">
        <Trash2 className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-red-300 font-medium mb-1">Delete this return?</p>
          <p className="text-sm text-slate-400 mb-3">
            This will delete all data for this tax return. You'll have a few seconds to undo.
          </p>
          <div className="flex gap-2">
            <button
              ref={confirmRef}
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              Yes, delete
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DashboardProps {
  lockMode?: 'setup' | 'unlock';
  onUnlock?: (passphrase: string) => Promise<boolean>;
  lockError?: string | null;
}

export default function DashboardPage({ lockMode, onUnlock, lockError }: DashboardProps = {}) {
  const isLocked = !!lockMode;
  const navigate = useNavigate();
  const [returns, setReturns] = useState<TaxReturn[]>(() => isLocked ? [] : listReturns());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmWipeAll, setConfirmWipeAll] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);

  // Export password modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirm, setExportConfirm] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const exportModalRef = useRef<HTMLDivElement>(null);
  const exportPasswordRef = useRef<HTMLInputElement>(null);

  // Consent modal state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [pendingAction, setPendingAction] = useState<'create' | 'extension' | null>(null);
  const consentModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(consentModalRef, showConsentModal);

  // Import .telostax file state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importPasswordRef = useRef<HTMLInputElement>(null);
  const importModalRef = useRef<HTMLDivElement>(null);

  // Export modal handlers
  const dismissExportCb = useCallback(() => {
    setShowExportModal(false);
    setExportPassword('');
    setExportConfirm('');
    setExportError('');
  }, []);
  useFocusTrap(exportModalRef, showExportModal, dismissExportCb);

  const handleExport = async () => {
    if (exportPassword.length < 8) {
      setExportError('Password must be at least 8 characters');
      return;
    }
    if (exportPassword !== exportConfirm) {
      setExportError('Passwords do not match');
      return;
    }
    setExportLoading(true);
    setExportError('');
    try {
      await exportAllData(exportPassword);
      toast.success('Encrypted export downloaded');
      dismissExportCb();
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  // Focus trap: lock keyboard focus inside the import modal while it's open
  const dismissImportCb = useCallback(() => {
    setShowImportModal(false);
    setImportFile(null);
    setImportPassword('');
    setImportError('');
  }, []);
  useFocusTrap(importModalRef, showImportModal, dismissImportCb);

  const refresh = useCallback(() => setReturns(listReturns()), []);

  // Refresh returns list after unlock (isLocked changes from true to false)
  useEffect(() => {
    if (!isLocked) {
      setReturns(listReturns());
    }
  }, [isLocked]);

  // Refresh returns list when tab regains focus (cross-tab sync)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  // Detect cross-tab localStorage writes and refresh
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('telostax:')) {
        refresh();
        toast.info('Data updated in another tab', { id: 'cross-tab-sync', duration: 3000 });
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refresh]);

  const hasConsented = () => localStorage.getItem('telostax:consent') !== null;

  const handleCreate = () => {
    if (hasConsented()) {
      const tr = createReturn();
      refresh();
      navigate(`/return/${tr.id}`);
      return;
    }
    setConsentChecked(false);
    setPendingAction('create');
    setShowConsentModal(true);
  };

  const handleFileExtension = () => {
    // If they already have a return, go straight to it
    const existing = returns[0];
    if (existing) {
      navigate(`/return/${existing.id}?tool=file_extension`);
      return;
    }
    if (hasConsented()) {
      const tr = createReturn();
      refresh();
      navigate(`/return/${tr.id}?tool=file_extension`);
      return;
    }
    setConsentChecked(false);
    setPendingAction('extension');
    setShowConsentModal(true);
  };

  const handleConsentConfirm = () => {
    setShowConsentModal(false);
    // Persist record of consent acceptance
    localStorage.setItem('telostax:consent', JSON.stringify({
      termsVersion: 'March 2026',
      privacyVersion: 'March 2026',
      acceptedAt: new Date().toISOString(),
    }));
    if (pendingAction === 'create') {
      const tr = createReturn();
      refresh();
      navigate(`/return/${tr.id}`);
    } else if (pendingAction === 'extension') {
      const tr = createReturn();
      refresh();
      navigate(`/return/${tr.id}?tool=file_extension`);
    }
    setPendingAction(null);
  };

  const handleDelete = (id: string) => {
    // Snapshot data before deleting so we can restore on undo
    let snapshot: TaxReturn | null = null;
    let chatSnapshot: string | null = null;
    try {
      snapshot = getReturn(id);
      chatSnapshot = localStorage.getItem(`telostax:chat:${id}`);
    } catch { /* return already gone — proceed with delete */ }

    deleteReturn(id);
    setConfirmDeleteId(null);
    refresh();

    const label = snapshot?.firstName && snapshot?.lastName
      ? `${snapshot.firstName} ${snapshot.lastName}`
      : 'Tax return';

    toast(`Deleted ${label}`, {
      action: {
        label: 'Undo',
        onClick: () => {
          if (!snapshot) return;
          // Restore the return data and re-add to the ID list
          importReturn(snapshot);
          // Restore chat history if there was any
          if (chatSnapshot) {
            localStorage.setItem(`telostax:chat:${snapshot.id}`, chatSnapshot);
          }
          refresh();
          toast.success(`Restored ${label}`);
        },
      },
      duration: 6000,
    });
  };

  const dismissDelete = useCallback(() => {
    setConfirmDeleteId(null);
    // Restore focus to the trigger button that opened the confirmation
    requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  }, []);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportPassword('');
    setImportError('');
    setShowImportPassword(false);
    setShowImportModal(true);
    setTimeout(() => importPasswordRef.current?.focus(), 100);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importFile || !importPassword) return;
    setImportLoading(true);
    setImportError('');
    const result = await importReturnFromFile(importFile, importPassword);
    setImportLoading(false);
    if (result.ok) {
      try {
        importReturn(result.taxReturn);
      } catch {
        setImportError('Please unlock your data before importing.');
        return;
      }
      refresh();
      setShowImportModal(false);
      setImportFile(null);
      toast.success('Tax return imported successfully');
      navigate(`/return/${result.taxReturn.id}`);
    } else {
      setImportError(result.message);
    }
  };

  const dismissImport = dismissImportCb;

  const filingStatusLabel = (fs: number | undefined) => {
    return fs != null ? FILING_STATUS_LABELS[fs] : null;
  };

  return (
    <div className="min-h-screen bg-surface-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-4xl sm:text-5xl font-bold"><span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">Tax</span></h1>
          <p className="text-slate-400 text-sm">2025 Tax Year</p>
        </div>
        <p className="text-slate-400 mb-8 mt-2">
          Free, private, open-source tax prep.
        </p>

        {/* Value props */}
        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          <button
            onClick={() => navigate('/pledge')}
            className="card flex flex-col items-center text-center py-5 px-4 hover:border-slate-500 transition-colors group cursor-pointer"
          >
            <span className="relative mb-2.5">
              <CircleDollarSign className="w-6 h-6 text-emerald-400" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="block w-7 h-0.5 bg-emerald-400 rotate-45 rounded-full" />
              </span>
            </span>
            <h3 className="font-semibold text-slate-200 text-sm mb-1 group-hover:text-white transition-colors">Free</h3>
            <p className="text-xs text-slate-400 leading-relaxed">No upsells, no hidden fees, no data collection.</p>
            <span className="text-xs text-slate-400 mt-2 group-hover:text-white transition-colors">Learn more &rarr;</span>
          </button>
          <button
            onClick={() => navigate('/privacy')}
            className="card flex flex-col items-center text-center py-5 px-4 hover:border-slate-500 transition-colors group cursor-pointer"
          >
            <Lock className="w-6 h-6 text-telos-orange-400 mb-2.5" />
            <h3 className="font-semibold text-slate-200 text-sm mb-1 group-hover:text-white transition-colors">Private</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Your tax data stays on your device. Nothing is sent to any server.</p>
            <span className="text-xs text-slate-400 mt-2 group-hover:text-white transition-colors">Learn more &rarr;</span>
          </button>
          <a
            href="https://github.com/telosnews/TelosTax"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Source — View on GitHub (opens in new tab)"
            className="card flex flex-col items-center text-center py-5 px-4 hover:border-slate-500 transition-colors group cursor-pointer"
          >
            <Code2 className="w-6 h-6 text-telos-blue-400 mb-2.5" />
            <h3 className="font-semibold text-slate-200 text-sm mb-1 group-hover:text-white transition-colors">Open Source</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Our tax engine is on GitHub. Read the code, verify the math.</p>
            <span className="text-xs text-slate-400 mt-2 group-hover:text-white transition-colors">View on GitHub &rarr;</span>
          </a>
        </div>

        {/* ─── Locked: show passphrase form ─── */}
        {isLocked && onUnlock && (
          <div className="mb-8">
            <LockForm
              mode={lockMode!}
              onUnlock={onUnlock}
              error={lockError}
              inline
            />
          </div>
        )}

        {/* ─── Unlocked: show return management ─── */}
        {!isLocked && <>

        {/* Continue latest return CTA */}
        {returns.length > 0 && (() => {
          try {
            const latest = [...returns].sort((a, b) =>
              (Date.parse(b.updatedAt ?? '') || 0) - (Date.parse(a.updatedAt ?? '') || 0)
              || (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0)
            )[0];
            const p = getReturnProgress(latest);
            const name = latest.firstName && latest.lastName
              ? `${latest.firstName} ${latest.lastName}`
              : 'your return';
            return (
              <button
                onClick={() => navigate(`/return/${latest.id}`)}
                className="w-full card flex items-center gap-4 mb-4 hover:border-telos-blue-500/50 transition-colors group cursor-pointer"
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-white group-hover:text-telos-blue-300 transition-colors">
                    Continue where you left off
                  </p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {name} &middot; Step {p.currentIndex + 1}/{p.totalSteps}
                    {p.sectionLabel && <> &middot; {p.sectionLabel}</>}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-telos-blue-400 transition-colors shrink-0" />
              </button>
            );
          } catch {
            return null;
          }
        })()}

        {/* Create new / Import */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-center">
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 justify-center w-full sm:w-52 px-4 py-2.5 text-sm font-medium rounded-lg bg-telos-blue-600 hover:bg-telos-blue-500 text-white transition-colors"
            >
              <Plus className="w-5 h-5" />
              Start New Tax Return
            </button>
            <button
              onClick={handleFileExtension}
              className="flex items-center gap-2 justify-center w-full sm:w-52 px-4 py-2.5 text-sm font-medium rounded-lg bg-telos-blue-600 hover:bg-telos-blue-500 text-white transition-colors"
            >
              <Hourglass className="w-4 h-4" />
              File an Extension
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 justify-center w-full sm:w-52 px-4 py-2.5 text-sm font-medium rounded-lg bg-telos-blue-600 hover:bg-telos-blue-500 text-white transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import .telostax File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".telostax"
              onChange={handleFileSelected}
              className="hidden"
            />
          </div>
          {returns.length === 0 ? (
            <p className="text-sm text-slate-400 mt-2 sm:pl-0.5">
              We'll walk you through income, deductions, credits, and filing — step by step, at your own pace.
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-1.5 sm:pl-0.5">
              Have a .telostax file? These are encrypted backups you can export from any TelosTax session to transfer your return between devices.
            </p>
          )}
        </div>

        {/* Existing returns */}
        <ErrorBoundary>
        {returns.length === 0 ? (
          <div className="card text-center py-12">
            <FileText className="w-12 h-12 text-telos-orange-400 mx-auto mb-4" />
            <p className="text-white text-xl font-semibold mb-2">Ready to file your 2025 taxes?</p>
            <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
              It's free, private, and lets you file at your own pace.
            </p>
            <button onClick={handleCreate} className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-lg bg-telos-blue-600 hover:bg-telos-blue-500 text-white transition-colors">
              <Plus className="w-5 h-5" /> Start My Tax Return
            </button>
            <p className="text-xs text-slate-400 mt-4">Your data stays in your browser — no account needed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Your Returns</h2>
            {returns.map((ret) => (
              <div key={ret.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Open tax return for ${ret.firstName && ret.lastName ? `${ret.firstName} ${ret.lastName}` : `started ${new Date(ret.createdAt).toLocaleDateString()}`}`}
                  className="card flex items-center justify-between gap-3 cursor-pointer hover:border-slate-500 transition-colors focus-visible:ring-2 focus-visible:ring-telos-blue-500 focus-visible:outline-none"
                  onClick={() => navigate(`/return/${ret.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/return/${ret.id}`); } }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium truncate">
                        {ret.firstName && ret.lastName
                          ? `${ret.firstName} ${ret.lastName}`
                          : `Started ${new Date(ret.createdAt).toLocaleDateString()}`}
                      </span>
                      <StatusBadge status={ret.status} />
                    </div>
                    <div className="text-sm text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span>{ret.taxYear}</span>
                      {filingStatusLabel(ret.filingStatus) && (
                        <>
                          <span className="text-slate-600">&middot;</span>
                          <span>{filingStatusLabel(ret.filingStatus)}</span>
                        </>
                      )}
                      <span className="text-slate-600">&middot;</span>
                      <span>Updated {new Date(ret.updatedAt).toLocaleDateString()}</span>
                    </div>
                    {/* Progress indicator */}
                    {(() => {
                      const p = getReturnProgress(ret);
                      return (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-telos-blue-500 rounded-full transition-all"
                              style={{ width: `${p.pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            Step {p.currentIndex + 1}/{p.totalSteps}
                            {p.sectionLabel && <> &middot; {p.sectionLabel}</>}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    ref={confirmDeleteId === ret.id ? deleteTriggerRef : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(ret.id);
                    }}
                    className="p-2 text-slate-400 hover:text-red-400 transition-colors shrink-0 ml-2"
                    aria-label="Delete return"
                    title="Delete return"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Inline delete confirmation */}
                {confirmDeleteId === ret.id && (
                  <DeleteConfirmation
                    onConfirm={() => handleDelete(ret.id)}
                    onCancel={dismissDelete}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        </ErrorBoundary>

        </>}

        {/* Disclaimer & Legal Links */}
        <div className="mt-12 text-center">
          <p className="text-sm text-slate-400 leading-relaxed">
            Your tax data is stored locally on your device and never sent to any server.
            This tool is for informational purposes only and does not constitute tax advice.
          </p>
          <div className="flex items-center justify-center gap-3 mt-3 text-xs">
            <button onClick={() => navigate('/pledge')} className="text-slate-400 hover:text-slate-300 transition-colors">
              About
            </button>
            <span className="text-slate-700">&middot;</span>
            <button onClick={() => navigate('/terms')} className="text-slate-400 hover:text-slate-300 transition-colors">
              Terms of Service
            </button>
            <span className="text-slate-700">&middot;</span>
            <button onClick={() => navigate('/privacy')} className="text-slate-400 hover:text-slate-300 transition-colors">
              Privacy Policy
            </button>
          </div>
          {/* Data management */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col items-center gap-3">
            {returns.length > 0 && (
              <button
                onClick={() => { setShowExportModal(true); setTimeout(() => exportPasswordRef.current?.focus(), 100); }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-telos-blue-400 transition-colors"
              >
                <Download className="w-3 h-3" />
                Download my data
              </button>
            )}
            {confirmWipeAll ? (
              <div className="inline-flex items-center gap-3 text-sm">
                <span className="text-red-400">Delete all tax data, caches, and offline storage?</span>
                <button
                  onClick={async () => {
                    await wipeAllData();
                    setConfirmWipeAll(false);
                    refresh();
                    toast.success('All data has been deleted');
                  }}
                  className="px-3 py-1 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                >
                  Yes, delete everything
                </button>
                <button
                  onClick={() => setConfirmWipeAll(false)}
                  className="px-3 py-1 text-xs font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmWipeAll(true)}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                Delete all my data
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowConsentModal(false)}>
          <div ref={consentModalRef} role="dialog" aria-modal="true" aria-label="Prototype disclaimer" className="w-full max-w-md rounded-xl bg-surface-800 border border-amber-500/30 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-amber-300">Before you start</h3>
            </div>
            <div className="text-sm text-slate-300 leading-relaxed space-y-3 mb-5">
              <p>
                TelosTax is a prototype built with AI. It has not been professionally audited by
                tax experts or human software engineers. The tax engine may contain errors.
              </p>
              <p>
                Do not rely on this app to file your taxes without having your return carefully
                reviewed by a qualified tax professional (CPA, Enrolled Agent, or tax attorney).
              </p>
            </div>
            <label className="flex items-start gap-2.5 mb-5 cursor-pointer group">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 rounded border-slate-500 bg-surface-700 text-telos-blue-500 focus:ring-telos-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                I understand this is a prototype, does not constitute tax advice, and that I am
                responsible for verifying the accuracy of any tax calculations before filing.
                I have read and agree to
                the <button onClick={() => navigate('/terms')} className="text-telos-blue-400 hover:text-telos-blue-300 underline">Terms of Service</button> and <button onClick={() => navigate('/privacy')} className="text-telos-blue-400 hover:text-telos-blue-300 underline">Privacy Policy</button>.
              </span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleConsentConfirm}
                disabled={!consentChecked}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-telos-blue-600 hover:bg-telos-blue-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
              <button
                onClick={() => setShowConsentModal(false)}
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-surface-700 hover:bg-surface-600 text-slate-300 border border-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Password Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={dismissExportCb}>
          <div ref={exportModalRef} role="dialog" aria-modal="true" aria-label="Export data with password" className="w-full max-w-sm rounded-xl bg-surface-800 border border-slate-700 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-telos-orange-400" />
              <h3 className="text-sm font-semibold text-white">Encrypt Export</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Choose a password to encrypt your exported data. You'll need this password to import the file later.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleExport(); }}>
              <div className="relative mb-2">
                <input
                  ref={exportPasswordRef}
                  type={showExportPassword ? 'text' : 'password'}
                  value={exportPassword}
                  onChange={(e) => { setExportPassword(e.target.value); setExportError(''); }}
                  className="w-full px-3 py-2.5 bg-surface-900 border border-slate-600 rounded-lg text-white text-sm focus:border-telos-blue-500 focus:ring-1 focus:ring-telos-blue-500 focus:outline-none pr-10"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
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
              <input
                type={showExportPassword ? 'text' : 'password'}
                value={exportConfirm}
                onChange={(e) => { setExportConfirm(e.target.value); setExportError(''); }}
                className="w-full px-3 py-2.5 bg-surface-900 border border-slate-600 rounded-lg text-white text-sm focus:border-telos-blue-500 focus:ring-1 focus:ring-telos-blue-500 focus:outline-none mb-2"
                placeholder="Confirm password"
                autoComplete="new-password"
              />
              {exportError && (
                <p className="text-xs text-red-400 mb-3">{exportError}</p>
              )}
              <button
                type="submit"
                className="btn-primary w-full flex items-center justify-center gap-1.5 text-sm mt-3"
                disabled={!exportPassword || !exportConfirm || exportLoading}
              >
                {exportLoading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Encrypting...</>
                ) : (
                  <><Download className="w-3.5 h-3.5" /> Export Encrypted</>
                )}
              </button>
              <button
                type="button"
                onClick={dismissExportCb}
                className="w-full mt-2 text-xs text-slate-400 hover:text-slate-300 transition-colors text-center py-1"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Import Password Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={dismissImport}>
          <div ref={importModalRef} role="dialog" aria-modal="true" aria-label="Import .telostax file" className="w-full max-w-sm rounded-xl bg-surface-800 border border-slate-700 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-telos-orange-400" />
              <h3 className="text-sm font-semibold text-white">Import .telostax File</h3>
            </div>
            <p className="text-xs text-slate-400 mb-1">
              <span className="font-medium text-slate-300">{importFile?.name}</span>
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Enter the password that was used when this file was exported.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleImport(); }}>
              <div className="relative mb-2">
                <input
                  ref={importPasswordRef}
                  type={showImportPassword ? 'text' : 'password'}
                  value={importPassword}
                  onChange={(e) => { setImportPassword(e.target.value); setImportError(''); }}
                  className="w-full px-3 py-2.5 bg-surface-900 border border-slate-600 rounded-lg text-white text-sm focus:border-telos-blue-500 focus:ring-1 focus:ring-telos-blue-500 focus:outline-none pr-10"
                  placeholder="Enter password"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowImportPassword(!showImportPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-300"
                  tabIndex={-1}
                  aria-label={showImportPassword ? 'Hide password' : 'Show password'}
                >
                  {showImportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {importError && (
                <p className="text-xs text-red-400 mb-3">{importError}</p>
              )}
              <button
                type="submit"
                className="btn-primary w-full flex items-center justify-center gap-1.5 text-sm mt-3"
                disabled={!importPassword || importLoading}
              >
                {importLoading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Decrypting...</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" /> Import Return</>
                )}
              </button>
              <button
                type="button"
                onClick={dismissImport}
                className="w-full mt-2 text-xs text-slate-400 hover:text-slate-300 transition-colors text-center py-1"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
