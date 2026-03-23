/**
 * AI Extraction Service — client-side AI enhancement for OCR-extracted documents.
 *
 * Three responsibilities:
 * A. API client — sends PII-stripped OCR text to the extraction endpoint
 * B. Cross-validation engine — compares local OCR vs. AI results per field
 * C. Form-specific validation rules — sanity checks on extracted values
 *
 * Tax advice boundary:
 *   The AI extracts field values — it NEVER provides tax advice.
 *   "Engine calculates, AI narrates, user decides."
 */

import { scanForPII } from '@telostax/engine';
import type { AIProvider } from '@telostax/engine';
import type { SupportedFormType } from './pdfExtractHelpers';
import { logOutboundRequest, buildPiiBlockSummary } from './privacyAuditLog';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

// ─── Types ──────────────────────────────────────────

export type FieldConfidence = 'high' | 'medium' | 'low';

export interface AIExtractedField {
  value: string | number | boolean;
  confidence: FieldConfidence;
}

export interface AIExtractionResult {
  formType: string;
  formTypeConfidence: FieldConfidence;
  fields: Record<string, AIExtractedField>;
}

export interface CrossValidatedField {
  key: string;
  label: string;
  localValue: unknown;
  aiValue: unknown;
  finalValue: unknown;
  confidence: FieldConfidence;
  source: 'local' | 'ai' | 'both_agree' | 'user_override';
  reasoning: string;
}

// ─── Field Labels (mirrors PREVIEW_FIELDS in PDFImportPanel) ────

const FIELD_LABELS: Record<string, string> = {
  employerName: 'Employer Name',
  wages: 'Wages (Box 1)',
  federalTaxWithheld: 'Federal Tax Withheld',
  socialSecurityWages: 'SS Wages (Box 3)',
  socialSecurityTax: 'SS Tax (Box 4)',
  medicareWages: 'Medicare Wages (Box 5)',
  medicareTax: 'Medicare Tax (Box 6)',
  state: 'State (Box 15)',
  stateWages: 'State Wages (Box 16)',
  stateTaxWithheld: 'State Tax Withheld (Box 17)',
  payerName: 'Payer Name',
  amount: 'Amount (Box 1)',
  earlyWithdrawalPenalty: 'Early Withdrawal Penalty',
  usBondInterest: 'U.S. Bond Interest',
  taxExemptInterest: 'Tax-Exempt Interest',
  ordinaryDividends: 'Ordinary Dividends (Box 1a)',
  qualifiedDividends: 'Qualified Dividends (Box 1b)',
  capitalGainDistributions: 'Capital Gains (Box 2a)',
  foreignTaxPaid: 'Foreign Tax Paid',
  grossDistribution: 'Gross Distribution (Box 1)',
  taxableAmount: 'Taxable Amount (Box 2a)',
  unemploymentCompensation: 'Unemployment (Box 1)',
  brokerName: 'Broker Name',
  proceeds: 'Proceeds',
  costBasis: 'Cost Basis',
  platformName: 'Platform Name',
  grossAmount: 'Gross Amount (Box 1a)',
  cardNotPresent: 'Card Not Present (Box 1b)',
  totalBenefits: 'Net Benefits (Box 5)',
  distributionCode: 'Distribution Code',
  earnings: 'Earnings (Box 2)',
  basisReturn: 'Basis (Box 3)',
  rents: 'Rents (Box 1)',
  royalties: 'Royalties (Box 2)',
  otherIncome: 'Other Income (Box 3)',
  // 1098
  lenderName: 'Lender Name',
  mortgageInterest: 'Mortgage Interest (Box 1)',
  outstandingPrincipal: 'Outstanding Principal (Box 2)',
  mortgageInsurance: 'Mortgage Insurance (Box 5)',
  // 1098-T
  institutionName: 'Institution Name',
  tuitionPayments: 'Tuition Payments (Box 1)',
  scholarships: 'Scholarships (Box 5)',
  // 1098-E
  interestPaid: 'Student Loan Interest (Box 1)',
  // 1095-A
  marketplaceName: 'Marketplace Name',
  annualEnrollmentPremium: 'Annual Enrollment Premium',
  annualSLCSP: 'Annual SLCSP Premium',
  annualAdvancePTC: 'Annual Advance PTC',
  // K-1
  entityName: 'Entity Name',
  ordinaryBusinessIncome: 'Ordinary Business Income (Box 1)',
  rentalIncome: 'Rental Income (Box 2)',
  guaranteedPayments: 'Guaranteed Payments (Box 4)',
  interestIncome: 'Interest Income (Box 5)',
  shortTermCapitalGain: 'Short-Term Capital Gain (Box 8)',
  longTermCapitalGain: 'Long-Term Capital Gain (Box 9a)',
  selfEmploymentIncome: 'Self-Employment Income (Box 14A)',
  // W-2G
  grossWinnings: 'Gross Winnings (Box 1)',
  typeOfWager: 'Type of Wager (Box 3)',
  stateCode: 'State (Box 13)',
  // 1099-C
  amountCancelled: 'Amount Cancelled (Box 2)',
  interestIncluded: 'Interest Included (Box 3)',
  debtDescription: 'Debt Description (Box 4)',
  identifiableEventCode: 'Event Code (Box 6)',
  // 1099-S
  settlementAgent: 'Settlement Agent',
  grossProceeds: 'Gross Proceeds (Box 2)',
  closingDate: 'Closing Date (Box 1)',
  buyerRealEstateTax: "Buyer's RE Tax (Box 6)",
};

// ─── A. API Client ──────────────────────────────────

/**
 * Send PII-stripped OCR text to the AI extraction endpoint.
 * Runs scanForPII() client-side as the primary PII gate.
 */
export async function extractFieldsWithAI(
  ocrText: string,
  formTypeHint: string | null,
  aiSettings: { provider: AIProvider; apiKey: string; model: string },
): Promise<AIExtractionResult> {
  // Primary PII gate — strip before sending
  const piiResult = scanForPII(ocrText);
  const sanitizedText = piiResult.sanitized;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const resp = await fetch(`${API_BASE}/api/extract/fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        ocrText: sanitizedText,
        formTypeHint,
        provider: aiSettings.provider,
        apiKey: aiSettings.apiKey,
        model: aiSettings.model,
      }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => null);
      const msg = body?.error?.message || `HTTP ${resp.status}`;
      throw new Error(msg);
    }

    const json = await resp.json();
    const result = json.data as AIExtractionResult;

    // Privacy audit log — record what was sent (async, non-blocking)
    logOutboundRequest({
      feature: 'document-extract',
      provider: aiSettings.provider,
      model: aiSettings.model,
      redactedMessage: `[${formTypeHint || 'unknown form'}] ${sanitizedText.length} chars of PII-stripped OCR text`,
      piiBlocked: piiResult.hasPII ? buildPiiBlockSummary(piiResult.detectedTypes) : [],
      contextKeysSent: ['ocrText', 'formTypeHint'],
      responseTruncated: `${Object.keys(result.fields).length} fields extracted, type: ${result.formType}`,
    }).catch(() => {});

    return result;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('AI extraction timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── B. Cross-Validation Engine ─────────────────────

/**
 * Simple Levenshtein distance for short string comparison.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Check if two numeric values match within tolerance (1% or $1). */
function numericMatch(a: number, b: number): boolean {
  if (a === b) return true;
  const absDiff = Math.abs(a - b);
  if (absDiff <= 1) return true;
  const maxVal = Math.max(Math.abs(a), Math.abs(b));
  return maxVal > 0 && absDiff / maxVal <= 0.01;
}

/** Check if two string values match (case-insensitive, Levenshtein ≤ 2). */
function stringMatch(a: string, b: string): boolean {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return true;
  return levenshtein(la, lb) <= 2;
}

/** Determine if local and AI values agree. */
function valuesMatch(local: unknown, ai: unknown): boolean {
  if (typeof local === 'number' && typeof ai === 'number') {
    return numericMatch(local, ai);
  }
  if (typeof local === 'string' && typeof ai === 'string') {
    return stringMatch(local, ai);
  }
  return local === ai;
}

/** Check if a value is "found" (non-zero, non-empty). */
function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  return true;
}

const CONFIDENCE_ORDER: FieldConfidence[] = ['low', 'medium', 'high'];

function downgradeConfidence(c: FieldConfidence): FieldConfidence {
  const idx = CONFIDENCE_ORDER.indexOf(c);
  return idx > 0 ? CONFIDENCE_ORDER[idx - 1] : 'low';
}

/**
 * Cross-validate local OCR extraction against AI extraction results.
 * Returns per-field confidence and reasoning.
 */
export function crossValidate(
  localData: Record<string, unknown>,
  aiResult: AIExtractionResult,
  formType: SupportedFormType,
): CrossValidatedField[] {
  // Collect all unique field keys from both sources
  const allKeys = new Set<string>([
    ...Object.keys(localData),
    ...Object.keys(aiResult.fields),
  ]);

  const results: CrossValidatedField[] = [];

  for (const key of allKeys) {
    const localVal = localData[key];
    const aiField = aiResult.fields[key];
    const aiVal = aiField?.value;
    const aiConf = aiField?.confidence ?? 'low';
    const label = FIELD_LABELS[key] || key;

    const localFound = hasValue(localVal);
    const aiFound = aiField !== undefined && hasValue(aiVal);

    let confidence: FieldConfidence;
    let finalValue: unknown;
    let source: CrossValidatedField['source'];
    let reasoning: string;

    if (localFound && aiFound) {
      if (valuesMatch(localVal, aiVal)) {
        // Both agree
        confidence = 'high';
        finalValue = aiVal; // Prefer AI's cleaned value
        source = 'both_agree';
        reasoning = 'OCR and AI agree';
      } else {
        // Disagree — pick whichever has higher confidence
        confidence = 'medium';
        // AI typically has better accuracy on OCR text
        if (aiConf === 'high' || aiConf === 'medium') {
          finalValue = aiVal;
          source = 'ai';
          reasoning = `AI (${aiConf}) differs from OCR — verify`;
        } else {
          finalValue = localVal;
          source = 'local';
          reasoning = `OCR and AI disagree (AI: ${aiConf}) — verify`;
        }
      }
    } else if (!localFound && aiFound) {
      // AI found what OCR missed
      confidence = aiConf;
      finalValue = aiVal;
      source = 'ai';
      reasoning = 'Found by AI (missed by OCR)';
    } else if (localFound && !aiFound) {
      // OCR found it but AI didn't
      confidence = 'medium';
      finalValue = localVal;
      source = 'local';
      reasoning = 'OCR only (AI could not confirm)';
    } else {
      // Neither found it — skip
      continue;
    }

    results.push({ key, label, localValue: localVal, aiValue: aiVal, finalValue, confidence, source, reasoning });
  }

  // Apply form-specific validation rules
  applyValidationRules(results, formType);

  return results;
}

// ─── C. Form-Specific Validation Rules ──────────────

function findField(fields: CrossValidatedField[], key: string): CrossValidatedField | undefined {
  return fields.find(f => f.key === key);
}

function getNumeric(field: CrossValidatedField | undefined): number {
  if (!field) return 0;
  const val = field.finalValue;
  return typeof val === 'number' ? val : 0;
}

/**
 * Apply form-specific sanity checks. Downgrades confidence by one level
 * when a rule fails, and appends reasoning.
 */
function applyValidationRules(fields: CrossValidatedField[], formType: SupportedFormType): void {
  // ── W-2 rules ──
  if (formType === 'W-2') {
    // Social Security wages cap (2025: $176,100)
    const ssWages = findField(fields, 'socialSecurityWages');
    if (ssWages && getNumeric(ssWages) > 176_100) {
      ssWages.confidence = downgradeConfidence(ssWages.confidence);
      ssWages.reasoning += ' — exceeds 2025 SS wage cap ($176,100)';
    }

    // SS tax ≈ SS wages × 6.2% (±5%)
    const ssTax = findField(fields, 'socialSecurityTax');
    const ssWagesVal = getNumeric(ssWages);
    const ssTaxVal = getNumeric(ssTax);
    if (ssTax && ssWagesVal > 0 && ssTaxVal > 0) {
      const expected = ssWagesVal * 0.062;
      if (Math.abs(ssTaxVal - expected) / expected > 0.05) {
        ssTax.confidence = downgradeConfidence(ssTax.confidence);
        ssTax.reasoning += ` — expected ~$${expected.toFixed(0)} (6.2% of SS wages)`;
      }
    }

    // Medicare tax ≈ Medicare wages × 1.45% (±5%)
    const medWages = findField(fields, 'medicareWages');
    const medTax = findField(fields, 'medicareTax');
    const medWagesVal = getNumeric(medWages);
    const medTaxVal = getNumeric(medTax);
    if (medTax && medWagesVal > 0 && medTaxVal > 0) {
      const expected = medWagesVal * 0.0145;
      // Allow for additional Medicare tax (0.9% above $200k)
      if (medTaxVal < expected * 0.95) {
        medTax.confidence = downgradeConfidence(medTax.confidence);
        medTax.reasoning += ` — expected ~$${expected.toFixed(0)} (1.45% of Medicare wages)`;
      }
    }
  }

  // ── 1099-DIV: qualified ≤ ordinary ──
  if (formType === '1099-DIV') {
    const ordinary = findField(fields, 'ordinaryDividends');
    const qualified = findField(fields, 'qualifiedDividends');
    if (ordinary && qualified && getNumeric(qualified) > getNumeric(ordinary)) {
      qualified.confidence = downgradeConfidence(qualified.confidence);
      qualified.reasoning += ' — qualified cannot exceed ordinary dividends';
    }
  }

  // ── K-1: qualified dividends ≤ ordinary dividends ──
  if (formType === 'K-1') {
    const ordinary = findField(fields, 'ordinaryDividends');
    const qualified = findField(fields, 'qualifiedDividends');
    if (ordinary && qualified && getNumeric(qualified) > getNumeric(ordinary)) {
      qualified.confidence = downgradeConfidence(qualified.confidence);
      qualified.reasoning += ' — qualified cannot exceed ordinary dividends';
    }
  }

  // ── 1099-R: taxable ≤ gross ──
  if (formType === '1099-R') {
    const gross = findField(fields, 'grossDistribution');
    const taxable = findField(fields, 'taxableAmount');
    if (gross && taxable && getNumeric(taxable) > getNumeric(gross)) {
      taxable.confidence = downgradeConfidence(taxable.confidence);
      taxable.reasoning += ' — taxable amount cannot exceed gross distribution';
    }
  }

  // ── All forms: withholding ≤ primary income ──
  const withholdingField = findField(fields, 'federalTaxWithheld');
  if (withholdingField) {
    const withheld = getNumeric(withholdingField);
    if (withheld > 0) {
      // Find the primary income field for this form type
      const primaryKeys: Record<string, string> = {
        'W-2': 'wages',
        '1099-INT': 'amount',
        '1099-DIV': 'ordinaryDividends',
        '1099-R': 'grossDistribution',
        '1099-NEC': 'amount',
        '1099-MISC': 'otherIncome',
        '1099-G': 'unemploymentCompensation',
        '1099-B': 'proceeds',
        '1099-K': 'grossAmount',
        'SSA-1099': 'totalBenefits',
        '1099-SA': 'grossDistribution',
        '1099-Q': 'grossDistribution',
        'K-1': 'ordinaryBusinessIncome',
        'W-2G': 'grossWinnings',
        '1099-C': 'amountCancelled',
        '1099-S': 'grossProceeds',
        '1098': 'mortgageInterest',
        '1098-E': 'interestPaid',
        '1098-T': 'tuitionPayments',
        '1095-A': 'annualEnrollmentPremium',
      };

      const primaryKey = primaryKeys[formType];
      const primaryField = primaryKey ? findField(fields, primaryKey) : undefined;
      const primaryVal = getNumeric(primaryField);

      if (primaryVal > 0 && withheld > primaryVal) {
        withholdingField.confidence = downgradeConfidence(withholdingField.confidence);
        withholdingField.reasoning += ' — withholding exceeds income amount';
      }
    }
  }
}
