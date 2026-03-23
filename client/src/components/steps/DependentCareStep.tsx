import { useMemo, useEffect } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertDependentCare } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import EINInput from '../common/EINInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { PersonStanding, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import { getAgeAtEndOfYear } from '../../utils/dateValidation';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';

export default function DependentCareStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['dependent_care'];

  const info = taxReturn.dependentCare || { totalExpenses: 0, qualifyingPersons: 1 };

  // Derive qualifying persons from dependents: under 13 or disabled
  const derivedQualifying = useMemo(() => {
    const deps = taxReturn.dependents || [];
    if (deps.length === 0) return null;
    let count = 0;
    for (const dep of deps) {
      const age = getAgeAtEndOfYear(dep.dateOfBirth, taxReturn.taxYear);
      if ((age !== undefined && age < 13) || dep.isDisabled) {
        count++;
      }
    }
    return count > 0 ? Math.min(count, 3) : null; // Cap at 3 (button max)
  }, [taxReturn.dependents, taxReturn.taxYear]);

  // Auto-sync derived count
  useEffect(() => {
    if (derivedQualifying !== null && (info.qualifyingPersons || 1) !== derivedQualifying) {
      updateField('dependentCare', { ...info, qualifyingPersons: derivedQualifying });
    }
  }, [derivedQualifying]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (field: string, value: unknown) => {
    updateField('dependentCare', { ...info, [field]: value });
  };

  const save = async () => {
    await upsertDependentCare(returnId, { ...info });
  };

  const expenseLimit = (info.qualifyingPersons || 1) >= 2 ? 6000 : 3000;
  const estimatedCredit = Math.min(info.totalExpenses || 0, expenseLimit) * 0.20; // Minimum rate

  return (
    <div>
      <StepWarningsBanner stepId="dependent_care" />

      <SectionIntro
        icon={<PersonStanding className="w-8 h-8" />}
        title="Child & Dependent Care Credit"
        description="If you paid someone to care for a child under 13 or a disabled dependent so you could work, you may qualify for this credit."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="rounded-lg border border-slate-700 bg-surface-800 mt-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/60 flex items-center gap-2">
          <Info className="w-4 h-4 text-telos-blue-400" />
          <span className="text-sm font-medium text-slate-200">Who qualifies?</span>
        </div>
        <div className="p-4 space-y-2">
          <ul className="list-disc list-inside space-y-1 text-xs text-slate-400">
            <li>Children under age 13 who you claim as dependents</li>
            <li>A spouse who is physically or mentally incapable of self-care</li>
            <li>Any dependent incapable of self-care who lived with you for more than half the year</li>
          </ul>
          <p className="text-xs text-slate-400">The care must have been provided so that you (and your spouse, if filing jointly) could work or look for work.</p>
          <a href="https://www.irs.gov/taxtopics/tc602" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {(taxReturn.dependents || []).length > 0 && derivedQualifying === null && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">No qualifying persons found</p>
              <p className="text-xs text-slate-400 mt-1">None of your dependents appear to be under 13 or disabled. This credit requires a qualifying child under 13 or a disabled dependent.</p>
            </div>
          </div>
        )}
        {(taxReturn.dependents || []).length === 0 && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">No dependents claimed</p>
              <p className="text-xs text-slate-400 mt-1">Add dependents in the My Info section first. This credit requires a qualifying child under 13 or a disabled dependent you claim.</p>
            </div>
          </div>
        )}

        <FormField
          label="Total Care Expenses Paid"
          tooltip="Total amount you paid for care of qualifying persons during the year so that you (and your spouse) could work or look for work."
          irsRef={help?.fields['Total Care Expenses Paid']?.irsRef}
        >
          <CurrencyInput
            value={info.totalExpenses}
            onChange={(v) => update('totalExpenses', v)}
          />
        </FormField>

        <FormField
          label="Number of Qualifying Persons"
          helpText="Children under 13 or disabled dependents. Limit: $3,000 for 1, $6,000 for 2+."
          tooltip={help?.fields['Number of Qualifying Persons']?.tooltip}
          irsRef={help?.fields['Number of Qualifying Persons']?.irsRef}
        >
          {derivedQualifying !== null && (
            <p className="text-xs text-telos-blue-400 mb-2">
              Pre-filled: {derivedQualifying} qualifying {derivedQualifying === 1 ? 'person' : 'persons'} found in your dependents (under 13 or disabled). You can override.
            </p>
          )}
          <div className="flex gap-3">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => update('qualifyingPersons', n)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  (info.qualifyingPersons || 1) === n
                    ? 'bg-telos-blue-600 text-white'
                    : 'bg-surface-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {n}{n === 3 ? '+' : ''}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Care Provider Name" optional tooltip={help?.fields['Care Provider Name']?.tooltip} irsRef={help?.fields['Care Provider Name']?.irsRef}>
          <input
            className="input-field"
            value={info.providerName || ''}
            onChange={(e) => update('providerName', e.target.value)}
            placeholder="Daycare name or provider"
          />
        </FormField>

        <FormField label="Provider EIN or SSN" optional tooltip={help?.fields['Provider EIN or SSN']?.tooltip} irsRef={help?.fields['Provider EIN or SSN']?.irsRef}>
          <EINInput value={info.providerEin || ''} onChange={(v) => update('providerEin', v)} />
        </FormField>

        {taxReturn.filingStatus === 2 && (
          <>
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-800">
              <div>
                <span className="text-sm text-slate-300">Was your spouse a full-time student?</span>
                <p className="text-xs text-slate-400 mt-0.5">Full-time student for at least 5 months during the year.</p>
              </div>
              <button
                onClick={() => update('isStudentSpouse', !info.isStudentSpouse)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  info.isStudentSpouse
                    ? 'bg-telos-blue-600 text-white'
                    : 'bg-surface-800 text-slate-400'
                }`}
              >
                {info.isStudentSpouse ? 'Yes' : 'No'}
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-800">
              <div>
                <span className="text-sm text-slate-300">Was your spouse disabled?</span>
                <p className="text-xs text-slate-400 mt-0.5">Physically or mentally incapable of self-care.</p>
              </div>
              <button
                onClick={() => update('isDisabledSpouse', !info.isDisabledSpouse)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  info.isDisabledSpouse
                    ? 'bg-telos-blue-600 text-white'
                    : 'bg-surface-800 text-slate-400'
                }`}
              >
                {info.isDisabledSpouse ? 'Yes' : 'No'}
              </button>
            </div>
            <FormField label="Spouse's Earned Income" optional helpText="The dependent care credit is limited to the lower-earning spouse's income.">
              <CurrencyInput
                value={info.spouseEarnedIncome}
                onChange={(v) => update('spouseEarnedIncome', v)}
              />
            </FormField>
          </>
        )}

        <FormField label="Employer-Provided Dependent Care Benefits (W-2 Box 10)" optional tooltip="Employer-provided dependent care assistance from your W-2. This amount reduces your qualifying expenses.">
          <CurrencyInput
            value={info.employerBenefits}
            onChange={(v) => update('employerBenefits', v)}
          />
        </FormField>

        <FormField label="Dependent Care FSA Contributions" optional helpText="Amount contributed to an employer dependent care FSA (pre-tax). Reduces expenses eligible for the credit.">
          <CurrencyInput
            value={info.dependentCareFSA}
            onChange={(v) => update('dependentCareFSA', v)}
          />
        </FormField>

        {(info.totalExpenses || 0) > 0 && (
          <div className="rounded-xl border p-6 bg-telos-orange-500/10 border-telos-orange-500/20">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-telos-orange-300 font-medium">
                  Estimated Credit: ${Math.round(estimatedCredit).toLocaleString()}+
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Qualifying expenses: up to ${expenseLimit.toLocaleString()} &middot; Rate: 20-35% based on AGI
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
