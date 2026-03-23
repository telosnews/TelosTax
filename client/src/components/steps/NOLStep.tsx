import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { RotateCcw, ExternalLink } from 'lucide-react';
import StepWarningsBanner from '../common/StepWarningsBanner';

export default function NOLStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const save = async () => {
    await updateReturn(returnId, { nolCarryforward: taxReturn.nolCarryforward });
  };

  return (
    <div>
      <StepWarningsBanner stepId="nol_carryforward" />

      <SectionIntro
        icon={<RotateCcw className="w-8 h-8" />}
        title="Net Operating Loss Carryforward"
        description="If you had a business loss in a prior year that exceeded your other income, you may carry it forward to reduce this year's AGI."
      />

      <CalloutCard variant="info" title="NOL Carryforward Rules" irsUrl="https://www.irs.gov/publications/p536">
        Post-2017 net operating losses can be carried forward indefinitely but can only offset up to 80% of taxable income in any given year. NOLs cannot be carried back (except for farming losses). Enter the amount from your prior year's NOL computation.
      </CalloutCard>

      <div className="card mt-6">
        <FormField
          label="NOL Carryforward Amount"
          tooltip="A net operating loss (NOL) occurs when your allowable deductions exceed your gross income. Post-2017 NOLs can be carried forward indefinitely but can only offset up to 80% of taxable income. Enter the amount from Form 1045 or its Schedule A."
          irsRef="Schedule 1, Line 8a"
          helpText="From prior year Form 1045 or Schedule A (Form 1045)"
        >
          <CurrencyInput
            value={taxReturn.nolCarryforward || 0}
            onChange={(v) => updateField('nolCarryforward', v)}
          />
        </FormField>

        <a href="https://www.irs.gov/publications/p536" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
