import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { Wallet, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import { validateDivorceDate } from '../../utils/dateValidation';
import SSNInput from '../common/SSNInput';
import CalloutCard from '../common/CalloutCard';

export default function OtherIncomeStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['other_income'];

  const save = async () => {
    await updateReturn(returnId, { otherIncome: taxReturn.otherIncome, alimonyReceived: taxReturn.alimonyReceived });
  };

  return (
    <div>
      <StepWarningsBanner stepId="other_income" />
      <SectionIntro icon={<Wallet className="w-8 h-8" />} title="Other Income" description="Enter any other income not covered by the previous categories." />

      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      <div className="mt-6">
        <FormField label="Other Income Amount" tooltip={help?.fields['Other Income Amount']?.tooltip} irsRef={help?.fields['Other Income Amount']?.irsRef} helpText="e.g. rental income, alimony received, prizes, gambling winnings">
          <CurrencyInput value={taxReturn.otherIncome} onChange={(v) => updateField('otherIncome', v)} />
        </FormField>
      </div>

      {/* Alimony Received (pre-2019 agreements) */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-1">Alimony Received</h3>
        <p className="text-sm text-slate-400 mb-4">
          If your divorce or separation agreement was executed <strong className="text-slate-300">before January 1, 2019</strong>, alimony received is taxable income. Post-2018 agreements are not taxable.
        </p>
        <FormField label="Total Alimony Received" optional helpText="Schedule 1, Line 2a">
          <CurrencyInput
            value={taxReturn.alimonyReceived?.totalReceived}
            onChange={(v) => updateField('alimonyReceived', { ...taxReturn.alimonyReceived, totalReceived: v })}
          />
        </FormField>
        {(taxReturn.alimonyReceived?.totalReceived || 0) > 0 && (
          <>
            <FormField label="Payer's SSN" optional>
              <SSNInput
                value={taxReturn.alimonyReceived?.payerSSN || ''}
                onChange={(val) => updateField('alimonyReceived', {
                  ...taxReturn.alimonyReceived,
                  payerSSN: val,
                  payerSSNLastFour: val.length >= 4 ? val.slice(-4) : val,
                })}
                optional
              />
            </FormField>
            <FormField label="Date of Divorce/Separation Agreement" warning={validateDivorceDate(taxReturn.alimonyReceived?.divorceDate || '')}>
              <input
                type="date"
                className="input-field"
                value={taxReturn.alimonyReceived?.divorceDate || ''}
                onChange={(e) => updateField('alimonyReceived', { ...taxReturn.alimonyReceived, divorceDate: e.target.value })}
              />
            </FormField>
            <a
              href="https://www.irs.gov/publications/p504"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Learn more on IRS.gov
            </a>
          </>
        )}
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
