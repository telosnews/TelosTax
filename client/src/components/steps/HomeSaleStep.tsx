import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Home, AlertTriangle } from 'lucide-react';
import { FilingStatus } from '@telostax/engine';
import StepWarningsBanner from '../common/StepWarningsBanner';
import CalloutCard from '../common/CalloutCard';
import { HELP_CONTENT } from '../../data/helpContent';

const help = HELP_CONTENT['home_sale'];

export default function HomeSaleStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const hs = taxReturn.homeSale || {
    salePrice: 0, costBasis: 0, sellingExpenses: 0,
    ownedMonths: 0, usedAsResidenceMonths: 0, priorExclusionUsedWithin2Years: false,
  };

  const update = (field: string, value: number | boolean) => {
    updateField('homeSale', { ...hs, [field]: value });
  };

  const save = async () => {
    await updateReturn(returnId, { homeSale: taxReturn.homeSale });
  };

  const gain = hs.salePrice - hs.costBasis - (hs.sellingExpenses || 0);
  const meetsOwnershipTest = hs.ownedMonths >= 24;
  const meetsUseTest = hs.usedAsResidenceMonths >= 24;
  const meetsExclusion = meetsOwnershipTest && meetsUseTest && !hs.priorExclusionUsedWithin2Years;
  const isMFJ = taxReturn.filingStatus === FilingStatus.MarriedFilingJointly;
  const maxExclusion = isMFJ ? 500000 : 250000;
  const taxableGain = meetsExclusion ? Math.max(0, gain - maxExclusion) : Math.max(0, gain);

  return (
    <div>
      <StepWarningsBanner stepId="home_sale" />

      <SectionIntro
        icon={<Home className="w-8 h-8" />}
        title="Home Sale"
        description="If you sold your primary residence in 2025, you may be able to exclude up to $250,000 ($500,000 if married filing jointly) of the gain."
      />

      <div className="card mt-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <FormField label="Sale Price" helpText="From Form 1099-S, Box 2" tooltip={help?.fields['Sale Price']?.tooltip} irsRef={help?.fields['Sale Price']?.irsRef}>
              <CurrencyInput value={hs.salePrice} onChange={(v) => update('salePrice', v)} />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label="Cost Basis" helpText="Original purchase price + improvements" tooltip={help?.fields['Cost Basis']?.tooltip} irsRef={help?.fields['Cost Basis']?.irsRef}>
              <CurrencyInput value={hs.costBasis} onChange={(v) => update('costBasis', v)} />
            </FormField>
          </div>
        </div>
        <FormField label="Selling Expenses" optional helpText="Realtor commissions, transfer taxes, title fees" tooltip={help?.fields['Selling Expenses']?.tooltip} irsRef={help?.fields['Selling Expenses']?.irsRef}>
          <CurrencyInput value={hs.sellingExpenses || 0} onChange={(v) => update('sellingExpenses', v)} />
        </FormField>
      </div>

      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-3">Section 121 Exclusion Test</h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <FormField label="Months Owned (last 5 years)" helpText="Need 24+ months to qualify" tooltip={help?.fields['Months Owned (last 5 years)']?.tooltip} irsRef={help?.fields['Months Owned (last 5 years)']?.irsRef}>
              <input
                type="number"
                className="input-field"
                value={hs.ownedMonths || ''}
                onChange={(e) => update('ownedMonths', Number(e.target.value))}
                min={0}
                max={60}
              />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label="Months Used as Residence (last 5 years)" helpText="Need 24+ months to qualify" tooltip={help?.fields['Months Used as Residence (last 5 years)']?.tooltip} irsRef={help?.fields['Months Used as Residence (last 5 years)']?.irsRef}>
              <input
                type="number"
                className="input-field"
                value={hs.usedAsResidenceMonths || ''}
                onChange={(e) => update('usedAsResidenceMonths', Number(e.target.value))}
                min={0}
                max={60}
              />
            </FormField>
          </div>
        </div>

        <label className="flex items-center gap-3 mt-3 cursor-pointer">
          <input
            type="checkbox"
            className="accent-telos-orange-400"
            checked={!!hs.priorExclusionUsedWithin2Years}
            onChange={(e) => update('priorExclusionUsedWithin2Years', e.target.checked)}
          />
          <span className="text-sm text-slate-300">I used the Section 121 exclusion within the last 2 years</span>
        </label>

      </div>

      <div className="mt-4">
        <CalloutCard variant="info" title="Section 121 Exclusion" irsUrl="https://www.irs.gov/taxtopics/tc701">
          You can exclude up to ${isMFJ ? '500,000' : '250,000'} of gain if you owned and used the home as your primary residence for at least 2 of the last 5 years.
        </CalloutCard>
      </div>

      {hs.salePrice > 0 && (
        <div className={`rounded-xl border p-6 mt-4 ${meetsExclusion ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
          <div className="text-center">
            <p className="text-sm text-slate-400">Gain on Sale</p>
            <p className={`text-2xl font-bold ${gain >= 0 ? 'text-white' : 'text-emerald-400'}`}>
              ${gain.toLocaleString()}
            </p>
          </div>
          {meetsExclusion ? (
            <p className="text-sm text-emerald-400 text-center mt-2">
              You qualify for up to ${maxExclusion.toLocaleString()} exclusion.
              {taxableGain > 0
                ? ` Taxable gain: $${taxableGain.toLocaleString()}`
                : ' No taxable gain.'}
            </p>
          ) : (
            <div className="mt-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300">
                You may not qualify for the full exclusion.
                {!meetsOwnershipTest && ' Ownership test not met (need 24+ months).'}
                {!meetsUseTest && ' Use test not met (need 24+ months as primary residence).'}
                {hs.priorExclusionUsedWithin2Years && ' Prior exclusion used within 2 years.'}
              </p>
            </div>
          )}
        </div>
      )}

      <StepNavigation onContinue={save} />
    </div>
  );
}
