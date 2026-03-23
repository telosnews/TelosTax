/**
 * InlinePDFImport — an inline import panel pre-filtered to a single form type.
 *
 * Embeds directly within a form step (e.g. W2IncomeStep). After a successful
 * import, the newly added item appears in the step's list immediately.
 *
 * Supports digital PDFs, scanned PDFs (via OCR), and photos (via camera capture).
 *
 * State machine: upload → extracting → (ocr-confirm → ocr-processing →) review → importing → done
 */

import { X, CheckCircle2, Loader2, AlertTriangle, Camera } from 'lucide-react';
import {
  SupportedFormType,
  FORM_TYPE_LABELS,
} from '../../services/pdfImporter';
import { MAX_PDF_SIZE } from '../../services/importHelpers';
import FileDropZone from './FileDropZone';
import OCRProgressBar from './OCRProgressBar';
import ImportTraceSection from './ImportTraceSection';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import { useDocumentImport, isImageFile } from '../../hooks/useDocumentImport';

interface PreviewField {
  key: string;
  label: string;
  type: 'text' | 'currency';
  forForms: SupportedFormType[];
}

const PREVIEW_FIELDS: PreviewField[] = [
  // W-2
  { key: 'employerName', label: 'Employer Name', type: 'text', forForms: ['W-2'] },
  { key: 'wages', label: 'Wages (Box 1)', type: 'currency', forForms: ['W-2'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 2)', type: 'currency', forForms: ['W-2', '1099-INT', '1099-DIV', '1099-R', '1099-MISC', '1099-G'] },
  { key: 'socialSecurityWages', label: 'Social Security Wages (Box 3)', type: 'currency', forForms: ['W-2'] },
  { key: 'socialSecurityTax', label: 'Social Security Tax (Box 4)', type: 'currency', forForms: ['W-2'] },
  { key: 'medicareWages', label: 'Medicare Wages (Box 5)', type: 'currency', forForms: ['W-2'] },
  { key: 'medicareTax', label: 'Medicare Tax (Box 6)', type: 'currency', forForms: ['W-2'] },
  { key: 'state', label: 'State (Box 15)', type: 'text', forForms: ['W-2'] },
  { key: 'stateWages', label: 'State Wages (Box 16)', type: 'currency', forForms: ['W-2'] },
  { key: 'stateTaxWithheld', label: 'State Tax Withheld (Box 17)', type: 'currency', forForms: ['W-2'] },
  // 1099 common
  { key: 'payerName', label: 'Payer Name', type: 'text', forForms: ['1099-INT', '1099-DIV', '1099-R', '1099-NEC', '1099-MISC', '1099-G'] },
  // 1099-INT
  { key: 'amount', label: 'Interest Income (Box 1)', type: 'currency', forForms: ['1099-INT'] },
  { key: 'earlyWithdrawalPenalty', label: 'Early Withdrawal Penalty (Box 2)', type: 'currency', forForms: ['1099-INT'] },
  { key: 'taxExemptInterest', label: 'Tax-Exempt Interest (Box 8)', type: 'currency', forForms: ['1099-INT'] },
  // 1099-DIV
  { key: 'ordinaryDividends', label: 'Ordinary Dividends (Box 1a)', type: 'currency', forForms: ['1099-DIV'] },
  { key: 'qualifiedDividends', label: 'Qualified Dividends (Box 1b)', type: 'currency', forForms: ['1099-DIV'] },
  { key: 'capitalGainDistributions', label: 'Capital Gain Distributions (Box 2a)', type: 'currency', forForms: ['1099-DIV'] },
  { key: 'foreignTaxPaid', label: 'Foreign Tax Paid (Box 7)', type: 'currency', forForms: ['1099-DIV'] },
  // 1099-R
  { key: 'grossDistribution', label: 'Gross Distribution (Box 1)', type: 'currency', forForms: ['1099-R'] },
  { key: 'taxableAmount', label: 'Taxable Amount (Box 2a)', type: 'currency', forForms: ['1099-R'] },
  // 1099-NEC
  { key: 'amount', label: 'Nonemployee Compensation (Box 1)', type: 'currency', forForms: ['1099-NEC'] },
  // 1099-MISC
  { key: 'otherIncome', label: 'Other Income (Box 3)', type: 'currency', forForms: ['1099-MISC'] },
  // 1099-G
  { key: 'unemploymentCompensation', label: 'Unemployment Compensation (Box 1)', type: 'currency', forForms: ['1099-G'] },
  // 1098
  { key: 'lenderName', label: 'Lender Name', type: 'text', forForms: ['1098', '1098-E'] },
  { key: 'mortgageInterest', label: 'Mortgage Interest (Box 1)', type: 'currency', forForms: ['1098'] },
  { key: 'outstandingPrincipal', label: 'Outstanding Principal (Box 2)', type: 'currency', forForms: ['1098'] },
  { key: 'mortgageInsurance', label: 'Mortgage Insurance (Box 5)', type: 'currency', forForms: ['1098'] },
  // 1098-T
  { key: 'institutionName', label: 'Institution Name', type: 'text', forForms: ['1098-T'] },
  { key: 'tuitionPayments', label: 'Tuition Payments (Box 1)', type: 'currency', forForms: ['1098-T'] },
  { key: 'scholarships', label: 'Scholarships (Box 5)', type: 'currency', forForms: ['1098-T'] },
  // 1098-E
  { key: 'interestPaid', label: 'Student Loan Interest (Box 1)', type: 'currency', forForms: ['1098-E'] },
  // 1095-A
  { key: 'marketplaceName', label: 'Marketplace Name', type: 'text', forForms: ['1095-A'] },
  { key: 'annualEnrollmentPremium', label: 'Annual Enrollment Premium', type: 'currency', forForms: ['1095-A'] },
  { key: 'annualSLCSP', label: 'Annual SLCSP Premium', type: 'currency', forForms: ['1095-A'] },
  { key: 'annualAdvancePTC', label: 'Annual Advance PTC', type: 'currency', forForms: ['1095-A'] },
  // K-1
  { key: 'entityName', label: 'Entity Name', type: 'text', forForms: ['K-1'] },
  { key: 'ordinaryBusinessIncome', label: 'Ordinary Business Income (Box 1)', type: 'currency', forForms: ['K-1'] },
  { key: 'rentalIncome', label: 'Rental Income (Box 2)', type: 'currency', forForms: ['K-1'] },
  { key: 'guaranteedPayments', label: 'Guaranteed Payments (Box 4)', type: 'currency', forForms: ['K-1'] },
  { key: 'interestIncome', label: 'Interest Income (Box 5)', type: 'currency', forForms: ['K-1'] },
  { key: 'ordinaryDividends', label: 'Ordinary Dividends (Box 6a)', type: 'currency', forForms: ['K-1'] },
  { key: 'royalties', label: 'Royalties (Box 7)', type: 'currency', forForms: ['K-1'] },
  { key: 'shortTermCapitalGain', label: 'Short-Term Capital Gain (Box 8)', type: 'currency', forForms: ['K-1'] },
  { key: 'longTermCapitalGain', label: 'Long-Term Capital Gain (Box 9a)', type: 'currency', forForms: ['K-1'] },
  { key: 'selfEmploymentIncome', label: 'Self-Employment Income (Box 14A)', type: 'currency', forForms: ['K-1'] },
  // W-2G
  { key: 'payerName', label: 'Payer Name', type: 'text', forForms: ['W-2G'] },
  { key: 'grossWinnings', label: 'Gross Winnings (Box 1)', type: 'currency', forForms: ['W-2G'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 4)', type: 'currency', forForms: ['W-2G'] },
  { key: 'typeOfWager', label: 'Type of Wager (Box 3)', type: 'text', forForms: ['W-2G'] },
  { key: 'stateCode', label: 'State (Box 13)', type: 'text', forForms: ['W-2G'] },
  { key: 'stateTaxWithheld', label: 'State Tax Withheld (Box 15)', type: 'currency', forForms: ['W-2G'] },
  // 1099-C
  { key: 'payerName', label: 'Creditor Name', type: 'text', forForms: ['1099-C'] },
  { key: 'amountCancelled', label: 'Amount Cancelled (Box 2)', type: 'currency', forForms: ['1099-C'] },
  { key: 'interestIncluded', label: 'Interest Included (Box 3)', type: 'currency', forForms: ['1099-C'] },
  { key: 'debtDescription', label: 'Debt Description (Box 4)', type: 'text', forForms: ['1099-C'] },
  // 1099-S
  { key: 'settlementAgent', label: 'Settlement Agent', type: 'text', forForms: ['1099-S'] },
  { key: 'grossProceeds', label: 'Gross Proceeds (Box 2)', type: 'currency', forForms: ['1099-S'] },
  { key: 'closingDate', label: 'Date of Closing (Box 1)', type: 'text', forForms: ['1099-S'] },
  { key: 'buyerRealEstateTax', label: "Buyer's Real Estate Tax (Box 6)", type: 'currency', forForms: ['1099-S'] },
];

interface InlinePDFImportProps {
  /** The expected form type for this step */
  expectedFormType: SupportedFormType;
  /** Called when user closes the inline import */
  onClose: () => void;
  /** Called after a successful import so the parent step can refresh */
  onImported?: () => void;
}

export default function InlinePDFImport({ expectedFormType, onClose, onImported }: InlinePDFImportProps) {
  const {
    state,
    result,
    editData,
    ocrStage,
    ocrProgress,
    pendingFile,
    handleFile,
    handleRunOCR,
    handleFieldChange,
    handleImport: hookHandleImport,
    reset,
  } = useDocumentImport({ expectedFormType });

  // Match FileDropZone's camera detection — on desktop, camera capture isn't available
  const isTouchDevice = typeof window !== 'undefined'
    && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  const handleImport = () => {
    const success = hookHandleImport();
    if (success) onImported?.();
  };

  // Show fields for the detected form type (not necessarily the expected one)
  const visibleFields = result?.formType
    ? PREVIEW_FIELDS.filter(f => f.forForms.includes(result.formType!))
    : [];

  const formTypeMismatch = result?.formType && result.formType !== expectedFormType;

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
            Import {FORM_TYPE_LABELS[expectedFormType]} from PDF{isTouchDevice ? ' or Photo' : ''}
          </h4>
          <p className="text-xs text-slate-400">
            {isTouchDevice
              ? 'Upload a PDF or take a photo of your tax form. Digital PDFs are extracted instantly; photos use OCR.'
              : 'Upload a PDF or image of your tax form. Digital PDFs are extracted instantly; images use OCR.'}
          </p>
          <FileDropZone
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.heic,.heif"
            onFile={handleFile}
            label={`Drop your ${expectedFormType} here`}
            sublabel="PDF, JPEG, PNG, TIFF, or HEIC"
            maxSizeMB={MAX_PDF_SIZE / (1024 * 1024)}
            enableCamera
          />
        </div>
      )}

      {/* ─── EXTRACTING ─────────────────────────── */}
      {state === 'extracting' && (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 text-telos-blue-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-300">Analyzing your PDF...</p>
        </div>
      )}

      {/* ─── OCR CONFIRM ────────────────────────── */}
      {state === 'ocr-confirm' && pendingFile && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-amber-500/10 border-amber-500/30 p-4">
            <div className="flex items-start gap-2.5">
              <Camera className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-300 mb-1">
                  {isImageFile(pendingFile) ? 'Photo Detected' : 'Scanned Document Detected'}
                </h4>
                <p className="text-xs text-amber-300/90 mb-3">
                  {isImageFile(pendingFile)
                    ? 'This appears to be a photo of a tax form.'
                    : 'This PDF appears to be scanned without selectable text.'}
                  {' '}We&apos;ll use OCR to read it, then you can enhance with AI for better accuracy. Please verify every value.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRunOCR}
                    className="px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
                  >
                    Try OCR
                  </button>
                  <button
                    onClick={reset}
                    className="px-3 py-1.5 text-xs font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── OCR PROCESSING ─────────────────────── */}
      {state === 'ocr-processing' && (
        <div className="py-6 space-y-4">
          <div className="text-center">
            <Camera className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-xs text-slate-400">
              Reading text from your {pendingFile && isImageFile(pendingFile) ? 'photo' : 'scanned document'}
            </p>
          </div>
          <div className="max-w-sm mx-auto">
            <OCRProgressBar stage={ocrStage} progress={ocrProgress} />
          </div>
        </div>
      )}

      {/* ─── REVIEW ─────────────────────────────── */}
      {state === 'review' && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pr-8">
            <h4 className="text-sm font-semibold text-slate-200">Review Extracted Data</h4>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
              result.confidence === 'high'
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : result.confidence === 'medium'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {result.confidence} confidence
            </span>
          </div>

          {/* OCR warning */}
          {result.ocrUsed && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>OCR-extracted data — verify every value against your original form.</span>
            </div>
          )}

          {/* Form type mismatch warning */}
          {formTypeMismatch && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                This looks like a <strong>{FORM_TYPE_LABELS[result.formType!]}</strong>, but you're on the {FORM_TYPE_LABELS[expectedFormType]} page.
                You can still import it — the data will be saved under the correct form type.
              </span>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>{result.warnings.map((w, i) => <p key={i}>{w}</p>)}</div>
            </div>
          )}

          {/* Import trace */}
          {result.trace && <ImportTraceSection trace={result.trace} />}

          {/* Editable fields */}
          <div className="space-y-1">
            {visibleFields.map((field) => (
              <FormField key={field.key} label={field.label} optional>
                {field.type === 'currency' ? (
                  <CurrencyInput
                    value={(editData[field.key] as number) || undefined}
                    onChange={(val) => handleFieldChange(field.key, val)}
                  />
                ) : (
                  <input
                    className="input-field"
                    value={(editData[field.key] as string) || ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  />
                )}
              </FormField>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="px-3 py-1.5 text-xs font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Try Another
            </button>
            <button
              onClick={handleImport}
              className="px-3 py-1.5 text-xs font-medium bg-telos-orange-500 hover:bg-telos-orange-400 text-white rounded-lg transition-colors"
            >
              Add to My Return
            </button>
          </div>
        </div>
      )}

      {/* ─── IMPORTING ──────────────────────────── */}
      {state === 'importing' && (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 text-telos-blue-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-300">Adding to your return...</p>
        </div>
      )}

      {/* ─── DONE ───────────────────────────────── */}
      {state === 'done' && (
        <div className="text-center py-6">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-200 mb-1">Import Complete</p>
          <p className="text-xs text-slate-400 mb-3">
            {result?.formType} data added to your return.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={reset}
              className="px-3 py-1.5 text-xs font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Import Another
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
