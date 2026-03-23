import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Globe, ExternalLink } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';

const help = HELP_CONTENT['foreign_earned_income'];

export default function ForeignEarnedIncomeStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const fei = taxReturn.foreignEarnedIncome || {
    foreignEarnedIncome: 0, qualifyingDays: 0, housingExpenses: 0,
  };

  const update = (field: string, value: number) => {
    updateField('foreignEarnedIncome', { ...fei, [field]: value });
  };

  const save = async () => {
    await updateReturn(returnId, { foreignEarnedIncome: taxReturn.foreignEarnedIncome });
  };

  const maxExclusion = 130000; // 2025 FEIE limit

  return (
    <div>
      <StepWarningsBanner stepId="foreign_earned_income" />

      <SectionIntro
        icon={<Globe className="w-8 h-8" />}
        title="Foreign Earned Income (Form 2555)"
        description="If you lived and worked abroad, you may exclude up to $130,000 of foreign earned income from U.S. tax."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="card mt-6">
        <FormField label="Foreign Earned Income" helpText="Wages, salaries, and self-employment income earned abroad" tooltip={help?.fields['Foreign Earned Income']?.tooltip} irsRef={help?.fields['Foreign Earned Income']?.irsRef}>
          <CurrencyInput value={fei.foreignEarnedIncome} onChange={(v) => update('foreignEarnedIncome', v)} />
        </FormField>
        <FormField label="Qualifying Days Abroad" helpText="Days meeting the bona fide residence or physical presence test (max 365)" tooltip={help?.fields['Qualifying Days Abroad']?.tooltip} irsRef={help?.fields['Qualifying Days Abroad']?.irsRef}>
          <input
            type="number"
            className="input-field"
            value={fei.qualifyingDays || ''}
            onChange={(e) => update('qualifyingDays', Math.min(365, Number(e.target.value)))}
            min={0}
            max={365}
          />
        </FormField>
        <FormField label="Foreign Housing Expenses" optional helpText="Rent, utilities, and other housing costs paid abroad" tooltip={help?.fields['Foreign Housing Expenses']?.tooltip} irsRef={help?.fields['Foreign Housing Expenses']?.irsRef}>
          <CurrencyInput value={fei.housingExpenses || 0} onChange={(v) => update('housingExpenses', v)} />
        </FormField>
      </div>

      {fei.foreignEarnedIncome > 0 && (
        <div className="rounded-xl border p-6 mt-4 bg-telos-blue-600/10 border-telos-blue-600/30 text-center">
          <p className="text-sm text-slate-400">Maximum Exclusion (2025)</p>
          <p className="text-2xl font-bold text-white">${Math.min(fei.foreignEarnedIncome, maxExclusion).toLocaleString()}</p>
          {(fei.qualifyingDays || 0) < 330 && (fei.qualifyingDays || 0) > 0 && (
            <p className="text-xs text-amber-400 mt-1">
              Exclusion is prorated: {fei.qualifyingDays}/365 days = ${Math.round(maxExclusion * (fei.qualifyingDays || 0) / 365).toLocaleString()} max
            </p>
          )}
        </div>
      )}

      <a
        href="https://www.irs.gov/forms-pubs/about-form-2555"
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
