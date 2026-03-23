/**
 * Smart Expense Scanner — top-level tool view.
 *
 * Streamlined flow for BYOK users:
 *   upload → setup → scanning → results
 *
 * No intermediate pattern scan step — the AI does all the work,
 * with deterministic gates applied as cross-validation.
 *
 * Private mode: shows a message explaining that AI is required.
 */

import { useState, useRef } from 'react';
import TransactionCategorizerView from './TransactionCategorizerView';
import ExpenseScannerSetup from './ExpenseScannerSetup';
import ApplyToReturnModal from './ApplyToReturnModal';
import SectionIntro from '../common/SectionIntro';
import FileDropZone from '../import/FileDropZone';
import ToolViewWrapper from './ToolViewWrapper';
import { Sparkles, Loader2, ArrowLeft, ScanSearch, Key, Upload, FileText, X } from 'lucide-react';
import { useDeductionFinder } from '../../hooks/useDeductionFinder';
import { useDeductionFinderStore } from '../../store/deductionFinderStore';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import type { TransactionCategory } from '../../services/transactionCategorizerTypes';
import type { ApplyPreview } from '../../services/categorizationApplier';

export default function ExpenseScannerToolView() {
  const {
    allTransactions,
    categorizeTransactions,
    cancelCategorization,
    categorizationResult,
    isCategorizing,
    categorizationProgress,
    aiError,
    approveCategory,
    updateTransaction,
    processFile,
    removeFile,
  } = useDeductionFinder();

  const scannerPhase = useDeductionFinderStore((s) => s.scannerPhase);
  const setScannerPhase = useDeductionFinderStore((s) => s.setScannerPhase);
  const setEnabledCategories = useDeductionFinderStore((s) => s.setEnabledCategories);
  const uploadedFiles = useDeductionFinderStore((s) => s.uploadedFiles);
  const isProcessing = useDeductionFinderStore((s) => s.isProcessing);
  const mode = useAISettingsStore((s) => s.mode);
  const isPrivate = mode === 'private';
  const { updateField, updateDeepField, taxReturn } = useTaxReturnStore();
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Compute effective phase
  const hasResults = categorizationResult != null;
  const effectivePhase = isCategorizing
    ? 'scanning'
    : hasResults && scannerPhase !== 'setup' && scannerPhase !== 'upload'
      ? 'results'
      : scannerPhase;

  // Auto-advance: when transactions are loaded and we're on upload, go to setup
  const hasTransactions = allTransactions.length > 0;

  // Queue files and process sequentially (multi-drop fires onFile for each file synchronously)
  const fileQueueRef = useRef<File[]>([]);
  const processingQueueRef = useRef(false);

  const processQueue = async () => {
    if (processingQueueRef.current) return;
    processingQueueRef.current = true;
    console.log(`[expense-scanner] Queue started, ${fileQueueRef.current.length} files`);
    while (fileQueueRef.current.length > 0) {
      const file = fileQueueRef.current.shift()!;
      console.log(`[expense-scanner] Processing: ${file.name}`);
      try {
        await processFile(file);
        console.log(`[expense-scanner] Done: ${file.name}`);
      } catch (err) {
        console.error(`[expense-scanner] Error processing ${file.name}:`, err);
      }
    }
    processingQueueRef.current = false;
    console.log('[expense-scanner] Queue complete');
  };

  const handleFileUpload = (file: File) => {
    console.log(`[expense-scanner] File received: ${file.name}`);
    // Clear stale categorization results on first new upload
    if (fileQueueRef.current.length === 0 && !processingQueueRef.current) {
      useDeductionFinderStore.getState().setCategorizationResult(null);
    }
    fileQueueRef.current.push(file);
    processQueue();
  };

  const handleRemoveFile = (fileName: string) => {
    removeFile(fileName);
    // Clear stale categorization results
    useDeductionFinderStore.getState().setCategorizationResult(null);
  };

  const handleStartScan = async (categories: TransactionCategory[], contextHints: Record<string, boolean>) => {
    setEnabledCategories(categories);
    if (taxReturn) {
      updateField('expenseScanner', {
        ...taxReturn.expenseScanner,
        enabledCategories: categories,
        contextHints,
      });
    }
    setScannerPhase('scanning');
    try {
      await categorizeTransactions();
      setScannerPhase('results');
    } catch {
      // Error is captured in aiError state — reset phase so user can navigate
      setScannerPhase('setup');
    }
  };

  const handleApplyToReturn = () => setShowApplyModal(true);

  const handleConfirmApply = (preview: ApplyPreview) => {
    if (!taxReturn) return;
    if (preview.discoveryKeysToEnable.length > 0) {
      const discovery = { ...(taxReturn.incomeDiscovery || {}) };
      for (const key of preview.discoveryKeysToEnable) {
        if (discovery[key] !== 'yes') discovery[key] = 'yes';
      }
      updateField('incomeDiscovery', discovery);
    }
    for (const update of preview.updates) {
      if (!update.path) continue;
      updateDeepField(update.path, update.newValue);
    }
    setShowApplyModal(false);
  };

  return (
    <ToolViewWrapper>
      <SectionIntro
        icon={<ScanSearch className="w-8 h-8" />}
        title="Smart Expense Scanner"
        description={isPrivate
          ? 'AI-powered transaction categorization requires BYOK mode.'
          : 'Upload transactions, select what to look for, and let TelosAI categorize your expenses by tax relevance.'
        }
      />

      {/* ─── Private Mode: upgrade CTA ─── */}
      {isPrivate && (
        <div className="rounded-lg border border-telos-blue-500/30 bg-telos-blue-500/5 p-5 mt-2">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-telos-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-telos-blue-300 mb-1">Unlock Smart Expense Scanner</p>
              <p className="text-xs text-slate-400 mb-3">
                Add your own API key to scan your bank and credit card transactions
                for tax-relevant expenses. TelosAI categorizes every transaction by
                type — business expenses, medical, charitable, home office, and more.
              </p>
              <button
                onClick={() => useAISettingsStore.getState().setMode('byok')}
                className="text-xs font-medium text-telos-blue-400 hover:text-telos-blue-300
                           bg-telos-blue-500/10 hover:bg-telos-blue-500/20
                           border border-telos-blue-500/30 px-3 py-1.5 rounded transition-colors"
              >
                Set up BYOK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Phase: Upload ─── */}
      {effectivePhase === 'upload' && !isPrivate && (
        <div className="mt-2 rounded-xl border border-slate-700 bg-surface-800 p-5">
          {/* Card header */}
          <div className="flex items-center gap-2.5 mb-4">
            <ScanSearch className="w-5 h-5 text-telos-blue-400 shrink-0" />
            <div>
              <h3 className="font-medium text-slate-200">Scan your 2025 transactions</h3>
              {hasTransactions ? (
                <p className="text-xs text-slate-400 mt-0.5">
                  {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} · {allTransactions.length.toLocaleString()} transactions loaded
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload your transactions to find tax-relevant expenses and deductions
                </p>
              )}
            </div>
          </div>

          {/* Uploaded files list */}
          {uploadedFiles.length > 0 && (
            <div className="mb-4 space-y-2">
              {uploadedFiles.map((f) => (
                <div key={f.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800 border border-slate-700">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-300 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-slate-500">{f.transactionCount.toLocaleString()} txns</span>
                  <span className="text-xs text-slate-600">{f.format}</span>
                  <button
                    onClick={() => handleRemoveFile(f.name)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                    title="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setScannerPhase('setup')}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                           bg-violet-600 hover:bg-violet-500 text-white font-semibold
                           shadow-lg shadow-violet-600/20 transition-all mt-3"
              >
                <Sparkles className="w-4 h-4" />
                Continue with {allTransactions.length.toLocaleString()} transactions
              </button>
            </div>
          )}

          {/* File drop zone */}
          <FileDropZone
            accept=".csv,.pdf"
            onFile={handleFileUpload}
            label="Drop transaction exports"
            sublabel="CSV or PDF — drop multiple files at once"
            multiple
          />
          <p className="text-xs text-slate-400 mt-3">
            Supports CSV exports from Amex, Apple Card, Bank of America, Cash App, Chase, Citi, PayPal, Venmo, Wells Fargo, Monarch Money, YNAB, Copilot, etc., plus PDF bank statements.
          </p>

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 py-4 mt-3">
              <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
              <span className="text-sm text-slate-400">Processing file...</span>
            </div>
          )}
        </div>
      )}

      {/* ─── Phase: Setup ─── */}
      {effectivePhase === 'setup' && !isPrivate && (
        <>
          <button
            onClick={() => setScannerPhase('upload')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 mb-3 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to file upload
          </button>
          <ExpenseScannerSetup
            transactionCount={allTransactions.length}
            onStartScan={handleStartScan}
          />
        </>
      )}

      {/* ─── Phase: Scanning ─── */}
      {effectivePhase === 'scanning' && (
        <div className="flex flex-col items-center gap-3 py-10 rounded-xl border border-violet-500/20 bg-violet-600/5 mt-2">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <div className="text-center">
            <div className="text-sm text-violet-300 font-medium">Scanning your transactions...</div>
            {categorizationProgress && (
              <div className="text-xs text-slate-400 mt-1">{categorizationProgress}</div>
            )}
          </div>
          <button
            onClick={() => { cancelCategorization(); setScannerPhase('setup'); }}
            className="text-xs text-slate-400 hover:text-slate-300 px-3 py-1.5 rounded border border-slate-600 hover:border-slate-500 transition-colors mt-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ─── Phase: Results ─── */}
      {effectivePhase === 'results' && categorizationResult && (
        <>
          <TransactionCategorizerView
            result={categorizationResult}
            onApproveCategory={approveCategory}
            onUpdateTransaction={updateTransaction}
            onApplyToReturn={handleApplyToReturn}
          />
          <button
            onClick={() => setScannerPhase('setup')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-300 mt-4 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to category selection
          </button>
        </>
      )}

      {/* AI error — only show on setup/scanning phases, not after navigating away */}
      {aiError && (effectivePhase === 'setup' || effectivePhase === 'scanning') && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-xs text-red-400">{aiError}</p>
          <button
            onClick={() => {
              useDeductionFinderStore.getState().setAiError(null);
              setScannerPhase('setup');
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 mt-3 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Dismiss and go back
          </button>
        </div>
      )}

      {/* Apply to return confirmation modal */}
      {showApplyModal && categorizationResult && (
        <ApplyToReturnModal
          transactions={categorizationResult.transactions}
          onConfirm={handleConfirmApply}
          onCancel={() => setShowApplyModal(false)}
        />
      )}
    </ToolViewWrapper>
  );
}
