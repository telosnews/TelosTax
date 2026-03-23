import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Receipt, ShieldCheck, AlertTriangle, DollarSign, ChevronDown, ChevronUp, BarChart3, ExternalLink, Info } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import EstimatedPaymentsChart from '../charts/EstimatedPaymentsChart';

const QUARTER_LABELS = [
  { label: 'Q1 Payment', due: 'Due Apr 15, 2025', helpKey: 'Q1 Payment' },
  { label: 'Q2 Payment', due: 'Due Jun 16, 2025', helpKey: 'Q2 Payment' },
  { label: 'Q3 Payment', due: 'Due Sep 15, 2025', helpKey: 'Q3 Payment' },
  { label: 'Q4 Payment', due: 'Due Jan 15, 2026', helpKey: 'Q4 Payment' },
] as const;

const AI_PERIOD_LABELS = [
  { label: 'Through Mar 31', period: 'Jan 1 – Mar 31' },
  { label: 'Through May 31', period: 'Jan 1 – May 31' },
  { label: 'Through Aug 31', period: 'Jan 1 – Aug 31' },
  { label: 'Through Dec 31', period: 'Jan 1 – Dec 31 (full year)' },
] as const;

export default function EstimatedPaymentsStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  const [showAnnualized, setShowAnnualized] = useState(false);
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['estimated_payments'];
  const quarters = taxReturn.estimatedQuarterlyPayments || [0, 0, 0, 0];
  const totalEstimated = quarters.reduce((s, q) => s + (q || 0), 0);

  const updateQuarter = (index: number, value: number | undefined) => {
    const updated = [...quarters] as [number, number, number, number];
    updated[index] = value || 0;
    updateField('estimatedQuarterlyPayments', updated);
    // Keep legacy total in sync for backward compat
    updateField('estimatedPaymentsMade', updated.reduce((s, q) => s + q, 0));
  };

  // Safe harbor / penalty status from the engine
  const penaltyResult = calculation?.estimatedTaxPenalty;
  const form1040 = calculation?.form1040;
  const totalWithholding = form1040?.totalWithholding || 0;
  const totalPayments = totalEstimated + totalWithholding;
  const hasPriorYear = taxReturn.priorYearTax !== undefined && taxReturn.priorYearTax >= 0;

  // Determine safe harbor display
  const getSafeHarborStatus = () => {
    if (!form1040) return null;

    const taxAfterCredits = form1040.taxAfterCredits || 0;
    const taxOwed = taxAfterCredits - totalPayments;

    // Check $1,000 threshold first (uses current data, not penalty result)
    if (taxOwed < 1000) {
      return { type: 'safe' as const, message: 'Under $1,000 threshold — no penalty expected' };
    }

    // If penalty result exists (requires priorYearTax to be set)
    if (penaltyResult) {
      if (penaltyResult.penalty === 0) {
        return { type: 'safe' as const, message: 'Safe harbor met — no underpayment penalty' };
      }
      return {
        type: 'warning' as const,
        message: `Estimated underpayment penalty: $${penaltyResult.penalty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      };
    }

    // No penalty result yet — need prior year tax
    if (!hasPriorYear && totalEstimated > 0) {
      return { type: 'info' as const, message: 'Enter your prior year tax below to check safe harbor status' };
    }

    return null;
  };

  const safeHarbor = getSafeHarborStatus();

  const ai = taxReturn.annualizedIncome || { cumulativeIncome: [0, 0, 0, 0] as [number, number, number, number] };

  const updateAI = (field: 'cumulativeIncome' | 'cumulativeWithholding', index: number, value: number) => {
    const arr = [...(ai[field] || [0, 0, 0, 0])] as [number, number, number, number];
    arr[index] = value || 0;
    updateField('annualizedIncome', { ...ai, [field]: arr });
  };

  const hasAnnualizedData = ai.cumulativeIncome?.some((v: number) => v > 0) ||
    ai.cumulativeWithholding?.some((v: number) => v > 0);

  const save = async () => {
    await updateReturn(returnId, {
      estimatedQuarterlyPayments: taxReturn.estimatedQuarterlyPayments,
      estimatedPaymentsMade: taxReturn.estimatedPaymentsMade,
      priorYearTax: taxReturn.priorYearTax,
      annualizedIncome: taxReturn.annualizedIncome,
    });
  };

  return (
    <div>
      <StepWarningsBanner stepId="estimated_payments" />

      <SectionIntro
        icon={<Receipt className="w-8 h-8" />}
        title="Estimated Tax Payments"
        description="Enter the quarterly estimated tax payments you made for tax year 2025 (Form 1040-ES)."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Per-Quarter Payments */}
      <div className="card mt-6">
        <div className="flex items-center gap-3 mb-3">
          <DollarSign className="w-5 h-5 text-telos-blue-400" />
          <h3 className="font-medium text-slate-200">Quarterly Payments</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Enter the amount you paid for each quarter. Leave a quarter at $0 if you didn't make a payment.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {QUARTER_LABELS.map((q, i) => (
            <FormField
              key={q.helpKey}
              label={q.label}
              tooltip={help?.fields[q.helpKey]?.tooltip}
              irsRef={help?.fields[q.helpKey]?.irsRef}
              optional
              helpText={q.due}
            >
              <CurrencyInput
                value={quarters[i] || undefined}
                onChange={(v) => updateQuarter(i, v)}
              />
            </FormField>
          ))}
        </div>

        {/* Total */}
        {totalEstimated > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Total Estimated Payments</span>
            <span className="text-lg font-semibold text-telos-blue-300">
              ${totalEstimated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* Quarterly payments chart */}
      <EstimatedPaymentsChart quarters={quarters as [number, number, number, number]} quarterlyDetail={penaltyResult?.quarterlyDetail} />

      {/* Prior Year Tax */}
      <div className="card mt-4">
        <div className="flex items-center gap-3 mb-3">
          <Receipt className="w-5 h-5 text-telos-blue-400" />
          <h3 className="font-medium text-slate-200">Prior Year Tax Liability</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Your total tax from your 2024 return. This is used to determine if you qualify for the safe harbor exception to avoid an underpayment penalty.
        </p>
        <FormField
          label="Prior Year Tax Liability (2024)"
          tooltip={help?.fields['Prior Year Tax Liability']?.tooltip}
          irsRef={help?.fields['Prior Year Tax Liability']?.irsRef}
          optional
          helpText="Form 1040, Line 24 from your 2024 return"
        >
          <CurrencyInput
            value={taxReturn.priorYearTax}
            onChange={(v) => updateField('priorYearTax', v)}
          />
        </FormField>
      </div>

      {/* Safe Harbor / Penalty Status */}
      {safeHarbor && (
        <div className={`mt-4 p-4 rounded-lg border flex items-start gap-3 ${
          safeHarbor.type === 'safe'
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : safeHarbor.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-slate-500/10 border-slate-600'
        }`}>
          {safeHarbor.type === 'safe' ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : safeHarbor.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Receipt className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-medium ${
              safeHarbor.type === 'safe' ? 'text-emerald-300' : safeHarbor.type === 'warning' ? 'text-amber-300' : 'text-slate-300'
            }`}>
              {safeHarbor.message}
            </p>
            {safeHarbor.type === 'safe' && penaltyResult && penaltyResult.requiredAnnualPayment > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Required annual payment: ${penaltyResult.requiredAnnualPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — your payments of ${penaltyResult.totalPaymentsMade.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} meet the threshold.
              </p>
            )}
            {safeHarbor.type === 'warning' && penaltyResult && (
              <p className="text-xs text-slate-400 mt-1">
                Required annual payment: ${penaltyResult.requiredAnnualPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — underpayment of ${penaltyResult.underpaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
                {penaltyResult.usedAnnualizedMethod && ' (Annualized income method applied for lower penalty.)'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Annualized Income (Form 2210 Schedule AI) */}
      <div className="mt-6 rounded-lg border border-slate-700 overflow-hidden">
        <button
          onClick={() => setShowAnnualized(!showAnnualized)}
          className="w-full px-4 py-3 flex items-center gap-3 bg-surface-800 hover:bg-surface-700 transition-colors"
        >
          <BarChart3 className="w-5 h-5 text-telos-blue-400" />
          <div className="flex-1 text-left">
            <span className="font-medium text-sm text-slate-200">Annualized Income Method</span>
            {hasAnnualizedData && (
              <span className="ml-2 text-xs text-telos-orange-400 bg-telos-orange-500/10 px-2 py-0.5 rounded-full">Active</span>
            )}
          </div>
          {showAnnualized ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {showAnnualized && (
          <div className="px-4 py-4 bg-surface-900 border-t border-slate-700">
            <p className="text-sm text-slate-400 mb-4">
              If your income varied significantly throughout the year (e.g., large bonus or seasonal business), the annualized income method may reduce your underpayment penalty. Enter cumulative taxable income through the end of each period.
            </p>

            <h4 className="text-sm font-medium text-slate-300 mb-2">Cumulative Taxable Income</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AI_PERIOD_LABELS.map((p, i) => (
                <FormField key={p.label} label={p.label} helpText={p.period} optional tooltip={help?.fields[p.label]?.tooltip} irsRef={help?.fields[p.label]?.irsRef}>
                  <CurrencyInput
                    value={ai.cumulativeIncome?.[i] || undefined}
                    onChange={(v) => updateAI('cumulativeIncome', i, v || 0)}
                  />
                </FormField>
              ))}
            </div>

            <h4 className="text-sm font-medium text-slate-300 mt-4 mb-2">Cumulative Withholding (Optional)</h4>
            <p className="text-xs text-slate-400 mb-3">
              Only fill this in if your withholding was uneven across the year. Otherwise we'll assume it was withheld evenly.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AI_PERIOD_LABELS.map((p, i) => (
                <FormField key={`wh-${p.label}`} label={p.label} optional tooltip={help?.fields[p.label]?.tooltip} irsRef={help?.fields[p.label]?.irsRef}>
                  <CurrencyInput
                    value={ai.cumulativeWithholding?.[i] || undefined}
                    onChange={(v) => updateAI('cumulativeWithholding', i, v || 0)}
                  />
                </FormField>
              ))}
            </div>

            {penaltyResult?.usedAnnualizedMethod && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                The annualized method produced a lower penalty (${penaltyResult.annualizedPenalty?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} vs ${penaltyResult.regularPenalty?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} regular method).
              </div>
            )}
            <a
              href="https://www.irs.gov/forms-pubs/about-form-2210"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Learn more on IRS.gov
            </a>
          </div>
        )}
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
