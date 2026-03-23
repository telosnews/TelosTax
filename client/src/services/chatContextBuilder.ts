/**
 * Chat Context Builder
 *
 * Builds a PII-safe context object from the current TaxReturn and
 * wizard step. This context is sent to the LLM to provide awareness
 * of where the user is in the workflow without exposing personal data.
 *
 * NEVER includes: names, SSN, addresses, dates of birth, individual amounts.
 * ONLY includes: step position, structural metadata, counts, and aggregate
 * dollar amounts (from calculation traces).
 *
 * Phase 4 additions:
 * - `traceContext`: compact text from calculation traces, letting the AI
 *   answer "why is my tax $X?" with grounded data and IRC citations.
 * - `flowContext`: visible/hidden step descriptions using declarative
 *   conditions, letting the AI explain "why don't I see Schedule C?"
 */

import type { TaxReturn, CalculationResult, CalculationTrace } from '@telostax/engine';
import type { ChatContext } from '@telostax/engine';
import { describeCondition } from '@telostax/engine';
import type { WizardStep } from '../store/taxReturnStore';
import { getSuggestions, TaxSuggestion } from './suggestionService';
import { getActiveWarnings } from './warningService';
import { assessAuditRisk } from './auditRiskService';
import { calculateTaxCalendar } from './taxCalendarService';
import { buildDocumentInventory } from './documentInventoryService';
import { useDeductionFinderStore } from '../store/deductionFinderStore';
import { getScenarioLabSnapshot } from '../components/scenarioLab/useScenarioLab';

/**
 * Map filing status enum to human-readable string.
 */
const FILING_STATUS_NAMES: Record<number, string> = {
  1: 'single',
  2: 'married_filing_jointly',
  3: 'married_filing_separately',
  4: 'head_of_household',
  5: 'qualifying_surviving_spouse',
};

/**
 * Build a PII-safe context object for the chat assistant.
 *
 * @param taxReturn       Current tax return (or null)
 * @param currentStepId   ID of the current wizard step
 * @param currentSection  Section of the current wizard step
 * @param calculation     Optional CalculationResult (for trace context)
 * @param visibleSteps    Optional visible wizard steps (for flow context)
 * @param allSteps        Optional all wizard steps (for flow context — to know which are hidden)
 */
export function buildChatContext(
  taxReturn: TaxReturn | null,
  currentStepId: string,
  currentSection: string,
  calculation?: CalculationResult | null,
  visibleSteps?: WizardStep[],
  allSteps?: WizardStep[],
): ChatContext {
  if (!taxReturn) {
    return {
      currentStep: currentStepId,
      currentSection,
      incomeDiscovery: {},
      dependentCount: 0,
      incomeTypeCounts: {},
    };
  }

  // Build a schema-aware name scrubber from known TaxReturn name fields.
  // Applied to any context string that might contain names (warnings, suggestions, etc.)
  const scrubNames = buildNameScrubber(taxReturn);

  // Helper: scrub a context string if it exists
  const scrub = (s: string | undefined) => s ? scrubNames(s) : undefined;

  return {
    currentStep: currentStepId,
    currentSection,
    filingStatus: taxReturn.filingStatus
      ? FILING_STATUS_NAMES[taxReturn.filingStatus] || undefined
      : undefined,
    incomeDiscovery: taxReturn.incomeDiscovery || {},
    deductionMethod: taxReturn.deductionMethod || undefined,
    dependentCount: taxReturn.dependents?.length || 0,
    incomeTypeCounts: {
      w2: taxReturn.w2Income?.length || 0,
      '1099nec': taxReturn.income1099NEC?.length || 0,
      '1099k': taxReturn.income1099K?.length || 0,
      '1099int': taxReturn.income1099INT?.length || 0,
      '1099div': taxReturn.income1099DIV?.length || 0,
      '1099r': taxReturn.income1099R?.length || 0,
      '1099g': taxReturn.income1099G?.length || 0,
      '1099misc': taxReturn.income1099MISC?.length || 0,
      '1099b': taxReturn.income1099B?.length || 0,
      '1099da': taxReturn.income1099DA?.length || 0,
      k1: taxReturn.incomeK1?.length || 0,
      '1099sa': taxReturn.income1099SA?.length || 0,
      rental: taxReturn.rentalProperties?.length || 0,
    },
    traceContext: calculation ? buildTraceContext(calculation) : undefined,
    flowContext: visibleSteps && allSteps ? buildFlowContext(visibleSteps, allSteps) : undefined,
    suggestionsContext: scrub(buildSuggestionsContext(taxReturn, calculation)),
    warningsContext: scrub(buildWarningsContext(taxReturn, calculation)),
    scenarioLabContext: buildScenarioLabContext(),
    deductionFinderContext: buildExpenseScannerContext(),
    stepFieldsContext: scrub(buildStepFieldsContext(taxReturn, currentStepId, calculation)),
    auditRiskContext: scrub(buildAuditRiskContext(taxReturn, calculation)),
    taxCalendarContext: buildTaxCalendarContext(taxReturn, calculation),
    documentInventoryContext: scrub(buildDocumentInventoryContext(taxReturn)),
    yearOverYearContext: scrub(buildYearOverYearContext(taxReturn, calculation)),
  };
}

// ─── Schema-Aware Name Scrubber ──────────────────────

/**
 * Build a list of [regex, replacement] pairs for all known name fields
 * in the TaxReturn. Applied to any context string that might contain names
 * (warnings, suggestions, etc.) to prevent PII leakage to the LLM.
 *
 * This is schema-aware (not NLP) — we know exactly which fields hold names.
 */
function buildNameScrubber(tr: TaxReturn): (text: string) => string {
  const replacements: [RegExp, string][] = [];

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const addName = (name: string | undefined, token: string) => {
    if (!name || name.length < 2) return;
    replacements.push([new RegExp(escapeRe(name), 'gi'), token]);
  };

  // Taxpayer
  addName(tr.firstName, '[Taxpayer]');
  addName(tr.lastName, '[Taxpayer]');
  const fullName = [tr.firstName, tr.lastName].filter(Boolean).join(' ');
  if (fullName.length > 3) {
    replacements.unshift([new RegExp(escapeRe(fullName), 'gi'), '[Taxpayer]']);
  }

  // Spouse
  addName((tr as any).spouseFirstName, '[Spouse]');
  addName((tr as any).spouseLastName, '[Spouse]');

  // Dependents
  (tr.dependents || []).forEach((dep, i) => {
    const label = `[Dependent ${i + 1}]`;
    const depFull = [dep.firstName, dep.lastName].filter(Boolean).join(' ');
    if (depFull.length > 3) replacements.push([new RegExp(escapeRe(depFull), 'gi'), label]);
    addName(dep.firstName, label);
    addName(dep.lastName, label);
  });

  // Businesses (Schedule C)
  (tr.businesses || []).forEach((biz, i) => {
    addName(biz.businessName, `[Business ${i + 1}]`);
  });

  // W-2 employers
  (tr.w2Income || []).forEach((w2, i) => {
    addName(w2.employerName, `[Employer ${i + 1}]`);
  });

  // 1099 payers / brokers / platforms
  (tr.income1099NEC || []).forEach((item, i) => addName(item.payerName, `[1099-NEC Payer ${i + 1}]`));
  (tr.income1099K || []).forEach((item, i) => addName(item.platformName, `[1099-K Platform ${i + 1}]`));
  (tr.income1099INT || []).forEach((item, i) => addName(item.payerName, `[1099-INT Payer ${i + 1}]`));
  (tr.income1099DIV || []).forEach((item, i) => addName(item.payerName, `[1099-DIV Payer ${i + 1}]`));
  ((tr as any).income1099OID || []).forEach((item: any, i: number) => addName(item.payerName, `[1099-OID Payer ${i + 1}]`));
  (tr.income1099R || []).forEach((item, i) => addName(item.payerName, `[1099-R Payer ${i + 1}]`));
  (tr.income1099G || []).forEach((item, i) => addName(item.payerName, `[1099-G Payer ${i + 1}]`));
  (tr.income1099MISC || []).forEach((item, i) => addName(item.payerName, `[1099-MISC Payer ${i + 1}]`));
  (tr.income1099B || []).forEach((item, i) => addName(item.brokerName, `[Broker ${i + 1}]`));
  (tr.income1099DA || []).forEach((item, i) => addName(item.brokerName, `[Crypto Broker ${i + 1}]`));
  (tr.income1099SA || []).forEach((item, i) => addName(item.payerName, `[1099-SA Payer ${i + 1}]`));
  (tr.income1099C || []).forEach((item, i) => addName(item.payerName, `[1099-C Payer ${i + 1}]`));
  (tr.income1099Q || []).forEach((item, i) => addName((item as any).payerName, `[1099-Q Payer ${i + 1}]`));
  (tr.incomeW2G || []).forEach((item, i) => addName(item.payerName, `[W-2G Payer ${i + 1}]`));
  (tr.incomeK1 || []).forEach((item, i) => addName(item.entityName, `[K-1 Entity ${i + 1}]`));

  // Return a scrubber function that applies all replacements
  return (text: string): string => {
    let result = text;
    for (const [pattern, replacement] of replacements) {
      result = result.replace(pattern, replacement);
    }
    return result;
  };
}

// ─── Trace Context ─────────────────────────────────

/**
 * Round a dollar value for privacy: reduces fingerprinting precision
 * while preserving enough accuracy for the AI to explain calculations.
 * Rounds to nearest $100 (for values < $10K), $500 (< $100K), or $1,000 (>= $100K).
 */
function roundForPrivacy(value: number): number {
  if (value === 0) return 0;
  const abs = Math.abs(value);
  const roundTo = abs >= 100_000 ? 1_000 : abs >= 10_000 ? 500 : 100;
  const rounded = Math.round(abs / roundTo) * roundTo;
  return value < 0 ? -rounded : rounded;
}

function formatRounded(value: number): string {
  return `~$${roundForPrivacy(value).toLocaleString('en-US')}`;
}

/**
 * Serialize calculation traces into a compact text summary for the LLM.
 * Dollar amounts are rounded to reduce financial fingerprinting precision
 * while preserving enough accuracy for contextual tax explanations.
 *
 * No PII — only approximate aggregate dollar amounts and form line references.
 */
function buildTraceContext(calculation: CalculationResult): string | undefined {
  const traces = calculation.traces;
  if (!traces || traces.length === 0) return undefined;

  const lines: string[] = [];

  for (const trace of traces) {
    let line = `${trace.label} (${trace.lineId}): ${formatRounded(trace.value)}`;

    // Add inputs summary
    if (trace.inputs.length > 0) {
      const inputParts = trace.inputs.map((i) => `${i.label} (${formatRounded(i.value)})`);
      line += ` = ${inputParts.join(' + ')}`;
    }

    // Add formula if present
    if (trace.formula) {
      line += ` [formula: ${trace.formula}]`;
    }

    // Add authority if present
    if (trace.authority) {
      line += ` [${trace.authority}]`;
    }

    lines.push(line);

    // Add children (e.g., bracket breakdown) indented
    if (trace.children) {
      for (const child of trace.children) {
        let childLine = `  └ ${child.label}: ${formatRounded(child.value)}`;
        if (child.formula) childLine += ` (${child.formula})`;
        if (child.authority) childLine += ` [${child.authority}]`;
        lines.push(childLine);
      }
    }
  }

  return lines.join('\n');
}

// ─── Flow Context ──────────────────────────────────

/**
 * Build a text summary of visible/hidden wizard steps with condition descriptions.
 * Lets the AI explain "why don't I see the Schedule C section?"
 */
function buildFlowContext(visibleSteps: WizardStep[], allSteps: WizardStep[]): string | undefined {
  const visibleIds = new Set(visibleSteps.map((s) => s.id));
  const conditionalSteps = allSteps.filter((s) => s.condition || s.declarativeCondition);

  if (conditionalSteps.length === 0) return undefined;

  const lines: string[] = [];

  for (const step of conditionalSteps) {
    const isVisible = visibleIds.has(step.id);
    const status = isVisible ? 'VISIBLE' : 'HIDDEN';
    let reason = '';

    if (step.declarativeCondition) {
      reason = describeCondition(step.declarativeCondition);
    } else {
      reason = '(imperative condition — not describable)';
    }

    lines.push(`${step.label} (${step.id}): ${status} — condition: ${reason}`);
  }

  return lines.join('\n');
}

// ─── Suggestions Context ────────────────────────────

/**
 * Build a text summary of active deduction/credit suggestions.
 * Lets the AI proactively mention missed benefits (e.g., "I noticed you
 * have foreign tax paid on your 1099-DIV but haven't enabled the Foreign
 * Tax Credit section").
 */
function buildSuggestionsContext(
  taxReturn: TaxReturn,
  calculation?: CalculationResult | null,
): string | undefined {
  const suggestions = getSuggestions(taxReturn, calculation);
  if (suggestions.length === 0) return undefined;

  const lines = suggestions.map((s) => {
    let line = `[${s.type.toUpperCase()}] ${s.title}: ${s.description}`;
    if (s.estimatedBenefit != null && s.estimatedBenefit > 0) {
      line += ` (estimated benefit: ~$${s.estimatedBenefit.toLocaleString()})`;
    }
    line += ` → enable discoveryKey="${s.discoveryKey}", stepId="${s.stepId}"`;
    return line;
  });

  return lines.join('\n');
}

// ─── Warnings Context ─────────────────────────────

/**
 * Build a PII-safe summary of active validation warnings.
 * Lets the AI reference cross-field conflicts and inconsistencies
 * (e.g., "HoH filing with no qualifying dependent", "CTC count mismatch").
 *
 * No PII — only step labels, field names, and warning messages.
 * Warning messages are already written to be user-facing.
 */
function buildWarningsContext(
  taxReturn: TaxReturn,
  calculation?: CalculationResult | null,
): string | undefined {
  const warningsByStep = getActiveWarnings(taxReturn, calculation);
  if (warningsByStep.length === 0) return undefined;

  // Name scrubbing is now handled globally by buildNameScrubber() in buildChatContext.
  // Warning messages may contain employer/payer/dependent names via itemLabel — all
  // will be replaced with tokens like [Employer 1], [Dependent 2], etc.

  const totalCount = warningsByStep.reduce((sum, s) => sum + s.warnings.length, 0);
  const lines: string[] = [];

  lines.push(`${totalCount} validation warning(s) across ${warningsByStep.length} step(s):`);

  for (const group of warningsByStep) {
    lines.push(`\n[${group.stepLabel}]`);
    for (const w of group.warnings) {
      const itemNote = w.itemLabel ? ` (${w.itemLabel})` : '';
      lines.push(`- ${w.message}${itemNote}`);
    }
  }

  return lines.join('\n');
}

// ─── Scenario Lab Context ─────────────────────────

/**
 * Build a summary of active Tax Scenario Lab scenarios and their impact.
 * Lets the AI discuss what-if results: "Your 'Max Retirement' scenario
 * would increase your refund by $2,400."
 */
function buildScenarioLabContext(): string | undefined {
  const snapshot = getScenarioLabSnapshot();
  if (!snapshot || snapshot.scenarios.length === 0) return undefined;

  const lines: string[] = [];
  lines.push(`${snapshot.scenarios.length} active scenario(s) in the Tax Scenario Lab:`);

  for (const scenario of snapshot.scenarios) {
    const delta = snapshot.deltas.get(scenario.id);
    if (!delta) {
      lines.push(`\n"${scenario.name}" (${scenario.overrideCount} change(s)) — no results yet`);
      continue;
    }

    const refundDelta = delta.refundOrOwed;
    const sign = refundDelta.diff >= 0 ? '+' : '';
    const refundLabel = refundDelta.scenario >= 0 ? 'refund' : 'owed';

    lines.push(`\n"${scenario.name}" (${scenario.overrideCount} change(s)):`);
    lines.push(`  Net impact: ${sign}$${Math.round(Math.abs(refundDelta.diff)).toLocaleString()} (${refundLabel}: $${Math.round(Math.abs(refundDelta.scenario)).toLocaleString()})`);

    // Key deltas — only show non-zero changes
    const metrics: Array<[string, typeof delta.agi]> = [
      ['AGI', delta.agi],
      ['Taxable income', delta.taxableIncome],
      ['Income tax', delta.incomeTax],
      ['Total credits', delta.totalCredits],
      ['SE tax', delta.seTax],
      ['Effective rate', delta.effectiveTaxRate],
    ];

    for (const [label, entry] of metrics) {
      if (Math.abs(entry.diff) < 1 && label !== 'Effective rate') continue;
      if (label === 'Effective rate' && Math.abs(entry.diff) < 0.001) continue;
      if (label === 'Effective rate') {
        const pctSign = entry.diff >= 0 ? '+' : '';
        lines.push(`  ${label}: ${(entry.scenario * 100).toFixed(1)}% (${pctSign}${(entry.diff * 100).toFixed(1)}pp)`);
      } else {
        const mSign = entry.diff >= 0 ? '+' : '-';
        lines.push(`  ${label}: ~$${Math.round(Math.abs(entry.scenario)).toLocaleString()} (${mSign}$${Math.round(Math.abs(entry.diff)).toLocaleString()})`);
      }
    }
  }

  return lines.join('\n');
}

// ─── Expense Scanner Context ──────────────────────

/**
 * Build a PII-safe summary of Smart Expense Scanner results.
 * Includes category summaries and amounts but NO raw merchant names
 * or transaction descriptions (could contain PII).
 */
function buildExpenseScannerContext(): string | undefined {
  const { categorizationResult, allTransactions, uploadedFiles, scannerPhase } = useDeductionFinderStore.getState();

  const lines: string[] = [];
  lines.push(`Scanner phase: ${scannerPhase}`);

  if (!categorizationResult) {
    if (allTransactions.length > 0) {
      lines.push(`${allTransactions.length} transactions loaded from ${uploadedFiles.length} file(s), not yet categorized.`);
    }
    return lines.length > 1 ? lines.join('\n') : undefined;
  }

  lines.push(`Analyzed ${allTransactions.length} transactions from ${uploadedFiles.length} file(s).`);
  lines.push(`Estimated deductible total: ~$${categorizationResult.estimatedDeductibleTotal.toLocaleString()}`);
  lines.push(`Tax-relevant: ${categorizationResult.totalProcessed - categorizationResult.personalCount}, Personal: ${categorizationResult.personalCount}`);
  lines.push('');
  lines.push('Categories found:');

  for (const summary of categorizationResult.summaries) {
    if (summary.category === 'personal') continue;
    const amount = summary.totalAmount > 0 ? ` — ~$${Math.round(summary.totalAmount).toLocaleString()}` : '';
    const approved = summary.approved ? ' [APPROVED]' : '';
    lines.push(`- ${summary.label} (${summary.targetForm}): ${summary.transactionCount} transactions${amount}${approved}`);
  }

  // Sub-category breakdown for business expenses (Level 3 detail)
  const businessTxns = categorizationResult.transactions.filter(t => t.category === 'business_expense');
  if (businessTxns.length > 0) {
    lines.push('');
    lines.push('Business expense sub-categories (Schedule C):');
    const subCatMap = new Map<string, { count: number; total: number }>();
    for (const t of businessTxns) {
      const existing = subCatMap.get(t.subCategory);
      const amount = Math.abs(t.transaction.amount);
      if (existing) { existing.count++; existing.total += amount; }
      else subCatMap.set(t.subCategory, { count: 1, total: amount });
    }
    for (const [subCat, { count, total }] of subCatMap) {
      lines.push(`  - ${subCat}: ${count} transactions, ~$${Math.round(total).toLocaleString()}`);
    }
  }

  return lines.join('\n');
}

// ─── Step Fields Context ──────────────────────────

/** Shorthand for formatting dollar amounts. */
const fmt = (v: number) => formatRounded(v);

/**
 * Build a PII-safe summary of the field values on the current wizard step.
 * Lets the AI see what the user has entered, so it can answer questions like
 * "Do you see my Solo 401k deferral?" or "What have I entered so far?"
 *
 * No PII — excludes names, SSNs, EINs, addresses, DOBs.
 * Dollar amounts are privacy-rounded.
 */
function buildStepFieldsContext(
  taxReturn: TaxReturn,
  currentStepId: string,
  calculation?: CalculationResult | null,
): string | undefined {
  const extractor = STEP_FIELD_EXTRACTORS[currentStepId];
  if (!extractor) return undefined;
  return extractor(taxReturn, calculation ?? undefined);
}

const STEP_FIELD_EXTRACTORS: Record<string, (tr: TaxReturn, calc?: CalculationResult) => string | undefined> = {

  filing_status: (tr) => {
    const status = tr.filingStatus ? FILING_STATUS_NAMES[tr.filingStatus] : 'not set';
    const lines = [`Filing status: ${status}`];
    if (tr.livedApartFromSpouse) lines.push('Lived apart from spouse: Yes');
    return lines.join('\n');
  },

  dependents: (tr) => {
    if (!tr.dependents?.length) return 'No dependents entered.';
    const lines = [`${tr.dependents.length} dependent(s):`];
    for (const dep of tr.dependents) {
      const quals: string[] = [];
      if (dep.isStudent) quals.push('student');
      if (dep.isDisabled) quals.push('disabled');
      lines.push(`- ${dep.relationship || 'unknown relationship'}${quals.length ? ` (${quals.join(', ')})` : ''}, lived ${dep.monthsLivedWithYou ?? 12} months`);
    }
    return lines.join('\n');
  },

  w2_income: (tr) => {
    if (!tr.w2Income?.length) return 'No W-2 income entered.';
    const lines = [`${tr.w2Income.length} W-2(s):`];
    for (const w2 of tr.w2Income) {
      lines.push(`- Wages: ${fmt(w2.wages || 0)}, Fed withheld: ${fmt(w2.federalTaxWithheld || 0)}, SS wages: ${fmt(w2.socialSecurityWages || 0)}, State withheld: ${fmt(w2.stateTaxWithheld || 0)}`);
      if (w2.box13?.retirementPlan) lines.push('  Retirement plan: Yes');
    }
    return lines.join('\n');
  },

  '1099nec_income': (tr) => {
    if (!tr.income1099NEC?.length) return 'No 1099-NEC income entered.';
    const lines = [`${tr.income1099NEC.length} 1099-NEC(s):`];
    for (const item of tr.income1099NEC) {
      lines.push(`- Amount: ${fmt(item.amount || 0)}, Fed withheld: ${fmt(item.federalTaxWithheld || 0)}`);
    }
    return lines.join('\n');
  },

  '1099k_income': (tr) => {
    if (!tr.income1099K?.length) return 'No 1099-K income entered.';
    const lines = [`${tr.income1099K.length} 1099-K(s):`];
    for (const item of tr.income1099K) {
      lines.push(`- Gross: ${fmt(item.grossAmount || 0)}, Returns: ${fmt(item.returnsAndAllowances || 0)}, Fed withheld: ${fmt(item.federalTaxWithheld || 0)}`);
    }
    return lines.join('\n');
  },

  '1099int_income': (tr) => {
    if (!tr.income1099INT?.length) return 'No 1099-INT income entered.';
    const lines = [`${tr.income1099INT.length} 1099-INT(s):`];
    for (const item of tr.income1099INT) {
      lines.push(`- Interest: ${fmt(item.amount || 0)}, Tax-exempt: ${fmt(item.taxExemptInterest || 0)}, US bonds: ${fmt(item.usBondInterest || 0)}`);
    }
    return lines.join('\n');
  },

  '1099div_income': (tr) => {
    if (!tr.income1099DIV?.length) return 'No 1099-DIV income entered.';
    const lines = [`${tr.income1099DIV.length} 1099-DIV(s):`];
    for (const item of tr.income1099DIV) {
      lines.push(`- Ordinary: ${fmt(item.ordinaryDividends || 0)}, Qualified: ${fmt(item.qualifiedDividends || 0)}, Cap gains: ${fmt(item.capitalGainDistributions || 0)}, Foreign tax: ${fmt(item.foreignTaxPaid || 0)}`);
    }
    return lines.join('\n');
  },

  '1099b_income': (tr) => {
    if (!tr.income1099B?.length) return 'No 1099-B income entered.';
    let totalProceeds = 0, totalBasis = 0;
    for (const item of tr.income1099B) {
      totalProceeds += item.proceeds || 0;
      totalBasis += item.costBasis || 0;
    }
    const ltCount = tr.income1099B.filter(i => i.isLongTerm).length;
    const stCount = tr.income1099B.length - ltCount;
    const lines = [
      `${tr.income1099B.length} 1099-B transaction(s):`,
      `Total proceeds: ${fmt(totalProceeds)}, Total basis: ${fmt(totalBasis)}, Net gain/loss: ${fmt(totalProceeds - totalBasis)}`,
      `Long-term: ${ltCount}, Short-term: ${stCount}`,
    ];
    return lines.join('\n');
  },

  '1099r_income': (tr) => {
    if (!tr.income1099R?.length) return 'No 1099-R income entered.';
    const lines = [`${tr.income1099R.length} 1099-R(s):`];
    for (const item of tr.income1099R) {
      lines.push(`- Gross: ${fmt(item.grossDistribution || 0)}, Taxable: ${fmt(item.taxableAmount || 0)}, Code: ${item.distributionCode || 'none'}, IRA: ${item.isIRA ? 'Yes' : 'No'}, Roth: ${item.isRothIRA ? 'Yes' : 'No'}`);
    }
    return lines.join('\n');
  },

  '1099g_income': (tr) => {
    if (!tr.income1099G?.length) return 'No 1099-G income entered.';
    const lines = [`${tr.income1099G.length} 1099-G(s):`];
    for (const item of tr.income1099G) {
      lines.push(`- Unemployment: ${fmt(item.unemploymentCompensation || 0)}, Fed withheld: ${fmt(item.federalTaxWithheld || 0)}`);
    }
    return lines.join('\n');
  },

  '1099misc_income': (tr) => {
    if (!tr.income1099MISC?.length) return 'No 1099-MISC income entered.';
    const lines = [`${tr.income1099MISC.length} 1099-MISC(s):`];
    for (const item of tr.income1099MISC) {
      lines.push(`- Other income: ${fmt(item.otherIncome || 0)}, Rents: ${fmt(item.rents || 0)}, Royalties: ${fmt(item.royalties || 0)}`);
    }
    return lines.join('\n');
  },

  k1_income: (tr) => {
    if (!tr.incomeK1?.length) return 'No K-1 income entered.';
    const lines = [`${tr.incomeK1.length} K-1(s):`];
    for (const item of tr.incomeK1) {
      lines.push(`- Type: ${item.entityType || 'unknown'}, Ordinary: ${fmt(item.ordinaryBusinessIncome || 0)}, Rental: ${fmt(item.rentalIncome || 0)}, Guaranteed: ${fmt(item.guaranteedPayments || 0)}`);
    }
    return lines.join('\n');
  },

  rental_income: (tr) => {
    if (!tr.rentalProperties?.length) return 'No rental properties entered.';
    const lines = [`${tr.rentalProperties.length} rental property/ies:`];
    for (let i = 0; i < tr.rentalProperties.length; i++) {
      const prop = tr.rentalProperties[i];
      lines.push(`- [Property ${i + 1}] Type: ${prop.propertyType || 'unknown'}, Rent income: ${fmt(prop.rentalIncome || 0)}, Days rented: ${prop.daysRented ?? 0}, Personal days: ${prop.personalUseDays ?? 0}`);
    }
    return lines.join('\n');
  },

  business_info: (tr) => {
    if (!tr.businesses?.length) return 'No businesses entered.';
    const lines = [`${tr.businesses.length} business(es):`];
    for (let i = 0; i < tr.businesses.length; i++) {
      const biz = tr.businesses[i];
      lines.push(`- Business ${i + 1}, Method: ${biz.accountingMethod}, New: ${biz.didStartThisYear ? 'Yes' : 'No'}`);
    }
    return lines.join('\n');
  },

  expense_categories: (tr) => {
    if (!tr.expenses?.length) return 'No business expenses entered.';
    const byCategory = new Map<string, number>();
    for (const exp of tr.expenses) {
      byCategory.set(exp.category, (byCategory.get(exp.category) || 0) + exp.amount);
    }
    const lines = [`${tr.expenses.length} expense(s) across ${byCategory.size} categories:`];
    for (const [cat, total] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${cat}: ${fmt(total)}`);
    }
    return lines.join('\n');
  },

  home_office: (tr) => {
    const ho = tr.homeOffice;
    if (!ho) return 'No home office entered.';
    const lines = [
      `Method: ${ho.method || 'not set'}`,
      `Square footage (office): ${ho.squareFeet || 0}`,
      `Square footage (home): ${ho.totalHomeSquareFeet || 0}`,
    ];
    return lines.join('\n');
  },

  se_health_insurance: (tr) => {
    const sed = tr.selfEmploymentDeductions;
    if (!sed) return 'No SE health insurance entered.';
    return `SE health insurance premiums: ${fmt(sed.healthInsurancePremiums || 0)}`;
  },

  se_retirement: (tr, calc) => {
    const sed = tr.selfEmploymentDeductions;
    const lines: string[] = ['SE Retirement plan entries:'];

    lines.push(`SEP-IRA: ${fmt(sed?.sepIraContributions || 0)}`);
    lines.push(`Solo 401(k) Employee Deferral: ${fmt(sed?.solo401kEmployeeDeferral || 0)}`);
    lines.push(`Solo 401(k) Roth Portion: ${fmt(sed?.solo401kRothDeferral || 0)}`);
    lines.push(`Solo 401(k) Employer Contribution: ${fmt(sed?.solo401kEmployerContribution || 0)}`);
    lines.push(`SIMPLE IRA: ${fmt(sed?.simpleIraContributions || 0)}`);
    lines.push(`Other Retirement: ${fmt(sed?.otherRetirementContributions || 0)}`);

    // Include computed limits from the calculation result
    const solo = calc?.solo401k;
    if (solo) {
      lines.push('');
      lines.push('Computed limits:');
      lines.push(`Adjusted net SE income: ${fmt(solo.adjustedNetSEIncome)}`);
      lines.push(`Max employee deferral: ${fmt(solo.maxEmployeeDeferral)}${solo.catchUpEligible ? ' (includes catch-up)' : ''}`);
      lines.push(`Max employer contribution: ${fmt(solo.maxEmployerContribution)} (20% of adjusted net SE income)`);
      lines.push(`Applied employee deferral: ${fmt(solo.appliedEmployeeDeferral)}`);
      lines.push(`Applied employer contribution: ${fmt(solo.appliedEmployerContribution)}`);
      lines.push(`Deductible total: ${fmt(solo.deductibleContribution)}`);
      if (solo.warnings?.length) {
        lines.push('Warnings: ' + solo.warnings.join('; '));
      }
    }

    const sep = calc?.sepIRA;
    if (sep && (sed?.sepIraContributions ?? 0) > 0) {
      lines.push('');
      lines.push(`SEP-IRA max: ${fmt(sep.maxContribution)}, Applied: ${fmt(sep.appliedContribution)}`);
    }

    return lines.join('\n');
  },

  deduction_method: (tr) => {
    const method = tr.deductionMethod || 'not set';
    const lines = [`Deduction method: ${method}`];
    if (method === 'itemized' && tr.itemizedDeductions) {
      const id = tr.itemizedDeductions;
      lines.push(`Medical: ${fmt(id.medicalExpenses || 0)}`);
      lines.push(`SALT: ${fmt((id.stateLocalIncomeTax || 0) + (id.realEstateTax || 0) + (id.personalPropertyTax || 0))}`);
      lines.push(`Mortgage interest: ${fmt(id.mortgageInterest || 0)}`);
      lines.push(`Charitable (cash): ${fmt(id.charitableCash || 0)}, Non-cash: ${fmt(id.charitableNonCash || 0)}`);
      lines.push(`Other: ${fmt(id.otherDeductions || 0)}`);
    }
    return lines.join('\n');
  },

  medical_expenses: (tr) => {
    return `Medical expenses: ${fmt(tr.itemizedDeductions?.medicalExpenses || 0)}`;
  },

  salt_deduction: (tr) => {
    const id = tr.itemizedDeductions;
    if (!id) return 'No itemized deductions entered.';
    return [
      `State/local income tax: ${fmt(id.stateLocalIncomeTax || 0)}`,
      `Real estate tax: ${fmt(id.realEstateTax || 0)}`,
      `Personal property tax: ${fmt(id.personalPropertyTax || 0)}`,
      `SALT method: ${id.saltMethod || 'income_tax'}`,
    ].join('\n');
  },

  mortgage_interest_ded: (tr) => {
    const id = tr.itemizedDeductions;
    if (!id) return 'No itemized deductions entered.';
    return `Mortgage interest: ${fmt(id.mortgageInterest || 0)}, Insurance premiums: ${fmt(id.mortgageInsurancePremiums || 0)}, Balance: ${fmt(id.mortgageBalance || 0)}`;
  },

  charitable_deduction: (tr) => {
    const id = tr.itemizedDeductions;
    if (!id) return 'No itemized deductions entered.';
    const lines = [`Charitable cash: ${fmt(id.charitableCash || 0)}, Non-cash: ${fmt(id.charitableNonCash || 0)}`];
    if (id.nonCashDonations?.length) {
      lines.push(`${id.nonCashDonations.length} non-cash donation item(s) detailed`);
    }
    if (id.charitableCarryforward?.length) {
      lines.push(`${id.charitableCarryforward.length} charitable carryforward(s)`);
    }
    return lines.join('\n');
  },

  hsa_contributions: (tr) => {
    const hsa = tr.hsaContribution;
    if (!hsa) return 'No HSA contributions entered.';
    const lines = [
      `Coverage: ${hsa.coverageType || 'not set'}`,
      `Total contributions: ${fmt(hsa.totalContributions || 0)}`,
      `Employer contributions: ${fmt(hsa.employerContributions || 0)}`,
    ];
    if (hsa.hdhpCoverageMonths && hsa.hdhpCoverageMonths < 12) {
      lines.push(`HDHP coverage months: ${hsa.hdhpCoverageMonths}`);
    }
    return lines.join('\n');
  },

  student_loan_ded: (tr) => {
    return `Student loan interest: ${fmt(tr.studentLoanInterest || 0)}`;
  },

  ira_contribution_ded: (tr) => {
    return `IRA contribution: ${fmt(tr.iraContribution || 0)}`;
  },

  estimated_payments: (tr) => {
    return `Estimated tax payments: ${fmt(tr.estimatedPaymentsMade || 0)}`;
  },

  other_income: (tr) => {
    return `Other income: ${fmt(tr.otherIncome || 0)}`;
  },

  child_tax_credit: (tr) => {
    const qualifyingCount = tr.dependents?.filter(d => {
      const rel = d.relationship?.toLowerCase() || '';
      return rel.includes('son') || rel.includes('daughter') || rel.includes('child') || rel.includes('stepchild') || rel.includes('foster');
    }).length || 0;
    return `Dependents: ${tr.dependents?.length || 0}, Potential qualifying children: ${qualifyingCount}`;
  },

  education_credits: (tr) => {
    if (!tr.educationCredits?.length) return 'No education credits entered.';
    const lines = [`${tr.educationCredits.length} education credit entry/ies:`];
    for (const ec of tr.educationCredits) {
      lines.push(`- Type: ${ec.type || 'not set'}, Tuition: ${fmt(ec.tuitionPaid || 0)}, Scholarships: ${fmt(ec.scholarships || 0)}`);
    }
    return lines.join('\n');
  },

  // ── Additional income steps ──

  '1099oid_income': (tr) => {
    if (!tr.income1099OID?.length) return 'No 1099-OID income entered.';
    const lines = [`${tr.income1099OID.length} 1099-OID(s):`];
    for (const item of tr.income1099OID) {
      lines.push(`- OID: ${fmt(item.originalIssueDiscount || 0)}, Other periodic interest: ${fmt(item.otherPeriodicInterest || 0)}`);
    }
    return lines.join('\n');
  },

  '1099da_income': (tr) => {
    if (!tr.income1099DA?.length) return 'No 1099-DA income entered.';
    let totalProceeds = 0, totalBasis = 0;
    for (const item of tr.income1099DA) totalProceeds += item.proceeds || 0, totalBasis += item.costBasis || 0;
    const ltCount = tr.income1099DA.filter(i => i.isLongTerm).length;
    return [`${tr.income1099DA.length} 1099-DA (digital asset) transaction(s):`,
      `Total proceeds: ${fmt(totalProceeds)}, Total basis: ${fmt(totalBasis)}, Net: ${fmt(totalProceeds - totalBasis)}`,
      `Long-term: ${ltCount}, Short-term: ${tr.income1099DA.length - ltCount}`,
    ].join('\n');
  },

  '1099sa_income': (tr) => {
    if (!tr.income1099SA?.length) return 'No 1099-SA income entered.';
    const lines = [`${tr.income1099SA.length} 1099-SA(s):`];
    for (const item of tr.income1099SA) {
      lines.push(`- Gross distribution: ${fmt(item.grossDistribution || 0)}, Code: ${item.distributionCode || 'none'}`);
    }
    return lines.join('\n');
  },

  '1099q_income': (tr) => {
    if (!tr.income1099Q?.length) return 'No 1099-Q income entered.';
    const lines = [`${tr.income1099Q.length} 1099-Q(s):`];
    for (const item of tr.income1099Q) {
      lines.push(`- Gross: ${fmt(item.grossDistribution || 0)}, Earnings: ${fmt(item.earnings || 0)}, Type: ${item.distributionType || 'unknown'}, Qualified expenses: ${fmt(item.qualifiedExpenses || 0)}`);
    }
    return lines.join('\n');
  },

  w2g_income: (tr) => {
    if (!tr.incomeW2G?.length) return 'No W-2G income entered.';
    const lines = [`${tr.incomeW2G.length} W-2G(s):`];
    for (const item of tr.incomeW2G) {
      lines.push(`- Winnings: ${fmt(item.grossWinnings || 0)}, Fed withheld: ${fmt(item.federalTaxWithheld || 0)}, Wager type: ${item.typeOfWager || 'unknown'}`);
    }
    return lines.join('\n');
  },

  '1099c_income': (tr) => {
    if (!tr.income1099C?.length) return 'No 1099-C income entered.';
    const lines = [`${tr.income1099C.length} 1099-C(s):`];
    for (const item of tr.income1099C) {
      lines.push(`- Amount cancelled: ${fmt(item.amountCancelled || 0)}, Event code: ${item.identifiableEventCode || 'none'}`);
    }
    return lines.join('\n');
  },

  ssa1099_income: (tr) => {
    const ssa = tr.incomeSSA1099;
    if (!ssa) return 'No SSA-1099 income entered.';
    return `Social Security benefits: ${fmt(ssa.totalBenefits || 0)}, Fed withheld: ${fmt(ssa.federalTaxWithheld || 0)}`;
  },

  home_sale: (tr) => {
    const hs = tr.homeSale;
    if (!hs) return 'No home sale entered.';
    return [
      `Sale price: ${fmt(hs.salePrice || 0)}`,
      `Cost basis: ${fmt(hs.costBasis || 0)}`,
      `Selling expenses: ${fmt(hs.sellingExpenses || 0)}`,
      `Owned: ${hs.ownedMonths} months, Used as residence: ${hs.usedAsResidenceMonths} months`,
      `Prior exclusion used within 2 years: ${hs.priorExclusionUsedWithin2Years ? 'Yes' : 'No'}`,
    ].join('\n');
  },

  royalty_income: (tr) => {
    if (!tr.royaltyProperties?.length) return 'No royalty properties entered.';
    const lines = [`${tr.royaltyProperties.length} royalty property/ies:`];
    for (const prop of tr.royaltyProperties) {
      lines.push(`- Type: ${prop.royaltyType || 'unknown'}, Income: ${fmt(prop.royaltyIncome || 0)}`);
    }
    return lines.join('\n');
  },

  schedule_f: (tr) => {
    const sf = tr.scheduleF;
    if (!sf) return 'No Schedule F (farm) income entered.';
    const grossIncome = (sf.salesOfLivestock || 0) + (sf.salesOfProducts || 0) + (sf.cooperativeDistributions || 0) +
      (sf.agriculturalProgramPayments || 0) + (sf.cccLoans || 0) + (sf.cropInsuranceProceeds || 0) +
      (sf.customHireIncome || 0) + (sf.otherFarmIncome || 0);
    return [
      `Gross farm income: ${fmt(grossIncome)}`,
      `Farm optional method: ${sf.useFarmOptionalMethod ? 'Yes' : 'No'}`,
    ].join('\n');
  },

  farm_rental: (tr) => {
    if (!tr.farmRentals?.length) return 'No farm rentals entered.';
    const lines = [`${tr.farmRentals.length} farm rental(s):`];
    for (const fr of tr.farmRentals) {
      const totalExp = (fr.expenses?.insurance || 0) + (fr.expenses?.repairs || 0) + (fr.expenses?.taxes || 0) +
        (fr.expenses?.utilities || 0) + (fr.expenses?.depreciation || 0) + (fr.expenses?.other || 0);
      lines.push(`- Income: ${fmt(fr.rentalIncome || 0)}, Expenses: ${fmt(totalExp)}`);
    }
    return lines.join('\n');
  },

  foreign_earned_income: (tr) => {
    const fei = tr.foreignEarnedIncome;
    if (!fei) return 'No foreign earned income entered.';
    return [
      `Foreign earned income: ${fmt(fei.foreignEarnedIncome || 0)}`,
      `Qualifying days: ${fei.qualifyingDays ?? 0}`,
      `Housing expenses: ${fmt(fei.housingExpenses || 0)}`,
    ].join('\n');
  },

  form4797: (tr) => {
    if (!tr.form4797Properties?.length) return 'No Form 4797 property sales entered.';
    const lines = [`${tr.form4797Properties.length} business property sale(s):`];
    for (const prop of tr.form4797Properties) {
      const gain = (prop.salesPrice || 0) - (prop.costBasis || 0);
      lines.push(`- Sales price: ${fmt(prop.salesPrice || 0)}, Basis: ${fmt(prop.costBasis || 0)}, Depreciation: ${fmt(prop.depreciationAllowed || 0)}, Gain/loss: ${fmt(gain)}`);
    }
    return lines.join('\n');
  },

  installment_sale: (tr) => {
    if (!tr.installmentSales?.length) return 'No installment sales entered.';
    const lines = [`${tr.installmentSales.length} installment sale(s):`];
    for (const sale of tr.installmentSales) {
      lines.push(`- Selling price: ${fmt(sale.sellingPrice || 0)}, Basis: ${fmt(sale.costOrBasis || 0)}, Payments this year: ${fmt(sale.paymentsReceivedThisYear || 0)}`);
    }
    return lines.join('\n');
  },

  income_overview: (tr) => {
    const discovery = tr.incomeDiscovery || {};
    const enabled = Object.entries(discovery).filter(([, v]) => v === 'yes').map(([k]) => k);
    if (!enabled.length) return 'No income types enabled yet.';
    return `Enabled income types: ${enabled.join(', ')}`;
  },

  income_summary: (tr, calc) => {
    if (!calc) return undefined;
    const f = calc.form1040;
    return [
      `Total income: ${fmt(f.totalIncome)}`,
      `Total adjustments: ${fmt(f.totalAdjustments)}`,
      `AGI: ${fmt(f.agi)}`,
    ].join('\n');
  },

  // ── Additional self-employment steps ──

  cost_of_goods_sold: (tr) => {
    const cogs = tr.costOfGoodsSold;
    if (!cogs) return 'No cost of goods sold entered.';
    return [
      `Beginning inventory: ${fmt(cogs.beginningInventory || 0)}`,
      `Purchases: ${fmt(cogs.purchases || 0)}`,
      `Cost of labor: ${fmt(cogs.costOfLabor || 0)}`,
      `Materials & supplies: ${fmt(cogs.materialsAndSupplies || 0)}`,
      `Other costs: ${fmt(cogs.otherCosts || 0)}`,
      `Ending inventory: ${fmt(cogs.endingInventory || 0)}`,
    ].join('\n');
  },

  vehicle_expenses: (tr) => {
    const v = tr.vehicle;
    if (!v) return 'No vehicle expenses entered.';
    const lines = [`Method: ${v.method || 'not set'}`];
    if (v.businessMiles) lines.push(`Business miles: ${v.businessMiles.toLocaleString()}`);
    if (v.totalMiles) lines.push(`Total miles: ${v.totalMiles.toLocaleString()}`);
    if (v.commuteMiles) lines.push(`Commute miles: ${v.commuteMiles.toLocaleString()}`);
    if (v.method === 'actual' && v.actualExpenses) lines.push(`Actual expenses: ${fmt(v.actualExpenses)}`);
    return lines.join('\n');
  },

  depreciation_assets: (tr) => {
    if (!tr.depreciationAssets?.length) return 'No depreciation assets entered.';
    const lines = [`${tr.depreciationAssets.length} asset(s):`];
    for (const a of tr.depreciationAssets) {
      lines.push(`- "${a.description}": cost ${fmt(a.cost)}, ${a.propertyClass}-yr class, ${a.businessUsePercent}% business use${a.section179Election ? `, §179: ${fmt(a.section179Election)}` : ''}`);
    }
    return lines.join('\n');
  },

  se_summary: (tr, calc) => {
    if (!calc?.scheduleC) return undefined;
    const sc = calc.scheduleC;
    const se = calc.scheduleSE;
    const lines = [
      `Schedule C net profit: ${fmt(sc.netProfit)}`,
      `Total expenses: ${fmt(sc.totalExpenses)}`,
    ];
    if (sc.homeOfficeDeduction) lines.push(`Home office deduction: ${fmt(sc.homeOfficeDeduction)}`);
    if (se) {
      lines.push(`SE tax: ${fmt(se.totalSETax)}`);
      lines.push(`SE deductible half: ${fmt(se.deductibleHalf)}`);
    }
    return lines.join('\n');
  },

  // ── Additional deduction steps ──

  gambling_losses_ded: (tr) => {
    return `Gambling losses: ${fmt(tr.gamblingLosses || 0)}`;
  },

  itemized_deductions: (tr, calc) => {
    const id = tr.itemizedDeductions;
    if (!id) return 'No itemized deductions entered.';
    const lines = [
      `Medical: ${fmt(id.medicalExpenses || 0)}`,
      `State/local income tax: ${fmt(id.stateLocalIncomeTax || 0)}`,
      `Real estate tax: ${fmt(id.realEstateTax || 0)}`,
      `Personal property tax: ${fmt(id.personalPropertyTax || 0)}`,
      `Mortgage interest: ${fmt(id.mortgageInterest || 0)}`,
      `Charitable (cash): ${fmt(id.charitableCash || 0)}, Non-cash: ${fmt(id.charitableNonCash || 0)}`,
      `Casualty loss: ${fmt(id.casualtyLoss || 0)}`,
      `Other: ${fmt(id.otherDeductions || 0)}`,
    ];
    if (calc?.scheduleA) {
      lines.push(`Schedule A total: ${fmt(calc.scheduleA.totalItemized)}`);
    }
    return lines.join('\n');
  },

  archer_msa: (tr) => {
    const a = tr.archerMSA;
    if (!a) return 'No Archer MSA entered.';
    return [
      `Coverage: ${a.coverageType || 'not set'}`,
      `HDHP deductible: ${fmt(a.hdhpDeductible || 0)}`,
      `Personal contributions: ${fmt(a.personalContributions || 0)}`,
      `Coverage months: ${a.coverageMonths || 0}`,
    ].join('\n');
  },

  educator_expenses_ded: (tr) => {
    return `Educator expenses: ${fmt(tr.educatorExpenses || 0)}`;
  },

  alimony_paid: (tr) => {
    const a = tr.alimony;
    if (!a) return 'No alimony entered.';
    return `Alimony paid: ${fmt(a.totalPaid || 0)}`;
  },

  nol_carryforward: (tr) => {
    return `NOL carryforward: ${fmt(tr.nolCarryforward || 0)}`;
  },

  schedule1a: (tr) => {
    const s = tr.schedule1A;
    if (!s) return 'No Schedule 1-A entries.';
    const lines: string[] = [];
    if (s.qualifiedTips) lines.push(`Qualified tips: ${fmt(s.qualifiedTips)}, Tipped occupation: ${s.isTippedOccupation ? 'Yes' : 'No'}`);
    if (s.qualifiedOvertimePay) lines.push(`Overtime pay: ${fmt(s.qualifiedOvertimePay)}, FLSA non-exempt: ${s.isFLSANonExempt ? 'Yes' : 'No'}`);
    if (s.carLoanInterestPaid) lines.push(`Car loan interest: ${fmt(s.carLoanInterestPaid)}, US assembled: ${s.vehicleAssembledInUS ? 'Yes' : 'No'}`);
    return lines.length ? lines.join('\n') : 'Schedule 1-A: no values entered.';
  },

  investment_interest: (tr) => {
    const ii = tr.investmentInterest;
    if (!ii) return 'No investment interest entered.';
    return [
      `Investment interest paid: ${fmt(ii.investmentInterestPaid || 0)}`,
      `Prior year disallowed: ${fmt(ii.priorYearDisallowed || 0)}`,
      `Elect QD in NII: ${ii.electToIncludeQualifiedDividends ? 'Yes' : 'No'}`,
      `Elect LTCG in NII: ${ii.electToIncludeLTCG ? 'Yes' : 'No'}`,
    ].join('\n');
  },

  form8606: (tr) => {
    const f = tr.form8606;
    if (!f) return 'No Form 8606 entries.';
    return [
      `Nondeductible contributions: ${fmt(f.nondeductibleContributions || 0)}`,
      `Prior year basis: ${fmt(f.priorYearBasis || 0)}`,
      `Traditional IRA balance: ${fmt(f.traditionalIRABalance || 0)}`,
      `Roth conversion amount: ${fmt(f.rothConversionAmount || 0)}`,
    ].join('\n');
  },

  schedule_h: (tr) => {
    const h = tr.householdEmployees;
    if (!h) return 'No household employee info entered.';
    return [
      `Total cash wages: ${fmt(h.totalCashWages || 0)}`,
      `Fed withheld: ${fmt(h.federalTaxWithheld || 0)}`,
      `Number of employees: ${h.numberOfEmployees || 0}`,
    ].join('\n');
  },

  form5329: (tr) => {
    const ec = tr.excessContributions;
    if (!ec) return 'No Form 5329 (excess contributions) entered.';
    const lines: string[] = [];
    if (ec.iraExcessContribution) lines.push(`IRA excess: ${fmt(ec.iraExcessContribution)}`);
    if (ec.hsaExcessContribution) lines.push(`HSA excess: ${fmt(ec.hsaExcessContribution)}`);
    if (ec.esaExcessContribution) lines.push(`ESA excess: ${fmt(ec.esaExcessContribution)}`);
    return lines.length ? lines.join('\n') : 'No excess contributions entered.';
  },

  bad_debt: (tr) => {
    if (!tr.nonbusinessBadDebts?.length) return 'No bad debts entered.';
    const lines = [`${tr.nonbusinessBadDebts.length} nonbusiness bad debt(s):`];
    for (const d of tr.nonbusinessBadDebts) {
      lines.push(`- Amount: ${fmt(d.amountOwed || 0)}`);
    }
    return lines.join('\n');
  },

  casualty_loss: (tr) => {
    if (!tr.casualtyLosses?.length) return 'No casualty losses entered.';
    const lines = [`${tr.casualtyLosses.length} casualty/theft loss(es):`];
    for (const c of tr.casualtyLosses) {
      lines.push(`- FMV before: ${fmt(c.fairMarketValueBefore || 0)}, FMV after: ${fmt(c.fairMarketValueAfter || 0)}, Insurance: ${fmt(c.insuranceReimbursement || 0)}`);
    }
    return lines.join('\n');
  },

  qbi_detail: (tr) => {
    const q = tr.qbiInfo;
    if (!q) return 'No QBI detail entered.';
    const lines = [
      `SSTB: ${q.isSSTB ? 'Yes' : 'No'}`,
      `W-2 wages: ${fmt(q.w2WagesPaidByBusiness || 0)}`,
      `UBIA: ${fmt(q.ubiaOfQualifiedProperty || 0)}`,
    ];
    if (q.businesses?.length) {
      lines.push(`${q.businesses.length} QBI business entry/ies`);
    }
    return lines.join('\n');
  },

  amt_data: (tr) => {
    const a = tr.amtData;
    if (!a) return 'No AMT adjustments entered.';
    const lines: string[] = [];
    if (a.isoExerciseSpread) lines.push(`ISO exercise spread: ${fmt(a.isoExerciseSpread)}`);
    if (a.privateActivityBondInterest) lines.push(`Private activity bond interest: ${fmt(a.privateActivityBondInterest)}`);
    if (a.depreciationAdjustment) lines.push(`Depreciation adjustment: ${fmt(a.depreciationAdjustment)}`);
    if (a.dispositionOfProperty) lines.push(`Disposition of property: ${fmt(a.dispositionOfProperty)}`);
    if (a.passiveActivityLoss) lines.push(`Passive activity loss: ${fmt(a.passiveActivityLoss)}`);
    return lines.length ? lines.join('\n') : 'AMT: no adjustments entered.';
  },

  form8582_data: (tr) => {
    const f = tr.form8582Data;
    if (!f) return 'No Form 8582 data entered.';
    return [
      `Prior year unallowed loss: ${fmt(f.priorYearUnallowedLoss || 0)}`,
      `Real estate professional: ${f.realEstateProfessional ? 'Yes' : 'No'}`,
    ].join('\n');
  },

  deductions_discovery: (tr) => {
    const discovery = tr.incomeDiscovery || {};
    const dedKeys = Object.entries(discovery).filter(([k, v]) => k.startsWith('ded_') && v === 'yes').map(([k]) => k);
    if (!dedKeys.length) return 'No deduction sections enabled yet.';
    return `Enabled deduction sections: ${dedKeys.join(', ')}`;
  },

  deductions_summary: (tr, calc) => {
    if (!calc) return undefined;
    const f = calc.form1040;
    return [
      `Deduction method: ${tr.deductionMethod || 'not set'}`,
      `Deduction amount: ${fmt(f.deductionAmount)}`,
      `Taxable income: ${fmt(f.taxableIncome)}`,
    ].join('\n');
  },

  // ── Additional credit steps ──

  dependent_care: (tr) => {
    const dc = tr.dependentCare;
    if (!dc) return 'No dependent care entered.';
    return [
      `Total expenses: ${fmt(dc.totalExpenses || 0)}`,
      `Qualifying persons: ${dc.qualifyingPersons || 0}`,
      `Employer benefits (W-2 Box 10): ${fmt(dc.employerBenefits || 0)}`,
      `Dependent care FSA: ${fmt(dc.dependentCareFSA || 0)}`,
    ].join('\n');
  },

  savers_credit: (tr) => {
    const sc = tr.saversCredit;
    if (!sc) return 'No Saver\'s Credit info entered.';
    return `Total retirement contributions: ${fmt(sc.totalContributions || 0)}`;
  },

  clean_energy: (tr) => {
    const ce = tr.cleanEnergy;
    if (!ce) return 'No clean energy entries.';
    const lines: string[] = [];
    if (ce.solarElectric) lines.push(`Solar electric: ${fmt(ce.solarElectric)}`);
    if (ce.solarWaterHeating) lines.push(`Solar water heating: ${fmt(ce.solarWaterHeating)}`);
    if (ce.smallWindEnergy) lines.push(`Small wind: ${fmt(ce.smallWindEnergy)}`);
    if (ce.geothermalHeatPump) lines.push(`Geothermal: ${fmt(ce.geothermalHeatPump)}`);
    if (ce.batteryStorage) lines.push(`Battery storage: ${fmt(ce.batteryStorage)}`);
    if (ce.fuelCell) lines.push(`Fuel cell: ${fmt(ce.fuelCell)}`);
    if (ce.priorYearCarryforward) lines.push(`Prior year carryforward: ${fmt(ce.priorYearCarryforward)}`);
    return lines.length ? lines.join('\n') : 'No clean energy amounts entered.';
  },

  ev_credit: (tr) => {
    const ev = tr.evCredit;
    if (!ev) return 'No EV credit entered.';
    return [
      `New vehicle: ${ev.isNewVehicle ? 'Yes' : 'No'}`,
      `Purchase price: ${fmt(ev.purchasePrice || 0)}`,
      `MSRP: ${fmt(ev.vehicleMSRP || 0)}`,
      `Final assembly US: ${ev.finalAssemblyUS ? 'Yes' : 'No'}`,
      `Battery req met: ${ev.meetsBatteryComponentReq ? 'Yes' : 'No'}`,
      `Mineral req met: ${ev.meetsMineralReq ? 'Yes' : 'No'}`,
    ].join('\n');
  },

  ev_refueling: (tr) => {
    const evr = tr.evRefuelingCredit;
    if (!evr?.properties?.length) return 'No EV refueling property entered.';
    const lines = [`${evr.properties.length} refueling property/ies:`];
    for (const p of evr.properties) {
      lines.push(`- Cost: ${fmt(p.cost || 0)}, Business use: ${p.isBusinessUse ? 'Yes' : 'No'}`);
    }
    return lines.join('\n');
  },

  energy_efficiency: (tr) => {
    const ee = tr.energyEfficiency;
    if (!ee) return 'No energy efficiency entries.';
    const lines: string[] = [];
    if (ee.heatPump) lines.push(`Heat pump: ${fmt(ee.heatPump)}`);
    if (ee.centralAC) lines.push(`Central AC: ${fmt(ee.centralAC)}`);
    if (ee.waterHeater) lines.push(`Water heater: ${fmt(ee.waterHeater)}`);
    if (ee.furnaceBoiler) lines.push(`Furnace/boiler: ${fmt(ee.furnaceBoiler)}`);
    if (ee.insulation) lines.push(`Insulation: ${fmt(ee.insulation)}`);
    if (ee.windows) lines.push(`Windows: ${fmt(ee.windows)}`);
    if (ee.doors) lines.push(`Doors: ${fmt(ee.doors)}`);
    if (ee.electricalPanel) lines.push(`Electrical panel: ${fmt(ee.electricalPanel)}`);
    if (ee.homeEnergyAudit) lines.push(`Home energy audit: ${fmt(ee.homeEnergyAudit)}`);
    return lines.length ? lines.join('\n') : 'No energy efficiency amounts entered.';
  },

  scholarship_credit: (tr) => {
    const sc = tr.scholarshipCredit;
    if (!sc) return 'No scholarship credit entered.';
    return `Scholarship credit contributions: ${fmt(sc.contributionAmount || 0)}`;
  },

  adoption_credit: (tr) => {
    const ac = tr.adoptionCredit;
    if (!ac) return 'No adoption credit entered.';
    return [
      `Qualified expenses: ${fmt(ac.qualifiedExpenses || 0)}`,
      `Children: ${ac.numberOfChildren || 1}`,
      `Special needs: ${ac.isSpecialNeeds ? 'Yes' : 'No'}`,
    ].join('\n');
  },

  premium_tax_credit: (tr) => {
    const ptc = tr.premiumTaxCredit;
    if (!ptc) return 'No Premium Tax Credit entered.';
    const lines = [`${ptc.forms1095A?.length || 0} Form 1095-A(s), Family size: ${ptc.familySize || 0}`];
    for (const f of ptc.forms1095A || []) {
      const totalPremium = f.enrollmentPremiums?.reduce((s, v) => s + v, 0) || 0;
      const totalAPTC = f.advancePTC?.reduce((s, v) => s + v, 0) || 0;
      lines.push(`- Annual premium: ${fmt(totalPremium)}, Advance PTC: ${fmt(totalAPTC)}`);
    }
    return lines.join('\n');
  },

  elderly_disabled: (tr) => {
    const sr = tr.scheduleR;
    if (!sr) return 'No elderly/disabled credit info entered.';
    return [
      `Age 65+: ${sr.isAge65OrOlder ? 'Yes' : 'No'}`,
      `Disabled: ${sr.isDisabled ? 'Yes' : 'No'}`,
      `Disability income: ${fmt(sr.taxableDisabilityIncome || 0)}`,
      `Nontaxable SS: ${fmt(sr.nontaxableSocialSecurity || 0)}`,
      `Nontaxable pensions: ${fmt(sr.nontaxablePensions || 0)}`,
    ].join('\n');
  },

  prior_year_amt_credit: (tr) => {
    const f = tr.form8801;
    if (!f) return 'No prior year AMT credit entered.';
    return `Net prior year minimum tax: ${fmt(f.netPriorYearMinimumTax || 0)}, Prior year credit carryforward: ${fmt(f.priorYearCreditCarryforward || 0)}`;
  },

  foreign_tax_credit: (tr) => {
    if (!tr.foreignTaxCreditCategories?.length) return 'No foreign tax credit categories entered.';
    const lines = [`${tr.foreignTaxCreditCategories.length} category/ies:`];
    for (const cat of tr.foreignTaxCreditCategories) {
      lines.push(`- ${cat.category}: Tax paid: ${fmt(cat.foreignTaxPaid || 0)}, Foreign source income: ${fmt(cat.foreignSourceIncome || 0)}`);
    }
    return lines.join('\n');
  },

  credits_overview: (tr) => {
    const discovery = tr.incomeDiscovery || {};
    const creditKeys = Object.entries(discovery).filter(([k, v]) => !k.startsWith('ded_') && !k.startsWith('1099') && !k.startsWith('w2') && !k.startsWith('k1') && v === 'yes').map(([k]) => k);
    if (!creditKeys.length) return 'No credit sections enabled yet.';
    return `Enabled credit sections: ${creditKeys.join(', ')}`;
  },

  credits_summary: (tr, calc) => {
    if (!calc) return undefined;
    const c = calc.credits;
    const lines = [`Total credits: ${fmt(c.totalCredits)}`];
    if (c.childTaxCredit) lines.push(`Child tax credit: ${fmt(c.childTaxCredit)}`);
    if (c.actcCredit) lines.push(`Additional CTC: ${fmt(c.actcCredit)}`);
    if (c.eitcCredit) lines.push(`EITC: ${fmt(c.eitcCredit)}`);
    if (c.dependentCareCredit) lines.push(`Dependent care: ${fmt(c.dependentCareCredit)}`);
    if (c.educationCredit) lines.push(`Education: ${fmt(c.educationCredit)}`);
    if (c.saversCredit) lines.push(`Saver's: ${fmt(c.saversCredit)}`);
    if (c.cleanEnergyCredit) lines.push(`Clean energy: ${fmt(c.cleanEnergyCredit)}`);
    if (c.evCredit) lines.push(`EV: ${fmt(c.evCredit)}`);
    if (c.energyEfficiencyCredit) lines.push(`Energy efficiency: ${fmt(c.energyEfficiencyCredit)}`);
    if (c.foreignTaxCredit) lines.push(`Foreign tax: ${fmt(c.foreignTaxCredit)}`);
    if (c.premiumTaxCredit) lines.push(`Premium tax: ${fmt(c.premiumTaxCredit)}`);
    return lines.join('\n');
  },

  // ── State steps ──

  state_overview: (tr) => {
    if (!tr.stateReturns?.length) return 'No states selected for filing.';
    return `Filing in ${tr.stateReturns.length} state(s): ${tr.stateReturns.map(s => s.stateCode).join(', ')}`;
  },

  state_details: (tr, calc) => {
    if (!calc?.stateResults?.length) return 'No state results computed.';
    const lines = [`${calc.stateResults.length} state return(s):`];
    for (const sr of calc.stateResults) {
      lines.push(`- ${sr.stateName} (${sr.stateCode}): State tax: ${fmt(sr.totalStateTax)}, Withholding: ${fmt(sr.stateWithholding)}, ${sr.stateRefundOrOwed >= 0 ? 'Refund' : 'Owed'}: ${fmt(Math.abs(sr.stateRefundOrOwed))}`);
    }
    return lines.join('\n');
  },

  // ── Review/Finish steps ──

  personal_info: (tr) => {
    const lines: string[] = [];
    if (tr.occupation) lines.push(`Occupation: ${tr.occupation}`);
    if (tr.isLegallyBlind) lines.push('Legally blind: Yes');
    if (tr.isActiveDutyMilitary) lines.push('Active duty military: Yes');
    if (tr.canBeClaimedAsDependent) lines.push('Can be claimed as dependent: Yes');
    if (tr.digitalAssetActivity) lines.push('Digital asset activity: Yes');
    return lines.length ? lines.join('\n') : 'Personal info entered (no notable flags).';
  },

  tax_summary: (tr, calc) => {
    if (!calc) return undefined;
    const f = calc.form1040;
    return [
      `Total income: ${fmt(f.totalIncome)}`,
      `AGI: ${fmt(f.agi)}`,
      `Taxable income: ${fmt(f.taxableIncome)}`,
      `Income tax: ${fmt(f.incomeTax)}`,
      `Total tax: ${fmt(f.totalTax)}`,
      `Total credits: ${fmt(f.totalCredits)}`,
      `Total payments: ${fmt(f.totalWithholding)}`,
      f.refundAmount > 0 ? `Refund: ${fmt(f.refundAmount)}` : `Amount owed: ${fmt(f.amountOwed)}`,
      `Effective rate: ${(f.effectiveTaxRate * 100).toFixed(1)}%`,
    ].join('\n');
  },

  refund_payment: (tr, calc) => {
    if (!calc) return undefined;
    const f = calc.form1040;
    return [
      f.refundAmount > 0 ? `Federal refund: ${fmt(f.refundAmount)}` : `Federal amount owed: ${fmt(f.amountOwed)}`,
      `Total withholding: ${fmt(f.totalWithholding)}`,
      `Estimated payments: ${fmt(tr.estimatedPaymentsMade || 0)}`,
    ].join('\n');
  },

  // ── Standalone tool views ──

  explain_taxes: (tr, calc) => {
    if (!calc) return 'User is on the "Explain My Taxes" page but no calculation is available yet.';
    const f = calc.form1040;
    const isRefund = f.refundAmount > 0;
    const lines = [
      'User is viewing the "Explain My Taxes" page — an interactive breakdown of their entire 2025 federal tax calculation.',
      'This page shows: Key Insights, Tax Flow diagram, Tax Bracket Breakdown, Effective vs. Marginal Tax Rate, and an expandable Calculation Audit Trail.',
      '',
      `Result: ${isRefund ? 'Estimated Refund' : 'Estimated Tax Owed'}: ${fmt(isRefund ? f.refundAmount : f.amountOwed)}`,
      `Total income: ${fmt(f.totalIncome)}`,
      `Adjustments: ${fmt(f.totalAdjustments)}`,
      `AGI: ${fmt(f.agi)}`,
      `Deduction: ${fmt(f.deductionAmount)} (${tr.deductionMethod === 'itemized' ? 'itemized' : 'standard'})`,
      `Taxable income: ${fmt(f.taxableIncome)}`,
      `Income tax: ${fmt(f.incomeTax)}`,
      `Self-employment tax: ${fmt(f.seTax)}`,
      `Total credits: ${fmt(f.totalCredits)}`,
      `Total tax: ${fmt(f.totalTax)}`,
      `Total payments/withholding: ${fmt(f.totalPayments)}`,
      `Effective tax rate: ${(f.effectiveTaxRate * 100).toFixed(1)}%`,
      `Marginal tax rate: ${(f.marginalTaxRate * 100).toFixed(0)}%`,
    ];
    if (f.taxableIncome <= 0) {
      lines.push('', 'Note: Taxable income is $0 — deductions exceed income, so no bracket breakdown applies.');
    }
    if (f.amtAmount > 0) {
      lines.push(`AMT: ${fmt(f.amtAmount)}`);
    }
    if (calc.stateResults?.length) {
      lines.push('');
      for (const sr of calc.stateResults) {
        if (sr.totalStateTax > 0 || sr.localTax > 0) {
          lines.push(`State ${sr.stateCode}: tax ${fmt(sr.totalStateTax)}, ${sr.stateRefundOrOwed >= 0 ? 'refund' : 'owed'} ${fmt(Math.abs(sr.stateRefundOrOwed))}`);
        }
      }
    }
    return lines.join('\n');
  },

  tax_scenario_lab: (_tr, _calc) => {
    return 'User is viewing the "Tax Scenario Lab" — a what-if tool to compare scenarios. See scenarioLabContext for details on their scenarios.';
  },

  audit_risk: (_tr, _calc) => {
    return 'User is viewing the "Audit Risk" page. See auditRiskContext for their risk assessment details.';
  },

  yoy_comparison: (_tr, _calc) => {
    return 'User is viewing the "Year-over-Year Comparison" page. See yearOverYearContext for the prior vs. current year comparison.';
  },

  tax_calendar: (_tr, _calc) => {
    return 'User is viewing the "Tax Calendar" page. See taxCalendarContext for their personalized deadlines.';
  },

  expense_scanner: (_tr, _calc) => {
    return 'User is viewing the "Smart Expense Scanner" page where they upload bank/credit card transaction exports and TelosAI categorizes them by tax relevance (business expenses, medical, charitable, home office, etc.). See deductionFinderContext for categorization results.';
  },

  document_inventory: (_tr, _calc) => {
    return 'User is viewing the "Document Inventory" page. See documentInventoryContext for completeness status.';
  },

  file_extension: (_tr, _calc) => {
    return 'User is viewing the "File an Extension" page (Form 4868). They can request an automatic 6-month extension for their federal tax return.';
  },
};

// ─── Audit Risk Context ──────────────────────────

/**
 * Build a PII-safe summary of the audit risk assessment.
 * Always included when there are triggered risk factors, regardless of step.
 * Lets the AI discuss risk factors and mitigation strategies.
 */
function buildAuditRiskContext(
  taxReturn: TaxReturn,
  calculation?: CalculationResult | null,
): string | undefined {
  if (!calculation) return undefined;

  try {
    const assessment = assessAuditRisk(taxReturn, calculation);
    if (!assessment.triggeredFactors.length) return undefined;

    const lines: string[] = [];
    lines.push(`Audit Risk Score: ${assessment.score}/${assessment.maxPossibleScore} (${assessment.level.toUpperCase()})`);
    lines.push(assessment.summary);
    lines.push('');
    lines.push(`${assessment.triggeredFactors.length} risk factor(s):`);

    for (const factor of assessment.triggeredFactors) {
      lines.push(`\n[${factor.category.toUpperCase()}] ${factor.label} (+${factor.points} pts)`);
      lines.push(`  Why: ${factor.explanation}`);
      lines.push(`  Mitigation: ${factor.mitigation}`);
    }

    return lines.join('\n');
  } catch {
    return undefined;
  }
}

// ─── Tax Calendar Context ─────────────────────────

/**
 * Build a summary of upcoming tax deadlines.
 * Lets the AI answer "when is my next payment due?" or "what deadlines do I have?"
 */
function buildTaxCalendarContext(
  taxReturn: TaxReturn,
  calculation?: CalculationResult | null,
): string | undefined {
  try {
    const calendar = calculateTaxCalendar(taxReturn, calculation ?? undefined);
    const applicable = calendar.deadlines.filter(d => d.applicable);
    if (!applicable.length) return undefined;

    const lines: string[] = [];

    if (calendar.nextDeadline) {
      lines.push(`Next deadline: ${calendar.nextDeadline.label} — ${calendar.nextDeadline.date} (${calendar.nextDeadline.status})`);
      lines.push('');
    }

    lines.push('All applicable deadlines:');
    for (const d of applicable) {
      let line = `- ${d.label}: ${d.date} [${d.status}]`;
      if (d.amount) line += ` — ${formatRounded(d.amount)}`;
      if (d.notes) line += ` (${d.notes})`;
      lines.push(line);
    }

    return lines.join('\n');
  } catch {
    return undefined;
  }
}

// ─── Document Inventory Context ───────────────────

/**
 * Build a summary of document/form completeness.
 * Lets the AI answer "what's missing?" or "is my return complete?"
 */
function buildDocumentInventoryContext(taxReturn: TaxReturn): string | undefined {
  try {
    const inventory = buildDocumentInventory(taxReturn);

    const lines: string[] = [];
    lines.push(`Overall completeness: ${inventory.overallCompleteness}%`);
    lines.push(`Forms entered: ${inventory.totalFormsEntered}, Pending: ${inventory.totalFormsPending}`);

    // Pending groups (discovered but not entered)
    if (inventory.pendingGroups.length > 0) {
      lines.push('');
      lines.push('Missing forms (marked "yes" but no entries):');
      for (const g of inventory.pendingGroups) {
        lines.push(`- ${g.formLabel} (${g.formType})`);
      }
    }

    // Incomplete entries
    const incompleteEntries = inventory.incomeGroups
      .flatMap(g => g.entries.filter(e => e.status === 'missing_required' || e.status === 'partial')
        .map(e => ({ group: g.formLabel, ...e })));
    if (incompleteEntries.length > 0) {
      lines.push('');
      lines.push('Incomplete entries:');
      for (const e of incompleteEntries.slice(0, 10)) {
        lines.push(`- ${e.group} "${e.label}": ${e.status} (${e.filledFields}/${e.totalFields} fields${e.missingRequired.length ? `, missing: ${e.missingRequired.join(', ')}` : ''})`);
      }
      if (incompleteEntries.length > 10) {
        lines.push(`  ...and ${incompleteEntries.length - 10} more`);
      }
    }

    // Non-income section issues
    const sectionIssues = inventory.nonIncomeSections.filter(s => s.issues.length > 0);
    if (sectionIssues.length > 0) {
      lines.push('');
      lines.push('Section issues:');
      for (const s of sectionIssues) {
        for (const issue of s.issues) {
          lines.push(`- [${s.label}] ${issue}`);
        }
      }
    }

    return lines.join('\n');
  } catch {
    return undefined;
  }
}

// ─── Year-over-Year Context ──────────────────────

/**
 * Build a summary of prior year vs. current year comparison.
 * Lets the AI answer "how do my taxes compare to last year?"
 */
function buildYearOverYearContext(
  taxReturn: TaxReturn,
  calculation?: CalculationResult | null,
): string | undefined {
  const prior = taxReturn.priorYearSummary;
  if (!prior || !calculation) return undefined;

  const curr = calculation.form1040;
  const lines: string[] = [];
  lines.push(`Prior year (${prior.taxYear}) vs. Current year (2025):`);
  lines.push(`Source: ${prior.source}${prior.providerName ? ` (${prior.providerName})` : ''}`);
  lines.push('');

  const compare = (label: string, priorVal: number, currVal: number) => {
    const diff = currVal - priorVal;
    const sign = diff >= 0 ? '+' : '';
    lines.push(`${label}: ${formatRounded(priorVal)} → ${formatRounded(currVal)} (${sign}${formatRounded(diff)})`);
  };

  compare('Total income', prior.totalIncome, curr.totalIncome);
  compare('AGI', prior.agi, curr.agi);
  compare('Taxable income', prior.taxableIncome, curr.taxableIncome);
  compare('Deduction', prior.deductionAmount, curr.deductionAmount);
  compare('Total tax', prior.totalTax, curr.totalTax);
  compare('Total credits', prior.totalCredits, curr.totalCredits);

  const priorNet = prior.refundAmount > 0 ? prior.refundAmount : -prior.amountOwed;
  const currNet = curr.refundAmount > 0 ? curr.refundAmount : -curr.amountOwed;
  compare('Refund/Owed', priorNet, currNet);

  compare('Effective rate', prior.effectiveTaxRate * 100, curr.effectiveTaxRate * 100);

  return lines.join('\n');
}
