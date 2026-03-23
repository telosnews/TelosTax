import { useTaxReturnStore } from '../../store/taxReturnStore';
import { upsertItemized } from '../../api/client';
import FormField from '../common/FormField';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import { Home, ExternalLink } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { ItemizedDeductions } from '@telostax/engine';

const emptyItemized: ItemizedDeductions = {
  medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
  personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
  charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
};

export default function MortgageInterestStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  if (!taxReturn || !returnId) return null;

  const help = HELP_CONTENT['itemized_deductions'];
  const items = taxReturn.itemizedDeductions || emptyItemized;
  const ho = taxReturn.homeOffice;
  const hasHomeOfficeActual = ho?.method === 'actual';

  const update = (field: keyof ItemizedDeductions, value: number) => {
    updateField('itemizedDeductions', { ...items, [field]: value });
  };

  const save = async () => {
    await upsertItemized(returnId, { ...items });
  };

  // Home office auto-populate and mismatch detection
  const autoMortgage = items.mortgageInterest || (hasHomeOfficeActual ? ho?.mortgageInterest : undefined);
  const mortgageMismatch = hasHomeOfficeActual && (
    items.mortgageInterest > 0 &&
    ho?.mortgageInterest != null && ho.mortgageInterest > 0 &&
    items.mortgageInterest !== ho.mortgageInterest
  );

  return (
    <div>
      <StepWarningsBanner stepId="mortgage_interest_ded" />

      <SectionIntro
        icon={<Home className="w-8 h-8" />}
        title="Mortgage Interest"
        description="Enter mortgage interest and insurance premiums from your Form 1098."
      />

      <CalloutCard variant="info" title="Mortgage Interest Limit" irsUrl="https://www.irs.gov/taxtopics/tc505">
        You can deduct interest on up to $750,000 of mortgage debt ($375,000 if MFS) for loans taken after December 15, 2017. If your balance exceeds the limit, the deduction is prorated. Enter your outstanding balance below for automatic proration.
      </CalloutCard>

      <div className="card mt-6">
        <FormField
          label="Mortgage Interest Paid"
          tooltip={help?.fields['Mortgage Interest Paid']?.tooltip}
          irsRef={help?.fields['Mortgage Interest Paid']?.irsRef || 'Schedule A, Line 8a; Form 1098, Box 1'}
          helpText={!items.mortgageInterest && autoMortgage ? 'Auto-filled from Home Office (Form 8829)' : undefined}
          warning={mortgageMismatch ? `This differs from Home Office ($${ho?.mortgageInterest?.toLocaleString()}). Both should be your total mortgage interest.` : undefined}
        >
          <CurrencyInput value={items.mortgageInterest || autoMortgage || 0} onChange={(v) => update('mortgageInterest', v)} />
        </FormField>

        <FormField
          label="Mortgage Insurance Premiums"
          tooltip={help?.fields['Mortgage Insurance Premiums']?.tooltip}
          irsRef={help?.fields['Mortgage Insurance Premiums']?.irsRef || 'Schedule A, Line 8d'}
          optional
          helpText="PMI or MIP from Form 1098, Box 5"
        >
          <CurrencyInput value={items.mortgageInsurancePremiums} onChange={(v) => update('mortgageInsurancePremiums', v)} />
        </FormField>

        <FormField
          label="Outstanding Mortgage Balance"
          optional
          tooltip="Your outstanding mortgage balance at year-end. Only needed if your balance exceeds $750,000 — the deduction will be prorated automatically."
          irsRef="Schedule A, Line 8 instructions"
          helpText="Only enter if your balance exceeds $750,000 ($375,000 MFS)"
        >
          <CurrencyInput value={items.mortgageBalance || 0} onChange={(v) => updateField('itemizedDeductions', { ...items, mortgageBalance: v || undefined })} />
        </FormField>

        <a href="https://www.irs.gov/taxtopics/tc505" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"><ExternalLink className="w-3 h-3" />Learn more on IRS.gov</a>
      </div>

      <StepNavigation onContinue={save} />
    </div>
  );
}
