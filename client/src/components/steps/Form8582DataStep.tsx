import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { Scale, Info } from 'lucide-react';

export default function Form8582DataStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const data = taxReturn.form8582Data || {};

  const update = (field: string, value: number | boolean) => {
    updateField('form8582Data', { ...data, [field]: value });
  };

  const save = async () => {
    await updateReturn(returnId, { form8582Data: taxReturn.form8582Data });
  };

  return (
    <div>
      <StepWarningsBanner stepId="form8582_data" />

      <SectionIntro
        icon={<Scale className="w-8 h-8" />}
        title="Passive Activity Loss Data (Form 8582)"
        description="If you have passive activity losses from rental properties or partnerships, we need a few additional details to compute your limitation."
      />

      {/* Prior-Year Unallowed Losses */}
      <div className="card mt-6">
        <h3 className="font-medium text-slate-200 mb-1 text-sm uppercase tracking-wide">
          Prior-Year Suspended Losses
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          If you filed Form 8582 last year, enter the total unallowed loss from Line 16
          (or your state's equivalent). This carries forward into this year's computation.
        </p>
        <FormField
          label="Prior-Year Unallowed Loss (Form 8582, Line 16)"
          tooltip="Total passive activity losses that were disallowed in prior tax years. Found on your prior year's Form 8582, Line 16, or from your CPA's carryforward schedule. Enter as a positive number."
          irsRef="Form 8582, Line 16; IRC §469(b)"
        >
          <CurrencyInput
            value={data.priorYearUnallowedLoss || 0}
            onChange={(v) => update('priorYearUnallowedLoss', v)}
          />
        </FormField>
      </div>

      {/* Real Estate Professional Election */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-1 text-sm uppercase tracking-wide">
          Real Estate Professional Status
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          If you qualify, rental activities are treated as non-passive — meaning losses
          can fully offset your other income without the $25,000 limitation.
        </p>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={!!data.realEstateProfessional}
            onChange={(e) => update('realEstateProfessional', e.target.checked)}
            className="mt-1 rounded border-slate-600 bg-slate-800 text-telos-blue-500 focus:ring-telos-blue-500"
          />
          <div>
            <span className="text-sm text-slate-200 group-hover:text-white">
              I qualify as a real estate professional under IRC §469(c)(7)
            </span>
            <p className="text-xs text-slate-500 mt-1">
              You must have spent more than 750 hours AND more than 50% of your
              total working time in real property trades or businesses in which you
              materially participated.
            </p>
          </div>
        </label>
      </div>

      {/* Informational Card */}
      <CalloutCard variant="info" title="About Form 8582">
        The passive activity loss rules (IRC §469) generally prevent you from deducting
        losses from passive activities against wages, interest, and other non-passive income.
        A special $25,000 allowance exists for active-participation rental real estate,
        phasing out between $100,000–$150,000 AGI.
      </CalloutCard>

      <div className="mt-4 p-3 rounded-lg bg-telos-blue-500/10 border border-telos-blue-500/20">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-telos-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-400">
            Active participation status and property dispositions are configured on each
            rental property and K-1 entry. You can edit those settings on the Rental
            Income and K-1 Income steps.
          </p>
        </div>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
