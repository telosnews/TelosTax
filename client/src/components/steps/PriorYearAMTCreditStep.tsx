import { useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertForm8801, updateReturn } from '../../api/client';
import { calculateForm1040 } from '@telostax/engine';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { Calculator, ExternalLink, Info } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';

export default function PriorYearAMTCreditStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['prior_year_amt_credit'];

  const info = taxReturn.form8801 || {
    netPriorYearMinimumTax: 0,
    priorYearCreditCarryforward: 0,
  };

  const update = (field: string, value: unknown) => {
    updateField('form8801', { ...info, [field]: value });
  };

  const save = async () => {
    await upsertForm8801(returnId, { ...info });
  };

  // Live calculation
  const result = useMemo(() => {
    try { return calculateForm1040(taxReturn); } catch { return null; }
  }, [taxReturn]);

  const form8801Result = result?.form8801;
  const totalAvailable = (info.netPriorYearMinimumTax || 0) + (info.priorYearCreditCarryforward || 0);

  return (
    <div>
      <StepWarningsBanner stepId="prior_year_amt_credit" />

      <SectionIntro
        icon={<Calculator className="w-8 h-8" />}
        title="Prior Year Minimum Tax Credit"
        description="Recover AMT paid in prior years due to timing differences like ISO exercises or depreciation (Form 8801)."
      />

      <CalloutCard variant="info" title="How this credit works" irsUrl="https://www.irs.gov/forms-pubs/about-form-8801">
        If you paid AMT in a prior year because of "deferral items" — timing differences that reverse in later years (e.g., ISO stock exercises, depreciation) — you can claim a credit against your regular tax this year. The credit is nonrefundable and limited to the excess of your regular tax over any current-year AMT. Unused credit carries forward indefinitely.
      </CalloutCard>

      <div className="mt-6 space-y-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Calculator className="w-5 h-5 text-telos-blue-400" />
            <h3 className="font-medium text-slate-200">Prior Year AMT Data</h3>
          </div>

          <FormField
            label="Net Prior Year Minimum Tax"
            tooltip={help?.fields['Net Prior Year Minimum Tax']?.tooltip}
            irsRef={help?.fields['Net Prior Year Minimum Tax']?.irsRef}
            helpText="From your prior year Form 8801 or tax software — the AMT amount attributable to deferral items only"
          >
            <CurrencyInput
              value={info.netPriorYearMinimumTax}
              onChange={(v) => update('netPriorYearMinimumTax', v)}
            />
          </FormField>

          <FormField
            label="Credit Carryforward from Prior Years"
            tooltip={help?.fields['Credit Carryforward']?.tooltip}
            irsRef={help?.fields['Credit Carryforward']?.irsRef}
            helpText="Unused minimum tax credit carried forward from prior year Form 8801 Line 26"
            optional
          >
            <CurrencyInput
              value={info.priorYearCreditCarryforward}
              onChange={(v) => update('priorYearCreditCarryforward', v)}
            />
          </FormField>
        </div>

        {/* Live calculation summary */}
        {totalAvailable > 0 && form8801Result && (
          <div className="card bg-surface-800">
            <div className="flex items-center gap-3 mb-3">
              <Info className="w-5 h-5 text-telos-blue-400" />
              <h3 className="font-medium text-slate-200">Credit Calculation</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total credit available:</span>
                <span className="text-slate-200 font-mono">${form8801Result.totalCreditAvailable.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Credit limitation (regular tax − AMT):</span>
                <span className="text-slate-200 font-mono">${form8801Result.creditLimitation.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-1.5 mt-1.5">
                <span className="text-slate-200 font-medium">Credit claimed this year:</span>
                <span className="text-emerald-400 font-mono font-semibold">${form8801Result.credit.toLocaleString()}</span>
              </div>
              {form8801Result.carryforwardToNextYear > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Carryforward to next year:</span>
                  <span className="text-amber-300 font-mono">${form8801Result.carryforwardToNextYear.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {totalAvailable > 0 && form8801Result && form8801Result.credit === 0 && form8801Result.creditLimitation === 0 && (
          <CalloutCard variant="warning" title="Credit limited to zero">
            Your current-year AMT equals or exceeds your regular tax, so the minimum tax credit cannot be used this year. The full amount will carry forward.
          </CalloutCard>
        )}
      </div>

      <a
        href="https://www.irs.gov/forms-pubs/about-form-8801"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation onContinue={save} />
    </div>
  );
}
