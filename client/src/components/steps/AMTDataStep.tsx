import { useState } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { updateReturn } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { HELP_CONTENT } from '../../data/helpContent';
import { ShieldAlert, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export default function AMTDataStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const amt = taxReturn.amtData || {};
  const [showAdvanced, setShowAdvanced] = useState(false);

  const help = HELP_CONTENT['amt_data'];

  const update = (field: string, value: number) => {
    updateField('amtData', { ...amt, [field]: value });
  };

  const save = async () => {
    await updateReturn(returnId, { amtData: taxReturn.amtData });
  };

  return (
    <div>
      <StepWarningsBanner stepId="amt_data" />

      <SectionIntro
        icon={<ShieldAlert className="w-8 h-8" />}
        title="AMT Adjustments (Form 6251)"
        description="If you have items that trigger the Alternative Minimum Tax, enter them here. Most filers can skip this section."
      />

      {/* Common AMT Items */}
      <div className="card mt-6">
        <h3 className="font-medium text-slate-200 mb-4 text-sm uppercase tracking-wide">
          Common AMT Items
        </h3>

        <div className="space-y-4">
          <FormField
            label="ISO Exercise Spread (Line 2i)"
            tooltip={help?.fields['ISO Exercise Spread (Line 2i)']?.tooltip}
            irsRef={help?.fields['ISO Exercise Spread (Line 2i)']?.irsRef}
          >
            <CurrencyInput
              value={amt.isoExerciseSpread || 0}
              onChange={(v) => update('isoExerciseSpread', v)}
            />
          </FormField>

          <FormField
            label="Private Activity Bond Interest (Line 2g)"
            tooltip={help?.fields['Private Activity Bond Interest (Line 2g)']?.tooltip}
            irsRef={help?.fields['Private Activity Bond Interest (Line 2g)']?.irsRef}
          >
            <CurrencyInput
              value={amt.privateActivityBondInterest || 0}
              onChange={(v) => update('privateActivityBondInterest', v)}
            />
          </FormField>
        </div>
      </div>

      {/* Additional Adjustments (expandable) */}
      <div className="card mt-4">
        <button
          className="w-full flex items-center justify-between text-left"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <h3 className="font-medium text-slate-200 text-sm uppercase tracking-wide">
            Additional Adjustments
          </h3>
          {showAdvanced
            ? <ChevronUp className="w-5 h-5 text-slate-400" />
            : <ChevronDown className="w-5 h-5 text-slate-400" />
          }
        </button>
        <p className="text-xs text-slate-500 mt-1 mb-3">
          Less common Form 6251 adjustments. Only enter if applicable.
        </p>

        {showAdvanced && (
          <div className="space-y-4 mt-4">
            <FormField
              label="Tax Refund Adjustment (Line 2b)"
              tooltip={help?.fields['Tax Refund Adjustment (Line 2b)']?.tooltip}
              irsRef={help?.fields['Tax Refund Adjustment (Line 2b)']?.irsRef}
            >
              <CurrencyInput
                value={amt.taxRefundAdjustment || 0}
                onChange={(v) => update('taxRefundAdjustment', v)}
              />
            </FormField>

            <FormField
              label="Investment Interest Difference (Line 2c)"
              tooltip={help?.fields['Investment Interest Difference (Line 2c)']?.tooltip}
              irsRef={help?.fields['Investment Interest Difference (Line 2c)']?.irsRef}
            >
              <CurrencyInput
                value={amt.investmentInterestAdjustment || 0}
                onChange={(v) => update('investmentInterestAdjustment', v)}
              />
            </FormField>

            <FormField
              label="Depletion (Line 2d)"
              tooltip={help?.fields['Depletion (Line 2d)']?.tooltip}
              irsRef={help?.fields['Depletion (Line 2d)']?.irsRef}
            >
              <CurrencyInput
                value={amt.depletion || 0}
                onChange={(v) => update('depletion', v)}
              />
            </FormField>

            <FormField
              label="ATNOLD (Line 2f)"
              tooltip={help?.fields['ATNOLD (Line 2f)']?.tooltip}
              irsRef={help?.fields['ATNOLD (Line 2f)']?.irsRef}
            >
              <CurrencyInput
                value={amt.atnold || 0}
                onChange={(v) => update('atnold', v)}
              />
            </FormField>

            <FormField
              label="QSBS Exclusion (Line 2h)"
              tooltip={help?.fields['QSBS Exclusion (Line 2h)']?.tooltip}
              irsRef={help?.fields['QSBS Exclusion (Line 2h)']?.irsRef}
            >
              <CurrencyInput
                value={amt.qsbsExclusion || 0}
                onChange={(v) => update('qsbsExclusion', v)}
              />
            </FormField>

            <FormField
              label="Disposition of Property (Line 2k)"
              tooltip={help?.fields['Disposition of Property (Line 2k)']?.tooltip}
              irsRef={help?.fields['Disposition of Property (Line 2k)']?.irsRef}
            >
              <CurrencyInput
                value={amt.dispositionOfProperty || 0}
                onChange={(v) => update('dispositionOfProperty', v)}
              />
            </FormField>

            <FormField
              label="Depreciation Adjustment (Line 2l)"
              tooltip={help?.fields['Depreciation Adjustment (Line 2l)']?.tooltip}
              irsRef={help?.fields['Depreciation Adjustment (Line 2l)']?.irsRef}
            >
              <CurrencyInput
                value={amt.depreciationAdjustment || 0}
                onChange={(v) => update('depreciationAdjustment', v)}
              />
            </FormField>

            <FormField
              label="Passive Activity Loss (Line 2m)"
              tooltip={help?.fields['Passive Activity Loss (Line 2m)']?.tooltip}
              irsRef={help?.fields['Passive Activity Loss (Line 2m)']?.irsRef}
            >
              <CurrencyInput
                value={amt.passiveActivityLoss || 0}
                onChange={(v) => update('passiveActivityLoss', v)}
              />
            </FormField>

            <FormField
              label="Loss Limitations (Line 2n)"
              tooltip={help?.fields['Loss Limitations (Line 2n)']?.tooltip}
              irsRef={help?.fields['Loss Limitations (Line 2n)']?.irsRef}
            >
              <CurrencyInput
                value={amt.lossLimitations || 0}
                onChange={(v) => update('lossLimitations', v)}
              />
            </FormField>

            <FormField
              label="Circulation Costs (Line 2o)"
              tooltip={help?.fields['Circulation Costs (Line 2o)']?.tooltip}
              irsRef={help?.fields['Circulation Costs (Line 2o)']?.irsRef}
            >
              <CurrencyInput
                value={amt.circulationCosts || 0}
                onChange={(v) => update('circulationCosts', v)}
              />
            </FormField>

            <FormField
              label="Long-Term Contracts (Line 2p)"
              tooltip={help?.fields['Long-Term Contracts (Line 2p)']?.tooltip}
              irsRef={help?.fields['Long-Term Contracts (Line 2p)']?.irsRef}
            >
              <CurrencyInput
                value={amt.longTermContracts || 0}
                onChange={(v) => update('longTermContracts', v)}
              />
            </FormField>

            <FormField
              label="Mining Costs (Line 2q)"
              tooltip={help?.fields['Mining Costs (Line 2q)']?.tooltip}
              irsRef={help?.fields['Mining Costs (Line 2q)']?.irsRef}
            >
              <CurrencyInput
                value={amt.miningCosts || 0}
                onChange={(v) => update('miningCosts', v)}
              />
            </FormField>

            <FormField
              label="Research & Experimental Costs (Line 2r)"
              tooltip={help?.fields['Research & Experimental Costs (Line 2r)']?.tooltip}
              irsRef={help?.fields['Research & Experimental Costs (Line 2r)']?.irsRef}
            >
              <CurrencyInput
                value={amt.researchCosts || 0}
                onChange={(v) => update('researchCosts', v)}
              />
            </FormField>

            <FormField
              label="Intangible Drilling Costs (Line 2t)"
              tooltip={help?.fields['Intangible Drilling Costs (Line 2t)']?.tooltip}
              irsRef={help?.fields['Intangible Drilling Costs (Line 2t)']?.irsRef}
            >
              <CurrencyInput
                value={amt.intangibleDrillingCosts || 0}
                onChange={(v) => update('intangibleDrillingCosts', v)}
              />
            </FormField>

            <FormField
              label="Other AMT Adjustments (Line 3)"
              tooltip={help?.fields['Other AMT Adjustments (Line 3)']?.tooltip}
              irsRef={help?.fields['Other AMT Adjustments (Line 3)']?.irsRef}
            >
              <CurrencyInput
                value={amt.otherAMTAdjustments || 0}
                onChange={(v) => update('otherAMTAdjustments', v)}
              />
            </FormField>
          </div>
        )}
      </div>

      {/* AMT Foreign Tax Credit */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-4 text-sm uppercase tracking-wide">
          AMT Foreign Tax Credit
        </h3>
        <FormField
          label="AMT Foreign Tax Credit (Part II, Line 8)"
          tooltip={help?.fields['AMT Foreign Tax Credit (Part II, Line 8)']?.tooltip}
          irsRef={help?.fields['AMT Foreign Tax Credit (Part II, Line 8)']?.irsRef}
        >
          <CurrencyInput
            value={amt.amtForeignTaxCredit || 0}
            onChange={(v) => update('amtForeignTaxCredit', v)}
          />
        </FormField>
      </div>

      <CalloutCard
        variant="info"
        title="About Form 6251"
        irsUrl={help?.callouts?.[0]?.irsUrl}
      >
        The Alternative Minimum Tax applies a parallel tax system that limits certain
        deductions. Most commonly triggered by incentive stock option (ISO) exercises
        or large state/local tax deductions. The AMT Review step will show whether
        AMT applies to your return.
      </CalloutCard>

      <a href="https://www.irs.gov/forms-pubs/about-form-6251" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation onContinue={save} />
    </div>
  );
}
