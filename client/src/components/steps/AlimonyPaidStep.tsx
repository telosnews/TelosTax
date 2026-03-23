import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { UserMinus, AlertTriangle, ExternalLink } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';
import SSNInput from '../common/SSNInput';
import { validateDivorceDate } from '../../utils/dateValidation';

export default function AlimonyPaidStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const save = async () => {
    await updateReturn(returnId, { alimony: taxReturn.alimony });
  };

  return (
    <div>
      <StepWarningsBanner stepId="alimony_paid" />

      <SectionIntro
        icon={<UserMinus className="w-8 h-8" />}
        title="Alimony Paid"
        description="If your divorce or separation agreement was executed before January 1, 2019, alimony paid is deductible."
      />

      <CalloutCard variant="warning" title="Pre-2019 Agreements Only" irsUrl="https://www.irs.gov/publications/p504">
        Under the Tax Cuts and Jobs Act (TCJA), only alimony paid under divorce or separation agreements executed before January 1, 2019 is deductible. Post-2018 agreements do not qualify. The recipient must report the amount as income.
      </CalloutCard>

      <div className="card mt-6">
        <FormField label="Total Alimony Paid" tooltip="The total amount of alimony or separate maintenance payments you made during the tax year under a pre-2019 divorce or separation agreement." irsRef="Schedule 1, Line 19a" helpText="Must be cash payments under a pre-2019 agreement">
          <CurrencyInput
            value={taxReturn.alimony?.totalPaid || 0}
            onChange={(v) => updateField('alimony', { ...taxReturn.alimony, totalPaid: v })}
          />
        </FormField>

        {(taxReturn.alimony?.totalPaid || 0) > 0 && (
          <>
            <FormField label="Recipient's SSN" optional helpText="Required for deduction" tooltip="The IRS requires the recipient's SSN to claim the alimony deduction. Without the SSN, the deduction may be disallowed and a $50 penalty may apply.">
              <SSNInput
                value={taxReturn.alimony?.recipientSSN || ''}
                onChange={(val) => updateField('alimony', {
                  ...taxReturn.alimony,
                  recipientSSN: val,
                  recipientSSNLastFour: val.length >= 4 ? val.slice(-4) : val,
                })}
                optional
              />
            </FormField>
            <FormField label="Date of Divorce/Separation Agreement" helpText="Must be before Jan 1, 2019 for deduction" tooltip="The execution date determines deductibility. Only agreements executed before January 1, 2019 qualify." warning={validateDivorceDate(taxReturn.alimony?.divorceDate || '')}>
              <input
                type="date"
                className="input-field"
                value={taxReturn.alimony?.divorceDate || ''}
                onChange={(e) => updateField('alimony', { ...taxReturn.alimony, divorceDate: e.target.value })}
              />
            </FormField>
            {taxReturn.alimony?.divorceDate && taxReturn.alimony.divorceDate >= '2019-01-01' && (
              <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  Agreements executed on or after Jan 1, 2019 do not qualify for the alimony deduction under TCJA.
                </p>
              </div>
            )}
          </>
        )}

        <a href="https://www.irs.gov/publications/p504" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
