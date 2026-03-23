import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import WhatsNewCard from '../common/WhatsNewCard';
import { GraduationCap } from 'lucide-react';

export default function ScholarshipCreditStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const info = taxReturn.scholarshipCredit || { contributionAmount: 0, stateTaxCreditReceived: 0 };

  const update = (field: string, value: number) => {
    updateField('scholarshipCredit', { ...info, [field]: value });
  };

  const save = async () => {
    await updateReturn(returnId, { scholarshipCredit: taxReturn.scholarshipCredit });
  };

  const eligible = Math.max(0, (info.contributionAmount || 0) - (info.stateTaxCreditReceived || 0));
  const credit = Math.min(eligible, 1700);

  return (
    <div>
      <StepWarningsBanner stepId="scholarship_credit" />
      <SectionIntro
        icon={<GraduationCap className="w-8 h-8" />}
        title="Scholarship Credit (IRC §25F)"
        description="A nonrefundable credit of up to $1,700 for contributions to qualified Scholarship Granting Organizations (SGOs) that fund K-12 scholarships."
      />

      <WhatsNewCard items={[
        { title: 'Brand New Credit for 2025', description: 'The Scholarship Credit (IRC §25F) was created by the One Big Beautiful Bill Act (OBBBA §70202). It did not exist before 2025.' },
        { title: 'Up to $1,700 Per Return', description: 'Nonrefundable credit for contributions to IRS-qualified Scholarship Granting Organizations (SGOs) that fund K-12 scholarships.' },
        { title: 'State Credit Offset', description: 'If your state also gives a tax credit for the same SGO contribution, the federal credit is reduced dollar-for-dollar by the state credit amount.' },
      ]} />

      <CalloutCard variant="info" title="How the Scholarship Credit works" irsUrl="https://www.irs.gov/credits-deductions/scholarship-tax-credit">
        You can claim a nonrefundable federal credit for contributions made to IRS-qualified Scholarship Granting Organizations (SGOs) that provide K-12 scholarships to students. If your state also provides a tax credit for the same contribution, the federal credit is reduced dollar-for-dollar by the state credit amount.
      </CalloutCard>

      <div className="card mt-6">
        <FormField
          label="Total SGO Contributions"
          tooltip="Total contributions made to qualified Scholarship Granting Organizations during the tax year. The organization must be IRS-approved under IRC §25F."
          irsRef="IRC §25F; OBBBA §70202"
        >
          <CurrencyInput value={info.contributionAmount || 0} onChange={(v) => update('contributionAmount', v)} />
        </FormField>

        <FormField
          label="State Tax Credit Received"
          optional
          helpText="If your state gave you a tax credit for this same donation, enter that amount — it reduces the federal credit dollar-for-dollar"
          irsRef="IRC §25F(d)(2)"
        >
          <CurrencyInput value={info.stateTaxCreditReceived || 0} onChange={(v) => update('stateTaxCreditReceived', v)} />
        </FormField>
      </div>

      {credit > 0 && (
        <div className="rounded-xl border p-6 mt-4 bg-emerald-500/10 border-emerald-500/30 text-center">
          <p className="text-sm text-slate-400">Estimated Scholarship Credit</p>
          <p className="text-2xl font-bold text-emerald-400">${credit.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">Nonrefundable — reduces your tax but not below zero</p>
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
