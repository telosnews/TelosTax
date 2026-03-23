import { useMemo, useEffect } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertChildTaxCredit } from '../../api/client';
import FormField from '../common/FormField';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import WhatsNewCard from '../common/WhatsNewCard';
import { Baby, AlertTriangle } from 'lucide-react';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';
import { getAgeAtEndOfYear } from '../../utils/dateValidation';
import StepWarningsBanner from '../common/StepWarningsBanner';

export default function ChildTaxCreditStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['child_tax_credit'];
  const ctc = taxReturn.childTaxCredit || { qualifyingChildren: 0, otherDependents: 0 };

  // Derive counts from dependents array
  const derived = useMemo(() => {
    const deps = taxReturn.dependents || [];
    if (deps.length === 0) return null;
    let qualifyingChildren = 0;
    let otherDependents = 0;
    for (const dep of deps) {
      const age = getAgeAtEndOfYear(dep.dateOfBirth, taxReturn.taxYear);
      if (age !== undefined && age < 17 && dep.monthsLivedWithYou >= 7) {
        qualifyingChildren++;
      } else {
        otherDependents++;
      }
    }
    return { qualifyingChildren, otherDependents };
  }, [taxReturn.dependents, taxReturn.taxYear]);

  // Auto-sync derived counts when dependents change
  useEffect(() => {
    if (derived && (ctc.qualifyingChildren !== derived.qualifyingChildren || ctc.otherDependents !== derived.otherDependents)) {
      updateField('childTaxCredit', { ...ctc, ...derived });
    }
  }, [derived]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCTC = (field: string, value: number) => {
    updateField('childTaxCredit', { ...ctc, [field]: value });
  };

  const save = async () => {
    await upsertChildTaxCredit(returnId, { ...ctc });
  };

  const totalCredit = (ctc.qualifyingChildren * 2200) + (ctc.otherDependents * 500);

  return (
    <div>
      <StepWarningsBanner stepId="child_tax_credit" />

      <SectionIntro icon={<Baby className="w-8 h-8" />} title="Child Tax Credit" description="$2,200 per qualifying child under 17, $500 per other dependent." />

      <WhatsNewCard items={[
        { title: 'Child Tax Credit Increased to $2,200', description: 'Up from $2,000 per qualifying child under the One Big Beautiful Bill Act (P.L. 119-21).' },
        { title: 'Refundable Portion: $1,700', description: 'The Additional Child Tax Credit (refundable portion) is $1,700, meaning you can receive up to that amount as a refund even if you owe no tax.' },
        { title: 'Phase-Out Unchanged', description: 'The credit still phases out at $200,000 AGI ($400,000 for married filing jointly) at $50 per $1,000 of excess income.' },
        { title: 'Other Dependents', description: 'The $500 credit for other dependents (age 17+) remains unchanged for 2025.' },
      ]} />

      <CalloutCard variant="info" title="About the Child Tax Credit" irsUrl="https://www.irs.gov/credits-deductions/individuals/child-tax-credit">
        A common mistake: the Child Tax Credit requires the child to be under age 17 at the end of
        the tax year — not under 18. A child who turns 17 during the year qualifies for the $500
        other dependent credit instead. The credit begins to phase out at $200,000 AGI for single
        filers and $400,000 for married filing jointly, reduced by $50 for every $1,000 of excess
        income.
      </CalloutCard>

      <div className="mt-6">
        {(taxReturn.dependents || []).length === 0 && (
          <div className="mb-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">No dependents claimed</p>
              <p className="text-xs text-slate-400 mt-1">Add dependents in the My Info section to automatically determine qualifying children. You can still enter counts manually below.</p>
            </div>
          </div>
        )}
        {derived && (
          <div className="mb-4 p-3 rounded-lg bg-telos-blue-600/10 border border-telos-blue-600/30 text-sm">
            <p className="text-telos-blue-300">
              Pre-filled from your {(taxReturn.dependents || []).length} {(taxReturn.dependents || []).length === 1 ? 'dependent' : 'dependents'}: {derived.qualifyingChildren} qualifying {derived.qualifyingChildren === 1 ? 'child' : 'children'} under 17, {derived.otherDependents} other. You can override below.
            </p>
          </div>
        )}

        <FormField label="Qualifying Children (under 17)" tooltip={help?.fields['Qualifying Children (under 17)']?.tooltip} irsRef={help?.fields['Qualifying Children (under 17)']?.irsRef} helpText="$2,200 credit per child">
          <input type="number" className="input-field" min={0} max={20} value={ctc.qualifyingChildren || ''} onChange={(e) => updateCTC('qualifyingChildren', parseInt(e.target.value) || 0)} />
        </FormField>

        <FormField label="Other Dependents (17+)" tooltip={help?.fields['Other Dependents (17+)']?.tooltip} irsRef={help?.fields['Other Dependents (17+)']?.irsRef} optional helpText="$500 credit per dependent">
          <input type="number" className="input-field" min={0} max={20} value={ctc.otherDependents || ''} onChange={(e) => updateCTC('otherDependents', parseInt(e.target.value) || 0)} />
        </FormField>

        {totalCredit > 0 && (
          <div className="rounded-xl border p-6 bg-telos-orange-500/10 border-telos-orange-500/20 mt-4">
            <span className="text-telos-orange-300 font-medium">Estimated Credit: ${totalCredit.toLocaleString()}</span>
            <p className="text-xs text-slate-400 mt-1">Subject to income phase-out above $200k (single) / $400k (MFJ)</p>
          </div>
        )}
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
