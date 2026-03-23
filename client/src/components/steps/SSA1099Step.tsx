import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertSSA1099 } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { ShieldCheck } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';

export default function SSA1099Step() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['ssa1099_income'];

  const ssa = taxReturn.incomeSSA1099 || { id: '', totalBenefits: 0, federalTaxWithheld: 0 };

  const update = (field: string, value: number) => {
    const updated = { ...ssa, [field]: value };
    updateField('incomeSSA1099', updated);
  };

  const save = () => {
    upsertSSA1099(returnId, {
      totalBenefits: ssa.totalBenefits,
      federalTaxWithheld: ssa.federalTaxWithheld,
    });
  };

  return (
    <div>
      <StepWarningsBanner stepId="ssa1099_income" />
      <SectionIntro
        icon={<ShieldCheck className="w-8 h-8" />}
        title="Social Security Benefits (SSA-1099)"
        description="Enter the amounts from your SSA-1099 form. Only a portion of your benefits may be taxable, depending on your total income."
      />

      <div className="space-y-3 mt-4 mb-2">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="card mt-4">
        <FormField
          label="Net Benefits (Box 5)"
          tooltip="This is the total amount of Social Security benefits you received during the year, after any deductions. It's shown in Box 5 of your SSA-1099."
          irsRef={help?.fields['Net Benefits (Box 5)']?.irsRef}
        >
          <CurrencyInput value={ssa.totalBenefits} onChange={(v) => update('totalBenefits', v)} />
        </FormField>

        <FormField
          label="Federal Tax Withheld (Box 6)"
          optional
          tooltip="If you elected to have federal income tax withheld from your Social Security payments, the total withheld is shown in Box 6."
          irsRef={help?.fields['Federal Tax Withheld (Box 6)']?.irsRef}
        >
          <CurrencyInput value={ssa.federalTaxWithheld || 0} onChange={(v) => update('federalTaxWithheld', v)} />
        </FormField>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
