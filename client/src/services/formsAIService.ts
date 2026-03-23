/**
 * Forms AI Service — powers AI-assisted features in Forms Mode.
 *
 * Provides:
 * 1. Field explanation context builder (for "explain this field")
 * 2. Form review / audit (for "what's wrong with my form")
 * 3. Form search by natural language (for "find the right form")
 * 4. Field completeness analysis (for smart sidebar badges)
 * 5. Full-return narrative review
 */

import type { IRSFormTemplate, TaxReturn, CalculationResult, ClassifiedField } from '@telostax/engine';
import { classifyFields } from '@telostax/engine';
import { resolveFieldValue } from './formFieldResolver';
import { ALL_TEMPLATES } from './irsFormFiller';

// ─── Prompt + Context Pair ────────────────────────

/** Short user message + detailed context for the LLM. */
export interface AIPrompt {
  /** Short message shown in chat (must be under 2000 chars). */
  message: string;
  /** Detailed data injected into formsReviewContext (no size limit). */
  context?: string;
}

// ─── Field Explanation Context ─────────────────────

/**
 * Build a short chat prompt + context to explain a specific form field.
 * Used by the "Ask AI about this field" action in PdfFormViewer.
 */
export function buildFieldExplainPrompt(
  template: IRSFormTemplate,
  cf: ClassifiedField,
  currentValue: string | undefined,
): AIPrompt {
  const formName = template.displayName;
  const label = cf.mapping.formLabel || cf.mapping.pdfFieldName;
  const editable = cf.isEditable ? 'user-editable' : 'auto-calculated';
  const valueNote = currentValue != null && currentValue !== ''
    ? `The current value is: ${currentValue}.`
    : 'This field is currently empty.';

  return {
    message: `Explain the **${label}** field on **${formName}**. What goes here, what IRS rules apply, and common mistakes?`,
    context: `Field details: ${label} (${editable}) on ${formName}. ${valueNote}`,
  };
}

// ─── Form Review / Audit ───────────────────────────

export interface FormReviewIssue {
  severity: 'error' | 'warning' | 'info';
  fieldLabel: string;
  message: string;
}

/**
 * Analyze a form for issues: empty required fields, suspicious values,
 * math inconsistencies.
 */
export function reviewForm(
  template: IRSFormTemplate,
  taxReturn: TaxReturn,
  calculation: CalculationResult,
  instanceIndex: number = 0,
): FormReviewIssue[] {
  const issues: FormReviewIssue[] = [];
  const fields = template.fieldsForInstance
    ? template.fieldsForInstance(instanceIndex, taxReturn, calculation)
    : template.fields;
  const classified = classifyFields(fields);

  let filledCount = 0;
  let editableCount = 0;

  for (const cf of classified) {
    const { rawValue, displayValue } = resolveFieldValue(cf.mapping, taxReturn, calculation);
    const label = cf.mapping.formLabel || cf.mapping.pdfFieldName;

    if (cf.isEditable) {
      editableCount++;
      if (rawValue != null && rawValue !== '' && rawValue !== 0) {
        filledCount++;
      }
    }

    // Check for negative values where they shouldn't be
    if (typeof rawValue === 'number' && rawValue < 0 && cf.mapping.format !== 'string') {
      issues.push({
        severity: 'warning',
        fieldLabel: label,
        message: `Negative value (${displayValue}) — verify this is correct.`,
      });
    }

    // Check for suspiciously large values (over $1M on non-total fields)
    if (
      typeof rawValue === 'number' &&
      rawValue > 1_000_000 &&
      cf.isEditable &&
      !label.toLowerCase().includes('total') &&
      !label.toLowerCase().includes('agi') &&
      !label.toLowerCase().includes('income')
    ) {
      issues.push({
        severity: 'info',
        fieldLabel: label,
        message: `Large value ($${rawValue.toLocaleString()}) — double-check this amount.`,
      });
    }
  }

  // Check overall completeness
  if (editableCount > 0 && filledCount === 0) {
    issues.push({
      severity: 'warning',
      fieldLabel: 'Overall',
      message: `This form has ${editableCount} editable fields but none are filled. You may need to complete the corresponding interview steps first.`,
    });
  } else if (editableCount > 0 && filledCount < editableCount * 0.3) {
    issues.push({
      severity: 'info',
      fieldLabel: 'Overall',
      message: `Only ${filledCount} of ${editableCount} editable fields are filled (${Math.round(filledCount / editableCount * 100)}%).`,
    });
  }

  return issues;
}

/**
 * Build a short chat message + detailed context for a full form review.
 */
export function buildFormReviewPrompt(
  template: IRSFormTemplate,
  taxReturn: TaxReturn,
  calculation: CalculationResult,
  instanceIndex: number = 0,
): AIPrompt {
  const issues = reviewForm(template, taxReturn, calculation, instanceIndex);
  const fields = template.fieldsForInstance
    ? template.fieldsForInstance(instanceIndex, taxReturn, calculation)
    : template.fields;
  const classified = classifyFields(fields);

  // Build field summary
  const fieldLines: string[] = [];
  for (const cf of classified) {
    const { displayValue, isChecked } = resolveFieldValue(cf.mapping, taxReturn, calculation);
    const label = cf.mapping.formLabel || cf.mapping.pdfFieldName;
    if (cf.mapping.format === 'checkbox') {
      if (isChecked) fieldLines.push(`  ${label}: Checked`);
    } else if (displayValue) {
      fieldLines.push(`  ${label}: ${displayValue}`);
    }
  }

  const issueLines = issues.map(i =>
    `- [${i.severity.toUpperCase()}] ${i.fieldLabel}: ${i.message}`
  );

  const context =
    `Form: ${template.displayName}\n` +
    `Field values:\n${fieldLines.join('\n') || '  (no fields populated)'}\n\n` +
    (issueLines.length > 0
      ? `Auto-detected issues:\n${issueLines.join('\n')}`
      : 'No auto-detected issues.');

  return {
    message: `Review my **${template.displayName}** for errors, missing fields, and tax optimization opportunities.`,
    context,
  };
}

// ─── Form Search ───────────────────────────────────

interface FormSearchResult {
  template: IRSFormTemplate;
  relevance: 'high' | 'medium' | 'low';
  reason: string;
}

/** Keywords mapped to form IDs for common natural-language queries. */
const FORM_KEYWORDS: Record<string, string[]> = {
  f1040: ['1040', 'main', 'return', 'tax return', 'income tax'],
  f1040sa: ['schedule a', 'itemized', 'deductions', 'medical', 'charity', 'mortgage interest', 'salt'],
  f1040sb: ['schedule b', 'interest', 'dividends', 'dividend'],
  f1040sc: ['schedule c', 'business', 'self-employed', 'freelance', 'sole proprietor', '1099-nec', 'profit and loss'],
  f1040sd: ['schedule d', 'capital gains', 'capital losses', 'stock', 'crypto', 'investment'],
  f1040se: ['schedule e', 'rental', 'royalt', 'partnership', 'k-1', 's corp'],
  f1040sf: ['schedule f', 'farm', 'farming', 'agriculture'],
  f1040sh: ['schedule h', 'household', 'nanny', 'domestic'],
  f1040sr: ['schedule r', 'elderly', 'disabled', 'retirement credit'],
  f1040sse: ['schedule se', 'self-employment tax', 'se tax'],
  f1040s1: ['schedule 1', 'additional income', 'adjustments', 'hsa', 'student loan', 'educator', 'alimony'],
  f1040s2: ['schedule 2', 'additional tax', 'amt', 'alternative minimum', 'se tax'],
  f1040s3: ['schedule 3', 'additional credits', 'foreign tax credit', 'education credit', 'estimated tax'],
  f8949: ['8949', 'sales', 'dispositions', 'capital assets', 'stock sale', 'crypto sale'],
  f8962: ['8962', 'premium tax credit', 'ptc', 'marketplace', 'aca', 'obamacare', 'health insurance'],
  f5695: ['5695', 'energy', 'solar', 'clean energy', 'ev charger', 'heat pump', 'residential energy'],
  f8863: ['8863', 'education', 'tuition', 'american opportunity', 'lifetime learning', 'aotc', 'llc'],
  f8889: ['8889', 'hsa', 'health savings', 'health savings account'],
  f4562: ['4562', 'depreciation', 'amortization', 'section 179', 'bonus depreciation'],
  f8936: ['8936', 'ev', 'electric vehicle', 'clean vehicle', 'ev credit'],
  f8911: ['8911', 'ev charger', 'refueling', 'alternative fuel'],
  f4797: ['4797', 'business property', 'sale of property', 'section 1231'],
  f6251: ['6251', 'amt', 'alternative minimum tax'],
  f8606: ['8606', 'ira', 'nondeductible ira', 'roth conversion', 'backdoor roth'],
  f5329: ['5329', 'early distribution', 'penalty', 'retirement penalty', 'ira penalty'],
  f8283: ['8283', 'noncash', 'donation', 'charitable', 'property donation'],
  f2555: ['2555', 'foreign earned', 'foreign income', 'expat', 'living abroad'],
  f8582: ['8582', 'passive', 'passive activity', 'rental loss'],
  f4952: ['4952', 'investment interest', 'margin interest'],
};

/**
 * Search for forms by natural language query.
 * Returns matching templates sorted by relevance.
 */
export function searchForms(
  query: string,
  taxReturn?: TaxReturn | null,
  calculation?: CalculationResult | null,
): FormSearchResult[] {
  const q = query.toLowerCase().trim();
  const results: FormSearchResult[] = [];

  for (const template of ALL_TEMPLATES) {
    const formId = template.formId;
    const keywords = FORM_KEYWORDS[formId] || [];
    const displayLower = template.displayName.toLowerCase();

    // Check display name match
    const nameMatch = displayLower.includes(q) || q.includes(formId.replace('f', ''));

    // Check keyword match
    const keywordMatch = keywords.some(kw => q.includes(kw) || kw.includes(q));

    if (nameMatch || keywordMatch) {
      const isApplicable = taxReturn && calculation
        ? template.condition(taxReturn, calculation)
        : true;

      results.push({
        template,
        relevance: nameMatch && keywordMatch ? 'high' : nameMatch || keywordMatch ? 'medium' : 'low',
        reason: isApplicable
          ? `${template.displayName} — applicable to your return`
          : `${template.displayName} — not currently applicable (may need more data)`,
      });
    }
  }

  // Sort: high first, then applicable, then alphabetical
  results.sort((a, b) => {
    const relOrder = { high: 0, medium: 1, low: 2 };
    return relOrder[a.relevance] - relOrder[b.relevance];
  });

  return results;
}

// ─── Field Completeness (Sidebar Badges) ───────────

export interface FormCompleteness {
  formId: string;
  totalEditable: number;
  filled: number;
  /** 0–100 percentage */
  percent: number;
  /** 'complete' (100%), 'partial' (1-99%), 'empty' (0%) */
  status: 'complete' | 'partial' | 'empty';
  /** True if form has errors (e.g., negative values, missing required) */
  hasIssues: boolean;
}

/**
 * Compute field completeness for a single form.
 */
export function getFormCompleteness(
  template: IRSFormTemplate,
  taxReturn: TaxReturn,
  calculation: CalculationResult,
  instanceIndex: number = 0,
): FormCompleteness {
  const fields = template.fieldsForInstance
    ? template.fieldsForInstance(instanceIndex, taxReturn, calculation)
    : template.fields;
  const classified = classifyFields(fields);

  let totalEditable = 0;
  let filled = 0;
  let hasIssues = false;

  for (const cf of classified) {
    if (!cf.isEditable) continue;
    totalEditable++;

    const { rawValue } = resolveFieldValue(cf.mapping, taxReturn, calculation);
    if (rawValue != null && rawValue !== '' && rawValue !== 0) {
      filled++;
    }

    // Flag negative values as issues
    if (typeof rawValue === 'number' && rawValue < 0) {
      hasIssues = true;
    }
  }

  const percent = totalEditable > 0 ? Math.round((filled / totalEditable) * 100) : 100;
  const status = percent === 100 ? 'complete' : percent > 0 ? 'partial' : 'empty';

  return { formId: template.formId, totalEditable, filled, percent, status, hasIssues };
}

// ─── Full Return Review ────────────────────────────

/**
 * Build a short chat message + detailed context for a comprehensive return review.
 */
export function buildFullReturnReviewPrompt(
  taxReturn: TaxReturn,
  calculation: CalculationResult,
): AIPrompt {
  const applicableTemplates = ALL_TEMPLATES.filter(t => t.condition(taxReturn, calculation));

  const formSummaries: string[] = [];
  const allIssues: string[] = [];

  for (const template of applicableTemplates) {
    const instanceCount = template.instanceCount?.(taxReturn, calculation) ?? 1;
    for (let i = 0; i < instanceCount; i++) {
      const fields = template.fieldsForInstance
        ? template.fieldsForInstance(i, taxReturn, calculation)
        : template.fields;
      const classified = classifyFields(fields);

      const filledFields: string[] = [];
      for (const cf of classified) {
        const { displayValue, isChecked } = resolveFieldValue(cf.mapping, taxReturn, calculation);
        const label = cf.mapping.formLabel || cf.mapping.pdfFieldName;
        if (cf.mapping.format === 'checkbox') {
          if (isChecked) filledFields.push(`${label}: Checked`);
        } else if (displayValue) {
          filledFields.push(`${label}: ${displayValue}`);
        }
      }

      const suffix = instanceCount > 1 ? ` (${i + 1})` : '';
      if (filledFields.length > 0) {
        formSummaries.push(
          `${template.displayName}${suffix} (${filledFields.length} fields):\n` +
          filledFields.slice(0, 10).map(f => `  ${f}`).join('\n') +
          (filledFields.length > 10 ? `\n  ... and ${filledFields.length - 10} more fields` : ''),
        );
      }

      const issues = reviewForm(template, taxReturn, calculation, i);
      for (const issue of issues) {
        allIssues.push(`[${template.displayName}${suffix}] ${issue.fieldLabel}: ${issue.message}`);
      }
    }
  }

  const context =
    `Applicable forms: ${applicableTemplates.length}\n\n` +
    `Form Summary:\n${formSummaries.join('\n\n')}\n\n` +
    (allIssues.length > 0
      ? `Auto-detected Issues:\n${allIssues.map(i => `- ${i}`).join('\n')}`
      : 'No auto-detected issues.');

  return {
    message: `Review my complete 2025 tax return (${applicableTemplates.length} forms). Are the numbers right? Any red flags or optimization opportunities? Is it ready to file?`,
    context,
  };
}
