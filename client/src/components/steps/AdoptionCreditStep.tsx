import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertAdoptionCredit } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Heart, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';

export default function AdoptionCreditStep() {
  const { taxReturn, returnId, updateField, calculation } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['adoption_credit'];

  const info = taxReturn.adoptionCredit || {
    qualifiedExpenses: 0,
    numberOfChildren: 1,
    isSpecialNeeds: false,
  };

  const update = (field: string, value: unknown) => {
    updateField('adoptionCredit', { ...info, [field]: value });
  };

  const save = async () => {
    await upsertAdoptionCredit(returnId, { ...info });
  };

  const maxPerChild = 17280;
  const children = info.numberOfChildren || 1;
  const perChildExpenses = info.isSpecialNeeds ? maxPerChild : Math.min(info.qualifiedExpenses || 0, maxPerChild);
  const estimatedCredit = perChildExpenses * children;

  return (
    <div>
      <StepWarningsBanner stepId="adoption_credit" />

      <SectionIntro
        icon={<Heart className="w-8 h-8" />}
        title="Adoption Credit"
        description="A credit for qualified expenses you paid to adopt an eligible child (Form 8839)."
      />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="rounded-lg border border-slate-700 bg-surface-800 mt-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/60 flex items-center gap-2">
          <Info className="w-4 h-4 text-telos-blue-400" />
          <span className="text-sm font-medium text-slate-200">Key Details</span>
        </div>
        <div className="p-4 space-y-2">
          <ul className="list-disc list-inside space-y-1 text-xs text-slate-400">
            <li>Maximum credit: $17,280 per eligible child (2025)</li>
            <li>Special needs adoption: full credit regardless of expenses</li>
            <li>AGI phase-out begins at $259,190 and eliminated over $40,000</li>
            <li>Non-refundable — unused credit can be carried forward up to 5 years</li>
            <li>Cannot claim for a child of your spouse (stepchild adoption)</li>
          </ul>
          <a href="https://www.irs.gov/forms-pubs/about-form-8839" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <FormField label="Number of Children Adopted" tooltip="The number of eligible children adopted during or in connection with the tax year." irsRef={help?.fields['Number of Children Adopted']?.irsRef}>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                className={`py-1.5 px-4 rounded text-sm font-medium transition-colors ${children === n ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400 hover:text-slate-200'}`}
                onClick={() => update('numberOfChildren', n)}
              >
                {n}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Special Needs Adoption?" tooltip="If the child is a U.S. citizen or resident with special needs, you receive the full credit ($17,280) regardless of actual expenses.">
          <div className="flex gap-3">
            <button className={`py-1.5 px-4 rounded text-sm ${info.isSpecialNeeds ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('isSpecialNeeds', true)}>Yes</button>
            <button className={`py-1.5 px-4 rounded text-sm ${!info.isSpecialNeeds ? 'bg-telos-blue-600 text-white' : 'bg-surface-800 text-slate-400'}`} onClick={() => update('isSpecialNeeds', false)}>No</button>
          </div>
        </FormField>

        {!info.isSpecialNeeds && (
          <FormField label="Qualified Adoption Expenses (per child)" tooltip="Reasonable and necessary adoption fees, court costs, attorney fees, travel expenses, and other expenses directly related to the adoption." irsRef={help?.fields['Qualified Adoption Expenses']?.irsRef}>
            <CurrencyInput value={info.qualifiedExpenses} onChange={(v) => update('qualifiedExpenses', v)} />
          </FormField>
        )}

        {estimatedCredit > 0 && (
          <div className="rounded-xl border p-6 bg-telos-orange-500/10 border-telos-orange-500/20">
            <span className="text-telos-orange-300 font-medium">
              Estimated Credit: ${estimatedCredit.toLocaleString()}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {info.isSpecialNeeds
                ? `Full $${maxPerChild.toLocaleString()} per child (special needs adoption)`
                : `$${perChildExpenses.toLocaleString()} per child × ${children} ${children === 1 ? 'child' : 'children'} (before AGI phase-out)`}
            </p>
          </div>
        )}
        {estimatedCredit > 0 && (() => {
          const adoptAgi = calculation?.form1040?.agi;
          if (adoptAgi == null || isNaN(adoptAgi) || adoptAgi <= 259190) return null;
          return (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                {adoptAgi >= 299190
                  ? `AGI of $${adoptAgi.toLocaleString()} exceeds $299,190 — adoption credit is fully phased out.`
                  : `AGI of $${adoptAgi.toLocaleString()} exceeds $259,190 — adoption credit is partially reduced.`}
              </p>
            </div>
          );
        })()}

      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
