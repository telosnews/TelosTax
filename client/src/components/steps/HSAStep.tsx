import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { HeartPulse, AlertTriangle, ExternalLink, CircleDollarSign, Info } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';
import type { HSAExcessWithdrawal } from '@telostax/engine';

export default function HSAStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['adjustments'];

  const save = async () => {
    await updateReturn(returnId, {
      hsaDeduction: taxReturn.hsaDeduction,
      hsaContribution: taxReturn.hsaContribution,
      hsaExcessWithdrawal: taxReturn.hsaExcessWithdrawal,
    });
  };

  // HSA limit computation
  const baseLimit = taxReturn.hsaContribution?.coverageType === 'family' ? 8550 : 4300;
  const months = Math.min(12, Math.max(1, taxReturn.hsaContribution?.hdhpCoverageMonths ?? 12));
  const proratedLimit = months === 12 ? baseLimit : Math.round(baseLimit * months / 12);
  const catchUp = (taxReturn.hsaContribution?.catchUpContributions || 0) > 0 ? 1000 : 0;
  const maxAllowed = proratedLimit + catchUp;
  const totalContributions = taxReturn.hsaDeduction || 0;
  const excessAmount = Math.max(0, totalContributions - maxAllowed);
  const isExcess = excessAmount > 0;

  const withdrawal = taxReturn.hsaExcessWithdrawal;
  const withdrawalChoice = withdrawal?.choice || 'none';

  const setWithdrawal = (update: Partial<HSAExcessWithdrawal>) => {
    updateField('hsaExcessWithdrawal', {
      ...withdrawal,
      choice: withdrawal?.choice || 'none',
      ...update,
    });
  };

  // Compute penalty based on choice
  const effectiveExcess = withdrawalChoice === 'full'
    ? 0
    : withdrawalChoice === 'partial'
      ? Math.max(0, excessAmount - (withdrawal?.withdrawalAmount || 0))
      : excessAmount;
  const penalty = Math.round(effectiveExcess * 0.06);

  return (
    <div>
      <StepWarningsBanner stepId="hsa_contributions" />

      <SectionIntro
        icon={<HeartPulse className="w-8 h-8" />}
        title="HSA Contributions"
        description="Health Savings Account contributions are tax-deductible. 2025 limits: $4,300 (individual) / $8,550 (family)."
      />

      <WhatsNewCard items={[
        { title: 'HSA Limits Increased', description: 'Self-only coverage: $4,300 (up from $4,150). Family coverage: $8,550 (up from $8,300). Catch-up contribution for age 55+ remains $1,000.' },
        { title: 'HDHP Minimum Deductible', description: 'Self-only: $1,650 (up from $1,600). Family: $3,300 (up from $3,200). Out-of-pocket max: $8,300/$16,600.' },
      ]} />

      <CalloutCard variant="info" title="HSA Contribution Limits (2025)" irsUrl="https://www.irs.gov/publications/p969">
        Self-only coverage: $4,300. Family coverage: $8,550. Additional $1,000 catch-up if age 55+. Contributions are prorated for partial-year HDHP coverage. Employer contributions (W-2 Box 12, Code W) count toward the limit.
      </CalloutCard>

      <div className="card mt-6">
        <FormField label="HSA Contributions" tooltip={help?.fields['HSA Contributions']?.tooltip} irsRef={help?.fields['HSA Contributions']?.irsRef || 'Schedule 1, Line 13; Form 8889'} helpText="Total contributions made in 2025 (including employer contributions)">
          <CurrencyInput
            value={totalContributions}
            onChange={(v) => updateField('hsaDeduction', v)}
          />
        </FormField>

        {/* Form 8889 Detail */}
        {totalContributions > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <h4 className="text-sm font-medium text-slate-300 mb-3">HSA Detail (Form 8889)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
              <FormField label="Coverage Type" tooltip="Select the type of HDHP coverage you had as of December 1. This determines your annual contribution limit.">
                <select
                  className="input-field"
                  value={taxReturn.hsaContribution?.coverageType || 'self_only'}
                  onChange={(e) => updateField('hsaContribution', {
                    ...taxReturn.hsaContribution,
                    coverageType: e.target.value,
                  })}
                >
                  <option value="self_only">Self-Only ($4,300 limit)</option>
                  <option value="family">Family ($8,550 limit)</option>
                </select>
              </FormField>
              <FormField label="Months of HDHP Coverage" tooltip="Number of months you were covered by a High Deductible Health Plan. Your limit is prorated for partial-year coverage.">
                <select
                  className="input-field"
                  value={taxReturn.hsaContribution?.hdhpCoverageMonths ?? 12}
                  onChange={(e) => updateField('hsaContribution', {
                    ...taxReturn.hsaContribution,
                    coverageType: taxReturn.hsaContribution?.coverageType || 'self_only',
                    hdhpCoverageMonths: parseInt(e.target.value, 10),
                  })}
                >
                  {[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((m) => (
                    <option key={m} value={m}>{m} month{m !== 1 ? 's' : ''}{m === 12 ? ' (full year)' : ''}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
              <FormField label="Employer Contributions" optional helpText="W-2 Box 12, Code W" tooltip="Your employer's HSA contributions. These count toward your annual limit but are excluded from income.">
                <CurrencyInput
                  value={taxReturn.hsaContribution?.employerContributions || 0}
                  onChange={(v) => updateField('hsaContribution', {
                    ...taxReturn.hsaContribution,
                    coverageType: taxReturn.hsaContribution?.coverageType || 'self_only',
                    employerContributions: v,
                  })}
                />
              </FormField>
              <FormField label="Catch-Up Contributions (55+)" optional helpText="Additional $1,000 if age 55+" tooltip="If you were age 55+ at the end of 2025, you can contribute an additional $1,000.">
                <CurrencyInput
                  value={taxReturn.hsaContribution?.catchUpContributions || 0}
                  onChange={(v) => updateField('hsaContribution', {
                    ...taxReturn.hsaContribution,
                    coverageType: taxReturn.hsaContribution?.coverageType || 'self_only',
                    catchUpContributions: v,
                  })}
                />
              </FormField>
            </div>
          </div>
        )}

        <a href="https://www.irs.gov/publications/p969" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      {/* ── Excess Contribution Advisory ── */}
      {isExcess && (
        <div className="card mt-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-300">
                Excess HSA Contribution: ${excessAmount.toLocaleString()}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Your contributions (${totalContributions.toLocaleString()}) exceed the{' '}
                {months < 12 ? `prorated ${months}-month ` : ''}limit of ${maxAllowed.toLocaleString()}.
                Under IRC &sect;4973, a <strong className="text-amber-300">6% excise tax</strong> applies each year the excess remains in your HSA.
                You can avoid this penalty by withdrawing the excess before your filing deadline (April 15, or October 15 if you filed an extension).
              </p>
            </div>
          </div>

          <div className="space-y-2 ml-8">
            <p className="text-xs font-medium text-slate-300 mb-2">What do you plan to do?</p>

            {/* Option 1: Full withdrawal */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              withdrawalChoice === 'full'
                ? 'bg-emerald-500/10 border-emerald-500/40'
                : 'bg-surface-700/30 border-slate-700 hover:border-slate-600'
            }`}>
              <input
                type="radio"
                name="hsaWithdrawalChoice"
                checked={withdrawalChoice === 'full'}
                onChange={() => setWithdrawal({ choice: 'full', withdrawalAmount: undefined })}
                className="mt-0.5 accent-emerald-500"
              />
              <div>
                <span className="text-sm text-slate-200">
                  Withdraw the full ${excessAmount.toLocaleString()} before my filing deadline
                </span>
                <p className="text-xs text-emerald-400 mt-0.5">No 6% penalty applies</p>
              </div>
            </label>

            {/* Option 2: Partial withdrawal */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              withdrawalChoice === 'partial'
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-surface-700/30 border-slate-700 hover:border-slate-600'
            }`}>
              <input
                type="radio"
                name="hsaWithdrawalChoice"
                checked={withdrawalChoice === 'partial'}
                onChange={() => setWithdrawal({ choice: 'partial' })}
                className="mt-0.5 accent-amber-500"
              />
              <div className="flex-1">
                <span className="text-sm text-slate-200">Withdraw part of the excess</span>
                {withdrawalChoice === 'partial' && (
                  <div className="mt-2">
                    <FormField label="Amount to withdraw" helpText={`Up to $${excessAmount.toLocaleString()}`}>
                      <CurrencyInput
                        value={withdrawal?.withdrawalAmount || 0}
                        onChange={(v) => setWithdrawal({ withdrawalAmount: Math.min(v, excessAmount) })}
                      />
                    </FormField>
                    {effectiveExcess > 0 && (
                      <p className="text-xs text-amber-400 mt-1">
                        Remaining excess: ${effectiveExcess.toLocaleString()} &rarr; 6% penalty: ${penalty.toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </label>

            {/* Option 3: Keep it */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              withdrawalChoice === 'none'
                ? 'bg-red-500/10 border-red-500/40'
                : 'bg-surface-700/30 border-slate-700 hover:border-slate-600'
            }`}>
              <input
                type="radio"
                name="hsaWithdrawalChoice"
                checked={withdrawalChoice === 'none'}
                onChange={() => setWithdrawal({ choice: 'none', withdrawalAmount: undefined, earningsOnExcess: undefined })}
                className="mt-0.5 accent-red-500"
              />
              <div>
                <span className="text-sm text-slate-200">Keep the excess in my HSA</span>
                <p className="text-xs text-red-400 mt-0.5">
                  6% penalty: ${Math.round(excessAmount * 0.06).toLocaleString()}/year until withdrawn or absorbed by future contribution room
                </p>
              </div>
            </label>
          </div>

          {/* Earnings on Excess — shown when withdrawing */}
          {(withdrawalChoice === 'full' || withdrawalChoice === 'partial') && (
            <div className="ml-8 mt-4 p-3 rounded-lg bg-surface-700/40 border border-slate-700">
              <div className="flex items-start gap-2 mb-2">
                <Info className="w-4 h-4 text-telos-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-300 font-medium">Earnings on the excess</p>
                  <p className="text-xs text-slate-400 mt-1">
                    When you withdraw excess HSA contributions, the IRS requires you to also withdraw any
                    investment earnings that the excess amount generated while in your HSA. Your HSA
                    custodian (bank or brokerage) calculates this &ldquo;net income attributable&rdquo; for you
                    when you request the corrective withdrawal. These earnings are taxable as Other income
                    on your return for the year you receive the withdrawal.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    If you haven&apos;t made the withdrawal yet or your custodian hasn&apos;t provided this
                    number, you can enter $0 for now and amend later, or estimate it based on your
                    HSA&apos;s recent returns.
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <FormField label="Earnings on withdrawn excess" optional helpText="Your HSA custodian provides this amount" irsRef="Pub 969; Form 8889 Instructions">
                  <CurrencyInput
                    value={withdrawal?.earningsOnExcess || 0}
                    onChange={(v) => setWithdrawal({ earningsOnExcess: v })}
                  />
                </FormField>
                {(withdrawal?.earningsOnExcess || 0) > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    <CircleDollarSign className="w-3 h-3 inline mr-1" />
                    ${(withdrawal?.earningsOnExcess || 0).toLocaleString()} will be added to your Other income on Schedule 1.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Penalty summary */}
          {penalty > 0 && (
            <div className="ml-8 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
              <p className="text-xs text-slate-400">6% Excise Tax on remaining excess</p>
              <p className="text-lg font-bold text-red-400">${penalty.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-0.5">Reported on Form 5329, Part VII</p>
            </div>
          )}
          {withdrawalChoice === 'full' && (
            <div className="ml-8 mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
              <p className="text-sm font-medium text-emerald-400">No 6% excise tax penalty</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Full corrective withdrawal eliminates the penalty
              </p>
            </div>
          )}
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
