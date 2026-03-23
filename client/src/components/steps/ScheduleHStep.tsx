import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { BadgeDollarSign, ExternalLink } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';

export default function ScheduleHStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['schedule_h'];
  const he = taxReturn.householdEmployees || {
    totalCashWages: 0, federalTaxWithheld: 0, numberOfEmployees: 1, subjectToFUTA: false,
  };

  const update = (field: string, value: number | boolean) => {
    updateField('householdEmployees', { ...he, [field]: value });
  };

  const save = async () => {
    await updateReturn(returnId, { householdEmployees: taxReturn.householdEmployees });
  };

  const threshold2025 = 2800; // 2025 cash wage threshold for Schedule H

  return (
    <div>
      <StepWarningsBanner stepId="schedule_h" />

      <SectionIntro
        icon={<BadgeDollarSign className="w-8 h-8" />}
        title="Household Employees (Schedule H)"
        description="If you paid a nanny, housekeeper, or other household worker $2,800+ in cash wages, you owe employment taxes."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="card mt-6">
        <FormField label="Total Cash Wages Paid" helpText={`Total paid to all household employees in 2025. Threshold: $${threshold2025.toLocaleString()}`} tooltip={help?.fields['Total Cash Wages Paid']?.tooltip} irsRef={help?.fields['Total Cash Wages Paid']?.irsRef}>
          <CurrencyInput value={he.totalCashWages} onChange={(v) => update('totalCashWages', v)} />
        </FormField>
        <FormField label="Federal Tax Withheld" optional helpText="Only if you and the employee agreed to withhold income tax" tooltip={help?.fields['Federal Tax Withheld']?.tooltip} irsRef={help?.fields['Federal Tax Withheld']?.irsRef}>
          <CurrencyInput value={he.federalTaxWithheld || 0} onChange={(v) => update('federalTaxWithheld', v)} />
        </FormField>
        <FormField label="Number of Household Employees" optional tooltip={help?.fields['Number of Household Employees']?.tooltip} irsRef={help?.fields['Number of Household Employees']?.irsRef}>
          <input
            type="number"
            className="input-field"
            value={he.numberOfEmployees || ''}
            onChange={(e) => update('numberOfEmployees', Number(e.target.value))}
            min={1}
          />
        </FormField>
        <label className="flex items-center gap-3 mt-3 cursor-pointer">
          <input type="checkbox" className="accent-telos-orange-400" checked={!!he.subjectToFUTA} onChange={(e) => update('subjectToFUTA', e.target.checked)} />
          <span className="text-sm text-slate-300">Paid $1,000+ in any calendar quarter (subject to FUTA)</span>
        </label>
        <a href="https://www.irs.gov/forms-pubs/about-schedule-h-form-1040" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      {he.totalCashWages >= threshold2025 && (
        <div className="rounded-xl border p-6 mt-4 bg-amber-500/10 border-amber-500/30 text-center">
          <p className="text-sm text-slate-400">Estimated Employment Tax</p>
          <p className="text-xl font-bold text-amber-400">
            ${Math.round(he.totalCashWages * 0.153).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Social Security (12.4%) + Medicare (2.9%) — split between you and employee
          </p>
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
