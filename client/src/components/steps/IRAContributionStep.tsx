import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { PiggyBank, AlertTriangle, ExternalLink, Info, CircleDollarSign } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import StepWarningsBanner from '../common/StepWarningsBanner';
import WhatsNewCard from '../common/WhatsNewCard';
import { FilingStatus, IRA } from '@telostax/engine';
import type { IRAExcessWithdrawal } from '@telostax/engine';

export default function IRAContributionStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['adjustments'];
  const agi = calculation?.form1040?.agi;
  const isMFJ = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly || taxReturn.filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const isSingleOrHoH = taxReturn.filingStatus === FilingStatus.Single || taxReturn.filingStatus === FilingStatus.HeadOfHousehold;

  const save = async () => {
    await updateReturn(returnId, {
      iraContribution: taxReturn.iraContribution,
      coveredByEmployerPlan: taxReturn.coveredByEmployerPlan,
      spouseCoveredByEmployerPlan: taxReturn.spouseCoveredByEmployerPlan,
      iraExcessWithdrawal: taxReturn.iraExcessWithdrawal,
    });
  };

  // Phase-out thresholds when covered by employer plan
  const phaseOutStart = isMFJ ? 126000 : (isSingleOrHoH ? 79000 : 0);
  const phaseOutEnd = isMFJ ? 146000 : (isSingleOrHoH ? 89000 : 10000);

  // ── IRA excess contribution detection ──
  const age = taxReturn.dateOfBirth ? Math.floor((Date.now() - new Date(taxReturn.dateOfBirth).getTime()) / 31557600000) : 0;
  const iraLimit = IRA.MAX_CONTRIBUTION + (age >= 50 ? IRA.CATCH_UP_50_PLUS : 0);
  const totalContributions = taxReturn.iraContribution || 0;
  const excessAmount = Math.max(0, totalContributions - iraLimit);
  const isExcess = excessAmount > 0;

  const withdrawal = taxReturn.iraExcessWithdrawal;
  const withdrawalChoice = withdrawal?.choice || 'none';

  const setWithdrawal = (update: Partial<IRAExcessWithdrawal>) => {
    updateField('iraExcessWithdrawal', {
      ...withdrawal,
      choice: withdrawal?.choice || 'none',
      ...update,
    });
  };

  const effectiveExcess = withdrawalChoice === 'full'
    ? 0
    : withdrawalChoice === 'partial'
      ? Math.max(0, excessAmount - (withdrawal?.withdrawalAmount || 0))
      : excessAmount;
  const penalty = Math.round(effectiveExcess * 0.06);

  return (
    <div>
      <StepWarningsBanner stepId="ira_contribution_ded" />

      <SectionIntro
        icon={<PiggyBank className="w-8 h-8" />}
        title="IRA Contributions"
        description="Deduct up to $7,000 in traditional IRA contributions ($8,000 if 50+). Phase-out applies if covered by a workplace plan."
      />

      <WhatsNewCard items={[
        { title: 'Phase-Out Thresholds Increased', description: 'If covered by employer plan: Single/HoH phase-out is $79,000-$89,000 (up from $77,000-$87,000). MFJ phase-out is $126,000-$146,000 (up from $123,000-$143,000).' },
        { title: 'Spouse Not Covered by Plan', description: 'If your spouse has a plan but you don\'t: MFJ phase-out is $236,000-$246,000 (up from $230,000-$240,000).' },
      ]} />

      <CalloutCard variant="info" title="IRA Deduction Limits (2025)" irsUrl="https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-ira-contribution-limits">
        Traditional IRA limit: $7,000 ($8,000 if age 50+). Roth IRA contributions are not deductible. If you or your spouse are covered by an employer retirement plan, the deduction may be reduced or eliminated based on income.
      </CalloutCard>

      <div className="card mt-6">
        <FormField label="Traditional IRA Contributions" tooltip={help?.fields['Traditional IRA Contributions']?.tooltip} irsRef={help?.fields['Traditional IRA Contributions']?.irsRef || 'Schedule 1, Line 20'} helpText="Roth IRA contributions are not deductible">
          <CurrencyInput
            value={taxReturn.iraContribution || 0}
            onChange={(v) => updateField('iraContribution', v)}
          />
        </FormField>

        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="accent-telos-orange-400"
              checked={!!taxReturn.coveredByEmployerPlan}
              onChange={(e) => updateField('coveredByEmployerPlan', e.target.checked)}
            />
            <span className="text-sm text-slate-300">I am covered by an employer retirement plan (401k, 403b, etc.)</span>
          </label>
          {isMFJ && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-telos-orange-400"
                checked={!!taxReturn.spouseCoveredByEmployerPlan}
                onChange={(e) => updateField('spouseCoveredByEmployerPlan', e.target.checked)}
              />
              <span className="text-sm text-slate-300">My spouse is covered by an employer retirement plan</span>
            </label>
          )}
          <p className="text-xs text-slate-400">If covered, your IRA deduction may be reduced or eliminated based on income.</p>
        </div>

        {(taxReturn.iraContribution || 0) > 0 && taxReturn.coveredByEmployerPlan && agi != null && !isNaN(agi) && phaseOutStart > 0 && agi > phaseOutStart && (
          <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              {agi >= phaseOutEnd
                ? `You're covered by an employer plan and your AGI ($${agi.toLocaleString()}) exceeds $${phaseOutEnd.toLocaleString()} — this contribution is not deductible.`
                : `You're covered by an employer plan and your AGI ($${agi.toLocaleString()}) is in the phase-out range ($${phaseOutStart.toLocaleString()}-$${phaseOutEnd.toLocaleString()}) — deduction may be reduced.`}
            </p>
          </div>
        )}

        <a href="https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-ira-contribution-limits" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      {/* ── Excess Contribution Advisory ── */}
      {isExcess && (
        <div className="card mt-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-300">
                Excess IRA Contribution: ${excessAmount.toLocaleString()}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Your contributions (${totalContributions.toLocaleString()}) exceed the{' '}
                {age >= 50 ? 'catch-up ' : ''}limit of ${iraLimit.toLocaleString()}.
                Under IRC &sect;4973(a), a <strong className="text-amber-300">6% excise tax</strong> applies each year the excess remains in your IRA.
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
                name="iraWithdrawalChoice"
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
                name="iraWithdrawalChoice"
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
                name="iraWithdrawalChoice"
                checked={withdrawalChoice === 'none'}
                onChange={() => setWithdrawal({ choice: 'none', withdrawalAmount: undefined, earningsOnExcess: undefined })}
                className="mt-0.5 accent-red-500"
              />
              <div>
                <span className="text-sm text-slate-200">Keep the excess in my IRA</span>
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
                  <p className="text-xs text-slate-300 font-medium">Net income attributable (NIA)</p>
                  <p className="text-xs text-slate-400 mt-1">
                    When you withdraw excess IRA contributions, the IRS requires you to also withdraw the
                    net income attributable to the excess &mdash; any investment earnings that the excess generated
                    while in your IRA. Your IRA custodian calculates this amount for you
                    when you request the corrective withdrawal. These earnings are taxable as Other income
                    on your return for the year you receive the withdrawal.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    If you haven&apos;t made the withdrawal yet or your custodian hasn&apos;t provided this
                    number, you can enter $0 for now and amend later, or estimate it based on your
                    IRA&apos;s recent returns.
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <FormField label="Earnings on withdrawn excess" optional helpText="Your IRA custodian provides this amount" irsRef="Pub 590-A; Form 5329 Instructions">
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

          {/* Withdrawal result summary */}
          {penalty > 0 && (
            <div className="ml-8 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
              <p className="text-xs text-slate-400">6% Excise Tax on remaining excess</p>
              <p className="text-lg font-bold text-red-400">${penalty.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-0.5">Reported on Form 5329, Part III</p>
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
