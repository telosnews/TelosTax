/**
 * useDocumentImport — shared OCR state machine hook.
 *
 * Extracted from PDFImportPanel so both PDFImportPanel and InlinePDFImport
 * can handle digital PDFs, scanned PDFs, and photos with full OCR support.
 *
 * State machine: upload → extracting → (ocr-confirm → ocr-processing →) review → importing → done
 *                                                                          ↕
 *                                                                    ai-enhancing
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTaxReturnStore } from '../store/taxReturnStore';
import { useAISettingsStore } from '../store/aiSettingsStore';
import { addIncomeItem } from '../api/client';
import {
  extractFromPDF,
  extractFromPDFWithOCR,
  extractFromImage,
  INCOME_DISCOVERY_KEYS,
  type PDFExtractResult,
  type SupportedFormType,
} from '../services/pdfImporter';
import {
  extractFieldsWithAI,
  crossValidate,
  type CrossValidatedField,
} from '../services/aiExtractionService';
import type { OCRStage } from '../services/ocrService';
import { checkForDuplicates, type DuplicateCheckResult } from '../services/duplicateDetection';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────

export type DocumentImportState =
  | 'upload'
  | 'extracting'
  | 'ocr-confirm'
  | 'ocr-processing'
  | 'review'
  | 'ai-enhancing'
  | 'importing'
  | 'done';

export interface UseDocumentImportOptions {
  expectedFormType?: SupportedFormType;
}

export interface UseDocumentImportReturn {
  state: DocumentImportState;
  result: PDFExtractResult | null;
  editData: Record<string, unknown>;
  ocrStage: OCRStage;
  ocrProgress: number;
  pendingFile: File | null;
  importedFormType: string;
  duplicateCheck: DuplicateCheckResult | null;
  // AI enhancement
  crossValidatedFields: CrossValidatedField[] | null;
  aiEnhanced: boolean;
  aiError: string | null;
  aiEligible: boolean;
  handleFile: (file: File) => Promise<void>;
  handleRunOCR: () => Promise<void>;
  handleFieldChange: (key: string, value: unknown) => void;
  handleImport: () => boolean;
  handleEnhanceWithAI: () => Promise<void>;
  reset: () => void;
}

// ─── Custom Import Handlers (Category B forms) ─────

type CustomImportHandler = (
  taxReturn: import('@telostax/engine').TaxReturn,
  editData: Record<string, unknown>,
  updateField: (field: string, value: unknown) => void,
) => void;

const CUSTOM_IMPORT_HANDLERS: Record<string, CustomImportHandler> = {
  ssa1099: (tr, data, uf) => {
    const existing = tr.incomeSSA1099 || {};
    const id = (existing as Record<string, unknown>).id as string || crypto.randomUUID?.() || `ssa-${Date.now()}`;
    uf('incomeSSA1099', { ...existing, id, ...data });
  },
  '1098': (tr, data, uf) => {
    const existing = tr.itemizedDeductions || {} as Record<string, unknown>;
    uf('itemizedDeductions', {
      ...existing,
      mortgageInterest: (data.mortgageInterest as number) || (existing as any).mortgageInterest || 0,
      mortgageInsurancePremiums: (data.mortgageInsurance as number) || (existing as any).mortgageInsurancePremiums || 0,
      mortgageBalance: (data.outstandingPrincipal as number) || (existing as any).mortgageBalance,
    });
  },
  '1098e': (_tr, data, uf) => {
    uf('studentLoanInterest', (data.interestPaid as number) || 0);
  },
  '1095a': (tr, data, uf) => {
    const existing = tr.premiumTaxCredit || { forms1095A: [], familySize: 1 };
    const annualPremium = (data.annualEnrollmentPremium as number) || 0;
    const annualSLCSP = (data.annualSLCSP as number) || 0;
    const annualAdvance = (data.annualAdvancePTC as number) || 0;
    // Distribute annual totals evenly across 12 months
    const monthly = (annual: number) => Array.from({ length: 12 }, () => Math.round((annual / 12) * 100) / 100);
    const newForm = {
      id: crypto.randomUUID?.() || `1095a-${Date.now()}`,
      marketplace: (data.marketplaceName as string) || '',
      enrollmentPremiums: monthly(annualPremium),
      slcspPremiums: monthly(annualSLCSP),
      advancePTC: monthly(annualAdvance),
      coverageMonths: Array.from({ length: 12 }, () => true),
    };
    uf('premiumTaxCredit', {
      ...existing,
      forms1095A: [...(existing.forms1095A || []), newForm],
    });
  },
  '1099s': (tr, data, uf) => {
    const existing = tr.homeSale || {} as Record<string, unknown>;
    uf('homeSale', {
      ...existing,
      salePrice: (data.grossProceeds as number) || (existing as any).salePrice || 0,
    });
  },
};

// ─── Helpers ───────────────────────────────────────

/** Check if a file is an image (not PDF) */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpg|jpeg|png|tiff?|heic|heif)$/i.test(file.name);
}

// ─── Hook ──────────────────────────────────────────

export function useDocumentImport(
  options: UseDocumentImportOptions = {},
): UseDocumentImportReturn {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  const [state, setState] = useState<DocumentImportState>('upload');
  const [result, setResult] = useState<PDFExtractResult | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [importedFormType, setImportedFormType] = useState('');
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckResult | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [ocrStage, setOcrStage] = useState<OCRStage>('loading');
  const [ocrProgress, setOcrProgress] = useState(0);

  // AI enhancement state
  const [crossValidatedFields, setCrossValidatedFields] = useState<CrossValidatedField[] | null>(null);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // AI eligibility — BYOK with an API key implies consent (user explicitly chose cloud AI)
  const aiSettings = useAISettingsStore();
  const aiEligible = useMemo(() => !!(
    result?.ocrUsed &&
    result?.rawOCRText &&
    aiSettings.mode === 'byok' &&
    aiSettings._decryptedApiKey &&
    !aiEnhanced
  ), [result, aiSettings.mode, aiSettings._decryptedApiKey, aiEnhanced]);

  // Cleanup OCR worker on unmount
  useEffect(() => {
    return () => {
      import('../services/ocrService').then(m => m.terminateWorker()).catch(() => {});
    };
  }, []);

  const handleFile = useCallback(async (file: File) => {
    // Image files always go through OCR
    if (isImageFile(file)) {
      setPendingFile(file);
      setState('ocr-confirm');
      return;
    }

    // PDF files — try digital extraction first
    setState('extracting');
    try {
      const extracted = await extractFromPDF(file);

      // If the PDF is scanned/image-based, offer OCR
      if (extracted.ocrAvailable) {
        setPendingFile(file);
        setState('ocr-confirm');
        return;
      }

      setResult(extracted);

      if (extracted.errors.length > 0) {
        for (const err of extracted.errors) {
          toast.error(err);
        }
        setState('upload');
        return;
      }

      setEditData({ ...extracted.extractedData });

      // Notify about additional forms detected in consolidated PDFs
      const extras = extracted.additionalResults || [];
      const extrasWithValues = extras.filter(r =>
        Object.values(r.extractedData).some(v => typeof v === 'number' && v > 0),
      );
      if (extrasWithValues.length > 0) {
        const formList = extrasWithValues.map(r => r.formType).join(', ');
        toast.success(`Also found ${extrasWithValues.length} additional form${extrasWithValues.length > 1 ? 's' : ''} (${formList}) — they will be imported automatically when you confirm.`);
      }

      // Check for duplicates
      if (taxReturn && extracted.incomeType) {
        setDuplicateCheck(checkForDuplicates(taxReturn, extracted.incomeType, extracted.extractedData));
      } else {
        setDuplicateCheck(null);
      }

      setState('review');
    } catch (err) {
      toast.error('Failed to analyze PDF');
      console.error('PDF extraction error:', err);
      setState('upload');
    }
  }, [taxReturn]);

  const handleRunOCR = useCallback(async () => {
    if (!pendingFile) return;
    setState('ocr-processing');
    setOcrStage('loading');
    setOcrProgress(0);

    const onProgress = (stage: OCRStage, pct: number) => {
      setOcrStage(stage);
      setOcrProgress(pct);
    };

    try {
      const extracted = isImageFile(pendingFile)
        ? await extractFromImage(pendingFile, onProgress)
        : await extractFromPDFWithOCR(pendingFile, onProgress);

      setResult(extracted);

      if (extracted.errors.length > 0) {
        for (const err of extracted.errors) {
          toast.error(err);
        }
        setState('upload');
        setPendingFile(null);
        return;
      }

      setEditData({ ...extracted.extractedData });

      // Check for duplicates
      if (taxReturn && extracted.incomeType) {
        setDuplicateCheck(checkForDuplicates(taxReturn, extracted.incomeType, extracted.extractedData));
      } else {
        setDuplicateCheck(null);
      }

      setState('review');
    } catch (err) {
      toast.error('OCR processing failed');
      console.error('OCR error:', err);
      setState('upload');
      setPendingFile(null);
    }
  }, [pendingFile, taxReturn]);

  const handleEnhanceWithAI = useCallback(async () => {
    if (!result?.rawOCRText || !result.formType) return;

    // Guard: must be BYOK with API key (providing a key implies consent)
    const settings = useAISettingsStore.getState();
    if (settings.mode !== 'byok' || !settings._decryptedApiKey) {
      setAiError('AI enhancement requires BYOK mode with an API key configured.');
      return;
    }

    setState('ai-enhancing');
    setAiError(null);

    try {
      const aiResult = await extractFieldsWithAI(
        result.rawOCRText,
        result.formType,
        {
          provider: settings.byokProvider,
          apiKey: settings._decryptedApiKey,
          model: settings.byokModel,
        },
      );

      // Cross-validate local OCR vs. AI results
      const validated = crossValidate(
        result.extractedData,
        aiResult,
        result.formType as SupportedFormType,
      );

      // Update editData with AI-preferred values (where confidence ≥ medium)
      const updatedData = { ...editData };
      for (const field of validated) {
        if (field.confidence !== 'low' || field.source === 'both_agree') {
          updatedData[field.key] = field.finalValue;
        }
      }
      setEditData(updatedData);

      setCrossValidatedFields(validated);
      setAiEnhanced(true);
      setState('review');
    } catch (err: any) {
      const msg = err.message || 'Unknown error';
      console.error('AI enhancement error:', err);
      setAiError(msg);
      setState('review'); // Preserve local OCR results
    }
  }, [result, editData]);

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    setEditData(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleImport = useCallback((): boolean => {
    if (!result || !returnId || !taxReturn || !result.incomeType) return false;
    setState('importing');

    try {
      const customHandler = CUSTOM_IMPORT_HANDLERS[result.incomeType];
      if (result.incomeType === '1098t') {
        // 1098-T maps to education-credits array with field transformation
        const mapped = {
          institution: (editData.institutionName as string) || '',
          tuitionPaid: (editData.tuitionPayments as number) || 0,
          scholarships: (editData.scholarships as number) || 0,
          received1098T: true,
          type: 'american_opportunity',
          studentName: '',
        };
        addIncomeItem(returnId, 'education-credits', mapped);
      } else if (customHandler) {
        customHandler(taxReturn, editData, updateField);
      } else {
        addIncomeItem(returnId, result.incomeType, editData);
      }

      // Auto-set income discovery
      const discoveryKey = INCOME_DISCOVERY_KEYS[result.incomeType];
      if (discoveryKey) {
        const discovery = { ...taxReturn.incomeDiscovery, [discoveryKey]: 'yes' };
        updateField('incomeDiscovery', discovery);
      }

      // Auto-import additional forms from consolidated multi-form PDFs
      const extras = result.additionalResults || [];
      let extraCount = 0;
      for (const extra of extras) {
        if (!extra.incomeType) continue;
        const hasValues = Object.values(extra.extractedData).some(v => typeof v === 'number' && v > 0);
        if (!hasValues) continue;
        try {
          addIncomeItem(returnId, extra.incomeType, extra.extractedData);
          const dk = INCOME_DISCOVERY_KEYS[extra.incomeType];
          if (dk) {
            const disc = { ...taxReturn.incomeDiscovery, [dk]: 'yes' };
            updateField('incomeDiscovery', disc);
          }
          extraCount++;
        } catch {
          // Non-fatal — primary import already succeeded
        }
      }

      setImportedFormType(result.formType || '');
      setState('done');
      if (extraCount > 0) {
        toast.success(`${result.formType} + ${extraCount} additional form${extraCount > 1 ? 's' : ''} imported from consolidated PDF`);
      } else {
        toast.success(`${result.formType} imported successfully`);
      }
      return true;
    } catch (err) {
      toast.error('Import failed');
      console.error('Import error:', err);
      setState('review');
      return false;
    }
  }, [result, returnId, taxReturn, editData, updateField]);

  const reset = useCallback(() => {
    setResult(null);
    setEditData({});
    setDuplicateCheck(null);
    setPendingFile(null);
    setImportedFormType('');
    setCrossValidatedFields(null);
    setAiEnhanced(false);
    setAiError(null);
    setState('upload');
  }, []);

  return {
    state,
    result,
    editData,
    ocrStage,
    ocrProgress,
    pendingFile,
    importedFormType,
    duplicateCheck,
    crossValidatedFields,
    aiEnhanced,
    aiError,
    aiEligible,
    handleFile,
    handleRunOCR,
    handleFieldChange,
    handleImport,
    handleEnhanceWithAI,
    reset,
  };
}
