import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertSaversCredit } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { HandCoins, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import { FilingStatus } from '@telostax/engine';
import { getAgeAtEndOfYear } from '../../utils/dateValidation';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import WhatsNewCard from '../common/WhatsNewCard';

export default function SaversCreditStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['savers_credit'];

  const info = taxReturn.saversCredit || { totalContributions: 0 };

  const update = (field: string, value: unknown) => {
    updateField('saversCredit', { ...info, [field]: value });
  };

  const save = async () => {
    await upsertSaversCredit(returnId, { ...info });
  };

  // Rough estimate at lowest rate (10%)
  const cap = 2000; // simplified — actual cap depends on filing status
  const estimatedCredit = Math.min(info.totalContributions || 0, cap) * 0.10;

  return (
    <div>
      <StepWarningsBanner stepId="savers_credit" />

      <SectionIntro
        icon={<HandCoins className="w-8 h-8" />}
        title="Saver's Credit"
        description="A credit for low-to-moderate income taxpayers who contribute to a retirement plan (IRA, 401(k), etc.)."
      />

      <WhatsNewCard items={[
        { title: 'AGI Thresholds Increased', description: 'Single: $38,250 (up from $37,000). Head of Household: $57,375 (up from $55,500). MFJ: $76,500 (up from $74,000). Credit rate tiers (50%/20%/10%) apply based on AGI.' },
      ]} />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {taxReturn.canBeClaimedAsDependent && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">You may not be eligible</p>
              <p className="text-xs text-slate-400 mt-1">You indicated you can be claimed as a dependent on someone else's return. The Saver's Credit is not available to dependents.</p>
            </div>
          </div>
        )}
        {(() => {
          const age = getAgeAtEndOfYear(taxReturn.dateOfBirth, taxReturn.taxYear);
          return age !== undefined && age < 18 ? (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-300">Age requirement not met</p>
                <p className="text-xs text-slate-400 mt-1">Based on your date of birth, you are under 18. The Saver's Credit requires you to be at least 18 years old.</p>
              </div>
            </div>
          ) : null;
        })()}

        <FormField
          label="Total Eligible Retirement Contributions"
          tooltip="Contributions to traditional/Roth IRA, 401(k), 403(b), TSP, SIMPLE, or SEP plans during the tax year. Limit: $2,000 ($4,000 if filing jointly)."
          irsRef={help?.fields['Total Eligible Retirement Contributions']?.irsRef}
        >
          <CurrencyInput
            value={info.totalContributions}
            onChange={(v) => update('totalContributions', v)}
          />
        </FormField>

        {(info.totalContributions || 0) > 0 && (
          <div className="rounded-xl border p-6 bg-telos-orange-500/10 border-telos-orange-500/20">
            <span className="text-telos-orange-300 font-medium">
              Estimated Credit: up to ${Math.round(estimatedCredit).toLocaleString()}-${Math.round(estimatedCredit * 5).toLocaleString()}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Rate depends on AGI: 50% (lowest income), 20%, 10%, or 0% (above threshold)
            </p>
          </div>
        )}
        {(info.totalContributions || 0) > 0 && (() => {
          const saversAgi = calculation?.form1040?.agi;
          if (saversAgi == null || isNaN(saversAgi)) return null;
          const isMFJ = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly || taxReturn.filingStatus === FilingStatus.QualifyingSurvivingSpouse;
          const isHoH = taxReturn.filingStatus === FilingStatus.HeadOfHousehold;
          const zeroThreshold = isMFJ ? 73000 : (isHoH ? 54750 : 36500);
          if (saversAgi <= zeroThreshold) return null;
          return (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                AGI of ${saversAgi.toLocaleString()} exceeds the ${zeroThreshold.toLocaleString()} threshold — the Saver's Credit rate is 0% for your filing status.
              </p>
            </div>
          );
        })()}

        <div className="card bg-surface-800 border-slate-700 text-sm text-slate-400">
          <div className="flex items-center gap-3 mb-3"><Info className="w-5 h-5 text-telos-blue-400" /><h3 className="font-medium text-slate-200">AGI Thresholds (2025)</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left py-1">Rate</th>
                  <th className="text-right py-1">Single/MFS</th>
                  <th className="text-right py-1">HoH</th>
                  <th className="text-right py-1">MFJ</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr><td className="py-0.5">50%</td><td className="text-right">≤$23,750</td><td className="text-right">≤$35,625</td><td className="text-right">≤$47,500</td></tr>
                <tr><td className="py-0.5">20%</td><td className="text-right">≤$25,750</td><td className="text-right">≤$38,625</td><td className="text-right">≤$51,500</td></tr>
                <tr><td className="py-0.5">10%</td><td className="text-right">≤$36,500</td><td className="text-right">≤$54,750</td><td className="text-right">≤$73,000</td></tr>
                <tr className="text-slate-400"><td className="py-0.5">0%</td><td className="text-right">above</td><td className="text-right">above</td><td className="text-right">above</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs">
            You must be age 18+, not a full-time student, and not claimed as a dependent.
          </p>
        </div>
      </div>

      <a
        href="https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-savings-contributions-savers-credit"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation onContinue={save} />
    </div>
  );
}
