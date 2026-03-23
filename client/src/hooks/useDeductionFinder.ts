/**
 * Deduction Finder Hook
 *
 * Manages the scan lifecycle: file upload → parse → scan → insights.
 * Supports multi-file accumulation with cross-file deduplication.
 *
 * Scan state (transactions, files, insights, AI results) is held in a Zustand
 * store so it survives component unmount/remount during step navigation.
 * Only dismissed/addressed IDs are persisted to the TaxReturn via updateField.
 */

import { useMemo, useCallback, useRef, useState } from 'react';
import { useTaxReturnStore } from '../store/taxReturnStore';
import { useAISettingsStore } from '../store/aiSettingsStore';
import { useDeductionFinderStore } from '../store/deductionFinderStore';
import { parseTransactionCSV, transactionHash, deduplicateTransactions } from '../services/transactionParser';
import { parsePDFStatement } from '../services/pdfStatementParser';
import { scanForSignals } from '../services/deductionFinderEngine';
import { buildReturnContext } from '../services/deductionFinderContext';
import {
  classifyMerchantsWithAI,
  sanitizeMerchant,
  generateAIInsights,
  mergeInsights,
} from '../services/merchantClassifier';
import type { MerchantClassification } from '../services/merchantClassifier';
import type {
  DeductionFinderState,
  DeductionInsight,
  NormalizedTransaction,
  UploadedFileInfo,
} from '../services/deductionFinderTypes';
import {
  deduplicateByMerchant,
  categorizeWithAI,
  fanOutCategories,
  buildCategorizationResult,
} from '../services/transactionCategorizer';
import { crossValidate } from '../services/transactionCrossValidator';
import type { CategorizationResult } from '../services/transactionCategorizerTypes';

export interface UseDeductionFinderResult {
  /** All loaded transactions (across all uploaded files) */
  allTransactions: NormalizedTransaction[];
  /** Current scan state (null if no scan has been run) */
  scanState: DeductionFinderState | null;
  /** Insights not yet addressed or dismissed */
  visibleInsights: DeductionInsight[];
  /** Addressed insights (grayed, shown at bottom) */
  addressedInsights: DeductionInsight[];
  /** Dismissed insight count */
  dismissedCount: number;
  /** Whether to show dismissed insights */
  showDismissed: boolean;
  setShowDismissed: (show: boolean) => void;
  /** Dismissed insights (only visible when showDismissed is true) */
  dismissedInsights: DeductionInsight[];
  /** Process an uploaded CSV or PDF file (additive — merges with existing) */
  processFile: (file: File) => Promise<void>;
  /** Remove a previously uploaded file and re-scan */
  removeFile: (fileName: string) => void;
  /** Mark an insight as addressed */
  addressInsight: (id: string) => void;
  /** Dismiss an insight */
  dismissInsight: (id: string) => void;
  /** Whether a file is being processed */
  isProcessing: boolean;
  /** Trigger AI classification on existing transactions (BYOK only) */
  enhanceWithAI: () => Promise<void>;
  /** Whether AI classification is in progress */
  isClassifying: boolean;
  /** AI classification progress (e.g., "125 / 500 merchants") */
  aiProgress: string | null;
  /** AI classification error message */
  aiError: string | null;
  /** Whether AI results have been loaded */
  hasAIResults: boolean;
  /** Run full AI transaction categorization (BYOK only) */
  categorizeTransactions: () => Promise<void>;
  /** Cancel an in-progress AI categorization */
  cancelCategorization: () => void;
  /** Categorization result (null if not yet run) */
  categorizationResult: CategorizationResult | null;
  /** Whether AI categorization is in progress */
  isCategorizing: boolean;
  /** Categorization progress text */
  categorizationProgress: string | null;
  /** Approve all transactions in a category */
  approveCategory: (category: string) => void;
  /** Update a single transaction's category */
  updateTransaction: (index: number, patch: Partial<import('../services/transactionCategorizerTypes').CategorizedTransaction>) => void;
}

export function useDeductionFinder(): UseDeductionFinderResult {
  const taxReturn = useTaxReturnStore((s) => s.taxReturn);
  const calculation = useTaxReturnStore((s) => s.calculation);
  const updateField = useTaxReturnStore((s) => s.updateField);

  // Zustand store — survives unmount
  const scanState = useDeductionFinderStore((s) => s.scanState);
  const setScanState = useDeductionFinderStore((s) => s.setScanState);
  const allTransactions = useDeductionFinderStore((s) => s.allTransactions);
  const setAllTransactions = useDeductionFinderStore((s) => s.setAllTransactions);
  const uploadedFiles = useDeductionFinderStore((s) => s.uploadedFiles);
  const setUploadedFiles = useDeductionFinderStore((s) => s.setUploadedFiles);
  const aiClassifications = useDeductionFinderStore((s) => s.aiClassifications);
  const setAiClassifications = useDeductionFinderStore((s) => s.setAiClassifications);
  const isProcessing = useDeductionFinderStore((s) => s.isProcessing);
  const setIsProcessing = useDeductionFinderStore((s) => s.setIsProcessing);
  const isClassifying = useDeductionFinderStore((s) => s.isClassifying);
  const setIsClassifying = useDeductionFinderStore((s) => s.setIsClassifying);
  const [aiProgress, setAiProgress] = useState<string | null>(null);
  const aiError = useDeductionFinderStore((s) => s.aiError);
  const setAiError = useDeductionFinderStore((s) => s.setAiError);

  // Local UI state (OK to reset on remount)
  const [showDismissed, setShowDismissed] = useState(false);
  const latestRequestIdRef = useRef(0);

  // Read persisted state from TaxReturn
  const addressedIds = useMemo(
    () => new Set(taxReturn?.deductionFinder?.addressedInsightIds ?? []),
    [taxReturn?.deductionFinder?.addressedInsightIds],
  );
  const dismissedIds = useMemo(
    () => new Set(taxReturn?.deductionFinder?.dismissedInsightIds ?? []),
    [taxReturn?.deductionFinder?.dismissedInsightIds],
  );

  // Filter insights into categories
  const visibleInsights = useMemo(() => {
    if (!scanState) return [];
    return scanState.insights.filter(
      (i) => !addressedIds.has(i.id) && !dismissedIds.has(i.id),
    );
  }, [scanState, addressedIds, dismissedIds]);

  const addressedInsights = useMemo(() => {
    if (!scanState) return [];
    return scanState.insights.filter((i) => addressedIds.has(i.id));
  }, [scanState, addressedIds]);

  const dismissedInsights = useMemo(() => {
    if (!scanState) return [];
    return scanState.insights.filter((i) => dismissedIds.has(i.id));
  }, [scanState, dismissedIds]);

  const dismissedCount = dismissedInsights.length;

  /** Run the scan engine on a merged transaction set and update state. */
  const runScan = useCallback((
    merged: NormalizedTransaction[],
    files: UploadedFileInfo[],
    allWarnings: string[],
    crossFileDuplicateCount: number,
  ) => {
    if (!taxReturn) return;
    const context = buildReturnContext(taxReturn, calculation);
    const insights = scanForSignals(merged, context, taxReturn.taxYear);

    setScanState({
      insights,
      fileName: files.length > 0 ? files[files.length - 1].name : '',
      uploadedFiles: files,
      detectedFormat: files.length === 1 ? files[0].format : `${files.length} files`,
      warnings: allWarnings,
      scannedAt: new Date().toISOString(),
      totalTransactionCount: merged.length,
      crossFileDuplicateCount,
    });
  }, [taxReturn, calculation, setScanState]);

  // Process uploaded file — additive (merges with existing transactions)
  const processFile = useCallback(async (file: File) => {
    if (!taxReturn) return;
    setIsProcessing(true);

    try {
      // Parse based on file extension
      const ext = file.name.split('.').pop()?.toLowerCase();
      let newTransactions: NormalizedTransaction[];
      let format: string;
      let fileWarnings: string[];

      if (ext === 'pdf') {
        const result = await parsePDFStatement(file);
        newTransactions = result.transactions;
        format = result.detectedFormat;
        fileWarnings = result.warnings;
      } else {
        const content = await file.text();
        const result = parseTransactionCSV(content);
        newTransactions = result.transactions;
        format = result.detectedFormat;
        fileWarnings = result.warnings;
      }

      // Tag each transaction with source file
      newTransactions = newTransactions.map((t) => ({ ...t, sourceFile: file.name }));

      // Read latest state directly from store (not stale closure) for sequential processing
      const currentTransactions = useDeductionFinderStore.getState().allTransactions;
      const currentFiles = useDeductionFinderStore.getState().uploadedFiles;

      // Merge with existing transactions
      const merged = [...currentTransactions, ...newTransactions];

      // Cross-file deduplication
      const { unique, duplicateCount } = deduplicateTransactions(merged);

      // Build warnings
      const warnings = [...fileWarnings];
      if (duplicateCount > 0) {
        warnings.push(`Removed ${duplicateCount} duplicate(s) across files`);
      }

      // Update file list
      const newFileInfo: UploadedFileInfo = {
        name: file.name,
        format,
        transactionCount: newTransactions.length,
        addedAt: new Date().toISOString(),
      };
      const newFiles = [...currentFiles, newFileInfo];

      // Persist state
      setAllTransactions(unique);
      setUploadedFiles(newFiles);

      // Run engine
      runScan(unique, newFiles, warnings, duplicateCount);
    } catch (err) {
      setScanState({
        insights: scanState?.insights ?? [],
        fileName: file.name,
        uploadedFiles: scanState?.uploadedFiles ?? [],
        detectedFormat: 'error',
        warnings: [`Failed to read ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`],
        scannedAt: new Date().toISOString(),
        totalTransactionCount: scanState?.totalTransactionCount ?? 0,
        crossFileDuplicateCount: scanState?.crossFileDuplicateCount ?? 0,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [taxReturn, calculation, allTransactions, uploadedFiles, runScan, scanState, setScanState, setAllTransactions, setUploadedFiles, setIsProcessing]);

  // Remove a previously uploaded file
  const removeFile = useCallback((fileName: string) => {
    const remaining = allTransactions.filter((t) => t.sourceFile !== fileName);
    const remainingFiles = uploadedFiles.filter((f) => f.name !== fileName);

    setAllTransactions(remaining);
    setUploadedFiles(remainingFiles);

    if (remainingFiles.length === 0) {
      setScanState(null);
    } else {
      runScan(remaining, remainingFiles, [], 0);
    }
  }, [allTransactions, uploadedFiles, runScan, setAllTransactions, setUploadedFiles, setScanState]);

  // Persist addressed/dismissed state
  const addressInsight = useCallback((id: string) => {
    const current = taxReturn?.deductionFinder ?? { addressedInsightIds: [], dismissedInsightIds: [] };
    if (current.addressedInsightIds.includes(id)) return;
    updateField('deductionFinder', {
      ...current,
      addressedInsightIds: [...current.addressedInsightIds, id],
    });
  }, [taxReturn?.deductionFinder, updateField]);

  const dismissInsight = useCallback((id: string) => {
    const current = taxReturn?.deductionFinder ?? { addressedInsightIds: [], dismissedInsightIds: [] };
    if (current.dismissedInsightIds.includes(id)) return;
    updateField('deductionFinder', {
      ...current,
      dismissedInsightIds: [...current.dismissedInsightIds, id],
    });
  }, [taxReturn?.deductionFinder, updateField]);

  // AI classification
  const enhanceWithAI = useCallback(async () => {
    if (!taxReturn || allTransactions.length === 0) return;

    const aiSettings = useAISettingsStore.getState();

    // Mode gate — BYOK only (providing your own key = implicit consent)
    if (aiSettings.mode === 'private') {
      setAiError('AI merchant classification requires BYOK mode.');
      return;
    }

    // Key check for BYOK
    if (aiSettings.mode === 'byok' && !aiSettings._decryptedApiKey) {
      setAiError('Please configure your API key in AI Settings first.');
      return;
    }

    setIsClassifying(true);
    setAiError(null);
    setAiProgress(null);

    try {
      // Extract unique merchant names, sanitize
      const uniqueMerchants = [...new Set(
        allTransactions.map((t) => sanitizeMerchant(t.description)),
      )].filter((m) => m.length > 0);

      if (uniqueMerchants.length === 0) {
        setAiError('No valid merchant names to classify.');
        return;
      }

      setAiProgress(`0 / ${uniqueMerchants.length} merchants`);

      const context = buildReturnContext(taxReturn, calculation);
      const options = {
        provider: aiSettings.byokProvider,
        apiKey: aiSettings._decryptedApiKey,
        model: aiSettings.byokModel,
      };

      const classifications = await classifyMerchantsWithAI(
        uniqueMerchants,
        context,
        options,
        (completed, total) => setAiProgress(`${completed} / ${total} merchants`),
      );
      console.log(`[deduction-finder] AI returned ${classifications.length} classifications`, classifications.slice(0, 3));
      setAiClassifications(classifications);

      // Generate AI insights and merge with rule insights
      const ruleInsights = scanForSignals(allTransactions, context, taxReturn.taxYear);
      const aiInsights = generateAIInsights(classifications, allTransactions, context);
      console.log(`[deduction-finder] Rule insights: ${ruleInsights.length}, AI insights: ${aiInsights.length}`);
      const merged = mergeInsights(ruleInsights, aiInsights);

      const currentScanState = useDeductionFinderStore.getState().scanState;
      setScanState(currentScanState ? { ...currentScanState, insights: merged } : null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI classification failed');
    } finally {
      setIsClassifying(false);
      setAiProgress(null);
    }
  }, [taxReturn, calculation, allTransactions, setScanState, setAiClassifications, setIsClassifying, setAiError]);

  const hasAIResults = aiClassifications !== null;

  // ── New categorizer state ──
  const categorizationResult = useDeductionFinderStore((s) => s.categorizationResult);
  const isCategorizing = useDeductionFinderStore((s) => s.isCategorizing);
  const categorizationProgress = useDeductionFinderStore((s) => s.categorizationProgress);
  const approveCategory = useDeductionFinderStore((s) => s.approveCategory);
  const updateTransaction = useDeductionFinderStore((s) => s.updateCategorizedTransaction);

  // ── Cancel support for categorization ──
  const categorizationAbortRef = useRef<AbortController | null>(null);

  const cancelCategorization = useCallback(() => {
    if (categorizationAbortRef.current) {
      categorizationAbortRef.current.abort();
      categorizationAbortRef.current = null;
    }
    const store = useDeductionFinderStore.getState();
    store.setIsCategorizing(false);
    store.setCategorizationProgress(null);
  }, []);

  // ── Full AI categorization pipeline ──
  const categorizeTransactions = useCallback(async () => {
    if (!taxReturn || allTransactions.length === 0) return;

    const aiSettings = useAISettingsStore.getState();

    if (aiSettings.mode === 'private') {
      setAiError('AI transaction categorization requires BYOK mode.');
      return;
    }
    if (aiSettings.mode === 'byok' && !aiSettings._decryptedApiKey) {
      setAiError('Please configure your API key in AI Settings first.');
      return;
    }

    // Set up abort controller
    const abortController = new AbortController();
    categorizationAbortRef.current = abortController;

    const store = useDeductionFinderStore.getState();
    store.setIsCategorizing(true);
    store.setCategorizationProgress(null);
    setAiError(null);

    try {
      // 1. Deduplicate by merchant
      const merchants = deduplicateByMerchant(allTransactions);
      store.setCategorizationProgress(`0 / ${merchants.length} merchants`);

      // 2. Build context
      const context = buildReturnContext(taxReturn, calculation);

      // 3. Send to AI
      const options = {
        provider: aiSettings.byokProvider,
        apiKey: aiSettings._decryptedApiKey,
        model: aiSettings.byokModel,
      };

      // Get enabled categories and context hints from store
      const enabledCats = store.enabledCategories as import('../services/transactionCategorizerTypes').TransactionCategory[];
      const hints = taxReturn?.expenseScanner?.contextHints || {};

      const aiCategories = await categorizeWithAI(
        merchants,
        context,
        options,
        (done, total) => store.setCategorizationProgress(`${done} / ${total} merchants`),
        enabledCats.length > 0 ? enabledCats : undefined,
        Object.keys(hints).length > 0 ? hints : undefined,
      );

      // 4. Fan out to individual transactions
      const categorized = fanOutCategories(allTransactions, merchants, aiCategories);

      // 5. Cross-validate with pattern engine (pass context hints so gates respect user answers)
      crossValidate(categorized, allTransactions, context, hints);

      // 6. Build result
      const result = buildCategorizationResult(categorized);
      store.setCategorizationResult(result);

      console.log(`[categorizer] Done: ${result.summaries.length} categories, $${result.estimatedDeductibleTotal.toLocaleString()} estimated deductible`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI categorization failed');
    } finally {
      store.setIsCategorizing(false);
      store.setCategorizationProgress(null);
    }
  }, [taxReturn, calculation, allTransactions, setAiError]);

  return {
    allTransactions,
    scanState,
    visibleInsights,
    addressedInsights,
    dismissedCount,
    showDismissed,
    setShowDismissed,
    dismissedInsights,
    processFile,
    removeFile,
    addressInsight,
    dismissInsight,
    isProcessing,
    enhanceWithAI,
    isClassifying,
    aiProgress,
    aiError,
    hasAIResults,
    categorizeTransactions,
    cancelCategorization,
    categorizationResult,
    isCategorizing,
    categorizationProgress,
    approveCategory,
    updateTransaction,
  };
}
