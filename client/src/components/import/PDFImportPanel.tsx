import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle, Copy, Camera, Sparkles } from 'lucide-react';
import {
  FORM_TYPE_LABELS,
  type SupportedFormType,
} from '../../services/pdfImporter';
import { MAX_PDF_SIZE } from '../../services/importHelpers';
import FileDropZone from './FileDropZone';
import OCRProgressBar from './OCRProgressBar';
import ImportTraceSection from './ImportTraceSection';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import { useDocumentImport, isImageFile } from '../../hooks/useDocumentImport';

interface PDFImportPanelProps {
  onBack: () => void;
}

// Field definitions for the editable preview
interface PreviewField {
  key: string;
  label: string;
  type: 'text' | 'currency';
  forForms: SupportedFormType[];
}

const PREVIEW_FIELDS: PreviewField[] = [
  // W-2 fields
  { key: 'employerName', label: 'Employer Name', type: 'text', forForms: ['W-2'] },
  { key: 'wages', label: 'Wages (Box 1)', type: 'currency', forForms: ['W-2'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 2)', type: 'currency', forForms: ['W-2'] },
  { key: 'socialSecurityWages', label: 'Social Security Wages (Box 3)', type: 'currency', forForms: ['W-2'] },
  { key: 'socialSecurityTax', label: 'Social Security Tax (Box 4)', type: 'currency', forForms: ['W-2'] },
  { key: 'medicareWages', label: 'Medicare Wages (Box 5)', type: 'currency', forForms: ['W-2'] },
  { key: 'medicareTax', label: 'Medicare Tax (Box 6)', type: 'currency', forForms: ['W-2'] },
  { key: 'state', label: 'State (Box 15)', type: 'text', forForms: ['W-2'] },
  { key: 'stateWages', label: 'State Wages (Box 16)', type: 'currency', forForms: ['W-2'] },
  { key: 'stateTaxWithheld', label: 'State Tax Withheld (Box 17)', type: 'currency', forForms: ['W-2'] },
  // 1099 common fields
  { key: 'payerName', label: 'Payer Name', type: 'text', forForms: ['1099-INT', '1099-DIV', '1099-R', '1099-NEC', '1099-MISC', '1099-G'] },
  // 1099-INT
  { key: 'amount', label: 'Interest Income (Box 1)', type: 'currency', forForms: ['1099-INT'] },
  { key: 'earlyWithdrawalPenalty', label: 'Early Withdrawal Penalty (Box 2)', type: 'currency', forForms: ['1099-INT'] },
  { key: 'taxExemptInterest', label: 'Tax-Exempt Interest (Box 8)', type: 'currency', forForms: ['1099-INT'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 4)', type: 'currency', forForms: ['1099-INT'] },
  // 1099-DIV
  { key: 'ordinaryDividends', label: 'Ordinary Dividends (Box 1a)', type: 'currency', forForms: ['1099-DIV'] },
  { key: 'qualifiedDividends', label: 'Qualified Dividends (Box 1b)', type: 'currency', forForms: ['1099-DIV'] },
  { key: 'capitalGainDistributions', label: 'Capital Gain Distributions (Box 2a)', type: 'currency', forForms: ['1099-DIV'] },
  { key: 'foreignTaxPaid', label: 'Foreign Tax Paid (Box 7)', type: 'currency', forForms: ['1099-DIV'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 4)', type: 'currency', forForms: ['1099-DIV'] },
  // 1099-R
  { key: 'grossDistribution', label: 'Gross Distribution (Box 1)', type: 'currency', forForms: ['1099-R'] },
  { key: 'taxableAmount', label: 'Taxable Amount (Box 2a)', type: 'currency', forForms: ['1099-R'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 4)', type: 'currency', forForms: ['1099-R'] },
  { key: 'distributionCode', label: 'Distribution Code (Box 7)', type: 'text', forForms: ['1099-R'] },
  // 1099-NEC
  { key: 'amount', label: 'Nonemployee Compensation (Box 1)', type: 'currency', forForms: ['1099-NEC'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 4)', type: 'currency', forForms: ['1099-NEC'] },
  // 1099-MISC
  { key: 'otherIncome', label: 'Other Income (Box 3)', type: 'currency', forForms: ['1099-MISC'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 4)', type: 'currency', forForms: ['1099-MISC'] },
  // 1099-G
  { key: 'unemploymentCompensation', label: 'Unemployment Compensation (Box 1)', type: 'currency', forForms: ['1099-G'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 4)', type: 'currency', forForms: ['1099-G'] },
  // 1099-B
  { key: 'brokerName', label: 'Broker Name', type: 'text', forForms: ['1099-B'] },
  { key: 'proceeds', label: 'Total Proceeds', type: 'currency', forForms: ['1099-B'] },
  { key: 'costBasis', label: 'Total Cost Basis', type: 'currency', forForms: ['1099-B'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 4)', type: 'currency', forForms: ['1099-B'] },
  // 1099-K
  { key: 'platformName', label: 'Platform / Filer Name', type: 'text', forForms: ['1099-K'] },
  { key: 'grossAmount', label: 'Gross Amount (Box 1a)', type: 'currency', forForms: ['1099-K'] },
  { key: 'cardNotPresent', label: 'Card Not Present (Box 1b)', type: 'currency', forForms: ['1099-K'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 4)', type: 'currency', forForms: ['1099-K'] },
  // SSA-1099
  { key: 'totalBenefits', label: 'Net Benefits (Box 5)', type: 'currency', forForms: ['SSA-1099'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld (Box 6)', type: 'currency', forForms: ['SSA-1099'] },
  // 1099-SA
  { key: 'payerName', label: 'Trustee / Payer Name', type: 'text', forForms: ['1099-SA', '1099-Q'] },
  { key: 'grossDistribution', label: 'Gross Distribution (Box 1)', type: 'currency', forForms: ['1099-SA', '1099-Q'] },
  { key: 'distributionCode', label: 'Distribution Code (Box 3)', type: 'text', forForms: ['1099-SA'] },
  { key: 'federalTaxWithheld', label: 'Federal Tax Withheld', type: 'currency', forForms: ['1099-SA'] },
  // 1099-Q
  { key: 'earnings', label: 'Earnings (Box 2)', type: 'currency', forForms: ['1099-Q'] },
  { key: 'basisReturn', label: 'Basis (Box 3)', type: 'currency', forForms: ['1099-Q'] },
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

export default function PDFImportPanel({ onBack }: PDFImportPanelProps) {
  const {
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
  } = useDocumentImport();

  // Get visible fields for the current form type
  const visibleFields = result?.formType
    ? PREVIEW_FIELDS.filter(f => f.forForms.includes(result.formType!))
    : [];

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

      {/* ─── State: UPLOAD ─────────────────────────────── */}
      {state === 'upload' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Import Tax Form</h3>
          <p className="text-sm text-slate-400">
            Upload a tax form PDF or photo. Supports 20 form types.
          </p>

          <div className="rounded-xl border bg-amber-500/10 border-amber-500/20 text-sm text-amber-300 p-3">
            <strong>Note:</strong> Digital PDFs are extracted instantly. Scanned documents and photos
            can be processed with OCR, then enhanced with AI for improved accuracy.
            Always verify extracted data against your original form.
          </div>

          <FileDropZone
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.heic,.heif"
            onFile={handleFile}
            label="Drop your tax form here"
            sublabel="W-2, 1099-INT, 1099-DIV, 1099-R, 1099-NEC, 1099-MISC, 1099-G, 1099-B, 1099-K, SSA-1099, 1099-SA, 1099-Q, 1098, 1098-T, 1098-E, 1095-A, K-1, W-2G, 1099-C, 1099-S"
            maxSizeMB={MAX_PDF_SIZE / (1024 * 1024)}
            enableCamera
          />
        </div>
      )}

      {/* ─── State: EXTRACTING ─────────────────────────── */}
      {state === 'extracting' && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-telos-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-300">Analyzing your PDF...</p>
          <p className="text-xs text-slate-400 mt-1">Extracting text and identifying form fields</p>
        </div>
      )}

      {/* ─── State: OCR CONFIRM ────────────────────────── */}
      {state === 'ocr-confirm' && pendingFile && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-amber-500/10 border-amber-500/30 p-5">
            <div className="flex items-start gap-3">
              <Camera className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-amber-300 mb-2">
                  {isImageFile(pendingFile)
                    ? 'Photo Detected'
                    : 'Scanned Document Detected'}
                </h3>
                <p className="text-sm text-amber-300/90 mb-3">
                  {isImageFile(pendingFile)
                    ? 'This appears to be a photo of a tax form.'
                    : 'This PDF appears to be a scanned document or image-based PDF without selectable text.'}
                </p>
                <p className="text-sm text-slate-300 mb-4">
                  We can attempt to read it using OCR (Optical Character Recognition), but accuracy on
                  tax forms is typically 60-70%, but can be enhanced with AI for better results. You&apos;ll need to carefully verify every extracted value.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleRunOCR}
                    className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
                  >
                    Try OCR
                  </button>
                  <button
                    onClick={reset}
                    className="px-4 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── State: OCR PROCESSING ─────────────────────── */}
      {state === 'ocr-processing' && (
        <div className="py-8 space-y-6">
          <div className="text-center">
            <Camera className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200 mb-1">OCR Processing</h3>
            <p className="text-xs text-slate-400 mb-4">
              Reading text from your {pendingFile && isImageFile(pendingFile) ? 'photo' : 'scanned document'}
            </p>
          </div>
          <div className="max-w-md mx-auto">
            <OCRProgressBar
              stage={ocrStage}
              progress={ocrProgress}
            />
          </div>
        </div>
      )}

      {/* ─── State: AI ENHANCING ───────────────────────── */}
      {state === 'ai-enhancing' && (
        <div className="text-center py-8">
          <Sparkles className="w-8 h-8 text-telos-blue-400 animate-pulse mx-auto mb-3" />
          <p className="text-sm text-slate-300">AI is reading your document...</p>
          <p className="text-xs text-slate-400 mt-1">PII has been stripped. Only sanitized text is sent.</p>
        </div>
      )}

      {/* ─── State: REVIEW ─────────────────────────────── */}
      {state === 'review' && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-200">Review Extracted Data</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              result.confidence === 'high'
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : result.confidence === 'medium'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {result.confidence} confidence
            </span>
          </div>

          {/* OCR warning banner (hidden when AI-enhanced) */}
          {result.ocrUsed && !aiEnhanced && (
            <div className="rounded-xl border bg-amber-500/15 border-amber-500/30 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300">
                    OCR-extracted data — verify every value below
                  </p>
                  <p className="text-xs text-amber-300/70 mt-0.5">
                    This data was read using Optical Character Recognition from a scanned document.
                    Accuracy is limited. Please carefully compare every value against your original form.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI-enhanced success banner */}
          {aiEnhanced && (
            <div className="rounded-xl border bg-telos-blue-500/10 border-telos-blue-500/30 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-telos-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-telos-blue-300">AI-enhanced extraction</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Values cross-validated against OCR. Green = high confidence, yellow = verify, red = needs attention.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Enhance with AI button */}
          {aiEligible && (
            <div className="rounded-xl border bg-telos-blue-500/10 border-telos-blue-500/30 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-telos-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-telos-blue-300 mb-1">Enhance with AI</h4>
                  <p className="text-xs text-slate-300 mb-3">
                    Send the extracted text to your AI provider for improved accuracy.
                    PII (SSN, addresses, etc.) is automatically stripped before sending.
                  </p>
                  <button
                    onClick={handleEnhanceWithAI}
                    className="px-4 py-2 text-sm font-medium bg-telos-blue-600 hover:bg-telos-blue-500 text-white rounded-lg transition-colors"
                  >
                    Enhance Extraction
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI error notice */}
          {aiError && (
            <div className="rounded-lg border bg-red-500/10 border-red-500/20 p-3 text-xs text-red-300">
              <p className="font-medium">AI enhancement failed: {aiError}</p>
              <p className="text-red-300/70 mt-0.5">You can still use the OCR-extracted values below.</p>
            </div>
          )}

          {/* Detected form type */}
          <div className="card bg-surface-800 border-slate-700 p-3">
            <p className="text-sm text-slate-400">Detected form:</p>
            <p className="text-lg font-semibold text-telos-blue-400">
              {result.formType ? FORM_TYPE_LABELS[result.formType] : 'Unknown'}
            </p>
            {result.payerName && (
              <p className="text-sm text-slate-400 mt-1">
                From: <span className="text-slate-300">{result.payerName}</span>
              </p>
            )}
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="rounded-xl border bg-amber-500/10 border-amber-500/20 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-300">
                  {result.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Duplicate warning */}
          {duplicateCheck?.hasDuplicates && (
            <div className="rounded-xl border bg-amber-500/10 border-amber-500/30 p-4">
              <div className="flex items-start gap-2.5">
                <Copy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300 mb-1">
                    Possible duplicate detected
                  </p>
                  <p className="text-xs text-amber-300/80 mb-2">
                    {result?.incomeType === 'ssa1099'
                      ? 'You already have SSA-1099 data entered. Importing will merge with your existing values.'
                      : 'This looks like something you\u2019ve already entered. Importing it again would double-count this income.'}
                  </p>
                  <ul className="space-y-1">
                    {duplicateCheck.matches.map((match) => (
                      <li key={match.existingId} className="text-xs text-slate-300 flex items-center gap-1.5">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                          match.confidence === 'exact' ? 'bg-red-400' : 'bg-amber-400'
                        }`} />
                        <span>{match.existingLabel}</span>
                        <span className="text-slate-400">
                          ({match.confidence === 'exact' ? 'exact match' : 'similar name'})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Import trace */}
          {result.trace && <ImportTraceSection trace={result.trace} />}

          {/* Editable field preview */}
          <div className="card bg-surface-800 border-slate-700 p-4">
            <p className="text-xs text-slate-400 mb-3">
              Review and correct the values below. Edits you make here will be saved when you import.
            </p>
            <div className="space-y-1">
              {visibleFields.map((field) => (
                <div key={field.key}>
                  <FormField label={field.label} optional>
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
                  {/* Per-field confidence indicator (AI-enhanced only) */}
                  {crossValidatedFields && (() => {
                    const cv = crossValidatedFields.find(f => f.key === field.key);
                    if (!cv) return null;
                    return (
                      <div className="flex items-center gap-1.5 mt-1 mb-2">
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                          cv.confidence === 'high' ? 'bg-green-400' :
                          cv.confidence === 'medium' ? 'bg-amber-400' : 'bg-red-400'
                        }`} />
                        <span className="text-[10px] text-slate-500">{cv.reasoning}</span>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="px-4 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Try Another File
            </button>
            <button
              onClick={handleImport}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                duplicateCheck?.hasDuplicates
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-telos-orange-500 hover:bg-telos-orange-400 text-white'
              }`}
            >
              {duplicateCheck?.hasDuplicates ? 'Import Anyway' : 'Add to My Return'}
            </button>
          </div>
        </div>
      )}

      {/* ─── State: IMPORTING ──────────────────────────── */}
      {state === 'importing' && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-telos-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-300">Adding to your return...</p>
        </div>
      )}

      {/* ─── State: DONE ──────────────────────────────── */}
      {state === 'done' && (
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-200 mb-1">Import Complete</h3>
          <p className="text-sm text-slate-400 mb-6">
            {importedFormType} added to your return successfully.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={reset}
              className="px-4 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-slate-300 rounded-lg transition-colors border border-slate-600"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
